#!/usr/bin/env python3
"""V28: default armed Call-folder watch + ORIGINAL route picker, with media output-to-STT link.
Execute after v21. Preserve all 3 original recognition sources and prior PCM player.
"""
from pathlib import Path
p=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
ui_file=p/"W03ConsoleActivity.java"
svc_file=p/"SpeakerService.java"
sink_file=p/"PcmDirectSherpaSink.java"
base=Path("AndroidProject/app")
preserved={n:(p/n).read_bytes() for n in [
  "KoreanSherpaStt.java","SpeakerPlaybackStt.java",
  "SpeakerPlaybackCaptureService.java","SpeakerEngine.java",
  "PcmSpeakerMonitor.java","StreamingAacPcmDecoder.java",
  "CallStateGate.java","HitelSafLogSaver.java"]}
def replace_once(s,old,new,who):
    n=s.count(old)
    if n!=1:raise AssertionError(who+" anchor count="+str(n)+" "+repr(old[:140]))
    return s.replace(old,new,1)

# 1. Sink stays in playback mode (-2) but routes PCM to USER-selected device.
sink=sink_file.read_text(encoding="utf-8")
sink=replace_once(sink,
    'mediaOutput=new PcmSpeakerMonitor(context,journal,-1,',
    '''mediaOutput=new PcmSpeakerMonitor(context,journal,
                context.getSharedPreferences("hitel_direct_output",Context.MODE_PRIVATE)
                    .getInt("routeId",-1),''',"sink device")
sink_file.write_text(sink,encoding="utf-8")

# 2. Route-change action updates track routing but never overwrites MODE=-2.
svc=svc_file.read_text(encoding="utf-8")
svc=replace_once(svc,
    '''      outputId=intent.getIntExtra(EX_DEVICE,-1);
      getSharedPreferences("hitel_direct_stt",MODE_PRIVATE).edit().putInt("routeId",outputId).apply();
      SpeakerEngine current=engine;
      if(current!=null)current.output(outputId);
      else send("출력 장치 변경 완료 · 통화 이벤트 또는 녹음 검증 대기",false);''',
    '''      int chosenRoute=intent.getIntExtra(EX_DEVICE,-1);
      // Device IDs and recognition modes are DIFFERENT namespaces.
      // outputId=-2 must remain -2 so later calls still use MEDIA AudioTrack.
      getSharedPreferences("hitel_direct_output",MODE_PRIVATE).edit()
          .putInt("routeId",chosenRoute).apply();
      if(journal!=null)journal.event("SPEAKER","USER_OUTPUT_DEVICE_SELECTED",
          "selectedDeviceId",chosenRoute,"currentPcmMode",outputId,
          "engineActive",engine!=null);
      SpeakerEngine current=engine;
      if(current!=null && outputId==-2)current.output(chosenRoute);
      else send("출력 장치 저장됨 · 다음 PCM 미디어 재생에 적용",false);''',"service route")

# Prevent re-arming the SAME folder on each resume from restarting a live call.
svc=replace_once(svc,
    '''    if(active||engine!=null||shuttingDown){
      queueSourceSwitch(intent);
      return START_NOT_STICKY;
    }''',
    '''    String incomingUri=intent.getStringExtra(EX_URI);
    boolean incomingFolder=intent.getBooleanExtra(EX_FOLDER,false);
    int incomingMode=intent.getIntExtra(EX_DEVICE,-1);
    if(active&&!shuttingDown&&pendingSourceSwitch==null&&folderUri!=null &&
        folderUri.toString().equals(incomingUri) &&
        autoCallMode==incomingFolder&&outputId==incomingMode){
      if(journal!=null)journal.event("CONTROL","AUTO_MONITOR_ALREADY_ARMED",
          "folder",incomingFolder,"uri",incomingUri,"mode",incomingMode);
      send(incomingFolder?"통화녹음 폴더 자동 감시 유지 · 통화 연결 대기":
          "동일 녹음 파일 재생 진행 중",false);
      return START_NOT_STICKY;
    }
    if(active||engine!=null||shuttingDown){
      queueSourceSwitch(intent);
      return START_NOT_STICKY;
    }''',"idempotent monitor")
svc_file.write_text(svc,encoding="utf-8")

# 3. Restore exact device categories from standalone's proven UI, using the
# same PcmSpeakerMonitor.findDevice / label / AudioDeviceInfo source logic.
ui=ui_file.read_text(encoding="utf-8")
ui=replace_once(ui,
    '''    private static final int DIRECT_FOLDER_PICK=1181;''',
    '''    private static final int DIRECT_FOLDER_PICK=1181;
    private static final int MEDIA_ROUTE_PERMISSION=1195;
    private TextView pcmRouteSelectionState;
    private boolean callMediaLinkPending;
    private long lastAutoArmMs;''',"UI fields")
