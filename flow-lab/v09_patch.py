from pathlib import Path

root=Path("AndroidProject/app/src/main")
w=root/"java/app/hitel/samsungprobe/W03ConsoleActivity.java"
a=root/"java/app/hitel/samsungprobe/CallAccessibilityService.java"
manifest=root/"AndroidManifest.xml"
gradle=Path("AndroidProject/app/build.gradle.kts")

def sub(path,old,new):
    s=path.read_text(encoding="utf-8")
    if old not in s:
        # Noncritical v0.8 text can change; core anchors are validated by CI.
        print("SKIP nonmatching optional anchor:",str(path),old[:105])
        return
    path.write_text(s.replace(old,new,1),encoding="utf-8")

# W03: user's "전화 걸기" is a user-controlled Samsung dialpad, NOT a request
# to enter a telephone number in HITEL and let HITEL place a phone call.
sub(w,'    private ScrollView scrollBody;', '    private ScrollView scrollBody;') if '    private ScrollView scrollBody;' in w.read_text() else None
sub(w,'    private TextView callState, textCallState, remoteSubtitle, sentSubtitle, status, logHeader, flowStatus;',
      '    private TextView callState, textCallState, remoteSubtitle, sentSubtitle, status, logHeader, flowStatus;\n    private ScrollView scrollBody;')
sub(w,'        flowStatus=label("이 화면을 보면서 통화를 진행합니다.",12,false);screen.addView(flowStatus);',
      '        flowStatus=label("① 전화 걸기 → 삼성 번호판 → 연결 → 문자통화 → HITEL 자동 복귀",12,true);screen.addView(flowStatus);')
sub(w,'        ScrollView sc=new ScrollView(this);LinearLayout content=container();',
      '        ScrollView sc=new ScrollView(this);scrollBody=sc;LinearLayout content=container();')
sub(w,'        phone.setHint("시험 상대방 전화번호 (미입력 시 이미 연결된 통화 사용)");',
      '        phone.setHint("번호 입력 선택 사항 (삼성 전화번호판에서 직접 입력 가능)");')
sub(w,'        callButton=btn("전화 걸기",this::placeCall);',
      '        callButton=btn("전화 걸기 · 삼성 번호판 열기",this::placeCall);')
sub(w,'        content.addView(label("전화 앱 화면이 나타나면 화면 위의 \'HITEL로 돌아오기\'를 누르십시오. 통화는 계속됩니다.",12,false));',
      '        content.addView(label("삼성 전화 앱에서 번호를 누르고 발신하십시오. 상대방과 연결된 후 문자통화 모드를 자동 탐색합니다. 활성화되면 HITEL 화면으로 복귀를 시도합니다.",12,false));')
sub(w,'        textCallButton=btn("문자통화 화면 실행·확인",this::prepareTextCall);',
      '        textCallButton=btn("문자통화 전환 다시 시도 (예비)",this::prepareTextCall);')
sub(w,'        content.addView(label("삼성 화면 위에는 실제 자막을 보여주는 HITEL 자막 패널이 나타납니다. 패널을 축소하여 삼성 조작을 계속하거나 HITEL 전체 화면으로 돌아올 수 있습니다. 삼성 앱이 숨겨진 상태의 이벤트 수집은 별도로 검증합니다.",11,false));',
      '        content.addView(label("자동으로 문자통화가 열리지 않는 경우에만 위 예비 버튼을 사용하십시오. 삼성 화면의 HITEL 복귀 패널을 직접 눌러도 되며, 삼성 앱이 숨겨질 때의 신규 자막은 실제 이벤트로 판정합니다.",11,false));')
sub(w,'        transcriptMonitor=label("삼성 원본 자막 이벤트 대기. 백그라운드 수집 가능 여부는 실제 이벤트로 확인합니다.",12,true);',
      '        transcriptMonitor=label("상대방 발화 · 내 발신 문장 수집 대기. 삼성 문자통화 활성화 후 자동 중계합니다.",12,true);')

