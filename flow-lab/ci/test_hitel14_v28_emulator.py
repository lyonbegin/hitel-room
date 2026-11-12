#!/usr/bin/env python3
"""HITEL14 V28 Android 15 emulator execution; no false Samsung-hardware claims.

This tests the reconstructed V28 Java code on an x86_64 Android 15 AVD.
The production APK is ARM64, so x86_64 requires a build of the same sources
with only native architecture/codec changed. Run-time assertions use Android
logcat and the app's real event journal, not source grep.
"""
from pathlib import Path
import re,shlex,subprocess,time,json,sys
APP="app.hitel.callflowlab.v14.systempicker"
SERVICE=APP+"/app.hitel.samsungprobe.SpeakerService"
START="app.hitel.samsungprobe.START"
STOP="app.hitel.samsungprobe.STOP"
OUTPUT=Path("/tmp/hitel14-v28-emulator")
OUTPUT.mkdir(exist_ok=True)
def call(*cmd,timeout=100,check=True):
    p=subprocess.run(cmd,text=True,encoding="utf-8",errors="replace",capture_output=True,timeout=timeout)
    data=p.stdout+"\n"+p.stderr
    if check and p.returncode:raise RuntimeError(f"{' '.join(cmd)} rc={p.returncode}: {data[-1500:]}")
    return data
def adb(*args,**opts):return call("adb",*args,**opts)
def own(*args,check=True):
    # run-as changes caller UID, so Android permits starting non-exported service.
    return adb("shell","run-as",APP,*args,check=check)
def own_cmd(cmd,check=True):
    return adb("shell","run-as "+shlex.quote(APP)+" sh -c "+shlex.quote(cmd),check=check)
def dump(stage):
    s=adb("logcat","-d","-v","time",timeout=60)
    (OUTPUT/(stage+".logcat")).write_text(s)
    return s
def wait_event(event,timeout=30):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        s=adb("logcat","-d","-s","GrowingM4aDiag:I","*:S",timeout=30)
        rows=[x for x in s.splitlines() if event in x]
        if rows:
            print("ANDROID_LOG_EVENT",event,rows[-1][-350:],flush=True)
            return rows[-1]
        time.sleep(1)
    dump("missing-"+event)
    raise AssertionError("NOT_SEEN_IN_EMULATOR_LOGCAT "+event)
def invoke(uri,folder,mode=-2):
    r=own("am","start-foreground-service","--user","0","-n",SERVICE,
          "-a",START,"--es","uri",uri,"--ez","folder",str(folder).lower(),
          "--ei","deviceId",str(mode),check=False)
    print("START_SERVICE",r.strip()[:700],flush=True)
    if "Error:" in r or "Exception" in r:
        raise AssertionError("Android rejected actual V28 service START: "+r)
def stop():
    print("STOP_SERVICE",own("am","start-service","--user","0","-n",SERVICE,"-a",STOP,check=False),flush=True)

print("ANDROID15_DEVICE",adb("shell","getprop","ro.build.version.sdk").strip(),flush=True)
print("ANDROID15_ABI",adb("shell","getprop","ro.product.cpu.abi").strip(),flush=True)
assert "35" in adb("shell","getprop","ro.build.version.sdk")
assert "x86_64" in adb("shell","getprop","ro.product.cpu.abi")
apk=Path("AndroidProject/app/build/outputs/apk/debug/app-debug.apk")
assert apk.stat().st_size>10000000,apk
# Best-effort: exact production APK would be incompatible if ARM64-only.
production=Path("downloads/HITEL14_V28_AutoCall_MediaRoute_3STT.apk")
if production.is_file():
    res=adb("install","-r",str(production),timeout=150,check=False)
    (OUTPUT/"original-arm64-install-attempt.txt").write_text(res)
    print("PRODUCTION_APK_INSTALL_ATTEMPT",res.strip()[:900],flush=True)
r=adb("install","-r",str(apk),timeout=150)
print("EMULATOR_X86_EQUIVALENT_APK_INSTALL",r.strip(),flush=True)
assert "Success" in r
for permission in ("android.permission.READ_PHONE_STATE","android.permission.RECORD_AUDIO","android.permission.BLUETOOTH_CONNECT"):
    print("GRANT",permission,adb("shell","pm","grant",APP,permission,check=False).strip(),flush=True)
start=adb("shell","am","start","-W","-n",APP+"/app.hitel.samsungprobe.W03ConsoleActivity",check=False)
print("ACTIVITY_START",start[-800:],flush=True)
time.sleep(5)
pid=adb("shell","pidof",APP,check=False).strip()
assert pid, "V28 W03 activity failed to stay running"
with (OUTPUT/"w03-screen.png").open("wb") as out:
    subprocess.run(["adb","exec-out","screencap","-p"],stdout=out,check=True,timeout=45)
