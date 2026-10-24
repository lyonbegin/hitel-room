#!/usr/bin/env python3
"""Provision an expiring test call and verify an emulator's native call socket.
The token is scoped to one new ephemeral call; no permanent account credentials."""
import json
import os
import sys
import time
import urllib.request
import urllib.error

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
    # Invoke each state transition through the real native app, not HTTP acting
    # as the callee. The lab socket is only an authenticated test input channel.
    controller = os.environ["HITEL_LAB_CONTROLLER"]
    def native_action(action):
        # The management socket can reconnect independently from the real
        # communication socket (e.g. after hosted runner proxy reconnect).
        for attempt in range(16):
            try:
                _, queued = call("/lab-api/command", {
                    "device": PLATFORM, "action": "communication.action",
                    "data": {"callAction": action, "payload": {}}
                }, token=controller)
                break
            except urllib.error.HTTPError as exc:
                reason = exc.read(400).decode("utf-8", errors="replace")
                if exc.code != 409:
                    raise RuntimeError(f"Native action {action}: HTTP {exc.code}: {reason}") from exc
                if attempt == 15:
                    raise RuntimeError(f"Native management socket still offline: {reason}") from exc
                time.sleep(2)
        request_id = queued["requestId"]
        for _ in range(35):
            code, response = call("/lab-api/result/" + request_id, token=controller)
            if code == 200:
                assert response.get("ok") is True, response
                assert response.get("scope") == "native-signaling-pending-ack", response
                break
            time.sleep(0.25)
        else:
            raise SystemExit(f"FAIL: native {PLATFORM} did not queue {action}")
    def expect_state(expected, event):
        for _ in range(35):
            _, state = call("/comm-api/session/" + call_id, token=caller_token)
            if state["state"] == expected and any(
                e["type"] == event and e["from"] == "callee" for e in state["events"]
            ):
                return
            time.sleep(0.25)
        raise SystemExit(f"FAIL: native {PLATFORM} did not deliver {event} / {expected}")
    native_action("call.ringing")
    expect_state("ringing", "call.ringing")
    native_action("call.accept")
    expect_state("accepted", "call.accept")
    native_action("call.end")
    expect_state("ended", "call.end")
    print(f"PASS: native {PLATFORM} -> WebSocket -> caller: ringing -> accepted -> ended")
