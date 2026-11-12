#!/usr/bin/env python3
"""Surgical PATCH over the fully reconstructed HITEL14 v0.14.7 application.

Do not rewrite KoreanSherpaStt.java, W03 mic handlers, LabStore, scenario sessions,
VoxSherpa or any native model. The original source and debug APK remain untouched.
"""
from pathlib import Path
import hashlib
import shutil

base = Path("AndroidProject/app")
src = base / "src/main/java/app/hitel/samsungprobe"
w03 = src / "W03ConsoleActivity.java"
manifest = base / "src/main/AndroidManifest.xml"
gradle = base / "build.gradle.kts"

for name in ("SpeakerPlaybackStt.java", "SpeakerPlaybackCaptureService.java"):
    shutil.copyfile(Path("flow-lab") / name, src / name)

before_mic = (src / "KoreanSherpaStt.java").read_bytes()
expected_mic = Path("flow-lab/KoreanSherpaStt.java").read_bytes()
assert before_mic == expected_mic, "Original KoreanSherpaStt diverged BEFORE additive patch"

s = w03.read_text(encoding="utf-8")
def replace(a, b):
    global s
    assert a in s, "Original HITEL14 W03 anchor missing: " + a[:180]
    assert s.count(a) == 1, "Non-unique HITEL14 W03 anchor: " + a[:150]
    s = s.replace(a, b, 1)

replace('''import android.content.Intent;''',
'''import android.content.Intent;
import android.content.IntentFilter;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.os.Build;
import android.media.projection.MediaProjectionManager;''')

replace('''    private KoreanSherpaStt koreanSherpa;''',
'''    private KoreanSherpaStt koreanSherpa;
    // The ORIGINAL v14 KoreanSherpaStt and its start/stop/partial/final
    // callbacks remain byte-for-byte unchanged. Playback has its OWN service.
    private static final int SPEAKER_CONSENT_REQUEST=915;
    private TextView speakerLive,speakerState,speakerHistory;
    private String speakerCommitted="";
    private boolean speakerReceiverRegistered=false;
    private final BroadcastReceiver speakerReceiver=new BroadcastReceiver(){
        @Override public void onReceive(Context ctx,Intent intent){
            if(!SpeakerPlaybackCaptureService.UPDATE.equals(intent.getAction()))return;
            String kind=intent.getStringExtra(SpeakerPlaybackCaptureService.KEY_KIND);
            String caption=intent.getStringExtra(SpeakerPlaybackCaptureService.KEY_TEXT);
            if(kind==null||caption==null)return;
            if("STATUS".equals(kind)&&speakerState!=null)speakerState.setText(caption);
            if("PARTIAL".equals(kind)&&speakerLive!=null)
                speakerLive.setText("출력음 부분 자막: "+caption);
            if("FINAL".equals(kind)&&speakerLive!=null){
                speakerLive.setText("출력음 확정 자막: "+caption);
                speakerCommitted=speakerCommitted.isEmpty()?caption:
                    speakerCommitted+System.lineSeparator()+caption;
                if(speakerHistory!=null)speakerHistory.setText(speakerCommitted);
            }
        }
    };''')

replace('''screen.addView(label("W03  |  전화 중 음성 입력 · 실시간 조작",19,true));''',
'''screen.addView(label("HITEL14 원본 · 마이크 STT + 출력음 STT",19,true));''')
replace('''flowStatus=label("① 전화 걸기 → 삼성 번호판 → 연결 → 문자통화 → HITEL 자동 복귀",12,true);''',
'''flowStatus=label("기존 한국어 마이크 STT 유지 · 출력음은 별도 입력 · 문자통화 비사용",12,true);''')
replace('''Button callTab=btn("통화 · 자막 · 입력",()->{''',
'''Button callTab=btn("마이크 · 출력음 STT",()->{''')

