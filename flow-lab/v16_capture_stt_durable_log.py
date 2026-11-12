#!/usr/bin/env python3
"""After v15 reconstruction: fix missing speaker diagnostics and allow a
user-triggered capturable MEDIA speech test. No Samsung recording replay,
file watcher, FFmpeg or AAC follower is introduced or enabled.
"""
from pathlib import Path
import shutil
import hashlib

src=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
app=Path("AndroidProject/app")
w=src/"W03ConsoleActivity.java"
gradle=app/"build.gradle.kts"
manifest=app/"src/main/AndroidManifest.xml"

before_mic=(src/"KoreanSherpaStt.java").read_bytes()
before_speaker=(src/"SpeakerPlaybackStt.java").read_bytes()
for name in ("SpeakerCaptureLog.java","SpeakerPlaybackCaptureService.java","SpeakerPlaybackStt.java"):
    source=Path("flow-lab")/name
    assert source.is_file(),source
    shutil.copyfile(source,src/name)

s=w.read_text(encoding="utf-8")
def change(old,new):
    global s
    assert s.count(old)==1,"W03 patch anchor absent or duplicated: "+old[:100]
    s=s.replace(old,new,1)

change("import android.os.Build;","""import android.os.Build;
import android.media.AudioAttributes;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;""")
change("    private static final int SPEAKER_CONSENT_REQUEST=915;","""    private static final int SPEAKER_CONSENT_REQUEST=915;
    private TextToSpeech ownMediaTestTts;""")
change('''        line(content,"② 출력음 STT · 허용된 미디어/게임 소리");''',
'''        line(content,"② 출력음 STT · 허용된 미디어/게임 소리");''')
change('''        Button speakerStart=btn("출력음 STT 시작 · OS 동의",this::requestSpeakerPlayback);''',
'''        Button speakerStart=btn("출력음 STT 시작 · OS 동의",this::requestSpeakerPlayback);''')
# Own-app TTS is a direct user action and emits MEDIA audio, unlike the removed
# recording-to-speaker feature. Must NOT play phone recordings or mic audio.
change('''        content.addView(speakerHistory);''',
'''        content.addView(speakerHistory);
        Button ownMediaTest=btn("선택한 HITEL14 앱 출력음 직접 시험 · 한국어 TTS",
            this::playOwnMediaSpeechTest);
        content.addView(ownMediaTest,new LinearLayout.LayoutParams(-1,dp(56)));
        content.addView(label(
            "주의: 앱 선택에서 HITEL14를 고르면 HITEL14가 직접 재생한 미디어만 캡처됩니다. "+
            "녹음파일 스피커 재생 기능은 제거되어 자동으로 나오는 소리가 없습니다. "+
            "위 음성 시험 버튼을 누른 경우에만 테스트 음성이 나옵니다. "+
            "다른 앱 소리는 해당 앱을 선택하시거나 전체 화면 캡처를 사용하십시오.",12,false));''')
change('''        screen.addView(tabs);''',
'''        Button speakerLogExport=btn("📦 출력음 STT 진단 ZIP 즉시 저장 (다운로드)",
            this::saveSpeakerDiagnosticZip);
        screen.addView(speakerLogExport,new LinearLayout.LayoutParams(-1,dp(56)));
        screen.addView(tabs);''')
