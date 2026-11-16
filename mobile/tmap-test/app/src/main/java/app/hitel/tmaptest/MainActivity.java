package app.hitel.tmaptest;
import android.app.*;
import android.os.*;
import android.content.*;
import android.net.Uri;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.view.*;
import android.widget.*;
import java.util.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
  private final ExecutorService worker=Executors.newSingleThreadExecutor();
  private EditText destination;
  private TextView status;
  private void button(LinearLayout l,String label,View.OnClickListener cb){
    Button b=new Button(this);b.setText(label);b.setOnClickListener(cb);l.addView(b);
  }
  @Override public void onCreate(Bundle saved){
    super.onCreate(saved);
    LinearLayout l=new LinearLayout(this);l.setPadding(24,28,24,24);l.setOrientation(1);
    TextView h=new TextView(this);h.setText("HITEL TMAP 자동화 시험 APK\n원본 말하면 척척의 9개 기능과 별개입니다.");h.setTextSize(18);l.addView(h);
    destination=new EditText(this);destination.setSingleLine();destination.setHint("목적지 예: 명동역");l.addView(destination);
    button(l,"1. 접근성 서비스 설정",v->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
    button(l,"2. TMAP 실행/설치 안내",v->{
       Intent i=getPackageManager().getLaunchIntentForPackage(TmapService.TMAP);
       if(i!=null){startActivity(i);status.setText("TMAP 실행 요청 완료");}
       else{status.setText("TMAP이 설치되지 않았습니다");startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://play.google.com/store/apps/details?id=com.skt.tmap.ku")));}
    });
    button(l,"3. 한국어 음성으로 목적지 입력",v->{
      Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
      i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
      i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"ko-KR");
      try {startActivityForResult(i,23);}catch(Exception e){status.setText("음성인식 앱이 필요합니다");}
    });
    button(l,"4. TMAP 장소 검색",v->run("SEARCH",false));
    button(l,"5. 경로 미리보기",v->run("ROUTE",false));
    button(l,"6. 길안내 시작",v->new AlertDialog.Builder(this).setTitle("길안내 시작")
      .setMessage("티맵의 목적지와 경로를 확인하셨습니까?")
      .setNegativeButton("취소",(d,w)->{}).setPositiveButton("확인",(d,w)->run("NAVIGATE",true)).show());
    status=new TextView(this);status.setText("대기 중 / 검색·길찾기 화면은 기종별로 검증이 필요합니다.");status.setTextIsSelectable(true);l.addView(status);
    ScrollView sc=new ScrollView(this);sc.addView(l);setContentView(sc);
  }
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request==23 && result==RESULT_OK && data!=null){
       ArrayList<String> a=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
       if(a!=null&&!a.isEmpty()){
         String s=a.get(0).replaceFirst("^(티맵으로|티맵에서|티맵)\\s*","").replaceFirst("\\s*(검색해줘|길찾기|찾아줘)$","").trim();
         destination.setText(s);status.setText("인식: "+s+" / 아래 검색 버튼을 누르십시오");
       }
    }
  }
  private void run(String action,boolean confirmed){
    String place=destination.getText().toString().trim();if(place.isEmpty()||place.length()>120){status.setText("목적지 1~120자를 입력하십시오");return;}
    TmapService s=TmapService.instance;
    if(s==null){status.setText("접근성 서비스 활성화 필요");return;}
    status.setText("처리 중: "+action+" / "+place);
    worker.execute(()->{String reply=s.execute(action,place,confirmed);runOnUiThread(()->status.setText(reply));});
  }
  @Override protected void onDestroy(){worker.shutdownNow();super.onDestroy();}
}