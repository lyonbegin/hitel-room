#!/usr/bin/env python3
"""Add real Samsung growing-M4A -> AAC -> 16kHz PCM -> Sherpa STT inside V22.
Runs AFTER v17 V22 reconstruction. Preserves microphone and MediaProjection
source byte-for-byte. No AudioTrack or recording-to-speaker playback.
"""
from pathlib import Path
import hashlib, shutil

base=Path("AndroidProject/app")
src=base/"src/main/java/app/hitel/samsungprobe"
w=src/"W03ConsoleActivity.java"
manifest=base/"src/main/AndroidManifest.xml"
gradle=base/"build.gradle.kts"
v5=Path("speaker-standalone/app/src/main")
v5java=v5/"java/app/hitel/speakeronly"
before={x:(src/x).read_bytes() for x in (
    "KoreanSherpaStt.java","SpeakerPlaybackStt.java",
    "SpeakerPlaybackCaptureService.java","SpeakerCaptureLog.java")}
assert 'app.hitel.callflowlab.v14.systempicker' in gradle.read_text()
assert 'HITEL14 시스템 단일앱선택 V22' in manifest.read_text()

# Copy only audited source modules; do NOT import PcmSpeakerMonitor / AudioTrack.
for name in ("GrowingM4aSelector","StreamingAacPcmDecoder","SpeakerEngine",
             "SpeakerService","TraceJournal","LatencyTrace",
             "CallStateGate","SamsungRecordAccessibility"):
    code=(v5java/(name+".java")).read_text(encoding="utf-8")
    code=code.replace("app.hitel.speakeronly","app.hitel.samsungprobe")
    if name=="SpeakerEngine":
        assert code.count("PcmSpeakerMonitor")==5
        code=code.replace("PcmSpeakerMonitor","PcmDirectSherpaSink")
        code=code.replace("AudioTrack monitor stopped","Direct STT sink stopped")
        code=code.replace("ONLY: Samsung growing M4A", "Samsung growing M4A")
        code=code.replace("-> AudioTrack. No STT/ASR/VAD/model code or dependency.",
                          "-> live Sherpa-ONNX direct PCM STT; no speaker playback.")
        code=code.replace('"SPEAKER_ONLY_ENGINE_STARTED"','"DIRECT_PCM_ENGINE_STARTED"')
        code=code.replace('"sttModel",false','"sttModel",true')
        code=code.replace('"sttProcessStarted",false','"sttProcessStarted",true')
        code=code.replace('"AudioTrack is intentionally NOT created yet: wait until PCM arrives."',
                          '"STT sink is ready; there is no AudioTrack."')
    if name=="SpeakerService":
        code=code.replace('new Intent(this,MainActivity.class)',
                          'new Intent(this,W03ConsoleActivity.class)')
        code=code.replace('getSharedPreferences("speaker",MODE_PRIVATE)',
                          'getSharedPreferences("hitel_direct_stt",MODE_PRIVATE)')
        code=code.replace('"sttEnginePresent",false','"sttEnginePresent",true')
        code=code.replace('"modelDownload",false','"modelDownload",true')
        code=code.replace('"sttProcessStarted",false','"sttProcessStarted",true')
        code=code.replace('"통화 녹음 → 16kHz 스피커 실시간 재생"',
                          '"HITEL14 통화녹음 PCM 직접 STT"')
        code=code.replace('"선택한 출력 장치로 PCM 스트리밍 · STT 없음"',
                          '"AAC → 16kHz PCM → Sherpa STT · 스피커 출력 없음"')
        code=code.replace('"통화 이벤트 감시 준비 중"',
                          '"통화 감지 및 PCM 직접 인식 준비 중"')
        code=code.replace('"선택한 녹음 파일 수동 재생 시작"',
                          '"선택한 녹음 파일 PCM 직접 인식 시작"')
        code=code.replace('"통화 종료 이벤트 → 스피커 즉시 중지 · 로그 저장"',
                          '"통화 종료 이벤트 → 직접 STT 정리 · 로그 저장"')
        code=code.replace('"통화 종료 · 다음 통화 시작 이벤트 대기 · 스피커 꺼짐"',
                          '"통화 종료 · 다음 통화 이벤트 대기"')
    if name=="TraceJournal":
        code=code.replace("This app contains no STT or speech recognition model.",
                          "This app converts growing Samsung AAC to 16kHz PCM and directly runs Sherpa ASR.")
    (src/(name+".java")).write_text(code,encoding="utf-8")

