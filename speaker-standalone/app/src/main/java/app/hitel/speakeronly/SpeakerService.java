package app.hitel.speakeronly;

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
import android.telephony.TelephonyManager;
import java.io.IOException;

/** Background file monitoring and speaker output; deliberately contains no STT. */
public final class SpeakerService extends Service {
  static final String START="app.hitel.speakeronly.START";
  static final String STOP="app.hitel.speakeronly.STOP";
  static final String ROUTE="app.hitel.speakeronly.ROUTE";
  static final String EVENT="app.hitel.speakeronly.EVENT";
  static final String EX_URI="uri";
  static final String EX_FOLDER="folder";
  static final String EX_DEVICE="deviceId";
  static final String EX_STATUS="status";
  static final String EX_DONE="finished";
  static final String CHANNEL="samsung_recording_audio";
  private volatile SpeakerEngine engine;
  private volatile TraceJournal journal;
  private volatile boolean active;
  private volatile boolean shuttingDown;
  private volatile boolean autoCallMode;
  private volatile CallStateGate callEvents;
  private volatile Uri folderUri;
  private volatile int outputId=-1;
  private volatile TraceJournal sessionJournal;
  private volatile boolean restartAfterCleanup;

  @Override public IBinder onBind(Intent intent){return null;}

  @Override public int onStartCommand(Intent intent,int flags,int startId){
    String action=intent==null?"":intent.getAction();
    if(STOP.equals(action)){
      shutdown();
      return START_NOT_STICKY;
    }
    if(ROUTE.equals(action)){
      outputId=intent.getIntExtra(EX_DEVICE,-1);
      getSharedPreferences("speaker",MODE_PRIVATE).edit().putInt("routeId",outputId).apply();
      SpeakerEngine current=engine;
      if(current!=null)current.output(outputId);
      else send("출력 장치 변경 완료 · 통화 이벤트 또는 녹음 검증 대기",false);
      return START_NOT_STICKY;
    }
    if(!START.equals(action))return START_NOT_STICKY;
    if(active){send("통화 이벤트 자동 감시가 이미 실행 중입니다.",false);return START_NOT_STICKY;}
    try{
      String raw=intent.getStringExtra(EX_URI);
      if(raw==null||raw.isEmpty())
        throw new IllegalArgumentException("삼성 통화녹음 폴더를 먼저 선택하십시오.");
      autoCallMode=intent.getBooleanExtra(EX_FOLDER,false);
      folderUri=Uri.parse(raw);
      outputId=intent.getIntExtra(EX_DEVICE,-1);
      shuttingDown=false;
      foreground();
      active=true;
      journal=new TraceJournal(this);
      getSharedPreferences("speaker",MODE_PRIVATE).edit()
        .putBoolean("active",true).putString("lastRunId",journal.id())
        .putString("status","통화 이벤트 감시 준비 중")
        .putString("detectedSource","").apply();
      journal.event("APP","AUTO_CALL_MONITOR_ARMED",
          "autoCallMode",autoCallMode,"deviceId",outputId,
          "sttEnginePresent",false,"pcmRateHz",16000);
      if(autoCallMode){
        // The foreground service remains armed while idle, so Android does not
        // have to start a new background foreground service on every call.
        callEvents=new CallStateGate(this,journal,(state,hadOffhook)->{
          if(state==TelephonyManager.CALL_STATE_OFFHOOK)onCallConnected();
          else if(state==TelephonyManager.CALL_STATE_IDLE)onCallEnded();
          else send("전화 수신 중 · 통화 연결 이벤트 대기 · 스피커 재생 안 함",false);
        });
        if(engine==null)
          send("통화 이벤트 자동 감시 중 · 통화 시작 시 최신 M4A 검증",false);
      }else{
        journal.event("APP","MANUAL_FILE_DIAGNOSTIC_MODE","automaticCallControl",false);
        launchSession(false);
      }
    }catch(Throwable ex){
      Log.e("RecordingSpeaker","Auto monitor start failed",ex);
      TraceJournal diag=journal;
      if(diag!=null)diag.error("SERVICE","START_FAILED",ex);
      send("시작 오류: "+ex.getMessage(),true);
      shutdown();
    }
    return START_NOT_STICKY;
  }

  private synchronized void onCallConnected(){
    if(!active||shuttingDown||!autoCallMode)return;
    if(engine!=null){restartAfterCleanup=true;return;}
    restartAfterCleanup=false;
    journal.event("TELEPHONY","CALL_OFFHOOK_BEGIN_LIVE_RECORDING_VALIDATION",
        "folderUri",folderUri.toString(),"modelDownload",false);
    launchSession(true);
  }

  private synchronized void onCallEnded(){
    if(!active||shuttingDown||!autoCallMode)return;
    restartAfterCleanup=false;
    journal.event("TELEPHONY","CALL_IDLE_STOP_OUTPUT",
        "hadActiveAudioSession",engine!=null);
    SpeakerEngine current=engine;
    if(current!=null){
      send("통화 종료 이벤트 → 스피커 즉시 중지 · 로그 저장",false);
      current.stop();
    }else{
      send("통화 종료 · 다음 통화 시작 이벤트 대기 · 스피커 꺼짐",false);
    }
  }

