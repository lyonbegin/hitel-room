#!/usr/bin/env python3
"""V22 correction: restore Android's OWN single-app vs full-display dialog.

The previous V21 forced MediaProjectionConfig.createConfigForDefaultDisplay(),
which disables the OS 'single app' choice. V22 starts from preserved V20 and
changes ONLY status/choice UI around the ORIGINAL createScreenCaptureIntent().
No custom app selector, NO UID filter, no foreground target app launch by us.

Android's PUBLIC MediaProjection consent result does not expose a selected app
package/name, so UI must NOT claim or guess a package name.
"""
from pathlib import Path
import hashlib

root=Path("AndroidProject/app")
source=root/"src/main/java/app/hitel/samsungprobe"
w=source/"W03ConsoleActivity.java"
manifest=root/"src/main/AndroidManifest.xml"
gradle=root/"build.gradle.kts"
src=w.read_text(encoding="utf-8")
before_mic=(source/"KoreanSherpaStt.java").read_bytes()
before_output=(source/"SpeakerPlaybackStt.java").read_bytes()
before_service=(source/"SpeakerPlaybackCaptureService.java").read_bytes()

def patch(old,new):
    global src
    if src.count(old)!=1:
        raise AssertionError("original W03 anchor missing or repeated "+old[:120])
    src=src.replace(old,new,1)

patch('''    private TextToSpeech ownMediaTestTts;''',
'''    private TextToSpeech ownMediaTestTts;
    private TextView nativeSelectedCaptureStatus;
    private boolean nativeProjectionConsentActive=false;''')

patch('''        screen.addView(speakerLogExport,new LinearLayout.LayoutParams(-1,dp(56)));
        screen.addView(tabs);''',
'''        screen.addView(speakerLogExport,new LinearLayout.LayoutParams(-1,dp(52)));
        nativeSelectedCaptureStatus=label(
            "시스템 캡처 대상: 아직 선택하지 않음 · 앱 선택은 Android에서만 합니다.",13,true);
        nativeSelectedCaptureStatus.setMaxLines(4);
        screen.addView(nativeSelectedCaptureStatus,
            new LinearLayout.LayoutParams(-1,dp(77)));
        Button nativeChange=btn("🔁 시스템에서 캡처 대상 다시 선택 (단일 앱 / 전체 화면)",
            this::changeSystemCaptureTarget);
        screen.addView(nativeChange,new LinearLayout.LayoutParams(-1,dp(55)));
        screen.addView(tabs);''')

patch('''    private void requestSpeakerPlayback(){''',
'''    private void captureSelectionStatus(String value){
        if(nativeSelectedCaptureStatus!=null)
            nativeSelectedCaptureStatus.setText("시스템 캡처 대상: "+value);
        SpeakerCaptureLog.append(this,"SYSTEM_SELECTION_STATUS",value);
    }
    private void changeSystemCaptureTarget(){
        // A MediaProjection token is single-session; stop old capture before
        // requesting fresh SYSTEM consent. Never launch a target app directly.
        stopSpeakerPlayback();
        nativeProjectionConsentActive=false;
        captureSelectionStatus("대상 변경 요청 · 이전 출력음 STT 중지. "+
            "Android에서 단일 앱 또는 전체 화면을 다시 선택해 주십시오.");
        requestSpeakerPlayback();
    }
    private void requestSpeakerPlayback(){''')

patch('''        log("SPEAKER_STT_CONSENT_REQUEST","Request Android MediaProjection once per output session");
        SpeakerCaptureLog.append(this,"CONSENT_REQUEST",
            "User requested per-app or whole-display audio capture");
        startActivityForResult(mgr.createScreenCaptureIntent(),SPEAKER_CONSENT_REQUEST);''',
'''        log("SPEAKER_STT_CONSENT_REQUEST",
            "NATIVE Android system user choice: single-app or full-display");
        SpeakerCaptureLog.append(this,"CONSENT_REQUEST",
            "Android native single-app/full-display chooser; no custom app picker");
        captureSelectionStatus("Android 시스템 선택창 대기 (앱명은 공개 API로 확인 불가)");
        // DO NOT use Android's forced full-display-only configuration:
        // it explicitly disables app-window sharing on Android 14+.
        // The no-argument overload preserves Android's native user choice.
        startActivityForResult(mgr.createScreenCaptureIntent(),
            SPEAKER_CONSENT_REQUEST);''')

patch('''        if(result!=RESULT_OK||data==null){
            SpeakerCaptureLog.append(this,"CONSENT_CANCELLED",
                "MediaProjection permission declined or not returned");
            if(speakerState!=null)speakerState.setText("사용자가 출력음 캡처를 취소했습니다.");''',
'''        if(result!=RESULT_OK||data==null){
            nativeProjectionConsentActive=false;
            captureSelectionStatus("사용자가 시스템 선택을 취소했습니다.");
            SpeakerCaptureLog.append(this,"CONSENT_CANCELLED",
                "MediaProjection permission declined or not returned");
            if(speakerState!=null)speakerState.setText("사용자가 출력음 캡처를 취소했습니다.");''')

