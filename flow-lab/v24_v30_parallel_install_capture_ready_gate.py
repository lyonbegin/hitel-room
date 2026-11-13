#!/usr/bin/env python3
"""V30: Keep HITEL14 V22/V29 installed, and do not dial until STT capture is READY.

Apply after v23_one_tap_call_test_diagnostics_v29.py. This is strictly
control-plane instrumentation: all 3 STT recognizers, native follower,
Samsung M4A scan, PCM decoder, AudioTrack monitor and log exporters unchanged.
"""
from pathlib import Path
p=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
ui=p/"W03ConsoleActivity.java"
gradle=Path("AndroidProject/app/build.gradle.kts")
manifest=Path("AndroidProject/app/src/main/AndroidManifest.xml")

preserve=[
 "KoreanSherpaStt.java","SpeakerPlaybackStt.java","SpeakerPlaybackCaptureService.java",
 "PcmDirectSherpaSink.java","PcmSpeakerMonitor.java","StreamingAacPcmDecoder.java",
 "SpeakerEngine.java","SpeakerService.java","CallStateGate.java",
 "SpeakerCaptureLog.java","V23FreshLogExport.java","HitelSafLogSaver.java"]
previous={n:(p/n).read_bytes() for n in preserve}

def replace_once(s,a,b,label):
    count=s.count(a)
    if count!=1:raise AssertionError("V30 "+label+" anchor="+str(count)+" "+repr(a[:100]))
    return s.replace(a,b,1)

s=ui.read_text(encoding="utf-8")
s=replace_once(s,
    '''    private boolean oneTapTestPending=false;
    private TextView oneTapTestStatus;''',
    '''    private boolean oneTapTestPending=false;
    private boolean oneTapAwaitReady=false;
    private boolean oneTapMonitorReady=false;
    private boolean oneTapCaptureReady=false;
    private TextView oneTapTestStatus;''',
    "gate fields")

s=replace_once(s,
    '''        oneTapTestPending=true;
        markOneTapStage("START_REQUEST",''',
    '''        oneTapTestPending=true;
        oneTapAwaitReady=false;
        oneTapMonitorReady=false;
        oneTapCaptureReady=false;
        markOneTapStage("START_REQUEST",''',
    "gate reset")

# When the actual audio recorder reports RECORDSTATE_RECORDING (NOT mere
# consent or foreground service creation), the original speakerReceiver gets
# the durable STT status and signals the gate. Never infer from timing.
s=replace_once(s,
    '''            if("STATUS".equals(kind)&&speakerState!=null)speakerState.setText(caption);''',
    '''            if("STATUS".equals(kind)&&speakerState!=null)speakerState.setText(caption);
            if("STATUS".equals(kind) && oneTapTestPending && oneTapAwaitReady){
                if(caption.startsWith("미디어/게임 출력음 캡처 시작")){
                    oneTapCaptureReady=true;
                    markOneTapStage("CAPTURE_AUDIO_RECORDING",
                        "AudioRecord.RECORDSTATE_RECORDING 확인; STT 엔진 준비 완료");
                    maybeOpenDialerAfterServicesReady();
                }else if(caption.startsWith("출력음 STT 준비:") ||
                         caption.contains("모델 로딩 중") ||
                         caption.contains("모델 다운로드")){
                    markOneTapStage("WAIT_MODEL_READY",caption);
                }else if(caption.startsWith("출력음 STT 실패:") ||
                         caption.startsWith("출력음 STT 종료 · 실패:") ||
                         caption.startsWith("Android에서 출력 캡처를 종료")){
                    oneTapTestPending=false;
                    oneTapAwaitReady=false;
                    markOneTapStage("CAPTURE_FAILED",
                        "실제 캡처 시작 실패: "+caption);
                }
            }''',
    "capture ready receiver")

