#!/usr/bin/env python3
"""REAL Android 15 emulator: known Korean WAV -> AAC/M4A file -> HITEL AudioTrack
-> Android MediaProjection AudioPlaybackCapture -> existing Korean SpeakerPlaybackStt.
Then attempt an independent native YouTube-app comparison. Do not fake STT text.
"""
import json
import pathlib
import re
import shlex
import subprocess
import time
import xml.etree.ElementTree as ET

APP="app.hitel.callflowlab.v14.systempicker"
ACTIVITY=APP+"/app.hitel.samsungprobe.W03ConsoleActivity"
SPEAKER=APP+"/app.hitel.samsungprobe.SpeakerService"
OUTPUT=APP+"/app.hitel.samsungprobe.SpeakerPlaybackCaptureService"
OUT=pathlib.Path("/tmp/v28-capture-comparison")
OUT.mkdir(exist_ok=True)
MODEL_DIR=pathlib.Path("/tmp/hitel-korean-model")
MODEL=("encoder-epoch-99-avg-1.int8.onnx", "decoder-epoch-99-avg-1.onnx",
       "joiner-epoch-99-avg-1.int8.onnx", "tokens.txt")
def run(*cmd,timeout=90,check=True):
    try:
        p=subprocess.run([str(x) for x in cmd],stdout=subprocess.PIPE,
           stderr=subprocess.STDOUT,encoding="utf-8",errors="replace",timeout=timeout)
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f"TIMEOUT {cmd}: {e}")
    if p.returncode and check:
        raise RuntimeError(f"ERROR {cmd} code {p.returncode}: {p.stdout[-1400:]}")
    return p.stdout.strip()
def adb(*args,**kwargs):
    return run("adb",*args,**kwargs)
def own(*args,**kwargs):
    return adb("shell","run-as",APP,*args,**kwargs)
def own_shell(command,check=True):
    return adb("shell","run-as "+shlex.quote(APP)+" sh -c "+shlex.quote(command),check=check)
def inspect(stage):
    log=adb("logcat","-d","-v","time",timeout=45)
    (OUT/(stage+".logcat")).write_text(log)
    speaker=own_shell(f"cat /data/user/0/{APP}/files/speaker-capture-events.log",check=False)
    (OUT/(stage+".capture-events.log")).write_text(speaker)
    return log,speaker
