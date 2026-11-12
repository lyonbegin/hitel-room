#!/usr/bin/env python3
"""V21: selected target never opens. Capture selected UID, persist choice,
allow switching, save source evidence. Requires v15 then v16 first.
Standalone 16kHz recorder/audio sender is intentionally left unchanged.
"""
from pathlib import Path
import shutil
import hashlib

app=Path("AndroidProject/app")
src=app/"src/main/java/app/hitel/samsungprobe"
w=src/"W03ConsoleActivity.java"
m=app/"src/main/AndroidManifest.xml"
g=app/"build.gradle.kts"
mic=(src/"KoreanSherpaStt.java").read_bytes()
assert mic==Path("flow-lab/KoreanSherpaStt.java").read_bytes()
for name in ("SpeakerTargetPicker.java","SpeakerPlaybackStt.java",
             "SpeakerPlaybackCaptureService.java"):
    shutil.copyfile(Path("flow-lab")/name,src/name)

s=w.read_text(encoding="utf-8")
def patch(old,new):
    global s
    if s.count(old)!=1:
        raise AssertionError("W03 anchor absent/multiple: "+old[:130])
    s=s.replace(old,new,1)
patch("import android.media.projection.MediaProjectionManager;",
      "import android.media.projection.MediaProjectionManager;\n"+
      "import android.media.projection.MediaProjectionConfig;")
patch("    private TextToSpeech ownMediaTestTts;",
      "    private TextToSpeech ownMediaTestTts;\n"+
      "    private TextView speakerSelectedTarget;\n"+
      "    private boolean speakerCaptureStarted=false;")
patch('''        screen.addView(speakerLogExport,new LinearLayout.LayoutParams(-1,dp(56)));
        screen.addView(tabs);''',
'''        screen.addView(speakerLogExport,new LinearLayout.LayoutParams(-1,dp(52)));
        speakerSelectedTarget=label("선택된 출력음 캡처 대상: 확인 중",14,true);
        screen.addView(speakerSelectedTarget,new LinearLayout.LayoutParams(-1,dp(58)));
        Button targetPicker=btn("📱 출력음 캡처 대상 선택·변경 (앱은 실행되지 않음)",
            this::chooseSpeakerCaptureTarget);
        screen.addView(targetPicker,new LinearLayout.LayoutParams(-1,dp(58)));
        screen.addView(tabs);''')
patch('''        Button speakerStart=btn("출력음 STT 시작 · OS 동의",this::requestSpeakerPlayback);''',
'''        Button speakerStart=btn("선택 앱 출력음 STT 시작 · 시스템 동의",this::requestSpeakerPlayback);''')
patch('''        line(content,"② 출력음 STT · 허용된 미디어/게임 소리");''',
'''        line(content,"② 출력음 STT · 허용된 미디어/게임 소리");''')
patch('''        line(content,"③ 실행 로그 · 원본 W03 세션 저장");''',
'''        line(content,"③ 실행 로그 · 원본 W03 세션 저장");''')
patch('''    private void requestSpeakerPlayback(){''',
'''    private void refreshSpeakerCaptureTarget(){
        SpeakerTargetPicker.Target selected=SpeakerTargetPicker.get(this);
        if(speakerSelectedTarget!=null)
            speakerSelectedTarget.setText("현재 선택: "+selected.display()+
                (selected.isPhone()?"\\n전화 통화 수신음은 스피커폰에서도 캡처 제외":""));
    }
    private void chooseSpeakerCaptureTarget(){
        SpeakerTargetPicker.show(this,selected->{
            refreshSpeakerCaptureTarget();
            SpeakerCaptureLog.append(this,"TARGET_CHANGED",
                "selected="+selected.display()+" · app NOT launched");
            if(speakerCaptureStarted){
                stopSpeakerPlayback();
                speakerCaptureStarted=false;
            }
            if(speakerState!=null)
                speakerState.setText("대상 선택 완료: "+selected.display()+
                    "\\n변경된 앱을 인식하려면 '선택 앱 출력음 STT 시작'을 누르십시오."+
                    (selected.isPhone()?
                    "\\n통화 상대 음성은 일반 미디어 캡처 불가; 스피커폰도 동일.":""));
        });
    }
    private void requestSpeakerPlayback(){''')
