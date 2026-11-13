#!/usr/bin/env python3
"""HITEL14 V29: one-button W03 test setup and diagnostic stage markers.

Apply AFTER v22_default_monitor_route_picker_v28.py. Keep original V14 mic
recognizer, V22 output recognizer and V23 direct PCM recognizer byte-for-byte.
Do not attempt to bypass Android's SAF/permission/MediaProjection prompts.
"""
from pathlib import Path

base=Path("AndroidProject/app")
java=base/"src/main/java/app/hitel/samsungprobe"
ui=java/"W03ConsoleActivity.java"
eng=java/"SpeakerEngine.java"
svc=java/"SpeakerService.java"
capture=java/"SpeakerPlaybackCaptureService.java"
gradle=base/"build.gradle.kts"
manifest=base/"src/main/AndroidManifest.xml"
immutable=[
    "KoreanSherpaStt.java",
    "SpeakerPlaybackStt.java",
    "PcmDirectSherpaSink.java",
    "PcmSpeakerMonitor.java",
    "StreamingAacPcmDecoder.java",
    "CallStateGate.java",
    "V23FreshLogExport.java",
    "HitelSafLogSaver.java",
]
before={name:(java/name).read_bytes() for name in immutable}

def replace_one(source,old,new,label):
    count=source.count(old)
    if count!=1:
        raise AssertionError("V29 "+label+" missing/nonunique anchor: "+str(count)+" "+repr(old[:130]))
    return source.replace(old,new,1)

s=ui.read_text(encoding="utf-8")
s=replace_one(s,
    '    private boolean callMediaLinkPending;',
    '''    private boolean callMediaLinkPending;
    private boolean oneTapTestPending=false;
    private TextView oneTapTestStatus;''',
    "one-tap fields")

# Pin the only new start button visibly above existing logs, without deleting
# any prior control or changing the original three STT source paths.
s=replace_one(s,
    '''        screen.addView(manualLogStatus,1,new LinearLayout.LayoutParams(-1,dp(54)));''',
    '''        screen.addView(manualLogStatus,1,new LinearLayout.LayoutParams(-1,dp(54)));
        Button oneTapTest=btn("▶ 테스트 시작 · 기본 전화 앱 자동 열기",
            this::startOneTapCallTest);
        screen.addView(oneTapTest,0,new LinearLayout.LayoutParams(-1,dp(62)));
        oneTapTestStatus=label(
            "테스트 대기 · 버튼 한 번으로 사전 준비를 시작합니다.",12,true);
        screen.addView(oneTapTestStatus,1,new LinearLayout.LayoutParams(-1,dp(58)));''',
    "one-tap pinned primary button")

# Explicitly separate user-action checkpoints from automatic stages. No
# READ_CALL_LOG, contacts, call-number or default dialer replacement.
method=r'''    private void markOneTapStage(String stage,String detail){
        SpeakerCaptureLog.append(this,"ONE_TAP_"+stage,detail);
        if(oneTapTestStatus!=null)
            oneTapTestStatus.setText("테스트 "+stage+" · "+detail);
    }
    private void startOneTapCallTest(){
        if(oneTapTestPending){
            markOneTapStage("ALREADY_PENDING","기존 준비 절차가 진행 중입니다.");
            return;
        }
        oneTapTestPending=true;
        markOneTapStage("START_REQUEST",
            "사용자 1회 입력; 기본 전화 앱 유지; 녹음 폴더/권한/시스템 캡처 확인");
        continueOneTapCallTest();
    }
    private void continueOneTapCallTest(){
        if(!oneTapTestPending)return;
        android.content.SharedPreferences source=
            getSharedPreferences("hitel_direct_source",MODE_PRIVATE);
        String uri=source.getString("uri","");
        if(!source.getBoolean("folder",false)||uri.isEmpty()){
            markOneTapStage("WAIT_SAF",
                "최초 1회 삼성 통화녹음 폴더 선택이 필요합니다.");
            selectDirectRecordingFolder();
            return;
        }
        if(!has(Manifest.permission.READ_PHONE_STATE)){
            markOneTapStage("WAIT_PHONE_PERMISSION",
                "전화 상태 감지 권한 시스템 승인을 요청합니다.");
            requestPermissions(
                new String[]{Manifest.permission.READ_PHONE_STATE},1183);
            return;
        }
        if(!has(Manifest.permission.RECORD_AUDIO)){
            markOneTapStage("WAIT_AUDIO_PERMISSION",
                "출력음 STT 오디오 녹음 권한 시스템 승인을 요청합니다.");
            requestPermissions(
                new String[]{Manifest.permission.RECORD_AUDIO},916);
            return;
        }
        markOneTapStage("WAIT_PROJECTION_CONSENT",
            "Android가 매 테스트 세션 요청하는 캡처 승인 화면; 전체 화면을 선택하십시오.");
        callMediaLinkPending=true;
        requestSpeakerPlayback();
    }
    private void launchDefaultDialerAfterArming(){
        oneTapTestPending=false;
        markOneTapStage("MONITOR_START_REQUESTED",
            "MediaProjection 승인; 통화녹음 M4A 감시 요청; 기본 전화 앱 실행");
        try{
            Intent dial=new Intent(Intent.ACTION_DIAL);
            startActivity(dial);
            markOneTapStage("DIALER_OPENED",
                "번호 입력·발신만 하시면 OFFHOOK/M4A 증가를 자동 감지합니다.");
        }catch(Throwable error){
            markOneTapStage("DIALER_LAUNCH_FAILED",error.toString());
        }
    }

'''
s=replace_one(s,
    '    private void startCallMediaOutputSttLink(){',
    method+'    private void startCallMediaOutputSttLink(){',
    "insert one-tap state machine")

