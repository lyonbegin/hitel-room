#!/usr/bin/env python3
"""Signed GitHub Actions registration of the REAL original Android host URL.
No user-entered token or modification of Android Emulator Platform source.
"""
import json,os,sys
from urllib.request import Request,urlopen

ROOT=os.environ.get("LAB_RELAY_URL","https://hitel-device-relay-production.up.railway.app").rstrip("/")

def token():
    url=os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    token=os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
    glue="&" if "?" in url else "?"
    req=Request(url+glue+"audience=hitel-device-lab",
                headers={"Authorization":"Bearer "+token})
    with urlopen(req,timeout=20) as response:return json.load(response)["value"]

def call(endpoint,data=None):
    payload=json.dumps(data).encode() if data is not None else None
    request=Request(ROOT+endpoint,data=payload,method="POST" if payload is not None else "GET",
                    headers={"Authorization":"Bearer "+token(),"Content-Type":"application/json"})
    with urlopen(request,timeout=25) as res:return json.load(res)

def main():
    action=sys.argv[1] if len(sys.argv)>1 else ""
    if action=="register" and len(sys.argv)==3:
        result=call("/lab-api/android-native/ci/register",{"url":sys.argv[2]})
        assert result["ok"] and result["status"]=="online",result
        print("ORIGINAL_ANDROID_NATIVE_URL_REGISTERED",sys.argv[2],flush=True)
    elif action=="finish":
        result=call("/lab-api/android-native/ci/finish",{})
        assert result["ok"],result
        print("ORIGINAL_ANDROID_NATIVE_HOST_CLEARED",flush=True)
    elif action=="stop-requested":
        result=call("/lab-api/android-native/ci/stop-requested")
        print("stop" if result.get("stop") else "continue")
    else:
        raise SystemExit("usage: original-native-url.py register URL | finish | stop-requested")

if __name__=="__main__":main()
