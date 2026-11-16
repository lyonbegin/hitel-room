#!/usr/bin/env python3
"""Private short-lived noVNC gateway for Chrome in GitHub Actions.

Public GitHub workflow stores only SHA-256 digest of a 320-bit random
capability token. The capability itself is sent privately to the operator,
NOT in GitHub source/logs/artifacts. A successful /join/<capability> GET
sets an HttpOnly Secure browser cookie. All HTTP files and WebSocket VNC
frames are rejected until that cookie is validated. The capability token
is removed from the URL via redirect before loading noVNC resources.

No Samsung account data, cookies, passwords, device images or session
storage are written to artifacts. The browser profile is destroyed with
the temporary runner at the end.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import hmac
import os
import secrets
import sys
from aiohttp import ClientSession, WSMsgType, web

SESSIONS: set[str] = set()
ORIGIN = "http://127.0.0.1:6080"
COOKIE_NAME = "rtl_private_viewer"
TOKEN_HASH = None

SECURE_HEADERS = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


def auth(request: web.Request) -> bool:
    value = request.cookies.get(COOKIE_NAME, "")
    return len(value) >= 30 and value in SESSIONS


def not_authorized() -> web.Response:
    return web.Response(status=403, text="Private remote viewer: authorization required.",
                        headers=SECURE_HEADERS)


async def join(request: web.Request) -> web.Response:
    supplied = request.match_info["capability"]
    checksum = hashlib.sha256(supplied.encode("utf-8")).hexdigest()
    if not hmac.compare_digest(checksum, TOKEN_HASH):
        # Do not indicate if a token was well formed or close to the actual one.
        return not_authorized()
    session = secrets.token_urlsafe(36)
    SESSIONS.add(session)
    response = web.HTTPFound("/vnc.html?autoconnect=true&resize=scale")
    response.set_cookie(
        COOKIE_NAME, session, httponly=True, secure=True, samesite="Lax",
        max_age=7200, path="/",
    )
    for key, value in SECURE_HEADERS.items():
        response.headers[key] = value
    return response


async def proxy_http(request: web.Request) -> web.Response:
    if not auth(request):
        return not_authorized()
    if request.path == "/":
        return web.HTTPFound("/vnc.html?autoconnect=true&resize=scale",
                             headers=SECURE_HEADERS)
    # GET/HEAD only: never proxy any writes into the local viewer.
    if request.method not in ("GET", "HEAD"):
        return web.Response(status=405, headers=SECURE_HEADERS)
    url = ORIGIN + request.rel_url.path_qs
    async with ClientSession(auto_decompress=False) as client:
        async with client.request(
            request.method, url, allow_redirects=False,
            timeout=__import__("aiohttp").ClientTimeout(total=30),
        ) as upstream:
            payload = await upstream.read()
            response = web.Response(body=payload, status=upstream.status)
            for key in ("Content-Type", "Content-Encoding", "Location"):
                if key in upstream.headers:
                    response.headers[key] = upstream.headers[key]
            for key, value in SECURE_HEADERS.items():
                response.headers[key] = value
            return response


async def proxy_socket(request: web.Request) -> web.StreamResponse:
    if not auth(request):
        return not_authorized()
    requested_protocols = [
        p.strip() for p in request.headers.get(
            "Sec-WebSocket-Protocol", "binary").split(",") if p.strip()
    ]
    if not requested_protocols:
        requested_protocols = ["binary"]
    socket = web.WebSocketResponse(protocols=requested_protocols)
    await socket.prepare(request)
    backend = ORIGIN.replace("http://", "ws://") + request.rel_url.path_qs
    try:
        async with ClientSession() as session:
            async with session.ws_connect(
                backend, protocols=requested_protocols, heartbeat=30
            ) as remote:
                async def to_remote():
                    async for m in socket:
                        if m.type == WSMsgType.BINARY:
                            await remote.send_bytes(m.data)
                        elif m.type == WSMsgType.TEXT:
                            await remote.send_str(m.data)
                        elif m.type in (WSMsgType.CLOSE, WSMsgType.ERROR):
                            break

                async def from_remote():
                    async for m in remote:
                        if m.type == WSMsgType.BINARY:
                            await socket.send_bytes(m.data)
                        elif m.type == WSMsgType.TEXT:
                            await socket.send_str(m.data)
                        elif m.type in (WSMsgType.CLOSE, WSMsgType.ERROR):
                            break

                tasks = [asyncio.create_task(to_remote()),
                         asyncio.create_task(from_remote())]
                done, pending = await asyncio.wait(
                    tasks, return_when=asyncio.FIRST_COMPLETED
                )
                for t in pending:
                    t.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as error:
        print("RTL_VNC_WS_BROKEN_TYPE=" + type(error).__name__, flush=True)
    finally:
        await socket.close()
    return socket


async def on_shutdown(app: web.Application):
    SESSIONS.clear()


def main():
    global TOKEN_HASH
    p = argparse.ArgumentParser()
    p.add_argument("--digest", default=os.environ.get("RTL_VIEWER_TOKEN_SHA256", ""))
    p.add_argument("--listen", type=int, default=6081)
    args = p.parse_args()
    if len(args.digest) != 64 or not all(
        c in "0123456789abcdef" for c in args.digest
    ):
        raise SystemExit("Refuse to serve a browser without a valid 256-bit SHA256 capability digest")
    TOKEN_HASH = args.digest
    app = web.Application(client_max_size=1024**2)
    app.router.add_get("/join/{capability}", join)
    app.router.add_route("*", "/websockify", proxy_socket)
    app.router.add_route("*", "/{path:.*}", proxy_http)
    app.on_shutdown.append(on_shutdown)
    web.run_app(
        app, host="127.0.0.1", port=args.listen,
        print=lambda *_: None, access_log=None,
    )


if __name__ == "__main__":
    main()
