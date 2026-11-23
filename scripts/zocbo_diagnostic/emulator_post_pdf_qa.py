#!/usr/bin/env python3
"""Real Android emulator test of the R5 user-operated POST·PDF button.

Actions: booted app, screenshot, native UI tree, tap POST·PDF, confirm the
exam 15958873 POST, collect logs, screenshot and save a machine-readable verdict.
Does not simulate login, store credentials, or fake successful PDF download.
"""
from pathlib import Path
import subprocess, time, xml.etree.ElementTree as ET, json, re, sys

out=Path("qa-logs");out.mkdir(parents=True,exist_ok=True)
package="com.eduzone.eduzoneviewer"
result={"package":package,"exam_id":15958873,"apk":str(Path("test-apk/Zocbo_4.3.11_PDF_POST_BUTTON_R5_20261123.apk")),
        "installed":False,"launched":False,"button_found":False,"button_tapped":False,
        "dialog_found":False,"post_confirmed":False,"pdf_file_found":False,
        "session_available":"unknown","requested_pdf_download":"not confirmed",
        "errors":[]}

def run(cmd,timeout=30,check=False):
    r=subprocess.run(cmd,capture_output=True,text=True,timeout=timeout)
    if check and r.returncode:raise RuntimeError(f"{cmd} returned {r.returncode}: {r.stderr[:1200]}")
    return r
def adb(*args,timeout=30,check=False):
    return run(["adb",*args],timeout,check)
def snap(tag):
    try:
        with open(out/f"{tag}.png","wb") as f:
            r=subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,stderr=subprocess.PIPE,timeout=15)
        if r.returncode:result["errors"].append(f"screenshot {tag}: "+r.stderr.decode(errors="replace")[:160])
    except Exception as ex:result["errors"].append(f"screenshot {tag}: {ex}")
def dump(tag):
    r=adb("shell","uiautomator","dump","/sdcard/window.xml",timeout=30)
    xml=adb("shell","cat","/sdcard/window.xml",timeout=15).stdout
    if not xml.strip().startswith("<?xml"):result["errors"].append(f"{tag} UI XML failed "+r.stdout[-200:])
    (out/f"{tag}.xml").write_text(xml,encoding="utf8")
    return xml

def xml_nodes(xml):
    try:
        root=ET.fromstring(xml)
        return [{k:elem.get(k,"") for k in ("text","content-desc","resource-id","class","bounds","clickable","visible-to-user")}
                for elem in root.iter() if elem.tag=="node"]
    except Exception as ex:
        result["errors"].append("parse xml:"+str(ex))
        return []
def find(nodes,fragment):
    return next((n for n in nodes if fragment in n["text"] or fragment in n["content-desc"]),None)
