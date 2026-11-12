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

  @Override public IBinder onBind(Intent intent){return null;}
  @Override public int onStartCommand(Intent intent,int flags,int startId){
    String action=intent==null?"":intent.getAction();
    if(STOP.equals(action)){
      SpeakerEngine current=engine;
      if(current!=null)current.stop();
      else stopSelf();
      return START_NOT_STICKY;
    }
    if(ROUTE.equals(action)){
      int id=intent.getIntExtra(EX_DEVICE,-1);
      getSharedPreferences("speaker",MODE_PRIVATE).edit().putInt("routeId",id).apply();
      SpeakerEngine current=engine;
      if(current!=null)current.output(id);
      else send("출력 장치 선택 완료 · 스트리밍 시작 대기",false);
      return START_NOT_STICKY;
    }
    if(!START.equals(action))return START_NOT_STICKY;
    if(active){send("이미 16kHz PCM 재생 중입니다.",false);return START_NOT_STICKY;}
    try{
      String path=intent.getStringExtra(EX_URI);
      if(path==null||path.isEmpty())throw new IllegalArgumentException("녹음 파일·폴더를 선택해 주세요.");
      boolean folder=intent.getBooleanExtra(EX_FOLDER,false);
      int id=intent.getIntExtra(EX_DEVICE,-1);
      foreground();
      active=true;
      journal=new TraceJournal(this);
      getSharedPreferences("speaker",MODE_PRIVATE).edit()
        .putBoolean("active",true).putString("lastRunId",journal.id())
        .putString("status","스피커 스트리밍 연결 중")
        .putString("detectedSource","").apply();
      journal.event("APP","SPEAKER_ONLY_SESSION",
        "folderMode",folder,"deviceId",id,
        "sttEnginePresent",false,"pcmRateHz",16000);
      SpeakerEngine task=new SpeakerEngine(this,journal,(s,finished)->{
        if(finished){
          // The engine already wrote its RUN_SUMMARY before this callback.
          // Always save the ZIP to Downloads. This runs on the engine worker,
          // never on the main UI thread, so the user need not tap Export.
          TraceJournal completed=journal;
          String result=s;
          if(completed!=null){
            try{
              completed.event("JOURNAL","AUTO_EXPORT_START","runId",completed.id());
              TraceJournal.VerifiedExport saved=TraceJournal.saveToDownloads(this,completed.id());
              result+=" · 진단 ZIP 검증됨: "+saved.detail();
              getSharedPreferences("speaker",MODE_PRIVATE).edit()
                .putString("lastExport",saved.detail())
                .putString("lastExportUri",saved.uri.toString())
                .putLong("lastExportBytes",saved.bytes).apply();
            }catch(Throwable error){
              completed.error("JOURNAL","AUTO_EXPORT_FAILED",error);
              result+=" · 로그 자동 저장 실패: "+error.getMessage();
            }
          }
          active=false;engine=null;
          getSharedPreferences("speaker",MODE_PRIVATE).edit()
             .putBoolean("active",false).apply();
          send(result,true);
          stopForeground(true);
          stopSelf();
        }else send(s,false);
      },id);
      engine=task;
      send("녹음 파일 스트리밍 연결 중 · STT 없음",false);
      task.start(Uri.parse(path),folder);
    }catch(Throwable t){
      Log.e("RecordingSpeaker","Could not start",t);
      TraceJournal j=journal;
      if(j!=null){
        j.error("SERVICE","START_FAILED",t);
        try{
          TraceJournal.VerifiedExport saved=TraceJournal.saveToDownloads(this,j.id());
          getSharedPreferences("speaker",MODE_PRIVATE).edit()
            .putString("lastExport",saved.detail())
            .putString("lastExportUri",saved.uri.toString())
            .putLong("lastExportBytes",saved.bytes).apply();
        }catch(Throwable error){j.error("JOURNAL","ERROR_EXPORT_FAILED",error);}
      }
      active=false;
      getSharedPreferences("speaker",MODE_PRIVATE).edit()
         .putBoolean("active",false).apply();
      send("실행 오류: "+t.getMessage(),true);
      stopForeground(true);stopSelf();
    }
    return START_NOT_STICKY;
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
