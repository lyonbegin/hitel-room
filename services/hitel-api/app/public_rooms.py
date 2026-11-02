"""Public HITEL room catalog.

Important: Catalog admission never bypasses the original Fly WebRTC
server's participant authorization. Open admission requires
policy.allowUnlistedParticipants===True on the actual original session.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
import os
import re

import httpx
import jwt
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import String, DateTime, Integer, select
from sqlalchemy.orm import Mapped, mapped_column

RTC_BASE = os.getenv("HITEL_FLY_RTC_BASE", "https://webrtc-new.fly.dev").rstrip("/")

class PublicRoomRequest(BaseModel):
    id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
    hostUserId: str = Field(min_length=1, max_length=128)
    title: str | None = Field(default=None, max_length=100)

async def upstream(token: str, room_id: str) -> dict[str, Any]:
    if not token:
        raise HTTPException(401, "기존 WebRTC 로그인 토큰이 필요합니다.")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res=await client.get(
                f"{RTC_BASE}/telemedicine/consultations/{room_id}",
                headers={"Authorization": f"Bearer {token}"})
    except httpx.HTTPError:
        raise HTTPException(502, "기존 WebRTC 서버 연결에 실패했습니다.") from None
    if res.status_code in (401, 403, 404):
        raise HTTPException(403, "기존 WebRTC 서버에서 이 사용자의 공개방 조회·입장을 허용하지 않았습니다.")
    if res.status_code >= 400:
        raise HTTPException(502, f"기존 WebRTC 서버 오류: HTTP {res.status_code}")
    try:
        data = res.json()
    except ValueError:
        raise HTTPException(502, "기존 WebRTC 서버 응답 형식이 올바르지 않습니다.") from None
    if not isinstance(data, dict) or data.get("id") != room_id:
        raise HTTPException(502, "기존 WebRTC 방 ID를 확인하지 못했습니다.")
    return data

def actor_id(token: str) -> str:
    # Only call after upstream() has accepted this exact JWT.
    try:
        payload=jwt.decode(token, options={"verify_signature":False})
    except jwt.PyJWTError:
        raise HTTPException(401, "유효하지 않은 로그인 토큰입니다.") from None
    actor=payload.get("sub") or payload.get("userId") or payload.get("user_id")
    if not isinstance(actor, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}",actor):
        raise HTTPException(403, "WebRTC 로그인 토큰에서 사용자 ID를 확인할 수 없습니다.")
    return actor

def require_open_policy(room: dict[str, Any]) -> None:
    if (room.get("policy") or {}).get("allowUnlistedParticipants") is not True:
        raise HTTPException(409, "원본 WebRTC 서버가 초대 없는 공개 입장을 지원하지 않습니다. 서버의 공개방 참가 정책 수정이 필요합니다.")

def serialize(room) -> dict:
    return {"id":room.id, "title":room.title,
            "hostUserId":room.host_user_id, "maxParticipants":room.max_participants,
            "createdAt":int(room.created_at.timestamp()), "status":room.status}

def register_public_rooms(app, Base, SessionLocal):
    class PublicRoom(Base):
        __tablename__="hitel_public_rooms"
        id: Mapped[str] = mapped_column(String(128), primary_key=True)
        title: Mapped[str] = mapped_column(String(100), nullable=False)
        host_user_id: Mapped[str] = mapped_column(String(128), nullable=False)
        max_participants: Mapped[int] = mapped_column(Integer, nullable=False)
        status: Mapped[str] = mapped_column(String(20), default="OPEN")
        created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda:datetime.now(timezone.utc))
    router=APIRouter(prefix="/v1/public-rooms",tags=["public-rooms"])

    @router.get("")
    def listing():
        cutoff=datetime.now(timezone.utc)-timedelta(days=7)
        with SessionLocal() as db:
            rooms=db.scalars(select(PublicRoom).where(
                PublicRoom.status=="OPEN",PublicRoom.created_at>=cutoff
            ).order_by(PublicRoom.created_at.desc()).limit(100)).all()
            return {"rooms":[serialize(r) for r in rooms]}

    @router.post("",status_code=201)
    async def publish(body:PublicRoomRequest,authorization:str=Header(default="")):
        token=authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else ""
        actual=await upstream(token,body.id)
        if actual.get("status") in ("ENDED","CANCELLED"):
            raise HTTPException(409,"종료된 방은 공개할 수 없습니다.")
        if actor_id(token)!=body.hostUserId or body.hostUserId not in (actual.get("hostUserIds") or []):
            raise HTTPException(403,"방장 본인만 공개방을 등록할 수 있습니다.")
        require_open_policy(actual)
        title=str(actual.get("title") or body.title or "영상 대화방").strip()[:100]
        max_people=max(2,min(100,int((actual.get("policy") or {}).get("maxParticipants") or 12)))
        with SessionLocal() as db:
            room=db.get(PublicRoom,body.id)
            if room is None:
                room=PublicRoom(id=body.id,title=title,host_user_id=body.hostUserId,
                                max_participants=max_people)
                db.add(room)
            else:
                if room.host_user_id!=body.hostUserId:
                    raise HTTPException(403,"다른 방장의 공개방입니다.")
                room.title=title
                room.max_participants=max_people
                room.status="OPEN"
            db.commit()
            db.refresh(room)
            return {"room":serialize(room)}

    @router.post("/{room_id}/join")
    async def join(room_id:str,authorization:str=Header(default="")):
        token=authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else ""
        with SessionLocal() as db:
            item=db.get(PublicRoom,room_id)
            if item is None or item.status!="OPEN":
                raise HTTPException(404,"공개 방을 찾을 수 없습니다.")
        actual=await upstream(token,room_id)
        if actual.get("status") in ("ENDED","CANCELLED"):
            raise HTTPException(410,"이미 종료된 방입니다.")
        require_open_policy(actual)
        # The browser's session:join Socket.IO ack is the definitive admission.
        return {"session":actual}

    @router.post("/{room_id}/close")
    async def close(room_id:str,authorization:str=Header(default="")):
        token=authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else ""
        with SessionLocal() as db:
            item=db.get(PublicRoom,room_id)
            if item is None:
                raise HTTPException(404,"등록되지 않은 방입니다.")
            actual=await upstream(token,room_id)
            if actor_id(token)!=item.host_user_id or item.host_user_id not in (actual.get("hostUserIds") or []):
                raise HTTPException(403,"방장 본인만 방 목록에서 종료할 수 있습니다.")
            item.status="CLOSED"
            db.commit()
        return {"ok":True}

    app.include_router(router)