p=w.read_text(encoding="utf-8")
start=p.index('    private void placeCall(){')
end=p.index('    private void refreshState(){',start)
p=p[:start]+'''    /** Opens Samsung's dialpad with NO number required. The user types and calls.
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
            focusTranscriptAfterAutoReturn();
    }
''' + p[end:]
w.write_text(p,encoding="utf-8")

sub(w,'        if(!has(Manifest.permission.READ_PHONE_STATE)){',
      '        if(!has(Manifest.permission.READ_PHONE_STATE)){') # keep runtime permission gate
sub(w,'        if(!recordStarted)return;\n        new AlertDialog.Builder(this).setTitle("W03 테스트 종료·저장")',
      '        if(!recordStarted)return;\n        new AlertDialog.Builder(this).setTitle("W03 테스트 종료·저장")')
sub(w,'            recordStarted=false;CallAccessibilityService.setConsoleRequested(false);',
      '            recordStarted=false;CallAccessibilityService.setConsoleRequested(false);\n            CallAccessibilityService.disarmDialerFlow(this,"W03_SESSION_END");')
sub(w,'    @Override protected void onResume(){super.onResume();\n        if(!has(Manifest.permission.READ_PHONE_STATE)){',
      '    @Override protected void onResume(){super.onResume();\n        if(getIntent()!=null&&getIntent().getBooleanExtra("hitel_auto_return",false)){\n            getIntent().removeExtra("hitel_auto_return");focusTranscriptAfterAutoReturn();\n        }\n        if(!has(Manifest.permission.READ_PHONE_STATE)){')
# Prevent double processing when the activity is reused and onResume follows onNewIntent.
sub(w,'        if(intent!=null&&intent.getBooleanExtra("hitel_auto_return",false))\n            focusTranscriptAfterAutoReturn();',
      '        if(intent!=null&&intent.getBooleanExtra("hitel_auto_return",false))\n            ui.postDelayed(()->{\n                if(getIntent()!=null&&getIntent().getBooleanExtra("hitel_auto_return",false)){\n                    getIntent().removeExtra("hitel_auto_return");focusTranscriptAfterAutoReturn();\n                }\n            },250);')

# A11y: arm after the explicit W03 dialer action, then only interact with an
# ON-SCREEN Samsung in-call view, never coordinates or an unverified background UI.
sub(a,'import android.app.Activity;', 'import android.app.Activity;') if 'import android.app.Activity;' in a.read_text() else None
sub(a,'import android.accessibilityservice.AccessibilityService;',
      'import android.accessibilityservice.AccessibilityService;\nimport android.Manifest;\nimport android.content.Context;\nimport android.content.pm.PackageManager;\nimport android.telephony.TelephonyManager;\nimport android.os.SystemClock;')