shutil.copyfile("flow-lab/PcmDirectSherpaSink.java",
                src/"PcmDirectSherpaSink.java")
res=base/"src/main/res/xml"
res.mkdir(parents=True,exist_ok=True)
shutil.copyfile(v5/"res/xml/samsung_record_accessibility.xml",
                res/"samsung_record_accessibility.xml")

s=w.read_text(encoding="utf-8")
def patch(old,new):
    global s
    if s.count(old)!=1:
        raise AssertionError("Nonunique / missing V22 anchor: "+old[:130])
    s=s.replace(old,new,1)

patch('''    private TextView nativeSelectedCaptureStatus;''',
'''    private TextView nativeSelectedCaptureStatus;
    private static final int DIRECT_FOLDER_PICK=1181;
    private static final int DIRECT_FILE_PICK=1182;
    private TextView directSttStatus,directSttLive,directSttHistory;
    private String directCommitted="";
    private boolean directReceiverRegistered=false;
    private final BroadcastReceiver directReceiver=new BroadcastReceiver(){
        @Override public void onReceive(Context ctx,Intent intent){
            if(!SpeakerService.EVENT.equals(intent.getAction()))return;
            String value=intent.getStringExtra(SpeakerService.EX_STATUS);
            if(value==null)return;
            if(value.startsWith("DIRECT_PARTIAL|")){
                if(directSttLive!=null)directSttLive.setText(
                    "PCM 직접 인식 중: "+value.substring("DIRECT_PARTIAL|".length()));
            }else if(value.startsWith("DIRECT_FINAL|")){
                String text=value.substring("DIRECT_FINAL|".length());
                if(directSttLive!=null)directSttLive.setText("PCM 확정: "+text);
                directCommitted=directCommitted.isEmpty()?text:
                    directCommitted+System.lineSeparator()+text;
                if(directSttHistory!=null)directSttHistory.setText(directCommitted);
                SpeakerCaptureLog.append(W03ConsoleActivity.this,"DIRECT_ASR_FINAL",text);
            }else{
                if(directSttStatus!=null)directSttStatus.setText(value);
                SpeakerCaptureLog.append(W03ConsoleActivity.this,"DIRECT_STATUS",value);
            }
        }
    };''')

patch('''        line(content,"① 내 목소리 → 원본 한국어 STT");''',
'''        line(content,"③ 삼성 통화 녹음 PCM → 한국어 직접 STT");
        content.addView(label("삼성 녹음 중 M4A 증가분 → AAC MediaCodec → "+
            "16kHz PCM → Sherpa-ONNX · AudioTrack/스피커 재생 없음. "+
            "녹음 폴더는 한 번만 선택하시면 저장되며, 통화 이벤트 감시 중에는 "+
            "녹음 파일 증가가 검증되면 인식합니다.",12,false));
        Button directFolder=btn("삼성 통화녹음 폴더 선택 (자동 감시)",
            this::selectDirectRecordingFolder);
        Button directFile=btn("M4A 파일 선택 (수동 직접 STT)",
            this::selectDirectRecordingFile);
        addButtonRow(content,directFolder,directFile);
        Button directStart=btn("PCM 직접 STT 시작",this::startDirectRecordingStt);
        Button directStop=btn("PCM 직접 STT 중지",this::stopDirectRecordingStt);
        addButtonRow(content,directStart,directStop);
        Button directAccessibility=btn("삼성 녹음 시작 보조 접근성 설정",
            ()->startActivity(new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        content.addView(directAccessibility,
            new LinearLayout.LayoutParams(-1,dp(48)));
        directSttStatus=label("직접 PCM STT 대기 · 삼성 녹음 폴더를 선택하십시오.",12,false);
        directSttLive=label("직접 PCM 부분 자막 대기",15,true);
        directSttHistory=label("PCM 확정 자막 기록",13,false);
        content.addView(directSttStatus);
        content.addView(directSttLive);
        content.addView(directSttHistory);
        line(content,"① 내 목소리 → 원본 한국어 STT");''')

