package app.hitel.sherpaoriginalcli;

import android.app.Activity;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.Handler;
import android.os.Looper;
import android.content.Context;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;
import android.graphics.Typeface;
import android.widget.ScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/*
 * This file is ONLY the Android launcher/reader of original CLI stderr.
 * All audio decoding, resampling and STT live in the untouched upstream ELF.
 */
public final class MainActivity extends Activity {
  static final String TAG = "SherpaOriginalLauncher";
  static final String[] MODEL={
    "encoder-epoch-99-avg-1.int8.onnx","decoder-epoch-99-avg-1.onnx",
    "joiner-epoch-99-avg-1.int8.onnx","tokens.txt"
  };
  static final long[] MIN={115000000L,9500000L,2000000L,50000L};
  static final Pattern SEGMENT=Pattern.compile("^([0-9]+):(.*)$");
  static final int OPEN=31,SAVE=32;
  final Handler main=new Handler(Looper.getMainLooper());
  volatile Process child;
  volatile boolean busy=false,stopRequested=false;
  Uri chosenUri;
  String chosenName="", recognized="";
  Button choose,execute,stop,save,copy;
  TextView status,result,diagnostic,filename;
  final ByteArrayOutputStream logBuffer=new ByteArrayOutputStream();
  long lastUi=0;

