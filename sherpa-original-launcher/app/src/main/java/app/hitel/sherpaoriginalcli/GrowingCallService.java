package app.hitel.sherpaoriginalcli;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import java.util.concurrent.atomic.AtomicLong;
import android.os.IBinder;
import android.util.Log;

/** Foreground surveillance session survives switching from app to Samsung Phone. */
public final class GrowingCallService extends Service {
  public static final String START="app.hitel.sherpaoriginalcli.GROWING_START";
  public static final String STOP="app.hitel.sherpaoriginalcli.GROWING_STOP";
  public static final String SYNC="app.hitel.sherpaoriginalcli.GROWING_SYNC";
  public static final String EVENT="app.hitel.sherpaoriginalcli.GROWING_STATUS";
  public static final String EX_URI="sourceUri";
  public static final String EX_FOLDER="isFolder";
  public static final String EX_STATUS="status";
  public static final String EX_TEXT="transcript";
  public static final String EX_PATCH_KEEP="patchKeepUtf16";
  public static final String EX_PATCH_SUFFIX="patchSuffix";
  public static final String EX_REVISION="captionRevision";
  public static final String EX_CAPTION_SEQ="captionSeq";
  public static final String EX_BROADCAST_BOOT_NS="broadcastBootNs";
  public static final String EX_NATIVE_BOOT_NS="nativeHypothesisBootNs";
  static final String CHANNEL="growing_m4a_diagnostics";
  static final int NOTE_ID=2803;
  volatile GrowingCallEngine engine;
  volatile TraceJournal journal;
  volatile boolean active=false;
  final AtomicLong captionSeq=new AtomicLong();
  final AtomicLong transcriptRevision=new AtomicLong();
  volatile long lastFullPersistMs=0;