# Original SpeakerService's registered CallStateGate is the second gate.
s=replace_once(s,
    '''            if(value==null)return;
            if(value.startsWith("DIRECT_PARTIAL|")){''',
    '''            if(value==null)return;
            if(oneTapTestPending && oneTapAwaitReady &&
                (value.startsWith("통화 이벤트 자동 감시 중") ||
                 value.startsWith("통화녹음 폴더 자동 감시 유지"))){
                oneTapMonitorReady=true;
                markOneTapStage("CALL_MONITOR_ARMED",
                    "CallStateGate 등록 및 삼성 M4A 폴더 자동 감시 확인");
                maybeOpenDialerAfterServicesReady();
            }
            if(value.startsWith("DIRECT_PARTIAL|")){''',
    "telephony gate receiver")

s=replace_once(s,
    '''    private void launchDefaultDialerAfterArming(){
        oneTapTestPending=false;''',
    '''    private void maybeOpenDialerAfterServicesReady(){
        if(!oneTapTestPending||!oneTapAwaitReady)return;
        if(!oneTapCaptureReady||!oneTapMonitorReady){
            markOneTapStage("WAIT_BOTH_READY",
                "captureReady="+oneTapCaptureReady+
                ";callMonitorReady="+oneTapMonitorReady);
            return;
        }
        oneTapAwaitReady=false;
        SpeakerCaptureLog.append(this,"ONE_TAP_BOTH_ACTUALLY_READY",
            "capturingAudio=true;callStateRegistered=true;startDialer=true");
        launchDefaultDialerAfterArming();
    }
    private void launchDefaultDialerAfterArming(){
        oneTapTestPending=false;''',
    "gate transition")

s=replace_once(s,
    '''                startDirectRecordingMode(-2);
                if(oneTapTestPending)launchDefaultDialerAfterArming();''',
    '''                if(oneTapTestPending){
                    oneTapAwaitReady=true;
                    oneTapMonitorReady=false;
                    oneTapCaptureReady=false;
                    markOneTapStage("WAIT_BOTH_READY",
                        "출력음 캡처 모델/AudioRecord 및 통화 감시 서비스 실제 준비 대기");
                }
                // Do not treat startForegroundService() as service readiness.
                // The existing separate service receiver will confirm both gates.
                startDirectRecordingMode(-2);''',
    "defer dialer until capture/telephony ready")

# The V22 and V29 APKs have different debug-signing certificates. Give V30
# a distinct applicationId so the user can compare both without uninstalling
# or destroying the original's preferences, logs, or saved permissions.
g=gradle.read_text(encoding="utf-8")
g=replace_once(g,
    'applicationId = "app.hitel.callflowlab.v14.systempicker"',
    'applicationId = "app.hitel.callflowlab.v30.onetap"',
    "parallel install app id")
g=replace_once(g,"versionCode = 37","versionCode = 38","version code")
g=replace_once(g,
    "0.14.23-one-tap-call-diagnostics-v29",
    "0.14.24-parallel-capture-ready-v30",
    "version name")
gradle.write_text(g,encoding="utf-8")

m=manifest.read_text(encoding="utf-8")
m=replace_once(m,"HITEL14 V29 원클릭 통화 STT 진단",
    "HITEL14 V30 통화 STT 병렬시험","app display name")
manifest.write_text(m,encoding="utf-8")
ui.write_text(s,encoding="utf-8")
for n,b in previous.items():
    assert (p/n).read_bytes()==b,"V30 recognizer/audio/log source changed: "+n
assert s.count("maybeOpenDialerAfterServicesReady();")==2
assert "if(oneTapTestPending)launchDefaultDialerAfterArming();" not in s
assert "AudioRecord.RECORDSTATE_RECORDING 확인" in s
assert "통화 이벤트 자동 감시 중" in s
assert "app.hitel.callflowlab.v30.onetap" in g
assert "versionCode = 38" in g
print("PASS_V30_STT_MODEL_AND_AUDIO_RECORDING_READY_BEFORE_PHONE_APP")
print("PASS_V30_TELEPHONY_MONITOR_READY_BEFORE_PHONE_APP")
print("PASS_V30_PARALLEL_APPLICATION_ID_V22_V29_PRESERVED")
print("PASS_V30_ALL_ORIGINAL_AUDIO_AND_STT_SOURCES_BYTE_IDENTICAL")