# SAF chooser result: resume automatically after folder is selected.
s=replace_one(s,
    '''            if(folder){
                // A newly selected folder must not be throttled by the old watch.
                lastAutoArmMs=0;
                armDefaultSamsungCallFolder();
            }
            return;''',
    '''            if(folder){
                // A newly selected folder must not be throttled by the old watch.
                lastAutoArmMs=0;
                armDefaultSamsungCallFolder();
                if(oneTapTestPending){
                    markOneTapStage("SAF_READY","통화녹음 폴더 선택 완료");
                    continueOneTapCallTest();
                }
            }
            return;''',
    "SAF resume")
s=replace_one(s,
    '''            if(result!=RESULT_OK||data==null||data.getData()==null){
                if(directSttStatus!=null)directSttStatus.setText("녹음 소스 선택 취소");
                return;
            }''',
    '''            if(result!=RESULT_OK||data==null||data.getData()==null){
                if(directSttStatus!=null)directSttStatus.setText("녹음 소스 선택 취소");
                if(oneTapTestPending){
                    oneTapTestPending=false;
                    markOneTapStage("SAF_CANCELLED","폴더 미선택 · 테스트 시작되지 않음");
                }
                return;
            }''',
    "SAF cancel")

# Existing V28 W03 permission callback is retained; only continuation is
# added to each relevant branch. Note the RECORD_AUDIO branch's condition.
s=replace_one(s,
    '''(req==916 && callMediaLinkPending)''',
    '''(req==916 && (callMediaLinkPending||oneTapTestPending))''',
    "audio permission routing")
s=replace_one(s,
    '''                if(granted)armDefaultSamsungCallFolder();''',
    '''                if(granted){
                    if(oneTapTestPending){
                        markOneTapStage("PHONE_PERMISSION_GRANTED","통화 상태 감지 권한 확인");
                        continueOneTapCallTest();
                    }else armDefaultSamsungCallFolder();
                }''',
    "phone permission continuation")
s=replace_one(s,
    '''                if(granted)requestSpeakerPlayback();''',
    '''                if(granted){
                    if(oneTapTestPending){
                        markOneTapStage("AUDIO_PERMISSION_GRANTED","출력음 인식 권한 확인");
                        continueOneTapCallTest();
                    }else requestSpeakerPlayback();
                }''',
    "audio permission continuation")
s=replace_one(s,
    '''                    callMediaLinkPending=false;
                    if(speakerState!=null)speakerState.setText("출력음 STT 오디오 권한이 필요합니다.");''',
    '''                    callMediaLinkPending=false;
                    if(oneTapTestPending){
                        oneTapTestPending=false;
                        markOneTapStage("AUDIO_PERMISSION_DENIED","권한 거부; 테스트 중단");
                    }
                    if(speakerState!=null)speakerState.setText("출력음 STT 오디오 권한이 필요합니다.");''',
    "audio permission denied")
s=replace_one(s,
    '''                else if(directSttStatus!=null)
                    directSttStatus.setText("전화 상태 권한이 없어 자동 감시가 제한됩니다.");''',
    '''                else {
                    if(oneTapTestPending){
                        oneTapTestPending=false;
                        markOneTapStage("PHONE_PERMISSION_DENIED","권한 거부; 테스트 중단");
                    }
                    if(directSttStatus!=null)
                        directSttStatus.setText("전화 상태 권한이 없어 자동 감시가 제한됩니다.");
                }''',
    "phone permission denied")

# Preserve existing output capture service and direct file watch; only start
# the ordinary dialer after BOTH have been requested on consent completion.
s=replace_one(s,
    '''            callMediaLinkPending=false;
            if(speakerState!=null)speakerState.setText("사용자가 출력음 캡처를 취소했습니다.");''',
    '''            callMediaLinkPending=false;
            if(oneTapTestPending){
                oneTapTestPending=false;
                markOneTapStage("PROJECTION_DENIED",
                    "시스템 캡처 승인이 취소되어 테스트를 중단했습니다.");
            }
            if(speakerState!=null)speakerState.setText("사용자가 출력음 캡처를 취소했습니다.");''',
    "projection consent cancelled")
s=replace_one(s,
    '''                startDirectRecordingMode(-2);
            }''',
    '''                startDirectRecordingMode(-2);
                if(oneTapTestPending)launchDefaultDialerAfterArming();
            }''',
    "dialer launch after consent")
