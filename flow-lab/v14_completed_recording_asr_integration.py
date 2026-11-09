from pathlib import Path
import shutil

base=Path("AndroidProject/app/src/main")
java=base/"java/app/hitel/samsungprobe"
activity=java/"W03ConsoleActivity.java"
access=java/"CallAccessibilityService.java"
model=java/"KoreanSherpaStt.java"
manifest=base/"AndroidManifest.xml"
gradle=Path("AndroidProject/app/build.gradle.kts")

for src in ("SamsungRecordingFlow.java","SamsungCompletedM4aTranscriber.java"):
    shutil.copy2(Path("flow-lab")/src,java/src)

def replace_once(txt,old,new,label):
    if txt.count(old)!=1:
        raise AssertionError(f"{label}: anchor count {txt.count(old)}, expected 1")
    return txt.replace(old,new,1)

s=model.read_text(encoding="utf-8")
s=replace_once(s,
'    public KoreanSherpaStt(Context c,Listener l){context=c.getApplicationContext();listener=l;}',
'''    public KoreanSherpaStt(Context c,Listener l){context=c.getApplicationContext();listener=l;}
    /** Model-only preparation. Never opens the phone microphone. */
    static File prepareSharedModelsForFile(Context context,
        SamsungCompletedM4aTranscriber.Progress progress) throws Exception {
        if(context==null)throw new IllegalArgumentException("Missing application context");
        File folder=new File(context.getApplicationContext().getFilesDir(),"sherpa-ko-v1");
        if(!folder.exists()&&!folder.mkdirs())
            throw new IllegalStateException("Korean model directory create failed");
        KoreanSherpaStt downloader=new KoreanSherpaStt(context,new Listener(){
            @Override public void onState(String phase,String message){progress.onPhase(message);}
            @Override public void onPartial(String text){}
            @Override public void onFinal(String text){}
        });
        downloader.ensureModel(folder);
        return folder;
    }''',
    "model-only shared download")
model.write_text(s,encoding="utf-8")

s=access.read_text(encoding="utf-8")
anchor='    private static final String P="com.samsung.android.incallui:id/";'
impl='''    private long recordingConnectedObservedAt=0L;
    private long lastRecordingArm=0L;
    private final Runnable recordingControlPoll=new Runnable(){
        @Override public void run(){
            try{pollSamsungRecordingControls();}
            catch(Throwable e){LabStore.log("SAMSUNG_REC_ACCESS_ERROR",e.toString());}
            main.postDelayed(this,750L);
        }
    };
    private boolean recLabel(String label,boolean stop){
        String t=label==null?"":label.trim().toLowerCase(java.util.Locale.ROOT);
        if(t.contains("통화 종료")||t.contains("전화 끊기")||
           t.equals("end call")||t.equals("hang up"))return false;
        if(stop)return t.equals("녹음 중지")||t.equals("녹음 종료")||
            t.equals("stop recording")||t.equals("stop call recording");
        return t.equals("녹음")||t.equals("녹음 시작")||
            t.equals("통화 녹음")||t.equals("start recording")||t.equals("record call");
    }
    private AccessibilityNodeInfo recordControl(AccessibilityNodeInfo root,boolean stop,
        int depth,int[] visited){
        if(root==null||depth>24||visited[0]++>2800)return null;
        if(root.isVisibleToUser()&&root.isEnabled()&&
          (recLabel(s(root.getText()),stop)||recLabel(s(root.getContentDescription()),stop))){
            AccessibilityNodeInfo click=clickableAncestor(root);
            if(click!=null){
                String text=s(click.getText()).toLowerCase(java.util.Locale.ROOT);
                String desc=s(click.getContentDescription()).toLowerCase(java.util.Locale.ROOT);
                if(!text.contains("통화 종료")&&!desc.contains("통화 종료")&&
                   !text.contains("end call")&&!desc.contains("end call"))
                    return click;
            }
        }
        for(int i=0;i<root.getChildCount();i++){
            AccessibilityNodeInfo result=recordControl(root.getChild(i),stop,depth+1,visited);
            if(result!=null)return result;
        }
        return null;
    }
    private void pollSamsungRecordingControls(){
        String phase=SamsungRecordingFlow.phase();
        if("IDLE".equals(phase)||"DONE".equals(phase)||"ERROR".equals(phase)||
           "TRANSCRIBING".equals(phase)||"WAIT_FOR_FILE".equals(phase))return;
        long sessionArm=SamsungRecordingFlow.armedAt();
        if(sessionArm!=lastRecordingArm){
            recordingConnectedObservedAt=0L;
            lastRecordingArm=sessionArm;
        }
        int state=actualCallState();
        if(state==TelephonyManager.CALL_STATE_IDLE&&SamsungRecordingFlow.isStopClicked()){
            SamsungRecordingFlow.onStopControlGone();
            return;
        }
        if(state!=TelephonyManager.CALL_STATE_OFFHOOK)return;
        int elapsed=observedCallDuration();
        if(elapsed>=1&&recordingConnectedObservedAt==0L)
            recordingConnectedObservedAt=SystemClock.elapsedRealtime();
        for(AccessibilityNodeInfo root:samsungRoots()){
            if(!"com.samsung.android.incallui".equals(s(root.getPackageName())))continue;
            AccessibilityNodeInfo stop=recordControl(root,true,0,new int[]{0});
            AccessibilityNodeInfo start=recordControl(root,false,0,new int[]{0});
            if(stop!=null){
                SamsungRecordingFlow.onRecordingUiActive();
                if(SamsungRecordingFlow.wantsStop()){
                    boolean clicked=stop.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                    SamsungRecordingFlow.onStopClicked(clicked);
                }
                return;
            }
            if(SamsungRecordingFlow.isStopClicked()&&start!=null){
                SamsungRecordingFlow.onStopControlGone();
                return;
            }
            if(SamsungRecordingFlow.shouldClickStart()&&start!=null&&
                recordingConnectedObservedAt>0L&&
                SystemClock.elapsedRealtime()-recordingConnectedObservedAt>=1000L){
                boolean clicked=start.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                SamsungRecordingFlow.onStartClicked(clicked);
                return;
            }
        }
        SamsungRecordingFlow.observeFiles();
    }
'''
s=replace_once(s,anchor,impl+anchor,"a11y recording methods")
s=replace_once(s,'        main.postDelayed(liveWindowPoll,700);',
'''        main.postDelayed(liveWindowPoll,700);
        main.removeCallbacks(recordingControlPoll);
        main.postDelayed(recordingControlPoll,700);''',"recording poll start")