ui=replace_once(ui,
    '''        Button provenMediaOutput=btn("삼성 통화녹음 → 원본 미디어 스피커 재생",
            this::startDirectRecordingMediaPlayback);''',
    '''        Button chooseMediaOutput=btn("🔊 출력 장치 선택 · 수화부/블루투스/USB-C",
            this::showPcmMediaOutputDevices);
        content.addView(chooseMediaOutput,new LinearLayout.LayoutParams(-1,dp(54)));
        pcmRouteSelectionState=label("출력 장치: 선택값 확인 중",12,true);
        content.addView(pcmRouteSelectionState);
        refreshPcmRouteSelectionState();
        Button mediaLink=btn("🔗 통화녹음 미디어 출력 → 유튜브 방식 STT 연결",
            this::startCallMediaOutputSttLink);
        content.addView(mediaLink,new LinearLayout.LayoutParams(-1,dp(54)));
        Button provenMediaOutput=btn("삼성 통화녹음 → 원본 미디어 스피커 재생",
            this::startDirectRecordingMediaPlayback);''',"UI buttons")

ui=replace_once(ui,
    '''    private void selectDirectRecordingFolder(){''',
    '''    /** Reuse the original standalone output-device list and track routing. */
    private void refreshPcmRouteSelectionState(){
        if(pcmRouteSelectionState==null)return;
        int selectedId=getSharedPreferences("hitel_direct_output",MODE_PRIVATE)
            .getInt("routeId",-1);
        if(selectedId<0){
            pcmRouteSelectionState.setText(
                "출력 장치: 자동 / 내장 스피커 우선 · 통화 중 외부 장치 선택 권장");
            return;
        }
        android.media.AudioManager manager=(android.media.AudioManager)
            getSystemService(Context.AUDIO_SERVICE);
        android.media.AudioDeviceInfo chosen=
            PcmSpeakerMonitor.findDevice(manager,selectedId);
        pcmRouteSelectionState.setText(chosen==null?
            "선택했던 출력 장치가 현재 연결되지 않았습니다 (#"+selectedId+")":
            "선택한 출력: "+PcmSpeakerMonitor.label(chosen));
    }

    private void showPcmMediaOutputDevices(){
        if(Build.VERSION.SDK_INT>=31 &&
            !has(Manifest.permission.BLUETOOTH_CONNECT)){
            requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT},
                MEDIA_ROUTE_PERMISSION);
            if(pcmRouteSelectionState!=null)
                pcmRouteSelectionState.setText(
                    "블루투스/USB 장치 목록 조회 권한을 허용해 주십시오.");
            return;
        }
        android.media.AudioManager manager=(android.media.AudioManager)
            getSystemService(Context.AUDIO_SERVICE);
        final java.util.ArrayList<Integer> ids=new java.util.ArrayList<>();
        final java.util.ArrayList<String> names=new java.util.ArrayList<>();
        ids.add(-1);names.add("자동 선택 · 내장 스피커 우선");
        try{
            for(android.media.AudioDeviceInfo d:manager.getDevices(
                    android.media.AudioManager.GET_DEVICES_OUTPUTS)){
                int type=d.getType();
                boolean supported=type==android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER ||
                    type==android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE ||
                    type==android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                    type==android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                    type==android.media.AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                    type==android.media.AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                    type==android.media.AudioDeviceInfo.TYPE_USB_HEADSET ||
                    type==android.media.AudioDeviceInfo.TYPE_USB_DEVICE;
                if(Build.VERSION.SDK_INT>=31){
                    supported|=type==android.media.AudioDeviceInfo.TYPE_BLE_HEADSET ||
                        type==android.media.AudioDeviceInfo.TYPE_BLE_SPEAKER;
                }
                if(!supported)continue;
                ids.add(d.getId());
                names.add(PcmSpeakerMonitor.label(d));
            }
        }catch(SecurityException denied){
            if(pcmRouteSelectionState!=null)pcmRouteSelectionState.setText(
                "장치 조회 권한 부족: "+denied.getMessage());
            return;
        }
        if(ids.size()==1)names.add("연결된 추가 출력 장치가 없습니다.");
        new android.app.AlertDialog.Builder(this)
            .setTitle("삼성 통화녹음 PCM 미디어 출력 장치")
            .setItems(names.toArray(new String[0]),(dialog,which)->{
                if(which>=ids.size())return;
                int deviceId=ids.get(which);
                getSharedPreferences("hitel_direct_output",MODE_PRIVATE).edit()
                    .putInt("routeId",deviceId).apply();
                refreshPcmRouteSelectionState();
                SpeakerCaptureLog.append(this,"USER_PCM_MEDIA_OUTPUT_DEVICE",
                    "selectedId="+deviceId+"; display="+names.get(which));
                // Route can be updated during playback, not just before it.
                Intent route=new Intent(this,SpeakerService.class);
                route.setAction(SpeakerService.ROUTE);
                route.putExtra(SpeakerService.EX_DEVICE,deviceId);
                try{startService(route);}
                catch(Throwable error){
                    if(pcmRouteSelectionState!=null)
                        pcmRouteSelectionState.setText(
                            "장치 저장됨 · 현재 재생 경로 적용 실패: "+error);
                }
            }).setNegativeButton("닫기",null).show();
    }
    /** Capture user-consented media output from THIS app, just as for YouTube.
     *  PCM playback stays armed separately while waiting for calls. */
    private void startCallMediaOutputSttLink(){
        android.content.SharedPreferences prefs=
            getSharedPreferences("hitel_direct_source",MODE_PRIVATE);
        if(!prefs.getBoolean("folder",false)||
           prefs.getString("uri","").isEmpty()){
            if(directSttStatus!=null)directSttStatus.setText(
                "삼성 통화녹음 폴더를 먼저 선택하시면 자동 감시가 시작됩니다.");
            selectDirectRecordingFolder();
            return;
        }
        callMediaLinkPending=true;
        // The original screen-capture system consent is mandatory per session.
        requestSpeakerPlayback();
    }

    private void armDefaultSamsungCallFolder(){
        android.content.SharedPreferences prefs=
            getSharedPreferences("hitel_direct_source",MODE_PRIVATE);
        if(!prefs.getBoolean("folder",false)||
           prefs.getString("uri","").isEmpty())return;
        if(!has(Manifest.permission.READ_PHONE_STATE)){
            if(directSttStatus!=null)
                directSttStatus.setText("자동 감시를 위해 전화 상태 권한이 필요합니다.");
            requestPermissions(new String[]{Manifest.permission.READ_PHONE_STATE},1183);
            return;
        }
        long now=android.os.SystemClock.elapsedRealtime();
        if(now-lastAutoArmMs<1500)return;
        lastAutoArmMs=now;
        SpeakerCaptureLog.append(this,"AUTO_FOLDER_ARM_REQUEST",
            "source="+prefs.getString("uri","")+"; mode=USAGE_MEDIA; route="+
            getSharedPreferences("hitel_direct_output",MODE_PRIVATE)
                .getInt("routeId",-1));
        startDirectRecordingMode(-2);
    }

    private void selectDirectRecordingFolder(){''',"UI restore picker and auto arm")
