#!/usr/bin/env python3
"""Real Android 15: MediaPlayer public Korean M4A -> AudioPlaybackCapture's AudioRecord
-> unmodified SpeakerPlaybackStt -> exact same Sherpa Korean zipformer model.
DO NOT claim that this tests Samsung private call recording or TELEPHONY RX.
"""
import json,re,time,subprocess,pathlib,xml.etree.ElementTree as ET
APP="app.hitel.callflowlab.v33.dualrate"
ACT=APP+"/app.hitel.samsungprobe.M4aPlaybackCaptureTestActivity"
OUT=pathlib.Path("/tmp/m4a-media-audiorecord-sherpa")
OUT.mkdir(parents=True,exist_ok=True)
MODEL_DIR=pathlib.Path("/tmp/hitel-korean-model")
MODEL=("encoder-epoch-99-avg-1.int8.onnx","decoder-epoch-99-avg-1.onnx",
       "joiner-epoch-99-avg-1.int8.onnx","tokens.txt")
def run(*argv,timeout=100,check=True):
    p=subprocess.run([str(x) for x in argv],capture_output=True,text=True,
                     encoding="utf-8",errors="replace",timeout=timeout)
    if check and p.returncode:raise RuntimeError(
        f"command failed {argv} code={p.returncode} "+(p.stdout+p.stderr)[-1500:])
    return p.stdout+p.stderr
def adb(*args,**kw):return run("adb",*args,**kw)
def own(*a,**k):return adb("shell","run-as",APP,*a,**k)
def logcat():return adb("logcat","-d","-v","time",timeout=65)
def save():
    try:(OUT/"emulator.logcat").write_text(logcat(),encoding="utf-8")
    except Exception as err:print("LOGCAT_CAPTURE_FAILED",repr(err),flush=True)
    try:
        with (OUT/"emulator-final.png").open("wb") as f:
            subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,check=True,timeout=65)
    except Exception as err:print("SCREENSHOT_FAILED",repr(err),flush=True)
    try:(OUT/"speaker-capture-events.log").write_text(own("cat","files/speaker-capture-events.log",check=False),encoding="utf-8")
    except Exception as err:print("SPEAKER_LOG_FAILED",repr(err),flush=True)
def uidump():
    adb("shell","uiautomator","dump","/sdcard/current-consent.xml",timeout=70,check=False)
    return adb("shell","cat","/sdcard/current-consent.xml",timeout=30,check=False)
def controls(xml):
    try:
        root=ET.fromstring(xml[xml.index("<?xml"):])
        return [{"text":(el.attrib.get("text") or ""),"desc":(el.attrib.get("content-desc") or ""),
                 "bounds":el.attrib.get("bounds") or "","class":el.attrib.get("class") or ""}
                for el in root.iter("node")]
    except Exception as e:
        print("XML_PARSE",repr(e),flush=True);return []
def click(n):
    nums=list(map(int,re.findall(r"\d+",n["bounds"])))
    if len(nums)!=4:return False
    x=(nums[0]+nums[2])//2;y=(nums[1]+nums[3])//2
    print("CONSENT_CLICK",n["text"] or n["desc"],"at",x,y,flush=True)
    adb("shell","input","tap",str(x),str(y))
    return True

print("EMULATOR",adb("shell","getprop","ro.build.version.sdk").strip(),
      adb("shell","getprop","ro.product.cpu.abi").strip(),flush=True)
assert adb("shell","getprop","ro.build.version.sdk").strip()=="35"
assert adb("shell","getprop","ro.product.cpu.abi").strip()=="x86_64"
assert "Success" in adb("install","-r",
    "AndroidProject/app/build/outputs/apk/debug/app-debug.apk",timeout=240)
for perm in ("android.permission.RECORD_AUDIO","android.permission.READ_PHONE_STATE"):
    adb("shell","pm","grant",APP,perm)
own("mkdir","-p","files/sherpa-ko-v1")
for name in MODEL:
    src=MODEL_DIR/name
    assert src.is_file() and src.stat().st_size>50_000
    adb("push",src,"/data/local/tmp/mediacap-"+name,timeout=240)
    own("cp","/data/local/tmp/mediacap-"+name,"files/sherpa-ko-v1/"+name,timeout=120)
    print("EXACT_KOREAN_MODEL_PRELOADED",name,flush=True)