s=replace_once(s,'            if(dialerFlowArmed)inspectAutomaticCallFlow("samsung accessibility event");',
'''            pollSamsungRecordingControls();
            if(dialerFlowArmed)inspectAutomaticCallFlow("samsung accessibility event");''',
"recording event")
s=replace_once(s,
'    @Override public void onDestroy(){main.removeCallbacks(liveWindowPoll);main.removeCallbacks(dialerMonitor);',
'''    @Override public void onDestroy(){main.removeCallbacks(liveWindowPoll);main.removeCallbacks(dialerMonitor);
        main.removeCallbacks(recordingControlPoll);''',"a11y destroy")
access.write_text(s,encoding="utf-8")

s=activity.read_text(encoding="utf-8")
s=replace_once(s,'    private TextView pinnedLiveCaption;',
'''    private TextView pinnedLiveCaption;
    private TextView samsungFileAsrState;
    private TextView samsungFileAsrTranscript;
    private String lastSamsungFileAsrState="";
    private String lastSamsungFileAsrTranscript="";''',"file-asr independent widgets")
s=replace_once(s,'            refreshState();refreshTranscripts();refreshLogs();',
'''            refreshState();refreshTranscripts();refreshLogs();refreshSamsungFileAsr();''',
"poll independent result")
s=replace_once(s,'        callButton=btn("전화 걸기 · 삼성 번호판 열기",this::placeCall);',
'        callButton=btn("전화 걸기 · 삼성 녹음 시작",this::placeCall);',
"call button text")
s=replace_once(s,
'        content.addView(label("삼성 전화 앱에서 번호를 누르고 발신하십시오. 상대방과 연결된 후 문자통화 모드를 자동 탐색합니다. 활성화되면 HITEL 화면으로 복귀를 시도합니다.",12,false));',
'''        content.addView(label("삼성 기본 전화로 발신합니다. 실제 연결 후 삼성 녹음 시작 버튼만 누릅니다. 자동 문자통화 전환은 실행하지 않습니다.",12,false));
        Button recordStop=btn("음성인식 중지 · 삼성 녹음 종료 · 통화 유지",
            this::stopSamsungRecordingAndTranscribe);
        content.addView(recordStop,new LinearLayout.LayoutParams(-1,dp(52)));
        samsungFileAsrState=label("삼성 녹음 파일 인식: 통화 녹음 시작 대기",13,true);
        content.addView(samsungFileAsrState);
        samsungFileAsrTranscript=label("완료된 통화 녹음 파일 전사문이 이곳에 나타납니다. 기존 HITEL 마이크 인식은 그대로 유지합니다.",14,false);
        samsungFileAsrTranscript.setTextIsSelectable(true);
        content.addView(samsungFileAsrTranscript);''',
"separate recording stop control")
s=replace_once(s,
'            CallAccessibilityService.armDialerFlow(this);',
'''            CallAccessibilityService.disarmDialerFlow(this,"FILE_RECORDING_MODE");
            SamsungRecordingFlow.arm(this);''',"recording-specific dialer flow")