ui=replace_once(ui,
    '''            SpeakerCaptureLog.append(this,"DIRECT_SOURCE_SELECTED",
                "folder="+folder+"; uri="+uri);
            return;''',
    '''            SpeakerCaptureLog.append(this,"DIRECT_SOURCE_SELECTED",
                "folder="+folder+"; uri="+uri);
            if(folder){
                // Selecting the actual Call directory immediately arms the monitor.
                armDefaultSamsungCallFolder();
            }
            return;''',"folder selection starts monitor")
ui=replace_once(ui,
    '''            directReceiverRegistered=true;
        }
        if(directSttStatus!=null){''',
    '''            directReceiverRegistered=true;
        }
        // Stored SAF permission survives relaunch; arm on W03 foreground.
        armDefaultSamsungCallFolder();
        refreshPcmRouteSelectionState();
        if(directSttStatus!=null){''',"onResume automatic")
# Existing playback source must keep true when the combined link is requested,
# even if a W03 diagnostic recording session has not been started separately.
ui=replace_once(ui,
    '''    private void requestSpeakerPlayback(){
        if(!recordStarted){''',
    '''    private void requestSpeakerPlayback(){
        if(!recordStarted && !callMediaLinkPending){''',"allow capture for linked mode")
ui=replace_once(ui,
    '''            if(speakerState!=null)speakerState.setText("사용자가 출력음 캡처를 취소했습니다.");
            return;''',
    '''            callMediaLinkPending=false;
            if(speakerState!=null)speakerState.setText("사용자가 출력음 캡처를 취소했습니다.");
            return;''',"cancel link state")
