package app.hitel.sherpaoriginalcli;

import android.app.Activity;
import android.os.Bundle;
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
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

public final class MainActivity extends Activity {
  static final String TAG="SenseVoiceFileStream";
  static final int OPEN=31,SAVE=32,SAVE_LOG=33;
  static final int SAMPLE_RATE=16000;
  final Handler main=new Handler(Looper.getMainLooper());
  volatile Process nativeEngine;
  volatile boolean busy=false,stopRequested=false;
  volatile File logFile;
  volatile long fileDurationMs=0,decodedMs=0;
  volatile int receivedSegments=0;
  Uri chosenUri;
  String chosenName="",recognized="";
  final TreeMap<Integer,String> captions=new TreeMap<>();
  Button choose,execute,stop,save,copy,saveLog;
  TextView status,result,diagnostic,filename,progress;
  final StringBuilder diagnostics=new StringBuilder();

  TextView text(String s,int size) {
    TextView v=new TextView(this);
    v.setText(s);v.setTextSize(size);v.setPadding(0,9,0,9);return v;
  }
  Button button(LinearLayout root,String title) {
    Button b=new Button(this);b.setText(title);root.addView(b);return b;
  }
  void status(String s) {
    Log.i(TAG,s);
    main.post(()->status.setText(s));
  }
  static String clock(long millis) {
    long sec=millis/1000;
    return String.format(Locale.KOREA,"%02d:%02d",sec/60,sec%60);
  }
  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    ScrollView scroll=new ScrollView(this);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    int pad=(int)(18*getResources().getDisplayMetrics().density);
    root.setPadding(pad,pad,pad,pad);
    scroll.addView(root);
    TextView title=text("녹음 파일 스트리밍 STT",23);
    title.setTypeface(null,Typeface.BOLD);root.addView(title);
    root.addView(text("녹음 파일을 처음부터 끝까지 순차 디코딩합니다.\n" +
      "완료될 때까지 기다리지 않고, 약 4초마다 SenseVoice 한국어 자막을 추가합니다.\n" +
      "파일 입력 → Android MediaCodec → 16kHz PCM → SenseVoice C API",13));
    choose=button(root,"1. 녹음 파일 선택 (M4A / MP3 등)");
    filename=text("선택한 파일 없음",14);root.addView(filename);
    execute=button(root,"2. 파일 스트리밍 STT 시작");execute.setEnabled(false);
    stop=button(root,"스트리밍 중지");stop.setEnabled(false);
    status=text("파일 선택 대기",14);root.addView(status);
    progress=text("읽은 파일 길이: 0초",14);root.addView(progress);
    TextView subtitle=text("연속 인식된 문장 (구간별 즉시 갱신)",18);
    subtitle.setTypeface(null,Typeface.BOLD);root.addView(subtitle);
    result=text("녹음 파일을 선택하여 시작하십시오.",17);
    result.setTextIsSelectable(true);root.addView(result);
    copy=button(root,"누적 한국어 자막 복사");copy.setEnabled(false);
    save=button(root,"누적 자막 TXT로 저장");save.setEnabled(false);
    root.addView(text("실제 디코더 및 Sherpa 출력 로그",14));
    diagnostic=text("실행 전",12);
    diagnostic.setTextIsSelectable(true);root.addView(diagnostic);
    saveLog=button(root,"전체 진단 로그 TXT로 저장");saveLog.setEnabled(false);
    root.addView(text("녹음 파일 전체를 미리 WAV로 변환하지 않습니다.\n" +
      "SenseVoice는 문자를 한 글자씩 출력하는 스트리밍 모델이 아니라, 연속 공급된 PCM을 구간별로 인식하는 모델입니다.\n" +
      "통화 중 전화망의 내부 수신 음성을 가로채는 기능은 포함하지 않습니다.",12));
    setContentView(scroll);
    choose.setOnClickListener(v->{
      if(busy)return;
      Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
      i.addCategory(Intent.CATEGORY_OPENABLE);
      i.setType("audio/*");
      i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      startActivityForResult(i,OPEN);
    });
    execute.setOnClickListener(v->startStream());
    stop.setOnClickListener(v->{
      stopRequested=true;
      Process process=nativeEngine;
      if(process!=null)process.destroy();
      stop.setEnabled(false);
      status("파일 스트리밍 중지 요청됨");
    });
    copy.setOnClickListener(v->{
      ((ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE))
        .setPrimaryClip(ClipData.newPlainText("파일 스트리밍 STT",recognized));
      status("한국어 자막을 복사했습니다.");
    });
    save.setOnClickListener(v->createTextFile(SAVE,"SenseVoice-Streaming-Transcript.txt"));
    saveLog.setOnClickListener(v->createTextFile(SAVE_LOG,"SenseVoice-Streaming-Diagnostics.txt"));
    acceptIntent(getIntent());
  }

  void createTextFile(int code,String name){
    Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE);
    i.setType("text/plain");i.putExtra(Intent.EXTRA_TITLE,name);
    startActivityForResult(i,code);
  }
  void acceptIntent(Intent incoming){
    if(incoming==null)return;
    Uri u=null;
    if(Intent.ACTION_VIEW.equals(incoming.getAction()))u=incoming.getData();
    if(Intent.ACTION_SEND.equals(incoming.getAction()))
      u=incoming.getParcelableExtra(Intent.EXTRA_STREAM);
    if(u!=null)selectAudio(u);
  }
  @Override public void onNewIntent(Intent incoming){
    super.onNewIntent(incoming);setIntent(incoming);acceptIntent(incoming);
  }
  void selectAudio(Uri uri){
    if(uri==null)return;
    chosenUri=uri;
    chosenName="recording";
    try(Cursor c=getContentResolver().query(uri,
       new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
      if(c!=null && c.moveToFirst()&&!c.isNull(0))chosenName=c.getString(0);
    }catch(Exception ignored){}
    filename.setText("선택: "+chosenName);
    execute.setEnabled(true);
    status("녹음 파일이 선택되었습니다. 시작 시 파일 앞부분부터 인식합니다.");
  }
  @Override public void onActivityResult(int code,int resultCode,Intent data){
    super.onActivityResult(code,resultCode,data);
    if(resultCode!=RESULT_OK||data==null||data.getData()==null)return;
    Uri uri=data.getData();
    if(code==OPEN) {
      selectAudio(uri);
    }else if(code==SAVE){
      try(OutputStream out=getContentResolver().openOutputStream(uri)){
        if(out==null)throw new IOException("출력 스트림 없음");
        out.write(recognized.getBytes(StandardCharsets.UTF_8));out.flush();
        status("누적 한국어 자막을 저장했습니다.");
      }catch(Exception e){status("자막 저장 실패: "+e);}
    }else if(code==SAVE_LOG){
      File f=logFile;
      if(f==null||!f.isFile()){status("진단 로그가 없습니다.");return;}
      try(InputStream in=new FileInputStream(f);
          OutputStream out=getContentResolver().openOutputStream(uri)){
        if(out==null)throw new IOException("출력 스트림 없음");
        byte[] buf=new byte[32768];int n;
        while((n=in.read(buf))!=-1){if(n>0)out.write(buf,0,n);}
        out.flush();status("스트리밍 진단 로그를 저장했습니다.");
      }catch(Exception e){status("로그 저장 실패: "+e);}
    }
  }
  File extractModel(String name,long min) throws IOException{
    File dir=new File(getFilesDir(),"sensevoice-int8");
    if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("모델 폴더 생성 실패");
    File dest=new File(dir,name);
    if(dest.length()>=min)return dest;
    status("SenseVoice 한국어 모델 준비: "+name);
    File temporary=new File(dir,name+".partial");
    if(temporary.exists()&&!temporary.delete())throw new IOException("임시 모델 교체 실패");
    try(InputStream in=getAssets().open("sensevoice/"+name);
        FileOutputStream out=new FileOutputStream(temporary)){
      byte[] b=new byte[131072];int n;
      while((n=in.read(b))!=-1){
        if(stopRequested)throw new IOException("인식 중지");
        if(n>0)out.write(b,0,n);
      }
      out.getFD().sync();
    }
    if(temporary.length()<min)throw new IOException("APK 한국어 모델 파일 누락: "+name);
    if(dest.exists()&&!dest.delete())throw new IOException("기존 모델 교체 실패");
    if(!temporary.renameTo(dest))throw new IOException("모델 저장 실패");
    return dest;
  }
  static void writeLittleInt(OutputStream out,int x)throws IOException{
    out.write(x&255);out.write((x>>8)&255);out.write((x>>16)&255);out.write((x>>24)&255);
  }
  void renderCaptions(){
    StringBuilder visible=new StringBuilder(),plain=new StringBuilder();
    synchronized(captions){
      for(Map.Entry<Integer,String> e:captions.entrySet()){
        int seq=e.getKey();
        String line=e.getValue();
        if(line.isEmpty())continue;
        long startMs=(seq-1)*FilePcmStream.SEGMENT_SECONDS*1000L;
        if(visible.length()>0)visible.append("\n\n");
        visible.append("[").append(clock(startMs)).append("] ").append(line);
        if(plain.length()>0)plain.append('\n');
        plain.append(line);
      }
    }
    recognized=plain.toString();
    result.setText(visible.length()>0?visible.toString():"파일을 읽고 있습니다. 아직 인식된 한국어 문장이 없습니다.");
    copy.setEnabled(!recognized.isEmpty());
    save.setEnabled(!recognized.isEmpty());
  }
  void updateDiagnostic(String row){
    synchronized(diagnostics){
      diagnostics.append(row).append('\n');
      if(diagnostics.length()>50000)diagnostics.delete(0,diagnostics.length()-35000);
      final String last=diagnostics.length()>4000?
        diagnostics.substring(diagnostics.length()-4000):diagnostics.toString();
      main.post(()->diagnostic.setText(last));
    }
  }
  Thread outputReader(Process process,File log) {
    Thread thread=new Thread(()->{
      try(BufferedReader reader=new BufferedReader(new InputStreamReader(
            process.getInputStream(),StandardCharsets.UTF_8));
          FileOutputStream file=new FileOutputStream(log,false)){
        String line;
        while((line=reader.readLine())!=null){
          byte[] bytes=(line+"\n").getBytes(StandardCharsets.UTF_8);
          file.write(bytes);file.flush();
          Log.i(TAG,"NATIVE: "+line);
          updateDiagnostic(line);
          if(line.startsWith("STT_READY")){
            status("SenseVoice 준비됨 · 파일을 연속 읽으며 구간별 인식 중");
          }
          if(line.startsWith("STT_SEGMENT:")){
            String[] cols=line.split(":",3);
            if(cols.length==3){
              try{
                int seq=Integer.parseInt(cols[1]);
                synchronized(captions){captions.put(seq,cols[2].trim());}
                receivedSegments++;
                main.post(()->renderCaptions());
                status("구간 "+seq+" 인식 완료 · 누적 "+receivedSegments+"구간 · 다음 파일 구간 처리 중");
              }catch(NumberFormatException ex){
                updateDiagnostic("SEGMENT_PARSE_FAILED "+line);
              }
            }
          }
        }
      }catch(IOException e){
        Log.e(TAG,"Native transcript reader failed",e);
        updateDiagnostic("NATIVE_READER_ERROR "+e);
      }
    },"SenseVoice-Streaming-Result-Reader");
    thread.start();
    return thread;
  }
  void startStream(){
    if(chosenUri==null||busy)return;
    busy=true;stopRequested=false;nativeEngine=null;logFile=null;
    decodedMs=0;fileDurationMs=0;receivedSegments=0;recognized="";
    synchronized(captions){captions.clear();}
    synchronized(diagnostics){diagnostics.setLength(0);}
    choose.setEnabled(false);execute.setEnabled(false);
    stop.setEnabled(true);save.setEnabled(false);copy.setEnabled(false);
    saveLog.setEnabled(false);
    result.setText("디코더 시작 중…");diagnostic.setText("");
    progress.setText("파일 스트리밍 준비 중…");
    new Thread(()->{
      Thread readerThread=null;
      Process process=null;
      int sourceChunks=0;
      try{
        File model=extractModel("model.int8.onnx",1000000L);
        File tokens=extractModel("tokens.txt",1000L);
        if(stopRequested)throw new InterruptedException("실행 중지");
        File binary=new File(getApplicationInfo().nativeLibraryDir,"libsensevoice-stream.so");
        if(!binary.isFile()||!binary.canExecute())
          throw new IOException("스트리밍 SenseVoice ARM64 실행 파일이 누락되었습니다: "+binary);
        ProcessBuilder pb=new ProcessBuilder(binary.getAbsolutePath(),
          tokens.getAbsolutePath(),model.getAbsolutePath());
        pb.directory(getFilesDir());
        pb.redirectErrorStream(true);
        String oldPath=pb.environment().get("LD_LIBRARY_PATH");
        pb.environment().put("LD_LIBRARY_PATH",getApplicationInfo().nativeLibraryDir+
          (oldPath==null||oldPath.isEmpty()?"":":"+oldPath));
        process=pb.start();nativeEngine=process;
        logFile=new File(getFilesDir(),"sensevoice-stream-last-native-output.txt");
        readerThread=outputReader(process,logFile);
        status("선택한 파일을 스트리밍으로 디코딩 중…");
        final Process pipe=process;
        final AtomicInteger seqs=new AtomicInteger(0);
        try(BufferedOutputStream nativeInput=new BufferedOutputStream(pipe.getOutputStream(),262144)){
          FilePcmStream.decode(this,chosenUri,new FilePcmStream.Callback(){
            @Override public boolean cancelled(){return stopRequested;}
            @Override public void onStart(long total,String mime,int rate,int channels){
              fileDurationMs=total;
              status("디코더 연결: "+mime+" / "+rate+"Hz / "+channels+"채널");
            }
            @Override public void onProgress(long played,long total){
              decodedMs=played;
              final String line="파일 스트리밍 입력: "+clock(played)+" / "+
                (total>0?clock(total):"종료 시까지")+
                " · 인식 "+receivedSegments+"구간";
              main.post(()->progress.setText(line));
            }
            @Override public void onSegment(int seq,byte[] pcm,long position,long total,boolean last)throws Exception{
              if(stopRequested)throw new InterruptedException("사용자 중지");
              writeLittleInt(nativeInput,seq);
              writeLittleInt(nativeInput,pcm.length/2);
              nativeInput.write(pcm);
              nativeInput.flush();
              seqs.incrementAndGet();
              updateDiagnostic("FILE_STREAM_CHUNK_SENT seq="+seq+" bytes="+pcm.length+
                 " decoded_until="+clock(position)+" / "+(total>0?clock(total):"unknown")+" last="+last);
            }
          });
          if(!stopRequested){
            writeLittleInt(nativeInput,0);writeLittleInt(nativeInput,0);
            nativeInput.flush();
          }
        }
        sourceChunks=seqs.get();
        if(stopRequested)throw new InterruptedException("사용자 중지");
        int code=process.waitFor();
        if(readerThread!=null)readerThread.join(5000);
        if(code!=0)status("파일 스트리밍 STT 오류: 엔진 종료코드 "+code+" · 로그 확인");
        else if(receivedSegments!=sourceChunks)
          status("일부 구간 출력 누락: 입력 "+sourceChunks+"구간 / 출력 "+receivedSegments+"구간");
        else if(recognized.isEmpty())
          status("파일 스트리밍 완료. "+sourceChunks+"구간 인식 실행, 한국어 출력 없음");
        else
          status("전체 파일 스트리밍 완료 · "+receivedSegments+"구간 · 한국어 "+recognized.length()+"글자");
      }catch(InterruptedException e){
        status("사용자 요청으로 파일 스트리밍을 중지했습니다.");
      }catch(Throwable e){
        Log.e(TAG,"Continuous file STT failed",e);
        status("파일 스트리밍 오류: "+e.getMessage());
        updateDiagnostic("STREAM_FILE_EXCEPTION "+e);
      }finally{
        if(process!=null){
          if(process.isAlive())process.destroyForcibly();
        }
        if(readerThread!=null && readerThread.isAlive()){
          try{readerThread.join(3000);}catch(InterruptedException ignored){}
        }
        nativeEngine=null;busy=false;
        main.post(()->{
          execute.setEnabled(chosenUri!=null);choose.setEnabled(true);
          stop.setEnabled(false);
          saveLog.setEnabled(logFile!=null&&logFile.isFile()&&logFile.length()>0);
          renderCaptions();
        });
      }
    },"Galaxy-Selected-File-Streaming-ASR").start();
  }
}
