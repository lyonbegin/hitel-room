#!/usr/bin/env python3
"""Seed ONE disposable Android emulator APK test job with the APK built in CI.
Signed Github Actions OIDC is checked by Railway. Browser user uploads use
separate admin credentials and the identical binary storage/install queue.
"""
import json
import os
from pathlib import Path
import urllib.request

BASE=os.environ.get("LAB_RELAY_URL","https://hitel-device-relay-production.up.railway.app").rstrip("/")
apk=Path("mobile/android/app/build/outputs/apk/debug/app-debug.apk")
assert apk.exists() and apk.stat().st_size>1000, "Missing actual compiled APK"
origin=os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
req=urllib.request.Request(origin+("&" if "?" in origin else "?")+"audience=hitel-device-lab",
    headers={"Authorization":"Bearer "+os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
with urllib.request.urlopen(req,timeout=20) as res:
    token=json.load(res)["value"]
request=urllib.request.Request(BASE+"/lab-api/apk/ci/seed",
    data=apk.read_bytes(),method="POST",
    headers={"authorization":"Bearer "+token,
      "content-type":"application/vnd.android.package-archive"})
with urllib.request.urlopen(request,timeout=120) as res:
    result=json.load(res)
assert result["ok"] is True, result
if result.get("seeded"):
    print("APK_QUEUE_CI_SEEDED",result["jobId"])
else:
    print("APK_QUEUE_EXISTING_USER_JOB",result.get("reason"))
