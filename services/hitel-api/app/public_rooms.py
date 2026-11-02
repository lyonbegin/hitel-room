"""Railway-hosted public video rooms with authenticated WebRTC mesh signaling.

No Fly.io deployment or changes. Fly's existing login verifies identities;
media travels directly between browser RTCPeerConnections (STUN/TURN).
This is separate from the original mediasoup room type.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets
import time
import uuid

import httpx
import jwt
from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import String, DateTime, Integer, select
from sqlalchemy.orm import Mapped, mapped_column

IDENTITY_URL = os.getenv("HITEL_FLY_RTC_BASE", "https://webrtc-new.fly.dev").rstrip("/")
ROOM_TTL_DAYS = 7
MAX_SIGNAL_BYTES = 100000

class CreateRoom(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    maxParticipants: int = Field(default=8, ge=2, le=12)

def now():
    return datetime.now(timezone.utc)

def bearer(value: str):
    if not value.startswith("Bearer "):
        raise HTTPException(401, "로그인 후 다시 시도해 주십시오.")
    token=value[7:].strip()
    if not token:
        raise HTTPException(401, "로그인 토큰이 없습니다.")
    return token

async def verified_identity(token: str):
    """Verify token on ORIGINAL existing Fly auth service; never trust unsigned claims alone."""
    if not token:
        raise HTTPException(401, "로그인이 필요합니다.")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response=await client.get(
                IDENTITY_URL+"/telemedicine/consultations/me",
                headers={"Authorization": "Bearer "+token})
        if response.status_code in (401,403):
            raise HTTPException(401, "로그인 인증이 만료되었습니다.")
        if response.status_code != 200:
            raise HTTPException(502, "기존 로그인 인증 서버를 확인할 수 없습니다.")
        claims=jwt.decode(token,options={"verify_signature":False,"verify_exp":True})
        user=str(claims.get("sub") or "")
        if not user or len(user)>128:
            raise HTTPException(401, "로그인 사용자 정보를 확인할 수 없습니다.")
        return user, str(claims.get("name") or claims.get("displayName") or user)[:80]
    except httpx.HTTPError:
        raise HTTPException(502, "기존 로그인 서버와 통신하지 못했습니다.") from None
    except jwt.PyJWTError:
        raise HTTPException(401, "로그인 토큰이 올바르지 않습니다.") from None

def register_public_rooms(app,Base,SessionLocal):
    class PublicRoom(Base):
        __tablename__="hitel_public_rooms"
        id: Mapped[str]=mapped_column(String(128),primary_key=True)
        title: Mapped[str]=mapped_column(String(100),nullable=False)
        host_user_id: Mapped[str]=mapped_column(String(128),nullable=False)
        max_participants: Mapped[int]=mapped_column(Integer,nullable=False)
        status: Mapped[str]=mapped_column(String(20),default="OPEN",nullable=False)
        created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)

    router=APIRouter(prefix="/v1/public-rooms",tags=["public-rooms"])
    sockets:dict[str,dict[str,tuple[WebSocket,str,str]]] = defaultdict(dict)
    tickets:dict[str,tuple[str,str,str,float]]={}
    lock=asyncio.Lock()

    def room_row(room_id):
        with SessionLocal() as db:
            row=db.get(PublicRoom,room_id)
            if row is None or row.status!="OPEN":
                raise HTTPException(404,"공개 영상방이 없거나 종료되었습니다.")
            return {"id":row.id,"title":row.title,"host":row.host_user_id,
                    "hostName":row.host_user_id,"capacity":row.max_participants,
                    "created":row.created_at,"status":row.status}

    def as_session(row):
        participants=[{"userId":row["host"],"displayName":row["hostName"],"role":"HOST",
                       "presence":"LIVE","ready":True,
                       "permissions":{"publishAudio":True,"publishVideo":True,
                           "consumeAudio":True,"consumeVideo":True,
                           "shareScreen":False,"manageSession":True,
                           "manageParticipants":True}}]
        for _peer, (_socket,uid,name) in sockets.get(row["id"],{}).items():
            if uid==row["host"]:
                continue
            participants.append({"userId":uid,"displayName":name,"role":"GUEST",
                "presence":"LIVE","ready":True,
                "permissions":{"publishAudio":True,"publishVideo":True,
                    "consumeAudio":True,"consumeVideo":True,
                    "shareScreen":False,"manageSession":False,
                    "manageParticipants":False}})
        return {"id":row["id"],"title":row["title"],"type":"PUBLIC_ROOM",
                "status":"LIVE","hostUserIds":[row["host"]],"participants":participants,
                "policy":{"topology":"MANY_TO_MANY","maxParticipants":row["capacity"],
                    "waitingRoom":False,"requireHostStart":False,
                    "allowUnlistedParticipants":True,"allowRejoinAfterEnd":False},
                "createdAt":row["created"].isoformat(),"metadata":{"transport":"railway-mesh"}}

    def active_rows():
        cutoff=now()-timedelta(days=ROOM_TTL_DAYS)
        with SessionLocal() as db:
            return [{"id":r.id,"title":r.title,"host":r.host_user_id,
                "hostName":r.host_user_id,"capacity":r.max_participants,
                "created":r.created_at,"status":r.status}
              for r in db.scalars(select(PublicRoom).where(PublicRoom.status=="OPEN",
                PublicRoom.created_at>=cutoff).order_by(PublicRoom.created_at.desc()).limit(100)).all()]

    @router.get("")
    async def list_rooms(authorization:str=Header(default="")):
        await verified_identity(bearer(authorization))
        return [as_session(r) for r in active_rows()]

    @router.get("/{room_id}")
    async def get_room(room_id:str,authorization:str=Header(default="")):
        await verified_identity(bearer(authorization))
        return as_session(room_row(room_id))

    @router.post("",status_code=201)
    async def create_room(body:CreateRoom,authorization:str=Header(default="")):
        user,name=await verified_identity(bearer(authorization))
        title=body.title.strip()
        if not title:
            raise HTTPException(422,"방 이름을 입력해 주십시오.")
        with SessionLocal() as db:
            owned=db.scalars(select(PublicRoom).where(PublicRoom.host_user_id==user,
                     PublicRoom.status=="OPEN")).all()
            if len(owned)>=5:
                raise HTTPException(429,"동시에 개설할 수 있는 공개방은 5개입니다.")
            room=PublicRoom(id=str(uuid.uuid4()),title=title,host_user_id=user,
                 max_participants=body.maxParticipants,created_at=now())
            db.add(room);db.commit()
            return as_session(room_row(room.id))

    @router.post("/{room_id}/join")
    async def join_room(room_id:str,authorization:str=Header(default="")):
        user,name=await verified_identity(bearer(authorization))
        async with lock:
            room=room_row(room_id)
            online={uid for _s,uid,_n in sockets[room_id].values()}
            reserved={uid for rid,uid,_n,deadline in tickets.values()
                        if rid==room_id and deadline>time.time()}
            if user not in online and user not in reserved and len(online|reserved)>=room["capacity"]:
                raise HTTPException(409,"대화방 정원이 초과되었습니다.")
            ticket=secrets.token_urlsafe(32)
            tickets[hashlib.sha256(ticket.encode()).hexdigest()]=(
                room_id,user,name,time.time()+45)
            return {"session":as_session(room),"ticket":ticket}

    @router.post("/{room_id}/end")
    async def end_room(room_id:str,authorization:str=Header(default="")):
        user,_=await verified_identity(bearer(authorization))
        async with lock:
            row=room_row(room_id)
            if row["host"]!=user:
                raise HTTPException(403,"방장만 대화방을 종료할 수 있습니다.")
            with SessionLocal() as db:
                existing=db.get(PublicRoom,room_id)
                existing.status="CLOSED"
                db.commit()
            peers=list(sockets[room_id].values())
            for ws,_id,_name in peers:
                try:await ws.send_json({"type":"room-ended"})
                except Exception:pass
                try:await ws.close(code=1000)
                except Exception:pass
            sockets.pop(room_id,None)
            for key,(rid,*_) in list(tickets.items()):
                if rid==room_id:tickets.pop(key,None)
            result=as_session(row)
            result["status"]="ENDED"
            return {"ok":True,"session":result}

    @router.websocket("/{room_id}/signal")
    async def signaling(ws:WebSocket,room_id:str,ticket:str=""):
        key=hashlib.sha256(ticket.encode()).hexdigest()
        peer_id=None
        async with lock:
            claim=tickets.pop(key,None)
            try:row=room_row(room_id)
            except HTTPException:row=None
            if not claim or not row or claim[0]!=room_id or claim[3]<time.time():
                await ws.close(code=1008);return
            user,name=claim[1],claim[2]
            if len(sockets[room_id])>=row["capacity"]:
                await ws.close(code=1008);return
            peer_id=str(uuid.uuid4())
            prior=[{"peerId":pid,"userId":uid,"name":n} for pid,(_s,uid,n) in sockets[room_id].items()]
            await ws.accept()
            sockets[room_id][peer_id]=(ws,user,name)
            await ws.send_json({"type":"welcome","peerId":peer_id,"peers":prior})
            for pid,(other,_u,_n) in list(sockets[room_id].items()):
                if pid!=peer_id:
                    try:await other.send_json({"type":"peer-joined","peerId":peer_id,"userId":user,"name":name})
                    except Exception:pass
        try:
            while True:
                msg=await ws.receive_json()
                if not isinstance(msg,dict) or msg.get("type") not in ("signal","ping"):
                    continue
                if msg["type"]=="ping":
                    await ws.send_json({"type":"pong"});continue
                to=msg.get("to")
                data=msg.get("data")
                if not isinstance(data,dict) or len(str(data))>MAX_SIGNAL_BYTES:
                    await ws.close(code=1009);break
                if not ("description" in data or "candidate" in data):
                    continue
                async with lock:
                    destination=sockets[room_id].get(to)
                    if destination:
                        try:await destination[0].send_json({"type":"signal","from":peer_id,
                            "userId":user,"data":data})
                        except Exception:pass
        except (WebSocketDisconnect,RuntimeError,ValueError):
            pass
        finally:
            async with lock:
                peers=sockets.get(room_id,{})
                if peer_id in peers and peers[peer_id][0] is ws:
                    del peers[peer_id]
                    for _pid,(other,_uid,_name) in list(peers.items()):
                        try:await other.send_json({"type":"peer-left","peerId":peer_id})
                        except Exception:pass

    app.include_router(router)
