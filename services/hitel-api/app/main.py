"""HITEL platform control-plane MVP.

The existing Fly WebRTC service is not modified. This API handles identity,
verified phone numbers, device capability registration, and interaction records.
No endpoint here claims to intercept a carrier call or place a PSTN call.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import httpx
import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

DATABASE_URL = os.getenv("HITEL_DATABASE_URL", "sqlite:///./hitel-dev.db")
SECRET = os.getenv("HITEL_JWT_SECRET")
if not SECRET or len(SECRET) < 32:
    # Do not launch the service with a hardcoded or guessable auth secret.
    raise RuntimeError("HITEL_JWT_SECRET must be configured (>=32 characters)")
SMS_PROVIDER_URL = os.getenv("HITEL_SMS_PROVIDER_URL", "")
SMS_PROVIDER_TOKEN = os.getenv("HITEL_SMS_PROVIDER_TOKEN", "")
ORIGINS = [x.strip() for x in os.getenv("HITEL_CORS_ORIGINS", "").split(",") if x.strip()]

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite:") else {})
SessionLocal = sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class Member(Base):
    __tablename__ = "members"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class OTPChallenge(Base):
    __tablename__ = "otp_challenges"
    phone: Mapped[str] = mapped_column(String(20), primary_key=True)
    challenge_id: Mapped[str] = mapped_column(String(36), nullable=False)
    digest: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

class Device(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("members.id"), nullable=False)
    platform: Mapped[str] = mapped_column(String(16), nullable=False)
    capabilities: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Interaction(Base):
    __tablename__ = "interactions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("members.id"), nullable=False)
    purpose: Mapped[str] = mapped_column(String(80), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    target: Mapped[str | None] = mapped_column(String(256), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="CREATED", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def kr_mobile(value: str) -> str:
    s = re.sub(r"[^0-9+]", "", value)
    if s.startswith("+82"):
        s = "0" + s[3:]
    elif s.startswith("82"):
        s = "0" + s[2:]
    if not re.fullmatch(r"010[0-9]{8}", s):
        raise HTTPException(422, "Only Korean 010 mobile numbers are supported for OTP onboarding")
    return "+82" + s[1:]

def otp_digest(phone: str, nonce: str, code: str) -> str:
    return hmac.new(SECRET.encode(), f"{phone}:{nonce}:{code}".encode(), hashlib.sha256).hexdigest()

def session() -> Session:
    with SessionLocal() as db:
        yield db

def member_from_token(authorization: str = Header(default=""), db: Session = Depends(session)) -> Member:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Bearer token required")
    try:
        payload = jwt.decode(authorization[7:], SECRET, algorithms=["HS256"], options={"require": ["sub", "exp", "iss"]}, issuer="hitel-api")
        user = db.get(Member, payload["sub"])
        if user is None:
            raise ValueError("unknown member")
        return user
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, "Invalid or expired session") from None

class PhoneRequest(BaseModel):
    phone: str

class PhoneVerify(PhoneRequest):
    code: str = Field(pattern=r"^\d{6}$")

class DeviceInput(BaseModel):
    device_id: str = Field(min_length=8, max_length=128)
    platform: Literal["android", "ios", "web"]
    capabilities: dict[str, bool] = Field(default_factory=dict)

class InteractionInput(BaseModel):
    purpose: str = Field(min_length=1, max_length=80)
    channel: Literal["P", "P_PLUS", "NATIVE_VOIP", "WEBRTC"]
    target: str | None = Field(default=None, max_length=256)

async def deliver_sms(phone: str, code: str) -> None:
    if not SMS_PROVIDER_URL or not SMS_PROVIDER_TOKEN or not SMS_PROVIDER_URL.startswith("https://"):
        raise HTTPException(503, "SMS provider is not configured")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                SMS_PROVIDER_URL,
                json={"to": phone, "message": f"[HITEL] Verification code: {code}"},
                headers={"Authorization": f"Bearer {SMS_PROVIDER_TOKEN}"},
            )
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(502, "SMS delivery failed") from exc

app = FastAPI(title="HITEL Interaction API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])

@app.on_event("startup")
def create_schema() -> None:
    Base.metadata.create_all(bind=engine)

@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "hitel-api", "version": "0.1.0"}

@app.post("/v1/auth/otp/request", status_code=202)
async def request_phone(body: PhoneRequest, db: Session = Depends(session)) -> dict:
    phone = kr_mobile(body.phone)
    now = utcnow()
    record = db.get(OTPChallenge, phone)
    if record and now - record.last_sent_at.replace(tzinfo=timezone.utc) < timedelta(seconds=60):
        raise HTTPException(429, "Wait 60 seconds between verification requests")
    code = f"{secrets.randbelow(1_000_000):06d}"
    nonce = str(uuid.uuid4())
    await deliver_sms(phone, code)
    if record is None:
        record = OTPChallenge(phone=phone, challenge_id=nonce, digest="", expires_at=now, last_sent_at=now)
        db.add(record)
    record.challenge_id = nonce
    record.digest = otp_digest(phone, nonce, code)
    record.expires_at = now + timedelta(minutes=5)
    record.last_sent_at = now
    record.attempts = 0
    db.commit()
    return {"accepted": True, "expires_in": 300, "resend_after": 60}

@app.post("/v1/auth/otp/verify")
def verify_phone(body: PhoneVerify, db: Session = Depends(session)) -> dict:
    phone = kr_mobile(body.phone)
    challenge = db.get(OTPChallenge, phone)
    now = utcnow()
    if challenge is None or now > challenge.expires_at.replace(tzinfo=timezone.utc) or challenge.attempts >= 5:
        raise HTTPException(400, "Verification code expired or attempts exhausted")
    challenge.attempts += 1
    if not hmac.compare_digest(challenge.digest, otp_digest(phone, challenge.challenge_id, body.code)):
        db.commit()
        raise HTTPException(400, "Invalid verification code")
    member = db.execute(select(Member).where(Member.phone == phone)).scalar_one_or_none()
    if member is None:
        member = Member(id=str(uuid.uuid4()), phone=phone)
        db.add(member)
    db.delete(challenge)
    db.commit()
    token = jwt.encode(
        {"sub": member.id, "iss": "hitel-api", "iat": now, "exp": now + timedelta(days=7)},
        SECRET, algorithm="HS256"
    )
    return {"access_token": token, "token_type": "bearer", "user_id": member.id, "verified_phone": phone}

@app.get("/v1/me")
def my_profile(member: Member = Depends(member_from_token)) -> dict:
    return {"user_id": member.id, "verified_phone": member.phone}

@app.post("/v1/devices", status_code=201)
def register_device(body: DeviceInput, member: Member = Depends(member_from_token), db: Session = Depends(session)) -> dict:
    device = db.get(Device, body.device_id)
    if device and device.user_id != member.id:
        raise HTTPException(409, "Device already belongs to another member")
    if device is None:
        device = Device(id=body.device_id, user_id=member.id, platform=body.platform)
        db.add(device)
    device.platform = body.platform
    device.capabilities = body.capabilities
    device.updated_at = utcnow()
    db.commit()
    return {"device_id": device.id, "platform": device.platform, "capabilities": device.capabilities}

@app.get("/v1/devices")
def list_devices(member: Member = Depends(member_from_token), db: Session = Depends(session)) -> dict:
    devices = db.execute(select(Device).where(Device.user_id == member.id)).scalars().all()
    return {"devices": [{"device_id": x.id, "platform": x.platform, "capabilities": x.capabilities} for x in devices]}

@app.post("/v1/interactions", status_code=201)
def create_interaction(body: InteractionInput, member: Member = Depends(member_from_token), db: Session = Depends(session)) -> dict:
    obj = Interaction(id=str(uuid.uuid4()), owner_id=member.id, purpose=body.purpose, channel=body.channel, target=body.target)
    db.add(obj)
    db.commit()
    return {"id": obj.id, "status": obj.status, "channel": obj.channel, "purpose": obj.purpose, "target": obj.target}

@app.get("/v1/interactions")
def list_interactions(member: Member = Depends(member_from_token), db: Session = Depends(session)) -> dict:
    records = db.execute(select(Interaction).where(Interaction.owner_id == member.id).order_by(Interaction.created_at.desc()).limit(50)).scalars().all()
    return {"interactions": [{"id": x.id, "status": x.status, "channel": x.channel, "purpose": x.purpose, "target": x.target} for x in records]}
