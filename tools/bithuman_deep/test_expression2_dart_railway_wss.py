#!/usr/bin/env python3
"""External HTTPS/WSS E2E probe for the original Dart mock-realtime Railway server.

One short-lived HITEL demo bearer is minted for this single CI run.
Never print or store its value. No bitHuman vendor entitlement is claimed.
"""
import asyncio
import base64
import json
import os
import secrets
import urllib.error
import urllib.request

from websockets.asyncio.client import connect
from websockets.exceptions import InvalidStatus

BASE = os.getenv(
    "HITEL_DART_REALTIME_BASE",
    "https://hitel-expression2-dart-realtime-production.up.railway.app",
).rstrip("/")
AUTH_BASE = os.getenv(
    "HITEL_EXPR2_AUTH_BASE",
    "https://hitel-expression2-auth-production.up.railway.app",
).rstrip("/")
WSS = BASE.replace("https://", "wss://", 1) + (
    "/v1/realtime?model=gpt-realtime-mini"
)


def request_json(url, *, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data, method="POST" if payload is not None else "GET",
        headers={"Content-Type": "application/json",
                 "Cache-Control": "no-cache"},
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        assert response.status == 200, response.status
        return json.loads(response.read())


def new_demo_bearer():
    data = request_json(AUTH_BASE + "/v1/demo/session", payload={
        "agent_code": "A23WJF0199",
        "install_id": secrets.token_urlsafe(24),
    })
    token = data.get("access_token")
    assert data.get("token_type") == "bearer"
    assert isinstance(token, str) and token.startswith("htdemo.v1.")
    return token


async def expect_rejected(headers=None):
    try:
        async with connect(
            WSS, additional_headers=headers, open_timeout=15,
            close_timeout=5,
        ) as ws:
            await ws.recv()
    except InvalidStatus as ex:
        assert ex.response.status_code == 401, (
            "Expected 401, got %s" % ex.response.status_code
        )
        return
    raise AssertionError("Unauthorized WebSocket unexpectedly accepted")


async def recv_json(ws):
    data = await asyncio.wait_for(ws.recv(), timeout=15)
    assert isinstance(data, str)
    return json.loads(data)


async def smoke():
    health = request_json(BASE + "/healthz")
    assert health["service"] == "hitel-expression2-dart-realtime", health
    assert health["ok"] and health["model_rendering"] is False
    print("PASS_PUBLIC_RAILWAY_DART_HEALTH")

    await expect_rejected()
    await expect_rejected({"Authorization": "Bearer invalid_test_token"})
    print("PASS_UNAUTHORIZED_WSS_401")

    token = new_demo_bearer()
    async with connect(
        WSS, additional_headers={"Authorization": "Bearer " + token},
        open_timeout=15, close_timeout=5, max_size=200000,
    ) as ws:
        first = await recv_json(ws)
        assert first["type"] == "session.created", first
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {"type": "realtime",
                        "output_modalities": ["audio"]},
        }))
        await ws.send(json.dumps({"type": "response.create"}))
        audio_chunks = 0
        audio_bytes = 0
        transcripts = 0
        created = False
        for _ in range(40):
            item = await recv_json(ws)
            kind = item.get("type")
            if kind == "response.created":
                created = True
            elif kind == "response.output_audio.delta":
                raw = base64.b64decode(item["delta"], validate=True)
                assert len(raw) == 4800, len(raw)  # 100ms PCM16 @24kHz
                audio_chunks += 1
                audio_bytes += len(raw)
            elif kind == "response.output_audio_transcript.delta":
                transcripts += 1
            elif kind == "response.done":
                break
            elif kind == "error":
                raise AssertionError("Mock server returned error event")
        else:
            raise AssertionError("No response.done after expected events")
        assert created and audio_chunks == 10 and audio_bytes == 48000
        assert transcripts >= 1
        print("PASS_AUTH_WSS_SESSION_AND_AUDIO_DELTAS_10x4800_24KHZ")
        await ws.send(json.dumps({"type": "response.cancel"}))
        for _ in range(5):
            item = await recv_json(ws)
            if item.get("type") == "response.cancelled":
                print("PASS_ORIGINAL_DART_RESPONSE_CANCEL_EVENT")
                break
        else:
            raise AssertionError("No response.cancelled")
    print("PASS_EXTERNAL_RAILWAY_DART_MOCK_REALTIME_E2E")


if __name__ == "__main__":
    asyncio.run(smoke())
