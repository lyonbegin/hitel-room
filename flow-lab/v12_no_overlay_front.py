from pathlib import Path
base=Path("AndroidProject/app/src/main")
service=base/"java/app/hitel/samsungprobe/CallAccessibilityService.java"
screen=base/"java/app/hitel/samsungprobe/W03ConsoleActivity.java"
gradle=Path("AndroidProject/app/build.gradle.kts")
manifest=base/"AndroidManifest.xml"
s=service.read_text(encoding="utf-8")

def replace(old,new):
    global s
    assert old in s, ("CallAccessibilityService missing anchor",old[:180])
    s=s.replace(old,new,1)

# Remove the overlay window, panel, expand/collapse buttons and timeline entirely.
start=s.index("    private WindowManager overlayManager;")
end=s.index("    private static final String P=",start)
s=s[:start]+'''    // No floating overlay of any type. HITEL displays all captions in W03 Activity.
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
''' + s[end:]

# No overlay creation, initialization, polling, callbacks, or destruction.
replace('''                    updateOverlay();
                    if(overlayShown)refreshOverlayTimeline();
''','')
replace('''        main.post(this::updateOverlay);
''','')
replace('''        if(consoleRequested)updateOverlay();
''','')
replace('''            if(overlayShown)refreshOverlayTimeline();
''','')
replace('''        hideOverlay();consoleRequested=false;instance=null;''',
        '''        consoleRequested=false;instance=null;''')

# Use only the actual Samsung Text Call node to initiate app foreground handoff.
start=s.index('            if(!autoReturnAttempted){',s.index('    private void inspectAutomaticCallFlow'))
end=s.index('            return;',start)
# First return is nested within the old block; use explicit outer-boundary.
tail='''            return;
        }
        if(state!=TelephonyManager.CALL_STATE_OFFHOOK)return;'''
assert tail in s[start:],"Could not find auto return block"
end=s.index(tail,start)
old=s[start:end]
s=s[:start]+'''            if(!autoReturnAttempted){
                autoReturnAttempted=true;
                foregroundReturnPending=true;
                foregroundReturnAttempts=0;
                LabStore.log("W12_SAMSUNG_TEXT_CALL_CONFIRMED",
                    "Samsung Text Call real editable/list nodes visible; request W03 full Activity; source="+why);
                main.postDelayed(this::attemptHitelForegroundReturn,350);
            }
''' + s[end:]
replace('''        autoReturnAttempted=false;
        main.removeCallbacks(dialerMonitor);''',
        '''        autoReturnAttempted=false;
        foregroundReturnPending=false;foregroundReturnAttempts=0;
        main.removeCallbacks(dialerMonitor);''')
replace('''        dialerFlowArmed=false;callFlowPhase="ENDED";''',
        '''        dialerFlowArmed=false;foregroundReturnPending=false;callFlowPhase="ENDED";''')
# Log only OEM or HITEL events. HITEL foreground is a verification signal,
# not a reason to add an extra window.
replace('''            if(!isSamsung(pkg)){
                if(event.getEventType()==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)''',
        '''            if(!isSamsung(pkg)){
                if(foregroundReturnPending&&pkg.startsWith("app.hitel.callflowlab")&&
                    event.getEventType()==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
                    acknowledgeForeground(this);
                if(event.getEventType()==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)''')
# Remove all overlay-only imports and leave other SDK imports as-is.
for imp in (
    "import android.view.WindowManager;\n",
    "import android.view.View;\n",
    "import android.widget.Button;\n",
    "import android.widget.TextView;\n",
    "import android.widget.ScrollView;\n",
    "import android.widget.LinearLayout;\n",
    "import android.graphics.PixelFormat;\n",
    "import android.view.Gravity;\n",
    "import java.io.RandomAccessFile;\n",
    "import java.nio.charset.StandardCharsets;\n",
    "import java.text.SimpleDateFormat;\n",
    "import java.util.Date;\n",
    "import org.json.JSONObject;\n",
):
    if imp in s:s=s.replace(imp,"")
