from pathlib import Path
base=Path("AndroidProject/app/src/main")
svc=base/"java/app/hitel/samsungprobe/CallAccessibilityService.java"
w03=base/"java/app/hitel/samsungprobe/W03ConsoleActivity.java"
gradle=Path("AndroidProject/app/build.gradle.kts")
manifest=base/"AndroidManifest.xml"
s=svc.read_text(encoding="utf-8")
def sub(old,new):
 global s
 assert old in s,("missing source anchor",old[:140])
 s=s.replace(old,new,1)

sub('''    private boolean autoReturnAttempted=false;''','''    private boolean autoReturnAttempted=false;
    private long controlFirstObservedAt=0;
    private boolean controlReadyLogged=false;
    private int lastElapsedSeconds=-1;
    private boolean connectedTimerObserved=false;
    private static volatile String callFlowPhase="IDLE";
    public static String currentFlowPhase(){return callFlowPhase;}''')
sub('''        dialerArmedAt=System.currentTimeMillis();
        offhookSince=0;lastAutoClickAt=0;textCallClickAttempts=0;''','''        dialerArmedAt=System.currentTimeMillis();
        offhookSince=0;lastAutoClickAt=0;textCallClickAttempts=0;
        controlFirstObservedAt=0;controlReadyLogged=false;
        lastElapsedSeconds=-1;connectedTimerObserved=false;callFlowPhase="WAIT_FOR_ANSWER";''')
sub('''        dialerFlowArmed=true;
        CallAccessibilityService s=instance;''','''        dialerFlowArmed=true;callFlowPhase="WAIT_FOR_ANSWER";
        CallAccessibilityService s=instance;''')
sub('''        dialerFlowArmed=false;
        c.getSharedPreferences("w03_auto_flow"''','''        dialerFlowArmed=false;callFlowPhase="ENDED";
        c.getSharedPreferences("w03_auto_flow"''')
