#!/usr/bin/env python3
"""Use GitHub Actions OIDC (no GitHub secret) to authenticate simulator sessions and publish
verified screenshots/logs to the dedicated HITEL device relay. Standalone stdlib script."""
import base64
import json
import os
from pathlib import Path
import sys
import urllib.request

BASE = os.getenv("LAB_RELAY_URL", "https://hitel-device-relay-production.up.railway.app").rstrip("/")
PLATFORM = sys.argv[2] if len(sys.argv) > 2 else ""
if PLATFORM not in {"android", "ios"}:
    raise SystemExit("Usage: lab-ci.py [session|upload] [android|ios]")


def oidc_token():
    url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    url += ("&" if "?" in url else "?") + "audience=hitel-device-lab"
    request = urllib.request.Request(
        url, headers={"Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]}
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)["value"]


def post(target, body):
    token = oidc_token()
    data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        BASE + target, data=data,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.load(response)


if sys.argv[1] == "session":
    result = post("/lab-api/ci/session", {"side": PLATFORM})
    ticket = result["ticket"]
    with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as output:
        output.write("HITEL_LAB_TICKET=" + ticket + "\n")
    print(f"Native {PLATFORM} short-lived WebSocket pairing created (token hidden)")
elif sys.argv[1] == "upload":
    root = Path("mobile-test-results") / PLATFORM
    screenshot = root / "screen.png"
    event_path = root / "events.log"
    if not screenshot.is_file():
        print(f"No actual {PLATFORM} simulator screenshot; report not published")
        sys.exit(0)
    log = event_path.read_text(errors="replace") if event_path.is_file() else "No native event log"
    origin = "hitel-communication-web-production.up.railway.app/sdk-lab/device"
    passed = all(token in log for token in [
        "APP_STARTED", "WEB_LOADED", "BRIDGE_PING_OK", "CAPABILITIES_OK", origin
    ]) and not any(token in log for token in ["WEB_ERROR", "HTTP_ERROR"])
    result = post("/lab-api/ci/upload", {
        "side": PLATFORM,
        "runId": os.getenv("GITHUB_RUN_ID", ""),
        "sha": os.getenv("GITHUB_SHA", ""),
        "passed": passed, "log": log[-12000:],
        "png": base64.b64encode(screenshot.read_bytes()).decode("ascii")
    })
    print(f"Real {PLATFORM} emulator capture uploaded: run={result['runId']}, passed={passed}")
else:
    raise SystemExit("Unknown lab-ci command")