  @Override public IBinder onBind(Intent intent){return null;}
  @Override public int onStartCommand(Intent incoming,int flags,int startId){
    if(incoming!=null&&SYNC.equals(incoming.getAction())){
      // UI newly attached after a gap: one full snapshot, then patch-only updates.
      sendSnapshot();
      return START_NOT_STICKY;
    }
    if(incoming!=null&&STOP.equals(incoming.getAction())){
      TraceJournal j=journal;
      if(j!=null)j.event("SERVICE","STOP_ACTION","intent",STOP);
      if(engine!=null)engine.stop();
      else stopSelf();
      return START_NOT_STICKY;
    }
    if(incoming==null||!START.equals(incoming.getAction()))return START_NOT_STICKY;
    if(active){
      sendStatus("이미 녹음 파일 감시가 실행 중입니다.",engine==null?"":engine.transcript());
      return START_NOT_STICKY;
    }
    try{
      String raw=incoming.getStringExtra(EX_URI);
      if(raw==null||raw.isEmpty())throw new IllegalArgumentException("녹음 파일 또는 폴더를 선택하지 않았습니다.");
      boolean isFolder=incoming.getBooleanExtra(EX_FOLDER,false);
      Uri uri=Uri.parse(raw);
      startForegroundNotification();
      journal=new TraceJournal(this);
      active=true;
      transcriptRevision.set(0);
      lastFullPersistMs=0;
      getSharedPreferences("growing_diag",MODE_PRIVATE).edit()
        .putString("lastRunId",journal.id()).putBoolean("active",true)
        .putString("currentStatus","서비스 연결 중").putString("currentTranscript","").apply();
      journal.event("SERVICE","FOREGROUND_STARTED","uri",uri.toString(),"folder",isFolder,
        "targetSDK",getApplicationInfo().targetSdkVersion);
      engine=new GrowingCallEngine(this,journal,new GrowingCallEngine.Callback(){
        @Override public void onStatus(String status,String transcript){
          sendStatus(status,transcript);
          finishIfNeeded();
        }
        @Override public void onCaptionEdit(String status,int keepUtf16,String suffix,String full){
          sendCaptionEdit(status,keepUtf16,suffix,full);
          finishIfNeeded();
        }
      });
      sendStatus("FFmpeg/SenseVoice 성장 파일 진단 시작", "");
      engine.start(uri,isFolder);
    }catch(Throwable t){
      Log.e("GrowingM4aDiag","Failed to launch service",t);
      if(journal!=null)journal.error("SERVICE","START_FAILED",t);
      active=false;
      getSharedPreferences("growing_diag",MODE_PRIVATE).edit().putBoolean("active",false)
        .putString("currentStatus","시작 실패: "+t).apply();
      sendStatus("시작 실패: "+t.getMessage(),"");
      stopForeground(true);
      stopSelf();
    }
    return START_NOT_STICKY;
  }
  void finishIfNeeded(){
    GrowingCallEngine e=engine;
    if(e!=null&&e.done()){
      active=false;
      getSharedPreferences("growing_diag",MODE_PRIVATE).edit().putBoolean("active",false).apply();
      stopForeground(true);
      stopSelf();
    }
  }
  void sendSnapshot(){
    GrowingCallEngine e=engine;
    String full=e==null?"":e.transcript();
    Intent update=new Intent(EVENT);
    update.setPackage(getPackageName());
    update.putExtra(EX_STATUS,"실시간 자막 · 현재 화면 동기화");
    update.putExtra(EX_TEXT,full);
    update.putExtra(EX_REVISION,transcriptRevision.get());
    update.putExtra(EX_CAPTION_SEQ,-1L);
    sendBroadcast(update);
    if(journal!=null)journal.event("BROADCAST","FULL_UI_RESYNC",
      "revision",transcriptRevision.get(),"fullChars",full.length());
  }
  void sendCaptionEdit(String status,int keepUtf16,String suffix,String full){
    // A native edit typically carries one or two new words rather than
    // resending everything from the start of a long call. Do not write
    // entire transcript to SharedPreferences at every partial result.
    final long sendNs=SystemClock.elapsedRealtimeNanos();
    final long id=captionSeq.incrementAndGet();
    final long revision=transcriptRevision.incrementAndGet();
    GrowingCallEngine e=engine;
    final long nativeNs=e==null?0:e.nativeLiveBootNs;
    final long nativeId=e==null?0:e.nativeLiveId;
    if(journal!=null)journal.timingAt(sendNs,"BROADCAST","LIVE_SEND_BEGIN",
      "captionSeq",id,"nativeHypothesisId",nativeId,"nativeBootNs",nativeNs,
      "revision",revision,"keepUtf16",keepUtf16,"patchChars",suffix.length(),
      "fullChars",full.length(),"deltaOnly",true);
    long now=SystemClock.elapsedRealtime();
    if(now-lastFullPersistMs>=2000){
      getSharedPreferences("growing_diag",MODE_PRIVATE).edit()
        .putString("currentStatus",status).putString("currentTranscript",full)
        .putLong("currentTranscriptRevision",revision).apply();
      lastFullPersistMs=now;
    }
    Intent patch=new Intent(EVENT);
    patch.setPackage(getPackageName());
    patch.putExtra(EX_STATUS,status);
    patch.putExtra(EX_PATCH_KEEP,keepUtf16);
    patch.putExtra(EX_PATCH_SUFFIX,suffix);
    patch.putExtra(EX_REVISION,revision);
    patch.putExtra(EX_CAPTION_SEQ,id);
    patch.putExtra(EX_BROADCAST_BOOT_NS,sendNs);
    patch.putExtra(EX_NATIVE_BOOT_NS,nativeNs);
    sendBroadcast(patch);
    if(journal!=null)journal.timing("BROADCAST","LIVE_SEND_RETURNED",
      "captionSeq",id,"revision",revision,
      "sentPatchChars",suffix.length(),"fullChars",full.length(),
      "sendCallDurationMs",(SystemClock.elapsedRealtimeNanos()-sendNs)/1000000.0);
  }
  void startForegroundNotification(){
    NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    NotificationChannel channel=new NotificationChannel(CHANNEL,"통화 녹음 파일 증가 감시",
      NotificationManager.IMPORTANCE_LOW);
    channel.setDescription("FFmpeg와 Sherpa-ONNX가 녹음 파일 증가분을 진단 중입니다.");
    manager.createNotificationChannel(channel);
    PendingIntent view=PendingIntent.getActivity(this,1,new Intent(this,MainActivity.class),
      PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    PendingIntent stop=PendingIntent.getService(this,2,
      new Intent(this,GrowingCallService.class).setAction(STOP),
      PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification note=new Notification.Builder(this,CHANNEL)
      .setSmallIcon(android.R.drawable.ic_menu_search)
      .setContentTitle("삼성 통화 녹음 파일 실시간 진단")
      .setContentText("파일 증가량 · FFmpeg PCM · STT를 로컬에 기록 중")
      .setContentIntent(view).setOngoing(true)
      .addAction(android.R.drawable.ic_media_pause,"진단 종료",stop)
      .build();
    if(Build.VERSION.SDK_INT>=29)startForeground(NOTE_ID,note,ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
    else startForeground(NOTE_ID,note);
  }
  void sendStatus(String status,String transcript){
    final long sentNs=SystemClock.elapsedRealtimeNanos();
    final boolean live=status!=null && status.startsWith("실시간 자막");
    final long id=live?captionSeq.incrementAndGet():-1;
    final GrowingCallEngine e=engine;
    final long nativeNs=e==null?0:e.nativeLiveBootNs;
    final long nativeId=e==null?0:e.nativeLiveId;
    if(live && journal!=null)journal.timingAt(sentNs,"BROADCAST","LIVE_SEND_BEGIN",
      "captionSeq",id,"nativeHypothesisId",nativeId,"nativeBootNs",nativeNs,
      "nativeToServiceMs",nativeNs>0?(sentNs-nativeNs)/1000000.0:-1,
      "chars",transcript==null?0:transcript.length());
    getSharedPreferences("growing_diag",MODE_PRIVATE).edit()
      .putString("currentStatus",status).putString("currentTranscript",transcript)
      .putLong("currentTranscriptRevision",transcriptRevision.get()).apply();
    Intent update=new Intent(EVENT);
    update.setPackage(getPackageName());
    update.putExtra(EX_STATUS,status);
    update.putExtra(EX_TEXT,transcript);
    update.putExtra(EX_REVISION,transcriptRevision.get());
    update.putExtra(EX_CAPTION_SEQ,id);
    update.putExtra(EX_BROADCAST_BOOT_NS,sentNs);
    update.putExtra(EX_NATIVE_BOOT_NS,nativeNs);
    sendBroadcast(update);
    if(live && journal!=null)journal.timing("BROADCAST","LIVE_SEND_RETURNED",
      "captionSeq",id,"sendCallDurationMs",(SystemClock.elapsedRealtimeNanos()-sentNs)/1000000.0);
    Log.i("GrowingM4aDiag","STATUS_BROADCAST "+status);
  }
  @Override public void onDestroy(){
    GrowingCallEngine e=engine;
    if(e!=null&&!e.done())e.stop();
    active=false;
    getSharedPreferences("growing_diag",MODE_PRIVATE).edit().putBoolean("active",false).apply();
    super.onDestroy();
  }
}
