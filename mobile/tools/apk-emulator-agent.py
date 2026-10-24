#!/usr/bin/env python3
"""HITEL APK installer on a REAL emulator host with ADB access.

  CI (GitHub OIDC):   python3 mobile/tools/apk-emulator-agent.py --once --device ci-android
  Persistent Linux:  LAB_APK_AGENT_TOKEN=... python3 ... --device android-lab-01

Railway only stores APKs and queues jobs; this host executes ADB on its own emulator.
No shell supplied by a remote request is executed. Only fixed ADB commands are used.
"""
import argparse
import glob
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BASE=os.environ.get("LAB_RELAY_URL","https://hitel-device-relay-production.up.railway.app").rstrip("/")

def credential():
    token=os.environ.get("LAB_APK_AGENT_TOKEN")
    if token:
        return token
    url=os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL")
    key=os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if url and key:
        req=Request(url+("&" if "?" in url else "?")+"audience=hitel-device-lab",
                    headers={"Authorization":"Bearer "+key})
        with urlopen(req,timeout=20) as res:
            return json.load(res)["value"]
    raise RuntimeError("LAB_APK_AGENT_TOKEN or approved GitHub Actions OIDC required")

def send(route,device,body=None,raw=False):
    payload=json.dumps(body).encode() if body is not None else None
    req=Request(BASE+route,data=payload,method="POST" if body is not None else "GET",
                headers={"authorization":"Bearer "+credential(),"x-emulator-device":device,
                         "content-type":"application/json"})
    with urlopen(req,timeout=90 if raw else 30) as res:
        return res.read() if raw else json.load(res)

def adb(serial,*arguments,timeout=120):
    return subprocess.run(["adb","-s",serial,*arguments],
        stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
        text=True,timeout=timeout,check=False)

def capture_frame(device,serial):
    # Full OS framebuffer (not the HITEL WebView PixelCopy).
    result=subprocess.run(["adb","-s",serial,"exec-out","screencap","-p"],
        stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=25,check=False)
    png=result.stdout
    if result.returncode or len(png)<100 or len(png)>3*1024*1024 or png[:8]!=bytes.fromhex("89504e470d0a1a0a"):
        return False
    request=Request(BASE+"/lab-api/apk/agent/frame",data=png,method="POST",
        headers={"authorization":"Bearer "+credential(),"x-emulator-device":device,
                 "content-type":"image/png"})
    with urlopen(request,timeout=30) as response:
        info=json.load(response)
    return info.get("ok") is True

