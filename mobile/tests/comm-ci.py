#!/usr/bin/env python3
"""Provision an expiring test call and verify an emulator's native call socket.
The token is scoped to one new ephemeral call; no permanent account credentials."""
import json
import os
import sys
import time
import urllib.request

BASE = os.getenv("HITEL_COMM_RELAY_URL", "https://hitel-device-relay-production.up.railway.app").rstrip("/")
MODE = sys.argv[1] if len(sys.argv) > 1 else ""
PLATFORM = sys.argv[2] if len(sys.argv) > 2 else ""
if MODE not in {"session", "probe"} or PLATFORM not in {"android", "ios"}:
    raise SystemExit("Usage: comm-ci.py session|probe android|ios")

def call(path, payload=None, token=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        BASE + path, data=data, method="POST" if data else "GET",
        headers={**({"Content-Type":"application/json"} if data else {}),
                 **({"Authorization":"Bearer " + token} if token else {})}
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.status, json.load(response)

if MODE == "session":
    _, response = call("/comm-api/session", {"from":"N","to":"N"})
    token = response["calleeToken"]
    print("::add-mask::" + token, flush=True)
    print("::add-mask::" + response["calleeToken"], flush=True)
    with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as out:
        out.write("HITEL_CALL_TOKEN=" + token + "\n")
        out.write("HITEL_CALL_CALLER_TOKEN=" + response["callerToken"] + "\n")
        out.write("HITEL_CALL_ID=" + response["callId"] + "\n")
    print(f"Created native {PLATFORM} ephemeral Communication signaling session (token masked)")
else:
    token = os.environ["HITEL_CALL_TOKEN"]
    caller_token = os.environ["HITEL_CALL_CALLER_TOKEN"]
    call_id = os.environ["HITEL_CALL_ID"]
    for _ in range(35):
        _, state = call("/comm-api/session/" + call_id, token=token)
        if state["participants"]["callee"]["online"]:
            break
        time.sleep(1)
    else:
        raise SystemExit(f"FAIL: native {PLATFORM} Communication socket never came online")
    _, result = call("/comm-api/action", {"action":"call.invite"}, token=caller_token)
    assert result["state"] == "inviting", result
    target = result["event"]["sequence"]
    for _ in range(35):
        _, state = call("/comm-api/session/" + call_id, token=token)
        if state["participants"]["callee"]["lastAck"] >= target:
            break
        time.sleep(1)
    else:
        raise SystemExit(f"FAIL: native {PLATFORM} never ACKed actual other-participant invite {target}")
    assert state["participants"]["callee"]["online"] is True, state
    assert state["participants"]["caller"]["online"] is False, state
    print(f"PASS: Web caller -> native {PLATFORM} WebSocket invite -> native ACK to server; event={target}")
