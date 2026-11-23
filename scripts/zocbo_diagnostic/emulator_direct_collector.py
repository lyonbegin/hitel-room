#!/usr/bin/env python3
"""Real emulator R13 direct activity smoke when original main needs unreachable server.
Stages: install -> start native collector -> UI screenshots -> tap nationwide ->
try CSV export -> assert logcat outcome. Never claim server content was received."""
import re,subprocess,time,xml.etree.ElementTree as ET
from pathlib import Path
out=Path("work/direct-ui-evidence");out.mkdir(parents=True,exist_ok=True)
pkg="com.eduzone.eduzoneviewer"
def adb(*args,timeout=55):
    z=subprocess.run(["adb",*map(str,args)],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
    if z.returncode:print("ADB_FAILURE",args,"code",z.returncode,z.stderr[:450],flush=True)
    return z
def snapshot(label):
    with (out/(label+".png")).open("wb") as f:
        subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,stderr=subprocess.PIPE,timeout=25)
    adb("shell","uiautomator","dump","/sdcard/uia.xml",timeout=30)
    txt=adb("shell","cat","/sdcard/uia.xml").stdout
    (out/(label+".xml")).write_text(txt,encoding="utf8")
    try:
        root=ET.fromstring(txt)
        pairs=[(e.attrib.get("text",""),e.attrib.get("content-desc","")) for e in root.iter()]
        print("DIRECT_UI",label,[a or b for a,b in pairs if a or b][:70],flush=True)
    except Exception as e:print("DIRECT_UI_XML_PARSE_ERROR",str(e),flush=True)
    return txt
def tap(xml,label):
    try:
        for e in ET.fromstring(xml).iter():
            if label in (e.attrib.get("text","")+" "+e.attrib.get("content-desc","")):
                m=re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",e.attrib.get("bounds",""))
                if m:
                    x1,y1,x2,y2=map(int,m.groups())
                    if x2<=x1 or y2<=y1:continue
                    x,y=(x1+x2)//2,(y1+y2)//2
                    adb("shell","input","tap",x,y)
                    print("DIRECT_TAP",label,x,y,flush=True)
                    return True
    except Exception as ex:print("DIRECT_TAP_ERROR",str(ex),flush=True)
    return False

print("DIRECT_EMULATOR_DEVICES",adb("devices","-l").stdout,flush=True)
adb("logcat","-c")
install=adb("install","-r","work/direct-test.apk",timeout=120)
print("DIRECT_INSTALL",install.stdout,install.stderr,flush=True)
assert install.returncode==0,"INSTALL_FAILED"
entry=pkg+"/com.hitel.zocbodiag.NativePdfEntryActivity"
start=adb("shell","am","start","-n",entry,"--ez","com.hitel.zocbodiag.COLLECT_METADATA","true")
print("DIRECT_ACTIVITY_START",start.stdout,start.stderr,flush=True)
assert start.returncode==0,"DIRECT_ACTIVITY_NOT_EXPORTED"
time.sleep(7)
xml=snapshot("01_direct_collector_screen")
has_ui=("기출 열람실 시험지 목록 수집" in xml)
print("DIRECT_COLLECTOR_UI_PRESENT",has_ui,flush=True)
tap_auto=tap(xml,"전국 지역")
if not tap_auto:
    tap_auto=tap(xml,"자동수집")
print("DIRECT_AUTO_BUTTON_TAPPED",tap_auto,flush=True)
time.sleep(10)
xml=snapshot("02_after_auto_region")
# Try file export even when remote server unreachable.
export_clicked=tap(xml,"CSV 파일 내보내기")
print("DIRECT_EXPORT_PICKER_OPEN_ATTEMPT",export_clicked,flush=True)
if export_clicked:
    time.sleep(3)
    xml=snapshot("03_save_file_picker")
    for label in ["저장","Save","SAVE"]:
        if tap(xml,label):
            time.sleep(4)
            snapshot("04_after_export")
            break
log=adb("logcat","-d","-v","time",timeout=70).stdout
(out/"logcat.txt").write_text(log,encoding="utf8")
for ln in log.splitlines():
    if "COLLECTOR_" in ln or "FATAL EXCEPTION" in ln or "DOTCOM_API_PROXY_DISABLED" in ln:
        print("DIRECT_DIAG_LOG",ln[:650],flush=True)
crashed=("FATAL EXCEPTION" in log and ("com.eduzone.eduzoneviewer" in log))
print("DIRECT_RESULT",
      "UI="+str(has_ui),"BUTTON="+str(tap_auto),"EXPORT_DIALOG="+str(export_clicked),
      "DB_PAGE_SAVED="+str("COLLECTOR_PAGE_SAVED" in log),
      "CSV_EXPORTED="+str("COLLECTOR_EXPORT_OK" in log),
      "CRASH="+str(crashed),flush=True)
if not has_ui or not tap_auto or crashed:raise SystemExit(4)
