package com.hitel.zocbodiag;

import android.app.Activity;
import android.os.Bundle;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.text.InputType;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;

/**
 * Android entry activity for original Zocbo viewer.
 * This class NEVER makes HTTP calls, creates a RequestBody, changes tokens
 * or implements PDF download. It calls exactly the pre-existing A3.L.c(...)
 * launcher from the original, hash-verified 4.3.11(2) DEX.
 * The unmodified ViewerActivity / Y0 / V0 / Retrofit repository / original
 * OkHttp PDF GET perform all work as they did before instrumentation.
 */
public final class NativePdfEntryActivity extends Activity {
  private EditText exam;
  private TextView status;
  private boolean started=false;
  private ReadingCollectorController collector;

  private int dp(int units) {
    return (int)(getResources().getDisplayMetrics().density*units+0.5f);
  }
  private TextView text(String value,int size) {
    TextView t=new TextView(this);
    t.setText(value);
    t.setTextColor(Color.rgb(30,40,54));
    t.setTextSize(size);
    t.setPadding(dp(6),dp(8),dp(6),dp(8));
    return t;
  }
  @Override public void onCreate(Bundle savedState) {
    super.onCreate(savedState);
    if(getIntent()!=null && getIntent().getBooleanExtra(ReadingCollectorController.EXTRA_COLLECT,false)){
      Diag.log("COLLECTOR_ACTIVITY_OPEN","in-app collector, original DEX PDF route untouched");
      collector=new ReadingCollectorController(this,
        getIntent().getStringExtra(ReadingCollectorController.EXTRA_SOURCE_URL));
      return;
    }
    Diag.log("NATIVE_ORIGINAL_ACTIVITY","onCreate; standalone entry; network+PDF handled ONLY by original DEX");
    ScrollView scroller=new ScrollView(this);
    scroller.setFillViewport(true);
    scroller.setBackgroundColor(Color.WHITE);
    LinearLayout body=new LinearLayout(this);
    body.setOrientation(LinearLayout.VERTICAL);
    body.setPadding(dp(20),dp(36),dp(20),dp(20));
    scroller.addView(body,new ScrollView.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
    body.addView(text("원본 DEX PDF 다운로드",21));
    body.addView(text("시험지 번호를 입력하시면 족보닷컴 원본 A3.L.c()가 원본 ViewerActivity를 실행합니다. 로그인·요청·PDF 다운로드·표시는 원본 DEX에서 처리합니다.",13));
    body.addView(text("시험지 번호",16));
    exam=new EditText(this);
    exam.setSingleLine(true);
    exam.setInputType(InputType.TYPE_CLASS_NUMBER);
    String fromTitle=null;
    try{
      if(getIntent()!=null)fromTitle=getIntent().getStringExtra(NativePdfTitleBridge.EXTRA_EXAM_ID);
    }catch(Throwable ignored){}
    final boolean provided=(fromTitle!=null && fromTitle.matches("[1-9][0-9]{0,9}"));
    int previous=NetTrace.lastModelExamNo();
    String initial=provided?fromTitle:(previous>0?String.valueOf(previous):"15958873");
    exam.setText(initial);
    Diag.log("NATIVE_ORIGINAL_ACTIVITY_EXAM_SOURCE",
      (provided?"selected_previous_exam_title":previous>0?"last_original_model":"diagnostic_default")
      +" exam="+initial);
    exam.selectAll();
    exam.setContentDescription("시험지 번호");
    body.addView(exam,new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));
    Button open=new Button(this);
    open.setText("원본 뷰어 실행");
    open.setAllCaps(false);
    open.setContentDescription("원본 뷰어 실행");
    body.addView(open,new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,dp(56)));
    status=text("상태: 입력 대기",14);
    body.addView(status);
    body.addView(text("추가적인 API POST나 PDF GET을 이 화면에서 작성하지 않습니다. 원본 앱과 동일한 인증·열람 조건이 적용되며 열람 횟수에 영향을 줄 수 있습니다.",12));
    open.setOnClickListener(v->launchOriginalViewer());
    setContentView(scroller);
    Diag.log("NATIVE_ORIGINAL_ACTIVITY_READY","exam="+exam.getText().toString()+"; launcher=A3.L.c");
  }
  private void launchOriginalViewer() {
    if(started) {Diag.log("NATIVE_ORIGINAL_LAUNCH_BLOCKED","duplicate click");return;}
    String id=exam.getText().toString().trim();
    if(!id.matches("[1-9][0-9]{0,9}")) {
      status.setText("시험지 번호는 양의 정수여야 합니다.");
      return;
    }
    try {
      Class<?> launcher=Class.forName("A3.L");
      // Verified from original JADX: c(Context packageContext,
      // String exPaprNo, String fileType, String shortUrl, String primaryKey,
      // String isToast, String tipQr, String questionId, String fromQrCamera,
      // boolean showAnswer, String deepLinkFeature, Integer deepLinkPage, int defaultMask)
      Method method=launcher.getDeclaredMethod("c",
        Context.class,
        String.class,String.class,String.class,String.class,
        String.class,String.class,String.class,String.class,
        boolean.class,String.class,Integer.class,int.class);
      if(!Modifier.isStatic(method.getModifiers()))throw new IllegalStateException("original c is not static");
      method.setAccessible(true);
      Object outcome=method.invoke(null,
        this, id, "Q", "", "", "", "", "", "", false, "", null, 0);
      if(!(outcome instanceof Intent))throw new IllegalStateException("original c returned non-Intent");
      Intent original=(Intent)outcome;
      if(original.getComponent()==null || !getPackageName().equals(original.getComponent().getPackageName())
         || !"com.eduzone.eduzoneviewer.ui.activities.ViewerActivity".equals(original.getComponent().getClassName()))
        throw new SecurityException("original viewer intent target mismatch");
      Diag.log("NATIVE_ORIGINAL_FACTORY_OK","class=A3.L method=c exam="+id
          +" target="+original.getComponent().getClassName()
          +" fileType="+original.getStringExtra("EXTRA_PDF_FILE_TYPE")
          +" shortUrlEmpty="+original.getStringExtra("EXTRA_PDF_SHORT_URL").isEmpty()
          +" primaryKeyEmpty="+original.getStringExtra("EXTRA_PDF_PRIMARY_KEY").isEmpty());
      started=true;
      status.setText("원본 ViewerActivity 실행 중");
      Diag.log("NATIVE_ORIGINAL_VIEWER_START","calls original ViewerActivity.onCreate -> V0 -> repository.E -> Y0 download");
      startActivity(original);
      // Keep this activity alive for Back from original viewer.
    }catch(Throwable ex) {
      started=false;
      Throwable cause=ex instanceof java.lang.reflect.InvocationTargetException
         ? ((java.lang.reflect.InvocationTargetException)ex).getTargetException():ex;
      String msg=cause==null?"unknown":cause.getClass().getName();
      Diag.log("NATIVE_ORIGINAL_LAUNCH_ERROR",msg);
      status.setText("원본 뷰어 호출 오류: "+msg);
      Toast.makeText(this,"원본 뷰어 시작 실패. 로그를 확인해 주십시오.",Toast.LENGTH_LONG).show();
    }
  }
  @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
    super.onActivityResult(requestCode,resultCode,data);
    if(collector!=null)collector.onActivityResult(requestCode,resultCode,data);
  }
  @Override protected void onDestroy(){
    if(collector!=null){collector.destroy();collector=null;}
    super.onDestroy();
  }
  @Override public void onResume(){
    super.onResume();
    if(collector!=null)return;
    started=false;
    Diag.log("NATIVE_ORIGINAL_ACTIVITY","onResume");
  }
}
