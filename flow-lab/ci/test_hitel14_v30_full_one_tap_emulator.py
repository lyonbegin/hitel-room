#!/usr/bin/env python3
"""Android 15 V30 real GUI: SAF -> OS capture consent -> both ready -> DIAL.

Runs after test_hitel14_v29_one_tap_ui.py, with the native SAF picker open.
Models are injected for reproducibility. Emulator GSM is signaling ONLY;
never mislabel synthetic playback as actual telecom RX audio.
"""
import json,re,subprocess,time,xml.etree.ElementTree as ET
from pathlib import Path

APP="app.hitel.callflowlab.v30.onetap"
OUT=Path("/tmp/hitel14-v28-emulator")
OUT.mkdir(exist_ok=True)
MODEL=Path("/tmp/hitel-korean-model")
FILES=("encoder-epoch-99-avg-1.int8.onnx",
       "decoder-epoch-99-avg-1.onnx","joiner-epoch-99-avg-1.int8.onnx","tokens.txt")
TARGET="/data/user/0/"+APP+"/files"

def adb(*args,timeout=55,check=True):
    p=subprocess.run(["adb",*map(str,args)],text=True,capture_output=True,
        encoding="utf-8",errors="replace",timeout=timeout)
    data=(p.stdout+"\n"+p.stderr).strip()
    if check and p.returncode:
        raise AssertionError("ADB "+repr(args)+" "+str(p.returncode)+": "+data[-1300:])
    return data

def screenshot(name):
    path=OUT/(name+".png")
    with path.open("wb") as file:
        subprocess.run(["adb","exec-out","screencap","-p"],
            stdout=file,timeout=50,check=True)
    print("SCREENSHOT",name,path.stat().st_size,flush=True)

def events():
    return adb("logcat","-d","-s","HITEL-SPEAKER-DIAG:I",
               "GrowingM4aDiag:I","*:S",timeout=45,check=False)

def ui(stage):
    result=adb("shell","uiautomator","dump","/sdcard/v30-ui.xml",
               timeout=70,check=False)
    xml=adb("shell","cat","/sdcard/v30-ui.xml",check=False)
    if "<?xml" not in xml:raise RuntimeError("UIXML missing "+result+" "+xml[-500:])
    xml=xml[xml.index("<?xml"):]
    (OUT/(stage+".xml")).write_text(xml,encoding="utf-8")
    root=ET.fromstring(xml)
    nodes=[]
    for n in root.iter("node"):
        a=n.attrib
        nums=[int(x) for x in re.findall(r"\d+",a.get("bounds",""))]
        if len(nums)!=4:continue
        nodes.append({"text":a.get("text","").strip(),
                      "desc":a.get("content-desc","").strip(),
                      "package":a.get("package",""),"clickable":a.get("clickable",""),
                      "id":a.get("resource-id",""),"bounds":nums})
    interesting=[f'{x["text"][:35]!r} desc={x["desc"][:32]!r} '
                 f'id={x["id"].split("/")[-1]} click={x["clickable"]}'
                 for x in nodes if x["text"] or x["desc"]]
    print("UI",stage," | ".join(interesting[:42]),flush=True)
    return nodes

def tap(n,why):
    a,b,c,d=n["bounds"]
    x=(a+c)//2;y=(b+d)//2
    print("TAP",why,(x,y),"text",n["text"],"desc",n["desc"],flush=True)
    adb("shell","input","tap",str(x),str(y))
    time.sleep(1.7)

def pick(nodes,terms,exact=False):
    for term in terms:
        for n in nodes:
            v=(n["text"]+" "+n["desc"]).casefold()
            if (n["text"].casefold()==term.casefold() or
                n["desc"].casefold()==term.casefold()) if exact else term.casefold() in v:
                if n["bounds"][2]>n["bounds"][0] and n["bounds"][3]>n["bounds"][1]:
                    return n
    return None

print("V30_FULL_ONE_TAP_START",flush=True)
# Input fixture is a pinned public Korean recognition model already downloaded
# by this CI, not a stand-in for a cellular voice call.
assert all((MODEL/n).stat().st_size>50000 for n in FILES),"PINNED_STT_MODEL_MISSING"
adb("shell","run-as",APP,"mkdir","-p","files/sherpa-ko-v1")
for name in FILES:
    adb("push",str(MODEL/name),"/data/local/tmp/v30-"+name,timeout=220)
    adb("shell","run-as",APP,"cp","/data/local/tmp/v30-"+name,
        "files/sherpa-ko-v1/"+name,timeout=120)
    print("STT_MODEL_PRELOADED",name,(MODEL/name).stat().st_size,flush=True)
adb("shell","mkdir","-p","/sdcard/Recordings/Call")
# Picker was launched by a real UI tap in the previous test.
seen_root=False
selected_folder=False
for step in range(45):
    log=events()
    if "ONE_TAP_WAIT_PROJECTION_CONSENT" in log:
        selected_folder=True
        print("PASS_V30_REAL_SAF_FOLDER_RESULT_AND_PERMISSION_CONTINUATION",flush=True)
        break
    nodes=ui("saf-stage-"+str(step))
    if pick(nodes,("Use this folder","이 폴더 사용","Use folder")):
        tap(pick(nodes,("Use this folder","이 폴더 사용","Use folder")),"SAF_USE_THIS_FOLDER")
        continue
    if pick(nodes,("Allow","허용"),exact=True):
        tap(pick(nodes,("Allow","허용"),exact=True),"SAF_GRANT_PERSISTABLE_ACCESS")
        continue
    if pick(nodes,("Call",),exact=True):
        tap(pick(nodes,("Call",),exact=True),"SAF_CALL_FOLDER")
        continue
    if pick(nodes,("Recordings",),exact=True):
        tap(pick(nodes,("Recordings",),exact=True),"SAF_RECORDINGS")
        continue
    if pick(nodes,("Internal storage","내부 저장소","sdk_gphone64_x86_64",
                   "Pixel","emulated")):
        tap(pick(nodes,("Internal storage","내부 저장소","sdk_gphone64_x86_64",
                        "Pixel","emulated")),"SAF_STORAGE_ROOT")
        seen_root=True
        continue
    nav=pick(nodes,("Show roots","Show navigation drawer","메뉴 열기","탐색 메뉴"))
    if nav and not seen_root:
        tap(nav,"SAF_OPEN_NAVIGATION_DRAWER")
        continue
    if step%4==0:
        adb("shell","input","swipe","520","1650","520","720","350")
    time.sleep(1)