sub(a,'    private static volatile boolean consoleRequested=false;',
'''    private static volatile boolean consoleRequested=false;
    private static volatile boolean dialerFlowArmed=false;
    private long dialerArmedAt=0,offhookSince=0,lastAutoClickAt=0;
    private int textCallClickAttempts=0;
    private boolean autoReturnAttempted=false;
    private final Runnable dialerMonitor=new Runnable(){
        @Override public void run(){
            if(!dialerFlowArmed)return;
            inspectAutomaticCallFlow("timer");
            main.postDelayed(this,750);
        }
    };
    public static void armDialerFlow(Context c){
        c.getSharedPreferences("w03_auto_flow",Context.MODE_PRIVATE).edit()
            .putLong("armedAt",System.currentTimeMillis()).apply();
        dialerFlowArmed=true;
        CallAccessibilityService s=instance;
        if(s!=null)s.main.post(()->s.beginAutomaticCallFlow("dialpad button"));
        LabStore.log("W03_AUTO_ARM","사용자가 삼성 전화번호판 자동 흐름을 시작함; 문자통화 실제 활성화 이후에만 복귀");
    }
    public static void disarmDialerFlow(Context c,String reason){
        dialerFlowArmed=false;
        c.getSharedPreferences("w03_auto_flow",Context.MODE_PRIVATE).edit()
            .remove("armedAt").apply();
        CallAccessibilityService s=instance;
        if(s!=null)s.main.post(()->s.main.removeCallbacks(s.dialerMonitor));
        LabStore.log("W03_AUTO_END",reason);
    }
    private void beginAutomaticCallFlow(String reason){
        dialerArmedAt=System.currentTimeMillis();
        offhookSince=0;lastAutoClickAt=0;textCallClickAttempts=0;
        autoReturnAttempted=false;
        main.removeCallbacks(dialerMonitor);
        main.post(dialerMonitor);
        LabStore.log("W03_AUTO_BEGIN",reason);
    }
    private int actualCallState(){
        try{
            if(checkSelfPermission(Manifest.permission.READ_PHONE_STATE)!=PackageManager.PERMISSION_GRANTED)return -1;
            TelephonyManager t=(TelephonyManager)getSystemService(TELEPHONY_SERVICE);
            return t==null?-1:t.getCallState();
        }catch(Throwable e){LabStore.log("W03_AUTO_TELEPHONY_ERROR",e.toString());return -1;}
    }
    private AccessibilityNodeInfo activeSamsungRoot(){
        AccessibilityNodeInfo r=getRootInActiveWindow();
        return r!=null&&isSamsung(s(r.getPackageName()))?r:null;
    }
    private AccessibilityNodeInfo activeSamsungNode(String name){
        AccessibilityNodeInfo root=activeSamsungRoot();
        if(root==null)return null;
        List<AccessibilityNodeInfo> matches=root.findAccessibilityNodeInfosByViewId(P+name);
        if(matches!=null)for(AccessibilityNodeInfo n:matches)
            if(n!=null&&n.isVisibleToUser())return n;
        return null;
    }
    private boolean activeTextCallVisible(){
        for(String name:new String[]{"text_call_message_edit_text",
                  "text_call_main","text_call_message_list_recycler_view",
                  "translation_text_call_main","translation_call_message_list_recycler_view"})
            if(activeSamsungNode(name)!=null)return true;
        return false;
    }
    private boolean clickTextCallOnActiveSamsung(){
        for(String name:new String[]{"in_call_text_call_container",
             "bixby_text_call_floating_button_container",
             "upgrade_to_bixby_text_call_button","accept_as_text_call"}){
            AccessibilityNodeInfo n=activeSamsungNode(name);
            if(n!=null&&n.isEnabled()){
                boolean result=click(n);
                LabStore.log("W03_AUTO_OEM_TEXTCALL_CLICK","id="+name+" clicked="+result+
                    " (OEM 실제 활성화는 별도로 확인)");
                if(result)return true;
            }
        }
        return false;
    }
    private void inspectAutomaticCallFlow(String why){
        if(!dialerFlowArmed||!LabStore.running()||!"W03".equals(LabStore.currentScenario()))return;
        if(System.currentTimeMillis()-dialerArmedAt>20*60*1000){
            disarmDialerFlow(this,"20_MIN_FLOW_TIMEOUT");return;
        }
        int state=actualCallState();
        if(state==TelephonyManager.CALL_STATE_IDLE&&offhookSince!=0){
            disarmDialerFlow(this,"CALL_IDLE_AFTER_OFFHOOK");return;
        }
        if(activeSamsungRoot()==null)return; // never act on a hidden dialer
        if(activeTextCallVisible()){
            if(state==TelephonyManager.CALL_STATE_IDLE)return;
            if(!autoReturnAttempted){
                autoReturnAttempted=true;
                LabStore.log("W03_AUTO_TEXTCALL_READY",
                    "Samsung Text Call live nodes visible; state="+state+"; source="+why);
                main.postDelayed(()->{
                    if(!dialerFlowArmed||!activeTextCallVisible()||
                            actualCallState()==TelephonyManager.CALL_STATE_IDLE){
                        autoReturnAttempted=false;return;
                    }
                    try{
                        Intent next=new Intent(this,W03ConsoleActivity.class);
                        next.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                            Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                        next.putExtra("hitel_auto_return",true);
                        startActivity(next);
                        LabStore.log("W03_AUTO_RETURN_REQUEST",
                            "HITEL foreground requested after visible OEM Text Call. BAL result requires UI observation");
                    }catch(Throwable e){
                        LabStore.log("W03_AUTO_RETURN_BLOCKED",e.toString()+
                            " · Samsung floating panel remains as manual fallback");
                    }
                    // Stop auto-switching after a single return request; the overlay
                    // remains available if Android forbids background activity start.
                    dialerFlowArmed=false;
                    getSharedPreferences("w03_auto_flow",MODE_PRIVATE).edit()
                        .remove("armedAt").apply();
                    main.removeCallbacks(dialerMonitor);
                },1000);
            }
            return;
        }
        if(state!=TelephonyManager.CALL_STATE_OFFHOOK)return;
        long now=SystemClock.elapsedRealtime();
        if(offhookSince==0){
            offhookSince=now;
            LabStore.log("W03_AUTO_OFFHOOK",
                "OFFHOOK 관측됨; 발신중도 포함되므로 응답 완료와 동일시하지 않음");
            return;
        }
        // Wait until the in-call UI stabilizes; do not treat OFFHOOK as proof
        // the far-end answered. The Samsung button is the final availability gate.
        if(now-offhookSince<4000||textCallClickAttempts>=4||now-lastAutoClickAt<3800)return;
        lastAutoClickAt=now;
        boolean clicked=clickTextCallOnActiveSamsung();
        if(clicked)textCallClickAttempts++;
    }
''')
sub(a,'        main.post(this::updateOverlay);',
      '''        main.post(this::updateOverlay);
        long remembered=getSharedPreferences("w03_auto_flow",MODE_PRIVATE).getLong("armedAt",0);
        if(remembered>0&&System.currentTimeMillis()-remembered<20*60*1000){
            dialerFlowArmed=true;main.post(()->beginAutomaticCallFlow("service reconnect"));
        }''')
