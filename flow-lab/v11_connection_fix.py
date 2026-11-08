from pathlib import Path
root=Path("AndroidProject/app/src/main")
svc=root/"java/app/hitel/samsungprobe/CallAccessibilityService.java"
ui=root/"java/app/hitel/samsungprobe/W03ConsoleActivity.java"
gradle=Path("AndroidProject/app/build.gradle.kts")
manifest=root/"AndroidManifest.xml"
s=svc.read_text(encoding="utf-8")
def replace(old,new):
    global s
    assert old in s,("not found:",old[:100])
    s=s.replace(old,new,1)
def section(start,end,replacement):
    global s
    i=s.index(start);j=s.index(end,i)
    s=s[:i]+replacement+s[j:]
replace('    private boolean controlReadyLogged=false;','''    private boolean controlReadyLogged=false;
    private long lastFlowDiagnosticAt=0;
    private static volatile String detection="삼성 통화 연결과 버튼 확인 대기";
    public static String currentDetection(){return detection;}
    public static boolean serviceConnected(){return instance!=null;}''')
replace('        controlFirstObservedAt=0;controlReadyLogged=false;','''        controlFirstObservedAt=0;controlReadyLogged=false;
        lastFlowDiagnosticAt=0;detection="전화 연결과 텍스트 통화 버튼 감지 대기";''')
