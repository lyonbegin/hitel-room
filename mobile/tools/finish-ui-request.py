#!/usr/bin/env python3
"""Close a disposable Android session in Railway after the runner exits."""
import json
import os
from urllib.request import Request,urlopen
try:
    endpoint=os.environ.get("LAB_RELAY_URL","https://hitel-device-relay-production.up.railway.app").rstrip("/")
    url=os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    request=Request(url+("&" if "?" in url else "?")+"audience=hitel-device-lab",
                    headers={"Authorization":"Bearer "+os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    with urlopen(request,timeout=15) as res:
        identity=json.load(res)["value"]
    req=Request(endpoint+"/lab-api/apk/ci/finish",data=b"{}",method="POST",
        headers={"Authorization":"Bearer "+identity,"Content-Type":"application/json"})
    with urlopen(req,timeout=15) as res:
        assert json.load(res)["ok"] is True
    print("ANDROID_TEST_SESSION_CLOSED",flush=True)
except Exception as exc:
    print("ANDROID_TEST_CLOSE_WARNING",type(exc).__name__,str(exc)[:120],flush=True)