def uixml(label):
    # The Android SYSTEM UI is operated by ADB, NEVER bypassed.
    r=adb("shell","uiautomator","dump","/sdcard/v28-capture-ui.xml",timeout=40,check=False)
    xml=adb("shell","cat","/sdcard/v28-capture-ui.xml",timeout=35)
    (OUT/(label+".xml")).write_text(xml)
    try: root=ET.fromstring(xml)
    except ET.ParseError: return []
    result=[]
    for node in root.iter("node"):
        text=((node.get("text")or"")+" "+(node.get("content-desc")or"")).strip()
        bounds=[int(n) for n in re.findall(r"\d+",node.get("bounds",""))]
        if text and len(bounds)==4:
            result.append({"text":text,"bounds":bounds,
                           "clickable":node.get("clickable"),"package":node.get("package")})
    print("UI",label,"; ".join(n["text"][:90] for n in result[:50]),flush=True)
    # The Play Store AVD sometimes presents a Pixel Launcher ANR OVER HITEL14.
    # Dismiss only that OS-level blocker; never alter HITEL14 or grant consent.
    if any("Pixel Launcher isn't responding" in n["text"] for n in result):
        close=next((n for n in result if n["text"]=="Close app"),None)
        if close:
            print("EMULATOR_SYSTEM_LAUNCHER_ANR_DISMISS",flush=True)
            x1,y1,x2,y2=close["bounds"]
            adb("shell","input","tap",str((x1+x2)//2),str((y1+y2)//2))
            time.sleep(2)
            return uixml(label+"-after-launcher-anr")
    return result
def tap_node(node):
    x1,y1,x2,y2=node["bounds"]
    print("SYSTEM_UI_TAP",node["text"],(x1+x2)//2,(y1+y2)//2,flush=True)
    adb("shell","input","tap",str((x1+x2)//2),str((y1+y2)//2))
    time.sleep(1)
def screenshot(name):
    path=OUT/(name+".png")
    with path.open("wb") as f:
        subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,check=True,timeout=40)
    print("SCREENSHOT",str(path),path.stat().st_size,flush=True)
def wait_log(needle,seconds=45):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        l=adb("logcat","-d","-s","HITEL-SPEAKER-DIAG:I",
              "GrowingM4aDiag:I","*:S",timeout=35)
        rows=[row for row in l.splitlines() if needle in row]
        if rows:
            print("OBSERVED",needle,rows[-1][-240:],flush=True)
            return rows[-1]
        time.sleep(1)
    inspect("missing-"+re.sub(r"\W+","-",needle)[:35])
    raise AssertionError("MISSING_ANDROID_RUNTIME_EVENT "+needle)
def find_existing_button(word,case,scan_limit=12):
    """Interact with the ORIGINAL HITEL14 W03 UI, scrolling through its native screen."""
    for step in range(scan_limit):
        nodes=uixml("w03-"+case+"-"+str(step))
        choices=[n for n in nodes if word in n["text"] and
                 n["package"]==APP and n["clickable"]=="true"]
        if choices:
            tap_node(choices[0])
            return True
        adb("shell","input","swipe","520","1830","520","610","420")
        time.sleep(.7)
    return False

def start_capture(case="local-file",source="self-app"):
    print("CAPTURE_CASE_EXISTING_V28_W03",case,source,flush=True)
    res=adb("shell","am","start","-W","-n",ACTIVITY,timeout=60)
    print("EXISTING_W03_ACTIVITY",res[-600:],flush=True)
    time.sleep(3)
    screenshot("existing-w03-"+case)
    # Use the real W03 mic/playback tab, NOT an added test harness activity.
    # Session creation is the existing W03 button: clicking it is idempotent.
    start_tab=uixml("w03-tabs-"+case)
    tab=next((n for n in start_tab if "마이크 · 출력음 STT" in n["text"]
        and n["clickable"]=="true"),None)
    if tab:tap_node(tab)
    # The original W03 session is already running upon activity launch; do NOT
    # search the bottom 'new session' button and leave the scroll at the end.
    # This keeps the pre-existing output STT button on the visible screen.
    print("USE_EXISTING_W03_SESSION_WITHOUT_RESTART",flush=True)
    assert find_existing_button("출력음 STT 시작",case+"-capture"),\
        "Existing HITEL14 V28 output STT start button NOT FOUND; no fake harness"
    wait_log("CONSENT_REQUEST",25)
    screenshot("native-projection-consent-"+case)
    # Android's REAL system dialog: default 'A single app', then Start,
    # then system app-picker. Never tap dialog TITLE instead of Start BUTTON.
    selected_source=False
    start_clicked=False
    selected_app=False
    app_tap_attempts=0
    last_app_tap_step=-99
    for step in range(28):
        nodes=uixml("native-consent-"+case+"-"+str(step))
        # Check service activation first, before clicking the next control.
        state=adb("logcat","-d","-s","HITEL-SPEAKER-DIAG:I","*:S",timeout=30)
        if "CAPTURE_SERVICE_START" in state:
            break
        def exact(*words):
            return next((n for w in words for n in nodes
                if n["text"].strip().lower()==w.lower()
                and n["clickable"]=="true"),None)
        def contains(*words):
            return next((n for w in words for n in nodes
                if w.lower() in n["text"].lower()
                and n["clickable"]=="true"),None)
        if source=="screen" and not selected_source:
            n=exact("A single app","단일 앱","앱 하나")
            if n:
                tap_node(n)
                selected_source=True
                continue
            n=exact("Entire screen","전체 화면","화면 전체")
            if n:
                tap_node(n)
                selected_source=True
                continue
        # Start is a distinct clickable node; title starts with
        # 'Start recording...' and MUST NOT be used as the tap target.
        if not start_clicked:
            n=exact("Start","Start now","Start sharing","지금 시작","공유 시작","시작")
            if n:
                tap_node(n)
                start_clicked=True
                continue
        if start_clicked and source!="screen" and not selected_app:
            name="YouTube" if source=="youtube" else "HITEL14"
            # Android 15's system app chooser exposes app names as NON-clickable
            # TextView children within CLICKABLE parent cards. The exact
            # observed HITEL14 TextView bounds were [572,1776][778,1819].
            # Tap the center of that original system card without requiring
            # clickable=true on the label itself.
            n=next((n for n in nodes if name.lower() in n["text"].lower()
                    and n["package"]=="com.android.systemui"
                    and n["bounds"][2]>n["bounds"][0]
                    and n["bounds"][3]>n["bounds"][1]),None)
            if n:
                if not selected_app or step-last_app_tap_step>=3:
                    # Tap the clickable app CARD's icon rather than the
                    # label (a non-clickable child). Actual Android 15 XML:
                    # label [302,1776][508,1819]; parent clickable card
                    # android:id/item [270,1548][540,1894].
                    cx=(n["bounds"][0]+n["bounds"][2])//2
                    label_y=n["bounds"][1]
                    icon_y=max(500,label_y-160)
                    adb("shell","input","tap",str(cx),str(icon_y))
                    print("ANDROID_SYSTEM_CLICKABLE_APP_CARD",name,
                          "iconPoint",cx,icon_y,"attempt",app_tap_attempts+1,flush=True)
                    app_tap_attempts+=1
                    last_app_tap_step=step
                    selected_app=True
                    if app_tap_attempts>=5:
                        raise AssertionError("SYSTEM_APP_PICKER_DID_NOT_RETURN_RESULT after 5 real card taps")
                    time.sleep(2)
                continue
            n=exact("Share","공유","Share this app","이 앱 공유","Start","시작")
            if n:
                tap_node(n)
                continue
            if source=="youtube" and any(
                "Share or record an app" in item["text"] for item in nodes):
                # Real Android 15 picker shows YouTube at the BOTTOM of the
                # vertically scrollable alphabetical app grid; previous test
                # kept scanning its first screen without scrolling.
                adb("shell","input","swipe","530","1840","530","840","450")
                print("NATIVE_SYSTEM_APP_PICKER_SCROLL_TO_YOUTUBE",step,flush=True)
                time.sleep(2)
                continue
        if start_clicked and source=="screen":
            # May present an additional confirmation on Android 15.
            n=exact("Start now","Start sharing","지금 시작")
            if n:tap_node(n);continue
        time.sleep(1)
    try:
        wait_log("CAPTURE_SERVICE_START",25)
    except AssertionError:
        screenshot("native-consent-stuck-"+case)
        inspect("native-consent-error-"+case)
        raise
    wait_log("미디어/게임 출력음 캡처 시작",75)
    screenshot("approved-existing-v28-"+case)
    print("PASS_EXISTING_V28_W03_NATIVE_PROJECTION_CAPTURE_STARTED",case,flush=True)

def stop_capture():
    # CRITICAL: the previous run-as 'am start-service' was blocked by Android 15.
    # Use the ORIGINAL V28 W03 UI's '출력음 STT 중지' button, with the app
    # in the foreground. This is the product's actual stop behavior.
    adb("shell","am","start","-W","-n",ACTIVITY,timeout=50)
    time.sleep(1)
    assert find_existing_button("출력음 STT 중지","real-existing-stop"),        "ORIGINAL_V28_STOP_BUTTON_NOT_FOUND"
    wait_log("사용자 요청: 출력음 STT 중지",25)
    wait_log("출력음 STT 세션 종료",50)
    print("PASS_EXISTING_V28_CAPTURE_SERVICE_STOP_BUTTON",flush=True)
    time.sleep(2)
def play_recorded_file():
    fixture=pathlib.Path("/tmp/hitel-ko-speech-repeat.m4a")
    assert fixture.stat().st_size>50000,fixture
    adb("push",str(fixture),"/data/local/tmp/hitel-ko-speech-repeat.m4a",timeout=120)
    own("mkdir","-p","files")
    own("cp","/data/local/tmp/hitel-ko-speech-repeat.m4a","files/hitel-ko-speech-repeat.m4a")
    uri=f"file:///data/user/0/{APP}/files/hitel-ko-speech-repeat.m4a"
    r=own("am","start-foreground-service","--user","0","-n",SPEAKER,
          "-a","app.hitel.samsungprobe.START","--es","uri",uri,
          "--ez","folder","false","--ei","deviceId","-2",check=False)
    print("PLAY_RECORDING_STARTED",r[-500:],flush=True)
    if "Error:" in r or "Exception" in r:
        raise AssertionError("HITEL playback service rejected test M4A: "+r)
    wait_log("SPEAKER_TRACK_STARTED",45)
    wait_log("PLAYBACK_PROGRESS",35)


# Emulator GSM call-state proof + real existing V28 playback capture STT.
# This is not a GSM CALL AUDIO test: Android Emulator does not support it.
PHONE="5551231234"
print("SIMULATED_GSM_CALL_EXPERIMENT_START",flush=True)
print("SDK",adb("shell","getprop","ro.build.version.sdk"),flush=True)
print("ABI",adb("shell","getprop","ro.product.cpu.abi"),flush=True)
assert adb("shell","getprop","ro.build.version.sdk").strip()=="35"
assert adb("shell","getprop","ro.product.cpu.abi").strip()=="x86_64"
apk=pathlib.Path("AndroidProject/app/build/outputs/apk/debug/app-debug.apk")
assert apk.stat().st_size>10000000
print("INSTALL",adb("install","-r",str(apk),timeout=160),flush=True)
for permission in ("android.permission.RECORD_AUDIO",
                   "android.permission.READ_PHONE_STATE",
                   "android.permission.BLUETOOTH_CONNECT"):
    print("GRANT",permission,adb("shell","pm","grant",APP,permission,check=False),flush=True)
assert all((MODEL_DIR/n).stat().st_size>10000 for n in MODEL)
own("mkdir","-p","files/sherpa-ko-v1")
for item in MODEL:
    adb("push",str(MODEL_DIR/item),"/data/local/tmp/"+item,timeout=150)
    own("cp","/data/local/tmp/"+item,"files/sherpa-ko-v1/"+item,timeout=90)
print("ORIGINAL_KOREAN_ASR_MODEL_READY",flush=True)
adb("logcat","-c")
start_capture("emulated-in-call","self-app")
print("PASS_ORIGINAL_V28_CAPTURE_READY_BEFORE_CALL",flush=True)
r=adb("emu","gsm","call",PHONE,timeout=35,check=False)
print("EMU_GSM_INBOUND",r,flush=True)
assert "OK" in r and "KO" not in r,"GSM inbound did not complete"
# Original V28 registers its PHONE_STATE monitor only after call-folder
# selection on some builds; emulator call signaling must not be gated on that
# app event. Android's real emulator radio is the authoritative call state.
r=adb("emu","gsm","accept",PHONE,timeout=35,check=False)
print("EMU_GSM_ACCEPT",r,flush=True)
assert "OK" in r and "KO" not in r,"GSM answer did not complete"
time.sleep(3)
radio=adb("emu","gsm","list",timeout=35,check=False)
registry=adb("shell","dumpsys","telephony.registry",timeout=50,check=False)
telecom=adb("shell","dumpsys","telecom",timeout=60,check=False)
(OUT/"emulator-radio-call-list.txt").write_text(radio)
(OUT/"emulator-telephony-dumpsys.txt").write_text(registry)
(OUT/"emulator-telecom-dumpsys.txt").write_text(telecom)
print("EMU_GSM_LIST",radio[-900:],flush=True)
print("EMU_REGISTRY_CALL_STATES",
      [line.strip() for line in registry.splitlines()
        if "CallState" in line or "callState" in line][:12],flush=True)
framework_active=("active" in radio.lower() or
  bool(re.search(r"(?:mCallState|callState)\\s*[=:]\\s*2\\b",registry)))
print("FRAMEWORK_GSM_OFFHOOK_ACTIVE",framework_active,flush=True)
# Independently test media playback during the accepted GSM call, even if the
# original V28 call-monitor event is not registered on an unconfigured AVD.

screenshot("during-emulated-call-before-media")
# Release any potential call UI overlay before invoking the existing service.
# Do NOT set app into call-mode artificially; GSM emulator controls Android.
(OUT/"emulated-call-telephony.txt").write_text(
    adb("shell","dumpsys","telephony.registry",check=False,timeout=40))
print("PLAY_SAME_KOREAN_M4A_WHILE_OFFHOOK",flush=True)
play_start_error=None
try:
    play_recorded_file()
except Exception as e:
    play_start_error=str(e)
    print("IN_CALL_PLAYBACK_START_FAILED",play_start_error,flush=True)
captured=[]
speaker_begin=own_shell(
    f"cat /data/user/0/{APP}/files/speaker-capture-events.log",check=False)
last_index=len(speaker_begin)
# Look at post-playback log text only: no before-call false positive.
deadline=time.monotonic()+38
while time.monotonic()<deadline:
    log,speaker=inspect("call-live")
    news=speaker[last_index:] if len(speaker)>=last_index else speaker
    captured=re.findall(r"\|\s*SPEAKER_(?:PARTIAL|FINAL)\s*\|\s*(.+)",news)
    if captured:
        print("EMULATED_CALL_SPEAKER_STT_TEXT",captured[-3:],flush=True)
        break
    time.sleep(2)
log,speaker=inspect("while-call-results")
new_logs=speaker[last_index:] if len(speaker)>=last_index else speaker
new_rms=[float(x) for x in re.findall(r"출력음 RMS=([0-9.]+)",new_logs)]
partial=re.findall(r"\|\s*SPEAKER_PARTIAL\s*\|\s*(.+)",new_logs)
final=re.findall(r"\|\s*SPEAKER_FINAL\s*\|\s*(.+)",new_logs)
telephony_events=[line[-450:] for line in log.splitlines()
  if "CALL_OFFHOOK_BEGIN_LIVE_RECORDING_VALIDATION" in line or
     ("PHONE_STATE" in line and "OFFHOOK" in line)]
route=[line[-600:] for line in log.splitlines()
       if "SPEAKER_TRACK_STARTED" in line or "ACTUAL_OUTPUT_ROUTE" in line]
media=[line[-600:] for line in log.splitlines()
       if "PLAYBACK_PROGRESS" in line or "PCM_PLAYBACK_WRITE" in line]
verdict={
  "actual_emulator_gsm_offhook":framework_active,
  "framework_radio_list":radio[-800:],
  "gsm_media_audio_is_real_cellular_voice":False,
  "same_original_v28_m4a":True,
  "existing_capture_started":True,
  "in_call_playback_started":bool(route),
  "playback_write_events":len(media),
  "in_call_capture_rms_values":new_rms,
  "in_call_capture_positive_rms":any(r>0.001 for r in new_rms),
  "in_call_stt_partial_text":partial,
  "in_call_stt_final_text":final,
  "in_call_play_start_error":play_start_error,
  "phone_events":telephony_events[-3:],
  "audio_routes":route[-3:],
}
(OUT/"emulated-call-v28-verdict.json").write_text(
    json.dumps(verdict,ensure_ascii=False,indent=2))
print("EMULATED_CALL_V28_VERDICT_JSON",json.dumps(verdict,ensure_ascii=False),flush=True)
if partial or final:
    print("PASS_V28_GSM_OFFHOOK_MEDIA_CAPTURE_KOREAN_STT",flush=True)
elif verdict["in_call_playback_started"] and verdict["in_call_capture_positive_rms"]:
    print("FAIL_V28_GSM_OFFHOOK_RECOGNITION_DESPITE_PCM_AND_CAPTURE",flush=True)
elif verdict["in_call_playback_started"]:
    print("FAIL_V28_GSM_OFFHOOK_CAPTURE_SILENCE_DESPITE_AUDIO_TRACK",flush=True)
else:
    print("FAIL_V28_GSM_OFFHOOK_PLAYBACK_START",flush=True)
# Teardown GSM regardless of media/STT verdict; do not leave call active.
end=adb("emu","gsm","cancel",PHONE,check=False,timeout=35)
print("EMU_GSM_HANGUP",end,flush=True)
try: wait_log("CALL_IDLE_STOP_OUTPUT",20)
except Exception as e: print("GSM_IDLE_EVENT_UNVERIFIED",str(e),flush=True)
inspect("after-emulated-call-hangup")
print("PASS_CALL_LIFECYCLE_EMULATOR_EXPERIMENT_RECORDED",flush=True)
