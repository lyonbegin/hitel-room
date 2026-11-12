#!/usr/bin/env python3
"""Actual Android 15 x86_64 emulator smoke and increasing M4A playback test.

This runs against the installed compiled HITEL14 V19 APK. The provided
input is a valid AAC-LC M4A file written in chunks while the service runs.
It observes new file bytes, native AAC frames, PCM writes and playback head.
It does NOT assert that a physical Samsung cellular call routes to speaker.
"""
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

APP="app.hitel.callflowlab.v14.growing.diag"
ROOT=Path("/tmp/hitel14-v19-emulator")
ROOT.mkdir(parents=True,exist_ok=True)
def run(cmd,timeout=90,check=True):
    result=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
                          text=True,errors="replace",timeout=timeout)
    if check and result.returncode:
        raise RuntimeError("command failed: "+" ".join(cmd)+"\n"+result.stdout[-4000:])
    return result.stdout
def adb(*args,timeout=90):
    return run(["adb",*args],timeout=timeout)
def dump(stage):
    attempts=[
       ["adb","exec-out","uiautomator","dump","/dev/tty"],
       ["adb","shell","uiautomator","dump","/dev/stdout"],
       ["adb","shell","-t","uiautomator","dump","/dev/tty"],
    ]
    # Always preserve a real screenshot, even if UIAutomator XML cannot read.
    try:
        screenshot=subprocess.run(["adb","exec-out","screencap","-p"],
                                  stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20)
        if screenshot.returncode==0 and screenshot.stdout.startswith(b"\x89PNG"):
            (ROOT/(stage+".png")).write_bytes(screenshot.stdout)
    except Exception as err:
        print("SCREENSHOT_FAILED",str(err)[:180],flush=True)
    for cmd in attempts:
        try:
            out=run(cmd,timeout=16,check=False)
            m=re.search(r'(<\?xml[^>]*>.*?</hierarchy>)',out,re.S)
            if not m:m=re.search(r'(<hierarchy\b.*?</hierarchy>)',out,re.S)
            if m:
                text=m.group(1).replace("\r","")
                (ROOT/(stage+".xml")).write_text(text)
                tree=ET.fromstring(text)
                names=[n.attrib.get("text","") for n in tree.iter("node") if n.attrib.get("text","")]
                print("UI",stage," / ".join(names[:35]),flush=True)
                return tree
            print("UI_DUMP_METHOD_FAILED",cmd[-2:],"text=",out[-180:].strip(),flush=True)
        except Exception as e:
            print("UI_DUMP_EXCEPTION",str(e)[:180],flush=True)
    raise RuntimeError("Android UI hierarchy dump unavailable after 3 methods")
def find(tree,term):
    for node in tree.iter("node"):
        if (term.casefold() in node.attrib.get("text","").casefold() or
            term.casefold() in node.attrib.get("content-desc","").casefold()):
            return node
    return None
def click(term,stage,optional=False):
    for i in range(4):
        tree=dump(stage+str(i))
        node=find(tree,term)
        if node is not None:
            coords=list(map(int,re.findall(r"\d+",node.attrib["bounds"])))
            x=(coords[0]+coords[2])//2;y=(coords[1]+coords[3])//2
            print("UI_CLICK",term,x,y,flush=True)
            adb("shell","input","tap",str(x),str(y))
            time.sleep(1.5)
            return True
        time.sleep(1)
    if optional:return False
    raise AssertionError("Required UI item missing: "+term)

def log():
    data=adb("logcat","-d","-v","time",timeout=50)
    (ROOT/"logcat.txt").write_text(data)
    return data

APK=Path("AndroidProject/app/build/outputs/apk/debug/app-debug.apk")
assert APK.stat().st_size>1024,APK
print("EMU_API",adb("shell","getprop","ro.build.version.sdk").strip(),flush=True)
print("EMU_ABI",adb("shell","getprop","ro.product.cpu.abi").strip(),flush=True)
print("INSTALL",adb("install","-r",str(APK),timeout=120),flush=True)
adb("shell","pm","grant",APP,"android.permission.RECORD_AUDIO")
adb("shell","input","keyevent","82")
print("LAUNCH",adb("shell","am","start","-W","-n",APP+"/app.hitel.samsungprobe.W03ConsoleActivity"),flush=True)
time.sleep(7)
pid=adb("shell","pidof",APP).strip()
assert pid,"HITEL W03 app process terminated"
print("PASS_EMULATOR_INSTALL_LAUNCH pid="+pid,flush=True)
main=dump("w03_initial")
for token in ("HITEL14 원본","마이크","녹음 폴더 선택","전체 실행 로그"):
    assert find(main,token) is not None,"original W03 missing: "+token
