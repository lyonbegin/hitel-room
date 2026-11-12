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
    for step in range(22):
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
                tap_node(n)
                selected_app=True
                print("ANDROID_SYSTEM_SINGLE_APP_SELECTED",name,flush=True)
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
    r=own("am","start-service","-n",OUTPUT,"-a",
        "app.hitel.callflowlab.v14.SPEAKER_STOP",check=False)
    print("STOP_CAPTURE",r[-350:],flush=True)
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

print("EMULATOR_SDK",adb("shell","getprop","ro.build.version.sdk"),flush=True)
print("EMULATOR_ABI",adb("shell","getprop","ro.product.cpu.abi"),flush=True)
assert adb("shell","getprop","ro.build.version.sdk").strip()=="35"
assert adb("shell","getprop","ro.product.cpu.abi").strip()=="x86_64"
apk="AndroidProject/app/build/outputs/apk/debug/app-debug.apk"
assert pathlib.Path(apk).stat().st_size>10000000
print("APK_INSTALL",adb("install","-r",apk,timeout=150),flush=True)
for permission in ("android.permission.RECORD_AUDIO",
                   "android.permission.READ_PHONE_STATE",
                   "android.permission.BLUETOOTH_CONNECT"):
    print("PERMISSION",permission,adb("shell","pm","grant",APP,permission,check=False),flush=True)

# Avoid 150MB on-device HF downloads racing the real-time audio playback.
assert all((MODEL_DIR/n).stat().st_size>10000 for n in MODEL)
own("mkdir","-p","files/sherpa-ko-v1")
for name in MODEL:
    adb("push",str(MODEL_DIR/name),"/data/local/tmp/"+name,timeout=150)
    own("cp","/data/local/tmp/"+name,"files/sherpa-ko-v1/"+name,timeout=90)
    print("MODEL_SIDELoad",name,(MODEL_DIR/name).stat().st_size,flush=True)
screenshot("installed-emulator-home")
adb("logcat","-c")
start_capture("local-file","self-app")
play_recorded_file()
end=time.monotonic()+100
recognized=[]
rms=[]
while time.monotonic()<end:
    log,speaker=inspect("local-live")
    finals=re.findall(r"\|\s*SPEAKER_FINAL\s*\|\s*(.+)",speaker)
    partials=re.findall(r"\|\s*SPEAKER_PARTIAL\s*\|\s*(.+)",speaker)
    pos=[m for m in re.findall(r"출력음 RMS=([0-9.]+)",speaker)
         if float(m)>0.001]
    if pos:rms=pos
    if finals or partials:
        recognized=finals or partials
        print("LOCAL_KOREAN_SPEECH_TEXT",recognized[-3:],flush=True)
        break
    time.sleep(3)
log,speaker=inspect("local-result")
local={"media_track":"SPEAKER_TRACK_STARTED" in log,
       "playback_progress":"PLAYBACK_PROGRESS" in log,
       "capture_started":"미디어/게임 출력음 캡처 시작" in speaker,
       "capture_positive_rms":len(rms)>0,
       "asr_final":re.findall(r"\|\s*SPEAKER_FINAL\s*\|\s*(.+)",speaker),
       "asr_partial":re.findall(r"\|\s*SPEAKER_PARTIAL\s*\|\s*(.+)",speaker)}
(OUT/"local-result.json").write_text(json.dumps(local,ensure_ascii=False,indent=2))
print("LOCAL_RESULT_JSON",json.dumps(local,ensure_ascii=False),flush=True)
assert local["media_track"] and local["playback_progress"],"AudioTrack M4A output not proven"
assert local["capture_started"],"MediaProjection did not start"
assert local["capture_positive_rms"],"AudioPlaybackCapture RMS never positive"
assert local["asr_partial"] or local["asr_final"],\
   "KOREAN_ASR_NO_TEXT even though playback and capture succeeded"
print("PASS_LOCAL_M4A_TO_AUDIOTRACK_TO_PROJECTION_TO_KOREAN_STT",flush=True)
stop_capture()
own("am","start-service","--user","0","-n",SPEAKER,
    "-a","app.hitel.samsungprobe.STOP",check=False)
time.sleep(2)
# SECOND PHASE. Do not claim YouTube capture without proving app playback.
youtube=adb("shell","pm","path","com.google.android.youtube",check=False)
print("YOUTUBE_APP_PACKAGE",youtube,flush=True)
if "package:" not in youtube:
    print("YOUTUBE_APP_NOT_PREINSTALLED_ON_EMULATOR_COMPARATOR_NOT_VERIFIED",flush=True)
    (OUT/"youtube-result.json").write_text(json.dumps(
       {"app_present":False,"capture_tested":False,"reason":"YouTube Android app not installed"}))