  private synchronized void launchSession(boolean callTriggered){
    if(!active||shuttingDown||engine!=null)return;
    final TraceJournal session=new TraceJournal(this);
    sessionJournal=session;
    getSharedPreferences("speaker",MODE_PRIVATE).edit()
        .putString("lastRunId",session.id()).apply();
    session.event("CONTROL",callTriggered?"OFFHOOK_SESSION_STARTED":"MANUAL_DIAGNOSTIC_SESSION_STARTED",
        "callTriggered",callTriggered,"sourceUri",folderUri.toString(),
        "sttProcessStarted",false);
    final SpeakerEngine[] holder=new SpeakerEngine[1];
    SpeakerEngine task=new SpeakerEngine(this,session,(message,finished)->{
      if(!finished){send(message,false);return;}
      // No optimistic ZIP success message: TraceJournal reopens the file.
      String result=message;
      try{
        TraceJournal.VerifiedExport saved=TraceJournal.saveToDownloads(this,session.id());
        getSharedPreferences("speaker",MODE_PRIVATE).edit()
            .putString("lastExport",saved.detail())
            .putString("lastExportUri",saved.uri.toString())
            .putLong("lastExportBytes",saved.bytes).apply();
        result+=" · ZIP 검증됨: "+saved.detail();
      }catch(Throwable ex){
        session.error("JOURNAL","AUTO_EXPORT_FAILED",ex);
        result+=" · ZIP 저장 실패: "+ex.getMessage();
      }
      synchronized(SpeakerService.this){
        if(engine==holder[0])engine=null;
        sessionJournal=null;
      }
      if(shuttingDown||!autoCallMode){
        send(result,true);
        finishService();
      }else{
        send(result+" · 다음 통화 이벤트 대기",false);
        // An earlier call can end and a new call can start before cleanup.
        CallStateGate gate=callEvents;
        boolean shouldRestart=restartAfterCleanup;
        restartAfterCleanup=false;
        if(shouldRestart && gate!=null&&gate.isOffhook())onCallConnected();
      }
    },outputId);
    holder[0]=task;
    engine=task;
    send(callTriggered?
        "통화 시작 감지 · 같은 M4A 크기를 100ms 간격으로 3회 증가 확인 중":
        "선택한 녹음 파일 수동 재생 시작",false);
    task.start(folderUri,callTriggered);
  }

  private synchronized void shutdown(){
    if(shuttingDown)return;
    shuttingDown=true;
    active=false;
    CallStateGate gate=callEvents;
    callEvents=null;
    if(gate!=null)gate.close();
    SpeakerEngine current=engine;
    if(current!=null){
      current.stop();
      send("자동 감시 해제 · 재생 정리 및 진단 ZIP 저장 중",false);
    }else{
      send("자동 감시 해제 · 스피커 종료",true);
      finishService();
    }
  }

  private void finishService(){
    CallStateGate gate=callEvents;
    callEvents=null;
    if(gate!=null)gate.close();
    active=false;
    getSharedPreferences("speaker",MODE_PRIVATE).edit()
        .putBoolean("active",false).apply();
    stopForeground(true);
    stopSelf();
  }

  @Override public void onDestroy(){
    CallStateGate gate=callEvents;
    callEvents=null;
    if(gate!=null)gate.close();
    SpeakerEngine current=engine;
    if(current!=null)current.stop();
    super.onDestroy();
  }

  private void foreground(){
    NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    if(Build.VERSION.SDK_INT>=26){
      NotificationChannel channel=new NotificationChannel(CHANNEL,
          "16kHz 통화녹음 음성 모니터",NotificationManager.IMPORTANCE_LOW);
      manager.createNotificationChannel(channel);
    }
    PendingIntent view=PendingIntent.getActivity(this,1,
       new Intent(this,MainActivity.class),
       PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    PendingIntent stop=PendingIntent.getService(this,2,
       new Intent(this,SpeakerService.class).setAction(STOP),
       PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification note=new Notification.Builder(this,CHANNEL)
        .setSmallIcon(android.R.drawable.ic_media_play)
        .setContentTitle("통화 녹음 → 16kHz 스피커 실시간 재생")
        .setContentText("선택한 출력 장치로 PCM 스트리밍 · STT 없음")
        .setOngoing(true).setContentIntent(view)
        .addAction(android.R.drawable.ic_media_pause,"중지",stop).build();
    if(Build.VERSION.SDK_INT>=29)
      startForeground(2804,note,ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
    else startForeground(2804,note);
  }

  private void send(String s,boolean done){
    android.content.SharedPreferences.Editor prefs=
        getSharedPreferences("speaker",MODE_PRIVATE).edit().putString("status",s)
          .putBoolean("active",!done&&active);
    if(s.startsWith("녹음 중 파일 발견: "))prefs.putString("detectedSource",s);
    prefs.apply();
    Intent i=new Intent(EVENT).setPackage(getPackageName());
    i.putExtra(EX_STATUS,s).putExtra(EX_DONE,done);
    sendBroadcast(i);
  }
}
