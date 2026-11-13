#!/usr/bin/env python3
"""Real Android 15 x86_64: original Korean model speech artificially slowed 2.5x -> AAC/M4A ->
original persistent MediaCodec 16 kHz PCM -> BOTH original AudioTrack + DIRECT
Sherpa ASR. Neither fabricated transcripts nor MediaProjection required.

V31 user's Samsung SM-F711N log: LIVE_M4A_CONFIRMED_GROWING,
FIRST_16KHZ_PCM_READY, AudioTrack played 76 sec and playback RMS positive,
but -2 mode silently skipped direct ASR. This tests exactly that regression.
"""
import json, pathlib, re, shlex, subprocess, time, xml.etree.ElementTree as ET
APP="app.hitel.callflowlab.v33.dualrate"
SERVICE=APP+"/app.hitel.samsungprobe.SpeakerService"
ACTIVITY=APP+"/app.hitel.samsungprobe.W03ConsoleActivity"
OUT=pathlib.Path("/tmp/v33-dualrate-pcm-asr")
OUT.mkdir(parents=True,exist_ok=True)
MODEL_DIR=pathlib.Path("/tmp/hitel-korean-model")
MODEL=("encoder-epoch-99-avg-1.int8.onnx","decoder-epoch-99-avg-1.onnx",
       "joiner-epoch-99-avg-1.int8.onnx","tokens.txt")

def run(*cmd,timeout=90,check=True):
    p=subprocess.run([str(x) for x in cmd],encoding="utf-8",errors="replace",
                     text=True,capture_output=True,timeout=timeout)
    text=p.stdout+"\n"+p.stderr
    if check and p.returncode:
        raise AssertionError("PROCESS_FAILED "+repr(cmd)+" rc="+str(p.returncode)+" "+text[-1600:])
    return text.strip()
def adb(*a,**k):return run("adb",*a,**k)
def own(*a,**k):return adb("shell","run-as",APP,*a,**k)
def own_shell(cmd):return adb("shell","run-as "+shlex.quote(APP)+" sh -c "+shlex.quote(cmd))
def logcat(tag="GrowingM4aDiag"):
    return adb("logcat","-d","-s",tag+":I","HITEL-SPEAKER-DIAG:I","*:S",timeout=60)
def save(stage):
    s=adb("logcat","-d","-v","time",timeout=60)
    (OUT/(stage+".logcat")).write_text(s,encoding="utf-8")
    return s
def wait_event(word,seconds):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        s=logcat()
        if word in s:
            line=[l for l in s.splitlines() if word in l][-1]
            print("OBSERVED_EVENT",word,line[-480:],flush=True)
            return True
        time.sleep(1)
    save("missing-"+re.sub(r"\W+","-",word)[:30])
    raise AssertionError("V33_MISSING_RUNTIME_EVENT "+word)

print("V33_EMULATOR",adb("shell","getprop","ro.build.version.sdk"),
      adb("shell","getprop","ro.product.cpu.abi"),flush=True)
assert adb("shell","getprop","ro.build.version.sdk").strip()=="35"
assert adb("shell","getprop","ro.product.cpu.abi").strip()=="x86_64"
apk=pathlib.Path("AndroidProject/app/build/outputs/apk/debug/app-debug.apk")
assert apk.stat().st_size>10000000
assert "Success" in adb("install","-r",str(apk),timeout=180)
# Only this isolated regression focuses on audio engine; the separate
# V31 permission-onboarding CI verifies real permission dialogs.
for perm in ("android.permission.READ_PHONE_STATE","android.permission.RECORD_AUDIO"):
    adb("shell","pm","grant",APP,perm)
# Korean 145 MB model preloaded to eliminate network from audio test.
assert all((MODEL_DIR/f).stat().st_size>50000 for f in MODEL)
own("mkdir","-p","files/sherpa-ko-v1")
for name in MODEL:
    adb("push",str(MODEL_DIR/name),"/data/local/tmp/v33-"+name,timeout=240)
    own("cp","/data/local/tmp/v33-"+name,"files/sherpa-ko-v1/"+name,timeout=150)
    print("ORIGINAL_MODEL_PRELOADED",name,flush=True)