patch('''    private void requestSpeakerPlayback(){''',
'''    private void selectDirectRecordingFolder(){
        Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(i,DIRECT_FOLDER_PICK);
    }
    private void selectDirectRecordingFile(){
        Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("audio/*");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(i,DIRECT_FILE_PICK);
    }
    private void startDirectRecordingStt(){
        android.content.SharedPreferences prefs=getSharedPreferences("hitel_direct_source",MODE_PRIVATE);
        String raw=prefs.getString("uri",null);
        boolean folder=prefs.getBoolean("folder",true);
        if(raw==null||raw.isEmpty()){
            if(directSttStatus!=null)directSttStatus.setText(
                "녹음 폴더 또는 M4A 파일을 먼저 선택하십시오.");
            return;
        }
        if(folder && !has(Manifest.permission.READ_PHONE_STATE)){
            requestPermissions(new String[]{Manifest.permission.READ_PHONE_STATE},1183);
            if(directSttStatus!=null)directSttStatus.setText(
                "통화 상태 권한을 승인하신 다음 PCM 직접 STT 시작을 다시 누르십시오.");
            return;
        }
        Intent service=new Intent(this,SpeakerService.class);
        service.setAction(SpeakerService.START);
        service.putExtra(SpeakerService.EX_URI,raw);
        service.putExtra(SpeakerService.EX_FOLDER,folder);
        service.putExtra(SpeakerService.EX_DEVICE,-1);
        try{
            startForegroundService(service);
            if(directSttStatus!=null)directSttStatus.setText(folder?
                "통화 상태 자동 감시 시작 요청 · 녹음 파일 증가 확인 대기":
                "선택한 M4A를 직접 STT 처리 시작 요청");
            SpeakerCaptureLog.append(this,"DIRECT_STT_REQUEST",
                "folder="+folder+"; SAF="+raw);
        }catch(Throwable error){
            if(directSttStatus!=null)directSttStatus.setText(
                "PCM 직접 STT 서비스 시작 실패: "+error);
            SpeakerCaptureLog.append(this,"DIRECT_STT_START_ERROR",error.toString());
        }
    }
    private void stopDirectRecordingStt(){
        Intent service=new Intent(this,SpeakerService.class);
        service.setAction(SpeakerService.STOP);
        try{startService(service);}
        catch(Throwable error){
            if(directSttStatus!=null)directSttStatus.setText("직접 STT 종료 오류: "+error);
        }
    }
    private void requestSpeakerPlayback(){''')

patch('''        if(request!=SPEAKER_CONSENT_REQUEST)return;''',
'''        if(request==DIRECT_FOLDER_PICK||request==DIRECT_FILE_PICK){
            if(result!=RESULT_OK||data==null||data.getData()==null){
                if(directSttStatus!=null)directSttStatus.setText("녹음 소스 선택 취소");
                return;
            }
            android.net.Uri uri=data.getData();
            try{
                getContentResolver().takePersistableUriPermission(uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }catch(SecurityException ex){
                if(directSttStatus!=null)directSttStatus.setText(
                    "지속 권한 저장 실패: "+ex+" · 폴더 재선택 필요");
                return;
            }
            boolean folder=request==DIRECT_FOLDER_PICK;
            getSharedPreferences("hitel_direct_source",MODE_PRIVATE).edit()
                .putString("uri",uri.toString()).putBoolean("folder",folder).apply();
            if(directSttStatus!=null)directSttStatus.setText(
                (folder?"자동 감시 폴더: ":"수동 인식 M4A: ")+uri+
                " · PCM 직접 STT 시작을 누르십시오.");
            SpeakerCaptureLog.append(this,"DIRECT_SOURCE_SELECTED",
                "folder="+folder+"; uri="+uri);
            return;
        }
        if(request!=SPEAKER_CONSENT_REQUEST)return;''')

