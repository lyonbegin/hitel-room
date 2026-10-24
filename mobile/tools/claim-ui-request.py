#!/usr/bin/env python3
"""Claim a browser-requested Android run using signed GitHub Actions OIDC.
No operator token or GitHub UI interaction required.
"""
import json
import os
from urllib.request import Request,urlopen

BASE=os.environ.get("LAB_RELAY_URL","https://hitel-device-relay-production.up.railway.app").rstrip("/")

def oidc():
    url=os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    glue="&" if "?" in url else "?"
    req=Request(url+glue+"audience=hitel-device-lab",
        headers={"Authorization":"Bearer "+os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    with urlopen(req,timeout=25) as res:
        return json.load(res)["value"]

def request(path):
    req=Request(BASE+path,method="POST",data=b"{}",
        headers={"Authorization":"Bearer "+oidc(),"Content-Type":"application/json"})
    with urlopen(req,timeout=30) as res:
        return json.load(res)

def main():
    value=request("/lab-api/apk/ci/claim-start")
    claimed=value.get("claim") is True
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"],"a",encoding="utf8") as f:
            f.write("claimed="+str(claimed).lower()+"\n")
    print("ANDROID_TEST_REQUEST_CLAIMED" if claimed else "NO_ANDROID_TEST_REQUEST")
    if claimed:print("ANDROID_TEST_REQUEST_ID",value.get("requestId"))
if __name__=="__main__":main()