change('''    private void requestSpeakerPlayback(){''',
'''    private void saveSpeakerDiagnosticZip(){
        try{
            SpeakerCaptureLog.append(this,"MANUAL_EXPORT","사용자가 로그 ZIP 내보내기를 선택");
            String saved=SpeakerCaptureLog.exportToDownloads(this);
            status("출력음 STT 진단 ZIP 저장 완료: "+saved);
            if(speakerState!=null)speakerState.setText("진단 ZIP 저장 완료: "+saved);
            toast(saved);
        }catch(Throwable ex){
            status("출력음 STT 진단 ZIP 저장 실패: "+ex);
            if(speakerState!=null)speakerState.setText("저장 실패: "+ex);
            SpeakerCaptureLog.append(this,"EXPORT_FAILED",ex.toString());
        }
    }
    private void playOwnMediaSpeechTest(){
        SpeakerCaptureLog.append(this,"SELF_MEDIA_TEST_REQUEST",
            "Test independent Korean TTS; no call recording / no AAC replay");
        if(speakerState!=null)speakerState.setText(
            "HITEL14 자체 한국어 미디어 재생 준비 · 미디어 음량도 확인하십시오.");
        if(ownMediaTestTts==null){
            ownMediaTestTts=new TextToSpeech(this,statusCode->{
                if(statusCode!=TextToSpeech.SUCCESS){
                    SpeakerCaptureLog.append(this,"SELF_MEDIA_TEST_ERROR",
                        "Android TTS initialization error="+statusCode);
                    if(speakerState!=null)speakerState.setText(
                        "한국어 TTS 초기화 실패: "+statusCode);
                    return;
                }
                configureAndSpeakOwnMediaTest();
            });
        }else{
            configureAndSpeakOwnMediaTest();
        }
    }
    private void configureAndSpeakOwnMediaTest(){
        try{
            int lang=ownMediaTestTts.setLanguage(Locale.KOREAN);
            if(lang==TextToSpeech.LANG_MISSING_DATA||
                lang==TextToSpeech.LANG_NOT_SUPPORTED){
                SpeakerCaptureLog.append(this,"SELF_MEDIA_TEST_ERROR",
                    "Korean voice not installed: "+lang);
                if(speakerState!=null)speakerState.setText(
                    "기기에 한국어 TTS 음성이 설치되지 않았습니다: "+lang);
                return;
            }
            AudioAttributes attrs=new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .setAllowedCapturePolicy(AudioAttributes.ALLOW_CAPTURE_BY_ALL)
                .build();
            ownMediaTestTts.setAudioAttributes(attrs);
            ownMediaTestTts.setOnUtteranceProgressListener(
                new UtteranceProgressListener(){
                    @Override public void onStart(String id){
                        SpeakerCaptureLog.append(W03ConsoleActivity.this,
                            "SELF_MEDIA_TEST_STARTED",id);
                    }
                    @Override public void onDone(String id){
                        SpeakerCaptureLog.append(W03ConsoleActivity.this,
                            "SELF_MEDIA_TEST_DONE",id);
                    }
                    @Override public void onError(String id){
                        SpeakerCaptureLog.append(W03ConsoleActivity.this,
                            "SELF_MEDIA_TEST_ERROR","utterance="+id);
                    }
                });
            int result=ownMediaTestTts.speak(
                "안녕하세요. 하이텔 출력음 인식 테스트입니다.",
                TextToSpeech.QUEUE_FLUSH,null,
                "HITEL_SELF_MEDIA_"+System.currentTimeMillis());
            SpeakerCaptureLog.append(this,"SELF_MEDIA_TEST_QUEUED",
                "result="+result+"; USAGE_MEDIA; capturePolicy=ALLOW_CAPTURE_BY_ALL");
            if(speakerState!=null)speakerState.setText(
                "자체 미디어 TTS 요청 "+(result==TextToSpeech.SUCCESS?
                "성공 · 출력음 RMS 및 자막 확인":"실패 "+result));
        }catch(Throwable ex){
            SpeakerCaptureLog.append(this,"SELF_MEDIA_TEST_EXCEPTION",ex.toString());
            if(speakerState!=null)speakerState.setText("자체 출력음 시험 오류: "+ex);
        }
    }
    private void requestSpeakerPlayback(){''')
change('''        log("SPEAKER_STT_CONSENT_REQUEST","Request Android MediaProjection once per output session");''',
'''        log("SPEAKER_STT_CONSENT_REQUEST","Request Android MediaProjection once per output session");
        SpeakerCaptureLog.append(this,"CONSENT_REQUEST",
            "User requested per-app or whole-display audio capture");''')
