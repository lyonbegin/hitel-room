#!/usr/bin/env python3
"""Exercise real Android APK UI on GitHub Actions x86_64 emulator.
Uses emulator-generated test M4A; DOES NOT claim user call-recording coverage.
No recognizer or Android application logic is reimplemented here.
"""
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from xml.etree import ElementTree as ET

OUT = Path("emulator-qa")
OUT.mkdir(exist_ok=True)
PKG = "app.hitel.sherpaoriginalcli"
NAME = "sherpa_emulator_ko.m4a"

def adb(*args, timeout=35, check=True):
    cmd = ["adb"] + list(args)
    p = subprocess.run(cmd, encoding="utf-8", stdout=subprocess.PIPE,
                       stderr=subprocess.STDOUT, timeout=timeout)
    if check and p.returncode:
        raise RuntimeError(f"{cmd}: rc={p.returncode}\n{p.stdout[-1500:]}")
    return p.stdout.strip()

def save_logs(label):
    (OUT / f"{label}-logcat.txt").write_text(adb("logcat", "-d", "-v", "threadtime", timeout=40, check=False), encoding="utf-8")
    adb("shell", "screencap", "-p", f"/sdcard/{label}.png", check=False)
    adb("pull", f"/sdcard/{label}.png", str(OUT / f"{label}.png"), timeout=30, check=False)
    adb("shell", "uiautomator", "dump", "/sdcard/window.xml", timeout=30, check=False)
    (OUT / f"{label}-ui.xml").write_text(adb("exec-out", "cat", "/sdcard/window.xml", check=False), encoding="utf-8")

def get_ui():
    adb("shell", "uiautomator", "dump", "/sdcard/window.xml", timeout=35)
    data = adb("exec-out", "cat", "/sdcard/window.xml", timeout=20)
    return ET.fromstring(data.strip())

def describe(root):
    return [(n.attrib.get("text",""), n.attrib.get("content-desc",""),n.attrib.get("resource-id",""))
            for n in root.iter("node") if n.attrib.get("text") or n.attrib.get("content-desc")]

def find(root, terms):
    if isinstance(terms,str): terms=[terms]
    for n in root.iter("node"):
        txt = n.attrib.get("text","")
        desc = n.attrib.get("content-desc","")
        if any(t.casefold() in txt.casefold() or t.casefold() in desc.casefold() for t in terms):
            bounds = n.attrib.get("bounds","")
            coords = list(map(int,re.findall(r"\d+",bounds)))
            if len(coords)!=4: continue
            return n,((coords[0]+coords[2])//2,(coords[1]+coords[3])//2)
    return None,None

def tap_term(terms, timeout=20):
    deadline=time.monotonic()+timeout
    latest=[]
    while time.monotonic()<deadline:
        root=get_ui();latest=describe(root)
        node,p=find(root,terms)
        if p is not None:
            print(f"CLICK {terms}: {node.attrib.get('text')} / {p}",flush=True)
            adb("shell","input","tap",str(p[0]),str(p[1]))
            time.sleep(1.2)
            return True
        time.sleep(1)
    print("NO_MATCH",terms," UI:",latest[:50],flush=True)
    return False

def test():
    print("EMULATOR MODEL", adb("shell","getprop","ro.product.cpu.abi"),flush=True)
    print("EMULATOR SDK", adb("shell","getprop","ro.build.version.sdk"),flush=True)
    print("PACKAGE",adb("shell","pm","path",PKG),flush=True)
    adb("logcat","-c")
    adb("shell","am","start","-n",PKG+"/.MainActivity",timeout=25)
    if not tap_term(["M4A / 음성 파일 선택"],35):
        raise RuntimeError("APK UI failed to show file picker button")
    save_logs("document-picker")
    # DocumentsUI usually starts on Recent. Prefer filename; otherwise switch to Downloads.
    root=get_ui()
    if find(root,[NAME])[1] is None:
        print("Picker texts",describe(root)[:45],flush=True)
        # Navigation drawer then Download, if necessary.
        if not tap_term(["Show roots","Show navigation drawer","탐색 메뉴","Navigate up"],7):
            adb("shell","input","tap","45","100",check=False)
            time.sleep(1)
        print("Drawer texts",describe(get_ui())[:40],flush=True)
        tap_term(["Downloads","Download","다운로드"],10)
    if not tap_term([NAME],20):
        # Search through picker if directory list did not show the file
        print("Picker after nav",describe(get_ui())[:55],flush=True)
        raise RuntimeError("M4A file not visible in Android DocumentsUI")
    save_logs("file-selected")
    if not tap_term(["원본 STT 실행"],30):
        raise RuntimeError("STT button not enabled/visible after selecting M4A")
    print("Waiting for actual original CLI to exit",flush=True)
    deadline=time.monotonic()+240
    logfile=""
    while time.monotonic()<deadline:
        logfile=adb("logcat","-d","-s","SherpaOriginalLauncher:I","*:S",timeout=25,check=False)
        if "Original CLI finished rc=" in logfile:
            print("FINISHED",logfile[-2800:],flush=True)
            break
        if any(k in logfile for k in ("Original CLI launcher failed","원본 실행 오류:")):
            print("APP ERROR",logfile[-2800:],flush=True)
            break
        if int(deadline-time.monotonic())%40<5:
            print("RUNNING:",logfile[-900:],flush=True)
        time.sleep(5)
    save_logs("after-stt")
    (OUT/"test-summary.txt").write_text(logfile,encoding="utf-8")
    m=re.search(r"Original CLI finished rc=(-?\d+),? recognizedChars=(\d+)",logfile)
    if m is None:
        raise RuntimeError("App did not report finished original CLI. See emulator-qa/after-stt-logcat.txt and screenshot")
    rc=int(m.group(1));chars=int(m.group(2))
    print(f"OBSERVED: original-cli-exit={rc}; recognizedChars={chars}",flush=True)
    if rc!=0:
        raise RuntimeError(f"Original executable returned exit={rc}, details in after-stt-logcat.txt")
    if chars==0:
        print("WARNING: synthetic Korean eSpeak fixture produced zero recognized characters; M4A decode/CLI completion proven but Korean recognition NOT proven.",flush=True)
    (OUT/"PASS.txt").write_text(f"Emulator ABI x86_64, APK installed, DocumentsUI file picker, original CLI exited {rc}, recognized characters {chars}; generated test audio {NAME} (NOT user M4A).\n",encoding="utf-8")

try:
    test()
except BaseException as e:
    print("E2E FAILURE:",repr(e),flush=True)
    save_logs("failure")
    raise
