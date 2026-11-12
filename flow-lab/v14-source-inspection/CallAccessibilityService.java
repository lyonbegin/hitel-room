package app.hitel.samsungprobe;

import android.accessibilityservice.AccessibilityService;
import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.telephony.TelephonyManager;
import android.os.SystemClock;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.graphics.Bitmap;
import android.hardware.HardwareBuffer;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Display;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import android.os.Handler;
import android.os.Looper;
import android.content.Intent;
import java.util.Locale;

/** Read Samsung OEM's actually exposed accessibility tree; no gesture coordinates. */
public class CallAccessibilityService extends AccessibilityService {
    public static volatile CallAccessibilityService instance;
    private static volatile boolean consoleRequested=false;
    private static volatile boolean dialerFlowArmed=false;
    private long dialerArmedAt=0,offhookSince=0,lastAutoClickAt=0;
    private int textCallClickAttempts=0;
    private boolean autoReturnAttempted=false;
    private long controlFirstObservedAt=0;
    private boolean controlReadyLogged=false;
    private long lastFlowDiagnosticAt=0;
    private static volatile String detection="삼성 통화 연결과 버튼 확인 대기";
    public static String currentDetection(){return detection;}
    public static boolean serviceConnected(){return instance!=null;}
    private int lastElapsedSeconds=-1;
    private boolean connectedTimerObserved=false;
    private static volatile String callFlowPhase="IDLE";
    public static String currentFlowPhase(){return callFlowPhase;}
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
        dialerFlowArmed=true;callFlowPhase="WAIT_FOR_ANSWER";
        CallAccessibilityService s=instance;
        if(s!=null)s.main.post(()->s.beginAutomaticCallFlow("dialpad button"));
        LabStore.log("W03_AUTO_ARM","사용자가 삼성 전화번호판 자동 흐름을 시작함; 문자통화 실제 활성화 이후에만 복귀");
    }
    public static void disarmDialerFlow(Context c,String reason){
        dialerFlowArmed=false;foregroundReturnPending=false;callFlowPhase="ENDED";
        c.getSharedPreferences("w03_auto_flow",Context.MODE_PRIVATE).edit()
            .remove("armedAt").apply();
        CallAccessibilityService s=instance;
        if(s!=null)s.main.post(()->s.main.removeCallbacks(s.dialerMonitor));
        LabStore.log("W03_AUTO_END",reason);
    }
    private void beginAutomaticCallFlow(String reason){
        dialerArmedAt=System.currentTimeMillis();
        offhookSince=0;lastAutoClickAt=0;textCallClickAttempts=0;
        controlFirstObservedAt=0;controlReadyLogged=false;
        lastFlowDiagnosticAt=0;detection="전화 연결과 텍스트 통화 버튼 감지 대기";
        lastElapsedSeconds=-1;connectedTimerObserved=false;callFlowPhase="WAIT_FOR_ANSWER";
        autoReturnAttempted=false;
        foregroundReturnPending=false;foregroundReturnAttempts=0;
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
    /** HITEL accessibility overlay can become the active root. Always inspect
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
        return activePkg().startsWith("com.samsung.android.incallui")||activePkg().startsWith("com.samsung.android.app.telephonyui");
    }
    private boolean activeTextCallVisible(){
        for(String id:new String[]{"text_call_message_edit_text","text_call_main",
                "text_call_message_list_recycler_view","translation_text_call_main"})
            if(activeSamsungNode(id)!=null)return true;
        return false;
    }
    private List<AccessibilityNodeInfo> samsungRoots(){
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
    /** Click only after the Samsung Text Call control becomes visible post-answer.
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
    private void inspectAutomaticCallFlow(String why){
        if(!dialerFlowArmed||!LabStore.running()||!"W03".equals(LabStore.currentScenario()))return;
        if(System.currentTimeMillis()-dialerArmedAt>20*60*1000){
            disarmDialerFlow(this,"20_MIN_FLOW_TIMEOUT");return;
        }
        int state=actualCallState();
        if(state==TelephonyManager.CALL_STATE_IDLE&&offhookSince!=0){
            disarmDialerFlow(this,"CALL_IDLE_AFTER_OFFHOOK");return;
        }
        if(!hasSamsungCallWindow()){
            long now=SystemClock.elapsedRealtime();
            if(now-lastFlowDiagnosticAt>6000){
                lastFlowDiagnosticAt=now;
                LabStore.log("W11_NO_SAMSUNG_WINDOW",
                    "Samsung InCallUI inaccessible; activePackage="+activePkg());
            }
            return;
        }
        if(activeTextCallVisible()){
            if(state!=TelephonyManager.CALL_STATE_OFFHOOK)return;
            callFlowPhase="TEXT_CALL_ACTIVE";
            if(!autoReturnAttempted){
                autoReturnAttempted=true;
                foregroundReturnPending=true;
                foregroundReturnAttempts=0;
                LabStore.log("W12_SAMSUNG_TEXT_CALL_CONFIRMED",
                    "Samsung Text Call real editable/list nodes visible; request W03 full Activity; source="+why);
                main.postDelayed(this::attemptHitelForegroundReturn,350);
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
        // No fixed 4s guess. Wait for the post-answer Samsung Text Call control.
        if(textCallClickAttempts>=4||now-lastAutoClickAt<3300)return;
        if(!answeredUiGate(state))return;
        lastAutoClickAt=now;
        boolean clicked=clickTextCallOnActiveSamsung();
        if(clicked){
            textCallClickAttempts++;
            callFlowPhase="TEXT_CALL_ACTIVATING";
            LabStore.log("W10_TEXT_CALL_CLICKED","Samsung visible button clicked; OEM Text Call confirmation pending");
        }
    }

    // No floating overlay of any type. HITEL displays all captions in W03 Activity.
    private int px(float dp){
        return (int)(getResources().getDisplayMetrics().density*dp+0.5f);
    }
    public static void setConsoleRequested(boolean value){
        consoleRequested=value;
    }
    private static volatile boolean foregroundReturnPending=false;
    private int foregroundReturnAttempts=0;
    public static boolean isForegroundReturnPending(){return foregroundReturnPending;}
    public static void acknowledgeForeground(Context context){
        CallAccessibilityService current=instance;
        if(current==null||!foregroundReturnPending)return;
        current.main.post(()->{
            if(!foregroundReturnPending)return;
            foregroundReturnPending=false;
            LabStore.log("W12_HITEL_FOREGROUND_CONFIRMED",
                "W03 foreground verified by activity focus / HITEL accessibility window");
            disarmDialerFlow(context,"W12_HITEL_ACTIVITY_FOCUSED");
            callFlowPhase="HITEL_FOREGROUND";
        });
    }
    private void attemptHitelForegroundReturn(){
        if(!dialerFlowArmed||!foregroundReturnPending)return;
        if(actualCallState()!=TelephonyManager.CALL_STATE_OFFHOOK){
            disarmDialerFlow(this,"W12_CALL_ENDED_BEFORE_RETURN");
            return;
        }
        // Android may silently reject a background activity launch.
        // Verify actual foreground before stopping the monitor.
        if(isHitelForeground()){
            acknowledgeForeground(this);return;
        }
        if(foregroundReturnAttempts>=4){
            LabStore.log("W12_HITEL_RETURN_UNVERIFIED",
                "Four startActivity requests; HITEL foreground never confirmed. No overlay fallback.");
            disarmDialerFlow(this,"W12_BAL_NOT_CONFIRMED");
            return;
        }
        foregroundReturnAttempts++;
        try{
            Intent activity=new Intent(this,W03ConsoleActivity.class);
            activity.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            activity.putExtra("hitel_auto_return",true);
            startActivity(activity);
            callFlowPhase="HITEL_RETURN_REQUESTED";
            LabStore.log("W12_HITEL_FOREGROUND_REQUEST",
                "attempt="+foregroundReturnAttempts+"; Text Call confirmed by actual OEM nodes");
        }catch(Throwable e){
            LabStore.log("W12_HITEL_RETURN_EXCEPTION",e.toString());
        }
        main.postDelayed(()->{
            if(foregroundReturnPending){
                if(isHitelForeground())acknowledgeForeground(this);
                else attemptHitelForegroundReturn();
            }
        },1600);
    }
    private static final String P="com.samsung.android.incallui:id/";
    private static final String[] TRACKED={
        "text_call_message_edit_text","text_call_submit_button","text_call_message_list_recycler_view",
        "text_call_main","bixby_text_call_floating_button_container","in_call_text_call_container",
        "ai_call_assist_button","live_translate_button","translation_call_message_list_recycler_view",
        "translation_text_call_main","switch_to_voice_call_container","end_translate_container",
        "remote_message","local_message","remote_message_translated","local_message_translated",
        "screen_call_container","accept_as_text_call"
    };
    public static final class Snapshot {
        public final Set<String> ids=new HashSet<>();
        public final Set<String> pkgs=new HashSet<>();
        public long scannedAt;
        public String foregroundPackage="";
        public boolean textCall,translated,localTextPresent;
        public int remoteCount,localCount,translatedCount,remoteBackgroundCount;
        public String lastRemote="",lastLocal="",lastTranslated="";
        public String lastRemoteTranslation="",lastLocalTranslation="";
        public long lastRemoteTranslationAt=0,lastLocalAt=0;
        public long lastRemoteAt;
        public long lastSamsungEventAt,lastSamsungTranscriptAt,lastBackgroundTranscriptAt;
        public long lastSamsungWindowAt,lastTextCallVisibleAt;
        public String lastEventSource="",lastMessageSource="";
        public long samsungEventCount,backgroundMessageCount;
        public Snapshot copy(){
            Snapshot b=new Snapshot();b.ids.addAll(ids);b.pkgs.addAll(pkgs);b.scannedAt=scannedAt;
            b.foregroundPackage=foregroundPackage;b.textCall=textCall;b.translated=translated;b.localTextPresent=localTextPresent;
            b.remoteCount=remoteCount;b.localCount=localCount;b.translatedCount=translatedCount;
            b.remoteBackgroundCount=remoteBackgroundCount;b.lastRemote=lastRemote;b.lastLocal=lastLocal;b.lastTranslated=lastTranslated;
            b.lastRemoteTranslation=lastRemoteTranslation;b.lastLocalTranslation=lastLocalTranslation;
            b.lastRemoteTranslationAt=lastRemoteTranslationAt;b.lastLocalAt=lastLocalAt;
            b.lastRemoteAt=lastRemoteAt;b.lastSamsungEventAt=lastSamsungEventAt;
            b.lastSamsungTranscriptAt=lastSamsungTranscriptAt;b.lastBackgroundTranscriptAt=lastBackgroundTranscriptAt;
            b.lastSamsungWindowAt=lastSamsungWindowAt;b.lastTextCallVisibleAt=lastTextCallVisibleAt;b.lastEventSource=lastEventSource;
            b.lastMessageSource=lastMessageSource;b.samsungEventCount=samsungEventCount;
            b.backgroundMessageCount=backgroundMessageCount;return b;
        }
    }
    private final Object lock=new Object();
    private final Snapshot state=new Snapshot();
    /** Track the exact Samsung text node rather than deduplicating every identical sentence globally.
     * This preserves repeated utterances and in-place caption corrections. */
    private final Map<String,String> lastTextByNode=new HashMap<>();
    private final Handler main=new Handler(Looper.getMainLooper());
    private long lastSweep,lastCapture;
    /** Continuous live OEM-window scan, independent of Samsung event frequency.
     * This can observe live subtitles while Samsung remains an accessible window;
     * it cannot resurrect windows Android removes after backgrounding. */
    private final Runnable liveWindowPoll=new Runnable(){
        @Override public void run(){
            try{
                if(consoleRequested&&LabStore.running()&&"W03".equals(LabStore.currentScenario())){
                    scanNow("w03_live_poll");
                }
            }catch(Throwable err){LabStore.log("W03_LIVE_POLL_ERROR",err.toString());}
            main.postDelayed(this,700);
        }
    };
    private String lastSignature="";
    private boolean backgroundTrial;

    @Override protected void onServiceConnected(){
        super.onServiceConnected();instance=this;
        AccessibilityServiceInfo i=getServiceInfo();
        i.flags|=AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS|AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS|AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        i.notificationTimeout=100;i.eventTypes=AccessibilityEvent.TYPES_ALL_MASK;setServiceInfo(i);
        LabStore.log("A11Y_SERVICE","연결됨. 실제 접근성 ID / 텍스트 / 컨텐츠 설명 사용");
        LabStore.log("W11_MONITOR_ENABLED","Samsung incoming event + timer + label detection enabled");
        main.removeCallbacks(liveWindowPoll);
        main.postDelayed(liveWindowPoll,700);
        long remembered=getSharedPreferences("w03_auto_flow",MODE_PRIVATE).getLong("armedAt",0);
        if(remembered>0&&System.currentTimeMillis()-remembered<20*60*1000){
            dialerFlowArmed=true;main.post(()->beginAutomaticCallFlow("service reconnect"));
        }
    }
    @Override public void onAccessibilityEvent(AccessibilityEvent event){
        if(event==null)return;
        if(!LabStore.running())return;
        try{
            String pkg=s(event.getPackageName());
            // Exclude HITEL's own UI events: otherwise 500ms polling generates a log-event feedback loop.
            if(!isSamsung(pkg)){
                if(foregroundReturnPending&&pkg.startsWith("app.hitel.callflowlab")&&
                    event.getEventType()==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
                    acknowledgeForeground(this);
                if(event.getEventType()==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
                    synchronized(lock){state.foregroundPackage=pkg;state.scannedAt=System.currentTimeMillis();}
                return;
            }
            synchronized(lock){
                state.lastSamsungEventAt=System.currentTimeMillis();state.samsungEventCount++;
                state.lastEventSource="accessibility_event:"+AccessibilityEvent.eventTypeToString(event.getEventType());
            }
            String val=event.getText()==null?"":event.getText().toString();
            LabStore.log("A11Y_EVENT","pkg="+pkg+" type="+AccessibilityEvent.eventTypeToString(event.getEventType())+
                    " class="+s(event.getClassName())+" text="+val);
            AccessibilityNodeInfo source=event.getSource();
            if(source!=null&&isSamsung(pkg)){
                // A Samsung-origin callback might still expose its source subtree when the
                // OEM Activity is no longer the interactive window. Only actual nodes count.
                boolean bg=isHitelForeground();
                String eventOrigin="event:"+event.getEventType();
                harvest(source,bg,0,new int[]{0},eventOrigin);
                String nodeId=s(source.getViewIdResourceName());
                if(isTranscript(nodeId)&&s(source.getText()).isEmpty()&&event.getText()!=null){
                    for(CharSequence text:event.getText())if(text!=null&&!text.toString().isBlank())
                        captureTranscript(source,nodeId,text.toString(),bg,eventOrigin+":event_text");
                }
            }
            if(SystemClock.elapsedRealtime()-lastSweep>1300){lastSweep=SystemClock.elapsedRealtime();scanNow("event");}
            if(dialerFlowArmed)inspectAutomaticCallFlow("samsung accessibility event");
        }catch(Throwable e){LabStore.log("A11Y_ERROR",e.toString());}
    }
    public void resetEvidence(){
        synchronized(lock){state.ids.clear();state.pkgs.clear();state.scannedAt=0;
            state.remoteCount=state.localCount=state.translatedCount=state.remoteBackgroundCount=0;
            state.lastRemote=state.lastLocal=state.lastTranslated="";
            state.lastRemoteTranslation=state.lastLocalTranslation="";
            state.lastRemoteAt=state.lastRemoteTranslationAt=state.lastLocalAt=0;state.textCall=state.translated=state.localTextPresent=false;
            lastTextByNode.clear();lastSignature="";backgroundTrial=false;
            state.lastSamsungEventAt=state.lastSamsungTranscriptAt=state.lastBackgroundTranscriptAt=0;
            state.lastSamsungWindowAt=state.lastTextCallVisibleAt=state.samsungEventCount=state.backgroundMessageCount=0;
            state.lastEventSource=state.lastMessageSource="";}
        scanAsync("reset");
    }
    public Snapshot snapshot(){synchronized(lock){return state.copy();}}
    private void scanAsync(String reason){main.post(()->scanNow(reason));}
    public void scanBlocking(String reason){
        if(Looper.myLooper()==Looper.getMainLooper()){scanNow(reason);return;}
        CountDownLatch latch=new CountDownLatch(1);
        main.post(()->{try{scanNow(reason);}finally{latch.countDown();}});
        try{latch.await(4,TimeUnit.SECONDS);}catch(InterruptedException e){Thread.currentThread().interrupt();}
    }
    private String activePkg(){AccessibilityNodeInfo x=getRootInActiveWindow();return x==null?"":s(x.getPackageName());}
    public boolean isHitelForeground(){return activePkg().startsWith("app.hitel.callflowlab");}
    private static boolean isSamsung(String pkg){return pkg.startsWith("com.samsung.android.incallui")||
       pkg.startsWith("com.samsung.android.dialer")||pkg.startsWith("com.samsung.android.callassistant")||
       pkg.startsWith("com.samsung.android.app.telephonyui");}
    private static boolean relevant(String p){return isSamsung(p)||p.contains("samsungprobe")||p.startsWith("app.hitel.callflowlab");}
    private void scanNow(String reason){
        if(!LabStore.running())return;
        try{
            List<AccessibilityNodeInfo> roots=new ArrayList<>();
            List<AccessibilityWindowInfo> windows=getWindows();
            if(windows!=null)for(AccessibilityWindowInfo w:windows){AccessibilityNodeInfo x=w.getRoot();if(x!=null&&relevant(s(x.getPackageName())))roots.add(x);}
            if(roots.isEmpty()){AccessibilityNodeInfo x=getRootInActiveWindow();if(x!=null)roots.add(x);}
            String active=activePkg();
            synchronized(lock){state.foregroundPackage=active;state.scannedAt=System.currentTimeMillis();}
            for(AccessibilityNodeInfo root:roots){
                String pkg=s(root.getPackageName());if(!relevant(pkg))continue;
                // Avoid polling HITEL's changing UI and emitting circular logs.
                if("w03_live_poll".equals(reason)&&!isSamsung(pkg))continue;
                if(isSamsung(pkg)) synchronized(lock){state.lastSamsungWindowAt=System.currentTimeMillis();}
                StringBuilder xml=new StringBuilder("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<window package=\""+esc(pkg)+"\" reason=\""+esc(reason)+"\">\n");
                StringBuilder sig=new StringBuilder(pkg);
                render(root,xml,sig,0,new int[]{0},isSamsung(pkg)&&!isSamsung(active));
                xml.append("</window>\n");
                String hash=Integer.toHexString(sig.toString().hashCode());
                if(!hash.equals(lastSignature)||reason.startsWith("start")||reason.startsWith("end")||reason.equals("manual")){
                    lastSignature=hash;LabStore.captureXml(reason,xml.toString());
                }
            }
        }catch(Throwable e){LabStore.log("A11Y_SCAN_ERROR",e.toString());}
    }
    private void render(AccessibilityNodeInfo node,StringBuilder xml,StringBuilder signature,int depth,int[] traversed,boolean bg){
        if(node==null||depth>38||traversed[0]++>20000)return;
        String id=s(node.getViewIdResourceName()),txt=s(node.getText()),desc=s(node.getContentDescription());
        String cls=s(node.getClassName());
        synchronized(lock){
            if(!id.isEmpty()){state.ids.add(id);signature.append('|').append(id);}
            if(!txt.isEmpty())signature.append("{TEXT}").append(txt);
            state.pkgs.add(s(node.getPackageName()));
            if(id.equals(P+"text_call_message_edit_text")){state.textCall=true;state.lastTextCallVisibleAt=System.currentTimeMillis();state.localTextPresent=!txt.isEmpty();}
            if(id.equals(P+"translation_call_message_list_recycler_view"))state.translated=true;
        }
        if(isTranscript(id)&&!txt.isEmpty())captureTranscript(node,id,txt,bg,"window_scan");
        xml.append("  ".repeat(Math.min(depth+1,40))).append("<node class=\"").append(esc(cls)).append("\" id=\"")
          .append(esc(id)).append("\" text=\"").append(esc(txt)).append("\" desc=\"").append(esc(desc))
          .append("\" enabled=\"").append(node.isEnabled()).append("\" clickable=\"").append(node.isClickable())
          .append("\" editable=\"").append(node.isEditable()).append("\" children=\"").append(node.getChildCount()).append("\">\n");
        for(int i=0;i<node.getChildCount();i++)render(node.getChild(i),xml,signature,depth+1,traversed,bg);
        xml.append("  ".repeat(Math.min(depth+1,40))).append("</node>\n");
    }
    private void harvest(AccessibilityNodeInfo n,boolean bg,int depth,int[] counter,String origin){
        if(n==null||depth>36||counter[0]++>12000)return;
        String id=s(n.getViewIdResourceName()),txt=s(n.getText());
        if(id.equals(P+"text_call_message_edit_text"))synchronized(lock){state.textCall=true;state.lastTextCallVisibleAt=System.currentTimeMillis();}
        if(isTranscript(id)&&!txt.isEmpty())captureTranscript(n,id,txt,bg,origin);
        for(int i=0;i<n.getChildCount();i++)harvest(n.getChild(i),bg,depth+1,counter,origin);
    }
    private static boolean isTranscript(String id){return id.equals(P+"remote_message")||id.equals(P+"local_message")||id.equals(P+"remote_message_translated")||id.equals(P+"local_message_translated");}
    private void captureTranscript(AccessibilityNodeInfo n,String id,String txt,boolean background,String source){
        // Node identity includes the Android accessibility window & node identity.
        // Global (ID+text) dedup would incorrectly drop a later repeated sentence.
        String unique=n.getUniqueId();
        String nodeKey=id+"|window="+n.getWindowId()+"|"+
           (unique==null||unique.isBlank()?"node="+n.hashCode():"unique="+unique);
        // A previously accessible window scan is NOT a new OEM background event.
        boolean provenBackground=background&&source.startsWith("event:");
        String update;
        synchronized(lock){
            String old=lastTextByNode.put(nodeKey,txt);
            if(txt.equals(old))return;
            update=old==null?"NEW":"UPDATED";
            long now=System.currentTimeMillis();
            if(id.endsWith("/remote_message")){
                if(old==null)state.remoteCount++;
                state.lastRemote=txt;state.lastRemoteAt=now;
                if(provenBackground)state.remoteBackgroundCount++;
            }else if(id.endsWith("/local_message")){
                if(old==null)state.localCount++;
                state.lastLocal=txt;state.lastLocalAt=now;
            }else {
                if(old==null)state.translatedCount++;
                state.lastTranslated=txt;
                if(id.endsWith("/remote_message_translated")){
                    state.lastRemoteTranslation=txt;state.lastRemoteTranslationAt=now;
                }else if(id.endsWith("/local_message_translated")){
                    state.lastLocalTranslation=txt;
                }
            }
            state.lastSamsungTranscriptAt=now;state.lastMessageSource=source;
            if(provenBackground){state.lastBackgroundTranscriptAt=now;state.backgroundMessageCount++;}
        }
        String direction=id.contains("remote_")?"remote":"local";
        LabStore.transcript(direction,id,txt,provenBackground,nodeKey,update,source);
        LabStore.log(provenBackground?"TRANSCRIPT_BACKGROUND_EVENT":"TRANSCRIPT",
            update+" source="+source+" id="+id+" value="+txt);
    }
    public void setBackgroundTrial(boolean on){synchronized(lock){backgroundTrial=on;}LabStore.log("BACKGROUND",on?"백그라운드 시험 시작":"백그라운드 시험 종료");}
    public boolean home(){return performGlobalAction(GLOBAL_ACTION_HOME);}
    public void captureScreenshot(String reason){
        File file=LabStore.screenshotFile(reason);if(file==null)return;
        try{
            takeScreenshot(Display.DEFAULT_DISPLAY,getMainExecutor(),new TakeScreenshotCallback(){
                @Override public void onSuccess(ScreenshotResult result){
                    try{
                        HardwareBuffer hb=result.getHardwareBuffer(); Bitmap b=Bitmap.wrapHardwareBuffer(hb,result.getColorSpace());
                        if(b==null)throw new IllegalStateException("Bitmap inaccessible");
                        Bitmap copy=b.copy(Bitmap.Config.ARGB_8888,false);
                        try(FileOutputStream out=new FileOutputStream(file)){copy.compress(Bitmap.CompressFormat.PNG,100,out);}
                        copy.recycle();b.recycle();hb.close();LabStore.log("SCREEN_PNG","저장: "+file.getName());
                    }catch(Throwable e){LabStore.log("SCREENSHOT_ERROR",e.toString());}
                }
                @Override public void onFailure(int code){LabStore.log("SCREENSHOT_UNAVAILABLE","OS blocked screenshot error="+code);}
            });
        }catch(Throwable e){LabStore.log("SCREENSHOT_UNAVAILABLE",e.toString());}
    }
    private static String s(CharSequence x){return x==null?"":x.toString();}
    private static String esc(String s){return s.replace("&","&amp;").replace("\"","&quot;").replace("<","&lt;").replace(">","&gt;").replace("'","&apos;");}
    private AccessibilityNodeInfo find(String fullId){
        List<AccessibilityWindowInfo> wins=getWindows();
        if(wins!=null)for(AccessibilityWindowInfo w:wins){AccessibilityNodeInfo root=w.getRoot();if(root==null)continue;
            List<AccessibilityNodeInfo> got=root.findAccessibilityNodeInfosByViewId(fullId);if(got!=null&&!got.isEmpty())return got.get(0);
        }
        AccessibilityNodeInfo root=getRootInActiveWindow();
        if(root==null)return null;List<AccessibilityNodeInfo> got=root.findAccessibilityNodeInfosByViewId(fullId);
        return got==null||got.isEmpty()?null:got.get(0);
    }
    private static boolean click(AccessibilityNodeInfo n){for(int i=0;n!=null&&i<9;n=n.getParent())if(n.isClickable()&&n.isEnabled())return n.performAction(AccessibilityNodeInfo.ACTION_CLICK);return false;}
    public boolean enterTextCall(){
        if(find(P+"text_call_message_edit_text")!=null)return true;
        for(String name:new String[]{"in_call_text_call_container","bixby_text_call_floating_button_container","ai_call_assist_button","upgrade_to_bixby_text_call_button"}){
            AccessibilityNodeInfo n=find(P+name);
            if(n!=null){boolean ok=click(n);LabStore.log("ACTION_CLICK","텍스트 통화 진입: "+name+" → "+ok);return ok;}
        }
        LabStore.log("ACTION_UNAVAILABLE","텍스트 통화 진입에 사용할 수 있는 접근성 노드 없음");return false;
    }
    /** Check a LIVE node. The historic Snapshot.textCall boolean is latched and
     *  cannot establish that Samsung Text Call is still visible now. */
    public boolean isTextCallVisible(){return find(P+"text_call_message_edit_text")!=null;}
    /** Focus the actual visible Samsung Text Call editor; never types or sends.
     * This opens the Samsung keyboard. The user, not HITEL, operates its mic.
     * No accessibility overlay and no injection into the carrier audio path. */
    public boolean focusSamsungTextCallInput(){
        try{
            AccessibilityNodeInfo input=find(P+"text_call_message_edit_text");
            if(input==null||!input.isVisibleToUser()||!input.isEnabled()){
                LabStore.log("W14_SAMSUNG_FOCUS_UNAVAILABLE",
                    "OEM input node absent/hidden/disabled, no arbitrary coordinates");
                return false;
            }
            boolean focus=input.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
            boolean click=click(input);
            LabStore.log("W14_SAMSUNG_INPUT_FOCUS",
                "focus="+focus+" click="+click+"; never typed/sent; keyboard STT manual");
            return focus||click;
        }catch(Throwable t){
            LabStore.log("W14_SAMSUNG_INPUT_FOCUS_EXCEPTION",t.toString());
            return false;
        }
    }
    /** Only used after an explicit user selection. Never changes call mode by itself. */
    public boolean switchToVoiceCall(){
        AccessibilityNodeInfo n=find(P+"switch_to_voice_call_container");
        if(n==null)n=find(P+"resume_call_button");
        if(n==null){LabStore.log("VOICE_SWITCH_NODE_MISSING","삼성 일반 음성 전환 컨트롤 노드 미발견");return false;}
        boolean ok=click(n);LabStore.log("VOICE_SWITCH_ACTION","사용자 요청에 의한 삼성 음성 전환 클릭="+ok);return ok;
    }
    /** OEM's own input-to-TTS button, no carrier-audio injection. The old version
     *  required edit + submit nodes at the same instant before typing; here each
     *  node gets its own observed result and we re-read the changed hierarchy. */
    public boolean putAndSend(String value) {
        if(value==null||value.isBlank())return false;
        AccessibilityNodeInfo input=null;
        for(int attempt=0;attempt<8;attempt++){
            input=find(P+"text_call_message_edit_text");
            AccessibilityNodeInfo candidate=find(P+"text_call_submit_button");
            LabStore.log("OEM_INPUT_NODE_CHECK","attempt="+attempt+" input="+(input!=null)+
                " inputEnabled="+(input!=null&&input.isEnabled())+" inputEditable="+(input!=null&&input.isEditable())+
                " send="+(candidate!=null)+" sendEnabled="+(candidate!=null&&candidate.isEnabled()));
            if(input!=null&&input.isEnabled())break;
            if(attempt==2)enterTextCall();
            try{Thread.sleep(650);}catch(InterruptedException e){Thread.currentThread().interrupt();return false;}
        }
        if(input==null){LabStore.log("OEM_INPUT_NOT_FOUND","실제 삼성 Text Call 입력 노드가 화면에 없음");return false;}
        Bundle args=new Bundle();args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,value);
        boolean set=input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,args);
        AccessibilityNodeInfo verify=find(P+"text_call_message_edit_text");
        boolean filled=verify!=null&&value.equals(s(verify.getText()));
        LabStore.log("OEM_INPUT_SET_RESULT","set="+set+" valueReadback="+filled+" / length="+value.length());
        if(!set||!filled)return false;
        AccessibilityNodeInfo send=null;
        for(int attempt=0;attempt<8;attempt++){
            send=find(P+"text_call_submit_button");
            LabStore.log("OEM_SEND_NODE_CHECK","attempt="+attempt+" send="+(send!=null)+" enabled="+(send!=null&&send.isEnabled()));
            if(send!=null&&send.isEnabled())break;
            try{Thread.sleep(450);}catch(InterruptedException e){Thread.currentThread().interrupt();return false;}
        }
        if(send==null){LabStore.log("OEM_SEND_NOT_FOUND","삼성 TTS 전송 버튼을 찾을 수 없음, 임의 화면 좌표 클릭하지 않음");return false;}
        boolean clicked=click(send);
        LabStore.log("OEM_SEND_BUTTON_ACTION","text_call_submit_button clicked="+clicked+" / peer TTS delivery not proven");
        return clicked;
    }
    @Override public void onInterrupt(){LabStore.log("A11Y_INTERRUPT","접근성 서비스 중단");}
    @Override public void onDestroy(){main.removeCallbacks(liveWindowPoll);main.removeCallbacks(dialerMonitor);
        consoleRequested=false;instance=null;LabStore.log("A11Y_DESTROY","접근성 서비스 종료");super.onDestroy();}
}
