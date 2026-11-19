#!/usr/bin/env python3
"""Build a sanitized, read-only monitoring snapshot for GitHub Pages.

Runs only on GitHub Actions. Reads the *existing* public HITEL endpoints.
Never deploys to, writes to, authenticates to, or modifies Railway.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request

BASE = "https://hitel-integration-api-production.up.railway.app"
PATHS = {
    "status": "/integrations/v1/public/status",
    "rooms": "/integrations/v1/public/rooms",
    "worker": "/integrations/v1/worker/autostart",
}
MAX_BODY_BYTES = 300_000

def read_public(path: str) -> dict:
    url = BASE + path
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json",
                 "User-Agent": "HITEL-GitHub-Pages-ReadOnly-Monitor/1.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=16) as response:
            if response.status != 200:
                return {"ok": False, "error": "HTTP_" + str(response.status)}
            body = response.read(MAX_BODY_BYTES + 1)
            if len(body) > MAX_BODY_BYTES:
                return {"ok": False, "error": "RESPONSE_TOO_LARGE"}
            result = json.loads(body)
            if not isinstance(result, dict):
                raise ValueError("not_a_JSON_object")
            return {"ok": True, "data": result}
    except urllib.error.HTTPError as exc:
        return {"ok": False, "error": "HTTP_" + str(exc.code)}
    except (urllib.error.URLError, TimeoutError, OSError, ValueError,
            json.JSONDecodeError) as exc:
        return {"ok": False, "error": type(exc).__name__}

def sanitize_status(raw: dict) -> dict:
    return {
        "worker_connected": bool(raw.get("worker_connected")),
        "worker_autostart_configured": bool(raw.get("worker_autostart_configured")),
        "same_room_name_reuses_conversation":
            bool(raw.get("same_room_name_reuses_conversation")),
        "supported": str(raw.get("supported", "unknown"))[:32],
    }

def sanitize_worker(raw: dict) -> dict:
    result = {
        "worker_connected": bool(raw.get("worker_connected")),
        "auto_start_configured": bool(raw.get("auto_start_configured")),
        "launch_status": str(raw.get("launch_status", "unknown"))[:40],
    }
    for key in ("launch_attempts", "pending_verified_chat_jobs"):
        val = raw.get(key)
        if isinstance(val, int) and not isinstance(val, bool) and val >= 0:
            result[key] = val
    return result

def sanitize_rooms(raw: dict) -> dict:
    rooms = raw.get("rooms")
    if not isinstance(rooms, list):
        raise ValueError("rooms_not_a_list")
    safe = []
    for row in rooms[:250]:
        if not isinstance(row, dict):
            continue
        name = row.get("room_name")
        identifier = row.get("room_id")
        if not isinstance(name, str) or not isinstance(identifier, str):
            continue
        safe.append({
            "room_name": name[:160],
            "room_id": identifier[:64],
            "conversation_linked": bool(row.get("conversation_linked")),
        })
    return {"rooms": safe, "reported_count": len(rooms),
            "is_truncated": len(rooms) > len(safe)}

def build() -> dict:
    sources = {}
    methods = {
        "status": sanitize_status,
        "worker": sanitize_worker,
        "rooms": sanitize_rooms,
    }
    for name, path in PATHS.items():
        response = read_public(path)
        if response.get("ok"):
            try:
                response["data"] = methods[name](response["data"])
            except (ValueError, KeyError, TypeError):
                response = {"ok": False, "error": "INVALID_PUBLIC_RESPONSE"}
        sources[name] = response
        print("SOURCE", name, "OK" if response["ok"] else response["error"])
    return {
        "schema_version": 1,
        "collected_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "read_only": True,
        "railway_modified": False,
        "sources": sources,
        "limitations": {
            "individual_job_totals": "not_available_via_existing_public_API",
            "automatic_snapshot_frequency": "scheduled_every_five_minutes",
            "question_or_response_content": "not_collected",
            "room_owner_names": "not_collected",
            "program_identity": "mapped_only_from_configured_room_prefixes",
        }
    }

def main() -> None:
    destination = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("data/status.json")
    payload = build()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False,
                                      separators=(",", ":")) + "\n", encoding="utf-8")
    assert payload["read_only"] and not payload["railway_modified"]
    print("PASS_GITHUB_PAGES_MONITOR_SNAPSHOT", destination)
    print("UPSTREAM_OK_COUNT", sum(s["ok"] for s in payload["sources"].values()))

if __name__ == "__main__":
    main()