ui.write_text(s,encoding="utf-8")

# Instrument existing working pipeline without altering codec, STT function,
# captured PCM data or audio routing implementation.
engine=eng.read_text(encoding="utf-8")
engine=replace_one(engine,
    '''      selected=folder?waitForRecording(input):input;''',
    '''      selected=folder?waitForRecording(input):input;
      if(selected!=null)log.event("PIPELINE","M4A_SOURCE_READY",
          "folderMode",folder,"sourceUri",selected.toString(),
          "thread",Thread.currentThread().getName());''',
    "M4A selected")
engine=replace_one(engine,
    '''      codec=new StreamingAacPcmDecoder(log);''',
    '''      log.event("PIPELINE","M4A_MIRROR_READY",
          "initialMirroredBytes",mirroredBytes,"mirrorPath",mirror.getName());
      codec=new StreamingAacPcmDecoder(log);
      log.event("PIPELINE","AAC_DECODER_CREATED",
          "inputType","growing Samsung M4A AAC",
          "pcmTargetHz",16000,"channels",1);''',
    "codec stage")
engine=replace_one(engine,
    '''        codec.feedAdtsFrame(adts,pcm->{''',
    '''        codec.feedAdtsFrame(adts,pcm->{
          if(pcmBytes==0){
            log.event("PIPELINE","FIRST_16KHZ_PCM_READY",
                "pcmBytes",pcm.length,"adtsBytes",adts.length,
                "audioRateHz",16000,"preLiveFrames",skippedPreLiveFrames);
            SpeakerCaptureLog.append(context,"PIPELINE_PCM_FIRST",
                "pcmBytes="+pcm.length+";adtsBytes="+adts.length+
                ";codec=AAC;outHz=16000");
          }''',
    "first PCM diagnostic")
engine=replace_one(engine,
    '''      log.event("APP","SESSION_END","reason",endReason,''',
    '''      log.event("PIPELINE","SESSION_CLOSED",
          "reason",endReason,"sourceBytes",mirroredBytes,
          "adtsFrames",receivedFrames,"pcmBytes",pcmBytes);
      log.event("APP","SESSION_END","reason",endReason,''',
    "end diagnostic")
eng.write_text(engine,encoding="utf-8")

service=svc.read_text(encoding="utf-8")
service=replace_one(service,
    '''    launchSession(true);
  }''',
    '''    SpeakerCaptureLog.append(this,"PIPELINE_OFFHOOK",
        "phone=OFFHOOK;M4A-growth-waiting=true;audio=not-yet-verified");
    launchSession(true);
  }''',
    "offhook stage")
service=replace_one(service,
    '''    SpeakerEngine current=engine;
    if(current!=null){
      send("통화 종료 이벤트''',
    '''    SpeakerCaptureLog.append(this,"PIPELINE_CALL_IDLE",
        "phone=IDLE;stoppingAudioEngine="+(engine!=null));
    SpeakerEngine current=engine;
    if(current!=null){
      send("통화 종료 이벤트''',
    "idle stage")
svc.write_text(service,encoding="utf-8")

cap=capture.read_text(encoding="utf-8")
cap=replace_one(cap,
    '''This HITEL14 diagnostic app does not play recordings.''',
    '''Own-app USAGE_MEDIA playback is capturable after user consent.''',
    "correct playback capture diagnostic")
capture.write_text(cap,encoding="utf-8")

g=gradle.read_text(encoding="utf-8")
g=replace_one(g,"versionCode = 36","versionCode = 37","version code")
g=replace_one(g,"0.14.22-auto-monitor-output-device-picker-v28",
    "0.14.23-one-tap-call-diagnostics-v29","version name")
gradle.write_text(g,encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
m=replace_one(m,"HITEL14 V28 통화녹음 자동 감시·출력 장치 선택",
    "HITEL14 V29 원클릭 통화 STT 진단","manifest display name")
manifest.write_text(m,encoding="utf-8")

for name,original in before.items():
    assert (java/name).read_bytes()==original,"core processing path changed unexpectedly: "+name
assert "▶ 테스트 시작 · 기본 전화 앱 자동 열기" in s
assert "Intent.ACTION_DIAL" in s and "Intent.ACTION_CALL" not in s
assert "READ_CALL_LOG" not in s
assert "ONE_TAP_" in s and "PIPELINE_OFFHOOK" in service
assert "FIRST_16KHZ_PCM_READY" in engine
assert "M4A_MIRROR_READY" in engine
assert "SESSION_CLOSED" in engine
print("PASS_V29_ONE_TAP_WITH_PERMISSION_SAF_PROJECTION_CHECKPOINTS")
print("PASS_V29_DEFAULT_DIALER_UNCHANGED_AND_AUTO_OFFHOOK_MONITOR")
print("PASS_V29_NEW_PIPELINE_M4A_AAC_PCM_CAPTURE_DIAGNOSTICS")
print("PASS_V29_ORIGINAL_THREE_STT_CODECS_PLAYERS_UNCHANGED")
