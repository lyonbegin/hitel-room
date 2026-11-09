package app.hitel.sherpafiletest;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.nio.charset.StandardCharsets;
import java.util.TreeMap;
import java.util.Map;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.database.Cursor;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Typeface;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.EditText;
import android.util.Log;


import java.io.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Standalone file STT test; no telephony, microphone, default dialer or accessibility.
 * Android SAF picker, upstream M4A MediaExtractor/MediaCodec decoder, sherpa-onnx 1.12.26
 * Korean streaming Zipformer INT8. All inference runs locally and offline.
 */
public final class MainActivity extends Activity {
  private static final String TAG="SherpaFileTest";
  private static final int OPEN_FILE=31, SAVE_TXT=32;
  private static final String[] MODEL_FILES = {
      "encoder-epoch-99-avg-1.int8.onnx",
      "decoder-epoch-99-avg-1.onnx",
      "joiner-epoch-99-avg-1.int8.onnx",
      "tokens.txt"
  };
  private static final long[] MODEL_MIN = {115000000L,9500000L,2000000L,50000L};
  private Uri selected;
  private String selectedName="";
  private TextView selectedView, status;
  private EditText transcript;
  private Button transcribe,save,copy;
  private volatile boolean busy=false;
  static {System.loadLibrary("sherpa-upstream-ffmpeg");}
  private native int nativeOriginal(String tok,String enc,String dec,String join,String file);
  private final java.io.ByteArrayOutputStream originalStderr=new java.io.ByteArrayOutputStream();

