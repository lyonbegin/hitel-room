package app.hitel.samsungprobe;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.IBinder;
import android.util.Log;

/**
 * ONLY NEW FUNCTION: start/stop a playback session for a growing Samsung call
 * recording folder. The original Sherpa microphone + speaker STT services
 * are not referenced, started, stopped, configured, or modified.
 */
public final class RecordingFolderPlaybackService extends Service
        implements RecordingFolderPlaybackEngine.Listener {
    static final String START="app.hitel.callflowlab.v14.GROWING_PLAYBACK_START";
    static final String STOP="app.hitel.callflowlab.v14.GROWING_PLAYBACK_STOP";
    static final String EVENT="app.hitel.callflowlab.v14.GROWING_PLAYBACK_EVENT";
    static final String KEY_URI="folder_uri";
    static final String KEY_STATE="state";
    static final String KEY_DETAIL="detail";
    private static final String CHANNEL="hitel14-growing-call-audio";
    private static final int NOTIFICATION_ID=1416;
    private RecordingFolderPlaybackEngine engine;

    @Override public void onCreate(){
        super.onCreate();
        ((NotificationManager)getSystemService(Context.NOTIFICATION_SERVICE))
            .createNotificationChannel(new NotificationChannel(CHANNEL,
                "HITEL 통화 녹음파일 실시간 재생",NotificationManager.IMPORTANCE_LOW));
    }
    private Notification note(){
        Intent ui=new Intent(this,RecordingFolderPlaybackActivity.class);
        PendingIntent open=PendingIntent.getActivity(this,151,ui,
            PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Intent stop=new Intent(this,RecordingFolderPlaybackService.class).setAction(STOP);
        PendingIntent end=PendingIntent.getService(this,152,stop,
            PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this,CHANNEL)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("HITEL14 · 통화 녹음파일 실시간 재생")
            .setContentText("선택한 삼성 녹음 폴더 감시 · 스피커 재생")
            .setContentIntent(open)
            .addAction(android.R.drawable.ic_media_pause,"재생 중지",end)
            .setOngoing(true)
            .build();
    }
    @Override public void onEvent(String state,String detail){
        Intent event=new Intent(EVENT).setPackage(getPackageName());
        event.putExtra(KEY_STATE,state);
        event.putExtra(KEY_DETAIL,detail);
        sendBroadcast(event);
        Log.i("HITEL-GrowingPlayback",state+": "+detail);
        if("SESSION_END".equals(state)){
            android.os.Handler main=new android.os.Handler(getMainLooper());
            main.post(()->{
                engine=null;
                stopForeground(STOP_FOREGROUND_REMOVE);
                stopSelf();
            });
        }
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null||intent.getAction()==null){
            stopSelf();return START_NOT_STICKY;
        }
        if(STOP.equals(intent.getAction())){
            onEvent("STOP_REQUESTED","사용자가 녹음파일 재생 중지를 요청했습니다.");
            RecordingFolderPlaybackEngine e=engine;
            if(e!=null)e.stop();
            else{stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
            return START_NOT_STICKY;
        }
        if(!START.equals(intent.getAction()))return START_NOT_STICKY;
        try{
            startForeground(NOTIFICATION_ID,note(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            if(engine!=null&&!engine.isDone()){
                onEvent("ALREADY_RUNNING","기존 녹음파일 재생 세션을 유지합니다.");
                return START_NOT_STICKY;
            }
            String uriValue=intent.getStringExtra(KEY_URI);
            if(uriValue==null||uriValue.isBlank())
                throw new IllegalArgumentException("먼저 통화 녹음 폴더를 선택하십시오.");
            Uri folder=Uri.parse(uriValue);
            boolean granted=false;
            for(android.content.UriPermission p:getContentResolver().getPersistedUriPermissions()){
                if(p.isReadPermission()&&p.getUri().equals(folder)){
                    granted=true;break;
                }
            }
            if(!granted)
                throw new SecurityException("선택한 폴더의 지속적 읽기 권한이 없습니다.");
            engine=new RecordingFolderPlaybackEngine(this,folder,this);
            onEvent("STARTED","녹음 폴더를 감시합니다. 마이크·기존 스피커 STT는 변경하지 않습니다.");
            engine.start();
        }catch(Throwable e){
            onEvent("FAILED","녹음 폴더 재생 시작 실패: "+e);
            engine=null;
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
        return START_NOT_STICKY;
    }
    @Override public void onDestroy(){
        RecordingFolderPlaybackEngine e=engine;engine=null;
        if(e!=null)e.stop();
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent){return null;}
}
