#!/usr/bin/env python3
"""Real Android 15 emulator: click the V29 user-facing button, observe SAF UI.

Validates the *first tap* through Android UI, not fabricated model logs.
It does NOT assert that emulator modem speech is live Samsung call audio.
Runs after the original V28 Android runtime regression test.
"""
from pathlib import Path
import subprocess,time,re,json,xml.etree.ElementTree as ET
APP="app.hitel.callflowlab.v32.directasr"
ACTIVITY=APP+"/app.hitel.samsungprobe.W03ConsoleActivity"
OUT=Path("/tmp/v32-growing-call-e2e")
OUT.mkdir(parents=True,exist_ok=True)

def adb(*args,timeout=60,check=True):
    p=subprocess.run(["adb",*args],capture_output=True,text=True,
                     encoding="utf-8",errors="replace",timeout=timeout)
    s=p.stdout+"\n"+p.stderr
    if check and p.returncode:
        raise AssertionError("ADB "+str(args)+" returned "+str(p.returncode)+": "+s[-800:])
    return s

adb("shell","am","force-stop",APP,check=False)
adb("logcat","-c")
adb("shell","am","start","-W","-n",ACTIVITY,timeout=90)
time.sleep(4)
adb("shell","uiautomator","dump","/sdcard/v29-one-tap.xml",timeout=70)
xml=adb("shell","cat","/sdcard/v29-one-tap.xml")
(OUT/"v29-one-tap-before.xml").write_text(xml,encoding="utf-8")
root=ET.fromstring(xml[xml.index("<?xml"):])
matches=[n for n in root.iter("node")
         if n.attrib.get("text","").startswith("▶ 테스트 시작")
         and n.attrib.get("clickable","")=="true"
         and n.attrib.get("package","")==APP]
assert len(matches)==1, "Only one real CLICKABLE W03 start button may exist: "+str(len(matches))
node=matches[0]
bounds=node.attrib.get("bounds","")
nums=[int(x) for x in re.findall(r"\d+",bounds)]
assert len(nums)==4 and nums[2]>nums[0] and nums[3]>nums[1], bounds
x=(nums[0]+nums[2])//2;y=(nums[1]+nums[3])//2
print("V29_ORIGINAL_W03_ONE_TAP_BUTTON",node.attrib.get("text"),bounds,flush=True)
adb("shell","input","tap",str(x),str(y))
time.sleep(5)
logs=adb("logcat","-d","-s","HITEL-SPEAKER-DIAG:I","*:S")
(OUT/"v29-one-tap-logcat.txt").write_text(logs,encoding="utf-8")
assert "ONE_TAP_START_REQUEST" in logs, "A real Android tap did not reach the V29 method"
assert "ONE_TAP_WAIT_SAF" in logs, "First-time SAF permission transition did not happen"
activities=adb("shell","dumpsys","activity","activities",timeout=45)
(OUT/"v29-one-tap-dumpsys-activity.txt").write_text(activities,encoding="utf-8")
if not re.search(r"(?:documentsui|DocumentsUI|action\.OPEN_DOCUMENT_TREE)",activities,re.I):
    # UI can be a vendor picker; preserve evidence, do not claim launch.
    raise AssertionError("Android native SAF folder picker not observed: "+activities[-1500:])
with (OUT/"v29-one-tap-picker.png").open("wb") as image:
    subprocess.run(["adb","exec-out","screencap","-p"],
                   stdout=image,check=True,timeout=45)
assert (OUT/"v29-one-tap-picker.png").stat().st_size>6000
verdict={"android_sdk":35,"button_tapped_on_real_w03":True,
         "one_tap_start_event":True,"first_time_saf_picker":True,
         "one_tap_full_call_recording":"NOT_TESTED_ON_EMULATOR",
         "native_samsung_m4a":"NOT_AVAILABLE_ON_PIXEL_EMULATOR"}
(OUT/"v29-one-tap-verdict.json").write_text(json.dumps(verdict,ensure_ascii=False,indent=2))
print("PASS_V31_REAL_UI_SINGLE_TAP_ENTERS_NATIVE_SAF_SETUP_AFTER_SYSTEM_PROMPTS",flush=True)