if not selected_folder:
    screenshot("V30-SAF-NOT-COMPLETED")
    (OUT/"v30-saf-failure.log").write_text(events(),encoding="utf-8")
    raise AssertionError("V30_REAL_SAF_FOLDER_SELECTION_NOT_COMPLETED")

# Consent: choose entire screen, never pretend an Android MediaProjection token
# can be accepted without the OS dialog.
entire=False
started=False
for step in range(32):
    log=events()
    if "ONE_TAP_WAIT_BOTH_READY" in log or "CAPTURE_SERVICE_START" in log:
        print("V30_CAPTURE_CONSENT_RETURNED",flush=True)
        break
    nodes=ui("projection-stage-"+str(step))
    n=pick(nodes,("Entire screen","전체 화면","화면 전체"),exact=True)
    if n:
        tap(n,"OS_ENTIRE_SCREEN")
        entire=True
        continue
    n=pick(nodes,("A single app","앱 하나","단일 앱"),exact=True)
    if n and not entire:
        tap(n,"OS_CHANGE_CAPTURE_SCOPE")
        continue
    n=pick(nodes,("Start now","Start sharing","지금 시작","공유 시작",
                  "Start","시작"),exact=True)
    if n:
        tap(n,"OS_START_SCREEN_CAPTURE")
        started=True
        continue
    time.sleep(1)
else:
    screenshot("V30-PROJECTION-DIALOG-NOT-APPROVED")
    raise AssertionError("V30_SYSTEM_PROJECTION_APPROVAL_NOT_COMPLETED")

# Real ready is sent ONLY after AudioRecord.startRecording() succeeded and
# the original CallStateGate/recording-folder service is armed.
deadline=time.monotonic()+180
while time.monotonic()<deadline:
    log=events()
    if "ONE_TAP_CAPTURE_FAILED" in log:
        raise AssertionError("V30_REAL_PLAYBACK_CAPTURE_FAILED "+log[-1300:])
    if "ONE_TAP_BOTH_ACTUALLY_READY" in log and "ONE_TAP_DIALER_OPENED" in log:
        print("PASS_V30_CAPTURE_AUDI0_RECORD_AND_CALL_MONITOR_VERIFIED_BEFORE_DIAL",flush=True)
        break
    time.sleep(2)
else:
    (OUT/"v30-no-dialer-events.log").write_text(events(),encoding="utf-8")
    screenshot("V30-WAITING-FOR-CAPTURE-READY")
    raise AssertionError("V30_READY_GATES_DID_NOT_LAUNCH_DIALER")

log=events()
for marker in ["ONE_TAP_START_REQUEST","ONE_TAP_SAF_READY",
               "ONE_TAP_WAIT_PROJECTION_CONSENT","ONE_TAP_CAPTURE_AUDIO_RECORDING",
               "ONE_TAP_CALL_MONITOR_ARMED","ONE_TAP_BOTH_ACTUALLY_READY",
               "ONE_TAP_DIALER_OPENED"]:
    assert marker in log, "MISSING_ONE_TAP_STAGE "+marker
activity=adb("shell","dumpsys","activity","activities",timeout=45)
(OUT/"v30-after-dialer-dumpsys.txt").write_text(activity,encoding="utf-8")
screenshot("V30-DIALER-AFTER-VERIFIED-CAPTURE")
# GSM emulator event is explicitly not carrier audio; only the CallStateGate.
phone="5551231234"
print("GSM_INCOMING_SIMULATION",adb("emu","gsm","call",phone,check=False),flush=True)
time.sleep(2)
print("GSM_ACCEPT_SIMULATION",adb("emu","gsm","accept",phone,check=False),flush=True)
time.sleep(5)
assert "PIPELINE_OFFHOOK" in events(),"OFFHOOK_PHONE_GATE_NOT_OBSERVED"
print("GSM_END_SIMULATION",adb("emu","gsm","cancel",phone,check=False),flush=True)
time.sleep(4)
assert "PIPELINE_CALL_IDLE" in events(),"IDLE_PHONE_GATE_NOT_OBSERVED"
log=events()
(OUT/"v30-end-to-end-stage-events.log").write_text(log,encoding="utf-8")
verdict={
 "real_native_folder_picker":True,
 "real_saf_permission_return":True,
 "real_android_system_capture_consent":True,
 "original_asr_model_preloaded":True,
 "real_audio_capture_started":True,
 "call_monitor_ready":True,
 "real_default_dialer_started_after_two_ready_signals":True,
 "emulator_gsm_offhook_idle":True,
 "real_cellular_voice_captured":False,
 "samsung_proprietary_m4a_produced":False,
 "actual_handset_result":"NOT_TESTED"}
(OUT/"v30-full-one-tap-verdict.json").write_text(json.dumps(verdict,ensure_ascii=False,indent=2))
print("PASS_V30_REAL_ANDROID_GUI_FULL_ONE_TAP_AND_GSM_SIGNALING",flush=True)
