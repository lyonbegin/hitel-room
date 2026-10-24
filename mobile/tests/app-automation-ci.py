#!/usr/bin/env python3
"""Run real Android native accessibility automation against the installed
Android Settings app using the paired device-lab WebSocket. Never places orders.
An official Kakao T APK can be installed separately in the same emulator."""
import json
import os
from pathlib import Path
import time
import urllib.request
import urllib.error

BASE=os.environ.get("LAB_RELAY_URL","https://hitel-device-relay-production.up.railway.app").rstrip("/")
TOKEN=os.environ["HITEL_LAB_CONTROLLER"]
HEADERS={"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"}

def http(path,payload=None):
    request=urllib.request.Request(BASE+path,headers=HEADERS,
        data=json.dumps(payload).encode() if payload is not None else None,
        method="POST" if payload is not None else "GET")
    with urllib.request.urlopen(request,timeout=20) as response:
        return response.status,json.load(response)

def command(action,data=None):
    for attempt in range(20):
        try:
            _,queued=http("/lab-api/command",{
                "device":"android","action":action,"data":data or {}})
            break
        except urllib.error.HTTPError as exc:
            if exc.code!=409 or attempt==19: raise
            time.sleep(1)
    ident=queued["requestId"]
    for i in range(60):
        status,reply=http("/lab-api/result/"+ident)
        if status==200:
            if not reply.get("ok"):
                raise AssertionError(action+" failed: "+str(reply.get("error","unknown error")))
            return reply.get("result",{})
        time.sleep(0.2)
    raise TimeoutError(action+" native result timeout")

def inspect():
    for attempt in range(18):
        try: return command("app.screen")
        except AssertionError as e:
            if "NO_ACTIVE_WINDOW" not in str(e) and "ACTIVE_APP_MISMATCH" not in str(e):
                raise
            time.sleep(0.5)
    raise AssertionError("Android Settings inaccessible")

status={}
for _ in range(20):
    status=command("app.accessibility.status")
    if status.get("enabled") is True: break
    time.sleep(0.5)
assert status.get("enabled") is True, ("AccessibilityService did not bind",status)
available=command("app.list")
assert isinstance(available.get("apps"),list),available
opened=command("app.open",{"packageName":"com.android.settings"})
assert opened["launched"] is True,opened
time.sleep(1.5)
screen=inspect()
assert screen["packageName"]=="com.android.settings",screen
assert screen["count"]>0,screen
print("PASS: actual native Android app.launch -> system Settings -> accessibility tree read")
# Tap a harmless interactive entry when a stable label is available.
labels={n.get("text") for n in screen.get("nodes",[]) if n.get("text")}
safe=next((v for v in ("Network & internet","Connected devices","Apps","네트워크 및 인터넷","앱")
           if v in labels),None)
if safe:
    clicked=command("app.tap",{"text":safe})
    assert clicked["clicked"] is True,clicked
    print("PASS: Accessibility ACTION_CLICK on real Android Settings label:",safe)
    time.sleep(0.7)
    command("app.back")
else:
    print("NOTE: emulator Settings labels differ; screen-reading verified")
# Never claim KakaoT is installed unless pm/app lookup confirms it.
out=Path("mobile-test-results/android")
out.mkdir(parents=True,exist_ok=True)
(out/"third-party-automation.json").write_text(json.dumps({
    "accessibilityEnabled":True,"installedApps":available.get("count"),
    "settingsLaunched":True,"visibleNodes":screen["count"],
    "safeTapTest":safe,"kakaoTInstalled":any(
        a.get("packageName")=="com.kakao.taxi" for a in available.get("apps",[]))
},ensure_ascii=False,indent=2),encoding="utf-8")
print("PASS: Native Accessibility automation E2E complete; KakaoT installation reported separately")