assert (OUTPUT/"w03-screen.png").stat().st_size>6000
adb("shell","uiautomator","dump","/sdcard/v28-w03.xml",timeout=80)
(OUTPUT/"w03-screen.xml").write_text(adb("shell","cat","/sdcard/v28-w03.xml"))
print("PASS_V28_EMULATOR_INSTALL_START_SCREENSHOT",pid,flush=True)
adb("logcat","-c")
# Synthetic tone validates AAC packet decode and actual PCM AudioTrack without
# inaccurately claiming Korean ASR or Samsung telephony was exercised.
m4a=Path("/tmp/hitel14-v28-test.m4a")
assert m4a.stat().st_size>10000, m4a
adb("push",str(m4a),"/data/local/tmp/hitel14-v28-test.m4a")
own("mkdir","-p","files")
own("cp","/data/local/tmp/hitel14-v28-test.m4a","files/hitel14-v28-test.m4a")
file_uri=f"file:///data/user/0/{APP}/files/hitel14-v28-test.m4a"
invoke(file_uri,False)
wait_event("MANUAL_DIAGNOSTIC_SESSION_STARTED",25)
wait_event("SPEAKER_TRACK_STARTED",50)
wait_event("PLAYBACK_PROGRESS",25)
playback=dump("manual-media-pcm")
assert "USAGE_MEDIA" in playback and "ALLOW_CAPTURE_BY_ALL" in playback
print("PASS_V28_EMULATOR_AAC_TO_PCM_USAGEMEDIA_AUDIOTRACK",flush=True)
# Switch from an actively playing source to call-folder monitoring.
folder_uri="content://com.android.externalstorage.documents/tree/primary%3ARecordings%2FCall"
invoke(folder_uri,True)
wait_event("SOURCE_SWITCH_REQUESTED",15)
wait_event("SOURCE_SWITCH_APPLY",35)
wait_event("AUTO_CALL_MONITOR_ARMED",30)
print("PASS_V28_EMULATOR_ACTIVE_SOURCE_TO_AUTO_FOLDER_SWITCH",flush=True)
# Real emulator modem events. No claim of Samsung proprietary recorder.
adb("logcat","-c")
number="5551231234"
ring=adb("emu","gsm","call",number,check=False)
print("GSM_RING",ring.strip(),flush=True)
if "KO" in ring or "ERROR" in ring.upper():raise AssertionError("GSM call failed: "+ring)
wait_event("PHONE_STATE",20)
accepted=adb("emu","gsm","accept",number,check=False)
print("GSM_ACCEPT",accepted.strip(),flush=True)
if "KO" in accepted or "ERROR" in accepted.upper():raise AssertionError("GSM accept failed: "+accepted)
wait_event("CALL_OFFHOOK_BEGIN_LIVE_RECORDING_VALIDATION",25)
before=dump("emulated-gsm-offhook")
adb("logcat","-c")
hang=adb("emu","gsm","cancel",number,check=False)
print("GSM_END",hang.strip(),flush=True)
if "KO" in hang or "ERROR" in hang.upper():raise AssertionError("GSM end failed: "+hang)
wait_event("CALL_IDLE_STOP_OUTPUT",25)
dump("emulated-gsm-idle")
print("PASS_V28_EMULATOR_REAL_TELEPHONY_OFFHOOK_IDLE",flush=True)
stop()
time.sleep(3)
full=dump("all-completed")
assert not re.search(r"FATAL EXCEPTION:[\s\S]{0,800}Process: "+re.escape(APP),full),    "HITEL fatal exception in Android runtime"
# Query the actual persisted session journal from app-private data.
files=own_cmd(f"find /data/user/0/{APP}/files/diagnostics -name events.jsonl",check=False)
(OUTPUT/"journal-files.txt").write_text(files)
print("JOURNAL_PATHS",files[-900:],flush=True)
summary={"android_sdk":35,"emulator_abi":"x86_64",
         "production_apk":"arm64-v8a production APK; emulator rebuild x86_64",
         "apk_install":True,"ui_process":True,"screenshot":True,
         "manual_pcm_audiotrack":True,"in_call_source_switch":True,
         "emulated_modem_offhook_idle":True,
         "samsung_original_phone_recorder":"NOT_AVAILABLE_ON_EMULATOR",
         "bluetooth_hardware":"NOT_AVAILABLE_ON_EMULATOR",
         "korean_speech_recognition":"NOT_TESTED_WITH_TONE_FIXTURE"}
(OUTPUT/"verification.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print("PASS_V28_EMULATOR_RUNTIME_SMOKE_ALL_ASSERTED_CHECKS",flush=True)
