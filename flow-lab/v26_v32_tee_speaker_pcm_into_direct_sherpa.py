#!/usr/bin/env python3
"""V32: Critical fix for actual Samsung call log: -2 bypassed direct STT.

V31 real handset (SM-F711N) log proves:
  LIVE_M4A_CONFIRMED_GROWING, FIRST_16KHZ_PCM_READY,
  SPEAKER_TRACK_STARTED, SPEAKER_STATUS RMS>0, but zero STT text.
  VERIFIED_PLAYER_RESTORED sttInsidePlaybackSink=false.

Fix the original PcmDirectSherpaSink in the generated Android source:
  -2 now does BOTH original PcmSpeakerMonitor and original direct Sherpa
  recognizer on the SAME decoded 16-kHz PCM. No acoustic loopback required.
  -1 retains direct-only no-output. All mic, media-projection and native
  M4A/PCM encoder, decoder, AudioTrack source files remain byte-identical.
"""
from pathlib import Path
src=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
sink=src/"PcmDirectSherpaSink.java"
manifest=Path("AndroidProject/app/src/main/AndroidManifest.xml")
gradle=Path("AndroidProject/app/build.gradle.kts")
other_names=[
 "KoreanSherpaStt.java","SpeakerPlaybackStt.java","SpeakerPlaybackCaptureService.java",
 "PcmSpeakerMonitor.java","StreamingAacPcmDecoder.java",
 "SpeakerEngine.java","SpeakerService.java","CallStateGate.java",
 "SpeakerCaptureLog.java","V23FreshLogExport.java","HitelSafLogSaver.java"]
before={n:(src/n).read_bytes() for n in other_names}
def swap(s,a,b,label):
    count=s.count(a)
    if count!=1:raise AssertionError("V32 "+label+" anchor="+str(count)+" "+repr(a[:100]))
    return s.replace(a,b,1)
s=sink.read_text(encoding="utf-8")
s=swap(s,
    '''            log.event("SPEAKER","VERIFIED_PLAYER_RESTORED",
                "usage","USAGE_MEDIA","capturePolicy","ALLOW_CAPTURE_BY_ALL",
                "sttInsidePlaybackSink",false);
            callback.accept("DIRECT_STATUS|삼성 M4A → 16kHz PCM → 원본 미디어 AudioTrack 대기");
            return;
        }
        File modelDir=new File(context.getFilesDir(),"sherpa-ko-v1");''',
    '''            log.event("SPEAKER","VERIFIED_PLAYER_RESTORED",
                "usage","USAGE_MEDIA","capturePolicy","ALLOW_CAPTURE_BY_ALL",
                "sttInsidePlaybackSink",true,"directAsr","initializing");
            callback.accept("DIRECT_STATUS|삼성 M4A → 16kHz PCM → 미디어 스피커 + 한국어 직접 STT 준비");
            // V31 incorrectly returned here, so the live -2 route played
            // audio for 76 seconds but did not initialize the direct ASR.
            // Continue initializing the ORIGINAL Sherpa direct recognizer.
        }
        File modelDir=new File(context.getFilesDir(),"sherpa-ko-v1");''',
    "remove -2 recognizer bypass")
s=swap(s,
    '''            log.event("STT","DIRECT_SHERPA_READY","rate",RATE,"outputAudioTrack",false);
            callback.accept("DIRECT_STATUS|16kHz PCM 직접 STT 준비 완료 · 스피커 재생 없음");''',
    '''            log.event("STT","DIRECT_SHERPA_READY","rate",RATE,
                "outputAudioTrack",mediaOutput!=null,
                "pcmSource","original decoded Samsung growing M4A");
            callback.accept(mediaOutput!=null?
                "DIRECT_STATUS|한국어 직접 STT 준비 완료 · 스피커 재생 병행":
                "DIRECT_STATUS|16kHz PCM 직접 STT 준비 완료 · 스피커 재생 없음");''',
    "log true decoder+asr readiness")
