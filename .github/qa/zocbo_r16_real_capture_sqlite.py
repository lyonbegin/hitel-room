#!/usr/bin/env python3
"""Strict Android emulator QA: genuine user-captured original exam IDs into REAL app SQLite.
This proves local data-path persistence, NOT live server enumeration.
All checks are fatal; UI/button presence alone cannot pass.
"""
import base64, json, re, subprocess, time, xml.etree.ElementTree as ET
from pathlib import Path
OUT=Path("work/r16-sqlite-evidence")
OUT.mkdir(parents=True,exist_ok=True)
PKG="com.eduzone.eduzoneviewer"
ENTRY=PKG+"/com.hitel.zocbodiag.NativePdfEntryActivity"
COLLECT="com.hitel.zocbodiag.COLLECT_METADATA"
QA="com.hitel.zocbodiag.QA_CAPTURE_BASE64"
EXPECTED_HASH="105e63ffe98c84f8c3dc61ee560e16ddaed266115afefec2d96d3b8c91cf7ab5"

def adb(*args,timeout=80):
    r=subprocess.run(["adb",*map(str,args)],text=True,capture_output=True,timeout=timeout)
    if r.returncode:
        raise RuntimeError(f"adb {args[:4]}: {r.returncode} {r.stderr[:500]}")
    return r.stdout

def snapshot(name):
    adb("shell","uiautomator","dump","/sdcard/window_r16.xml",timeout=45)
    xml=adb("shell","cat","/sdcard/window_r16.xml")
    (OUT/(name+".xml")).write_text(xml,"utf-8")
    with (OUT/(name+".png")).open("wb") as f:
        r=subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,stderr=subprocess.PIPE,timeout=45)
        if r.returncode:print("SCREENSHOT_FAILED",name,r.stderr[:100])
    try:
        root=ET.fromstring(xml)
        strings=[e.attrib.get("text","") for e in root.iter()]
        strings=[x for x in strings if x]
        print("R16_UI",name,strings[:35],flush=True)
    except Exception as exc: print("R16_UI_PARSE_ERROR",repr(exc),flush=True)
    return xml

