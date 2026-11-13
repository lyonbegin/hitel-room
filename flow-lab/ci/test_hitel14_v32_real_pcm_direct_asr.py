#!/usr/bin/env python3
"""Real Android 15 x86_64: original Korean model speech WAV -> AAC/M4A ->
original persistent MediaCodec 16 kHz PCM -> BOTH original AudioTrack + DIRECT
Sherpa ASR. Neither fabricated transcripts nor MediaProjection required.

V31 user's Samsung SM-F711N log: LIVE_M4A_CONFIRMED_GROWING,
FIRST_16KHZ_PCM_READY, AudioTrack played 76 sec and playback RMS positive,
but -2 mode silently skipped direct ASR. This tests exactly that regression.
"""
import json, pathlib, re, shlex, subprocess, time, xml.etree.ElementTree as ET
APP="app.hitel.callflowlab.v32.directasr"
SERVICE=APP+"/app.hitel.samsungprobe.SpeakerService"
ACTIVITY=APP+"/app.hitel.samsungprobe.W03ConsoleActivity"
OUT=pathlib.Path("/tmp/v32-pcm-direct-asr")
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
    raise AssertionError("V32_MISSING_RUNTIME_EVENT "+word)

print("V32_EMULATOR",adb("shell","getprop","ro.build.version.sdk"),
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
    adb("push",str(MODEL_DIR/name),"/data/local/tmp/v32-"+name,timeout=240)
    own("cp","/data/local/tmp/v32-"+name,"files/sherpa-ko-v1/"+name,timeout=150)
    print("ORIGINAL_MODEL_PRELOADED",name,flush=True)
fixture=pathlib.Path("/tmp/hitel-ko-speech-repeat.m4a")
assert fixture.stat().st_size>50000
adb("push",str(fixture),"/data/local/tmp/v32-speech.m4a",timeout=150)
own("cp","/data/local/tmp/v32-speech.m4a","files/v32-speech.m4a",timeout=80)
uri="file:///data/user/0/"+APP+"/files/v32-speech.m4a"
activity=adb("shell","am","start","-W","-n",ACTIVITY,timeout=90)
print("V32_ACTIVITY_STARTED",activity[-550:],flush=True)
time.sleep(3)
adb("logcat","-c")
r=own("am","start-foreground-service","--user","0","-n",SERVICE,
      "-a","app.hitel.samsungprobe.START","--es","uri",uri,
      "--ez","folder","false","--ei","deviceId","-2",check=False)
print("V32_SAME_USER_MEDIA_MODE_MINUS2",r[-800:],flush=True)
assert "Error:" not in r and "Exception" not in r
wait_event("DIRECT_SHERPA_READY",100)
wait_event("SPEAKER_TRACK_STARTED",65)
wait_event("PLAYBACK_PROGRESS",40)
# ASR must make a nonempty actual recognition, not merely log model readiness.
end=time.monotonic()+130
found=[]
while time.monotonic()<end:
    s=logcat()
    found=[line for line in s.splitlines()
           if ("DIRECT_ASR_PARTIAL" in line or "DIRECT_ASR_FINAL" in line)
           and ("text=" in line or '"text"' in line)]
    if found:
        print("V32_REAL_KOREAN_RECOGNIZER_OUTPUT",found[-1][-650:],flush=True)
        break
    if "SESSION_END" in s:
        break
    time.sleep(2)
full=save("v32-korean-asr-result")
det=logcat()
asr_partial=re.findall(r"DIRECT_ASR_PARTIAL[^\n]{0,600}",det)
asr_final=re.findall(r"DIRECT_ASR_FINAL[^\n]{0,600}",det)
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
    "korean_fixture":"official sherpa zipformer test_wavs/0.wav repeated AAC M4A"
}
(OUT/"v32-audio-text-verdict.json").write_text(
    json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print("V32_REAL_DECODE_AND_ASR_VERDICT",json.dumps(result,ensure_ascii=False),flush=True)
assert result["real_pcm_speaker_track"] and result["real_media_playback"],\
       "V32_MEDIA_AUDIOTRACK_PLAYBACK_REGRESSED"
assert result["direct_sherpa_initialized"],"V32_DIRECT_MODEL_INIT_MISSING"
assert asr_partial or asr_final, "V32_NO_KOREAN_TRANSCRIPT_FROM_REAL_M4A_PCM"
print("PASS_V32_REAL_KOREAN_M4A_PCM_TO_AUDIOTRACK_AND_DIRECT_ASR",flush=True)