# Instantiate legacy widgets as before to preserve references, but remove their
# entire block from the visible surface. No OEM screen or textcall is invoked.
replace('''        line(content,"① 통화 연결");''',
'''        final int legacyTextCallStart=content.getChildCount();
        line(content,"① 통화 연결");''')
replace('''        line(content,"④ 내 목소리 → 인식 문장");''',
'''        final int legacyTextCallEnd=content.getChildCount();
        for(int n=legacyTextCallStart;n<legacyTextCallEnd;n++)
            content.getChildAt(n).setVisibility(View.GONE);

        line(content,"② 출력음 STT · 허용된 미디어/게임 소리");
        content.addView(label("Android MediaProjection이 캡처를 허용한 미디어 출력만 직접 인식합니다. "+
            "전화 상대방의 통화 수신음은 이 경로로 캡처할 수 없습니다. "+
            "스피커폰의 실제 소리를 인식하려면 원본 마이크에서 수음되는지 별도 시험하십시오.",12,false));
        Button speakerStart=btn("출력음 STT 시작 · OS 동의",this::requestSpeakerPlayback);
        Button speakerStop=btn("출력음 STT 중지",this::stopSpeakerPlayback);
        addButtonRow(content,speakerStart,speakerStop);
        speakerState=label("출력음 STT 대기 · 원본 마이크에는 영향 없음",12,false);
        speakerLive=label("출력음 부분 자막 대기",15,true);
        speakerHistory=label("출력음 확정 자막 기록",13,false);
        content.addView(speakerState);
        content.addView(speakerLive);
        content.addView(speakerHistory);

        line(content,"① 내 목소리 → 원본 한국어 STT");''')

# Remove only Text Call input's visible button, keeping the old system STT
# diagnostic button and the original v14 primary microphone/VoiceAccess UI.
replace('''        Button samsungEntry=btn("삼성 문자 입력창 보기",this::openSamsungSpeechEntry);
        addButtonRow(content,nativeStt,samsungEntry);''',
'''        content.addView(nativeStt,new LinearLayout.LayoutParams(-1,dp(48)));''')

# Samsung send/text-call UI no longer visible, but existing original STT
# editable output and W03 ZIP ending are retained.
replace('''        line(content,"⑤ 전송 방식 선택 (사용자가 직접 누릅니다)");''',
'''        final int legacyTextSendStart=content.getChildCount();
        line(content,"⑤ 전송 방식 선택 (사용자가 직접 누릅니다)");''')
replace('''        endButton=btn("W03 종료 · 결과 ZIP 저장",this::endSession);''',
'''        final int legacyTextSendEnd=content.getChildCount();
        for(int n=legacyTextSendStart;n<legacyTextSendEnd;n++)
            content.getChildAt(n).setVisibility(View.GONE);
        line(content,"③ 실행 로그 · 원본 W03 세션 저장");
        endButton=btn("W03 종료 · 결과 ZIP 저장",this::endSession);''')

replace('''        CallAccessibilityService.setConsoleRequested(true);
        ui.post(poll);''',
'''        // Samsung Text Call accessibility service is removed from AndroidManifest.
        // Keep the original W03 session, LabStore logging and microphone UI.
        ui.post(poll);''')

# Disable the old OEM-only periodic UI state flow. Original mic and 500ms log
# polling remain intact. No hidden Samsung service is requested.
start = s.index('    private void refreshState(){')
end = s.index('    private void openCallUi(){', start)
old = s[start:end]
assert 'CallAccessibilityService' in old and 'sttButton.setEnabled(recordStarted)' in old
s = s[:start] + '''    private void refreshState(){
        // No OEM Text Call routing or accessibility polling.
        // The original v14 microphone start/stop and 500ms logs remain.
        if(sttButton!=null)sttButton.setEnabled(recordStarted);
    }
''' + s[end:]

