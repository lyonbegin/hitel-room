#!/usr/bin/env python3
"""Publish sanitized Samsung RTL stage markers for CURRENT GitHub Actions run.

One fixed, non-personal stage code per GitHub commit status. No screenshots,
DOM, cookies, Samsung credentials, RDB transport details, or ADB identifiers.
"""
import json
import os
import re
import time
import urllib.request
from pathlib import Path

STAGE=Path(os.environ["RTL_BROWSER_STAGE_FILE"])
TOKEN=os.environ["GITHUB_TOKEN"]
REPO=os.environ["GITHUB_REPOSITORY"]
SHA=os.environ["GITHUB_SHA"]
URL=f"https://api.github.com/repos/{REPO}/statuses/{SHA}"
VALID=re.compile(r"^[A-Z0-9_]{4,64}$")

def publish(stage):
    if not VALID.fullmatch(stage):
        return
    description=f"Samsung RTL Linux RDB stage: {stage}"
    payload=json.dumps({
        "state":"pending","context":"rtl/phase","description":description[:140],
        "target_url":os.environ.get("GITHUB_SERVER_URL","https://github.com")
          +"/"+REPO+"/actions/runs/"+os.environ["GITHUB_RUN_ID"]
    }).encode()
    req=urllib.request.Request(URL,data=payload,method="POST",
        headers={"Authorization":"Bearer "+TOKEN,
          "Accept":"application/vnd.github+json",
          "X-GitHub-Api-Version":"2022-11-28",
          "Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=20) as resp:
        resp.read(200)
    print("RTL_GITHUB_STATUS_"+stage,flush=True)

def main():
    prev=None
    deadline=time.monotonic()+115*60
    while time.monotonic()<deadline:
        try:
            stage=STAGE.read_text().strip() if STAGE.exists() else ""
            if stage and stage!=prev and VALID.fullmatch(stage):
                publish(stage)
                prev=stage
        except (OSError,TimeoutError,Exception) as err:
            print("RTL_STATUS_TRANSIENT_ERROR="+type(err).__name__,flush=True)
        time.sleep(8)

if __name__=="__main__":
    main()
