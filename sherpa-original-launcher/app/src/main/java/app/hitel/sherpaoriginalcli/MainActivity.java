package app.hitel.sherpaoriginalcli;

import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.content.Context;
import android.content.Intent;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.graphics.Typeface;
import android.widget.Button;
import android.widget.TextView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.CompoundButton;
import android.widget.CheckBox;
import android.util.Log;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Diagnostic user interface. Selection and monitoring are distinct:
 * 1) choose an existing M4A (including one growing) or
 * 2) grant access to the Samsung Call recording directory while in foreground,
 *    then switch to the Samsung Phone app to begin a call.
 * Full JSONL/FFmpeg/Sherpa logs may be zipped after success or failure.
 */
public final class MainActivity extends Activity {
  static final int FILE=31,FOLDER=32,EXPORT=33;
  final Handler ui=new Handler(Looper.getMainLooper());
  Uri selected;
  boolean folderMode=false;
  TextView source,status,caption,latestTwo,logs,summary,stageTimes;
  Button fileButton,folderButton,startButton,stopButton,exportButton,refreshButton,threadButton;
  CheckBox greedyCheck;
  volatile boolean receiverRegistered=false;
  volatile long lastLogRefreshNs=0;
  final StringBuilder liveText=new StringBuilder();

  final BroadcastReceiver broadcast=new BroadcastReceiver(){
    @Override public void onReceive(Context context,Intent intent){
      if(intent==null || !GrowingCallService.EVENT.equals(intent.getAction()))return;
      final long recvNs=SystemClock.elapsedRealtimeNanos();
      String message=intent.getStringExtra(GrowingCallService.EX_STATUS);
      String text=intent.getStringExtra(GrowingCallService.EX_TEXT);
      final boolean live=message!=null&&message.startsWith("실시간 자막");
      final long seq=intent.getLongExtra(GrowingCallService.EX_CAPTION_SEQ,-1);
      final long sendNs=intent.getLongExtra(GrowingCallService.EX_BROADCAST_BOOT_NS,0);
      final long nativeNs=intent.getLongExtra(GrowingCallService.EX_NATIVE_BOOT_NS,0);
      if(live)TraceJournal.uiTiming(recvNs,"UI","LIVE_BROADCAST_RECEIVED",
        "captionSeq",seq,"broadcastToReceiverMs",sendNs>0?(recvNs-sendNs)/1000000.0:-1,
        "nativeToReceiverMs",nativeNs>0?(recvNs-nativeNs)/1000000.0:-1);
      if(message!=null)status.setText(message);
      if(text!=null){
        final long captionSetBeginNs=SystemClock.elapsedRealtimeNanos();
        caption.setText(text.isEmpty()?"아직 PCM → STT 결과가 없습니다. 하단 로그에서 진단하십시오.":text);
        final long captionSetEndNs=SystemClock.elapsedRealtimeNanos();
        if(latestTwo!=null)latestTwo.setText(lastTwoWords(text));
        if(live){
          TraceJournal.uiTiming(captionSetEndNs,"PIPELINE","UI_SET_TEXT",
            "captionSeq",seq,"durationMs",(captionSetEndNs-captionSetBeginNs)/1000000.0,
            "startBootNs",captionSetBeginNs,"endBootNs",captionSetEndNs);
          if(sendNs>0 && recvNs>=sendNs)
            TraceJournal.uiTiming(recvNs,"PIPELINE","UI_BROADCAST",
              "captionSeq",seq,"durationMs",(recvNs-sendNs)/1000000.0,
              "startBootNs",sendNs,"endBootNs",recvNs);
          final String expected=caption.getText().toString();
          final long setNs=SystemClock.elapsedRealtimeNanos();
          TraceJournal.uiTiming(setNs,"UI","LIVE_SET_TEXT",
            "captionSeq",seq,"chars",expected.length(),
            "nativeToSetTextMs",nativeNs>0?(setNs-nativeNs)/1000000.0:-1,
            "broadcastToSetTextMs",sendNs>0?(setNs-sendNs)/1000000.0:-1);
          caption.postOnAnimation(()->{
            final long frameNs=SystemClock.elapsedRealtimeNanos();
            final boolean same=expected.equals(caption.getText().toString());
            TraceJournal.uiTiming(frameNs,"PIPELINE","UI_FRAME_CALLBACK",
              "captionSeq",seq,"durationMs",(frameNs-setNs)/1000000.0,
              "startBootNs",setNs,"endBootNs",frameNs,
              "note","callback only; not proof of visible scanout");
            TraceJournal.uiTiming(frameNs,"UI","NEXT_FRAME_CALLBACK",
              "captionSeq",seq,"sameTextStillPresent",same,
              "nativeToFrameCallbackMs",nativeNs>0?(frameNs-nativeNs)/1000000.0:-1,
              "setTextToFrameCallbackMs",(frameNs-setNs)/1000000.0,
              "note","frame callback, not proven screen scanout");
          });
        }
      }
      refreshButtons();
      if(recvNs-lastLogRefreshNs>2000000000L){
        lastLogRefreshNs=recvNs;
        refreshEventTail();
      }
    }
  };
  static String lastTwoWords(String s){
    if(s==null||s.trim().isEmpty())return "새로 인식된 단어 대기 중";
    String[] words=s.trim().split("\\s+");
    return words.length==1?words[0]:words[words.length-2]+" "+words[words.length-1];
  }
  TextView text(String value,int size){
    TextView v=new TextView(this);v.setText(value);v.setTextSize(size);
    v.setPadding(0,9,0,9);return v;
  }
  Button button(LinearLayout parent,String title){
    Button v=new Button(this);v.setText(title);parent.addView(v);return v;
  }
  @Override public void onCreate(Bundle b){
    super.onCreate(b);
    ScrollView scroll=new ScrollView(this);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    int padding=(int)(16*getResources().getDisplayMetrics().density);
    root.setPadding(padding,padding,padding,padding);
    scroll.addView(root);
    TextView header=text("삼성 통화 녹음 파일 증가분 → FFmpeg → 한국어 Zipformer 174M 스트리밍 STT",20);
    header.setTypeface(null,Typeface.BOLD);root.addView(header);
    root.addView(text(
      "삼성 기본 전화앱은 변경하지 않습니다. 실제 통화 중 녹음 파일이 다른 앱에서 열리는지, " +
      "크기가 증가하는지, FFmpeg -follow 1로 AAC→16kHz PCM을 추출할 수 있는지, " +
      "한국어 전용 Zipformer 온라인 모델이 한두 단어씩 반환하는지 단계별로 측정합니다.",13));
    root.addView(text("STEP 1 · 감시 대상 선택",17));
    fileButton=button(root,"녹음 M4A 파일 직접 선택 (이미 존재하는 파일)");
    folderButton=button(root,"통화 녹음 폴더 선택 (새로 커지는 파일 자동 감시)");
    source=text("입력 없음 · 갤럭시의 Recordings/Call 폴더를 선택해 주십시오.",14);
    source.setTextIsSelectable(true);root.addView(source);
    root.addView(text(
      "폴더 모드는 시작 당시 존재하는 파일은 건너뛰고, 이후 새로 나타나거나 크기가 변한 오디오 파일을 자동으로 선택합니다. " +
      "삼성 전화앱에서 녹음을 시작하신 뒤 앱으로 돌아오지 않아도 백그라운드 감시가 계속됩니다.",12));
    root.addView(text("STEP 2 · 증가분 스트리밍 진단",17));
    root.addView(text("v21 실기기용 모델 비교 설정 (실행 전에 선택)",13));
    greedyCheck=new CheckBox(this);
    greedyCheck.setText("Greedy Search 시험 사용 (해제: v20 Beam Search)");
    android.content.SharedPreferences bench=getSharedPreferences("zipformer_bench",MODE_PRIVATE);
    greedyCheck.setChecked("greedy_search".equals(bench.getString("decode","greedy_search")));
    root.addView(greedyCheck);
    threadButton=button(root,"CPU 스레드: "+bench.getInt("threads",2)+" (눌러 변경: 1 / 2 / 4)");
    greedyCheck.setOnCheckedChangeListener((button,enabled)->
      getSharedPreferences("zipformer_bench",MODE_PRIVATE).edit()
        .putString("decode",enabled?"greedy_search":"modified_beam_search").apply());
    threadButton.setOnClickListener(v->{
      android.content.SharedPreferences pref=getSharedPreferences("zipformer_bench",MODE_PRIVATE);
      int current=pref.getInt("threads",2);
      int next=current==1?2:current==2?4:1;
      pref.edit().putInt("threads",next).apply();
      threadButton.setText("CPU 스레드: "+next+" (눌러 변경: 1 / 2 / 4)");
    });
    startButton=button(root,"FFmpeg + 한국어 Zipformer 진단 시작");
    stopButton=button(root,"진단 중지");
    status=text("대기 중",15);root.addView(status);
    root.addView(text("현재 말하는 내용 · 확정 대기 없이 즉시 표시",17));
    latestTwo=text("새로 인식된 단어 대기 중",24);
    latestTwo.setTypeface(null,Typeface.BOLD);root.addView(latestTwo);
    root.addView(text("전체 임시 자막 · 다음 인식에 따라 자동 보정",16));
    caption=text("아직 인식 결과 없음",16);caption.setTextIsSelectable(true);root.addView(caption);
    root.addView(text("최근 처리 구간별 소요시간 (각 구간 단독 측정)",17));
    stageTimes=text("구간별 측정값 대기 중",13);
    stageTimes.setTextIsSelectable(true);
    root.addView(stageTimes);
    root.addView(text("STEP 3 · 상세 원본 로그 확보",17));
    exportButton=button(root,"전체 진단 로그 ZIP 저장 (오류 발생 시에도 가능)");
    refreshButton=button(root,"파일 증가·FFmpeg·STT 로그 새로고침");
    summary=text("로그: 미실행",13);root.addView(summary);
    logs=text("감시 로그 대기 중",11);logs.setTextIsSelectable(true);root.addView(logs);
    root.addView(text(
      "ZIP 구성: events.jsonl(시각·스레드·파일·AAC·FFmpeg·STT), latency-trace.jsonl(각 구간 독립 소요시간), " +
      "ffmpeg-raw.txt, stt-raw.txt, M4A 헤더 바이너리, README.txt.\n" +
      "성공 및 실패 여부와 관계없이 장치 내부에 저장됩니다. 전화번호·파일명·전사 내용이 로그에 포함될 수 있으니 ZIP 공유 전 확인하십시오.\n"+
      "실제 통화 음성은 로그 ZIP에 원본 파일 형태로 복사하지 않습니다.",12));
    setContentView(scroll);

    fileButton.setOnClickListener(v->choose(false));
    folderButton.setOnClickListener(v->choose(true));
    startButton.setOnClickListener(v->start());
    stopButton.setOnClickListener(v->stop());
    exportButton.setOnClickListener(v->export());
    refreshButton.setOnClickListener(v->refreshEventTail());
    String last=getSharedPreferences("growing_diag",MODE_PRIVATE).getString("sourceUri","");
    if(!last.isEmpty()){
      try{selected=Uri.parse(last);
        folderMode=getSharedPreferences("growing_diag",MODE_PRIVATE).getBoolean("folderMode",false);
        source.setText((folderMode?"녹음 폴더":"녹음 파일")+": "+last);
      }catch(Exception ignored){}
    }
    refreshButtons();
  }
  void choose(boolean folder){
    if(active())return;
    Intent i;
    if(folder){
      i=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
    }else{
      i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
      i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("audio/*");
    }
    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|
      Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
    startActivityForResult(i,folder?FOLDER:FILE);
  }
  @Override public void onActivityResult(int requestCode,int resultCode,Intent intent){
    super.onActivityResult(requestCode,resultCode,intent);
    if(resultCode!=RESULT_OK || intent==null || intent.getData()==null)return;
    Uri uri=intent.getData();
    if(requestCode==FILE || requestCode==FOLDER){
      selected=uri;folderMode=requestCode==FOLDER;
      try {
        getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);
      }catch(Throwable err){
        Log.w("GrowingM4aDiag","Persistable SAF permission unavailable",err);
        status.setText("선택 성공 · 영구 권한 유지 실패: "+err);
      }
      getSharedPreferences("growing_diag",MODE_PRIVATE).edit()
        .putString("sourceUri",uri.toString()).putBoolean("folderMode",folderMode).apply();
      source.setText((folderMode?"자동 감시할 폴더":"연속 읽을 파일")+": "+uri);
      status.setText("선택 완료 · 진단 시작 버튼을 누르십시오.");
      refreshButtons();
    }else if(requestCode==EXPORT){
      String id=getSharedPreferences("growing_diag",MODE_PRIVATE).getString("lastRunId","");
      File dir=new File(getFilesDir(),"diagnostics/run-"+id);
      if(id.isEmpty()||!dir.exists()){
        status.setText("내보낼 진단 기록이 없습니다.");return;
      }
      try(OutputStream out=getContentResolver().openOutputStream(uri)){
        if(out==null)throw new IOException("SAF ZIP 출력 스트림이 열리지 않았습니다.");
        TraceJournal.zipDirectory(dir,out,id);
        status.setText("진단 ZIP 저장 완료: "+uri);
      }catch(Throwable e){
        status.setText("ZIP 저장 실패: "+e.getMessage());
        Log.e("GrowingM4aDiag","ZIP export failure",e);
      }
    }
  }
  void start(){
    if(selected==null){status.setText("먼저 녹음 파일 또는 폴더를 선택하십시오.");return;}
    if(active()){status.setText("진단이 이미 실행 중입니다.");return;}
    try{
      Intent i=new Intent(this,GrowingCallService.class).setAction(GrowingCallService.START);
      i.putExtra(GrowingCallService.EX_URI,selected.toString());
      i.putExtra(GrowingCallService.EX_FOLDER,folderMode);
      if(Build.VERSION.SDK_INT>=26)startForegroundService(i);
      else startService(i);
      status.setText("포그라운드 서비스 시작 요청 · 파일 감시 로그 기록 중");
      ui.postDelayed(this::refreshButtons,850);
    }catch(Throwable e){
      Log.e("GrowingM4aDiag","Service start failed",e);
      status.setText("서비스 시작 실패: "+e);
    }
  }
  void stop(){
    Intent i=new Intent(this,GrowingCallService.class).setAction(GrowingCallService.STOP);
    try{startService(i);status.setText("진단 종료 요청 · 로그는 보관됩니다.");}
    catch(Throwable e){status.setText("중지 요청 오류: "+e);}
    ui.postDelayed(this::refreshButtons,500);
  }
  void export(){
    String id=getSharedPreferences("growing_diag",MODE_PRIVATE).getString("lastRunId","");
    if(id.isEmpty()){status.setText("진단 실행 기록이 없습니다.");return;}
    Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE);
    i.setType("application/zip");
    i.putExtra(Intent.EXTRA_TITLE,"Galaxy-Growing-M4A-FFmpeg-STT-"+id+".zip");
    startActivityForResult(i,EXPORT);
  }
  boolean active(){return getSharedPreferences("growing_diag",MODE_PRIVATE).getBoolean("active",false);}
  void refreshButtons(){
    boolean running=active();
    startButton.setEnabled(selected!=null&&!running);
    stopButton.setEnabled(running);
    folderButton.setEnabled(!running);
    fileButton.setEnabled(!running);
    String id=getSharedPreferences("growing_diag",MODE_PRIVATE).getString("lastRunId","");
    exportButton.setEnabled(!id.isEmpty());
    summary.setText("세션: "+(id.isEmpty()?"없음":id)+" · 상태: "+(running?"실행 중":"종료 또는 대기"));
  }
  void refreshEventTail(){
    String id=getSharedPreferences("growing_diag",MODE_PRIVATE).getString("lastRunId","");
    if(id.isEmpty())return;
    File eventFile=new File(new File(getFilesDir(),"diagnostics/run-"+id),"events.jsonl");
    if(!eventFile.isFile()){logs.setText("진단 기록 생성 대기 중");return;}
    new Thread(()->{
      refreshStageTiming(id);
      try(RandomAccessFile raf=new RandomAccessFile(eventFile,"r")){
        long size=raf.length();
        long offset=Math.max(0,size-28000);
        raf.seek(offset);
        byte[] b=new byte[(int)Math.min(28000,size-offset)];
        raf.readFully(b);
        String contents=new String(b,StandardCharsets.UTF_8);
        String[] lines=contents.split("\n");
        StringBuilder view=new StringBuilder();
        for(int j=Math.max(0,lines.length-28);j<lines.length;j++){
          String line=lines[j];
          try{
            org.json.JSONObject obj=new org.json.JSONObject(line);
            view.append(obj.optString("timestamp")).append(" [")
              .append(obj.optString("category")).append("] ")
              .append(obj.optString("event")).append(" ")
              .append(obj.optJSONObject("data")).append("\n\n");
          }catch(Exception ignored){view.append(line).append('\n');}
        }
        ui.post(()->logs.setText(view.toString()));
      }catch(Throwable e){ui.post(()->logs.setText("로그 조회 실패: "+e));}
    },"GrowingLogScreenReader").start();
  }
  void refreshStageTiming(String id){
    File file=new File(new File(getFilesDir(),"diagnostics/run-"+id),"latency-trace.jsonl");
    if(!file.isFile())return;
    try(RandomAccessFile raf=new RandomAccessFile(file,"r")){
      long size=raf.length();
      long offset=Math.max(0,size-131072L);
      raf.seek(offset);
      byte[] data=new byte[(int)(size-offset)];
      raf.readFully(data);
      String[] lines=new String(data,StandardCharsets.UTF_8).split("\\n");
      // Each entry is independent. Do not add or subtract cumulative model times.
      LinkedHashMap<String,String> latest=new LinkedHashMap<>();
      final String[] stages={
        "FILE_POLL","FILE_MIRROR_COPY","AAC_FRAME_WAIT_AND_READ",
        "AAC_FRAME_READ","AAC_CODEC_INPUT_WAIT","AAC_CODEC_FRAME_TOTAL",
        "PCM_SINK_CALLBACK","PCM_PIPE_WRITE","ACCEPT","DECODE",
        "HYPOTHESIS","PUBLISH","UI_BROADCAST","UI_SET_TEXT","UI_FRAME_CALLBACK"};
      for(String line:lines){
        try{
          org.json.JSONObject obj=new org.json.JSONObject(line);
          if(!"PIPELINE".equals(obj.optString("stage")))continue;
          String stage=obj.optString("event");
          org.json.JSONObject d=obj.optJSONObject("data");
          if(d==null||!d.has("durationMs"))continue;
          String key="";
          if(d.has("chunkSeq"))key="chunk "+d.optLong("chunkSeq");
          else if(d.has("aacFrame"))key="AAC "+d.optLong("aacFrame");
          else if(d.has("frame"))key="AAC "+d.optLong("frame");
          else if(d.has("outputChunk"))key="PCM "+d.optLong("outputChunk");
          double ms=d.optDouble("durationMs",-1);
          if(ms>=0)latest.put(stage,String.format(Locale.US,"%.2f ms  (%s)",ms,key));
        }catch(Exception ignored){}
      }
      StringBuilder display=new StringBuilder();
      for(String stage:stages)if(latest.containsKey(stage))
        display.append(stage).append(" · ").append(latest.get(stage)).append(System.lineSeparator());
      String view=display.length()==0?"구간별 결과 대기 중":display.toString();
      ui.post(()->{if(stageTimes!=null)stageTimes.setText(view);});
    }catch(Throwable e){
      ui.post(()->{if(stageTimes!=null)stageTimes.setText("구간 시간 조회 실패: "+e);});
    }
  }
  void loadPersisted(){
    String msg=getSharedPreferences("growing_diag",MODE_PRIVATE).getString("currentStatus","대기 중");
    String text=getSharedPreferences("growing_diag",MODE_PRIVATE).getString("currentTranscript","");
    status.setText(msg);
    caption.setText(text.isEmpty()?"아직 인식된 음성이 없습니다.":text);
    if(latestTwo!=null)latestTwo.setText(lastTwoWords(text));
    refreshButtons();
    refreshEventTail();
  }
  @Override protected void onStart(){
    super.onStart();
    IntentFilter filter=new IntentFilter(GrowingCallService.EVENT);
    if(Build.VERSION.SDK_INT>=33)registerReceiver(broadcast,filter,Context.RECEIVER_NOT_EXPORTED);
    else registerReceiver(broadcast,filter);
    receiverRegistered=true;
    loadPersisted();
  }
  @Override protected void onStop(){
    if(receiverRegistered){unregisterReceiver(broadcast);receiverRegistered=false;}
    super.onStop();
  }
}