s=replace_once(s,'            CallAccessibilityService.disarmDialerFlow(this,"DIALPAD_OPEN_ERROR");',
'''            SamsungRecordingFlow.cancelBeforeStart();
            CallAccessibilityService.disarmDialerFlow(this,"DIALPAD_OPEN_ERROR");''',
"cancel on phone opening error")
s=replace_once(s,
'    /** Automatically brings the transcript conversation into view once the',
'''    /** Samsung OEM record STOP. Never hangs up and never stops HITEL14 microphone. */
    private void stopSamsungRecordingAndTranscribe(){
        if(!SamsungRecordingFlow.requestStop()){
            log("SAMSUNG_REC_STOP_REJECTED","state="+SamsungRecordingFlow.phase());
            if(samsungFileAsrState!=null)samsungFileAsrState.setText(
                "녹음 중지 불가: "+SamsungRecordingFlow.details());
            return;
        }
        openCallUi();
    }
    private void refreshSamsungFileAsr(){
        String state=SamsungRecordingFlow.phase()+": "+SamsungRecordingFlow.details();
        if(samsungFileAsrState!=null&&!state.equals(lastSamsungFileAsrState)){
            samsungFileAsrState.setText("삼성 녹음 파일 처리: "+state);
            lastSamsungFileAsrState=state;
        }
        String transcript=SamsungRecordingFlow.transcript();
        if(samsungFileAsrTranscript!=null&&!transcript.equals(lastSamsungFileAsrTranscript)){
            samsungFileAsrTranscript.setText(transcript.isEmpty()?
                "M4A 전사 결과를 기다립니다.":transcript);
            lastSamsungFileAsrTranscript=transcript;
        }
    }

    /** Automatically brings the transcript conversation into view once the''',
"independent file transcript UI")
s=replace_once(s,
'    private void placeCall(){',
'''    private void placeCall(){
        if(!has(Manifest.permission.READ_MEDIA_AUDIO)){
            requestPermissions(new String[]{Manifest.permission.READ_MEDIA_AUDIO},605);
            return;
        }''',"permission on call")
s=replace_once(s,'else if(req==603)refreshState();else if(req==604)startKoreanSherpaSpeech();',
'''else if(req==603)refreshState();else if(req==604)startKoreanSherpaSpeech();
            else if(req==605)placeCall();''',"permission callback")
assert 'private void startKoreanSherpaSpeech()' in s
assert 'private void stopKoreanSherpaSpeech()' in s
assert 'this::stopKoreanSherpaSpeech' in s
assert 'this::stopSamsungRecordingAndTranscribe' in s
activity.write_text(s,encoding="utf-8")

s=manifest.read_text(encoding="utf-8")
s=replace_once(s,'    <uses-permission android:name="android.permission.RECORD_AUDIO"/>',
'''    <uses-permission android:name="android.permission.RECORD_AUDIO"/>
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO"/>''',"audio read permission")
manifest.write_text(s,encoding="utf-8")

s=gradle.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v14"' in s
s=replace_once(s,'versionCode = 21','versionCode = 22',"version code")
s=replace_once(s,'versionName = "0.14.7-voice-access-audio-ab"',
'versionName = "0.14.8-completed-m4a-file-asr"',"version name")
gradle.write_text(s,encoding="utf-8")

print("PASS: HITEL14 microphone unchanged, Samsung recording independent, completed-file sherpa, no hangup.")
