package app.hitel.screen;

import android.app.Activity;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.content.Context;
import android.provider.Settings;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
 private static final int CAPTURE_REQUEST=2026;
 private EditText pairingCode;
 private TextView state;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Runnable poll=new Runnable(){@Override public void run(){
  if(state!=null)state.setText(ScreenService.state+"\n원격 터치 권한: "+(ScreenAccessibilityService.enabled()?"사용 중":"설정 필요"));
  handler.postDelayed(this,1200);
 }};
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);
  LinearLayout root=new LinearLayout(this);
  root.setOrientation(LinearLayout.VERTICAL);
  root.setPadding(34,35,34,32);
  root.setBackgroundColor(Color.WHITE);
  TextView heading=new TextView(this);heading.setText("HITEL Screen");heading.setTextSize(25);heading.setTextColor(Color.BLACK);
  root.addView(heading,new LinearLayout.LayoutParams(-1,85));
  TextView description=new TextView(this);
  description.setText("실제 갤럭시 화면을 HITEL SDK Lab에 전송하며 웹에서 터치·스와이프·문자 입력도 할 수 있습니다.\nUSB는 필요하지 않습니다. 화면 공유와 원격 조작 권한은 각각 휴대전화에서 직접 승인해 주셔야 합니다.");
  description.setTextColor(Color.DKGRAY);description.setTextSize(15);
  root.addView(description,new LinearLayout.LayoutParams(-1,-2));
  pairingCode=new EditText(this);pairingCode.setHint("웹 화면의 8자리 연결코드");
  pairingCode.setInputType(2);pairingCode.setSingleLine(true);pairingCode.setTextSize(18);
  root.addView(pairingCode,new LinearLayout.LayoutParams(-1,110));
  Button start=new Button(this);start.setText("실제 화면 공유 시작");root.addView(start);
  start.setOnClickListener(v->requestScreen());
  Button permission=new Button(this);
  permission.setText("원격 터치·키보드 접근성 권한 설정");
  root.addView(permission);
  permission.setOnClickListener(v->{
   Toast.makeText(this,"설치된 서비스 → HITEL Screen 원격 터치 → 사용을 켜 주십시오.",Toast.LENGTH_LONG).show();
   startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
  });
  Button stop=new Button(this);stop.setText("화면 공유 종료");root.addView(stop);
  stop.setOnClickListener(v->{Intent i=new Intent(this,ScreenService.class);i.setAction("STOP");startService(i);});
  Button reset=new Button(this);reset.setText("다른 연결코드 사용 (기기 연결 초기화)");root.addView(reset);
  reset.setOnClickListener(v->{
   getSharedPreferences("hitel-screen",MODE_PRIVATE).edit().remove("deviceKey").apply();
   Intent i=new Intent(this,ScreenService.class);i.setAction("STOP");startService(i);
   Toast.makeText(this,"연결정보를 초기화했습니다.",Toast.LENGTH_SHORT).show();
  });
  state=new TextView(this);state.setTextColor(Color.rgb(25,87,105));state.setGravity(Gravity.CENTER_VERTICAL);
  state.setTextSize(14);state.setPadding(0,18,0,0);
  root.addView(state,new LinearLayout.LayoutParams(-1,125));
  setContentView(root);
  handler.post(poll);
 }
 private void requestScreen(){
  String code=pairingCode.getText().toString().trim();
  String key=getSharedPreferences("hitel-screen",MODE_PRIVATE).getString("deviceKey","");
  if(key.isEmpty()&&!code.matches("\\d{8}")){
   Toast.makeText(this,"SDK Lab의 8자리 연결코드를 입력해 주십시오.",Toast.LENGTH_LONG).show();return;
  }
  MediaProjectionManager mgr=(MediaProjectionManager)getSystemService(Context.MEDIA_PROJECTION_SERVICE);
  startActivityForResult(mgr.createScreenCaptureIntent(),CAPTURE_REQUEST);
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(request!=CAPTURE_REQUEST||result!=RESULT_OK||data==null)return;
  Intent intent=new Intent(this,ScreenService.class);
  intent.setAction("START");
  intent.putExtra("resultCode",result);
  intent.putExtra("resultData",data);
  intent.putExtra("code",pairingCode.getText().toString().trim());
  if(Build.VERSION.SDK_INT>=26)startForegroundService(intent);else startService(intent);
 }
 @Override protected void onResume(){
  super.onResume();
  if(ScreenAccessibilityService.enabled()){
   Intent i=new Intent(this,ScreenService.class);i.setAction("STATUS");startService(i);
  }
 }
 @Override protected void onDestroy(){handler.removeCallbacks(poll);super.onDestroy();}
}