# Turn visible Samsung windows into the source of truth. No screenshot OCR or default dialer replacement.
section('    /** A connected-call chronometer','    /** OFFHOOK alone covers', '''    private List<AccessibilityNodeInfo> samsungRoots(){
        List<AccessibilityNodeInfo> result=new ArrayList<>();
        try{
            List<AccessibilityWindowInfo> wins=getWindows();
            if(wins!=null)for(AccessibilityWindowInfo win:wins){
                AccessibilityNodeInfo node=win.getRoot();
                if(node!=null&&isSamsung(s(node.getPackageName())))result.add(node);
            }
            if(result.isEmpty()){
                AccessibilityNodeInfo node=getRootInActiveWindow();
                if(node!=null&&isSamsung(s(node.getPackageName())))result.add(node);
            }
        }catch(Throwable e){LabStore.log("W11_SAMSUNG_ROOT_ERROR",e.toString());}
        return result;
    }
    private AccessibilityNodeInfo clickableAncestor(AccessibilityNodeInfo n){
        for(int i=0;n!=null&&i<8;n=n.getParent())
            if(n.isVisibleToUser()&&n.isEnabled()&&n.isClickable())return n;
        return null;
    }
    /** Samsung's actual button reads "텍스트 통화" on the user device.
     * Check view IDs first, then find visible text/description in Samsung ONLY. */
    private AccessibilityNodeInfo textCallButton(){
        for(String id:new String[]{"in_call_text_call_container",
           "bixby_text_call_floating_button_container",
           "upgrade_to_bixby_text_call_button"}){
            AccessibilityNodeInfo n=activeSamsungNode(id);
            if(n!=null&&n.isVisibleToUser()&&n.isEnabled()&&clickableAncestor(n)!=null)return n;
        }
        for(AccessibilityNodeInfo root:samsungRoots()){
            for(String label:new String[]{"텍스트 통화","문자 통화","Text Call"}){
                List<AccessibilityNodeInfo> hits=root.findAccessibilityNodeInfosByText(label);
                if(hits==null)continue;
                for(AccessibilityNodeInfo n:hits){
                    if(n==null||!n.isVisibleToUser()||!n.isEnabled())continue;
                    String text=s(n.getText()).trim(),desc=s(n.getContentDescription()).trim();
                    if((text.equalsIgnoreCase(label)||desc.equalsIgnoreCase(label))&&
                        clickableAncestor(n)!=null)return n;
                }
            }
            AccessibilityNodeInfo found=textCallByDescription(root,0,new int[]{0});
            if(found!=null)return found;
        }
        return null;
    }
    private AccessibilityNodeInfo textCallByDescription(AccessibilityNodeInfo n,int depth,int[] count){
        if(n==null||depth>22||count[0]++>4000)return null;
        String desc=s(n.getContentDescription()).trim(),txt=s(n.getText()).trim();
        if(n.isVisibleToUser()&&n.isEnabled()&&
          ("텍스트 통화".equals(desc)||"텍스트 통화".equals(txt)||
           "문자 통화".equals(desc)||"Text Call".equalsIgnoreCase(desc))&&
          clickableAncestor(n)!=null)return n;
        for(int i=0;i<n.getChildCount();i++){
            AccessibilityNodeInfo found=textCallByDescription(n.getChild(i),depth+1,count);
            if(found!=null)return found;
        }
        return null;
    }
    /** Detect MM:SS in Samsung's live call window. Require movement of timer
     * to prove a connected call, never infer it from OFFHOOK alone. */
    private int callDurationSeconds(AccessibilityNodeInfo node,int depth,int[] count){
        if(node==null||depth>22||count[0]++>4500)return -1;
        String id=s(node.getViewIdResourceName()).toLowerCase(java.util.Locale.ROOT);
        String desc=s(node.getContentDescription()).toLowerCase(java.util.Locale.ROOT);
        String value=s(node.getText()).trim();
        boolean named=id.contains("chronometer")||id.contains("call_time")||
           id.contains("elapsed_time")||id.contains("call_duration")||
           desc.contains("통화 시간")||desc.contains("call duration");
        android.graphics.Rect rect=new android.graphics.Rect();
        node.getBoundsInScreen(rect);
        int height=getResources().getDisplayMetrics().heightPixels;
        boolean topCallArea=rect.top>px(27)&&rect.bottom<height/3;
        if(node.isVisibleToUser()&&(named||topCallArea)){
            if(value.isEmpty())value=s(node.getContentDescription()).trim();
            java.util.regex.Matcher match=java.util.regex.Pattern.compile(
                "^(?:([0-9]{1,2}):)?([0-9]{2}):([0-9]{2})$").matcher(value);
            if(match.matches()){
                int h=match.group(1)==null?0:Integer.parseInt(match.group(1));
                int m=Integer.parseInt(match.group(2)),sec=Integer.parseInt(match.group(3));
                if(m<60&&sec<60)return h*3600+m*60+sec;
            }
        }
        for(int i=0;i<node.getChildCount();i++){
            int seconds=callDurationSeconds(node.getChild(i),depth+1,count);
            if(seconds>=0)return seconds;
        }
        return -1;
    }
    private int observedCallDuration(){
        for(AccessibilityNodeInfo root:samsungRoots()){
            String pkg=s(root.getPackageName());
            if(!pkg.startsWith("com.samsung.android.incallui")&&
               !pkg.startsWith("com.samsung.android.app.telephonyui"))continue;
            int seconds=callDurationSeconds(root,0,new int[]{0});
            if(seconds>=0)return seconds;
        }
        return -1;
    }
''')
section('    /** OFFHOOK alone covers','    private void inspectAutomaticCallFlow', '''    /** Click only after the Samsung Text Call control becomes visible post-answer.
     * Rising connection timer is logged as proof when the OEM exposes it.
     * A stable label without timer is treated as an OEM UI cue, not network proof. */
    private boolean answeredUiGate(int state){
        if(state!=TelephonyManager.CALL_STATE_OFFHOOK)return false;
        int timer=observedCallDuration();
        if(timer>=0){
            if(lastElapsedSeconds>=0&&timer>lastElapsedSeconds){
                if(!connectedTimerObserved)
                    LabStore.log("W11_CONNECTED_TIMER_ADVANCING",
                        "Samsung call timer advanced "+lastElapsedSeconds+" to "+timer+" seconds");
                connectedTimerObserved=true;
            }
            lastElapsedSeconds=timer;
        }
        AccessibilityNodeInfo button=textCallButton();
        if(button==null){
            controlFirstObservedAt=0;
            callFlowPhase=connectedTimerObserved?"CONNECTED_WAIT_TEXT_BUTTON":"WAIT_FOR_ANSWER";
            detection=connectedTimerObserved?"통화시간 증가 확인 · 텍스트 통화 버튼 대기":
                "OFFHOOK(발신·통화 구분 불가) · 삼성 연결시간/버튼 탐색";
            return false;
        }
        long now=SystemClock.elapsedRealtime();
        if(controlFirstObservedAt==0){
            controlFirstObservedAt=now;
            LabStore.log("W11_TEXT_CALL_BUTTON_VISIBLE",
                "resourceId="+s(button.getViewIdResourceName())+
                " text="+s(button.getText())+
                " desc="+s(button.getContentDescription())+
                " elapsed="+timer);
            return false;
        }
        if(now-controlFirstObservedAt<1200)return false;
        if(!controlReadyLogged){
            controlReadyLogged=true;callFlowPhase="TEXT_BUTTON_AVAILABLE";
            detection=connectedTimerObserved?
                "삼성 실제 통화시간 증가 + 텍스트 통화 버튼 확인":
                "텍스트 통화 버튼 활성 1.2초 확인(통화시간 공개 여부는 별도)";
            LabStore.log("W11_TEXT_BUTTON_READY",detection);
        }
        return true;
    }
    private boolean clickTextCallOnActiveSamsung(){
        AccessibilityNodeInfo button=textCallButton();
        AccessibilityNodeInfo target=clickableAncestor(button);
        if(target==null){LabStore.log("W11_CLICK_MISSING","Samsung Text Call button/clickable ancestor not found");return false;}
        boolean clicked=target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        LabStore.log("W11_TEXT_CALL_CLICK","result="+clicked+
            " buttonId="+s(button.getViewIdResourceName())+
            " text="+s(button.getText())+
            " targetId="+s(target.getViewIdResourceName()));
        return clicked;
    }
''')
replace('''        if(!hasSamsungCallWindow())return; // never act on a hidden dialer''','''        if(!hasSamsungCallWindow()){
            long now=SystemClock.elapsedRealtime();
            if(now-lastFlowDiagnosticAt>6000){
                lastFlowDiagnosticAt=now;
                LabStore.log("W11_NO_SAMSUNG_WINDOW",
                    "Samsung InCallUI inaccessible; activePackage="+activePkg());
            }
            return;
        }''')