patch('''        try{
            startForegroundService(i);
            SpeakerCaptureLog.append(this,"CAPTURE_SERVICE_START",
                "Foreground MediaProjection service start requested");
            if(speakerState!=null)speakerState.setText("미디어 출력음 캡처 시작 요청 · 실제 신호 확인 대기");''',
'''        try{
            // Android result Intent returns an authorization token only.
            // It does NOT expose the selected app's package name or UID.
            nativeProjectionConsentActive=true;
            captureSelectionStatus("Android 시스템 승인 완료 · 선택된 앱 이름/"+
                "단일 앱·전체 화면 여부는 공개 API에서 제공되지 않습니다. "+
                "음성 입력 상태는 출력음 RMS로 확인하십시오.");
            startForegroundService(i);
            SpeakerCaptureLog.append(this,"CAPTURE_SERVICE_START",
                "OS consent accepted; source package inaccessible by public API");
            if(speakerState!=null)speakerState.setText(
                "시스템 동의 완료 · 실제 출력음 입력 대기 (선택 앱명 미제공)");''')

patch('''            log("SPEAKER_STT_SERVICE_ERROR",e.toString());
            SpeakerCaptureLog.append(this,"CAPTURE_SERVICE_ERROR",e.toString());''',
'''            log("SPEAKER_STT_SERVICE_ERROR",e.toString());
            nativeProjectionConsentActive=false;
            captureSelectionStatus("캡처 서비스 시작 실패: "+e);
            SpeakerCaptureLog.append(this,"CAPTURE_SERVICE_ERROR",e.toString());''')

patch('''    private void stopSpeakerPlayback(){
        Intent i=new Intent(this,SpeakerPlaybackCaptureService.class);''',
'''    private void stopSpeakerPlayback(){
        nativeProjectionConsentActive=false;
        captureSelectionStatus("캡처 중지됨 · 대상 변경은 시스템 선택창에서 진행");
        Intent i=new Intent(this,SpeakerPlaybackCaptureService.class);''')

patch('''            if("STATUS".equals(kind)&&speakerState!=null)speakerState.setText(caption);''',
'''            if("STATUS".equals(kind)&&speakerState!=null)speakerState.setText(caption);
            if("STATUS".equals(kind) &&
                (caption.startsWith("Android에서 출력 캡처를 종료")||
                 caption.startsWith("출력음 STT 세션 종료")||
                 caption.startsWith("출력음 STT 시작 실패")||
                 caption.startsWith("사용자 요청: 출력음 STT 중지"))){
                nativeProjectionConsentActive=false;
                captureSelectionStatus("캡처 종료됨 · Android에서 다시 선택할 수 있습니다.");
            }''')

w.write_text(src,encoding="utf-8")

g=gradle.read_text(encoding="utf-8")
assert 'versionCode = 28' in g
assert 'app.hitel.callflowlab.v14.speakerlog' in g
g=g.replace('versionCode = 28','versionCode = 30',1)
g=g.replace('app.hitel.callflowlab.v14.speakerlog',
            'app.hitel.callflowlab.v14.systempicker',1)
g=g.replace('0.14.14-speaker-stt-durable-diagnostic-log',
            '0.14.16-native-system-picker-v22',1)
gradle.write_text(g,encoding="utf-8")

m=manifest.read_text(encoding="utf-8")
assert "HITEL14 출력음진단로그 V20" in m
m=m.replace("HITEL14 출력음진단로그 V20",
            "HITEL14 시스템 단일앱선택 V22",1)
manifest.write_text(m,encoding="utf-8")

assert (source/"KoreanSherpaStt.java").read_bytes()==before_mic
assert (source/"SpeakerPlaybackStt.java").read_bytes()==before_output
assert (source/"SpeakerPlaybackCaptureService.java").read_bytes()==before_service
assert 'startActivityForResult(mgr.createScreenCaptureIntent(),' in src
assert 'MediaProjectionConfig.createConfigForDefaultDisplay()' not in src
assert 'SpeakerTargetPicker' not in src
assert 'addMatchingUid(' not in (source/"SpeakerPlaybackStt.java").read_text()
assert "Android 시스템 승인 완료" in src
assert "다시 선택" in src
assert not (source/"RecordingFolderPlaybackService.java").exists()
print("PASS: original Android system choice restored: single app or full display")
print("PASS: NO second selector/forced full display/UID-only filter")
print("PASS: status shows consent granted, never invents OS-selected app name")
print("PASS: original microphone STT SHA256",hashlib.sha256(before_mic).hexdigest())
print("PASS: original output STT SHA256",hashlib.sha256(before_output).hexdigest())
print("PASS: original capture service SHA256",hashlib.sha256(before_service).hexdigest())
print("PASS: recording M4A->speaker playback removed")
