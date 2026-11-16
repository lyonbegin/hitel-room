"""Public HTTPS gateway for HITEL-owned Expression 2 authorization.

This is not a bitHuman vendor license or a replacement for vendor entitlement.
It validates the HITEL member's EXISTING session with the HITEL API's /v1/me.
No embedded test bearer, no synthetic "valid=true" on anonymous requests.
Native app traffic reaches this service over Railway TLS, not localhost.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from collections import defaultdict, deque
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse

VERSION = "2026-11-16.1"
UPSTREAM = os.environ.get("HITEL_AUTH_UPSTREAM", "").strip().rstrip("/")
ALLOWED_AGENTS = {
    s.strip() for s in os.environ.get("HITEL_EXPR2_PUBLIC_AGENTS", "A23WJF0199").split(",")
    if s.strip()
}
ALLOWED_PRODUCTS = {"expression-2"}
DEMO_ENABLED = os.environ.get("HITEL_EXPR2_DEMO_ENABLED", "false").lower() == "true"
DEMO_KEY = os.environ.get("HITEL_EXPR2_DEMO_SIGNING_KEY", "").encode("utf-8")
_demo_rate: dict[str, deque[float]] = defaultdict(deque)
if DEMO_ENABLED and len(DEMO_KEY) < 40:
    raise RuntimeError("HITEL_EXPR2_DEMO_SIGNING_KEY must be >=40 bytes when demo is enabled")
_rate: dict[str, deque[float]] = defaultdict(deque)
_rate_lock = asyncio.Lock()
app = FastAPI(title="HITEL Expression 2 Authorization", docs_url=None, redoc_url=None)

def _error(status: int, code: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code})

async def _rate_limit(request: Request) -> None:
    # Rate limiting does not replace the upstream JWT verification.
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    async with _rate_lock:
        d = _rate[ip]
        while d and now - d[0] > 60:
            d.popleft()
        if len(d) >= 240:
            raise _error(429, "RATE_LIMITED")
        d.append(now)

async def _payload(request: Request) -> dict[str, Any]:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type != "application/json":
        raise _error(415, "JSON_REQUIRED")
    raw = await request.body()
    if len(raw) < 2 or len(raw) > 65536:
        raise _error(413, "REQUEST_SIZE_INVALID")
    try:
        import json
        data = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise _error(400, "INVALID_JSON") from None
    if not isinstance(data, dict):
        raise _error(422, "OBJECT_REQUIRED")
    return data


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * ((-len(text)) % 4))

def _demo_token(agent: str, install_id: str) -> tuple[str,int]:
    now = int(time.time())
    exp = now + 3600
    claims = {
        "iss": "hitel-expression2-demo", "sub": hashlib.sha256(
            install_id.encode("utf-8") + DEMO_KEY).hexdigest()[:32],
        "aud": "hitel-expression2-public-sample",
        "agent": agent, "iat": now, "exp": exp,
        "nonce": secrets.token_hex(16)
    }
    part = _b64url(json.dumps(claims, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signed = ("htdemo.v1." + part).encode("ascii")
    signature = _b64url(hmac.new(DEMO_KEY, signed, hashlib.sha256).digest())
    return signed.decode("ascii") + "." + signature, exp - now

def _verify_demo_token(token: str) -> str:
    if not DEMO_ENABLED or len(DEMO_KEY) < 40:
        raise _error(401, "DEMO_SESSION_DISABLED")
    parts = token.split(".")
    if len(parts) != 4 or parts[:2] != ["htdemo", "v1"]:
        raise _error(401, "INVALID_DEMO_SESSION")
    if len(token) > 2048:
        raise _error(401, "INVALID_DEMO_SESSION")
    signed = ".".join(parts[:3]).encode("ascii")
    signature = _b64url(hmac.new(DEMO_KEY, signed, hashlib.sha256).digest())
    if not hmac.compare_digest(parts[3], signature):
        raise _error(401, "INVALID_DEMO_SESSION")
    try:
        claim = json.loads(_unb64(parts[2]).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, TypeError):
        raise _error(401, "INVALID_DEMO_SESSION") from None
    now = int(time.time())
    if (claim.get("iss") != "hitel-expression2-demo"
            or claim.get("aud") != "hitel-expression2-public-sample"
            or claim.get("agent") not in ALLOWED_AGENTS
            or type(claim.get("exp")) is not int
            or not now < claim["exp"] <= now + 3600
            or type(claim.get("iat")) is not int
            or claim["iat"] > now + 30
            or not isinstance(claim.get("sub"), str)):
        raise _error(401, "INVALID_DEMO_SESSION")
    return "demo:" + claim["sub"]

async def _verify_hitel_user(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer "):
        raise _error(401, "HITEL_SESSION_REQUIRED")
    token = authorization[7:]
    if not (20 <= len(token) <= 8192) or any(c.isspace() for c in token):
        raise _error(401, "INVALID_HITEL_SESSION")
    if token.startswith("htdemo."):
        return _verify_demo_token(token)
    # Never accept known local CI markers as production credentials.
    if token.startswith("EXPR2_") or token.startswith("CI_"):
        raise _error(401, "TEST_CREDENTIAL_NOT_ACCEPTED")
    if not UPSTREAM.startswith("https://"):
        raise _error(503, "HITEL_AUTH_UPSTREAM_NOT_CONFIGURED")
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as client:
            response = await client.get(
                UPSTREAM + "/v1/me",
                headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
            )
    except httpx.HTTPError:
        raise _error(503, "HITEL_AUTH_UPSTREAM_UNREACHABLE") from None
    if response.status_code in (401, 403):
        raise _error(401, "HITEL_SESSION_REJECTED")
    if response.status_code != 200:
        raise _error(503, "HITEL_AUTH_UPSTREAM_UNAVAILABLE")
    try:
        member = response.json()
        user_id = member["user_id"]
    except (ValueError, KeyError, TypeError):
        raise _error(503, "HITEL_AUTH_INVALID_RESPONSE") from None
    if not isinstance(user_id, str) or not re.fullmatch(r"[0-9a-fA-F-]{32,36}", user_id):
        raise _error(503, "HITEL_AUTH_INVALID_MEMBER")
    return user_id

def _require_public_agent(data: dict[str, Any]) -> None:
    if data.get("product") not in ALLOWED_PRODUCTS:
        raise _error(422, "UNSUPPORTED_PRODUCT")
    code = data.get("agent_code")
    if code is not None and (not isinstance(code, str) or code not in ALLOWED_AGENTS):
        raise _error(403, "AGENT_NOT_ALLOWED")
    if not ALLOWED_AGENTS:
        raise _error(503, "NO_PUBLIC_MODELS_CONFIGURED")

@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {
        "ok": True, "service": "hitel-expression2-auth",
        "version": VERSION, "public_https": True,
        "upstream_configured": UPSTREAM.startswith("https://"),
        "licensed_vendor_entitlement": False,
        "public_demo_enabled": DEMO_ENABLED,
    }

@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return (
        "<!doctype html><html lang='ko'><meta charset='utf-8'>"
        "<title>HITEL Expression 2 인증 연결</title>"
        "<style>body{max-width:760px;margin:50px auto;font:17px/1.6 system-ui;"
        "padding:0 18px}code{background:#eee;padding:3px}</style>"
        "<h1>HITEL Expression 2 인증 서버</h1>"
        "<p>공개 HTTPS 연결이 마련되었습니다. 사용자·단말 인증은 HITEL 로그인 "
        "세션을 필요로 하며, 공개 주소가 곧 무제한 인증을 뜻하지 않습니다.</p>"
        "<p>상태 확인: <a href='/healthz'>/healthz</a></p>"
        "<p>원본 공개 샘플용 임시 세션: <code>POST /v1/demo/session</code></p>"
        "<p>SDK 경로: <code>POST /v1/auth/validate</code>, "
        "<code>POST /v1/meter/beats</code></p>"
        "<p>기존 bitHuman 사업자의 별도 라이선스를 발급하지 않습니다.</p></html>"
    )


@app.post("/v1/demo/session")
async def public_demo_session(request: Request) -> JSONResponse:
    """One-hour scoped token for the original public Wise Pup asset, not vendor licensing.

    Each installation must request a new session over HTTPS. There is NO fixed
    credential in the APK. This endpoint is restricted to a public sample model.
    """
    await _rate_limit(request)
    if not DEMO_ENABLED:
        raise _error(403, "DEMO_DISABLED")
    data = await _payload(request)
    agent = data.get("agent_code")
    install_id = data.get("install_id")
    if agent not in ALLOWED_AGENTS or agent != "A23WJF0199":
        raise _error(403, "PUBLIC_AGENT_ONLY")
    if not isinstance(install_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", install_id):
        raise _error(422, "INSTALL_ID_INVALID")
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    async with _rate_lock:
        d = _demo_rate[ip]
        while d and now - d[0] > 3600:
            d.popleft()
        if len(d) >= 12:
            raise _error(429, "DEMO_SESSION_HOURLY_LIMIT")
        d.append(now)
    token, ttl = _demo_token(agent, install_id)
    return JSONResponse({
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ttl,
        "scope": "public-wise-pup-expression2-debug",
    }, headers={"Cache-Control": "no-store"})

@app.post("/v1/auth/validate")
async def validate(request: Request) -> JSONResponse:
    await _rate_limit(request)
    data = await _payload(request)
    _require_public_agent(data)
    await _verify_hitel_user(request)
    # These are HITEL-owned, first-party access semantics, NOT vendor license.
    return JSONResponse({"valid": True, "meter_tail": True},
                        headers={"Cache-Control": "no-store"})

@app.post("/v1/meter/beats")
async def meter_beats(request: Request) -> JSONResponse:
    await _rate_limit(request)
    data = await _payload(request)
    _require_public_agent(data)
    required = {
        "session_id": str, "seq": int, "served_s": (float, int),
        "talking_s": (float, int), "install_id": str,
        "billing_type": str, "deployment": str,
    }
    for field, kind in required.items():
        val = data.get(field)
        if not isinstance(val, kind) or isinstance(val, bool):
            raise _error(422, "METER_FIELD_INVALID_" + field.upper())
    if data["seq"] < 0 or not (0 <= data["talking_s"] <= data["served_s"]):
        raise _error(422, "METER_VALUE_INVALID")
    await _verify_hitel_user(request)
    # This endpoint acknowledges HITEL-owned test session telemetry only.
    # Durable billing/accounting is NOT implemented and is not represented.
    return JSONResponse({"meter_tail": True},
                        headers={"Cache-Control": "no-store"})