src=pathlib.Path("/tmp/public-korean-media.m4a")
assert src.stat().st_size>20_000
adb("push",src,"/data/local/tmp/public-korean-media.m4a")
own("cp","/data/local/tmp/public-korean-media.m4a","files/public-korean-media.m4a")
adb("shell","media","volume","--stream","3","--set","13",check=False)
adb("shell","settings","put","system","screen_off_timeout","600000",check=False)
adb("logcat","-c")
print("ACTIVITY_STARTED",adb("shell","am","start","-W","-n",ACT),flush=True)

try:
    clicked=set()
    for sweep in range(24):
        s=logcat()
        if "CONSENT_RETURN result=-1" in s:
            print("MEDIA_PROJECTION_CONSENT_GRANTED",flush=True)
            break
        xml=uidump()
        (OUT/f"consent-{sweep:02}.xml").write_text(xml,encoding="utf-8")
        nodes=controls(xml)
        important=[n for n in nodes if n["text"] or n["desc"]]
        print("CONSENT_UI",sweep,[(x["text"] or x["desc"])[:55] for x in important][-20:],flush=True)
        # Android API 35: choose entire screen and explicitly approve capture.
        candidates=[n for n in important if any(t in (n["text"]+" "+n["desc"]).lower() for t in
            ("entire screen","full screen","전체 화면","전체 화면 공유"))]
        if candidates and "entire" not in clicked:
            if click(candidates[-1]):clicked.add("entire");time.sleep(1);continue
        candidates=[n for n in important if any(t in (n["text"]+" "+n["desc"]).lower() for t in
            ("start now","지금 시작","start recording","start sharing","공유 시작","시작하기","start share"))]
        if candidates:
            if click(candidates[-1]):time.sleep(2);continue
        time.sleep(1)
    else:
        raise AssertionError("MEDIA_PROJECTION_OS_CONSENT_NOT_COMPLETED")
    # Do not falsely pass merely because Java requested consent. Require actual captured PCM
    # and actual Korean recognition from same pinned model.
    deadline=time.monotonic()+160
    while time.monotonic()<deadline:
        s=logcat()
        if "MEDIA_PLAYER_STARTED" in s and "SPEAKER_PARTIAL" in s:
            print("RUNTIME_CAPTURED_PARTIAL",flush=True);break
        if "MEDIA_PLAYER_FAILED" in s or "출력음 STT 실패" in s:
            print("EARLY_ERROR",*[x[-500:] for x in s.splitlines() if "MEDIA_PLAYER_FAILED" in x or "출력음 STT 실패" in x][-5:],flush=True)
            break
        time.sleep(2)
    s=logcat()
    lines=s.splitlines()
    sample=[x for x in lines if "HITEL-M4A-TEST" in x or "HITEL-SPEAKER-DIAG" in x]
    for ln in sample[-65:]:print("EVIDENCE",ln[-650:],flush=True)
    partials=[x for x in sample if "SPEAKER_PARTIAL" in x or "B_PARTIAL" in x]
    finals=[x for x in sample if "SPEAKER_FINAL" in x or "B_FINAL" in x]
    rms=[float(m.group(1)) for x in sample for m in [re.search(r"RMS=([0-9]+\.[0-9]+)",x)] if m]
    result={"android_sdk":35,"real_emulator":True,
        "sample":"public Sherpa test_wavs/0.wav encoded to AAC M4A, repeated; NO private call file",
        "media_player_started":any("MEDIA_PLAYER_STARTED" in x for x in sample),
        "media_projection_consent":any("CONSENT_RETURN result=-1" in x for x in sample),
        "speaker_recorder_active":any("미디어/게임 출력음 캡처 시작" in x for x in sample),
        "actual_captured_audio_rms":rms,
        "has_nonzero_capture_pcm":any(x>.0005 for x in rms),
        "asr_partial":partials[-12:],"asr_final":finals[-12:],
        "real_call_audio":False}
    (OUT/"verdict.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print("M4A_MEDIA_AUDIORECORD_SHERPA_VERDICT",json.dumps(result,ensure_ascii=False),flush=True)
    assert result["media_player_started"],"REAL_M4A_PLAYBACK_NOT_STARTED"
    assert result["media_projection_consent"],"MEDIA_PROJECTION_CONSENT_NOT_GRANTED"
    assert result["speaker_recorder_active"],"REAL_AUDIORECORD_NOT_STARTED"
    assert result["has_nonzero_capture_pcm"],"ANDROID_AUDIORECORD_PLAYBACK_CAPTURE_SILENT"
    assert partials or finals,"REAL_ANDROID_CAPTURED_KOREAN_M4A_NO_SHERPA_TEXT"
    print("PASS_REAL_ANDROID_MEDIAPLAYER_M4A_TO_AUDIORECORD_TO_SHERPA_KOREAN_TEXT",flush=True)
finally:save()