start=s.index('    private AccessibilityNodeInfo activeSamsungRoot(){')
end=s.index('    private boolean clickTextCallOnActiveSamsung(){',start)
s=s[:start]+'''    /** HITEL accessibility overlay can become the active root. Always inspect
     * actual Samsung InCallUI windows, not only getRootInActiveWindow(). */
    private AccessibilityNodeInfo activeSamsungNode(String name){
        try{
            List<AccessibilityWindowInfo> windows=getWindows();
            if(windows!=null)for(AccessibilityWindowInfo win:windows){
                AccessibilityNodeInfo root=win.getRoot();
                if(root==null||!isSamsung(s(root.getPackageName())))continue;
                List<AccessibilityNodeInfo> nodes=root.findAccessibilityNodeInfosByViewId(P+name);
                if(nodes!=null)for(AccessibilityNodeInfo n:nodes)
                    if(n!=null&&n.isVisibleToUser())return n;
            }
            AccessibilityNodeInfo root=getRootInActiveWindow();
            if(root!=null&&isSamsung(s(root.getPackageName()))){
                List<AccessibilityNodeInfo> nodes=root.findAccessibilityNodeInfosByViewId(P+name);
                if(nodes!=null)for(AccessibilityNodeInfo n:nodes)
                    if(n!=null&&n.isVisibleToUser())return n;
            }
        }catch(Throwable t){LabStore.log("W10_SAMSUNG_WINDOW_ERROR",t.toString());}
        return null;
    }
    private boolean hasSamsungCallWindow(){
        try{
            List<AccessibilityWindowInfo> windows=getWindows();
            if(windows!=null)for(AccessibilityWindowInfo win:windows){
                AccessibilityNodeInfo root=win.getRoot();
                if(root!=null&&s(root.getPackageName()).startsWith("com.samsung.android.incallui"))return true;
            }
        }catch(Throwable t){LabStore.log("W10_CALL_WINDOW_ERROR",t.toString());}
        return activePkg().startsWith("com.samsung.android.incallui");
    }
    private boolean activeTextCallVisible(){
        for(String id:new String[]{"text_call_message_edit_text","text_call_main",
                "text_call_message_list_recycler_view","translation_text_call_main"})
            if(activeSamsungNode(id)!=null)return true;
        return false;
    }
    /** A connected-call chronometer is not always accessible on Samsung.
     * Only inspect nodes labelled as call duration; never count a status clock. */
    private int callDurationSeconds(AccessibilityNodeInfo node,int depth,int[] count){
        if(node==null||depth>20||count[0]++>3000)return -1;
        String id=s(node.getViewIdResourceName()).toLowerCase(java.util.Locale.ROOT);
        String desc=s(node.getContentDescription()).toLowerCase(java.util.Locale.ROOT);
        if(node.isVisibleToUser()&&(id.contains("call_duration")||id.contains("chronometer")||
              id.contains("elapsed_time")||id.contains("call_timer")||id.contains("call_time")||
              desc.contains("통화 시간")||desc.contains("통화시간")||
              desc.contains("call duration"))){
            String raw=s(node.getText());
            if(raw.isBlank())raw=desc;
            java.util.regex.Matcher m=java.util.regex.Pattern.compile(
                "(?<![0-9])(?:([0-9]{1,2}):)?([0-9]{1,2}):([0-9]{2})(?![0-9])").matcher(raw);
            if(m.find()){
                int h=m.group(1)==null?0:Integer.parseInt(m.group(1));
                int min=Integer.parseInt(m.group(2)),sec=Integer.parseInt(m.group(3));
                if(min<60&&sec<60)return h*3600+min*60+sec;
            }
        }
        for(int i=0;i<node.getChildCount();i++){
            int value=callDurationSeconds(node.getChild(i),depth+1,count);
            if(value>=0)return value;
        }
        return -1;
    }
    private int observedCallDuration(){
        try{
            List<AccessibilityWindowInfo> windows=getWindows();
            if(windows!=null)for(AccessibilityWindowInfo win:windows){
                AccessibilityNodeInfo root=win.getRoot();
                if(root!=null&&s(root.getPackageName()).startsWith("com.samsung.android.incallui")){
                    int sec=callDurationSeconds(root,0,new int[]{0});
                    if(sec>=0)return sec;
                }
            }
        }catch(Throwable t){LabStore.log("W10_DURATION_ERROR",t.toString());}
        return -1;
    }
    /** OFFHOOK alone covers dialling and therefore cannot activate text call.
     * On the user's Samsung, the enabled Text Call button appears after answer.
     * Require it to remain visibly enabled for >=1.1s. An advancing Samsung
     * call timer is independently recorded if accessible. */
    private boolean answeredUiGate(int state){
        if(state!=TelephonyManager.CALL_STATE_OFFHOOK)return false;
        boolean button=false;
        for(String id:new String[]{"in_call_text_call_container",
                  "bixby_text_call_floating_button_container",
                  "upgrade_to_bixby_text_call_button"}){
            AccessibilityNodeInfo n=activeSamsungNode(id);
            if(n!=null&&n.isVisibleToUser()&&n.isEnabled()){button=true;break;}
        }
        if(!button){controlFirstObservedAt=0;return false;}
        long now=SystemClock.elapsedRealtime();
        if(controlFirstObservedAt==0){controlFirstObservedAt=now;return false;}
        int elapsed=observedCallDuration();
        if(elapsed>=0){
            if(lastElapsedSeconds>=0&&elapsed>lastElapsedSeconds){
                if(!connectedTimerObserved)
                    LabStore.log("W10_CONNECTED_TIMER","Real Samsung call elapsed counter advanced");
                connectedTimerObserved=true;
            }
            lastElapsedSeconds=elapsed;
        }
        if(now-controlFirstObservedAt<1100)return false;
        if(!controlReadyLogged){
            controlReadyLogged=true;callFlowPhase="TEXT_BUTTON_AVAILABLE";
            LabStore.log("W10_TEXT_BUTTON_AVAILABLE",
                "Samsung OEM button stable, OFFHOOK; timerAdvanced="+connectedTimerObserved+
                " (without timer this is button availability, not proven remote answer)");
        }
        return true;
    }
''' +s[end:]
sub('''             "upgrade_to_bixby_text_call_button","accept_as_text_call"}){''',
    '''             "upgrade_to_bixby_text_call_button"}){''')
sub('''        if(activeSamsungRoot()==null)return; // never act on a hidden dialer''',
    '''        if(!hasSamsungCallWindow())return; // never act on a hidden dialer''')
sub('''        if(activeTextCallVisible()){
            if(state==TelephonyManager.CALL_STATE_IDLE)return;''',
    '''        if(activeTextCallVisible()){
            if(state!=TelephonyManager.CALL_STATE_OFFHOOK)return;
            callFlowPhase="TEXT_CALL_ACTIVE";''')
sub('''                    if(!dialerFlowArmed||!activeTextCallVisible()||
                            actualCallState()==TelephonyManager.CALL_STATE_IDLE){''',
    '''                    if(!dialerFlowArmed||
                            actualCallState()!=TelephonyManager.CALL_STATE_OFFHOOK){''')
sub('''                        startActivity(next);
                        LabStore.log("W03_AUTO_RETURN_REQUEST",''',
    '''                        startActivity(next);
                        callFlowPhase="RETURN_REQUESTED";
                        LabStore.log("W03_AUTO_RETURN_REQUEST",''')
