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
import android.os.IBinder;
import android.util.Log;

/** Foreground surveillance session survives switching from app to Samsung Phone. */
public final class GrowingCallService extends Service {
  public static final String START="app.hitel.sherpaoriginalcli.GROWING_START";
  public static final String STOP="app.hitel.sherpaoriginalcli.GROWING_STOP";
  public static final String EVENT="app.hitel.sherpaoriginalcli.GROWING_STATUS";
  public static final String EX_URI="sourceUri";
  public static final String EX_FOLDER="isFolder";
  public static final String EX_STATUS="status";
  public static final String EX_TEXT="transcript";
  static final String CHANNEL="growing_m4a_diagnostics";
  static final int NOTE_ID=2803;
  volatile GrowingCallEngine engine;
  volatile TraceJournal journal;
  volatile boolean active=false;

  @Override public IBinder onBind(Intent intent){return null;}
  @Override public int onStartCommand(Intent incoming,int flags,int startId){
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
      getSharedPreferences("growing_diag",MODE_PRIVATE).edit()
        .putString("lastRunId",journal.id()).putBoolean("active",true)
        .putString("currentStatus","서비스 연결 중").putString("currentTranscript","").apply();
      journal.event("SERVICE","FOREGROUND_STARTED","uri",uri.toString(),"folder",isFolder,
        "targetSDK",getApplicationInfo().targetSdkVersion);
      engine=new GrowingCallEngine(this,journal,(status,transcript)->{
        sendStatus(status,transcript);
        if(engine!=null&&engine.done()){
          active=false;
          getSharedPreferences("growing_diag",MODE_PRIVATE).edit().putBoolean("active",false).apply();
          stopForeground(true);
          stopSelf();
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
    getSharedPreferences("growing_diag",MODE_PRIVATE).edit()
      .putString("currentStatus",status).putString("currentTranscript",transcript).apply();
    Intent update=new Intent(EVENT);
    update.setPackage(getPackageName());
    update.putExtra(EX_STATUS,status);
    update.putExtra(EX_TEXT,transcript);
    sendBroadcast(update);
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