replace('''        LabStore.log("A11Y_SERVICE","연결됨. 실제 접근성 ID / 텍스트 / 컨텐츠 설명 사용");''','''        LabStore.log("A11Y_SERVICE","연결됨. 실제 접근성 ID / 텍스트 / 컨텐츠 설명 사용");
        LabStore.log("W11_MONITOR_ENABLED","Samsung incoming event + timer + label detection enabled");''')
s=s.replace('return activePkg().startsWith("com.samsung.android.incallui");','return activePkg().startsWith("com.samsung.android.incallui")||activePkg().startsWith("com.samsung.android.app.telephonyui");',1)
svc.write_text(s,encoding="utf-8")
u=ui.read_text(encoding="utf-8")
old='            CallAccessibilityService.armDialerFlow(this);'
assert old in u
u=u.replace(old,'''            if(!CallAccessibilityService.serviceConnected()){
                log("W11_ACCESSIBILITY_NOT_CONNECTED","HITEL accessibility service not running");
                status("HITEL v0.11 접근성 서비스를 먼저 활성화해야 자동 연결 감지가 됩니다.");
                new android.app.AlertDialog.Builder(this)
                    .setTitle("HITEL v0.11 접근성 서비스 연결 필요")
                    .setMessage("삼성 통화 연결 및 텍스트 통화 버튼을 자동 감지하려면 v0.11 접근성 서비스를 활성화해야 합니다. 설정을 여시겠습니까?")
                    .setPositiveButton("접근성 설정 열기",(d,which)->startActivity(
                       new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)))
                    .setNegativeButton("취소",null).show();
                return;
            }
            CallAccessibilityService.armDialerFlow(this);''',1)
old='''            if("WAIT_FOR_ANSWER".equals(phase))
                callState.setText("전화 상태: 발신 또는 연결 대기 · 삼성 문자통화 버튼 표시를 기다리는 중");'''
assert old in u
u=u.replace(old,'''            if("WAIT_FOR_ANSWER".equals(phase))
                callState.setText("전화 상태: "+CallAccessibilityService.currentDetection());
            else if("CONNECTED_WAIT_TEXT_BUTTON".equals(phase))
                callState.setText("통화 연결 증거: 삼성 통화시간 증가 확인 · 문자통화 버튼 대기");''',1)
old='callState.setText("삼성 문자통화 버튼 관측 · 연결 시간 증거와 구분하여 기록");'
assert old in u
u=u.replace(old,'callState.setText(CallAccessibilityService.currentDetection());',1)
ui.write_text(u,encoding="utf-8")
b=gradle.read_text(encoding="utf-8")
assert 'app.hitel.callflowlab.v10' in b
b=b.replace('app.hitel.callflowlab.v10','app.hitel.callflowlab.v11').replace('versionCode = 10','versionCode = 11').replace('0.10.0-connected-gate-auto-return','0.11.0-samsung-timer-label-detection')
gradle.write_text(b,encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
assert 'HITEL 통화 실시간 자막 v0.10 (응답감지)' in m
manifest.write_text(m.replace('HITEL 통화 실시간 자막 v0.10 (응답감지)','HITEL 통화 실시간 자막 v0.11 (삼성 연결감지)'),encoding="utf-8")
print("PASS v0.11: Samsung call timer + text/description button detection; accessibility connection gate; independent install package")
