package app.hitel.samsungprobe;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.telecom.TelecomManager;
import android.telephony.TelephonyManager;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import java.io.File;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** A single persistent HITEL cockpit. Only the carrier-owned UI is opened for
 *  operations requiring a visible Samsung accessibility tree; no default dialer replacement.
 *  A touchable accessibility overlay returns the user to this screen. */
public final class W03ConsoleActivity extends Activity {
    private static final String[] LANGS={"한국어","English","中文","日本語"};
    private static final String[] TAGS={"ko-KR","en-US","zh-CN","ja-JP"};
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final ArrayList<String> entries=new ArrayList<>();
    private final ArrayList<String> transcriptEntries=new ArrayList<>();
    private ArrayAdapter<String> transcriptAdapter;
    private ListView transcriptList;
    private TextView transcriptMonitor;
    private long transcriptCursor=0;
    private File transcriptReadFile;
    private long backgroundProbeBaseline=0,backgroundProbeRemoteBaseline=0;
    private long backgroundProbeStarted=0;
    private boolean backgroundProbeActive=false;
    private boolean followTranscripts=true;
    private SpeechRecognizer recognizer;
    private boolean isListening=false, recordStarted=false, scanRunning=false,sendWaiting=false, sentAttempted=false;
    private boolean editingText=false, followLogs=true, sttSucceeded=false, testOpen=false;
    private String lastSttError="", lastSttResult="", attemptedMode="", lastSendResult="", deviceCallState="";
    private String lastRemoteShown="", lastLocalShown="";
    private int completedSteps=0, lastCount=0;
    private long cursor=0;
    private EditText phone, message;
    private TextView callState, textCallState, remoteSubtitle, sentSubtitle, status, logHeader, flowStatus;
    private TextView remoteTranslation, localTranslation, streamStatus;
    private KoreanSherpaStt koreanSherpa;
    private int voiceTrialModeIndex=4; // NS+AEC+microphone direction first; baseline selectable
    private Button voiceTrialModeButton;
    private TextView pinnedMicState;
    private TextView pinnedLiveCaption;
    private String sherpaCommittedText="";
    private String sherpaLiveDraft="";
    private ScrollView scrollBody;
    private LinearLayout logPage;
    private Button callButton, textCallButton, sttButton, oemButton, smsButton, voiceButton, endButton, autoScroll;
    private Spinner language;
    private ListView logList;
    private ArrayAdapter<String> logAdapter;
    private final Runnable poll=new Runnable(){
        @Override public void run(){
            if(isFinishing())return;
            refreshState();refreshTranscripts();refreshLogs();
            ui.postDelayed(this,500);
        }
    };
    private int dp(float a){return (int)(getResources().getDisplayMetrics().density*a+0.5f);}
    private TextView label(String t,int size,boolean bold){
        TextView v=new TextView(this);v.setText(t);v.setTextColor(0xff111111);
        v.setTextSize(TypedValue.COMPLEX_UNIT_SP,size);
        if(bold)v.setTypeface(null,1);
        v.setPadding(dp(3),dp(4),dp(3),dp(4));return v;
    }
    private Button btn(String t,Runnable job){
        Button b=new Button(this);b.setAllCaps(false);b.setTextSize(TypedValue.COMPLEX_UNIT_SP,12);
        b.setText(t);b.setOnClickListener(v->job.run());return b;
    }
    private void toast(String v){Toast.makeText(this,v,Toast.LENGTH_LONG).show();}
    private void log(String type,String msg){LabStore.log(type,msg);}
    private void status(String message){
        if(status!=null)status.setText(message);
        if(pinnedMicState!=null)pinnedMicState.setText(message);
    }
    private LinearLayout container(){LinearLayout x=new LinearLayout(this);x.setOrientation(LinearLayout.VERTICAL);return x;}
    private void line(LinearLayout parent,String title){
        TextView t=label(title,15,true);t.setBackgroundColor(0xfff1f1f1);
        t.setPadding(dp(9),dp(9),dp(9),dp(9));parent.addView(t,new LinearLayout.LayoutParams(-1,-2));
    }
    private void addButtonRow(LinearLayout parent,Button... buttons){
        LinearLayout row=new LinearLayout(this);row.setOrientation(LinearLayout.HORIZONTAL);
        for(Button b:buttons)row.addView(b,new LinearLayout.LayoutParams(0,dp(54),1));
        parent.addView(row,new LinearLayout.LayoutParams(-1,-2));
    }
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);ScenarioCatalog.load(this);FlowCatalog.load(this);LabStore.init(this);
        LinearLayout screen=container();screen.setBackgroundColor(Color.WHITE);
        screen.setPadding(dp(10),dp(8),dp(10),dp(8));
        screen.addView(label("W03  |  전화 중 음성 입력 · 실시간 조작",19,true));
        flowStatus=label("① 전화 걸기 → 삼성 번호판 → 연결 → 문자통화 → HITEL 자동 복귀",12,true);screen.addView(flowStatus);
        ScrollView sc=new ScrollView(this);scrollBody=sc;LinearLayout content=container();
        sc.addView(content);
        LinearLayout tabs=container();
        tabs.setOrientation(LinearLayout.HORIZONTAL);
        Button callTab=btn("통화 · 자막 · 입력",()->{
            sc.setVisibility(View.VISIBLE);
            logPage.setVisibility(View.GONE);
        });
        Button logsTab=btn("전체 실행 로그",()->{
            sc.setVisibility(View.GONE);
            logPage.setVisibility(View.VISIBLE);
            if(followLogs&&logAdapter!=null&&logAdapter.getCount()>0)
                logList.setSelection(logAdapter.getCount()-1);
        });
        tabs.addView(callTab,new LinearLayout.LayoutParams(0,dp(50),1));
        tabs.addView(logsTab,new LinearLayout.LayoutParams(0,dp(50),1));
        screen.addView(tabs);
        screen.addView(sc,new LinearLayout.LayoutParams(-1,0,1));
        logPage=container();
        logPage.setVisibility(View.GONE);
        screen.addView(logPage,new LinearLayout.LayoutParams(-1,0,1));
        line(content,"① 통화 연결");
        phone=new EditText(this);phone.setSingleLine(true);phone.setTextSize(16);
        phone.setHint("번호 입력 선택 사항 (삼성 전화번호판에서 직접 입력 가능)");
        phone.setInputType(android.text.InputType.TYPE_CLASS_PHONE);content.addView(phone);
        callState=label("통화 상태 확인 중",13,false);content.addView(callState);
        callButton=btn("전화 걸기 · 삼성 번호판 열기",this::placeCall);
        Button connected=btn("연결 상태 확인",this::refreshState);
        addButtonRow(content,callButton,connected);
        content.addView(label("삼성 전화 앱에서 번호를 누르고 발신하십시오. 상대방과 연결된 후 문자통화 모드를 자동 탐색합니다. 활성화되면 HITEL 화면으로 복귀를 시도합니다.",12,false));

        line(content,"② 삼성 문자통화 준비");
        textCallState=label("삼성 문자통화: 실제 화면 관측 전",13,false);content.addView(textCallState);
        textCallButton=btn("문자통화 전환 다시 시도 (예비)",this::prepareTextCall);
        Button returnCall=btn("삼성 전화 화면 잠깐 보기",this::openCallUi);
        addButtonRow(content,textCallButton,returnCall);
        content.addView(label("자동으로 문자통화가 열리지 않는 경우에만 위 예비 버튼을 사용하십시오. 삼성 앱이 숨겨질 때의 신규 자막은 실제 이벤트로 판정합니다.",11,false));

        line(content,"③ 삼성 문자통화 전체 자막 · 실시간 중계");
        transcriptMonitor=label("상대방 발화 · 내 발신 문장 수집 대기. 삼성 문자통화 활성화 후 자동 중계합니다.",12,true);
        content.addView(transcriptMonitor);
        Button probe=btn("삼성 화면을 숨긴 채 새 자막 수집 시험 (15초)",this::startBackgroundProbe);
        content.addView(probe,new LinearLayout.LayoutParams(-1,dp(48)));
        content.addView(label("상대방 원문·번역문·내 메시지·정정 이력을 한 줄도 자르지 않고 기록합니다. 삼성에서 실제로 발생한 새 이벤트만 추가합니다.",11,false));
        transcriptList=new ListView(this);transcriptList.setDividerHeight(1);
        transcriptAdapter=new ArrayAdapter<String>(this,android.R.layout.simple_list_item_1,transcriptEntries){
            @Override public View getView(int position,View old,android.view.ViewGroup parent){
                TextView v=old instanceof TextView?(TextView)old:new TextView(W03ConsoleActivity.this);
                v.setText(transcriptEntries.get(position));v.setTextColor(0xff222222);
                v.setTextSize(14);v.setSingleLine(false);v.setMaxLines(Integer.MAX_VALUE);
                v.setPadding(dp(8),dp(8),dp(8),dp(8));
                v.setBackgroundColor(position%2==0?0xfff7f7f7:Color.WHITE);return v;
            }
        };
        transcriptList.setAdapter(transcriptAdapter);
        transcriptList.setOnTouchListener((v,event)->{
            if(event.getAction()==android.view.MotionEvent.ACTION_DOWN)followTranscripts=false;
            return false;
        });
        content.addView(transcriptList,new LinearLayout.LayoutParams(-1,dp(270)));
        Button bottom=btn("자막 최신으로 이동 · 자동 스크롤 재개",()->{
            followTranscripts=true;
            if(!transcriptEntries.isEmpty())transcriptList.setSelection(transcriptEntries.size()-1);
        });
        content.addView(bottom,new LinearLayout.LayoutParams(-1,dp(44)));
        remoteSubtitle=label("상대방 원문: 새 자막 대기 중",15,true);content.addView(remoteSubtitle);
        remoteTranslation=label("상대방 번역: 삼성 원본에서 새 번역 대기 중",15,true);
        content.addView(remoteTranslation);
        sentSubtitle=label("내 발신 문장: 새 기록 대기 중",13,false);content.addView(sentSubtitle);
        localTranslation=label("내 발신 번역: 새 기록 대기 중",13,false);content.addView(localTranslation);
        streamStatus=label("실시간 중계: 삼성 접근성 이벤트 대기",12,true);
        content.addView(streamStatus);

        line(content,"④ 내 목소리 → 인식 문장");
        language=new Spinner(this);language.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,LANGS));
        content.addView(language);
        sttButton=btn("🎙 한국어 말하기 · HITEL 직접 STT",this::startKoreanSherpaSpeech);
        Button stop=btn("마이크 인식 중지",this::stopKoreanSherpaSpeech);
        // Real primary microphone controls pinned under the two activity tabs.
        // screen children before this: header, flowStatus, tabs, sc, logPage.
        LinearLayout micBar=container();
        micBar.setOrientation(LinearLayout.HORIZONTAL);
        micBar.addView(sttButton,new LinearLayout.LayoutParams(0,dp(54),1));
        micBar.addView(stop,new LinearLayout.LayoutParams(0,dp(54),1));
        screen.addView(micBar,3,new LinearLayout.LayoutParams(-1,dp(54)));
        pinnedMicState=label("한국어 마이크 대기 · 버튼을 누르면 STT가 시작됩니다.",12,false);
        pinnedMicState.setMaxLines(3);
        pinnedMicState.setPadding(dp(7),dp(3),dp(7),dp(3));
        pinnedMicState.setBackgroundColor(0xfff1f1f1);
        screen.addView(pinnedMicState,4,new LinearLayout.LayoutParams(-1,dp(52)));
        // Persistent, live, TOP-LEVEL caption: unaffected by status text and call polling.
        pinnedLiveCaption=label("내 목소리 실시간 자막 · 마이크를 누르시면 여기에 나타납니다.",14,true);
        pinnedLiveCaption.setMaxLines(3);
        pinnedLiveCaption.setPadding(dp(9),dp(7),dp(9),dp(7));
        pinnedLiveCaption.setBackgroundColor(0xffeeeeee);
        screen.addView(pinnedLiveCaption,5,new LinearLayout.LayoutParams(-1,dp(70)));
        content.addView(label(
           "한국어 Zipformer INT8 · sherpa-onnx 네이티브 인식. "+
           "최초 실행 시 한국어 모델 약 144MB를 공식 출처에서 자동 다운로드하며 이후 오프라인 동작합니다. "+
           "이 버튼은 삼성 전화 화면으로 이동하지 않고 이곳에서 마이크를 읽습니다. "+
           "통화 중 삼성 오디오 정책으로 무음 처리될 가능성은 실제 PCM 기록으로 판정합니다.",12,false));
        // Optional ORIGINAL PCM sample, from the existing sherpa AudioRecord.
        // This never starts another microphone and is off until user taps.
        Button audioEvidence=btn("통화 중 내 목소리 12초 WAV 진단 (ZIP 포함)",()->{
            if(koreanSherpa!=null&&koreanSherpa.isRunning()){
                koreanSherpa.requestWavSample();
                log("W03_DIAG_WAV_USER_REQUEST","12s native PCM explicitly requested; no second microphone");
                status("동일 마이크 PCM을 최대 12초 저장합니다. W03 종료 시 ZIP 안의 diagnostic_audio 폴더를 확인하십시오.");
            }else{
                log("W03_DIAG_WAV_NOT_RUNNING","User requested WAV without active Korean STT");
                status("먼저 상단의 한국어 마이크 버튼을 눌러 음성인식을 실행해 주십시오.");
            }
        });
        content.addView(audioEvidence,new LinearLayout.LayoutParams(-1,dp(54)));
        // This button is visible without scrolling. Each tap advances ONE
        // controlled audio configuration; changes apply on next mic start.
        voiceTrialModeButton=btn("통화중 음성입력 실험: "+
            VoiceAccessAudioTrial.name(voiceTrialModeIndex),()->{
            if(koreanSherpa!=null&&koreanSherpa.isRunning()){
                status("마이크를 먼저 중지하신 뒤 시험 조건을 변경해 주십시오.");
                log("VA_AB_PRESET_CHANGE_BLOCKED","Mic already recording");
                return;
            }
            voiceTrialModeIndex=(voiceTrialModeIndex+1)%VoiceAccessAudioTrial.MODES.length;
            voiceTrialModeButton.setText("통화중 음성입력 실험: "+
                VoiceAccessAudioTrial.name(voiceTrialModeIndex));
            status("선택됨: "+VoiceAccessAudioTrial.name(voiceTrialModeIndex)+
                ". 다음 마이크 시작부터 적용됩니다.");
            log("VA_AB_UI_PRESET","mode="+voiceTrialModeIndex+
                "; label="+VoiceAccessAudioTrial.name(voiceTrialModeIndex));
        });
        screen.addView(voiceTrialModeButton,7,new LinearLayout.LayoutParams(-1,dp(52)));
        log("VA_AB_UI_DEFAULT","initialMode="+voiceTrialModeIndex+
            "; label="+VoiceAccessAudioTrial.name(voiceTrialModeIndex));
        content.addView(label(
            "상세 진단은 매초 SHERPA_DIAG_PCM_1S(음량·디코더·지연), "+
            "SHERPA_DIAG_AUDIO_ROUTE_CHANGE(통화 중 입력경로), "+
            "SHERPA_DIAG_PARTIAL/ENDPOINT/FINAL로 저장됩니다. "+
            "WAV는 버튼을 눌렀을 때만 녹음되며, 통화 중 음성정보가 포함될 수 있습니다.",12,false));
        Button nativeStt=btn("기존 시스템 STT 별도 진단",this::startSpeech);
        Button samsungEntry=btn("삼성 문자 입력창 보기",this::openSamsungSpeechEntry);
        addButtonRow(content,nativeStt,samsungEntry);
        Button voxSettings=btn("VoxSherpa 원본 · 모델 / 음성합성 / 설정",()->{
            log("VOX_UPSTREAM_OPEN","Open original VoxSherpa UI from same HITEL APK");
            try{
                startActivity(new android.content.Intent(
                    this,com.CodeBySonu.VoxSherpa.MainActivity.class));
            }catch(Exception ex){
                log("VOX_UPSTREAM_OPEN_FAILED",ex.toString());
                status("원본 VoxSherpa 화면을 열 수 없습니다: "+ex.getMessage());
            }
        });
        // Keep original VoxSherpa model/settings UI one-tap visible,
        // regardless of content scroll position and caption list length.
        screen.addView(voxSettings,6,new LinearLayout.LayoutParams(-1,dp(48)));
        message=new EditText(this);message.setMinLines(3);message.setTextSize(17);
        message.setGravity(Gravity.TOP);message.setHint("음성 인식 결과가 여기 표시됩니다. 직접 수정·입력하실 수도 있습니다.");
        message.setSingleLine(false);content.addView(message,new LinearLayout.LayoutParams(-1,dp(92)));
        content.addView(label("이 문장은 사용자께서 전송 방식을 누르기 전까지 상대방에게 보내지지 않습니다.",11,false));

        line(content,"⑤ 전송 방식 선택 (사용자가 직접 누릅니다)");
        oemButton=btn("삼성 문자통화 TTS 보내기",()->confirmSend("oem_tts"));
        smsButton=btn("SMS 문자 작성",()->confirmSend("sms"));
        voiceButton=btn("일반 음성으로 전환",()->confirmSend("voice"));
        content.addView(oemButton,new LinearLayout.LayoutParams(-1,dp(52)));
        addButtonRow(content,smsButton,voiceButton);
        status=label("단계별 실제 결과를 여기에 표시합니다.",13,false);
        status.setBackgroundColor(0xffeeeeee);content.addView(status);

        line(content,"⑥ 실제 상대방 확인 · 결과 저장");
        Button heard=btn("상대방이 TTS 들음",()->peerCheck(true));
        Button notHeard=btn("상대방이 못 들음",()->peerCheck(false));
        addButtonRow(content,heard,notHeard);
        endButton=btn("W03 종료 · 결과 ZIP 저장",this::endSession);
        content.addView(endButton,new LinearLayout.LayoutParams(-1,dp(52)));

        LinearLayout head=new LinearLayout(this);head.setGravity(Gravity.CENTER_VERTICAL);
        logHeader=label("전체 실행 로그 · 0줄",13,true);
        head.addView(logHeader,new LinearLayout.LayoutParams(0,dp(40),1));
        autoScroll=btn("자동 스크롤 ON",()->{followLogs=!followLogs;autoScroll.setText(followLogs?"자동 스크롤 ON":"자동 스크롤 OFF");});
        head.addView(autoScroll,new LinearLayout.LayoutParams(dp(139),dp(40)));
        logPage.addView(head);
        logList=new ListView(this);logList.setDividerHeight(1);
        logAdapter=new ArrayAdapter<String>(this,android.R.layout.simple_list_item_1,entries){
            @Override public View getView(int position,View old,android.view.ViewGroup parent){
                TextView text=old instanceof TextView?(TextView)old:new TextView(W03ConsoleActivity.this);
                text.setText(entries.get(position));text.setTextSize(11);text.setTextColor(0xff1f1f1f);
                text.setPadding(dp(5),dp(4),dp(5),dp(4));text.setSingleLine(false);
                text.setMaxLines(Integer.MAX_VALUE);text.setBackgroundColor(position%2==0?0xfff6f6f6:Color.WHITE);return text;
            }
        };
        logList.setAdapter(logAdapter);
        logList.setOnTouchListener((v,event)->{if(event.getAction()==android.view.MotionEvent.ACTION_DOWN){followLogs=false;autoScroll.setText("자동 스크롤 OFF");}return false;});
        logPage.addView(logList,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(screen);
        if(!LabStore.running()){
            try{LabStore.begin(this,"flow","W03");recordStarted=true;log("W03_UI_BEGIN","W03 전면 조작 UI 시작. 전화 앱을 기본앱으로 교체하지 않음");}
            catch(Throwable e){status("시험 기록 시작 불가: "+e);}
        }else{recordStarted="W03".equals(LabStore.currentScenario());if(!recordStarted)status("다른 시험 실행 중: "+LabStore.currentScenario());}
        CallAccessibilityService.setConsoleRequested(true);
        ui.post(poll);
    }
    private void step(int index,String action,String verdict,String reason){
        if(!recordStarted)return;
        LabStore.saveFlowStep(index,6,action,action,verdict,reason);
        completedSteps=Math.max(completedSteps,index+1);
    }
    private boolean has(String permission){return checkSelfPermission(permission)==PackageManager.PERMISSION_GRANTED;}
    /** Opens Samsung's dialpad with NO number required. The user types and calls.
     * ACTION_DIAL deliberately does not place a call or require CALL_PHONE. */
    private void placeCall(){
        String number=phone.getText().toString().trim();
        if(!number.isEmpty()&&!number.matches("[+0-9#*() -]{2,25}")){
            toast("미리 입력한 전화번호 형식을 확인해 주십시오.");return;
        }
        Intent dial=new Intent(Intent.ACTION_DIAL);
        if(!number.isEmpty()){
            String cleaned=number.replaceAll("[() -]","");
            dial.setData(Uri.parse("tel:"+cleaned));
        }
        Intent samsung=new Intent(dial);
        samsung.setPackage("com.samsung.android.dialer");
        boolean samsungFound=samsung.resolveActivity(getPackageManager())!=null;
        try{
            // An explicit Samsung target avoids accidentally routing to another
            // installed dialer. If unavailable, respect Android's default dialer.
            Intent selected=samsungFound?samsung:dial;
            if(selected.resolveActivity(getPackageManager())==null){
                status("사용 가능한 전화번호 입력 앱이 없습니다.");return;
            }
            if(!CallAccessibilityService.serviceConnected()){
                log("W11_ACCESSIBILITY_NOT_CONNECTED","HITEL accessibility service not running");
                status("HITEL v0.13 접근성 서비스를 먼저 활성화해야 자동 연결 감지가 됩니다.");
                new android.app.AlertDialog.Builder(this)
                    .setTitle("HITEL v0.13 접근성 서비스 연결 필요")
                    .setMessage("삼성 통화 연결 및 텍스트 통화 버튼을 자동 감지하려면 v0.13 접근성 서비스를 활성화해야 합니다. 설정을 여시겠습니까?")
                    .setPositiveButton("접근성 설정 열기",(d,which)->startActivity(
                       new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)))
                    .setNegativeButton("취소",null).show();
                return;
            }
            CallAccessibilityService.armDialerFlow(this);
            step(0,"삼성 전화번호판 실행","UNVERIFIED",
                "ACTION_DIAL 열기 요청. 사용자 번호 입력/실제 발신/상대 응답은 이후 확인");
            log("W03_DIALPAD_OPEN","ACTION_DIAL; samsungTarget="+samsungFound+
                "; prefilled="+!number.isEmpty()+"; no automatic call");
            status("삼성 번호판을 엽니다. 전화번호를 입력하고 직접 발신하십시오. 연결 뒤 문자통화 전환과 HITEL 복귀를 감시합니다.");
            startActivity(selected);
        }catch(Throwable ex){
            CallAccessibilityService.disarmDialerFlow(this,"DIALPAD_OPEN_ERROR");
            status("삼성 전화번호판 실행 실패: "+ex);
            log("W03_DIALPAD_ERROR",ex.toString());
        }
    }
    /** Automatically brings the transcript conversation into view once the
     * Samsung text-call activity was positively identified. */
    private void focusTranscriptAfterAutoReturn(){
        status("삼성 문자통화 화면 감지 · HITEL 화면 복귀. 실제 새 자막 수신 대기 중입니다.");
        flowStatus.setText("삼성 문자통화 연결 · HITEL 실시간 자막/음성 입력 · 통화는 삼성에서 유지");
        log("W03_AUTO_RETURN_VISIBLE","HITEL UI onResume after Samsung text-call mode observation");
        ui.postDelayed(()->{
            if(scrollBody!=null&&transcriptMonitor!=null)
                scrollBody.smoothScrollTo(0,transcriptMonitor.getTop());
        },260);
    }
    @Override protected void onNewIntent(Intent intent){
        super.onNewIntent(intent);
        setIntent(intent);
        if(intent!=null&&intent.getBooleanExtra("hitel_auto_return",false))
            ui.postDelayed(()->{
                if(getIntent()!=null&&getIntent().getBooleanExtra("hitel_auto_return",false)){
                    getIntent().removeExtra("hitel_auto_return");focusTranscriptAfterAutoReturn();
                }
            },250);
    }
    private void refreshState(){
        if(!recordStarted)return;
        try{
            if(!has(Manifest.permission.READ_PHONE_STATE)){
                callState.setText("통화 상태 권한이 없습니다. 최초 1회 요청해야 합니다.");
                return;
            }
            TelephonyManager tel=(TelephonyManager)getSystemService(TELEPHONY_SERVICE);
            int state=tel.getCallState();
            String newState=state==TelephonyManager.CALL_STATE_OFFHOOK?"통화 중/발신 중(OS OFFHOOK)":
                state==TelephonyManager.CALL_STATE_RINGING?"전화 수신 중":state==TelephonyManager.CALL_STATE_IDLE?"전화 연결 없음":"상태 알 수 없음";
            if(!newState.equals(deviceCallState)){log("W03_PHONE_STATE",newState);deviceCallState=newState;}
            callState.setText("전화 상태: "+newState+" · 실제 상대방 응답 여부는 별도 확인");
        }catch(Throwable e){callState.setText("전화 상태 조회 오류: "+e);}
        CallAccessibilityService access=CallAccessibilityService.instance;
        if(access!=null){
            CallAccessibilityService.Snapshot s=access.snapshot();
            String phase=CallAccessibilityService.currentFlowPhase();
            if("WAIT_FOR_ANSWER".equals(phase))
                callState.setText("전화 상태: "+CallAccessibilityService.currentDetection());
            else if("CONNECTED_WAIT_TEXT_BUTTON".equals(phase))
                callState.setText("통화 연결 증거: 삼성 통화시간 증가 확인 · 문자통화 버튼 대기");
            else if("TEXT_BUTTON_AVAILABLE".equals(phase))
                callState.setText(CallAccessibilityService.currentDetection());
            else if("TEXT_CALL_ACTIVE".equals(phase)||"RETURN_REQUESTED".equals(phase))
                callState.setText("삼성 문자통화 활성화 확인 · HITEL 실시간 중계");

            String latest=s.lastRemote;
            if(!latest.equals(lastRemoteShown)){
                lastRemoteShown=latest;
                if(!latest.isEmpty()){
                    remoteSubtitle.setText("상대방 (관측된 자막):\n"+latest);
                    log("W03_UI_REMOTE","관측된 삼성 문자통화 자막이 전면 화면에 표시됨. package="+s.foregroundPackage);
                }
            }
            if(remoteTranslation!=null){
                remoteTranslation.setText("상대방 번역: "+(s.lastRemoteTranslation.isEmpty()?
                        "삼성에서 관측된 번역 없음":s.lastRemoteTranslation));
            }
            if(localTranslation!=null){
                localTranslation.setText("내 발신 번역: "+(s.lastLocalTranslation.isEmpty()?
                        "삼성에서 관측된 번역 없음":s.lastLocalTranslation));
            }
            if(!s.lastLocal.equals(lastLocalShown)){
                lastLocalShown=s.lastLocal;
                sentSubtitle.setText("삼성에서 관측된 내 메시지: "+(lastLocalShown.isEmpty()?"없음":lastLocalShown));
            }
            long nodeAge=s.lastTextCallVisibleAt==0?Long.MAX_VALUE:System.currentTimeMillis()-s.lastTextCallVisibleAt;
            String support=nodeAge<5000?"최근 삼성 문자 입력 노드 관측됨":"현재 삼성 문자 입력 노드 미확인(과거 기록 보존)";
            textCallState.setText("삼성 문자통화: "+support+" · 접근성 창: "+(s.foregroundPackage.isEmpty()?"미확인":s.foregroundPackage));
            updateTranscriptHealth(s);
            if(streamStatus!=null){
                long now=System.currentTimeMillis();
                long since=s.lastSamsungTranscriptAt<=0?Long.MAX_VALUE:now-s.lastSamsungTranscriptAt;
                if(since<2500)
                    streamStatus.setText("실시간 중계: 최신 자막 수신 "+(since/1000)+"초 전 · 0.5초 간격 화면 갱신");
                else if(s.lastSamsungTranscriptAt>0)
                    streamStatus.setText("실시간 중계: 신규 문장 대기 "+(since/1000)+"초 · 삼성 이벤트가 계속 오는지 확인");
                else streamStatus.setText("실시간 중계: 아직 삼성 자막/번역 이벤트 없음");
            }
        }else{textCallState.setText("접근성 연결 필요 — 아래 삼성 화면 자동 조작 불가");}
        flowStatus.setText("HITEL 실시간 통화 · "+(sendWaiting?"삼성 전송 요청 진행":"자막/번역 수신 모니터링")+
            " · 전체 대화 "+transcriptEntries.size()+"건");
        oemButton.setEnabled(!sendWaiting&&recordStarted);
        sttButton.setEnabled(recordStarted);
    }
    private void openCallUi(){
        if(!recordStarted)return;
        try{TelecomManager t=(TelecomManager)getSystemService(TELECOM_SERVICE);
            log("W03_OPEN_OEM_UI","TelecomManager.showInCallScreen(false); 삼성 전화 앱 전체화면 열기, 오버레이 없음");
            t.showInCallScreen(false);
        }catch(Throwable e){log("W03_OEM_UI_ERROR",e.toString());status("삼성 전화 화면 호출 실패: "+e);}
    }
    private void prepareTextCall(){
        if(!recordStarted)return;
        CallAccessibilityService a=CallAccessibilityService.instance;
        if(a==null){toast("설정에서 'HITEL 통화 실시간 조작' 접근성을 활성화해 주십시오.");
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));return;}
        if(scanRunning)return;scanRunning=true;
        status("삼성 전화 화면을 열어 문자통화 버튼을 찾습니다. 삼성 문자통화 화면을 확인한 뒤 HITEL로 자동 복귀합니다.");
        step(1,"삼성 문자통화 준비","UNVERIFIED","실제 삼성 화면 노드 탐색 대기");
        openCallUi();
        io.execute(()->{
            try{Thread.sleep(1250);a.scanBlocking("w03_textcall_start");
                boolean already=a.isTextCallVisible();
                boolean clicked=already||a.enterTextCall();
                log("W03_TEXT_CALL_ACTION","alreadyVisible="+already+" enterClick="+clicked+" (클릭 성공=문자통화 활성화가 아님)");
                Thread.sleep(1500);a.scanBlocking("w03_textcall_verify");
                boolean visible=a.isTextCallVisible();
                step(1,"삼성 문자통화 진입",visible?"PASS":"UNVERIFIED",visible?"실제 삼성 문자 입력 노드 관측":"삼성 문자 입력창 미노출. 원본 화면에서 수동 진입 후 다시 확인");
                ui.post(()->status(visible?"삼성 문자통화 입력창 확인됐습니다. HITEL 전면 복귀를 확인하십시오.":"문자통화 자동 진입 미확인. 삼성 화면에서 문자통화를 켜신 뒤 HITEL로 돌아오십시오."));
            }catch(Throwable e){log("W03_TEXT_CALL_EXCEPTION",e.toString());ui.post(()->status("문자통화 탐색 오류: "+e));}
            finally{scanRunning=false;}
        });
    }
    /** Primary microphone action: native Korean streaming ASR inside HITEL, no dialer change. */
    private void startKoreanSherpaSpeech(){
        if(!recordStarted)return;
        if(koreanSherpa!=null&&koreanSherpa.isRunning()){
            stopKoreanSherpaSpeech();return;
        }
        if(!has(Manifest.permission.RECORD_AUDIO)){
            log("SHERPA_KO_PERMISSION_REQUEST","Request Android microphone permission");
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},604);
            return;
        }
        // Preserve manually entered text and previous committed sentences.
        sherpaCommittedText=message.getText().toString().trim();
        sherpaLiveDraft="";
        if(pinnedLiveCaption!=null)pinnedLiveCaption.setText("내 음성 인식 준비 중...");
        if(koreanSherpa==null)koreanSherpa=new KoreanSherpaStt(getApplicationContext(),new KoreanSherpaStt.Listener(){
            @Override public void onState(String phase,String messageText){
                log("SHERPA_KO_"+phase,messageText);
                ui.post(()->{
                    if(isFinishing())return;
                    status(messageText);
                    sttButton.setText("STOP".equals(phase)||"LISTENING".equals(phase)||
                        "MODEL_DOWNLOAD".equals(phase)||"INITIALIZING".equals(phase)?
                        "■ 한국어 마이크 중지":"🎙 한국어 말하기 · HITEL 직접 STT");
                });
            }
            @Override public void onPartial(String text){
                // Partial tokens are provisional; replace only the live draft.
                // DO NOT wait for sherpa-onnx endpoint / end of sentence.
                ui.post(()->{
                    if(isFinishing()||text==null||text.isBlank())return;
                    sherpaLiveDraft=text;
                    String rendered=sherpaCommittedText.isEmpty()?text:
                        sherpaCommittedText+System.lineSeparator()+text;
                    message.setText(rendered);
                    message.setSelection(rendered.length());
                    if(pinnedLiveCaption!=null)
                        pinnedLiveCaption.setText("🎙 내 목소리 · 인식 중"+System.lineSeparator()+text);
                    status("한국어 실시간 인식 중 · 문장이 끝나기 전부터 계속 표시됩니다.");
                });
            }
            @Override public void onFinal(String text){
                ui.post(()->{
                    if(isFinishing()||text==null||text.isBlank())return;
                    // Replace last partial with the final hypothesis; do not append
                    // a second copy of words already rendered during streaming.
                    String joined=sherpaCommittedText.isEmpty()?text:
                        sherpaCommittedText+System.lineSeparator()+text;
                    sherpaCommittedText=joined;
                    sherpaLiveDraft="";
                    message.setText(joined);
                    message.setSelection(joined.length());
                    if(pinnedLiveCaption!=null)
                        pinnedLiveCaption.setText("✓ 내 음성 확정"+System.lineSeparator()+text);
                    lastSttResult=joined;
                    sttSucceeded=true;
                    log("SHERPA_KO_RESULT",text);
                    step(3,"내 음성 인식","UNVERIFIED","sherpa-onnx 실제 디코딩: "+text+
                        "; 발화 정확도와 삼성 통화 중 입력 품질은 실기기 검증 필요");
                });
            }
        });
        if(!koreanSherpa.setTrialMode(voiceTrialModeIndex)){
            status("이전 녹음 세션 종료 중입니다. 메모리 해제 후 다시 시작해 주십시오.");
            log("VA_AB_PRESET_REJECTED","mode="+voiceTrialModeIndex);
            return;
        }
        log("VA_AB_SESSION_REQUEST","selectedMode="+voiceTrialModeIndex+
            "; label="+VoiceAccessAudioTrial.name(voiceTrialModeIndex)+
            "; AndroidAudioModeAndRouteVerifiedSeparately");
        log("SHERPA_KO_USER_START","User pressed HITEL microphone; Korean only; no Samsung keyboard");
        sttButton.setText("■ 한국어 마이크 중지");
        status("한국어 sherpa-onnx 초기화 중입니다. 최초 1회 모델 다운로드가 필요할 수 있습니다.");
        koreanSherpa.start();
    }
    private void stopKoreanSherpaSpeech(){
        if(koreanSherpa!=null)koreanSherpa.stop();
        sttButton.setText("🎙 한국어 말하기 · HITEL 직접 STT");
        if(pinnedLiveCaption!=null)pinnedLiveCaption.setText("내 음성 인식 중지 · 마지막 결과 저장 중");
        log("SHERPA_KO_USER_STOP","User stopped native microphone");
    }

    /** User explicitly requests Samsung's real phone UI for speech input.
     * Never starts a competing HITEL microphone capture during Text Call. */
    private void openSamsungSpeechEntry(){
        if(!recordStarted)return;
        if(isListening){stopSpeech();destroyRecognizer();isListening=false;}
        log("W14_SAMSUNG_DICTATION_REQUEST",
            "Open actual Samsung call UI and focus OEM text field only. "+
            "Samsung keyboard microphone is manually operated; NOT assumed available");
        status("삼성 전화 화면을 엽니다. 문자 입력창이 나타나면 키보드 마이크를 직접 눌러 "+
           "음성인식 가능 여부를 확인해 주십시오. 문자는 자동 전송되지 않습니다.");
        openCallUi();
        ui.postDelayed(()->{
            CallAccessibilityService svc=CallAccessibilityService.instance;
            if(svc==null){
                log("W14_SAMSUNG_DICTATION_NO_A11Y","Cannot focus Samsung edit field without accessibility");
                return;
            }
            boolean focused=svc.focusSamsungTextCallInput();
            log("W14_SAMSUNG_DICTATION_FOCUS","Samsung text-call input focus="+focused+
                "; keyboard mic availability and STT results NOT verified");
        },900);
    }
    /** Diagnostic-only third-party SpeechRecognizer. The original 7/7 failures
     * remain visible as errors, never treated as proof of microphone exclusivity. */
    private void startSpeech(){
        if(!recordStarted)return;
        if(isListening)return;
        if(!has(Manifest.permission.RECORD_AUDIO)){requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},602);return;}
        if(!SpeechRecognizer.isRecognitionAvailable(this)){
            status("이 기기에 STT 음성인식 서비스가 없습니다. 문장을 직접 입력하실 수 있습니다.");
            log("W03_STT_UNSUPPORTED","SpeechRecognizer unavailable; manual typing supported");return;
        }
        stopSpeech();
        String lang=TAGS[language.getSelectedItemPosition()];sttSucceeded=false;lastSttResult="";lastSttError="";
        try{
            recognizer=SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener(){
                @Override public void onReadyForSpeech(Bundle params){status("음성인식 서비스 준비 · 실제 마이크 신호 수신은 미확인");log("W03_STT_READY","serviceReadyOnly; language="+lang);}
                @Override public void onBeginningOfSpeech(){status("발화 인식 중");}
                @Override public void onEndOfSpeech(){status("음성 분석 중");}
                @Override public void onRmsChanged(float rms){}
                @Override public void onBufferReceived(byte[] b){}
                @Override public void onPartialResults(Bundle result){
                    ArrayList<String> values=result.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if(values!=null&&!values.isEmpty())status("듣는 중: "+values.get(0));
                }
                @Override public void onResults(Bundle result){
                    ArrayList<String> values=result.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    isListening=false;
                    if(values!=null&&!values.isEmpty()&&!values.get(0).isBlank()){
                        lastSttResult=values.get(0);message.setText(lastSttResult);sttSucceeded=true;
                        step(3,"내 음성 인식", "UNVERIFIED","STT 텍스트 확보; 실제 발화 정확도는 사용자 확인 필요");
                        log("W03_STT_RESULT",lastSttResult);
                        status("인식 완료. 아래 문장을 수정한 다음 전송 버튼을 선택하십시오.");
                    }else{lastSttError="EMPTY_RESULT";status("인식된 문장이 없습니다. 재시도 또는 직접 입력하십시오.");}
                    destroyRecognizer();
                }
                @Override public void onError(int code){isListening=false;lastSttError="ERROR_"+code;
                    log("W03_STT_ERROR","errorCode="+code+" (7=NO_MATCH; 권한·마이크 독점 확정 아님)");
                    status("HITEL 음성인식 실패 코드 "+code+
                       ". 텍스트 통화 중에는 마이크 입력이 제한될 수 있습니다. "+
                       "삼성 전화 화면의 키보드 음성 입력을 시험하거나 문장을 직접 입력하십시오.");
                    destroyRecognizer();}
                @Override public void onEvent(int type,Bundle data){}
            });
            Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,lang);i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);
            recognizer.startListening(i);isListening=true;
            step(2,"HITEL 전면 마이크 입력","UNVERIFIED","SpeechRecognizer.startListening 호출; 실제 인식 결과 대기");
            log("W03_STT_START","HITEL native foreground; lang="+lang);
        }catch(Throwable e){isListening=false;lastSttError=e.toString();destroyRecognizer();status("인식 시작 오류: "+e);log("W03_STT_START_FAIL",e.toString());}
    }
    private void stopSpeech(){
        if(recognizer!=null&&isListening){try{recognizer.stopListening();status("음성 인식을 종료하고 결과를 확인합니다.");}catch(Throwable e){log("W03_STT_STOP_ERROR",e.toString());}}
    }
    private void destroyRecognizer(){
        if(recognizer!=null){try{recognizer.cancel();recognizer.destroy();}catch(Throwable ignored){}recognizer=null;}
    }
    private void confirmSend(String mode){
        if(!recordStarted)return;
        String value=message.getText().toString().trim();
        if(value.isEmpty()&&!"voice".equals(mode)){toast("보낼 문장을 먼저 말하거나 입력해 주십시오.");return;}
        if(sendWaiting){toast("이전 전송 동작이 완료될 때까지 기다려 주십시오.");return;}
        if("oem_tts".equals(mode))new AlertDialog.Builder(this)
           .setTitle("실제 삼성 TTS 전송 시험")
           .setMessage("전송할 문장:\n"+value+"\n\n삼성 문자통화 화면을 잠시 열어 실제 입력창과 전송 버튼을 조작합니다. 원본 전화 화면이 보이는 동안 '삼성 문자통화 화면이 표시됩니다. 상대방에게 실제 합성음이 들렸는지는 별도로 확인합니다.")
           .setNegativeButton("취소",null).setPositiveButton("TTS 전송 시도",(d,w)->sendOem(value)).show();
        else if("sms".equals(mode))new AlertDialog.Builder(this).setTitle("SMS로 작성")
           .setMessage("전화 회선으로 합성음이 나가는 것이 아니라 별도 문자 앱에 입력합니다. SMS를 실제로 보내는 동작은 사용자가 직접 합니다.")
           .setNegativeButton("취소",null).setPositiveButton("문자 작성 열기",(d,w)->openSms(value)).show();
        else new AlertDialog.Builder(this).setTitle("일반 음성통화로 변경")
           .setMessage("직접 목소리로 말하기 위해 삼성 문자통화에서 일반 통화로 전환합니다. 인식된 텍스트/녹음 음성을 회선에 주입하는 기능이 아닙니다.")
           .setNegativeButton("취소",null).setPositiveButton("삼성 음성통화 전환",(d,w)->switchToVoice()).show();
    }
    private void sendOem(String text){
        attemptedMode="oem_tts";sentAttempted=false;sendWaiting=true;lastSendResult="";
        String src=sttSucceeded?(text.equals(lastSttResult)?"STT":"STT_EDITED"):"MANUAL";
        LabStore.saveVoiceDecision(text,"oem_tts",src,TAGS[language.getSelectedItemPosition()],lastSttError);
        log("W03_USER_SEND_OEM","명시적 사용자 승인; 삼성 Text Call 입력창으로 TTS 전송 시도");
        status("삼성 화면을 잠시 호출해 원본 입력창/전송 버튼을 탐색 중입니다.");
        if(!testOpen){LabStore.startTest("T07");testOpen=true;}
        step(4,"삼성 TTS 전송 선택","UNVERIFIED","실제 삼성 전송 버튼 동작 확인 대기");
        openCallUi();
        io.execute(()->{
            boolean clicked=false,visible=false;
            CallAccessibilityService a=CallAccessibilityService.instance;
            try{
                Thread.sleep(1250);
                if(a!=null){a.scanBlocking("w03_before_oem_send");visible=a.isTextCallVisible();
                    if(!visible){a.enterTextCall();Thread.sleep(1000);}
                    a.scanBlocking("w03_pre_send");visible=a.isTextCallVisible();
                    if(visible){clicked=a.putAndSend(text);a.scanBlocking("w03_after_oem_send");}
                    else log("W03_SEND_NO_OEM_NODE","Samsung 문자 입력창 접근성 노드 없음; 임의 좌표로 전송하지 않음");
                }else log("W03_SEND_NO_ACCESSIBILITY","접근성 서비스 비활성화");
            }catch(Throwable e){log("W03_SEND_EXCEPTION",e.toString());}
            final boolean ok=clicked,seen=visible;
            ui.post(()->{
                sendWaiting=false;sentAttempted=ok;
                lastSendResult=ok?"삼성 전송 버튼 클릭 확인. 상대방 TTS 수신은 아직 미확인":
                    "삼성 Text Call 입력창/전송 버튼 조작 실패. 실제 상대방 송출 미확인";
                step(4,"삼성 문자통화 TTS 전달", "UNVERIFIED",lastSendResult);
                status(lastSendResult+"\nHITEL 복귀 버튼으로 돌아와 상대방 청취 여부를 확인해 주십시오.");
                log("W03_OEM_SEND_RESULT","visibleNode="+seen+" clicked="+ok+"; peerAudioNotProven=true");
            });
        });
    }
    private void openSms(String text){
        attemptedMode="sms";LabStore.saveVoiceDecision(text,"sms",sttSucceeded?"STT_EDITED_OR_ORIGINAL":"MANUAL",TAGS[language.getSelectedItemPosition()],lastSttError);
        step(4,"SMS 별도 작성","UNVERIFIED","문자 작성 앱으로 전달; 문자 실제 송신은 사용자 확인 필요");
        try{Intent sms=new Intent(Intent.ACTION_SENDTO,Uri.parse("smsto:"));sms.putExtra("sms_body",text);startActivity(sms);
            log("W03_SMS_COMPOSER","문자 입력창 열기, 실제 발송은 직접 확인");}
        catch(Throwable e){status("SMS 작성 앱 열기 실패: "+e);log("W03_SMS_FAIL",e.toString());}
    }
    private void switchToVoice(){
        attemptedMode="voice";
        step(4,"일반 음성통화 직접 발화","UNVERIFIED","사용자가 직접 음성 모드 전환을 선택함");
        status("삼성 전화 화면을 열어 일반 음성 전환을 시도합니다. 실제 전환 성공 여부를 확인해 주십시오.");
        openCallUi();
        io.execute(()->{
            try{Thread.sleep(1150);
                CallAccessibilityService a=CallAccessibilityService.instance;
                boolean clicked=a!=null&&a.switchToVoiceCall();
                log("W03_VOICE_SWITCH","삼성 일반 음성 전환 버튼 clicked="+clicked);
                ui.post(()->status(clicked?"일반 음성통화 전환 버튼 조작. 실제 모드 전환 확인 필요.":"삼성 일반 음성 전환 버튼을 찾지 못했습니다. 원본 화면에서 직접 전환해 주십시오."));
            }catch(Throwable e){log("W03_VOICE_SWITCH_ERROR",e.toString());}
        });
    }
    private void peerCheck(boolean heard){
        if(!recordStarted)return;
        if(!"oem_tts".equals(attemptedMode)){
            toast("먼저 삼성 TTS 전송을 선택해 주십시오. SMS/일반 음성에는 TTS 청취 판정을 적용하지 않습니다.");return;
        }
        new AlertDialog.Builder(this).setTitle("상대방 직접 확인")
            .setMessage("실제 통화 상대방께서 삼성 합성음을 "+(heard?"들으셨다고":"듣지 못하셨다고")+" 확인하신 결과입니까?\n\n자동 판정이 아닌 사용자 확인으로 별도 기록됩니다.")
            .setNegativeButton("취소",null).setPositiveButton("확인 결과 저장",(d,w)->{
                String s=heard?"PASS":"FAIL";
                if(testOpen){
                    LabStore.markManual(s,heard?"상대방이 TTS 들음 (사용자 보고)":"상대방 TTS 미수신 (사용자 보고)");
                    try{JSONObject evidence=new JSONObject().put("sendClickObserved",sentAttempted).put("userReportedPeerHeard",heard)
                        .put("observedDelivery",false).put("source","MANUAL_PEER_CONFIRM");
                        LabStore.finishTest(this,s,heard?"사용자 보고: 상대방 삼성 합성음 청취":"사용자 보고: 상대방 합성음 미수신",evidence);
                    }catch(Throwable e){log("W03_TEST_FINALIZE_ERROR",e.toString());}
                    testOpen=false;
                }
                step(5,"상대방 청취 확인",s,"사용자 직접 확인 결과. 객관적 상대방 녹음 증거와는 구분");
                status("상대방 확인 기록: "+(heard?"청취 성공":"미수신")+" (사용자 보고). 종료·ZIP 저장을 누르십시오.");
            }).show();
    }
    private void endSession(){
        if(!recordStarted){finish();return;}
        new AlertDialog.Builder(this).setTitle("W03 테스트 종료·저장")
          .setMessage("통화 자체를 종료하지 않고 이번 진단 기록만 ZIP으로 저장합니다. 화면에 보이지 않는 원본 로그도 모두 포함합니다.")
          .setNegativeButton("취소",null).setPositiveButton("ZIP 저장",(d,w)->{
            if(testOpen){
                try{JSONObject proof=new JSONObject().put("sendClickObserved",sentAttempted).put("manualConfirmation",false);
                    LabStore.finishTest(this,"UNVERIFIED","사용자 상대방 청취 확인 없이 종료됨. 전송버튼 동작만으로 성공 처리하지 않음",proof);
                }catch(Throwable e){log("W03_TEST_END_ERROR",e.toString());}testOpen=false;
            }
            LabStore.finishRun(this,"W03 전면 조작 종료. 단계별 결과와 전체 로그 저장");
            recordStarted=false;CallAccessibilityService.setConsoleRequested(false);
            CallAccessibilityService.disarmDialerFlow(this,"W03_SESSION_END");
            status("저장됨: "+LabStore.lastExport());
            toast("Download 파일: "+LabStore.lastExport());
          }).show();
    }
    private void updateTranscriptHealth(CallAccessibilityService.Snapshot snapshot){
        long now=System.currentTimeMillis();
        boolean samsungFront=snapshot.foregroundPackage.startsWith("com.samsung.");
        long age=snapshot.lastSamsungTranscriptAt==0?-1:now-snapshot.lastSamsungTranscriptAt;
        String state;
        if(age>=0&&age<3500)state="실시간 관측 (마지막 자막 "+(age/1000)+"초 전)";
        else if(age>=0)state="마지막 자막 "+(age/1000)+"초 전 · 새 이벤트 수신 대기";
        else state="자막 이벤트 미관측";
        if(!samsungFront&&snapshot.lastSamsungEventAt>0){
            long evAge=now-snapshot.lastSamsungEventAt;
            state+="\n삼성은 현재 백그라운드 · 마지막 OEM 접근성 이벤트 "+(evAge/1000)+"초 전";
        }
        if(!samsungFront&&(snapshot.lastBackgroundTranscriptAt==0||now-snapshot.lastBackgroundTranscriptAt>3500)){
            state+="\n주의: 백그라운드 신규 자막은 OS/OEM이 이벤트를 제공해야 수집됩니다. 자동 수집 보장 불가";
        }
        state+="\n확보된 원문/송신/번역 기록 "+transcriptEntries.size()+"건";
        transcriptMonitor.setText(state);
        if(backgroundProbeActive){
            if(snapshot.lastBackgroundTranscriptAt>backgroundProbeStarted &&
               snapshot.backgroundMessageCount>backgroundProbeBaseline &&
               snapshot.remoteBackgroundCount-backgroundProbeRemoteBaseline>=2 &&
               snapshot.lastMessageSource.startsWith("event:")){
                backgroundProbeActive=false;
                LabStore.saveBackgroundProbe("PASS",backgroundProbeBaseline,snapshot.backgroundMessageCount,
                    "삼성 비전면 상태에서 실제 접근성 이벤트 출처의 자막 수집, source="+snapshot.lastMessageSource);
                log("W03_BACKGROUND_PROBE_PASS","실제 신규 자막이 삼성 비전면 상태에서 수집됨");
                status("백그라운드 신규 자막 수집 확인. 대화 목록에서 실제 문장을 확인하십시오.");
            }else if(now-backgroundProbeStarted>15000){
                backgroundProbeActive=false;
                LabStore.saveBackgroundProbe("UNVERIFIED",backgroundProbeBaseline,snapshot.backgroundMessageCount,
                    "15초 내 삼성 비전면 신규 자막 이벤트 입증 실패. 실제 발화 여부 및 OEM 이벤트 제공 여부는 별도 확인");
                log("W03_BACKGROUND_PROBE_UNVERIFIED","15초 동안 새 Samsung 자막 이벤트 관측 안 됨. 임의 성공 처리 안 함");
                status("백그라운드 수집 확인 안 됨. 삼성 앱이 숨겨진 상태에서 접근성 이벤트를 제공하지 않았을 수 있습니다.");
            }
        }
    }
    private void startBackgroundProbe(){
        if(!recordStarted)return;
        CallAccessibilityService a=CallAccessibilityService.instance;
        if(a==null){status("접근성 서비스를 먼저 활성화해 주십시오.");return;}
        if(!a.isHitelForeground()){
            status("HITEL 화면을 전면에 띄운 상태에서 시험해 주십시오.");return;
        }
        CallAccessibilityService.Snapshot snap=a.snapshot();
        backgroundProbeRemoteBaseline=snap.remoteBackgroundCount;
        backgroundProbeBaseline=snap.backgroundMessageCount;
        backgroundProbeStarted=System.currentTimeMillis();backgroundProbeActive=true;
        log("W03_BACKGROUND_PROBE_BEGIN","사용자 요청: HITEL 화면 전면 유지, 상대방이 새 문장을 발화한 뒤 실제 삼성 이벤트 수집 시험");
        status("HITEL 전면 상태를 유지한 채 상대방께 서로 다른 새 문장 두 개를 말씀해 달라고 요청하십시오. 실제 삼성 원문 이벤트 2건을 검사합니다.");
    }
    /** Reads the entire running transcript JSONL incrementally, without truncating or inventing missing events. */
    private void refreshTranscripts(){
        File f=LabStore.transcriptsFile(this);
        if(f==null)return;
        if(transcriptReadFile==null||!transcriptReadFile.equals(f)){
            transcriptReadFile=f;transcriptCursor=0;transcriptEntries.clear();
            transcriptAdapter.notifyDataSetChanged();
        }
        if(!f.exists())return;
        if(f.length()<transcriptCursor){transcriptCursor=0;transcriptEntries.clear();transcriptAdapter.notifyDataSetChanged();}
        int appended=0;
        try(RandomAccessFile reader=new RandomAccessFile(f,"r")){
            reader.seek(transcriptCursor);String encoded;
            while((encoded=reader.readLine())!=null){
                transcriptCursor=reader.getFilePointer();
                String line=new String(encoded.getBytes(StandardCharsets.ISO_8859_1),StandardCharsets.UTF_8);
                if(line.isBlank())continue;
                try{
                    JSONObject item=new JSONObject(line);
                    String id=item.optString("viewId","");
                    String who=id.contains("remote_message_translated")?"상대방 · 번역":
                               id.contains("local_message_translated")?"내 발신 · 번역":
                               "remote".equals(item.optString("direction"))?"상대방": "내 발신";
                    long ms=item.optLong("timestampMs",0L);
                    String at=ms>0?new java.text.SimpleDateFormat("HH:mm:ss.SSS",Locale.KOREA).format(new java.util.Date(ms)):"시간 미확인";
                    String changed="UPDATED".equals(item.optString("update"))?" · 정정":"";
                    String bg=item.optBoolean("background")?" · 백그라운드 이벤트":"";
                    transcriptEntries.add(at+"  "+who+changed+bg+"\n"+item.optString("text")+"\n["+item.optString("source","actual_accessibility_node")+"]");
                    appended++;
                }catch(Exception e){log("W03_TRANSCRIPT_DECODE_ERROR",e.toString());}
            }
        }catch(Exception e){log("W03_TRANSCRIPT_READ_ERROR",e.toString());}
        if(appended>0){transcriptAdapter.notifyDataSetChanged();
            if(followTranscripts)transcriptList.setSelection(transcriptEntries.size()-1);
        }
    }
    private void refreshLogs(){
        File f=LabStore.logFile(this);if(f.length()<cursor){cursor=0;entries.clear();logAdapter.notifyDataSetChanged();}
        int added=0;
        try(RandomAccessFile r=new RandomAccessFile(f,"r")){
            r.seek(cursor);String line;
            while((line=r.readLine())!=null){cursor=r.getFilePointer();String raw=new String(line.getBytes(StandardCharsets.ISO_8859_1),StandardCharsets.UTF_8);
                if(raw.isBlank())continue;
                try{JSONObject j=new JSONObject(raw);entries.add("["+j.optString("time")+"] "+j.optString("type")+": "+j.optString("message"));}
                catch(Exception ex){entries.add(raw);}
                added++;
            }
        }catch(Throwable e){/* retry next poll; original file is untouched */}
        if(added>0){logAdapter.notifyDataSetChanged();logHeader.setText("전체 실행 로그 · "+entries.size()+"줄");
            if(followLogs)logList.setSelection(logAdapter.getCount()-1);}
    }
    @Override public void onRequestPermissionsResult(int req,String[] perm,int[] result){
        super.onRequestPermissionsResult(req,perm,result);
        if(result.length>0&&result[0]==PackageManager.PERMISSION_GRANTED){
            if(req==601)placeCall();else if(req==602)startSpeech();
            else if(req==603)refreshState();else if(req==604)startKoreanSherpaSpeech();
        }else{toast("필요한 권한이 허용되지 않았습니다. 가능한 기능만 사용하실 수 있습니다.");}
    }
    @Override protected void onResume(){super.onResume();
        if(getIntent()!=null&&getIntent().getBooleanExtra("hitel_auto_return",false)){
            getIntent().removeExtra("hitel_auto_return");focusTranscriptAfterAutoReturn();
        }
        if(!has(Manifest.permission.READ_PHONE_STATE)){
            ui.postDelayed(()->{if(!isFinishing()&&!has(Manifest.permission.READ_PHONE_STATE))
                 requestPermissions(new String[]{Manifest.permission.READ_PHONE_STATE},603);},400);
        }
    }
    @Override protected void onDestroy(){
        ui.removeCallbacks(poll);destroyRecognizer();
        if(koreanSherpa!=null)koreanSherpa.stop();
        io.shutdown();
        if(isFinishing()&&recordStarted)log("W03_UI_EXIT","화면만 닫힘. 이전에 저장한 자료 보존. 통화 강제 종료하지 않음");
        super.onDestroy();
    }
}
