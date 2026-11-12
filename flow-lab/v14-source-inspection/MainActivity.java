package app.hitel.samsungprobe;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.widget.AbsListView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.util.TypedValue;
import org.json.JSONObject;
import java.io.File;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Exactly 8 workflows plus 6 isolated tests. Full streaming disk-backed log. */
public class MainActivity extends Activity {
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ArrayList<String> allLines=new ArrayList<>();
    private ArrayAdapter<String> logAdapter;
    private ListView logList;
    private TextView stateLabel,logTitle,sectionLabel;
    private ScrollView catalogScroll;
    private LinearLayout catalog,sttPanel;
    private EditText sttEdit;
    private Button followButton,accessibilitySetupButton;
    private boolean accessibilityGuideShown=false,accessibilitySettingsOpened=false;
    private String visibleTab="flow",pendingId="";
    private boolean following=true,requesting=false,sttDraftShown=false;
    private long byteOffset=0;
    private final Runnable monitor=new Runnable(){
        @Override public void run(){
            refreshLogs();
            if(stateLabel!=null){
                String current=ScenarioEngineService.active?
                    ScenarioEngineService.currentScenario+" · "+ScenarioEngineService.currentStep+
                    "\n체크포인트: "+ScenarioEngineService.currentTest:
                    "대기 · 최근 저장: "+getSharedPreferences("lab",MODE_PRIVATE).getString("last_export","없음");
                stateLabel.setText(current+"\n"+ScenarioEngineService.currentState);
            }
            boolean show=ScenarioEngineService.awaitingTextApproval;
            if(sttPanel!=null)sttPanel.setVisibility(show?View.VISIBLE:View.GONE);
            if(show&&!sttDraftShown){sttEdit.setText(ScenarioEngineService.draftText);sttDraftShown=true;}
            if(!show)sttDraftShown=false;
            handler.postDelayed(this,450);
        }
    };
    @Override public void onCreate(Bundle b){
        super.onCreate(b);ScenarioCatalog.load(this);FlowCatalog.load(this);LabStore.init(this);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(10),dp(8),dp(10),dp(8));root.setBackgroundColor(Color.WHITE);
        root.addView(text("HITEL 통화 기능 검증 v0.13",20,Color.BLACK,true));
        stateLabel=text("실행 대기",12,Color.DKGRAY,false);
        stateLabel.setPadding(0,dp(4),0,dp(5));root.addView(stateLabel);
        LinearLayout tabs=new LinearLayout(this);
        tabs.addView(button("통합 흐름 8",()->showTab("flow")),new LinearLayout.LayoutParams(0,dp(44),1));
        tabs.addView(button("독립 기능 6",()->showTab("isolated")),new LinearLayout.LayoutParams(0,dp(44),1));
        tabs.addView(button("전체 로그",()->showTab("logs")),new LinearLayout.LayoutParams(0,dp(44),1));
        root.addView(tabs);
        LinearLayout actions=new LinearLayout(this);
        accessibilitySetupButton=button("접근성 설정",this::openAccessibilitySettings);
        actions.addView(accessibilitySetupButton,new LinearLayout.LayoutParams(0,dp(40),1));
        actions.addView(button("전화 앱 열기",this::openDialer),new LinearLayout.LayoutParams(0,dp(40),1));
        actions.addView(button("시험 종료",this::stopTest),new LinearLayout.LayoutParams(0,dp(40),1));
        root.addView(actions);
        Button voiceEntry=button("W03 · 한 화면에서 전화·음성인식·TTS 조작",()->startActivity(new Intent(this,W03ConsoleActivity.class)));
        root.addView(voiceEntry,new LinearLayout.LayoutParams(-1,dp(44)));
        sectionLabel=text("W01~W08 통합 기능 시험",14,Color.BLACK,true);
        sectionLabel.setPadding(0,dp(6),0,dp(3));root.addView(sectionLabel);
        catalogScroll=new ScrollView(this);catalogScroll.setFillViewport(false);
        catalog=new LinearLayout(this);catalog.setOrientation(LinearLayout.VERTICAL);catalogScroll.addView(catalog);
        root.addView(catalogScroll,new LinearLayout.LayoutParams(-1,0,40));
        sttPanel=new LinearLayout(this);sttPanel.setOrientation(LinearLayout.VERTICAL);
        sttPanel.addView(text("STT 인식 문장을 확인·수정하고 승인해 주십시오. 승인 전에는 상대방에게 전송하지 않습니다.",12,Color.BLACK,false));
        sttEdit=new EditText(this);sttEdit.setSingleLine(false);sttEdit.setMinLines(2);
        sttPanel.addView(sttEdit,new LinearLayout.LayoutParams(-1,dp(60)));
        sttPanel.addView(button("수정한 문장 확정 · 송신 시험 계속",this::confirmText));
        sttPanel.setVisibility(View.GONE);root.addView(sttPanel);
        LinearLayout logHead=new LinearLayout(this);
        logTitle=text("실시간 전체 로그 · 0줄",14,Color.BLACK,true);
        logHead.addView(logTitle,new LinearLayout.LayoutParams(0,dp(37),1));
        followButton=button("자동 스크롤 ON",()->{
            following=!following;followButton.setText(following?"자동 스크롤 ON":"자동 스크롤 OFF");
            if(following&&logAdapter.getCount()>0)logList.setSelection(logAdapter.getCount()-1);
        });
        logHead.addView(followButton,new LinearLayout.LayoutParams(dp(132),dp(37)));root.addView(logHead);
        logList=new ListView(this);logList.setDividerHeight(dp(1));logList.setTranscriptMode(ListView.TRANSCRIPT_MODE_DISABLED);
        logAdapter=new ArrayAdapter<String>(this,android.R.layout.simple_list_item_1,allLines){
            @Override public View getView(int position,View old,android.view.ViewGroup parent){
                TextView v=old instanceof TextView?(TextView)old:new TextView(MainActivity.this);
                v.setText(getItem(position));v.setTextSize(TypedValue.COMPLEX_UNIT_SP,12);
                v.setTextColor(0xff171d23);v.setPadding(dp(7),dp(6),dp(7),dp(6));
                v.setSingleLine(false);v.setMaxLines(Integer.MAX_VALUE);
                v.setBackgroundColor(position%2==0?0xfff5f6f8:Color.WHITE);return v;
            }
        };
        logList.setAdapter(logAdapter);
        logList.setOnScrollListener(new AbsListView.OnScrollListener(){
            @Override public void onScrollStateChanged(AbsListView v,int state){
                if(state==SCROLL_STATE_TOUCH_SCROLL&&logList.getLastVisiblePosition()<logAdapter.getCount()-2){
                    following=false;followButton.setText("자동 스크롤 OFF");
                }
            }
            @Override public void onScroll(AbsListView v,int first,int visible,int total){}
        });
        root.addView(logList,new LinearLayout.LayoutParams(-1,0,60));
        LinearLayout manual=new LinearLayout(this);
        manual.addView(button("상대방 청취 확인",()->manual("PASS","상대방이 시험 합성음을 들었다고 직접 확인")),new LinearLayout.LayoutParams(0,dp(42),1));
        manual.addView(button("상대방 미수신",()->manual("FAIL","상대방이 합성음을 듣지 못했다고 직접 확인")),new LinearLayout.LayoutParams(0,dp(42),1));
        root.addView(manual);
        LinearLayout bottom=new LinearLayout(this);
        bottom.addView(button("누적 로그 ZIP 저장",()->new Thread(()->{
            String r=LabStore.exportHistory(this);runOnUiThread(()->toast(r));
        }).start()),new LinearLayout.LayoutParams(0,dp(42),1));
        bottom.addView(button("맨 아래로",()->{
            following=true;followButton.setText("자동 스크롤 ON");
            if(logAdapter.getCount()>0)logList.setSelection(logAdapter.getCount()-1);
        }),new LinearLayout.LayoutParams(0,dp(42),1));root.addView(bottom);
        setContentView(root);showTab("flow");handler.post(monitor);
        // Installation alone cannot start Settings. First foreground launch can.
        handler.postDelayed(this::showAccessibilityGuideOnFirstLaunch,420);
    }
    private int dp(float x){return (int)(x*getResources().getDisplayMetrics().density+.5f);}
    private TextView text(String s,int sp,int color,boolean bold){
        TextView x=new TextView(this);x.setText(s);x.setTextSize(sp);x.setTextColor(color);
        if(bold)x.setTypeface(null,android.graphics.Typeface.BOLD);x.setGravity(android.view.Gravity.CENTER_VERTICAL);return x;
    }
    private Button button(String s,Runnable r){Button b=new Button(this);b.setAllCaps(false);b.setText(s);b.setTextSize(12);b.setOnClickListener(v->r.run());return b;}
    private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
    private void showTab(String tab){
        visibleTab=tab;catalog.removeAllViews();
        if("logs".equals(tab)){
            sectionLabel.setText("전체 실행 기록 — 과거 모든 행 스크롤 가능");catalogScroll.setVisibility(View.GONE);return;
        }
        catalogScroll.setVisibility(View.VISIBLE);
        sectionLabel.setText("flow".equals(tab)?"통합 흐름 시험 W01~W08 · 내부 단계는 순차 실행":"독립 기능시험 I01~I06 · 각 항목 단독 실행");
        List<FlowCatalog.Plan> plans="flow".equals(tab)?FlowCatalog.flows():FlowCatalog.isolated();
        for(int i=0;i<plans.size();i++){
            FlowCatalog.Plan p=plans.get(i);LinearLayout row=new LinearLayout(this);row.setPadding(dp(4),dp(5),dp(2),dp(5));
            row.setBackgroundColor(i%2==0?0xfff4f5f6:Color.WHITE);
            LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);
            info.addView(text(p.id+" · "+p.title,14,Color.BLACK,true));
            info.addView(text("단계 "+p.steps.size()+"개 / 검증 기준: "+p.criterion,11,Color.DKGRAY,false));
            row.addView(info,new LinearLayout.LayoutParams(0,-2,1));
            row.addView(button("순서",()->showDetails(p)),new LinearLayout.LayoutParams(dp(52),dp(65)));
            row.addView(button("W03".equals(p.id)?"조작":"실행",()->beginSelected(p.id)),new LinearLayout.LayoutParams(dp(58),dp(65)));
            catalog.addView(row);
        }
        catalogScroll.post(()->catalogScroll.scrollTo(0,0));
    }
    private void showDetails(FlowCatalog.Plan p){
        StringBuilder b=new StringBuilder("관련 실제 이용 사례: "+String.join(", ",p.scenarios));
        for(int i=0;i<p.steps.size();i++)b.append("\n").append(i+1).append(". ").append(p.steps.get(i));
        b.append("\n\n판정 기준: ").append(p.criterion);
        b.append("\n필요한 기존 기술 검사: ").append(String.join(", ",p.legacy));
        new AlertDialog.Builder(this).setTitle(p.id+" · "+p.title).setMessage(b.toString())
            .setNegativeButton("닫기",null).setPositiveButton("이 흐름 실행",(d,w)->beginSelected(p.id)).show();
    }
    private void openAccessibilitySettings(){
        accessibilitySettingsOpened=true;
        try{
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
            LabStore.log("W13_ACCESSIBILITY_SETTINGS_OPENED",
                "User approved opening Android accessibility settings");
        }catch(Exception e){
            toast("접근성 설정을 열지 못했습니다. 휴대전화 설정 → 접근성 → 설치된 앱에서 HITEL을 선택해 주십시오.");
            LabStore.log("W13_ACCESSIBILITY_SETTINGS_FAILED",e.toString());
        }
    }
    private void openRestrictedSettingsHelp(){
        new AlertDialog.Builder(this)
            .setTitle("접근성 항목이 비활성화된 경우")
            .setMessage("Android 13 이상에서는 APK를 직접 설치한 앱의 접근성 서비스가 제한될 수 있습니다. 믿을 수 있는 앱인지 확인하신 다음, 설정 → 애플리케이션 → HITEL 통화 실시간 자막 v0.13 → 우측 상단 메뉴(⋮) → '제한된 설정 허용'을 선택하십시오. 그 다음 접근성 → 설치된 앱 → HITEL 통화 흐름검증 서비스를 켜십시오.")
            .setPositiveButton("앱 정보 열기",(d,w)->{
                try{
                    Intent appInfo=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    appInfo.setData(android.net.Uri.parse("package:"+getPackageName()));
                    startActivity(appInfo);
                }catch(Exception e){toast("휴대전화 설정 → 애플리케이션에서 HITEL 앱을 선택해 주십시오.");}
            })
            .setNegativeButton("닫기",null).show();
    }
    private void showAccessibilityGuideOnFirstLaunch(){
        if(isFinishing()||accessibilityGuideShown||accessibilityEnabled())return;
        accessibilityGuideShown=true;
        new AlertDialog.Builder(this)
            .setTitle("HITEL 접근성 서비스 설정")
            .setMessage("삼성 기본 전화 앱은 그대로 사용합니다. HITEL이 삼성 텍스트 통화 버튼과 상대방 자막을 확인하려면 접근성 서비스가 필요합니다.\n\n'접근성 설정 열기' → '설치된 앱' → 'HITEL 통화 흐름검증 - 화면 분석' → 사용을 켜 주십시오.\n\n사용 여부는 고객님이 직접 결정하십니다. 권한을 허용하지 않으면 자동 문자통화·실시간 자막 중계를 시작하지 않습니다.")
            .setPositiveButton("접근성 설정 열기",(d,w)->openAccessibilitySettings())
            .setNeutralButton("항목이 비활성화된 경우",(d,w)->openRestrictedSettingsHelp())
            .setNegativeButton("나중에",null)
            .show();
        LabStore.log("W13_FIRST_LAUNCH_ACCESSIBILITY_PROMPT",
            "Actual first app launch: explicit user consent required, no auto activation");
    }
    private boolean accessibilityEnabled(){
        if(CallAccessibilityService.instance!=null)return true;
        String a=Settings.Secure.getString(getContentResolver(),Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return a!=null&&a.toLowerCase(Locale.ROOT).contains(getPackageName().toLowerCase(Locale.ROOT));
    }
    private void beginSelected(String id){
        if(ScenarioEngineService.active){toast("다른 시험이 실행 중입니다. 먼저 종료해 주십시오");return;}
        FlowCatalog.Plan p=FlowCatalog.find(id);if(p==null){toast("미등록 시험: "+id);return;}
        if("W03".equals(id)){
            startActivity(new Intent(this,W03ConsoleActivity.class));
            return;
        }
        pendingId=id;
        if(!accessibilityEnabled()){
            requesting=true;
            new AlertDialog.Builder(this).setTitle("접근성 서비스 설정")
                .setMessage("삼성 통화 화면과 자막 노드 검증에만 필요한 권한입니다. 이 권한 없이 실행되는 독립 시험은 접근성 관찰을 NOT_TESTED로 기록합니다. 권한 화면을 여시겠습니까?")
                .setPositiveButton("설정 열기",(d,w)->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)))
                .setNeutralButton("접근성 없이 실행",(d,w)->startPermissions(p))
                .setNegativeButton("취소",(d,w)->pendingId="").show();return;
        }
        startPermissions(p);
    }
    private void startPermissions(FlowCatalog.Plan p){
        if(checkSelfPermission(Manifest.permission.READ_PHONE_STATE)!=PackageManager.PERMISSION_GRANTED){
            requesting=true;requestPermissions(new String[]{Manifest.permission.READ_PHONE_STATE},701);return;
        }
        if("W03".equals(p.id)&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            requesting=true;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},702);return;
        }
        if(p.id.equals("W01")||p.id.equals("W02")||p.id.equals("W03")){
            new AlertDialog.Builder(this).setTitle("실제 상대방에게 전송되는 시험")
                .setMessage("이 흐름은 삼성 문자통화에 실제 검증 문장을 입력하고 TTS 전송을 시도합니다. 시험 상대방과 연결된 경우에만 진행해 주십시오. 임의 발신 또는 자동 수신은 수행하지 않습니다.")
                .setNegativeButton("취소",(d,w)->pendingId="")
                .setPositiveButton("시작",(d,w)->startNow()).show();
        }else startNow();
    }
    private void startNow(){
        if(pendingId.isEmpty())return;String id=pendingId;pendingId="";
        FlowCatalog.Plan p=FlowCatalog.find(id);
        Intent svc=new Intent(this,ScenarioEngineService.class).setAction(ScenarioEngineService.START)
            .putExtra("mode",p.flow?"flow":"isolated").putExtra("id",id);
        try{
            startForegroundService(svc);toast(id+" 실행 시작 · 단일 흐름 내 순차 검증 및 ZIP 저장");
            if(id.equals("W01")||id.equals("W03")||id.equals("W05"))handler.postDelayed(this::openDialer,650);
        }catch(Throwable e){toast("시험 시작 실패: "+e);}
    }
    private void openVoiceInput(){
        if(!ScenarioEngineService.active||!"W03".equals(ScenarioEngineService.currentScenario)){
            startActivity(new Intent(this,W03ConsoleActivity.class));return;
        }
        try{startActivity(new Intent(this,VoiceInputActivity.class));}
        catch(Throwable e){LabStore.log("VOICE_PANEL_OPEN_FAIL",e.toString());toast("음성 입력 화면 오류: "+e);}
    }
    private void openDialer(){
        try{LabStore.log("OPEN_DIALER","사용자 조작으로 기존 기본 전화 앱만 엽니다. 자동 발신하지 않습니다");
            startActivity(new Intent(Intent.ACTION_DIAL));
        }catch(Throwable e){toast("기본 전화 앱 열기 실패: "+e);}
    }
    private void confirmText(){
        if(!ScenarioEngineService.awaitingTextApproval){toast("승인을 기다리는 STT 문장이 없습니다");return;}
        String edited=sttEdit.getText().toString().trim();if(edited.isEmpty()){toast("전송할 문장을 입력해 주십시오");return;}
        Intent i=new Intent(this,ScenarioEngineService.class).setAction(ScenarioEngineService.CONFIRM_TEXT)
            .putExtra("text",edited);startService(i);
    }
    private void manual(String verdict,String message){
        if(!ScenarioEngineService.active||ScenarioEngineService.currentTest.isEmpty()){
            toast("현재 청취 확인 대상이 없습니다");return;
        }
        new AlertDialog.Builder(this).setTitle("상대방 직접 확인")
            .setMessage("현재 "+ScenarioEngineService.currentTest+" 실제 결과에 대한 사용자의 현장 확인입니다. 자동 검증과 구분해 저장합니다.")
            .setNegativeButton("취소",null)
            .setPositiveButton("기록",(d,w)->LabStore.markManual(verdict,message)).show();
    }
    private void stopTest(){
        if(!ScenarioEngineService.active){toast("현재 실행 중인 시험이 없습니다");return;}
        startService(new Intent(this,ScenarioEngineService.class).setAction(ScenarioEngineService.STOP));
        toast("검사 종료 요청 · 완료된 단계의 전체 결과를 ZIP으로 저장합니다");
    }
    private void refreshLogs(){
        File source=LabStore.logFile(this);
        if(source.length()<byteOffset){byteOffset=0;allLines.clear();logAdapter.notifyDataSetChanged();}
        int added=0;
        try(RandomAccessFile f=new RandomAccessFile(source,"r")){
            f.seek(byteOffset);String line;
            while((line=f.readLine())!=null){
                byteOffset=f.getFilePointer();String raw=new String(line.getBytes(StandardCharsets.ISO_8859_1),StandardCharsets.UTF_8);
                if(raw.isBlank())continue;
                try{JSONObject j=new JSONObject(raw);
                    allLines.add("["+j.optString("time")+"] "+j.optString("runId")+" "+j.optString("type")+"\n"+j.optString("message"));
                }catch(Exception e){allLines.add(raw);}added++;
            }
        }catch(Exception ignored){/* file retries on next monitor iteration, never deletes history */}
        if(added>0){
            logAdapter.notifyDataSetChanged();if(following)logList.setSelection(logAdapter.getCount()-1);
            logTitle.setText("실시간 전체 로그 · "+allLines.size()+"줄 (생략 없음)");
        }
    }
    @Override public void onRequestPermissionsResult(int code,String[] names,int[] results){
        super.onRequestPermissionsResult(code,names,results);requesting=false;
        if(pendingId.isEmpty())return;
        FlowCatalog.Plan p=FlowCatalog.find(pendingId);
        if(p==null)return;
        if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED){startPermissions(p);return;}
        new AlertDialog.Builder(this).setTitle("권한이 허용되지 않았습니다")
            .setMessage("전화 상태 또는 마이크 권한이 없으면 관련 검사는 NOT_TESTED로 남습니다. 권한 없이 나머지 검사만 진행하시겠습니까?")
            .setPositiveButton("계속 진행",(d,w)->startNow())
            .setNegativeButton("취소",(d,w)->pendingId="").show();
    }
    @Override protected void onResume(){super.onResume();
        handler.postDelayed(()->{
            boolean ready=accessibilityEnabled();
            if(accessibilitySetupButton!=null)
                accessibilitySetupButton.setText(ready?"접근성 연결됨":"접근성 설정");
            if(accessibilitySettingsOpened){
                accessibilitySettingsOpened=false;
                if(ready){
                    toast("HITEL 접근성 서비스가 활성화되었습니다.");
                    LabStore.log("W13_ACCESSIBILITY_ENABLED","Service found enabled on Android settings return");
                }else{
                    LabStore.log("W13_ACCESSIBILITY_NOT_ENABLED",
                        "User returned from Settings without enabling accessibility");
                }
            }
        },350);
        if(requesting&&accessibilityEnabled()&&!pendingId.isEmpty()){
            requesting=false;handler.postDelayed(()->{
                FlowCatalog.Plan p=FlowCatalog.find(pendingId);if(p!=null)startPermissions(p);
            },300);
        }
    }
    @Override protected void onDestroy(){handler.removeCallbacks(monitor);super.onDestroy();}
}
