#!/usr/bin/env python3
"""Android 15 V30 real GUI: SAF -> OS capture consent -> both ready -> DIAL.

Runs after test_hitel14_v29_one_tap_ui.py, with the native SAF picker open.
Models are injected for reproducibility. Emulator GSM is signaling ONLY;
never mislabel synthetic playback as actual telecom RX audio.
"""
import json,re,subprocess,time,xml.etree.ElementTree as ET
from pathlib import Path

APP="app.hitel.callflowlab.v32.directasr"
OUT=Path("/tmp/v32-growing-call-e2e")
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
    result=adb("shell","uiautomator","dump","/sdcard/v32-ui.xml",
               timeout=70,check=False)
    xml=adb("shell","cat","/sdcard/v32-ui.xml",check=False)
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

print("V32_FULL_ONE_TAP_START",flush=True)
# Input fixture is a pinned public Korean recognition model already downloaded
# by this CI, not a stand-in for a cellular voice call.
assert all((MODEL/n).stat().st_size>50000 for n in FILES),"PINNED_STT_MODEL_MISSING"
adb("shell","run-as",APP,"mkdir","-p","files/sherpa-ko-v1")
for name in FILES:
    adb("push",str(MODEL/name),"/data/local/tmp/v32-"+name,timeout=220)
    adb("shell","run-as",APP,"cp","/data/local/tmp/v32-"+name,
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
        print("PASS_V32_REAL_SAF_FOLDER_RESULT_AND_PERMISSION_CONTINUATION",flush=True)
        break
    nodes=ui("saf-stage-"+str(step))
    # Navigate INTO Samsung's expected recording folder before requesting
    # permission: Android disallows granting the storage-volume ROOT.
    if pick(nodes,("Allow","허용"),exact=True):
        tap(pick(nodes,("Allow","허용"),exact=True),"SAF_GRANT_PERSISTABLE_ACCESS")
        continue
    # Title rows are selectable folders; BREADCRUMB labels are not. A
    # plain text match would keep tapping the current "Call" breadcrumb.
    call_row=next((n for n in nodes if n["text"].casefold()=="call"
                   and n["id"].endswith("/title")),None)
    recordings_row=next((n for n in nodes if n["text"].casefold()=="recordings"
                         and n["id"].endswith("/title")),None)
    if call_row:
        tap(call_row,"SAF_CALL_FOLDER_ROW")
        continue
    if recordings_row:
        tap(recordings_row,"SAF_RECORDINGS_FOLDER_ROW")
        continue
    # EXACT text matching is essential: the root shows a "Can't use this
    # folder" notice whose substring otherwise looks like a USE button.
    use=pick(nodes,("USE THIS FOLDER","이 폴더 사용"),exact=True)
    if use and use["clickable"]=="true":
        heading=" ".join(n["text"] for n in nodes
                         if "breadcrumb" in n["id"]).casefold()
        if "call" in heading:
            tap(use,"SAF_USE_THIS_RECORDING_FOLDER")
            continue
        print("ROOT_VOLUME_CANNOT_BE_GRANTED; navigate to Recordings/Call",
              heading,flush=True)
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
    (OUT/"v32-saf-failure.log").write_text(events(),encoding="utf-8")
    raise AssertionError("V32_REAL_SAF_FOLDER_SELECTION_NOT_COMPLETED")

# Consent: choose entire screen, never pretend an Android MediaProjection token
# can be accepted without the OS dialog.
entire=False
started=False
for step in range(32):
    log=events()
    if "ONE_TAP_WAIT_BOTH_READY" in log or "CAPTURE_SERVICE_START" in log:
        print("V32_CAPTURE_CONSENT_RETURNED",flush=True)
        break
    nodes=ui("projection-stage-"+str(step))
    n=pick(nodes,("Entire screen","전체 화면","화면 전체"),exact=True)
    if n and not entire:
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
    raise AssertionError("V32_SYSTEM_PROJECTION_APPROVAL_NOT_COMPLETED")

# Real ready is sent ONLY after AudioRecord.startRecording() succeeded and
# the original CallStateGate/recording-folder service is armed.
deadline=time.monotonic()+180
while time.monotonic()<deadline:
    log=events()
    if "ONE_TAP_CAPTURE_FAILED" in log:
        raise AssertionError("V32_REAL_PLAYBACK_CAPTURE_FAILED "+log[-1300:])
    if "ONE_TAP_BOTH_ACTUALLY_READY" in log and "ONE_TAP_DIALER_OPENED" in log:
        print("PASS_V32_CAPTURE_AUDIO_RECORD_AND_CALL_MONITOR_VERIFIED_BEFORE_DIAL",flush=True)
        break
    time.sleep(2)
else:
    (OUT/"v32-no-dialer-events.log").write_text(events(),encoding="utf-8")
    screenshot("V30-WAITING-FOR-CAPTURE-READY")
    raise AssertionError("V32_READY_GATES_DID_NOT_LAUNCH_DIALER")

log=events()
for marker in ["ONE_TAP_START_REQUEST","ONE_TAP_SAF_READY",
               "ONE_TAP_WAIT_PROJECTION_CONSENT","ONE_TAP_CAPTURE_AUDIO_RECORDING",
               "ONE_TAP_CALL_MONITOR_ARMED","ONE_TAP_BOTH_ACTUALLY_READY",
               "ONE_TAP_DIALER_OPENED"]:
    assert marker in log, "MISSING_ONE_TAP_STAGE "+marker
activity=adb("shell","dumpsys","activity","activities",timeout=45)
(OUT/"v32-after-dialer-dumpsys.txt").write_text(activity,encoding="utf-8")
screenshot("V30-DIALER-AFTER-VERIFIED-CAPTURE")
# Simulate a modem call with emulator telephony, but DO NOT fabricate
# carrier RX samples. Its phone state is real emulator signalling only.
# For audio, grow the OFFICIAL Korean speech AAC M4A via file writes in the
# exact chosen /sdcard/Recordings/Call DocumentsProvider folder.
fixture=Path("/tmp/hitel-ko-speech-repeat.m4a")
assert fixture.stat().st_size>150000,"Official Korean test M4A missing"
adb("push",str(fixture),"/data/local/tmp/v32-fixture.m4a",timeout=150)
target="/sdcard/Recordings/Call/HITEL_Korean_EmulatedGrowingRecord.m4a"
adb("shell","rm","-f",target,check=False)
phone="5551231234"
r=adb("emu","gsm","call",phone,check=False)
print("GSM_INCOMING_SIMULATED_SIGNAL_ONLY",r,flush=True)
assert "KO" not in r and "ERROR" not in r.upper(),"GSM_INCOMING_FAILURE "+r
time.sleep(2)
r=adb("emu","gsm","accept",phone,check=False)
print("GSM_ACCEPT_SIMULATED_SIGNAL_ONLY",r,flush=True)
assert "KO" not in r and "ERROR" not in r.upper(),"GSM_ACCEPT_FAILURE "+r
offhook_deadline=time.monotonic()+25
while time.monotonic()<offhook_deadline:
    if "PIPELINE_OFFHOOK" in events():
        print("PASS_V32_REAL_EMULATOR_OFFHOOK_MONITOR",flush=True)
        break
    time.sleep(1)
else:
    (OUT/"v32-offhook-missing.log").write_text(events(),encoding="utf-8")
    raise AssertionError("V32_EMULATOR_OFFHOOK_MISSING")

initial="dd if=/data/local/tmp/v32-fixture.m4a of="+target+" bs=16384 count=2"
print("CREATE_REAL_GROWING_ANDROID_RECORDING",adb("shell","sh","-c",initial),flush=True)
adb("shell","am","broadcast",
    "-a","android.intent.action.MEDIA_SCANNER_SCAN_FILE",
    "-d","file://"+target,check=False)

# Controlled file append simulates an OEM recorder writing a live file.
# Distinguish this fixture from a real Samsung recording throughout.
verified_growth=False
verified_asr=False
asr_events=[]
ui_text_observed=False
activity_brought_forward=False
for i in range(2,130):
    append="dd if=/data/local/tmp/v32-fixture.m4a bs=16384 skip="+str(i)+" count=1 >> "+target
    print("APPEND_GROWING_M4A",i,adb("shell","sh","-c",append,timeout=30,check=False)[-160:],flush=True)
    log=events()
    if "LIVE_M4A_CONFIRMED_GROWING" in log and not verified_growth:
        verified_growth=True
        print("PASS_V32_ACTUAL_SAF_M4A_POSITIVE_GROWTH_CONFIRMED",flush=True)
    if "DIRECT_ASR_PARTIAL" in log or "DIRECT_ASR_FINAL" in log:
        verified_asr=True
        asr_events=[x for x in log.splitlines()
                    if "DIRECT_ASR_PARTIAL" in x or "DIRECT_ASR_FINAL" in x]
        print("PASS_V32_LIVE_GROWING_M4A_REAL_ASR_TEXT",asr_events[-1][-450:],flush=True)
    # Open the ORIGINAL W03 while the PCM stream continues. This validates
    # service BroadcastReceiver -> onPartial/onFinal -> TextView.
    if verified_growth and i>=10 and not activity_brought_forward:
        print("OPEN_EXISTING_W03_WHILE_CALL_ACTIVE",
              adb("shell","am","start","-W","-n",
                  APP+"/app.hitel.samsungprobe.W03ConsoleActivity",timeout=65),flush=True)
        activity_brought_forward=True
        time.sleep(2)
    if activity_brought_forward and i%8==0:
        nodes=ui("w03-live-stt-"+str(i))
        matches=[n["text"] for n in nodes if
                 (n["text"].startswith("PCM 직접 인식 중:") or
                  n["text"].startswith("PCM 확정:"))]
        if matches:
            ui_text_observed=True
            print("PASS_V32_REAL_W03_LIVE_TEXTVIEW_TRANSCRIPT",matches[-2:],flush=True)
            screenshot("V32-W03-LIVE-PCM-SUBTITLE")
            if verified_growth and verified_asr:
                break
        adb("shell","input","swipe","510","1750","510","650","430",check=False)
    if verified_growth and verified_asr and ui_text_observed:
        break
    time.sleep(.38)
else:
    (OUT/"v32-unmet-live-checks.log").write_text(events(),encoding="utf-8")
    screenshot("V32-LIVE-CHECKS-FAILED")
    raise AssertionError("V32_E2E_MISSING_STAGES "+
                         f"M4A_growth={verified_growth} ASR={verified_asr} "
                         f"W03_text={ui_text_observed} offhook=True")

# End the emulated call and require the original worker to flush and stop.
print("EMULATED_GSM_IDLE",adb("emu","gsm","cancel",phone,check=False),flush=True)
end=time.monotonic()+45
while time.monotonic()<end:
    if "PIPELINE_CALL_IDLE" in events():
        print("PASS_V32_LIVE_PHONE_IDLE",flush=True)
        break
    time.sleep(1)
else:
    raise AssertionError("V32_GSM_IDLE_NOT_OBSERVED")
log=events()
(OUT/"v32-e2e-final-events.log").write_text(log,encoding="utf-8")
assert "DIRECT_SHERPA_READY" in log,"Direct recognizer did not initialize"
assert "SPEAKER_TRACK_STARTED" in log,"Original AudioTrack missing"
assert "FIRST_16KHZ_PCM_READY" in log,"AAC→PCM missing"
verdict={
 "android_sdk":35,
 "live_native_first_launch_permission_dialogs":True,
 "real_saf_folder_selected":True,
 "real_system_mediaprojection_consent":True,
 "real_capture_ready_before_native_dialer":True,
 "real_emulator_gsm_offhook_idle":True,
 "synthetically_growing_saf_m4a_detected":verified_growth,
 "real_aac_pcm_decoder":True,
 "original_usagemedia_audiotrack":True,
 "live_growing_pcm_produced_real_sherpa_text":verified_asr,
 "original_w03_ui_textview_updated":ui_text_observed,
 "real_samsung_oem_call_audio":False,
 "real_carrier_downlink_audio":False,
 "physical_samsung_device":"NOT_TESTED",
 "asr_lines":asr_events[-5:]
}
(OUT/"v32-e2e-verdict.json").write_text(
    json.dumps(verdict,ensure_ascii=False,indent=2),encoding="utf-8")
print("PASS_V32_ONE_TAP_CALL_GROWING_M4A_DIRECT_ASR_AND_W03_E2E",flush=True)