print("PASS_EMULATOR_W03_ORIGINAL_MIC_AND_PINNED_GROWING_FOLDER_BUTTON",flush=True)
click("삼성 통화 녹음 폴더 선택","w03_click")
page=dump("growing_player")
for token in ("녹음파일","녹음 폴더 선택","감시","미디어 음량"):
    assert find(page,token) is not None,"playback screen missing: "+token
print("PASS_EMULATOR_GROWING_RECORDING_PLAYER_ACTIVITY_AND_VOLUME_CONTROLS",flush=True)

# Prepare an actually growing recording at an Android DocumentsProvider folder.
directory="/sdcard/Documents/HITEL-Growing-M4A"
adb("shell","mkdir","-p",directory)
fixture=Path("/tmp/hitel14-v19.m4a")
assert fixture.stat().st_size>5000
binary=fixture.read_bytes()
first=Path("/tmp/hitel14-initial.m4a")
first.write_bytes(binary[:250])
adb("push",str(first),directory+"/test-call-growing.m4a",timeout=60)
print("EMU_GROWING_FIXTURE",len(binary),"bytes",flush=True)

click("녹음 폴더 선택","choose_folder")
folder=dump("saf_first")
# DocumentsUI usually lists 'Documents' immediately or in navigation drawer.
# Try direct Documents root then test folder.
for term in ("Documents","문서"):
    if find(folder,term) is not None:
        click(term,"saf_documents")
        break
folder=dump("saf_in_documents")
if find(folder,"HITEL-Growing-M4A") is None:
    if find(folder,"내부 저장소") is not None:
        click("내부 저장소","saf_storage")
    elif find(folder,"Internal storage") is not None:
        click("Internal storage","saf_storage")
    folder=dump("saf_storage_root")
    if find(folder,"Documents") is not None:
        click("Documents","saf_documents_again")
folder=dump("saf_folder_list")
click("HITEL-Growing-M4A","select_hitel_test_folder")
folder=dump("saf_inside")
for text in ("Use this folder","이 폴더 사용"):
    if find(folder,text) is not None:
        click(text,"saf_use_folder")
        break
else:
    raise AssertionError("SAF Use this folder control not found")
permission=dump("saf_permission")
for term in ("Allow","허용"):
    if find(permission,term) is not None:
        click(term,"saf_grant")
        break
time.sleep(3)
print("PASS_EMULATOR_SAF_RECORDING_FOLDER_SELECTED",flush=True)
# Automatic start after SAF selection. Append source while the watcher runs.
for partno in range(1,15):
    begin=250+(partno-1)*2200
    if begin>=len(binary):break
    end=min(len(binary),begin+2200)
    segment=Path(f"/tmp/hitel-part-{partno}.bin")
    segment.write_bytes(binary[begin:end])
    adb("push",str(segment),"/sdcard/hitel-part.bin")
    # adb shell receives ONE raw shell command, so >> is processed inside Android.
    adb("shell",f"cat /sdcard/hitel-part.bin >> {directory}/test-call-growing.m4a")
    time.sleep(0.33)
    if partno in (1,5,10):
        print("SOURCE_GROWTH_PROGRESS",partno,end,flush=True)
time.sleep(7)
logs=log()
for token in ("FILE_SELECTED","AAC_FOLLOW_READY","PCM_WRITTEN"):
    hits=[x for x in logs.splitlines() if token in x]
    print("LOG_MARKER",token,"count",len(hits),"sample",hits[-1][-500:] if hits else "-",flush=True)
# AUDIO_PLAYBACK means data crossed actual Android AudioTrack in the emulator.
assert "FILE_SELECTED" in logs,"emulator did not recognize increasing call file"
assert "AAC_FOLLOW_READY" in logs,"emulator did not start native growing-M4A AAC follower"
assert "PCM_WRITTEN" in logs,"emulator did not write decoded audio to AudioTrack"
print("PASS_EMULATOR_INCREASING_M4A_NATIVE_AAC_PCM_TO_AUDIOTRACK",flush=True)
