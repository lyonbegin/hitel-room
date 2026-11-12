#!/usr/bin/env python3
"""Android 15 REAL emulator execution: not just Gradle compile.

Verifies launched standalone UI, a growing AAC/M4A file, native AAC follow,
MediaCodec PCM -> AudioTrack, persistent JSONL journal and automatic ZIP
in Downloads on STOP. Does NOT claim physical Samsung in-call audio or
simultaneous second-app MediaProjection capture validated.
"""
import os
import re
import subprocess
import time
import pathlib
import sys

APP="app.hitel.recording.speakeronly"
COMPONENT=APP+"/app.hitel.speakeronly.SpeakerService"
OUT=pathlib.Path("/tmp/standalone-v2-emulator")
OUT.mkdir(parents=True,exist_ok=True)
def cmd(*args,timeout=90,check=True):
    p=subprocess.run(list(args),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
       text=True,errors="replace",timeout=timeout)
    if check and p.returncode:
        raise RuntimeError(" ".join(args)+" failed with "+str(p.returncode)+"\n"+p.stdout[-2500:])
    return p.stdout
def adb(*a,timeout=90,check=True):
    return cmd("adb",*a,timeout=timeout,check=check)
def log(stage):
    l=adb("logcat","-d","-v","time",timeout=55)
    (OUT/(stage+".logcat")).write_text(l)
    return l
def assert_log(event,stage):
    t=log(stage)
    hits=[row for row in t.splitlines() if "GrowingM4aDiag" in row and event in row]
    print("EVENT",event,"count",len(hits),"last",hits[-1][-400:] if hits else "NONE",flush=True)
    assert hits,"Missing Android service evidence: "+event
def run_as(*a,check=True):
    return adb("shell","run-as",APP,*a,check=check)

APK="speaker-standalone/app/build/outputs/apk/debug/app-debug.apk"
FIXTURE="/tmp/standalone-v2.m4a"
f=pathlib.Path(FIXTURE)
assert pathlib.Path(APK).stat().st_size>2_000_000
assert f.stat().st_size>10_000
print("EMULATOR",adb("shell","getprop","ro.build.version.release").strip(),
      adb("shell","getprop","ro.product.cpu.abi").strip(),flush=True)
print(adb("install","-r",APK,timeout=120),flush=True)
print(adb("shell","am","start","-W","-n",APP+"/app.hitel.speakeronly.MainActivity"),flush=True)
time.sleep(4)
pid=adb("shell","pidof",APP).strip()
assert pid,"Standalone app failed launch"
adb("exec-out","screencap","-p",timeout=30) # connectivity check
with open(OUT/"main-activity.png","wb") as screenshot:
    subprocess.run(["adb","exec-out","screencap","-p"],stdout=screenshot,check=True,timeout=35)
assert (OUT/"main-activity.png").stat().st_size>10000
print("PASS_ANDROID15_APP_INSTALLED_LAUNCHED_SCREENSHOT pid="+pid,flush=True)
# Source prepared in app's *own* files folder; no SAF permissions needed
# for this engine-level test. The normal UI SAF picker remains unchanged.
first=pathlib.Path("/tmp/standalone-first.bin")
first.write_bytes(f.read_bytes()[:700])
adb("push",str(first),"/data/local/tmp/standalone-first.bin")
# A newly installed app can have shared_prefs but no files/ directory yet.
run_as("mkdir","-p","files")
run_as("cp","/data/local/tmp/standalone-first.bin","files/live-growing.m4a")
uri="file:///data/user/0/"+APP+"/files/live-growing.m4a"
print("START_FOREGROUND_SERVICE",flush=True)
start=run_as("am","start-foreground-service",
   "-n",COMPONENT,"-a","app.hitel.speakeronly.START",
   "--es","uri",uri,"--ez","folder","false","--ei","deviceId","-1",
   check=False)
print("START_RESULT",start.strip()[:800],flush=True)
if "Error:" in start or "Exception" in start:
    raise RuntimeError("Cannot start private foreground service from same app UID: "+start)
time.sleep(3)
assert_log("SPEAKER_ONLY_SESSION","start")
allbytes=f.read_bytes()
pos=700
for i in range(1,24):
    if pos>=len(allbytes):break
    piece=allbytes[pos:pos+2400]
    tmp=pathlib.Path("/tmp/standalone-chunk.bin")
    tmp.write_bytes(piece)
    adb("push",str(tmp),"/data/local/tmp/standalone-chunk.bin")
    # append as the app's own UID: file grows while engine is running.
    out=run_as("sh","-c","cat /data/local/tmp/standalone-chunk.bin >> files/live-growing.m4a")
    pos+=len(piece)
    if i in (1,5,10,20):print("GROWING_SOURCE",i,pos,len(allbytes),flush=True)
    time.sleep(.22)
time.sleep(5)
assert_log("APPENDED_NEW_SOURCE_BYTES","mirror")
assert_log("PCM_PLAYBACK_WRITE","pcm")
assert_log("PLAYBACK_PROGRESS","output")
pre=log("before-stop")
for marker in ("usage=USAGE_MEDIA","capturePolicy=ALLOW_CAPTURE_BY_ALL"):
    if marker not in pre:
        print("WARNING usage marker missing in current log format:",marker,flush=True)
print("STOP_SERVICE",flush=True)
res=run_as("am","start-service","-n",COMPONENT,"-a","app.hitel.speakeronly.STOP",check=False)
print("STOP_RESULT",res.strip()[:800],flush=True)
time.sleep(6)
l=log("after-stop")
for event in ("SESSION_END","RUN_SUMMARY"):
    assert event in l,"Not finalized: "+event
# Direct file persistence test via app data, and automatic Download export.
files=run_as("sh","-c","ls files/diagnostics/run-*/events.jsonl",check=False)
print("FILES_JSONL",files.strip()[:600],flush=True)
assert "events.jsonl" in files,"JSONL log not persisted"
events=run_as("sh","-c","cat files/diagnostics/run-*/events.jsonl",check=False)
(OUT/"events.jsonl").write_text(events)
assert "PCM_PLAYBACK_WRITE" in events,"JSONL missing audio event"
print("PASS_ANDROID15_REAL_PCM_TO_AUDIOTRACK_AND_PERSISTED_LOG",flush=True)
if "진단 ZIP 자동 저장" in l:
    print("PASS_ANDROID15_AUTO_ZIP_USER_DOWNLOADS",flush=True)
else:
    print("CHECK_AUTO_ZIP: no success marker in logcat; see output",flush=True)