else:
    print("YOUTUBE_REAL_APP_AVAILABLE",flush=True)
    # Phase 2's video is navigated through the ORIGINAL YouTube application.
    # No invented transcription or sound is accepted as evidence.
    # Reject old STT events from the successful local-file comparison.
    # A fresh logcat is essential: wait_log must see NEW consent/capture events.
    adb("logcat","-c")
    start_capture("youtube-comparator","youtube")
    print("YOUTUBE_NEW_PROJECTION_CAPTURE_VERIFIED",flush=True)
    # Verified real YouTube video featuring spoken Korean. A direct video
    # opens its player instead of an unverified search-results item.
    link="https://www.youtube.com/watch?v=1SGUXxrhq9M"
    def open_youtube_url():
        return adb("shell","am","start","-a","android.intent.action.VIEW",
                   "-d",link,"-p","com.google.android.youtube",check=False)
    print("YOUTUBE_OPEN_RESULTS",open_youtube_url()[-600:],flush=True)
    time.sleep(6)
    # Google APIs images ship YouTube but may show first-run account onboarding.
    # Tapping the REAL "Use without an account" control in YouTube is permitted.
    account_prompt_handled=False
    for step in range(6):
        nodes=uixml("youtube-onboarding-"+str(step))
        found=next((n for n in nodes if n["package"]=="com.google.android.youtube"
             and any(t in n["text"] for t in
                ["Use without an account","계정 없이 사용","Continue as guest",
                 "Not now","나중에","No thanks"])),None)
        if found:
            tap_node(found)
            account_prompt_handled=True
            print("YOUTUBE_ACTUAL_ONBOARDING_TAPPED",found["text"],flush=True)
            time.sleep(4)
            continue
        if any(n["package"]=="com.google.android.youtube"
               and any(k in n["text"].lower() for k in
                    ["home","search","뉴스","videos","추천","구독"]) for n in nodes):
            break
        time.sleep(2)
    print("YOUTUBE_RESULTS_AFTER_ACCOUNT_PROMPT",open_youtube_url()[-600:],flush=True)
    time.sleep(12)
    screenshot("youtube-results")
    nodes=uixml("youtube-results")
    clicked=False
    for node in nodes:
        if (node["package"]=="com.google.android.youtube" and
            any(w in node["text"].lower() for w in
                 ["뉴스","kbs","sbs","mbc","한국","ytn","news"]) and
            not any(k in node["text"].lower() for k in ["search","검색"])):
            tap_node(node)
            clicked=True
            print("YOUTUBE_SEARCH_RESULT_CLICKED",node["text"][:160],flush=True)
            break
    if not clicked:
        print("YOUTUBE_VIDEO_SEARCH_RESULT_NOT_FOUND; DO_NOT_CLAIM_PLAYBACK",flush=True)
    time.sleep(18)
    screenshot("youtube-playback-check")
    media_session=adb("shell","dumpsys","media_session",check=False,timeout=55)
    (OUT/"youtube-media-session.txt").write_text(media_session)
    log,speaker=inspect("youtube-result")
    # Durable speaker log contains prior local-file ASR. Only inspect the
    # LAST post-consent segment to avoid false YouTube recognizer success.
    marker=speaker.rfind("| CONSENT_REQUEST |")
    youtube_log=speaker[marker:] if marker>=0 else ""
    rms_values=[float(x) for x in re.findall(r"출력음 RMS=([0-9.]+)",youtube_log)]
    finals=re.findall(r"\|\s*SPEAKER_FINAL\s*\|\s*(.+)",youtube_log)
    partials=re.findall(r"\|\s*SPEAKER_PARTIAL\s*\|\s*(.+)",youtube_log)
    youtube_result={
        "app_present":True,
        "native_single_app_selection":True,
        "account_prompt_handled":account_prompt_handled,
        "video_tap_attempt":clicked,
        "youtube_media_session_present":"com.google.android.youtube" in media_session,
        "capture_rms":rms_values,
        "positive_capture_rms":any(v>0.001 for v in rms_values),
        "asr_partials":partials,
        "asr_finals":finals,
        "old_local_file_asr_excluded":True
    }
    (OUT/"youtube-result.json").write_text(json.dumps(youtube_result,ensure_ascii=False,indent=2))
    print("YOUTUBE_RESULT_JSON",json.dumps(youtube_result,ensure_ascii=False),flush=True)
    if clicked and youtube_result["positive_capture_rms"] and (partials or finals):
        print("PASS_YOUTUBE_APP_AUDIO_KOREAN_STT",flush=True)
    else:
        print("YOUTUBE_COMPARATOR_UNVERIFIED_DO_NOT_CLAIM_SUCCESS",flush=True)

(OUT/"summary.json").write_text(json.dumps(
    {"local_file":local,
     "youtube_file":str(OUT/"youtube-result.json"),
     "emulator_sdk":35,"emulator_abi":"x86_64",
     "live_phone_streaming":"NOT_TESTED"},
     ensure_ascii=False,indent=2))
print("PASS_CORE_USER_REQUEST_LOCAL_RECORDED_FILE_PLAYBACK_CAPTURE_STT",flush=True)