  TextView text(String s,int size){
    TextView v=new TextView(this);
    v.setText(s);v.setTextSize(size);v.setPadding(0,10,0,10);
    return v;
  }
  Button button(LinearLayout root,String s){
    Button b=new Button(this);b.setText(s);root.addView(b);return b;
  }
  void status(String s){
    Log.i(TAG,s);
    main.post(()->status.setText(s));
  }
  @Override public void onCreate(Bundle saved){
    super.onCreate(saved);
    ScrollView scroll=new ScrollView(this);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    int pad=(int)(18*getResources().getDisplayMetrics().density);
    root.setPadding(pad,pad,pad,pad);
    scroll.addView(root);
    TextView head=text("Sherpa 원본 FFmpeg STT",23);
    head.setTypeface(null,Typeface.BOLD);
    root.addView(head);
    root.addView(text("공식 sherpa-onnx-ffmpeg.c 실행 파일을 그대로 사용합니다.\n한국어 Zipformer INT8 · 오프라인 · 추가 앱이나 ADB 불필요",13));
    choose=button(root,"1. M4A / 음성 파일 선택");
    filename=text("선택한 파일 없음",14);root.addView(filename);
    execute=button(root,"2. 원본 STT 실행");execute.setEnabled(false);
    stop=button(root,"인식 중지");stop.setEnabled(false);
    status=text("준비됨",14);root.addView(status);
    TextView heading=text("인식 문장 (진행 중 계속 갱신)",18);
    heading.setTypeface(null,Typeface.BOLD);root.addView(heading);
    result=text("",17);result.setTextIsSelectable(true);root.addView(result);
    copy=button(root,"텍스트 복사");copy.setEnabled(false);
    save=button(root,"TXT 파일 저장");save.setEnabled(false);
    root.addView(text("원본 FFmpeg / sherpa-onnx 출력 및 오류",15));
    diagnostic=text("실행 전",12);diagnostic.setTextIsSelectable(true);root.addView(diagnostic);
    root.addView(text("엔진: 공식 sherpa-onnx v1.12.26 C 원본.\n별도 음성인식·PCM 처리 코드를 추가하지 않았습니다.",11));
    setContentView(scroll);
    choose.setOnClickListener(v->{
      if(busy)return;
      Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
      i.addCategory(Intent.CATEGORY_OPENABLE);
      i.setType("audio/*");
      i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      startActivityForResult(i,OPEN);
    });
    execute.setOnClickListener(v->run());
    stop.setOnClickListener(v->{
      stopRequested=true;
      Process p=child;
      if(p!=null)p.destroy();
      stop.setEnabled(false);
      status("실행 중지 요청");
    });
    copy.setOnClickListener(v->{
      ((ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE))
        .setPrimaryClip(ClipData.newPlainText("Sherpa original STT",recognized));
      status("텍스트 복사 완료");
    });
    save.setOnClickListener(v->{
      Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
      i.addCategory(Intent.CATEGORY_OPENABLE);
      i.setType("text/plain");
      i.putExtra(Intent.EXTRA_TITLE,"sherpa-original-stt.txt");
      startActivityForResult(i,SAVE);
    });
    acceptIncomingAudio(getIntent());
  }
  /* Android's own content Uri entry point. It selects a file without touching the engine. */
  private void acceptAudioUri(Uri uri){
    if(uri==null)return;
    chosenUri=uri;
    chosenName="recording.m4a";
    try(Cursor c=getContentResolver().query(uri,
        new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
      if(c!=null&&c.moveToFirst()&&!c.isNull(0))chosenName=c.getString(0);
    }catch(Exception ignored){}
    filename.setText("선택: "+chosenName);
    execute.setEnabled(true);
    status("파일 선택 완료");
    Log.i(TAG,"Accepted Android audio URI scheme="+uri.getScheme()+" name="+chosenName);
  }
  private void acceptIncomingAudio(Intent incoming){
    if(incoming==null)return;
    Uri uri=null;
    if(Intent.ACTION_VIEW.equals(incoming.getAction())) uri=incoming.getData();
    else if(Intent.ACTION_SEND.equals(incoming.getAction()))
      uri=incoming.getParcelableExtra(Intent.EXTRA_STREAM);
    acceptAudioUri(uri);
  }
  @Override public void onNewIntent(Intent incoming){
    super.onNewIntent(incoming);
    setIntent(incoming);
    acceptIncomingAudio(incoming);
  }
  @Override public void onActivityResult(int code,int resultCode,Intent data){
    super.onActivityResult(code,resultCode,data);
    if(resultCode!=RESULT_OK||data==null||data.getData()==null)return;
    Uri uri=data.getData();
    if(code==OPEN){
      acceptAudioUri(uri);
    }else if(code==SAVE){
      try(OutputStream out=getContentResolver().openOutputStream(uri)){
        if(out==null)throw new IOException("출력 스트림 없음");
        out.write(recognized.getBytes(StandardCharsets.UTF_8));
        out.flush();status("TXT 저장 완료");
      }catch(Exception e){status("TXT 저장 실패: "+e);}
    }
  }
  File extractModels()throws IOException{
    File root=new File(getFilesDir(),"korean-int8-original");
    if(!root.exists()&&!root.mkdirs())throw new IOException("모델 디렉터리 생성 실패");
    for(int i=0;i<MODEL.length;i++){
      File f=new File(root,MODEL[i]);
      if(f.length()>=MIN[i])continue;
      status("APK에 포함된 원본 모델 준비: "+MODEL[i]);
      File tmp=new File(root,MODEL[i]+".partial");
      try(InputStream in=getAssets().open("models/"+MODEL[i]);
          FileOutputStream out=new FileOutputStream(tmp)){
        byte[] buffer=new byte[131072];int n;
        while((n=in.read(buffer))!=-1)if(n>0)out.write(buffer,0,n);
        out.getFD().sync();
      }
      if(tmp.length()<MIN[i])throw new IOException("원본 모델 파일 누락: "+MODEL[i]);
      if(f.exists()&&!f.delete())throw new IOException("원본 모델 교체 실패");
      if(!tmp.renameTo(f))throw new IOException("원본 모델 저장 실패");
    }
    return root;
  }
  File stageAudio()throws IOException{
    File dest=new File(getCacheDir(),"selected-original-audio.m4a");
    try(InputStream in=getContentResolver().openInputStream(chosenUri);
        FileOutputStream out=new FileOutputStream(dest)){
      if(in==null)throw new IOException("녹음 파일을 열 수 없습니다");
      byte[] buffer=new byte[131072];int n;
      while((n=in.read(buffer))!=-1){
        if(stopRequested)throw new IOException("사용자 중지");
        if(n>0)out.write(buffer,0,n);
      }
    }
    if(dest.length()==0)throw new IOException("녹음 파일 길이가 0입니다");
    return dest;
  }
  void run(){
    if(chosenUri==null||busy)return;
    busy=true;stopRequested=false;recognized="";
    execute.setEnabled(false);choose.setEnabled(false);
    stop.setEnabled(true);save.setEnabled(false);copy.setEnabled(false);
    result.setText("");diagnostic.setText("원본 실행 파일 준비 중…");
    logBuffer.reset();
    new Thread(()->{
      try{
        File model=extractModels();
        status("M4A 파일 준비 중…");
        File audio=stageAudio();
        File libDir=new File(getApplicationInfo().nativeLibraryDir);
        File original=new File(libDir,"liboriginal-cli.so");
        if(!original.isFile()||!original.canExecute())
          throw new IOException("APK 원본 실행 파일을 실행할 수 없습니다: "+original);
        ProcessBuilder pb=new ProcessBuilder(
          original.getAbsolutePath(),
          new File(model,MODEL[3]).getAbsolutePath(),
          new File(model,MODEL[0]).getAbsolutePath(),
          new File(model,MODEL[1]).getAbsolutePath(),
          new File(model,MODEL[2]).getAbsolutePath(),
          audio.getAbsolutePath()
        );
        pb.redirectErrorStream(true);
        pb.directory(getFilesDir());
        String oldPath=pb.environment().get("LD_LIBRARY_PATH");
        pb.environment().put("LD_LIBRARY_PATH",libDir.getAbsolutePath()+
          (oldPath==null||oldPath.isEmpty()?"":":"+oldPath));
        Log.i(TAG,"Original executable="+original+" audioBytes="+audio.length());
        status("FFmpeg 원본 스트리밍 음성인식 진행 중…");
        Process proc=pb.start();
        child=proc;
        try(InputStream stdout=new BufferedInputStream(proc.getInputStream())){
          byte[] buffer=new byte[2048];int n;
          while((n=stdout.read(buffer))!=-1){
            if(n==0)continue;
            logBuffer.write(buffer,0,n);
            if(logBuffer.size()>180000){
              byte[] bytes=logBuffer.toByteArray();
              logBuffer.reset();
              logBuffer.write(bytes,bytes.length-140000,140000);
            }
            long now=SystemClock.uptimeMillis();
            if(now-lastUi>120){lastUi=now;updateResult(false);}
          }
        }
        int code=proc.waitFor();
        updateResult(true);
        String text=toCaptions(new String(logBuffer.toByteArray(),StandardCharsets.UTF_8));
        Log.i(TAG,"Original CLI finished rc="+code+" recognizedChars="+text.length());
        if(stopRequested)status("작업을 중지했습니다.");
        else if(code!=0)status("원본 실행 오류 (종료코드 "+code+"). 아래 원본 로그를 확인하십시오.");
        else if(text.isEmpty())status("원본은 종료코드 0으로 완료됐지만 인식된 문장이 없습니다. 원본 출력을 확인하십시오.");
        else status("원본 음성인식 완료. 자막과 TXT 저장을 확인하십시오.");
      }catch(Throwable e){
        Log.e(TAG,"Original process start/run failed",e);
        status("원본 실행 오류: "+e.getMessage());
        main.post(()->diagnostic.setText(e.toString()));
      }finally{
        child=null;busy=false;
        main.post(()->{
          execute.setEnabled(chosenUri!=null);
          choose.setEnabled(true);stop.setEnabled(false);
        });
      }
    },"Launch-Unmodified-Sherpa-CLI").start();
  }
  /* Only interprets the original program's terminal output.
   * It does NOT recognize speech, parse audio, or run the model.
   */
  static String toCaptions(String raw){
    String noAnsi=raw.replaceAll("\\u001B\\[[0-9;]*[a-zA-Z]","");
    TreeMap<Integer,String> segments=new TreeMap<>();
    for(String segment:noAnsi.split("[\\r\\n]")){
      Matcher m=SEGMENT.matcher(segment.trim());
      if(m.matches())segments.put(Integer.parseInt(m.group(1)),m.group(2).trim());
    }
    StringBuilder txt=new StringBuilder();
    for(Map.Entry<Integer,String> entry:segments.entrySet()){
      if(entry.getValue().isEmpty())continue;
      if(txt.length()>0)txt.append('\n');
      txt.append(entry.getValue());
    }
    return txt.toString();
  }
  void updateResult(boolean finished){
    String raw=new String(logBuffer.toByteArray(),StandardCharsets.UTF_8);
    String parsed=toCaptions(raw);
    String diag=raw.length()>2500?raw.substring(raw.length()-2500):raw;
    String clean=diag.replaceAll("\\u001B\\[[0-9;]*[a-zA-Z]","");
    main.post(()->{
      if(!parsed.isEmpty()){
        recognized=parsed;
        result.setText(parsed);
        copy.setEnabled(true);save.setEnabled(true);
      }else if(finished)result.setText("음성인식 문장이 출력되지 않았습니다.");
      diagnostic.setText(clean);
    });
  }
}