sub(a,'        if(consoleRequested)updateOverlay();',
      '        if(consoleRequested)updateOverlay();')
sub(a,'            if(overlayShown)refreshOverlayTimeline();',
      '            if(overlayShown)refreshOverlayTimeline();\n            if(dialerFlowArmed)inspectAutomaticCallFlow("samsung accessibility event");')
sub(a,'            boolean want=consoleRequested&&LabStore.running()&&"W03".equals(LabStore.currentScenario())&&samsungWindowOnTop();',
      '            boolean want=consoleRequested&&LabStore.running()&&"W03".equals(LabStore.currentScenario())&&samsungWindowOnTop()&&activeTextCallVisible();')
sub(a,'                overlayScroller=new ScrollView(this);',
      '                overlayScroller=new ScrollView(this);\n                overlayScroller.setVisibility(View.GONE);')
sub(a,'                    WindowManager.LayoutParams.MATCH_PARENT,px(270),',
      '                    WindowManager.LayoutParams.MATCH_PARENT,px(60),')
sub(a,'                Button toggle=new Button(this);toggle.setAllCaps(false);toggle.setText("자막 축소");toggle.setTextSize(12);',
      '                Button toggle=new Button(this);toggle.setAllCaps(false);toggle.setText("자막 확대");toggle.setTextSize(12);')
sub(a,'    @Override public void onDestroy(){hideOverlay();consoleRequested=false;instance=null;',
      '    @Override public void onDestroy(){main.removeCallbacks(dialerMonitor);hideOverlay();consoleRequested=false;instance=null;')

sub(manifest,'HITEL 통화 실시간 자막 v0.8','HITEL 통화 실시간 자막 v0.9')
sub(gradle,'versionCode = 8','versionCode = 9')
sub(gradle,'versionName = "0.8.0-live-samsung-event-proof"',
           'versionName = "0.9.0-dialer-textcall-auto-return"')
print("PASS v09 patches: ACTION_DIAL without HITEL phone number; Samsung foreground UI auto Text Call; return after confirmed OEM Text Call; overlay collapsed until Text Call")
