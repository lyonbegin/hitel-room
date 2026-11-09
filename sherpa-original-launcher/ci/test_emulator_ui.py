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
PKG = "app.hitel.sherpaoriginalnormalized31"
ACTIVITY = PKG + "/app.hitel.sherpaoriginalcli.MainActivity"
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
    nodes=list(root.iter("node"))
    # DocumentsUI renders a preview icon before the real file title.
    # Exact text match avoids accidentally opening a preview instead of selecting.
    for mode in ("exact_text","contains_text","content_desc"):
        for n in nodes:
            txt=n.attrib.get("text","")
            desc=n.attrib.get("content-desc","")
            if mode=="exact_text":
                matched=any(t.casefold()==txt.casefold() for t in terms)
            elif mode=="contains_text":
                matched=any(t.casefold() in txt.casefold() for t in terms if txt)
            else:
                matched=any(t.casefold() in desc.casefold() for t in terms if desc)
            if not matched: continue
            bounds=n.attrib.get("bounds","")
            coords=list(map(int,re.findall(r"\d+",bounds)))
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
    adb("shell","am","start","-n",ACTIVITY,timeout=25)
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
    # Android 11 DocumentsUI's grid file card may not open when text is clicked.
    # Switch to the actual list view, where the whole document row is selectable.
    root=get_ui()
    if find(root,["List view"])[1] is not None:
        tap_term(["List view"],10)
        print("Switched picker to list view",describe(get_ui())[:28],flush=True)
    if not tap_term([NAME],20):
        print("Picker after nav",describe(get_ui())[:55],flush=True)
        raise RuntimeError("M4A file not visible in Android DocumentsUI")
    time.sleep(1.5)
    root=get_ui()
    if find(root,["원본 STT 실행"])[1] is None:
        print("First picker click did not return to app; retrying file row",describe(root)[:40],flush=True)
        if find(root,[NAME])[1] is not None:
            tap_term([NAME],8)
            time.sleep(1.5)
        else:
            adb("shell","input","keyevent","66",check=False)
            time.sleep(1)
    picked_in_documents_ui = find(get_ui(),["원본 STT 실행"])[1] is not None
    if not picked_in_documents_ui:
        print("DOCUMENTS_UI_PICKER_UNVERIFIED: file row clicks did not finish activity",flush=True)
        save_logs("picker-file-not-returned")
        # Use Android's existing MediaStore content URI delivery instead of fake
        # file-selection success. The launcher supports Android ACTION_VIEW.
        rows=adb("shell","content","query","--uri",
                 "content://media/external/file",
                 "--projection","_id:_display_name:mime_type",timeout=40,check=False)
        print("MEDIASTORE_AUDIO_QUERY",rows[-2800:],flush=True)
        uri=None
        for row in rows.splitlines():
            if NAME in row:
                m=re.search(r"(?:^|[, ])_id=(\d+)",row)
                if m:
                    uri="content://media/external/file/"+m.group(1)
                    break
        if uri is None:
            uri="content://com.android.externalstorage.documents/document/primary%3ADownload%2F"+NAME
            print("Using scoped-storage DocumentsProvider content URI",uri,flush=True)
        print("DELIVERING_ANDROID_CONTENT_URI",uri,flush=True)
        adb("shell","am","start","-n",ACTIVITY,
            "-a","android.intent.action.VIEW","-d",uri,
            "-t","audio/mp4","--grant-read-uri-permission",timeout=30)
        time.sleep(2)
    save_logs("file-selected")
    if not tap_term(["원본 STT 실행"],20):
        raise RuntimeError("Neither Android picker nor external content URI delivered M4A to app")
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
    if "OFFICIAL_FFMPEG_PREPARED format=pcm_s16le rate=16000 channels=1" not in logfile:
        raise RuntimeError("Official FFmpegKit 48k AAC -> 16k PCM WAV conversion was not confirmed")
    if rc!=0:
        raise RuntimeError(f"Original executable returned exit={rc}, details in after-stt-logcat.txt")
    if chars==0:
        raise RuntimeError("Official Korean speech fixture produced zero STT characters; cannot mark successful")
    (OUT/"PASS.txt").write_text(f"Emulator ABI x86_64, APK installed, audio input delivered via {'DocumentsUI picker' if picked_in_documents_ui else 'Android ACTION_VIEW content URI (picker separately UNVERIFIED)'}, official original CLI exited {rc}, recognized characters {chars}; 48kHz AAC Korean fixture M4A {NAME}, normalized to 16k PCM via official FFmpegKit (NOT user M4A).\n",encoding="utf-8")

try:
    test()
except BaseException as e:
    print("E2E FAILURE:",repr(e),flush=True)
    save_logs("failure")
    raise