def tap(xml,label):
    root=ET.fromstring(xml)
    for e in root.iter():
        name=e.attrib.get("text","")+" "+e.attrib.get("content-desc","")
        if label in name and e.attrib.get("clickable")=="true":
            x=e.attrib.get("bounds","")
            m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",x)
            if m:
                a,b,c,d=map(int,m.groups())
                if c>a and d>b:
                    adb("shell","input","tap",(a+c)//2,(b+d)//2)
                    print("R16_TAP",label,(a+c)//2,(b+d)//2,flush=True)
                    return True
    return False

fixture_path=Path(".github/qa/fixtures/zocbo_user_observed_previousExam_20261123_10ids.json")
rows=json.loads(fixture_path.read_text("utf-8"))
assert len(rows)==10 and len({x["expapr_no"] for x in rows})==10
assert all(x["ExPapr_TestYear"]=="2022" and x["Subj_Code"]=="HI" for x in rows)
from hashlib import sha256
actual=sha256(",".join(sorted(x["expapr_no"] for x in rows)).encode()).hexdigest()
assert actual==EXPECTED_HASH
print("R16_CAPTURE_SOURCE_PROOF original_user_HTML_rows=10 id_sha256="+actual,flush=True)
encoded=base64.b64encode(json.dumps(rows,ensure_ascii=False,separators=(",",":")).encode("utf-8")).decode("ascii")
apk=Path("work/r16.apk")
assert apk.exists() and apk.stat().st_size>30000000
print("R16_APK_BYTES",apk.stat().st_size,flush=True)
adb("install","-r",str(apk),timeout=180)
adb("logcat","-c")
adb("shell","am","start","-n",ENTRY,"--ez",COLLECT,"true","--es",QA,encoded)
time.sleep(9)
logs=adb("logcat","-d","-v","time",timeout=100)
(OUT/"first_launch_logcat.txt").write_text(logs,"utf-8")
proof=re.findall(r"QA_ACTUAL_CAPTURE_SQLITE_PROOF[^\n]*",logs)
print("R16_ANDROID_SQLITE_PROOF",proof[-1] if proof else "ABSENT",flush=True)
assert proof and "count=10 unique=10" in proof[-1] and "sqlite_reopen=PASS" in proof[-1] and EXPECTED_HASH in proof[-1],"real SQLite data verification missing"
xml=snapshot("01_after_real_captured_source_10_insert")
assert "저장 DB: 10건" in xml or "DB: 10건" in xml,"UI does not reflect ten SQLite rows"

# Terminate all app processes, then reopen WITHOUT a seed. Data must survive.
adb("shell","am","force-stop",PKG)
time.sleep(3)
adb("shell","am","start","-n",ENTRY,"--ez",COLLECT,"true")
time.sleep(7)
xml=snapshot("02_after_process_restart_without_seed")
assert "저장 DB: 10건" in xml or "DB: 10건" in xml,"ten rows lost after restart"
print("R16_ANDROID_SQLITE_REOPEN_10_PERSISTED_PASS",flush=True)

# Export committed rows through the actual native Android ACTION_CREATE_DOCUMENT picker.
assert tap(xml,"CSV 파일 내보내기"),"CSV export button unavailable"
time.sleep(4)
picker=snapshot("03_android_csv_file_picker")
saved=False
for label in ("저장","Save","SAVE"):
    if tap(picker,label):
        saved=True
        break
assert saved,"Android document save button unavailable"
time.sleep(6)
xml=snapshot("04_export_complete")
if "CSV 저장 완료: 10건" not in xml:
    # Sometimes document picker/collector transitions need a second UI refresh.
    time.sleep(4)
    xml=snapshot("05_export_status_delayed")
assert "CSV 저장 완료: 10건" in xml,"Native CSV exporter did not export ten committed SQLite rows"

# Read exported CSV bytes back from Android shared storage, not just a UI success label.
from io import StringIO
import csv
names=adb("shell","ls","-1","/sdcard/Download").splitlines()
candidates=[name.strip() for name in names if
    name.strip().startswith("zocbo_exam_metadata_") and name.strip().endswith(".csv")]
assert len(candidates)==1,"expected one actual exported CSV in fresh emulator Downloads, got "+repr(candidates)
exported_name=candidates[0]
data=adb("shell","cat","/sdcard/Download/"+exported_name,timeout=90)
(OUT/"exported_original_captured_10_metadata.csv").write_text(data,encoding="utf-8")
reader=csv.DictReader(StringIO(data.lstrip("\ufeff")))
csv_rows=list(reader)
assert len(csv_rows)==10,"file has "+str(len(csv_rows))+" data rows instead of 10"
assert sorted(x["exam_no"] for x in csv_rows)==sorted(x["expapr_no"] for x in rows),"CSV exam numbers differ from original captured HTML"
assert len({x["exam_no"] for x in csv_rows})==10,"CSV duplicated exam_no"
assert {x["source_scope"] for x in csv_rows}=={"CAPTURED_HTML_QA_ONLY"},"CSV provenance was incorrectly claimed as a live server result"
for item in csv_rows:
    observed=next(x for x in rows if x["expapr_no"]==item["exam_no"])
    assert item["school"]==observed["scl_short_name"] and item["title"]==observed["viewer_title"], "CSV metadata mismatch: "+item["exam_no"]
print("R16_REAL_EXPORTED_CSV_CONTENT_MATCHES_ORIGINAL_CAPTURE_PASS filename="+exported_name+
      " rows=10 source_scope=CAPTURED_HTML_QA_ONLY",flush=True)
print("R16_CAPTURED_USER_HTML_APP_SQLITE_AND_CSV_PASS count=10 live_server_verified=False",flush=True)