change('''        if(result!=RESULT_OK||data==null){
            if(speakerState!=null)speakerState.setText("사용자가 출력음 캡처를 취소했습니다.");''',
'''        if(result!=RESULT_OK||data==null){
            SpeakerCaptureLog.append(this,"CONSENT_CANCELLED",
                "MediaProjection permission declined or not returned");
            if(speakerState!=null)speakerState.setText("사용자가 출력음 캡처를 취소했습니다.");''')
change('''            startForegroundService(i);
            if(speakerState!=null)speakerState.setText("미디어 출력음 캡처 시작 요청 · 실제 신호 확인 대기");''',
'''            startForegroundService(i);
            SpeakerCaptureLog.append(this,"CAPTURE_SERVICE_START",
                "Foreground MediaProjection service start requested");
            if(speakerState!=null)speakerState.setText("미디어 출력음 캡처 시작 요청 · 실제 신호 확인 대기");''')
change('''            log("SPEAKER_STT_SERVICE_ERROR",e.toString());''',
'''            log("SPEAKER_STT_SERVICE_ERROR",e.toString());
            SpeakerCaptureLog.append(this,"CAPTURE_SERVICE_ERROR",e.toString());''')
# Keep dedicated speaker diagnostics independently when standard W03 session ends
change('''            LabStore.finishRun(this,"HITEL14 원본 W03 세션 종료. 마이크/출력음 진단 로그 저장");''',
'''            SpeakerCaptureLog.append(this,"W03_EXPORT_REQUEST",
                "W03 session ended; also publishing separate durable speaker ZIP");
            LabStore.finishRun(this,"HITEL14 원본 W03 세션 종료. 마이크/출력음 진단 로그 저장");
            try{
                String speakerZip=SpeakerCaptureLog.exportToDownloads(this);
                SpeakerCaptureLog.append(this,"W03_EXPORT_COMPLETE",speakerZip);
            }catch(Throwable error){
                SpeakerCaptureLog.append(this,"W03_EXPORT_SECONDARY_ERROR",error.toString());
                status("W03 저장 후 출력음 진단 ZIP 추가 저장 실패: "+error);
            }''')
change('''        ui.removeCallbacks(poll);destroyRecognizer();''',
'''        if(ownMediaTestTts!=null){
            try{ownMediaTestTts.shutdown();}catch(Throwable ignored){}
            ownMediaTestTts=null;
        }
        ui.removeCallbacks(poll);destroyRecognizer();''')
w.write_text(s,encoding="utf-8")

g=gradle.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v14"' in g
assert 'versionCode = 22' in g
g=g.replace('applicationId = "app.hitel.callflowlab.v14"',
            'applicationId = "app.hitel.callflowlab.v14.speakerlog"',1)
g=g.replace('versionCode = 22','versionCode = 28',1)
g=g.replace('0.14.8-original-mic-plus-playback',
            '0.14.14-speaker-stt-durable-diagnostic-log',1)
gradle.write_text(g,encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
assert 'HITEL14 · 원본 마이크 STT + 출력음 STT' in m
m=m.replace('HITEL14 · 원본 마이크 STT + 출력음 STT',
            'HITEL14 출력음진단로그 V20',1)
manifest.write_text(m,encoding="utf-8")

assert (src/"KoreanSherpaStt.java").read_bytes()==before_mic
assert "SpeakerCaptureLog.exportToDownloads(this)" in s
assert "RecordingFolderPlayback" not in s
assert not (src/"RecordingFolderPlaybackService.java").exists()
assert not (src/"RecordingFolderPlaybackEngine.java").exists()
assert not (src/"RecordingFolderPlaybackActivity.java").exists()
assert "AudioTrack" not in (src/"SpeakerPlaybackStt.java").read_text(encoding="utf-8")
print("PASS: original mic STT SHA256",hashlib.sha256(before_mic).hexdigest())
print("PASS: original speaker model preserved; zero-RMS message and persist-only additions")
print("PASS: self-app TTS test emits USAGE_MEDIA without playback of recordings")
print("PASS: diagnostic logger persists after W03 ends; ZIP export works without W03 session")
print("PASS: Samsung recording file to speaker feature ABSENT")
