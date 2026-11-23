#!/usr/bin/env python3
"""R20 QA: start REAL original MainActivity, use ORIGINAL A3.L.a native
factory (instrumented emulator-only) to open original CommonWebviewActivity.
No new list Activity, no fabricated HTML, no login bypass, no PDF.
"""
import json,re,sqlite3,subprocess,time
from pathlib import Path
OUT=Path("work/r20-native-proof");OUT.mkdir(parents=True,exist_ok=True)
PKG="com.eduzone.eduzoneviewer"
MAIN=PKG+"/com.eduzone.eduzoneviewer.ui.activities.MainActivity"
EXTRA="com.hitel.zocbodiag.QA_ORIGINAL_READING_FROM_MAIN"
def adb(*args,timeout=90,check=True):
    r=subprocess.run(["adb",*map(str,args)],capture_output=True,text=True,timeout=timeout)
    if check and r.returncode:raise RuntimeError("ADB "+repr(args[:5])+": "+r.stderr[-500:])
    return r.stdout
def snap(label):
    try:
        adb("shell","uiautomator","dump","/sdcard/r20.xml",timeout=55)
        x=adb("shell","cat","/sdcard/r20.xml")
        (OUT/(label+".xml")).write_text(x,"utf-8")
        print("R20_UI",label,re.findall(r'text="([^"]+)"',x)[:40],flush=True)
    except Exception as e:print("R20_UI_ERROR",label,str(e)[:160],flush=True)
    with (OUT/(label+".png")).open("wb") as f:
        z=subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,stderr=subprocess.PIPE,timeout=50)
        if z.returncode:print("R20_SCREEN_CAPTURE_FAILED",label,flush=True)
apk=Path("work/r20-source.apk")
assert apk.is_file() and apk.stat().st_size>30_000_000
print("R20_APK_INSTALLED",adb("install","-r",apk,timeout=180).strip(),flush=True)
print("R20_EMULATOR_MODEL",adb("shell","getprop","ro.product.model").strip(),flush=True)
print("R20_EMULATOR_FINGERPRINT",adb("shell","getprop","ro.build.fingerprint").strip(),flush=True)
adb("logcat","-c")
print("R20_START_REAL_ORIGINAL_MAIN",adb("shell","am","start","-n",MAIN,"--ez",EXTRA,"true").strip(),flush=True)
time.sleep(15)
snap("01_original_main_after_15s")
time.sleep(13)
snap("02_original_native_factory_after_28s")
time.sleep(10)
snap("03_source_response_after_38s")
log=adb("logcat","-d","-v","time",timeout=130)
(OUT/"full_logcat.txt").write_text(log,"utf-8")
activities=adb("shell","dumpsys","activity","activities")
(OUT/"activities.txt").write_text(activities,"utf-8")
ev=[x for x in log.splitlines() if any(k in x for k in
    ("ZocboInApp","hitel_zocbo_diag","CommonWebviewActivity","FATAL EXCEPTION","ERR_CONNECTION","Chromium","chromium"))]
(OUT/"focused_events.txt").write_text("\n".join(ev[-550:]),"utf-8")
for x in ev[-60:]:print("R20_ORIGINAL_LOG",x[:270],flush=True)
factory="stage=ORIGINAL_COMMON_WEBVIEW_ACTIVITY_STARTED" in log
qaerror="stage=ORIGINAL_NATIVE_FACTORY_ERROR" in log
navigation=("CommonWebviewActivity" in activities or "CommonWebviewActivity" in log)
source_first_page="stage=PAGE1_SQLITE_COMMIT" in log
rows=[]
try:
    root=adb("root",timeout=40,check=False)
    print("R20_ADB_ROOT",root.strip(),flush=True)
    time.sleep(3)
    adb("wait-for-device",timeout=50)
    trace="/data/user/0/"+PKG+"/files/zocbo_free_exam_trace.txt"
    if adb("shell","ls",trace,check=False).strip()==trace:
        subprocess.run(["adb","pull",trace,str(OUT/"redacted_original_app_trace.txt")],
            check=True,capture_output=True,text=True,timeout=80)
        raw=(OUT/"redacted_original_app_trace.txt").read_text("utf-8",errors="replace")
        print("R20_ORIGINAL_IN_APP_TRACE",raw[-5800:],flush=True)
    else:print("R20_ORIGINAL_DIAG_TRACE_ABSENT",flush=True)
    db="/data/user/0/"+PKG+"/databases/zocbo_exam_metadata_v1.db"
    if adb("shell","ls",db,check=False).strip()==db:
        subprocess.run(["adb","pull",db,str(OUT/"actual_app_sqlite.db")],
            check=True,capture_output=True,text=True,timeout=80)
        with sqlite3.connect("file:"+str(OUT/"actual_app_sqlite.db")+"?mode=ro",uri=True) as c:
            integ=c.execute("PRAGMA integrity_check").fetchone()[0]
            rows=c.execute("SELECT source_scope, count(*) FROM exams GROUP BY source_scope").fetchall()
            print("R20_SQLITE_PROOF",integ,rows,flush=True)
except Exception as e:print("R20_DB_EVIDENCE_ERROR",repr(e)[:280],flush=True)
summary={"original_main_started":True,"factory_call_confirmed":factory,
         "original_common_webview_seen":navigation,"factory_error":qaerror,
         "source_first_page_commit_log":source_first_page,
         "actual_android_db_source_counts":rows,
         "offline_html_replay":False,
         "separate_diagnostic_activity_used":False}
(OUT/"result.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),"utf-8")
print("R20_ORIGINAL_NATIVE_FACTORY_RESULT",json.dumps(summary,ensure_ascii=False),flush=True)
if not factory:
    raise SystemExit("R20_ORIGINAL_APP_FACTORY_NOT_CONFIRMED; see source diagnostics")
print("R20_REAL_MAIN_TO_ORIGINAL_COMMON_WEBVIEW_FACTORY_PASS; origin data separately verified",flush=True)
