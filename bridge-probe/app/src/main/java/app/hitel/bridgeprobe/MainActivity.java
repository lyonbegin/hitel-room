package app.hitel.bridgeprobe;

import android.app.Activity;
import android.content.*;
import android.content.pm.*;
import android.os.*;
import android.graphics.Typeface;
import android.view.View;
import android.widget.*;
import java.util.Date;
import java.text.SimpleDateFormat;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String ASSIST="com.samsung.android.callassistant";
    private static final String INCALL="com.samsung.android.incallui";
    private static final String[] PERMS={
        "com.samsung.android.callassistant.permission.TEXT_CALL",
        "com.samsung.android.callassistant.permission.VOIP_TRANSLATOR",
        "com.samsung.android.incall.permission.READ_CALL_CONTENT_PROVIDER",
        "com.samsung.android.incall.permission.WRITE_CALL_CONTENT_PROVIDER"
    };
    private TextView console;
    private final StringBuilder log=new StringBuilder();
    private ServiceConnection conn;
    private boolean bound;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView sc=new ScrollView(this);
        LinearLayout col=new LinearLayout(this);
        col.setPadding(18,18,18,18);
        col.setOrientation(LinearLayout.VERTICAL);
        sc.addView(col);
        TextView title=new TextView(this);
        title.setText("삼성 전화 앱 직접 연동 시험");
        title.setTypeface(null,Typeface.BOLD);
        title.setTextSize(24);
        col.addView(title);
        TextView note=new TextView(this);
        note.setText("전화 앱 교체 없음. 통화 상태 감지를 연동 성공으로 판정하지 않습니다.\n활동·서비스의 실제 IPC와 권한 거부를 기록합니다.");
        col.addView(note);
        add(col,"1. 패키지·서명·권한·컴포넌트 검사",v->inspect());
        add(col,"2. CallAssistViewerActivity 직접 호출",v->launch("CallAssistViewerActivity"));
        add(col,"3. RecordViewerActivity 직접 호출",v->launch("RecordViewerActivity"));
        add(col,"4. VoipTranslatorService 직접 바인딩",v->connect("VoipTranslatorService"));
        add(col,"5. 바인딩 해제",v->disconnect());
        add(col,"검사 로그 복사",v->copy());
        console=new TextView(this);
        console.setTextSize(13);
        console.setTypeface(Typeface.MONOSPACE);
        console.setTextIsSelectable(true);
        col.addView(console);
        setContentView(sc);
        line("Samsung bridge probe | "+Build.MANUFACTURER+" "+Build.MODEL+" Android "+Build.VERSION.RELEASE);
        inspect();
    }
    private void add(LinearLayout col,String title,View.OnClickListener click){
        Button b=new Button(this); b.setAllCaps(false); b.setText(title);
        b.setOnClickListener(click); col.addView(b);
    }
    private void line(String text){
        String t=new SimpleDateFormat("HH:mm:ss",Locale.KOREA).format(new Date());
        log.append('[').append(t).append("] ").append(text).append('\n');
        if(console!=null)console.setText(log.toString());
    }
    @SuppressWarnings("deprecation")
    private PackageInfo info(String name,int flags)throws PackageManager.NameNotFoundException{
        return getPackageManager().getPackageInfo(name,flags);
    }
    private void inspect(){
        line("=== 삼성 컴포넌트 실제 검사 ===");
        for(String p:new String[]{ASSIST,INCALL,"com.samsung.android.dialer"}){
            try{
                PackageInfo x=info(p,PackageManager.GET_ACTIVITIES|PackageManager.GET_SERVICES|
                                     PackageManager.GET_PROVIDERS|PackageManager.GET_PERMISSIONS);
                line("패키지 확인 "+p+" version="+x.versionName);
                if(ASSIST.equals(p)){
                    line("서명 비교: "+(getPackageManager().checkSignatures(getPackageName(),p)==
                        PackageManager.SIGNATURE_MATCH?"MATCH":"MISMATCH"));
                    if(x.activities!=null)for(ActivityInfo a:x.activities)
                        if(a.name.contains("CallAssistViewer")||a.name.contains("RecordViewer"))
                            line("ACTIVITY "+a.name+" exported="+a.exported+" permission="+a.permission);
                    if(x.services!=null)for(ServiceInfo s:x.services)
                        if(s.name.contains("VoipTranslator"))
                            line("SERVICE "+s.name+" exported="+s.exported+" permission="+s.permission);
                }
                if(INCALL.equals(p)&&x.providers!=null)for(ProviderInfo pr:x.providers){
                    if((pr.readPermission!=null && pr.readPermission.contains("incall"))||
                       (pr.writePermission!=null && pr.writePermission.contains("incall")))
                        line("PROVIDER "+pr.authority+" exported="+pr.exported+
                             " read="+pr.readPermission+" write="+pr.writePermission);
                }
            }catch(PackageManager.NameNotFoundException e){
                line("패키지 미확인/조회불가: "+p);
            }catch(Exception e){line("패키지 검사 오류 "+e.getClass().getSimpleName()+": "+e.getMessage());}
        }
        for(String p:PERMS)line("권한 "+p+" -> "+(
            getPackageManager().checkPermission(p,getPackageName())==PackageManager.PERMISSION_GRANTED?
            "GRANTED":"DENIED"));
    }
    private String locate(String suffix,boolean service)throws Exception{
        PackageInfo x=info(ASSIST,service?PackageManager.GET_SERVICES:PackageManager.GET_ACTIVITIES);
        if(service){
            if(x.services!=null)for(ServiceInfo s:x.services)
                if(s.name.endsWith("."+suffix)){
                    line("대상 서비스 "+s.name+" exported="+s.exported+" permission="+s.permission);
                    return s.name;
                }
        }else{
            if(x.activities!=null)for(ActivityInfo a:x.activities)
                if(a.name.endsWith("."+suffix)){
                    line("대상 화면 "+a.name+" exported="+a.exported+" permission="+a.permission);
                    return a.name;
                }
        }
        throw new IllegalStateException("대상 컴포넌트를 찾을 수 없음: "+suffix);
    }
    private void launch(String name){
        line("=== startActivity 실제 호출: "+name+" ===");
        try{
            Intent i=new Intent();
            i.setClassName(ASSIST,locate(name,false));
            startActivity(i);
            line("startActivity 정상 반환; 요청 접수만 의미합니다. 화면·통화 연동은 별도 확인 필요.");
        }catch(SecurityException e){
            line("PERMISSION_DENIED: "+e.getMessage());
        }catch(Exception e){line("FAILED "+e.getClass().getSimpleName()+": "+e.getMessage());}
    }
    private void connect(String name){
        line("=== bindService 실제 호출: "+name+" ===");
        disconnect();
        try{
            Intent i=new Intent();
            i.setClassName(ASSIST,locate(name,true));
            conn=new ServiceConnection(){
                @Override public void onServiceConnected(ComponentName n,IBinder b){
                    line("SERVICE_CONNECTED: "+n.flattenToShortString()+" (통화 오디오 확보와 별개)");
                }
                @Override public void onServiceDisconnected(ComponentName n){
                    line("SERVICE_DISCONNECTED: "+n.flattenToShortString());
                }
            };
            bound=bindService(i,conn,Context.BIND_AUTO_CREATE);
            line(bound?"bindService 접수; 실제 콜백 확인 필요":"BIND_REJECTED: false");
        }catch(SecurityException e){
            bound=false;conn=null;line("PERMISSION_DENIED: "+e.getMessage());
        }catch(Exception e){
            bound=false;conn=null;line("FAILED "+e.getClass().getSimpleName()+": "+e.getMessage());
        }
    }
    private void disconnect(){
        if(bound&&conn!=null){
            try{unbindService(conn);line("서비스 바인딩 해제");}
            catch(Exception e){line("해제 오류 "+e.getMessage());}
        }
        bound=false;conn=null;
    }
    private void copy(){
        ClipboardManager c=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
        c.setPrimaryClip(ClipData.newPlainText("Samsung Bridge Probe",log.toString()));
        Toast.makeText(this,"로그를 복사했습니다",Toast.LENGTH_SHORT).show();
    }
    @Override public void onDestroy(){disconnect();super.onDestroy();}
}