patch('''        log("SPEAKER_STT_CONSENT_REQUEST","Request Android MediaProjection once per output session");
        SpeakerCaptureLog.append(this,"CONSENT_REQUEST",
            "User requested per-app or whole-display audio capture");
        startActivityForResult(mgr.createScreenCaptureIntent(),SPEAKER_CONSENT_REQUEST);''',
'''        SpeakerTargetPicker.Target selected=SpeakerTargetPicker.get(this);
        refreshSpeakerCaptureTarget();
        if(selected.uid==-2){
            if(speakerState!=null)speakerState.setText(
                "선택 앱을 찾을 수 없습니다. 캡처 대상을 다시 선택하십시오: "+
                selected.packageName);
            return;
        }
        SpeakerCaptureLog.append(this,"CONSENT_REQUEST",
            "Full-display audio-only permission; actual app filtered by UID"+
            " · selected="+selected.display()+" · target app NOT launched");
        // On Android 14+, asking the SYSTEM to choose a SINGLE app launches
        // that app. Ask only for full-display MediaProjection consent.
        // AudioRecord then filters audio by the selected UID, independently.
        if(Build.VERSION.SDK_INT>=34){
            startActivityForResult(mgr.createScreenCaptureIntent(
                MediaProjectionConfig.createConfigForDefaultDisplay()),
                SPEAKER_CONSENT_REQUEST);
        }else{
            startActivityForResult(mgr.createScreenCaptureIntent(),
                SPEAKER_CONSENT_REQUEST);
        }''')
patch('''        i.putExtra(SpeakerPlaybackCaptureService.KEY_DATA,data);
        try{
            startForegroundService(i);''',
'''        i.putExtra(SpeakerPlaybackCaptureService.KEY_DATA,data);
        SpeakerTargetPicker.Target selected=SpeakerTargetPicker.get(this);
        if(selected.uid==-2){
            if(speakerState!=null)
                speakerState.setText("선택 앱이 설치되지 않았거나 패키지 조회 불가");
            return;
        }
        i.putExtra(SpeakerPlaybackCaptureService.KEY_TARGET_UID,selected.uid);
        i.putExtra(SpeakerPlaybackCaptureService.KEY_TARGET_PACKAGE,selected.packageName);
        i.putExtra(SpeakerPlaybackCaptureService.KEY_TARGET_LABEL,selected.label);
        try{
            startForegroundService(i);
            speakerCaptureStarted=true;''')
patch('''    private void stopSpeakerPlayback(){
        Intent i=new Intent(this,SpeakerPlaybackCaptureService.class);''',
'''    private void stopSpeakerPlayback(){
        speakerCaptureStarted=false;
        Intent i=new Intent(this,SpeakerPlaybackCaptureService.class);''')
patch('''        setContentView(screen);''',
'''        setContentView(screen);
        refreshSpeakerCaptureTarget();''')
patch('''            if("STATUS".equals(kind)&&speakerState!=null)speakerState.setText(caption);''',
'''            if("STATUS".equals(kind)&&speakerState!=null){
                speakerState.setText(caption);
                if(caption.startsWith("출력음 STT 세션 종료") ||
                   caption.startsWith("출력음 STT 종료") ||
                   caption.startsWith("Android에서 출력 캡처를 종료"))
                    speakerCaptureStarted=false;
            }''')
w.write_text(s,encoding="utf-8")

xml=m.read_text(encoding="utf-8")
assert "<application" in xml
queries='''    <queries>
      <intent>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent>
      <package android:name="com.samsung.android.dialer"/>
      <package android:name="com.samsung.android.incallui"/>
      <package android:name="com.google.android.dialer"/>
      <package android:name="com.android.phone"/>
      <package android:name="app.hitel.recording.speakeronly"/>
    </queries>
'''
# W03 already has a <queries> section for legacy dialer/TTS package
# visibility; merge into it instead of failing or creating duplicate sections.
if "</queries>" in xml:
    xml=xml.replace("</queries>",queries.replace("    <queries>","").replace("    </queries>","")+"</queries>",1)
else:
    xml=xml.replace("    <application",queries+"    <application",1)
assert 'HITEL14 출력음진단로그 V20' in xml
xml=xml.replace('HITEL14 출력음진단로그 V20',
                'HITEL14 캡처대상선택 V21',1)
m.write_text(xml,encoding="utf-8")

gd=g.read_text(encoding="utf-8")
assert 'versionCode = 28' in gd
gd=gd.replace('versionCode = 28','versionCode = 29',1)
gd=gd.replace('0.14.14-speaker-stt-durable-diagnostic-log',
             '0.14.15-uid-target-selector-v21',1)
gd=gd.replace('app.hitel.callflowlab.v14.speakerlog',
              'app.hitel.callflowlab.v14.speakerselect',1)
g.write_text(gd,encoding="utf-8")

assert (src/"KoreanSherpaStt.java").read_bytes()==mic
assert 'addMatchingUid(targetUid)' in (src/"SpeakerPlaybackStt.java").read_text()
assert 'createConfigForDefaultDisplay()' in s
assert 'SpeakerTargetPicker.show(this' in s
assert 'android.intent.category.LAUNCHER' in xml
assert 'RecordingFolderPlayback' not in s
print("PASS_V21_UID_FILTER_AND_IN_APP_SELECTION_WITHOUT_TARGET_LAUNCH")
print("PASS_V21_SELECTED_APP_VISIBLE_AND_REPLACEABLE")
print("PASS_V21_ANDROID14_FULL_DISPLAY_CONSENT_OPTION")
print("PASS_V21_MIC_ORIGINAL_SHA256",hashlib.sha256(mic).hexdigest())
