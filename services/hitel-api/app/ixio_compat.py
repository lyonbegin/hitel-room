"""HITEL-owned compatibility endpoints for the *shape* of IXIO auth APIs.

The original IXIO APIs, subscriber entitlements and encryption keys are not
impersonated. All positive results come from HITEL verified membership and
persistent authorization. No carrier API is contacted.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, select
from sqlalchemy.orm import Mapped, Session, mapped_column


class VerifyCtnRequestRQ(BaseModel):
    ctn: str = Field(min_length=20, max_length=3000)


class PostUserId(BaseModel):
    userId: str = Field(min_length=1, max_length=128)


class PostCtn(BaseModel):
    ctn: str = Field(min_length=1, max_length=3000)


class PostTokenData(BaseModel):
    authCode: str
    state: str
    codeVerifier: str


class ProductCode(BaseModel):
    # Field name from original DTO must be confirmed by static contract audit.
    productCode: str = Field(min_length=1, max_length=80)


class PKCEStart(BaseModel):
    state: str = Field(min_length=16, max_length=128)
    codeChallenge: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")


def install_compat(*, app: Any, base: Any, member_class: Any,
                   db_dep: Any, member_dep: Any, secret: str, clock: Any) -> None:
    """Install routes before main FastAPI startup creates all schema."""
    class CompatibilityService(base):
        __tablename__ = "ixio_compat_service_memberships"
        id: Mapped[str] = mapped_column(String(36), primary_key=True)
        user_id: Mapped[str] = mapped_column(
            String(36), ForeignKey("members.id"), nullable=False)
        product_code: Mapped[str] = mapped_column(String(80), nullable=False)
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True), default=clock, nullable=False)
        __table_args__ = (UniqueConstraint("user_id", "product_code"),)

    class CompatibilityAuthCode(base):
        __tablename__ = "ixio_compat_auth_codes"
        code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
        user_id: Mapped[str] = mapped_column(
            String(36), ForeignKey("members.id"), nullable=False)
        state: Mapped[str] = mapped_column(String(128), nullable=False)
        challenge: Mapped[str] = mapped_column(String(43), nullable=False)
        expires_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True), nullable=False)
        used_at: Mapped[datetime | None] = mapped_column(
            DateTime(timezone=True), nullable=True)

    product_code = os.getenv("HITEL_IXIO_PRODUCT_CODE", "HITEL_DEVELOPMENT")
    # Explicit development purpose; production provisioning should be controlled
    # by an internal operator, not by a user-controlled "join" request alone.
    enabled = os.getenv("HITEL_IXIO_COMPAT_ENABLED", "false").lower() == "true"

    def ensure_enabled() -> None:
        if not enabled:
            raise HTTPException(503, "IXIO compatibility routes are disabled")

    def success(data: Any) -> dict[str, Any]:
        return {"code": "SUCCESS", "message": "OK", "data": data}

    def fail(code: str, message: str) -> dict[str, Any]:
        return {"code": code, "message": message, "data": None}

    def issue_jwt(member_id: str, kind: str, duration: timedelta) -> str:
        now = clock()
        issuer = "hitel-api" if kind == "access" else f"hitel-ixio-{kind}"
        return jwt.encode({
            "sub": member_id, "iss": issuer, "iat": now,
            "exp": now + duration, "jti": str(uuid.uuid4()),
            "purpose": kind,
        }, secret, algorithm="HS256")

    def token_data(member_id: str) -> dict:
        # Original TokenData's serializer field names are verified in a
        # separate CI artifact; these are confined to HITEL-issued credentials.
        return {
            "accessToken": issue_jwt(member_id, "access", timedelta(minutes=30)),
            "refreshToken": issue_jwt(member_id, "refresh", timedelta(days=7)),
            "idToken": issue_jwt(member_id, "id", timedelta(minutes=30)),
        }

    def member_by_authorization(auth: str, db: Session, refresh: bool=False) -> Any:
        if not auth.startswith("Bearer "):
            raise HTTPException(401, "HITEL Bearer authorization required")
        issuer = "hitel-ixio-refresh" if refresh else "hitel-api"
        try:
            token = jwt.decode(auth[7:], secret, algorithms=["HS256"],
                               issuer=issuer, options={"require": ["sub", "exp", "iss"]})
            member = db.get(member_class, token["sub"])
            if member is None:
                raise ValueError("Unknown HITEL member")
            return member
        except (jwt.PyJWTError, ValueError, KeyError):
            raise HTTPException(401, "HITEL token invalid or expired") from None

    def product_membership(db: Session, user_id: str) -> CompatibilityService | None:
        return db.execute(
            select(CompatibilityService).where(
                CompatibilityService.user_id == user_id,
                CompatibilityService.product_code == product_code,
            )).scalar_one_or_none()

    @app.post("/hitel/ixio/ctn-proof")
    def issue_ctn_proof(member: Any=Depends(member_dep)) -> dict:
        """Same 'ctn' String request shape, but private HITEL proof format.

        This is NOT compatible with original carrier-issued provisioning DEKs.
        Requires existing verified HITEL membership and cannot enumerate phones.
        """
        ensure_enabled()
        now = clock()
        proof = jwt.encode({
            "sub": member.id, "iss": "hitel-ixio-ctn",
            "aud": "hitel-ixio-compat",
            "iat": now, "exp": now + timedelta(minutes=3),
            "jti": str(uuid.uuid4()),
        }, secret, algorithm="HS256")
        return {"ctn": proof, "expiresIn": 180, "encoding": "HITEL_JWT_CTN_PROOF"}

    @app.post("/v1/members/verify-ctn")
    def verify_ctn(request: VerifyCtnRequestRQ, db: Session=Depends(db_dep)) -> dict:
        ensure_enabled()
        try:
            claims = jwt.decode(
                request.ctn, secret, algorithms=["HS256"],
                issuer="hitel-ixio-ctn", audience="hitel-ixio-compat",
                options={"require": ["sub", "exp", "iss", "aud"]},
            )
            member = db.get(member_class, claims["sub"])
            if member is None:
                return fail("ERROR_NOT_REGISTERED", "HITEL member not found")
            return success({"isRegistered": True})
        except (jwt.PyJWTError, KeyError):
            return fail("ERROR_INVALID_CTN", "HITEL CTN proof invalid or expired")

    @app.post("/hitel/ixio/auth-code/start")
    def start_pkce(request: PKCEStart, member: Any=Depends(member_dep),
                   db: Session=Depends(db_dep)) -> dict:
        ensure_enabled()
        code = secrets.token_urlsafe(32)
        record = CompatibilityAuthCode(
            code_hash=hashlib.sha256(code.encode()).hexdigest(),
            user_id=member.id, state=request.state, challenge=request.codeChallenge,
            expires_at=clock() + timedelta(minutes=5),
        )
        db.add(record)
        db.commit()
        return {"authCode": code, "state": request.state, "expiresIn": 300}

    @app.post("/auth-code")
    def exchange_code(request: PostTokenData, db: Session=Depends(db_dep)) -> dict:
        ensure_enabled()
        if not 43 <= len(request.codeVerifier) <= 128:
            return fail("ERROR_INVALID_VERIFIER", "Invalid PKCE verifier")
        try:
            verifier_bytes = request.codeVerifier.encode("ascii")
        except UnicodeEncodeError:
            return fail("ERROR_INVALID_VERIFIER", "Invalid PKCE verifier")
        digest = base64.urlsafe_b64encode(hashlib.sha256(verifier_bytes).digest()).rstrip(b"=").decode()
        rec = db.get(CompatibilityAuthCode,
                     hashlib.sha256(request.authCode.encode()).hexdigest())
        if (rec is None or rec.used_at is not None or
            clock() > rec.expires_at.replace(tzinfo=timezone.utc) or
            not hmac.compare_digest(rec.challenge, digest) or
            not hmac.compare_digest(rec.state, request.state)):
            return fail("ERROR_INVALID_GRANT", "Invalid or expired HITEL authorization grant")
        member = db.get(member_class, rec.user_id)
        if member is None:
            return fail("ERROR_INVALID_GRANT", "HITEL member not found")
        rec.used_at = clock()
        db.commit()
        return success(token_data(member.id))

    @app.post("/auth-code/corporation")
    def corporation_code_not_configured(request: PostTokenData) -> dict:
        ensure_enabled()
        return fail("ERROR_NOT_CONFIGURED", "Corporate HITEL authorization is not configured")

    @app.post("/autologin")
    def auto_login(request: PostUserId, authorization: str=Header(default=""),
                   db: Session=Depends(db_dep)) -> dict:
        ensure_enabled()
        member = member_by_authorization(authorization, db, refresh=True)
        if not hmac.compare_digest(member.id, request.userId):
            raise HTTPException(403, "HITEL member mismatch")
        return success(token_data(member.id))

    @app.get("/v2/service")
    def get_service(userVersion: str, model: str, osVersion: str, os: str,
                    authorization: str=Header(default=""),
                    db: Session=Depends(db_dep)) -> dict:
        ensure_enabled()
        member = member_by_authorization(authorization, db)
        return success({"isJoined": product_membership(db, member.id) is not None})

    @app.post("/v2/service")
    def post_service(request: ProductCode, authorization: str=Header(default=""),
                     db: Session=Depends(db_dep)) -> dict:
        ensure_enabled()
        member = member_by_authorization(authorization, db)
        if request.productCode != product_code:
            return fail("ERROR_UNKNOWN_PRODUCT", "Product is not enabled in HITEL")
        if product_membership(db, member.id) is None:
            db.add(CompatibilityService(id=str(uuid.uuid4()),
                        user_id=member.id, product_code=product_code))
            db.commit()
        return success({})

    @app.delete("/v2/service")
    def delete_service(authorization: str=Header(default=""),
                       db: Session=Depends(db_dep)) -> dict:
        ensure_enabled()
        member = member_by_authorization(authorization, db)
        record = product_membership(db, member.id)
        if record:
            db.delete(record)
            db.commit()
        return success({})

    @app.post("/ctn")
    def post_ctn(request: PostCtn, authorization: str=Header(default=""),
                 db: Session=Depends(db_dep)) -> dict:
        ensure_enabled()
        member = member_by_authorization(authorization, db)
        # Never disclose a different subscriber's phone via this endpoint.
        if not hmac.compare_digest(request.ctn, member.phone):
            raise HTTPException(403, "CTN does not match verified HITEL member")
        return success({"ctn": member.phone})

    # These payloads have additional original fields and protocol dependencies.
    # Do not fabricate successful responses until verified and implemented.
    @app.get("/login")
    def get_login_data() -> dict:
        ensure_enabled()
        return fail("ERROR_NOT_CONFIGURED", "LoginData contract not yet wired")

    @app.post("/v2/login")
    def get_login_data_v2(request: PostCtn) -> dict:
        ensure_enabled()
        return fail("ERROR_NOT_CONFIGURED", "LoginData V2 contract not yet wired")