# Allow the user to continue using original W03 sessions after a ZIP export:
# existing endSession behavior is retained, with an explicit restart button.
replace('''        content.addView(endButton,new LinearLayout.LayoutParams(-1,dp(52)));''',
'''        content.addView(endButton,new LinearLayout.LayoutParams(-1,dp(52)));
        Button newSession=btn("새 W03 기록 세션 시작",()->{
            if(recordStarted){status("기존 W03 세션이 이미 실행 중입니다.");return;}
            if(LabStore.running()){status("다른 시험 세션 실행 중: "+LabStore.currentScenario());return;}
            try{
                LabStore.begin(this,"flow","W03");
                recordStarted=true;
                status("새 W03 기록 세션 시작 · 원본 한국어 마이크 STT 사용 가능");
                log("W03_SESSION_RESTART","기존 LabStore 세션 관리 재사용");
            }catch(Throwable ex){status("세션 시작 실패: "+ex);}
        });
        content.addView(newSession,new LinearLayout.LayoutParams(-1,dp(48)));''')

# Add a new MediaProjection path only. The OEM/microphone handlers are untouched.
replace('''    private void step(int index,String action,String verdict,String reason){''',
'''    private void requestSpeakerPlayback(){
        if(!recordStarted){
            if(speakerState!=null)speakerState.setText("먼저 W03 기록 세션을 시작하십시오.");
            return;
        }
        if(!has(Manifest.permission.RECORD_AUDIO)){
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},916);
            return;
        }
        MediaProjectionManager mgr=(MediaProjectionManager)
            getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if(mgr==null){
            speakerState.setText("시스템 출력 캡처 API를 사용할 수 없습니다.");
            return;
        }
        log("SPEAKER_STT_CONSENT_REQUEST","Request Android MediaProjection once per output session");
        startActivityForResult(mgr.createScreenCaptureIntent(),SPEAKER_CONSENT_REQUEST);
    }
    private void stopSpeakerPlayback(){
        Intent i=new Intent(this,SpeakerPlaybackCaptureService.class);
        i.setAction(SpeakerPlaybackCaptureService.STOP);
        try{startService(i);}catch(Throwable e){
            if(speakerState!=null)speakerState.setText("출력음 종료 오류: "+e);
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request!=SPEAKER_CONSENT_REQUEST)return;
        if(result!=RESULT_OK||data==null){
            if(speakerState!=null)speakerState.setText("사용자가 출력음 캡처를 취소했습니다.");
            return;
        }
        Intent i=new Intent(this,SpeakerPlaybackCaptureService.class);
        i.setAction(SpeakerPlaybackCaptureService.START);
        i.putExtra(SpeakerPlaybackCaptureService.KEY_RESULT,result);
        i.putExtra(SpeakerPlaybackCaptureService.KEY_DATA,data);
        try{
            startForegroundService(i);
            if(speakerState!=null)speakerState.setText("미디어 출력음 캡처 시작 요청 · 실제 신호 확인 대기");
        }catch(Throwable e){
            if(speakerState!=null)speakerState.setText("캡처 서비스 시작 실패: "+e);
            log("SPEAKER_STT_SERVICE_ERROR",e.toString());
        }
    }
    private void step(int index,String action,String verdict,String reason){''')

# Before ending a W03 run, also stop the independent OUTPUT path.
replace('''            LabStore.finishRun(this,"W03 전면 조작 종료. 단계별 결과와 전체 로그 저장");''',
'''            stopSpeakerPlayback();
            LabStore.finishRun(this,"HITEL14 원본 W03 세션 종료. 마이크/출력음 진단 로그 저장");''')

# Phone-state/accessibility onboarding prompts do not belong in the audio-only
# user flow. Preserve source methods (not accessed) for provenance.
start=s.index('    @Override protected void onResume(){super.onResume();')
end=s.index('    @Override protected void onDestroy(){',start)
s=s[:start]+'''    @Override protected void onResume(){
        super.onResume();
        if(!speakerReceiverRegistered){
            IntentFilter filter=new IntentFilter(SpeakerPlaybackCaptureService.UPDATE);
            if(Build.VERSION.SDK_INT>=33)
                registerReceiver(speakerReceiver,filter,Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(speakerReceiver,filter);
            speakerReceiverRegistered=true;
        }
    }
''' + s[end:]