def run_control(serial,job):
    action=job.get("action")
    args=job.get("args") or {}
    if action=="tap":
        x,y=int(args["x"]),int(args["y"])
        if not (0<=x<=8000 and 0<=y<=8000):raise RuntimeError("INVALID_TOUCH")
        result=adb(serial,"shell","input","tap",str(x),str(y),timeout=15)
    elif action=="back":
        result=adb(serial,"shell","input","keyevent","4",timeout=15)
    elif action=="home":
        result=adb(serial,"shell","input","keyevent","3",timeout=15)
    elif action=="scroll":
        width,height=int(args["width"]),int(args["height"])
        direction=args.get("direction","down")
        x=width//2
        start_y,end_y=(height*3//4,height//4) if direction=="down" else (height//4,height*3//4)
        result=adb(serial,"shell","input","swipe",str(x),str(start_y),
                   str(x),str(end_y),"400",timeout=15)
    else:
        raise RuntimeError("UNSUPPORTED_EMULATOR_CONTROL")
    if result.returncode:raise RuntimeError("ADB_CONTROL_FAILED: "+result.stdout[-250:])
    print("EMULATOR_CONTROL_EXECUTED",action,job["id"],flush=True)
    return "",action+" completed"

def apk_package(apk_path):
    # Read only manifest metadata with Android SDK tools; do not trust uploaded filename.
    candidates=glob.glob(os.environ.get("ANDROID_HOME","/opt/android-sdk")+"/build-tools/*/aapt")
    for tool in sorted(candidates,reverse=True):
        proc=subprocess.run([tool,"dump","badging",str(apk_path)],
          text=True,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=20,check=False)
        if proc.returncode==0:
            match=re.search(r"^package: name='([^']+)'",proc.stdout,re.M)
            if match:return match.group(1)
    return None

def play_store_job(serial,job):
    package=job.get("packageName","")
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+",package):
        raise RuntimeError("INVALID_PACKAGE_NAME")
    if job.get("operation")=="verify":
        result=adb(serial,"shell","pm","path",package,timeout=20)
        if result.returncode or "package:" not in result.stdout:
            raise RuntimeError("PACKAGE_NOT_INSTALLED")
        print("ANDROID_PACKAGE_VERIFIED",package,flush=True)
        return package,"Verified Android package manager installation"
    vending=adb(serial,"shell","pm","path","com.android.vending",timeout=20)
    if vending.returncode or "package:" not in vending.stdout:
        raise RuntimeError("GOOGLE_PLAY_NOT_INSTALLED")
    opened=adb(serial,"shell","am","start","-a","android.intent.action.VIEW",
        "-d","market://details?id="+package,"-p","com.android.vending",timeout=25)
    if opened.returncode or "Error:" in opened.stdout:
        raise RuntimeError("PLAY_STORE_LAUNCH_FAILED: "+opened.stdout[-300:])
    print("GOOGLE_PLAY_LISTING_OPENED",package,flush=True)
    return package,"Play Store listing opened; the user must approve installation"

def run_job(device,serial,job):
    file_data=send("/lab-api/apk/agent/file/"+job["id"],device,raw=True)
    digest=hashlib.sha256(file_data).hexdigest()
    if digest!=job["sha256"] or len(file_data)!=job["size"]:
        raise RuntimeError("APK_SHA256_MISMATCH")
    with tempfile.TemporaryDirectory(prefix="hitel-apk-") as temp:
        apk=Path(temp)/"upload.apk"
        apk.write_bytes(file_data)
        package=apk_package(apk)
        if not package:raise RuntimeError("APK_MANIFEST_MISSING_OR_INVALID")
        proc=adb(serial,"install","-r",str(apk),timeout=240)
        if proc.returncode:
            raise RuntimeError("ADB_INSTALL_ERROR: "+proc.stdout[-450:])
        verified=adb(serial,"shell","pm","path",package,timeout=25)
        if verified.returncode or "package:" not in verified.stdout:
            raise RuntimeError("APK_INSTALL_UNVERIFIED")
        print("APK_INSTALLED",device,package,job["id"],flush=True)
        if job.get("launchAfterInstall"):
            launch=adb(serial,"shell","monkey","-p",package,"-c",
                       "android.intent.category.LAUNCHER","1",timeout=35)
            if launch.returncode or "Events injected: 1" not in launch.stdout:
                raise RuntimeError("APK_INSTALLED_BUT_LAUNCH_FAILED: "+launch.stdout[-250:])
            print("APK_LAUNCHED",device,package,flush=True)
        return package,proc.stdout[-1500:]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--device",default=os.environ.get("HITEL_EMULATOR_DEVICE","ci-android"))
    parser.add_argument("--serial",default=os.environ.get("ANDROID_SERIAL","emulator-5554"))
    parser.add_argument("--once",action="store_true")
    parser.add_argument("--interval",type=float,default=6)
    args=parser.parse_args()
    while True:
        try:
            ready=adb(args.serial,"get-state",timeout=10)
            if ready.returncode or "device" not in ready.stdout:
                raise RuntimeError("ADB_DEVICE_NOT_ONLINE: "+ready.stdout[-200:])
            if not args.once:
                try:capture_frame(args.device,args.serial)
                except Exception as frame_exc:
                    print("EMULATOR_FRAME_ERROR",str(frame_exc)[:150],file=sys.stderr,flush=True)
            answer=send("/lab-api/apk/agent/next",args.device,{})
            job=answer.get("job")
            if job:
                success=False;error=None;log="";package=None
                try:
                    if job.get("operation")=="control":
                        package,log=run_control(args.serial,job)
                    elif job.get("operation") in ("store","verify"):
                        package,log=play_store_job(args.serial,job)
                    else:
                        package,log=run_job(args.device,args.serial,job)
                    success=True
                except Exception as exc:
                    error=str(exc)[:300]
                    print("APK_INSTALL_FAILED",job["id"],error,file=sys.stderr,flush=True)
                report=send("/lab-api/apk/agent/report",args.device,{
                    "jobId":job["id"],"leaseId":job["leaseId"],"success":success,
                    "packageName":package,"installLog":log,"error":error})
                print("APK_JOB_REPORTED",report.get("jobId"),report.get("status"),flush=True)
                try:
                    if capture_frame(args.device,args.serial):
                        print("EMULATOR_FULL_SCREEN_CAPTURED",args.device,flush=True)
                except Exception as exc:
                    print("EMULATOR_FRAME_ERROR",str(exc)[:150],file=sys.stderr,flush=True)
                if not success and args.once:sys.exit(2)
            elif args.once:
                print("APK_INSTALL_QUEUE_EMPTY",args.device,flush=True)
        except (HTTPError,Exception) as exc:
            print("APK_AGENT_POLL_ERROR",str(exc)[:220],file=sys.stderr,flush=True)
            if args.once:sys.exit(1)
        if args.once:break
        time.sleep(max(2,args.interval))

if __name__=="__main__": main()