def click(n):
    m=re.search(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",n["bounds"])
    if not m:raise ValueError("No coordinate bounds for "+str(n))
    x=(int(m[1])+int(m[3]))//2;y=(int(m[2])+int(m[4]))//2
    adb("shell","input","tap",str(x),str(y),check=True)
    print("ADB_TAP",n["text"],x,y,flush=True)
def logcat():
    (out/"logcat.txt").write_text(adb("logcat","-d","-v","threadtime",timeout=30).stdout,encoding="utf8")

try:
    print("ADB_DEVICES",adb("devices").stdout,flush=True)
    apk=Path(result["apk"])
    if not apk.is_file():raise FileNotFoundError(str(apk))
    install=adb("install","-r",str(apk),timeout=120)
    (out/"install.txt").write_text(install.stdout+"\n"+install.stderr,encoding="utf8")
    print("ADB_INSTALL",install.stdout.strip(),install.stderr.strip(),flush=True)
    if install.returncode!=0:raise RuntimeError("install failed: "+install.stderr[-1000:])
    result["installed"]=True
    adb("logcat","-c")
    launch=adb("shell","monkey","-p",package,"-c","android.intent.category.LAUNCHER","1",timeout=45)
    print("LAUNCH",launch.stdout[-500:],flush=True)
    result["launched"]= "Events injected: 1" in launch.stdout
    time.sleep(17)
    snap("01_app_launch")
    xml=dump("01_app_launch")
    nodes=xml_nodes(xml)
    result["visible_launch_text"]=[n["text"] for n in nodes if n["text"]][:35]
    print("LAUNCH_UI_TEXT",result["visible_launch_text"],flush=True)
    btn=find(nodes,"POST·PDF")
    if not btn:
        print("POST_BUTTON_NOT_INITIAL_VISIBLE, swipe horizontal diagnostics area",flush=True)
        adb("shell","input","swipe","950","145","200","145","400")
        time.sleep(2)
        xml=dump("01b_after_toolbar_swipe")
        nodes=xml_nodes(xml)
        btn=find(nodes,"POST·PDF")
    if btn:
        result["button_found"]=True
        click(btn);result["button_tapped"]=True
        time.sleep(3)
        snap("02_post_dialog")
        xml=dump("02_post_dialog")
        nodes=xml_nodes(xml)
        result["dialog_text"]=[n["text"] for n in nodes if n["text"]][:28]
        print("POST_DIALOG_UI",result["dialog_text"],flush=True)
        confirm=find(nodes,"POST 실행")
        if confirm:
            result["dialog_found"]=True
            # Default exam 15958873 already set via original test design
            click(confirm)
            result["post_confirmed"]=True
            time.sleep(20)
            snap("03_after_post")
            xml=dump("03_after_post")
            result["post_ui_text"]=[n["text"] for n in xml_nodes(xml) if n["text"]][:25]
            print("POST_UI",result["post_ui_text"],flush=True)
        else:
            result["errors"].append("POST dialog confirm button absent")
    else:
        result["errors"].append("POST·PDF button not visible after launch and swipe")
except Exception as ex:
    result["errors"].append(type(ex).__name__+": "+str(ex))
    print("EMULATOR_QA_EXCEPTION",type(ex).__name__,str(ex),flush=True)
finally:
    try:logcat()
    except Exception as ex:result["errors"].append("logcat: "+str(ex))
    try:(out/"activities.txt").write_text(adb("shell","dumpsys","activity","activities").stdout)
    except Exception:pass
    logs=(out/"logcat.txt").read_text(errors="replace") if (out/"logcat.txt").exists() else ""
    keys=("PDF_MANUAL_CLIENT_AVAILABLE","MANUAL_POST_","MANUAL_PDF_","PDF_TRACE_HOOK_",
          "FATAL EXCEPTION","AndroidRuntime","NoClassDefFoundError","VerifyError")
    interesting=[line for line in logs.splitlines() if any(x in line for x in keys)]
    (out/"targeted_logcat.txt").write_text("\n".join(interesting[-600:]),encoding="utf8")
    result["logcat_targeted_lines"]=interesting[-45:]
    result["fatal_crash"]=any(("FATAL EXCEPTION" in line or "VerifyError" in line) for line in interesting)
    result["session_available"]="yes" if any("PDF_MANUAL_CLIENT_AVAILABLE" in line for line in interesting) \
        else "unconfirmed"
    result["requested_pdf_download"]="confirmed" if any("MANUAL_PDF_RESULT" in line and "SUCCESS" in line for line in interesting) \
        else "not confirmed"
    (out/"verdict.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
    print("EMULATOR_QA_VERDICT",json.dumps({k:v for k,v in result.items() if k not in ("logcat_targeted_lines","visible_launch_text","dialog_text","post_ui_text")},ensure_ascii=False),flush=True)
    print("TARGETED_LOGCAT", "\n".join(interesting[-35:]),flush=True)
if not result["installed"] or not result["launched"] or result["fatal_crash"] or not result["button_tapped"] or not result["post_confirmed"]:
    sys.exit(1)