s=swap(s,
    '''        if(mediaOutput!=null){
            mediaOutput.write(littleEndianPcm);
            totalSamples+=littleEndianPcm.length/2;
            return;
        }
        if(stream==null)throw new IllegalStateException("PCM 직접 STT가 종료되었습니다.");''',
    '''        if(mediaOutput!=null){
            // Preserve proven AudioTrack exactly as V31, but do not return:
            // feed the SAME signed PCM to the original direct recognizer.
            mediaOutput.write(littleEndianPcm);
        }
        if(stream==null)throw new IllegalStateException(
            "직접 STT가 생성되지 않았습니다; mediaOutput="+(mediaOutput!=null));''',
    "tee decoded PCM to both")
s=swap(s,
    '''            callback.accept("DIRECT_PARTIAL|"+partial);''',
    '''            log.event("STT","DIRECT_ASR_PARTIAL",
                "text",partial,"pcmSamples",totalSamples,
                "mode",mediaOutput==null?"DIRECT_ONLY":"MEDIA_AND_DIRECT");
            callback.accept("DIRECT_PARTIAL|"+partial);''',
    "durable direct recognition partial")
s=swap(s,
    '''        if(totalSamples>0 && totalSamples%(RATE*10)<samples.length)
            log.event("STT","DIRECT_PCM_PROGRESS","samples",totalSamples,
                "audioSeconds",String.format(Locale.US,"%.2f",totalSamples/(double)RATE));''',
    '''        if(totalSamples>0 && totalSamples%(RATE*10)<samples.length)
            log.event("STT","DIRECT_PCM_PROGRESS",
                "samples",totalSamples,
                "audioSeconds",String.format(Locale.US,"%.2f",totalSamples/(double)RATE),
                "mode",mediaOutput==null?"DIRECT_ONLY":"MEDIA_AND_DIRECT",
                "lastPartial",lastPartial,
                "asrDecodeRunning",recognizer!=null);''',
    "nonzero sample diagnostics and empty partial visibility")
s=swap(s,
    '''        if(mediaOutput!=null){
            mediaOutput.close();
            mediaOutput=null;
            log.event("SPEAKER","MEDIA_OUTPUT_CLOSED","pcmSamples",totalSamples);
            return;
        }
        try{
            if(stream!=null && recognizer!=null){''',
    '''        if(mediaOutput!=null){
            mediaOutput.close();
            mediaOutput=null;
            log.event("SPEAKER","MEDIA_OUTPUT_CLOSED","pcmSamples",totalSamples);
            // The direct Sherpa recognizer must flush on call end.
        }
        try{
            if(stream!=null && recognizer!=null){''',
    "flush direct asr after closing audio")
sink.write_text(s,encoding="utf-8")
g=gradle.read_text(encoding="utf-8")
g=swap(g,'applicationId = "app.hitel.callflowlab.v31.autopermission"',
    'applicationId = "app.hitel.callflowlab.v32.directasr"',
    "parallel safe installation")
g=swap(g,"versionCode = 39","versionCode = 40","version")
g=swap(g,"0.14.25-native-first-launch-permissions-v31",
    "0.14.26-live-m4a-pcm-direct-asr-v32","versionName")
gradle.write_text(g,encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
m=swap(m,"HITEL14 V31 자동 권한 안내 · 원클릭 STT",
    "HITEL14 V32 실시간 PCM 직접 STT","app label")
manifest.write_text(m,encoding="utf-8")
for n,was in before.items():
    assert (src/n).read_bytes()==was,"V32 original processing source altered: "+n
assert '"sttInsidePlaybackSink",true' in s
assert 'mediaOutput.write(littleEndianPcm);' in s
assert 'stream.acceptWaveform(samples,RATE);' in s
assert 'DIRECT_ASR_PARTIAL' in s
assert 'DIRECT_PCM_PROGRESS' in s
assert 'DIRECT_ASR_FINAL' in s
assert 'DIRECT_ASR_FINAL_TAIL' in s
assert '"sttInsidePlaybackSink",false' not in s, "V31 playback-only bypass remains"
print("PASS_V32_MINUS2_WILL_TEE_ORIGINAL_M4A_PCM_TO_DIRECT_SHERPA_ASR")
print("PASS_V32_ORIGINAL_AUDIO_TRACK_AND_3_STT_MODELS_PRESERVED")
print("PASS_V32_DIRECT_ASR_PARTIAL_AND_FINAL_LOGGING")
print("PASS_V32_DIRECT_ASR_FLUSH_ON_CALL_END")
print("PASS_V32_INDEPENDENT_APP_ID_PRESERVES_INSTALLED_V22_V30_V31")
