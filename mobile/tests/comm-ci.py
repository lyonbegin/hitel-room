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
    # Now invoke the real app's communication.action handler over the existing
    # OIDC-paired lab socket and verify its native WebSocket changed SERVER state.
    controller = os.environ["HITEL_LAB_CONTROLLER"]
    _, queued = call("/lab-api/command", {
        "device": PLATFORM, "action": "communication.action",
        "data": {"callAction": "call.ringing", "payload": {}}
    }, token=controller)
    request_id = queued["requestId"]
    for _ in range(30):
        code, response = call("/lab-api/result/" + request_id, token=controller)
        if code == 200:
            assert response.get("ok") is True, response
            assert response.get("scope") == "native-signaling-pending-ack", response
            break
        time.sleep(0.25)
    else:
        raise SystemExit("FAIL: native Communication action command was not acknowledged")
    for _ in range(35):
        _, state = call("/comm-api/session/" + call_id, token=caller_token)
        if state["state"] == "ringing" and any(e["type"] == "call.ringing"
                  and e["from"] == "callee" for e in state["events"]):
            break
        time.sleep(0.25)
    else:
        raise SystemExit(f"FAIL: native {PLATFORM} did not emit call.ringing to real signaling server")
    print(f"PASS: native {PLATFORM} -> WebSocket -> signaling server -> web caller; state=ringing")