assert "TYPE_ACCESSIBILITY_OVERLAY" not in s
assert "addView(" not in s
assert "updateOverlay" not in s
assert "overlayShown" not in s
assert "hideOverlay" not in s
service.write_text(s,encoding="utf-8")

w=screen.read_text(encoding="utf-8")
def w_replace(old,new):
    global w
    assert old in w,("W03 missing anchor",old[:150])
    w=w.replace(old,new,1)

w_replace('''    /** A single persistent HITEL cockpit. Only the carrier-owned UI is opened for''',
          '''    /** A single persistent HITEL cockpit. Only the carrier-owned UI is opened for''') if "    /** A single persistent HITEL cockpit. Only the carrier-owned UI is opened for" in w else None
w=w.replace("A touchable accessibility overlay returns the user to this screen.",
    "After Samsung Text Call activation, bring this full Activity to the foreground.")
w=w.replace("삼성 화면의 HITEL 복귀 패널을 직접 눌러도 되며, ",
    "삼성 문자통화가 활성화되면 HITEL 앱이 전체 화면으로 자동 복귀하도록 시도하며, ")
w=w.replace("전화 화면 위의 HITEL 복귀 버튼을 사용해 주십시오.",
    "문자통화 활성화 확인 후 HITEL 화면으로 자동 복귀를 시도합니다.")
w=w.replace("HITEL 복귀 버튼으로 돌아오십시오.",
    "HITEL 화면으로 자동 복귀합니다.")
w=w.replace("삼성 화면에서 문자통화를 켜신 뒤 HITEL로 돌아오십시오.",
    "삼성 화면에서 문자통화를 켜면 HITEL 전면 복귀를 시도합니다.")

# The sole success criterion is an actually focused HITEL Activity, not a
# successful-looking startActivity() call from a background AccessibilityService.
w_replace('''    @Override protected void onResume(){super.onResume();
        if(getIntent()!=null&&getIntent().getBooleanExtra("hitel_auto_return",false)){
            getIntent().removeExtra("hitel_auto_return");focusTranscriptAfterAutoReturn();
        }''',
'''    @Override protected void onResume(){super.onResume();
        if(getIntent()!=null&&getIntent().getBooleanExtra("hitel_auto_return",false)){
            getIntent().removeExtra("hitel_auto_return");
            focusTranscriptAfterAutoReturn();
            ui.postDelayed(()->{
                if(hasWindowFocus())CallAccessibilityService.acknowledgeForeground(this);
            },250);
        }''')
w_replace('''    @Override protected void onDestroy(){''',
'''    @Override public void onWindowFocusChanged(boolean focused){
        super.onWindowFocusChanged(focused);
        if(focused&&CallAccessibilityService.isForegroundReturnPending()){
            CallAccessibilityService.acknowledgeForeground(this);
        }
    }
    @Override protected void onDestroy(){''')

# Distinct install package because prior Android debug signatures are incompatible.
g=gradle.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v11"' in g
assert 'versionCode = 11' in g
g=g.replace('applicationId = "app.hitel.callflowlab.v11"',
            'applicationId = "app.hitel.callflowlab.v12"')
g=g.replace('versionCode = 11','versionCode = 12')
g=g.replace('0.11.0-samsung-timer-label-detection',
            '0.12.0-fullscreen-only-no-overlay')
gradle.write_text(g,encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
assert 'HITEL 통화 실시간 자막 v0.11 (삼성 연결감지)' in m
m=m.replace('HITEL 통화 실시간 자막 v0.11 (삼성 연결감지)',
            'HITEL 통화 실시간 자막 v0.12 (전체화면)')
manifest.write_text(m,encoding="utf-8")
print("PASS: No accessibility overlay; Samsung Text Call confirmed before foreground return; foreground focus evidence and limited retry.")
