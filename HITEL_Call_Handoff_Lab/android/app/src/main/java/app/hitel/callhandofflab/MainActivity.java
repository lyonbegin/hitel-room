package app.hitel.callhandofflab;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.*;

/** Standalone call-screen takeover experiment; leaves system default dialer unchanged. */
public final class MainActivity extends Activity {
    private TextView status;
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        ScrollView scroll=new ScrollView(this);
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(32,36,32,32);
        root.setBackgroundColor(Color.WHITE);
        scroll.addView(root);
        root.addView(text("HITEL · 통화 전면 표시 실험",23));
        status=text("이 앱은 기본 전화 앱을 교체하지 않습니다.\n상대방 음성 수집·통역·TX 주입 기능은 포함되어 있지 않습니다.\nOFFHOOK은 상대방 연결 완료를 뜻하지 않습니다.",15);
        root.addView(status);
        makeButton(root,"1. 전화 상태 권한 요청",()->{
            if(Build.VERSION.SDK_INT>=23)requestPermissions(new String[]{Manifest.permission.READ_PHONE_STATE},101);
        });
        makeButton(root,"2. 다른 앱 위에 표시 권한",()->{
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:"+getPackageName())));
        });
        makeButton(root,"3. 통화 상태 관찰 시작",()->{
            if(Build.VERSION.SDK_INT>=23 && checkSelfPermission(Manifest.permission.READ_PHONE_STATE)!=PackageManager.PERMISSION_GRANTED){
                status.setText("전화 상태 권한을 먼저 허용해 주십시오."); return;
            }
            if(Build.VERSION.SDK_INT>=23 && !Settings.canDrawOverlays(this)){
                status.setText("전화 상태 관찰은 시작되지만 오버레이 표시 권한이 없습니다.");
            } else status.setText("전화 상태 관찰 시작 요청 완료. 실제 통화 시험이 필요합니다.");
            Intent i=new Intent(this,CallMonitorService.class).setAction(CallMonitorService.START);
            try { if(Build.VERSION.SDK_INT>=26)startForegroundService(i);else startService(i); }
            catch(Exception e){status.setText("감시 서비스 시작 실패: "+e.getClass().getSimpleName());}
        });
        makeButton(root,"4. 기존 전화 앱 열기",()->{
            try{startActivity(new Intent(Intent.ACTION_DIAL));}
            catch(Exception e){status.setText("기본 전화 앱을 열 수 없습니다.");}
        });
        makeButton(root,"5. 감시 종료",()->{
            stopService(new Intent(this,CallMonitorService.class));
            status.setText("감시 서비스 중지 요청 완료");
        });
        root.addView(text("시험: 1·2번 권한 → 3번 감시 시작 → 4번에서 기존 전화로 발신 → OFFHOOK에는 작은 '연결 미확인' 창 → 상대방 응답 후 확인 버튼 → HITEL 전체 화면 표시. 통화 종료 후 제거됩니다.",14));
        setContentView(scroll);
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},102);
        }
    }
    private TextView text(String s,int sp){
        TextView t=new TextView(this);t.setText(s);t.setTextSize(sp);
        t.setTextColor(Color.BLACK);t.setPadding(0,12,0,23);return t;
    }
    private void makeButton(LinearLayout root,String title,Runnable action){
        Button b=new Button(this);b.setAllCaps(false);b.setText(title);
        b.setGravity(Gravity.CENTER_VERTICAL);b.setOnClickListener(v->action.run());root.addView(b);
    }
}
