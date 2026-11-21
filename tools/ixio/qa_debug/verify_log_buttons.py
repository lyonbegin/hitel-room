#!/usr/bin/env python3
"""Android emulator UI verification of real in-app LOG, CLEAR, COPY buttons."""
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT=Path("ixio-pages-qa-results")
OUT.mkdir(parents=True,exist_ok=True)

def adb(*args,timeout=28):
    result=subprocess.run(["adb",*args],stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT,timeout=timeout,text=True,errors="replace")
    if result.returncode:raise RuntimeError("adb failure "+str(args)+" "+result.stdout[-150:])
    return result.stdout

def capture():
    adb("shell","uiautomator","dump","/sdcard/hitel_qa_buttons.xml",timeout=35)
    xml=adb("shell","cat","/sdcard/hitel_qa_buttons.xml",timeout=25)
    return [node.attrib for node in ET.fromstring(xml).iter("node")]

def find(nodes,label):
    chosen=[]
    for n in nodes:
        if n.get("text","").strip()!=label and n.get("content-desc","").strip()!=label:continue
        m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",n.get("bounds",""))
        if not m:continue
        a,b,c,d=map(int,m.groups())
        if c<=a or d<=b:continue
        chosen.append(((a+c)//2,(b+d)//2))
    if len(chosen)!=1:raise RuntimeError("Expected exactly one "+label+" button; found "+str(len(chosen)))
    return chosen[0]

def tap(nodes,label):
    x,y=find(nodes,label)
    adb("shell","input","tap",str(x),str(y))
    time.sleep(1.7)

def main():
    data={"panel_found":False,"clear_button_pressed":False,"copy_button_pressed":False,
          "clipboard_set_marker":False,"no_special_permissions_required":True}
    try:
        nodes=capture()
        tap(nodes,"로그")
        nodes=capture()
        assert any(n.get("text","")=="IXIO 진단 로그" for n in nodes),"dialog not displayed"
        find(nodes,"로그 지우기");find(nodes,"로그 복사")
        data["panel_found"]=True
        tap(nodes,"로그 지우기")
        data["clear_button_pressed"]=True
        nodes=capture()
        tap(nodes,"로그")
        nodes=capture()
        find(nodes,"로그 복사")
        tap(nodes,"로그 복사")
        data["copy_button_pressed"]=True
        log=adb("logcat","-d","-s","HITEL_IXIO_DIAG:I","*:S",timeout=28)
        # Do not export full logcat, which may contain PII and credentials.
        data["clipboard_set_marker"]="LOG_COPIED_TO_CLIPBOARD" in log
        data["clear_marker_count"]=log.count("LOG_DIALOG_OPENED")
        assert data["clipboard_set_marker"],"copy onClick/clipboard callback not observed"
        print("HITEL_LOG_CLEAR_COPY_BUTTONS_FULL_E2E_VERIFIED=YES",flush=True)
    except Exception as exc:
        data["failure"]=type(exc).__name__+": "+str(exc)[:180]
        print("HITEL_LOG_CLEAR_COPY_BUTTON_TEST_FAILED",data["failure"],flush=True)
        raise
    finally:
        (OUT/"log-clear-copy-ui-result.json").write_text(
            json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf8")

if __name__=="__main__":main()