replace('''        ui.removeCallbacks(poll);destroyRecognizer();''',
'''        if(speakerReceiverRegistered){
            try{unregisterReceiver(speakerReceiver);}catch(Throwable ignored){}
            speakerReceiverRegistered=false;
        }
        if(isFinishing())stopService(new Intent(this,SpeakerPlaybackCaptureService.class));
        ui.removeCallbacks(poll);destroyRecognizer();''')

w03.write_text(s,encoding="utf-8")

m=manifest.read_text(encoding="utf-8")
assert '<service android:name=".CallAccessibilityService"' in m
start=m.index('        <service android:name=".CallAccessibilityService"')
end=m.index('        </service>',start)+len('        </service>')+1
m=m[:start]+m[end:]
m=m.replace('''    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC"/>''',
'''    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"/>''')
# The original W03 is now the launch screen, instead of the Text Call catalogue.
m=m.replace('''        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter>
        </activity>
        <activity android:name=".W03ConsoleActivity" android:exported="false" android:launchMode="singleTop" android:windowSoftInputMode="adjustResize"/>''',
'''        <activity android:name=".MainActivity" android:exported="false"/>
        <activity android:name=".W03ConsoleActivity" android:exported="true" android:launchMode="singleTop" android:windowSoftInputMode="adjustResize">
            <intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter>
        </activity>''')
assert 'android:name=".W03ConsoleActivity" android:exported="true"' in m
m=m.replace('''        <service android:name=".ScenarioEngineService" android:exported="false" android:stopWithTask="false" android:foregroundServiceType="dataSync"/>''',
'''        <service android:name=".ScenarioEngineService" android:exported="false" android:stopWithTask="false" android:foregroundServiceType="dataSync"/>
        <service android:name=".SpeakerPlaybackCaptureService" android:exported="false" android:foregroundServiceType="mediaProjection"/>''')
m=m.replace('HITEL 통화 실시간 자막 v0.14 (한국어 STT)',
            'HITEL14 · 원본 마이크 STT + 출력음 STT')
# Remove Samsung-specific package visibility for the active application.
query_start=m.index('    <queries>')
query_end=m.index('    </queries>',query_start)+len('    </queries>')
m=m[:query_start]+'''    <queries>
        <intent><action android:name="android.speech.RecognitionService"/></intent>
    </queries>'''+m[query_end:]
manifest.write_text(m,encoding="utf-8")

g=gradle.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v14"' in g
assert 'versionCode = 21' in g
g=g.replace('versionCode = 21','versionCode = 22',1)
g=g.replace('0.14.7-voice-access-audio-ab',
            '0.14.8-original-mic-plus-playback',1)
gradle.write_text(g,encoding="utf-8")

after_mic=(src / "KoreanSherpaStt.java").read_bytes()
assert after_mic == expected_mic, "BUG: original microphone STT changed!"
assert 'private void startKoreanSherpaSpeech(){' in s
assert 'private void stopKoreanSherpaSpeech(){' in s
assert 'screen.addView(pinnedLiveCaption,5' in s
assert 'LabStore.begin(this,"flow","W03")' in s
assert 'refreshTranscripts();refreshLogs();' in s
assert 'SpeakerPlaybackCaptureService' in s
assert 'CallAccessibilityService' not in m
assert 'android:foregroundServiceType="mediaProjection"' in m
print("PASS: original KoreanSherpaStt.java SHA256:",
      hashlib.sha256(after_mic).hexdigest())
print("PASS: HITEL14 W03/Log/Session/Mic retained; TextCall UI/service removed; media playback added")