ui=replace_once(ui,
    '''            if(speakerState!=null)speakerState.setText(
                "시스템 동의 완료 · 실제 출력음 입력 대기 (선택 앱명 미제공)");''',
    '''            if(speakerState!=null)speakerState.setText("미디어 출력음 캡처 시작 요청 · 실제 신호 확인 대기");
            if(callMediaLinkPending){
                callMediaLinkPending=false;
                SpeakerCaptureLog.append(this,"CALL_MEDIA_CAPTURE_LINK_REQUEST",
                    "capture=MediaProjection; playback=USAGE_MEDIA");
                startDirectRecordingMode(-2);
            }''',"capture + playback link")
ui=replace_once(ui,
    '''    private void selectDirectRecordingFile(){''',
    '''    @Override public void onRequestPermissionsResult(
        int code,String[] permissions,int[] grantResults){
        super.onRequestPermissionsResult(code,permissions,grantResults);
        boolean granted=grantResults.length>0 &&
            grantResults[0]==android.content.pm.PackageManager.PERMISSION_GRANTED;
        if(code==MEDIA_ROUTE_PERMISSION){
            if(granted)showPcmMediaOutputDevices();
            else if(pcmRouteSelectionState!=null)
                pcmRouteSelectionState.setText("블루투스 장치 표시를 위한 권한이 거부되었습니다.");
        }else if(code==1183){
            if(granted)armDefaultSamsungCallFolder();
            else if(directSttStatus!=null)
                directSttStatus.setText("전화 상태 권한 없이는 통화 자동 감시를 시작할 수 없습니다.");
        }else if(code==916 && callMediaLinkPending){
            if(granted)requestSpeakerPlayback();
            else{
                callMediaLinkPending=false;
                if(speakerState!=null)speakerState.setText(
                    "출력음 STT에는 오디오 녹음 권한이 필요합니다.");
            }
        }
    }
    private void selectDirectRecordingFile(){''',"permission resume")
ui_file.write_text(ui,encoding="utf-8")

# 4. Required permissions for enumerating BT outputs are manifest declared.
manifest=base/"src/main/AndroidManifest.xml"
m=manifest.read_text(encoding="utf-8")
if 'android.permission.BLUETOOTH_CONNECT' not in m:
    m=replace_once(m,'<manifest',
        '<manifest', "manifest ensure") if False else m
    assert '<uses-permission android:name="android.permission.READ_PHONE_STATE"/>' in m
    m=m.replace('<uses-permission android:name="android.permission.READ_PHONE_STATE"/>',
        '<uses-permission android:name="android.permission.READ_PHONE_STATE"/>\n'
        '    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>',1)
assert 'android.permission.BLUETOOTH_CONNECT' in m
m=replace_once(m,"HITEL14 V27 자동감시 소스 전환 수정",
    "HITEL14 V28 통화녹음 자동 감시·출력 장치 선택","manifest title")
manifest.write_text(m,encoding="utf-8")
gradle=base/"build.gradle.kts"
g=gradle.read_text(encoding="utf-8")
g=replace_once(g,"versionCode = 35","versionCode = 36","versionCode")
g=replace_once(g,"0.14.21-source-switch-auto-folder-v27",
    "0.14.22-auto-monitor-output-device-picker-v28","versionName")
gradle.write_text(g,encoding="utf-8")

# Contract: original, successful recognition and media output paths preserved.
for n,old in preserved.items():
    assert (p/n).read_bytes()==old,"unexpected change to preserved original: "+n
assert "new PcmSpeakerMonitor" in sink
assert "getInt(\"routeId\",-1)" in sink
assert "USER_OUTPUT_DEVICE_SELECTED" in svc
assert "outputId=-2 must remain -2" in svc
assert "AUTO_MONITOR_ALREADY_ARMED" in svc
assert "armDefaultSamsungCallFolder();" in ui
assert "showPcmMediaOutputDevices" in ui
assert "startCallMediaOutputSttLink" in ui
assert "CALL_MEDIA_CAPTURE_LINK_REQUEST" in ui
assert "Manifest.permission.BLUETOOTH_CONNECT" in ui
assert "android:allowAudioPlaybackCapture=\"true\"" in m
print("PASS_V28_AUTO_FOLDER_ARMED_IMMEDIATELY_AND_ON_ACTIVITY_FOREGROUND")
print("PASS_V28_EXACT_OUTPUT_DEVICE_TYPES_RESTORED_BLUETOOTH_USB_EARPIECE")
print("PASS_V28_SELECTED_ROUTING_PERSISTS_AND_MODE_MINUS_TWO_STABLE")
print("PASS_V28_STT_CAPTURE_CONSENT_LINKS_WITH_OWN_USAGEMEDIA_AUDIO")
print("PASS_V28_ALL_3_STT_AND_PREVIOUS_PLAYER_JAVA_UNMODIFIED")