fixture=pathlib.Path("/tmp/hitel-ko-speech-repeat.m4a")
assert fixture.stat().st_size>50000
adb("push",str(fixture),"/data/local/tmp/v33-speech.m4a",timeout=150)
own("cp","/data/local/tmp/v33-speech.m4a","files/v33-speech.m4a",timeout=80)
uri="file:///data/user/0/"+APP+"/files/v33-speech.m4a"
activity=adb("shell","am","start","-W","-n",ACTIVITY,timeout=90)
print("V33_ACTIVITY_STARTED",activity[-550:],flush=True)
time.sleep(3)
adb("logcat","-c")
r=own("am","start-foreground-service","--user","0","-n",SERVICE,
      "-a","app.hitel.samsungprobe.START","--es","uri",uri,
      "--ez","folder","false","--ei","deviceId","-2",check=False)
print("V33_SAME_USER_MEDIA_MODE_MINUS2",r[-800:],flush=True)
assert "Error:" not in r and "Exception" not in r
wait_event("DIRECT_SHERPA_READY",100)
wait_event("DIRECT_DUAL_RATE25_DIAGNOSTIC_READY",30)
wait_event("SPEAKER_TRACK_STARTED",65)
wait_event("PLAYBACK_PROGRESS",40)
# ASR must make a nonempty actual recognition, not merely log model readiness.
end=time.monotonic()+130
found=[]
while time.monotonic()<end:
    s=logcat()
    found=[line for line in s.splitlines()
           if ("DIRECT_ASR_RATE25_PARTIAL" in line or "DIRECT_ASR_RATE25_FINAL" in line)
           and ("text=" in line or '"text"' in line)]
    if found:
        print("V33_REAL_KOREAN_RECOGNIZER_OUTPUT",found[-1][-650:],flush=True)
        break
    if "SESSION_END" in s:
        break
    time.sleep(2)
full=save("v33-korean-asr-result")
det=logcat()
asr_partial=re.findall(r"DIRECT_ASR_RATE25_PARTIAL[^\n]{0,600}",det)
asr_final=re.findall(r"DIRECT_ASR_RATE25_FINAL[^\n]{0,600}",det)
progress=re.findall(r"DIRECT_PCM_PROGRESS[^\n]{0,600}",det)
result={
    "android":35,"abi":"x86_64","appId":APP,
    "real_pcm_speaker_track":"SPEAKER_TRACK_STARTED" in det,
    "real_media_playback":"PLAYBACK_PROGRESS" in det,
    "direct_sherpa_initialized":"DIRECT_SHERPA_READY" in det,
    "direct_pcm_progress":len(progress),
    "real_asr_partial":asr_partial[-6:],
    "real_asr_final":asr_final[-4:],
    "real_cellular_call_audio":False,
    "korean_fixture":"official sherpa zipformer test_wavs/0.wav slowed 2.5x and encoded to AAC M4A (not real call audio)"
}
(OUT/"v33-audio-text-verdict.json").write_text(
    json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print("V33_REAL_DECODE_AND_ASR_VERDICT",json.dumps(result,ensure_ascii=False),flush=True)
assert result["real_pcm_speaker_track"] and result["real_media_playback"],\
       "V33_MEDIA_AUDIOTRACK_PLAYBACK_REGRESSED"
assert result["direct_sherpa_initialized"],"V33_DIRECT_MODEL_INIT_MISSING"
assert asr_partial or asr_final, "V33_SLOW_KOREAN_SPEECH_NO_CORRECTED_ASR_TEXT"
# Actual on-screen W03 TextView is required, not only logcat recognition.
ui_found=False
for sweep in range(12):
    adb("shell","uiautomator","dump","/sdcard/v33-subtitle.xml",timeout=60,check=False)
    xml=adb("shell","cat","/sdcard/v33-subtitle.xml",timeout=45,check=False)
    (OUT/f"w03-subtitle-scroll-{sweep}.xml").write_text(xml,encoding="utf-8")
    if "PCM 직접 인식 중:" in xml and ("걔는" in xml or "괜찮" in xml):
        print("PASS_V33_REAL_W03_TEXTVIEW_KOREAN_SUBTITLE",sweep,flush=True)
        with (OUT/"v33-w03-subtitle.png").open("wb") as shot:
            subprocess.run(["adb","exec-out","screencap","-p"],
                           stdout=shot,timeout=45,check=True)
        ui_found=True
        break
    adb("shell","input","swipe","510","1700","510","620","390",check=False)
    time.sleep(0.75)
result["actual_w03_textview_subtitle"]=ui_found
(OUT/"v33-audio-text-verdict.json").write_text(
    json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
assert ui_found,"V33_RUNTIME_STT_TEXT_NOT_VISIBLE_IN_REAL_W03_UI"
print("PASS_V33_REAL_KOREAN_M4A_PCM_TO_AUDIOTRACK_AND_DIRECT_ASR",flush=True)
