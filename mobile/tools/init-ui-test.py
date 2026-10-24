#!/usr/bin/env python3
"""Make a disposable Android UI-control session available to the first open
Communication SDK lab browser tab. Signed GitHub OIDC authenticates the runner.
No token is printed in the public workflow logs or pasted by the operator.
"""
import json
import os
from urllib.request import Request,urlopen

base=os.environ.get("LAB_RELAY_URL","https://hitel-device-relay-production.up.railway.app").rstrip("/")
oidc_url=os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
joiner="&" if "?" in oidc_url else "?"
oidc_request=Request(oidc_url+joiner+"audience=hitel-device-lab",headers={
    "Authorization":"Bearer "+os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
with urlopen(oidc_request,timeout=20) as response:
    id_token=json.load(response)["value"]
api_request=Request(base+"/lab-api/apk/ci/ui-session",method="POST",data=b"{}",headers={
    "Authorization":"Bearer "+id_token,"Content-Type":"application/json"})
with urlopen(api_request,timeout=30) as response:
    result=json.load(response)
assert result.get("ok") and result.get("deviceId")=="ci-playstore",result
print("PASS: disposable Android UI test authorized; open SDK lab auto-connects without token entry",flush=True)