  private TextView text(String s, int sp) {
    TextView v=new TextView(this);
    v.setText(s); v.setTextSize(sp); v.setPadding(0,12,0,12);
    return v;
  }
  private Button button(String caption,LinearLayout parent) {
    Button b=new Button(this);
    b.setText(caption);
    parent.addView(b,new LinearLayout.LayoutParams(-1,-2));
    return b;
  }
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    ScrollView scroll=new ScrollView(this);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    int pad=(int)(18*getResources().getDisplayMetrics().density);
    root.setPadding(pad,pad,pad,pad);
    scroll.addView(root);
    TextView title=text("한국어 Sherpa 파일 STT",23);
    title.setTypeface(null,Typeface.BOLD);
    root.addView(title);
    root.addView(text("독립 테스트 앱 · Samsung 기본 전화 앱 변경 없음\n공식 원본 sherpa-onnx-ffmpeg.c · 한국어 Zipformer INT8\n모델 APK 내 포함 · 네트워크/마이크 권한 없음",13));
    Button pick=button("1. M4A/WAV/MP3 파일 선택",root);
    selectedView=text("선택한 파일 없음",14);
    root.addView(selectedView);
    transcribe=button("2. 원본 FFmpeg 자동 스트리밍 STT",root);
    transcribe.setEnabled(false);
    status=text("준비됨. 파일을 선택해 주십시오.",14);
    root.addView(status);
    TextView resultTitle=text("인식 결과",19);
    resultTitle.setTypeface(null,Typeface.BOLD);
    root.addView(resultTitle);
    transcript=new EditText(this);
    transcript.setTextSize(16);
    transcript.setMinLines(9);
    transcript.setGravity(android.view.Gravity.TOP);
    transcript.setHint("여기에 sherpa-onnx 인식 문장이 표시됩니다.");
    root.addView(transcript,new LinearLayout.LayoutParams(-1,(int)(240*getResources().getDisplayMetrics().density)));
    copy=button("텍스트 복사",root);
    save=button("3. TXT 저장 위치 직접 선택",root);
    copy.setEnabled(false);
    save.setEnabled(false);
    root.addView(text("진단: adb logcat -s SherpaFileTest\n원본 오디오는 외부 전송하지 않습니다. 결과를 다른 앱의 전용 폴더에 자동 저장하지 않습니다.",12));
    setContentView(scroll);
    pick.setOnClickListener(v->{
      if(busy)return;
      Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
      i.setType("audio/*");
      i.addCategory(Intent.CATEGORY_OPENABLE);
      i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
      i.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"audio/mp4","audio/m4a","audio/mpeg","audio/wav","audio/x-wav","audio/aac","audio/*"});
      startActivityForResult(i,OPEN_FILE);
    });
    transcribe.setOnClickListener(v->runStt());
    copy.setOnClickListener(v->{
      ((ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE))
        .setPrimaryClip(ClipData.newPlainText("Sherpa Korean STT",transcript.getText().toString()));
      notifyStatus("텍스트를 복사했습니다.");
    });
    save.setOnClickListener(v->{
      Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
      i.addCategory(Intent.CATEGORY_OPENABLE);
      i.setType("text/plain");
      i.putExtra(Intent.EXTRA_TITLE, selectedName.replaceFirst("(?i)\\.[^.]+$","") + ".txt");
      startActivityForResult(i,SAVE_TXT);
    });
  }
  @Override public void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(result!=RESULT_OK||data==null||data.getData()==null)return;
    Uri uri=data.getData();
    if(request==OPEN_FILE){
      selected=uri;
      try {getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}
      catch(SecurityException ignored) {}
      selectedName=getFileName(uri);
      selectedView.setText("선택: "+selectedName);
      transcribe.setEnabled(true);
      notifyStatus("선택 완료. STT 실행을 누르십시오.");
    } else if(request==SAVE_TXT){
      try(OutputStream out=getContentResolver().openOutputStream(uri,"w")){
        if(out==null)throw new IOException("출력 스트림이 없습니다.");
        out.write(transcript.getText().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        out.flush();
        notifyStatus("TXT 저장 완료: "+uri);
      }catch(Exception e){fail("TXT 저장 실패",e);}
    }
  }
  private String getFileName(Uri uri){
    String n="recording.m4a";
    try(Cursor c=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
      if(c!=null && c.moveToFirst()&&!c.isNull(0))n=c.getString(0);
    }catch(Exception ignored){}
    return n;
  }
  private void notifyStatus(String s){
    Log.i(TAG,s);
    runOnUiThread(()->status.setText(s));
  }
  private void fail(String stage,Throwable error){
    Log.e(TAG,stage,error);
    notifyStatus(stage+": "+error.getClass().getSimpleName()+" : "+error.getMessage());
  }
  // Adapter only. The upstream main() performs ALL FFmpeg and STT work.
  private void runStt(){
    final Uri uri=selected;
    if(uri==null||busy)return;
    busy=true;
    transcribe.setEnabled(false);
    save.setEnabled(false);
    copy.setEnabled(false);
    transcript.setText("");
    synchronized(originalStderr){originalStderr.reset();}
    new Thread(()->{
      try(ParcelFileDescriptor fd=getContentResolver().openFileDescriptor(uri,"r")){
        if(fd==null)throw new IOException("Android 파일 설명자 열기 실패");
        File dir=extractModels();
        String path="/proc/self/fd/"+fd.getFd();
        notifyStatus("공식 원본 FFmpeg 연속 인식 중…");
        Log.i(TAG,"Original main() file descriptor "+fd.getFd());
        int rc=nativeOriginal(
          new File(dir,MODEL_FILES[3]).getAbsolutePath(),
          new File(dir,MODEL_FILES[0]).getAbsolutePath(),
          new File(dir,MODEL_FILES[1]).getAbsolutePath(),
          new File(dir,MODEL_FILES[2]).getAbsolutePath(),
          path);
        if(rc!=0)throw new IOException("원본 프로그램 종료코드="+rc);
        notifyStatus("공식 원본 FFmpeg 인식 완료");
      }catch(Throwable e){fail("공식 FFmpeg 원본 실행 실패",e);}
      finally{
        busy=false;
        runOnUiThread(()->transcribe.setEnabled(selected!=null));
      }
    },"Original-Sherpa-FFmpeg").start();
  }
  @SuppressWarnings("unused")
  private void onNativeBytes(byte[] data){
    synchronized(originalStderr){originalStderr.write(data,0,data.length);}
    runOnUiThread(()->{
      String raw;
      synchronized(originalStderr){raw=new String(originalStderr.toByteArray(),StandardCharsets.UTF_8);}
      raw=raw.replaceAll("\\u001B\\[[0-9;]*[A-Za-z]","");
      TreeMap<Integer,String> segments=new TreeMap<>();
      for(String line:raw.split("[\\r\\n]")){
        line=line.trim();
        if(line.matches("^[0-9]+:.*")){
          int i=line.indexOf(':');
          try{segments.put(Integer.parseInt(line.substring(0,i)),line.substring(i+1));}
          catch(NumberFormatException ignored){}
        }
      }
      StringBuilder text=new StringBuilder();
      for(Map.Entry<Integer,String> entry:segments.entrySet()){
        if(text.length()>0)text.append('\n');
        text.append(entry.getValue());
      }
      if(text.length()>0){
        transcript.setText(text.toString());
        copy.setEnabled(true);save.setEnabled(true);
      }
    });
  }
  private File extractModels()throws IOException {
    File dir=new File(getFilesDir(),"sherpa-ko-v1");
    if(!dir.exists()&&!dir.mkdirs())throw new IOException("Cannot create model dir");
    for(int i=0;i<MODEL_FILES.length;i++){
      String n=MODEL_FILES[i];
      File dest=new File(dir,n);
      if(dest.length()>=MODEL_MIN[i])continue;
      notifyStatus("APK 내 한국어 모델 준비: "+n);
      File tmp=new File(dir,n+".part");
      if(tmp.exists()&&!tmp.delete())throw new IOException("Old .part removal failed");
      try(InputStream in=getAssets().open("models/"+n);FileOutputStream out=new FileOutputStream(tmp)){
        byte[] b=new byte[1024*128];int read;
        while((read=in.read(b))!=-1)out.write(b,0,read);
        out.getFD().sync();
      }
      if(tmp.length()<MODEL_MIN[i])throw new IOException("Bundled model incomplete: "+n+", bytes="+tmp.length());
      if(dest.exists()&&!dest.delete())throw new IOException("Cannot replace "+n);
      if(!tmp.renameTo(dest))throw new IOException("Cannot finish "+n);
    }
    return dir;
  }
  static final class Resampler16k {
    private long index=0;
    private double next=0;
    private float previous=0;
    private int rate=0;
    float[] push(float[] pcm,int sourceRate){
      if(rate==0)rate=sourceRate;
      if(rate!=sourceRate)throw new IllegalStateException("Changing sample rate not supported");
      double step=sourceRate/16000.0;
      float[] out=new float[Math.max(8,(int)Math.ceil(pcm.length*16000.0/sourceRate)+8)];
      int n=0;
      for(float current:pcm){
        if(index==0){
          out[n++]=current; next=step;previous=current;index=1;continue;
        }
        while(next<=index+1e-10){
          if(n==out.length)out=Arrays.copyOf(out,out.length*2);
          float t=(float)(next-(index-1));
          out[n++]=previous+(current-previous)*t;
          next+=step;
        }
        previous=current;index++;
      }
      return Arrays.copyOf(out,n);
    }
  }
}