sub('''        // Wait until the in-call UI stabilizes; do not treat OFFHOOK as proof
        // the far-end answered. The Samsung button is the final availability gate.
        if(now-offhookSince<4000||textCallClickAttempts>=4||now-lastAutoClickAt<3800)return;
        lastAutoClickAt=now;
        boolean clicked=clickTextCallOnActiveSamsung();
        if(clicked)textCallClickAttempts++;''',
    '''        // No fixed 4s guess. Wait for the post-answer Samsung Text Call control.
        if(textCallClickAttempts>=4||now-lastAutoClickAt<3300)return;
        if(!answeredUiGate(state))return;
        lastAutoClickAt=now;
        boolean clicked=clickTextCallOnActiveSamsung();
        if(clicked){
            textCallClickAttempts++;
            callFlowPhase="TEXT_CALL_ACTIVATING";
            LabStore.log("W10_TEXT_CALL_CLICKED","Samsung visible button clicked; OEM Text Call confirmation pending");
        }''')
sub('''    private boolean samsungWindowOnTop(){
        AccessibilityNodeInfo active=getRootInActiveWindow();
        String pkg=active==null?"":s(active.getPackageName());
        return pkg.startsWith("com.samsung.android.incallui")||
            pkg.startsWith("com.samsung.android.dialer")||
            pkg.startsWith("com.samsung.android.app.telephonyui");
    }''',
    '''    private boolean samsungWindowOnTop(){return hasSamsungCallWindow();}''')
sub('''            boolean want=consoleRequested&&LabStore.running()&&"W03".equals(LabStore.currentScenario())&&samsungWindowOnTop()&&activeTextCallVisible();''',
    '''            boolean want=consoleRequested&&LabStore.running()&&"W03".equals(LabStore.currentScenario())&&
                actualCallState()==TelephonyManager.CALL_STATE_OFFHOOK&&
                (samsungWindowOnTop()&&activeTextCallVisible()||overlayShown);''')
# Accessibility overlay is always a fallback for blocked background Activity start:
# allow user to expand but avoid masking the OEM transcription UI by default.
sub('''                overlayScroller.setVisibility(View.GONE);''',
    '''                overlayScroller.setVisibility(View.VISIBLE);''')
sub('''                Button toggle=new Button(this);toggle.setAllCaps(false);toggle.setText("자막 확대");toggle.setTextSize(12);''',
    '''                Button toggle=new Button(this);toggle.setAllCaps(false);toggle.setText("자막 축소");toggle.setTextSize(12);''')
sub('''                    WindowManager.LayoutParams.MATCH_PARENT,px(60),''',
    '''                    WindowManager.LayoutParams.MATCH_PARENT,px(300),''')
sub('''                overlayManager.addView(panel,p);overlayView=panel;overlayShown=true;''',
    '''                overlayManager.addView(panel,p);overlayView=panel;overlayShown=true;
                LabStore.log("W10_FALLBACK_VISIBLE","Samsung Text Call detected. HITEL floating transcript immediately visible");''')
svc.write_text(s,encoding="utf-8")
w=w03.read_text(encoding="utf-8")
assert 'CallAccessibilityService.Snapshot s=access.snapshot();' in w
w=w.replace('''            CallAccessibilityService.Snapshot s=access.snapshot();''',
'''            CallAccessibilityService.Snapshot s=access.snapshot();
            String phase=CallAccessibilityService.currentFlowPhase();
            if("WAIT_FOR_ANSWER".equals(phase))
                callState.setText("전화 상태: 발신 또는 연결 대기 · 삼성 문자통화 버튼 표시를 기다리는 중");
            else if("TEXT_BUTTON_AVAILABLE".equals(phase))
                callState.setText("삼성 문자통화 버튼 관측 · 연결 시간 증거와 구분하여 기록");
            else if("TEXT_CALL_ACTIVE".equals(phase)||"RETURN_REQUESTED".equals(phase))
                callState.setText("삼성 문자통화 활성화 확인 · HITEL 실시간 중계");
''',1)
w03.write_text(w,encoding="utf-8")
g=gradle.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v09"' in g
assert 'versionCode = 9' in g
gradle.write_text(g.replace('applicationId = "app.hitel.callflowlab.v09"',
                             'applicationId = "app.hitel.callflowlab.v10"')
                  .replace('versionCode = 9','versionCode = 10')
                  .replace('versionName = "0.9.0-dialer-textcall-auto-return"',
                           'versionName = "0.10.0-connected-gate-auto-return"'),encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
assert 'HITEL 통화 실시간 자막 v0.9 (독립설치)' in m
manifest.write_text(m.replace('HITEL 통화 실시간 자막 v0.9 (독립설치)',
                             'HITEL 통화 실시간 자막 v0.10 (응답감지)'),encoding="utf-8")
print("PASS V10: NO click based on OFFHOOK alone; stable post-answer Samsung button, running timer evidence when present; Text Call then HITEL return")