patch('''        if(speakerReceiverRegistered){
            try{unregisterReceiver(speakerReceiver);}catch(Throwable ignored){}
            speakerReceiverRegistered=false;
        }''',
'''        if(speakerReceiverRegistered){
            try{unregisterReceiver(speakerReceiver);}catch(Throwable ignored){}
            speakerReceiverRegistered=false;
        }
        if(directReceiverRegistered){
            try{unregisterReceiver(directReceiver);}catch(Throwable ignored){}
            directReceiverRegistered=false;
        }''')

patch('''        if(!speakerReceiverRegistered){
            IntentFilter filter=new IntentFilter(SpeakerPlaybackCaptureService.UPDATE);''',
'''        if(!directReceiverRegistered){
            IntentFilter directFilter=new IntentFilter(SpeakerService.EVENT);
            if(Build.VERSION.SDK_INT>=33)
                registerReceiver(directReceiver,directFilter,Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(directReceiver,directFilter);
            directReceiverRegistered=true;
        }
        if(directSttStatus!=null){
            android.content.SharedPreferences state=
                getSharedPreferences("hitel_direct_stt",MODE_PRIVATE);
            String saved=state.getString("status",null);
            if(saved!=null&&!saved.isEmpty())directSttStatus.setText(saved);
        }
        if(!speakerReceiverRegistered){
            IntentFilter filter=new IntentFilter(SpeakerPlaybackCaptureService.UPDATE);''')

w.write_text(s,encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
assert '<application' in m and 'android:label=' in m
m=m.replace('HITEL14 시스템 단일앱선택 V22',
            'HITEL14 V23 PCM 직접 STT 통합',1)
assert '<uses-permission android:name="android.permission.READ_PHONE_STATE"/>' in m
m=m.replace('<application',
'''<application android:extractNativeLibs="true"''',1)
needle='<service android:name=".SpeakerPlaybackCaptureService"'
assert needle in m
m=m.replace(needle,
'''<service android:name=".SpeakerService" android:exported="false"
                 android:foregroundServiceType="dataSync"/>
        <service android:name=".SamsungRecordAccessibility"
                 android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
                 android:exported="true"
                 android:label="HITEL 통화녹음 시작 보조">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService"/>
            </intent-filter>
            <meta-data android:name="android.accessibilityservice"
                       android:resource="@xml/samsung_record_accessibility"/>
        </service>
        <service android:name=".SpeakerPlaybackCaptureService"''',1)
manifest.write_text(m,encoding="utf-8")

g=gradle.read_text(encoding="utf-8")
assert 'versionCode = 30' in g
g=g.replace('versionCode = 30','versionCode = 31',1)
g=g.replace('0.14.16-native-system-picker-v22',
            '0.14.17-integrated-direct-pcm-v23',1)
if "androidx.documentfile:documentfile" not in g:
    g+='\\ndependencies { implementation("androidx.documentfile:documentfile:1.0.1") }\\n'
if "useLegacyPackaging" not in g:
    assert "android {" in g
    g=g.replace("android {","android {\\n    packaging { jniLibs { useLegacyPackaging = true } }",1)
gradle.write_text(g,encoding="utf-8")

for name,old in before.items():
    assert (src/name).read_bytes()==old, "V22 source modified: "+name
for name in ("SpeakerEngine","SpeakerService","StreamingAacPcmDecoder"):
    code=(src/(name+".java")).read_text()
    assert "app.hitel.speakeronly" not in code
assert "new PcmDirectSherpaSink" in (src/"SpeakerEngine.java").read_text()
assert "PcmSpeakerMonitor" not in (src/"SpeakerEngine.java").read_text()
assert not (src/"PcmSpeakerMonitor.java").exists()
assert "new AudioTrack(" not in (src/"PcmDirectSherpaSink.java").read_text()
assert "DIRECT_FOLDER_PICK" in s and "SpeakerService.EVENT" in s
print("PASS V23 direct PCM STT wiring, no AudioTrack/speaker replay")
print("PASS V22 original mic/output/system picker/diagnostic sources SHA256 retained")
for name,old in before.items():
    print(name,hashlib.sha256(old).hexdigest())
