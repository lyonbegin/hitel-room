#!/usr/bin/env python3
"""R19: launch the actual Zocbo MainActivity; navigate ONLY via source app UI.
Do not start HITEL NativePdfEntryActivity, inject HTML, synthesize source rows,
bypass login, or call PDF endpoints. Save screenshots/logcat as proof.
"""
import json,re,subprocess,time,xml.etree.ElementTree as ET
from pathlib import Path
OUT=Path("work/zocbo-r19-original-app");OUT.mkdir(parents=True,exist_ok=True)
PKG="com.eduzone.eduzoneviewer"
MAIN=PKG+"/com.eduzone.eduzoneviewer.ui.activities.MainActivity"
def adb(*args,timeout=70,fail=True):
    r=subprocess.run(["adb",*map(str,args)],capture_output=True,text=True,timeout=timeout)
    if fail and r.returncode:raise RuntimeError("ADB fail "+str(args[:3])+" "+r.stderr[-400:])
    return r.stdout
def snapshot(label):
    xml=""
    try:
        adb("shell","uiautomator","dump","/sdcard/r19.xml",timeout=50)
        xml=adb("shell","cat","/sdcard/r19.xml")
        (OUT/(label+".xml")).write_text(xml,encoding="utf-8")
        text=re.findall(r'(?:text|content-desc)="([^"]+)"',xml)
        print("R19_MAIN_UI",label,[x for x in text if x][:75],flush=True)
    except Exception as e:print("R19_UI_DUMP_ERROR",label,str(e)[:200],flush=True)
    with (OUT/(label+".png")).open("wb") as f:
        r=subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,stderr=subprocess.PIPE,timeout=40)
        if r.returncode:print("R19_SCREENSHOT_ERROR",label,flush=True)
    return xml
def tap_match(xml,patterns):
    try:
        for e in ET.fromstring(xml).iter():
            val=e.attrib.get("text","")+" "+e.attrib.get("content-desc","")
            if not any(re.search(p,val) for p in patterns):continue
            if re.search(r"수집|원본PDF|복사|지우기",val):continue
            m=re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",e.attrib.get("bounds",""))
            if not m:continue
            x1,y1,x2,y2=map(int,m.groups())
            if x2<=x1 or y2<=y1:continue
            adb("shell","input","tap",str((x1+x2)//2),str((y1+y2)//2))
            print("R19_ORIGINAL_UI_TAPPED",val[:90],flush=True)
            return True
    except Exception as ex:print("R19_CLICK_ERROR",str(ex)[:250],flush=True)
    return False
apk=Path("work/r19-source.apk")
assert apk.is_file() and apk.stat().st_size>30_000_000
print("R19_APK_SIZE",apk.stat().st_size,flush=True)
print("R19_ADB_INSTALL",adb("install","-r",apk,timeout=160).strip(),flush=True)
adb("logcat","-c")
print("R19_ORIGINAL_MAIN_LAUNCH",adb("shell","am","start","-n",MAIN).strip(),flush=True)
time.sleep(17)
xml=snapshot("01_original_MainActivity")
# Never invoke a separately created diagnostic activity.
print("R19_MAIN_FOREGROUND",adb("shell","dumpsys","activity","activities")[-7000:],flush=True)
for k in range(5):
    if tap_match(xml,[r"기출.{0,12}(열람|시험|무료)",r"무료.{0,12}기출",r"지난.{0,8}시험"]):
        time.sleep(12)
        xml=snapshot(f"02_original_ui_navigation_{k}")
    else:
        if k==0:
            # Try a simple scroll of the ORIGINAL app navigation, not artificial URL loading.
            adb("shell","input","swipe","450","750","450","275","600")
            time.sleep(3)
            xml=snapshot("01_original_MainActivity_scrolled")
        else:break
logs=adb("logcat","-d","-v","time",timeout=90)
(OUT/"logcat.txt").write_text(logs,encoding="utf-8")
activities=adb("shell","dumpsys","activity","activities")
(OUT/"activities.txt").write_text(activities,"utf-8")
interesting=[l for l in logs.splitlines() if any(x in l for x in
    ("hitel_zocbo_diag","ZocboNine","FATAL EXCEPTION","ActivityTaskManager","chromium","ERR_CONNECTION","ViewRoot","AndroidRuntime"))]
print("R19_LOGCAT_RELEVANT_TAIL",json.dumps(interesting[-90:],ensure_ascii=False)[-14000:],flush=True)
out={
 "real_original_main_launched":True,
 "navigation_to_original_webview_in_log":any(("CommonWebviewActivity" in x and ("START" in x or "Displayed" in x)) for x in logs.splitlines()),
 "previous_exam_url_seen_in_logcat":any("previousExam.asp" in x for x in logs.splitlines()),
 "original_main_foreground":("MainActivity" in activities),
 "new_diagnostic_activity_launched":("NativePdfEntryActivity" in activities),
 "source_live_exam_verified":False,
 "note":"No login, HTML injection, direct diagnostic Activity or PDF call; inspect captured screenshot and log for actual source access."
}
(OUT/"result.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),"utf-8")
print("R19_ORIGINAL_MAIN_FORENSIC_RESULT",json.dumps(out,ensure_ascii=False),flush=True)
if out["new_diagnostic_activity_launched"]:raise SystemExit("Unexpected separate NativePdfEntryActivity")
print("R19_ORIGINAL_MAIN_ACTUAL_ANDROID_EXECUTED",flush=True)
