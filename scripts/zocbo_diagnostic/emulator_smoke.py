#!/usr/bin/env python3
"""ADB-only real emulator interaction and screenshot/UI/logcat capture.
No service login is assumed and no success is faked from CI build artifacts."""
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT=Path("work/emulator-evidence")
OUT.mkdir(parents=True,exist_ok=True)
PKG="com.eduzone.eduzoneviewer"
def adb(*args,check=False,timeout=50):
    r=subprocess.run(["adb",*map(str,args)],text=True,capture_output=True,timeout=timeout)
    if check and r.returncode:raise RuntimeError(f"adb {args}: {r.stderr}")
    return r.stdout.strip()
def capture(name):
    try:
        with (OUT/(name+".png")).open("wb") as f:
            subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,stderr=subprocess.PIPE,check=True,timeout=20)
    except Exception as e:print("SCREENSHOT_ERROR",name,str(e),flush=True)
    try:
        adb("shell","uiautomator","dump","/sdcard/window.xml",timeout=25)
        xml=adb("shell","cat","/sdcard/window.xml",timeout=20)
        (OUT/(name+".xml")).write_text(xml,encoding="utf-8")
        strings=sorted(set(x for x in re.findall(r'(?:text|content-desc)="([^"]+)"',xml) if x))
        print("UI_ELEMENTS",name,strings[:90],flush=True)
        return xml
    except Exception as e:
        print("UI_XML_ERROR",name,str(e),flush=True);return ""
def node_bounds(xml,substring):
    try:
        root=ET.fromstring(xml)
        for n in root.iter():
            if substring in (n.attrib.get("text","")+" "+n.attrib.get("content-desc","")):
                m=re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",n.attrib.get("bounds",""))
                if m:
                    a=list(map(int,m.groups()))
                    if a[2]>a[0] and a[3]>a[1]:return ((a[0]+a[2])//2,(a[1]+a[3])//2)
    except Exception as e:print("BOUNDS_XML_ERROR",str(e),flush=True)
    return None
def click(xml,text):
    b=node_bounds(xml,text)
    if b:
        adb("shell","input","tap",*b)
        print("UI_TAP",text,b,flush=True)
        return True
    return False

print("EMULATOR_DEVICE",adb("devices","-l"),flush=True)
adb("shell","settings","put","system","screen_off_timeout","1800000")
adb("shell","settings","put","global","window_animation_scale","0")
adb("shell","settings","put","global","transition_animation_scale","0")
adb("shell","settings","put","global","animator_duration_scale","0")
adb("logcat","-c")
adb("install","-r","work/r10.apk",check=True,timeout=100)
print("INSTALLED",adb("shell","dumpsys","package",PKG)[:1000],flush=True)
adb("shell","am","start","-n",PKG+"/com.eduzone.eduzoneviewer.ui.activities.MainActivity",timeout=20)
time.sleep(12)
xml=capture("01_app_start")
success=False
for attempt in range(8):
    if click(xml,"수집"):
        time.sleep(6)
        xml=capture("02_collector")
        success=True
        break
    # Top diagnostic panel can overflow horizontally
    adb("shell","input","swipe","405","130","75","130","450")
    time.sleep(2)
    xml=capture("01_toolbar_attempt_"+str(attempt))
if not success:
    print("SMOKE_RESULT FAIL collector button not found on emulator",flush=True)
else:
    clicked=click(xml,"전국 지역")
    if not clicked:clicked=click(xml,"자동수집")
    if not clicked:
        print("SMOKE_RESULT FAIL nationwide automatic collection button unavailable",flush=True)
    else:
        print("SMOKE_NATIONWIDE_CLICKED",flush=True)
        for i in range(6):
            time.sleep(6)
            xml=capture(f"03_collect_{i}")
            print("SMOKE_PROGRESS",i,"DOM",bool(xml),"error?",("찾지 못했습니다" in xml),"db_count",re.findall(r"(?:DB:|DB：)[^<]{0,25}",xml)[:1],flush=True)
        print("SMOKE_RESULT ACTION_TAPPED (inspect screenshots/logcat for real network and database proof)",flush=True)
log=adb("logcat","-d","-v","time",timeout=70)
(OUT/"logcat.txt").write_text(log,encoding="utf-8")
for line in log.splitlines():
    if any(x in line for x in ("COLLECTOR_","FATAL EXCEPTION","AndroidRuntime","chromium:")):
        print("EMULATOR_LOG",line[:450],flush=True)
