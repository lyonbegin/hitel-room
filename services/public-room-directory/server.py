"""Persistent, server-validated HITEL open room directory.

Does not forge Fly WebRTC session memberships. Actual admission is delegated to
the existing Fly /telemedicine/consultations/:id and /realtime session:join
contract. The browser must display an explicit error if the upstream refuses
unlisted participants.
"""
from __future__ import annotations
import json
import os
import re
import sqlite3
import time
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit

PORT = int(os.environ.get("PORT", "8080"))
DATABASE_PATH = os.environ.get("ROOM_DB_PATH", "/data/open-rooms.sqlite3")
WEBRTC_API = os.environ.get("WEBRTC_API", "https://webrtc-new.fly.dev").rstrip("/")
MAX_AGE = 7 * 86400
lock = threading.RLock()

def database():
    os.makedirs(os.path.dirname(DATABASE_PATH) or ".", exist_ok=True)
    db = sqlite3.connect(DATABASE_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA busy_timeout=10000")
    db.execute("""CREATE TABLE IF NOT EXISTS rooms (
        session_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        host_user_id TEXT NOT NULL,
        max_participants INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN'
    )""")
    db.commit()
    return db

def upstream_session(token, session_id):
    if not token or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", session_id):
        raise RoomError(401, "실제 WebRTC 사용자 인증 또는 방 ID가 필요합니다.")
    req = Request(WEBRTC_API + "/telemedicine/consultations/" + session_id,
                  headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=10) as resp:
            data = json.load(resp)
            if not isinstance(data, dict) or data.get("id") != session_id:
                raise RoomError(502, "원본 서버의 통화방 응답을 확인할 수 없습니다.")
            return data
    except HTTPError as err:
        if err.code in (401, 403, 404):
            raise RoomError(403, "기존 WebRTC 서버에서 이 사용자의 공개방 조회·입장을 허용하지 않았습니다.")
        raise RoomError(502, "기존 WebRTC 서버에 연결할 수 없습니다.")
    except (URLError, TimeoutError, ValueError):
        raise RoomError(502, "기존 WebRTC 서버의 응답을 확인할 수 없습니다.")

class RoomError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message

def room_response(row):
    return {"id": row["session_id"], "title": row["title"],
            "hostUserId": row["host_user_id"], "maxParticipants": row["max_participants"],
            "createdAt": row["created_at"], "status": row["status"]}

def read_rooms():
    with lock, database() as db:
        db.execute("UPDATE rooms SET status='EXPIRED' WHERE created_at < ? AND status='OPEN'",
                   (int(time.time()) - MAX_AGE,))
        db.commit()
        return [room_response(r) for r in db.execute(
            "SELECT * FROM rooms WHERE status='OPEN' ORDER BY created_at DESC LIMIT 100")]

def open_room(token, payload):
    if not isinstance(payload, dict):
        raise RoomError(400, "요청 정보가 올바르지 않습니다.")
    sid = str(payload.get("id") or "")
    user = str(payload.get("hostUserId") or "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", user):
        raise RoomError(400, "방장 ID가 올바르지 않습니다.")
    session = upstream_session(token, sid)
    if user not in (session.get("hostUserIds") or []):
        raise RoomError(403, "기존 WebRTC 서버에 등록된 방장만 방을 공개할 수 있습니다.")
    policy = session.get("policy") or {}
    if policy.get("allowUnlistedParticipants") is not True:
        raise RoomError(409, "원본 WebRTC 서버에서 초대 없는 공개 입장을 허용하지 않습니다. 서버 공개방 정책 구현이 필요합니다.")
    if session.get("status") in ("ENDED", "CANCELLED"):
        raise RoomError(409, "이미 종료된 방입니다.")
    title = str(session.get("title") or payload.get("title") or "영상 대화방").strip()[:100]
    capacity = max(2, min(int(session.get("policy", {}).get("maxParticipants") or 12), 100))
    with lock, database() as db:
        db.execute("""INSERT INTO rooms(session_id,title,host_user_id,max_participants,created_at,status)
           VALUES (?,?,?,?,?,'OPEN')
           ON CONFLICT(session_id) DO UPDATE SET title=excluded.title,
                max_participants=excluded.max_participants,status='OPEN'""",
           (sid, title, user, capacity, int(time.time())))
        db.commit()
        return room_response(db.execute("SELECT * FROM rooms WHERE session_id=?", (sid,)).fetchone())

def join_room(token, sid):
    with lock, database() as db:
        row = db.execute("SELECT * FROM rooms WHERE session_id=? AND status='OPEN'",
                         (sid,)).fetchone()
        if not row:
            raise RoomError(404, "공개 방을 찾을 수 없거나 종료되었습니다.")
    session = upstream_session(token, sid)
    if session.get("status") in ("ENDED", "CANCELLED"):
        raise RoomError(410, "종료된 대화방입니다.")
    if (session.get("policy") or {}).get("allowUnlistedParticipants") is not True:
        raise RoomError(409, "원본 WebRTC 서버가 초대 없는 입장을 차단하고 있습니다.")
    # Session:join still does the authoritative admission in the browser.
    return session

def close_room(token, sid):
    with lock, database() as db:
        row = db.execute("SELECT * FROM rooms WHERE session_id=?", (sid,)).fetchone()
        if not row:
            raise RoomError(404, "등록된 방이 없습니다.")
        actual = upstream_session(token, sid)
        if row["host_user_id"] not in (actual.get("hostUserIds") or []):
            raise RoomError(403, "방장만 종료할 수 있습니다.")
        db.execute("UPDATE rooms SET status='CLOSED' WHERE session_id=?", (sid,))
        db.commit()
        return {"ok": True}

class Handler(BaseHTTPRequestHandler):
    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_request(self, method):
        try:
            path = urlsplit(self.path).path.rstrip("/") or "/"
            if method == "GET" and path == "/health":
                return self.reply(200, {"ok": True, "service": "hitel-open-room-directory"})
            if method == "GET" and path == "/v1/rooms":
                return self.reply(200, {"rooms": read_rooms()})
            match = re.fullmatch(r"/v1/rooms/([A-Za-z0-9_-]{1,128})/(join|close)", path)
            if not ((method == "POST" and path == "/v1/rooms") or
                    (method == "POST" and match and match.group(2) in ("join","close"))):
                raise RoomError(404, "정의되지 않은 API입니다.")
            auth = self.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                raise RoomError(401, "WebRTC 사용자 로그인 후 다시 시도해 주십시오.")
            token = auth[7:].strip()
            length = int(self.headers.get("Content-Length", "0"))
            if length > 8192 or length < 0:
                raise RoomError(413, "허용된 요청 크기를 초과했습니다.")
            raw = self.rfile.read(length) if length else b"{}"
            payload = json.loads(raw)
            if path == "/v1/rooms":
                return self.reply(201, {"room": open_room(token, payload)})
            if match.group(2) == "join":
                return self.reply(200, {"session": join_room(token, match.group(1))})
            return self.reply(200, close_room(token, match.group(1)))
        except RoomError as e:
            return self.reply(e.status, {"error": e.message})
        except (ValueError, TypeError, json.JSONDecodeError):
            return self.reply(400, {"error": "요청 형식이 올바르지 않습니다."})
        except Exception:
            return self.reply(500, {"error": "공개 대화방 처리 중 서버 오류가 발생했습니다."})

    def do_GET(self): return self.handle_request("GET")
    def do_POST(self): return self.handle_request("POST")
    def log_message(self, fmt, *args): pass

if __name__ == "__main__":
    with database(): pass
    print(f"HITEL room directory listening :{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
