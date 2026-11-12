package app.hitel.samsungprobe;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.pm.ApplicationInfo;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

/**
 * Additional MediaProjection foreground service ONLY; never starts/stops the
 * original KoreanSherpaStt microphone or original LabStore W03 session.
 */
public final class SpeakerPlaybackCaptureService extends Service
    implements SpeakerPlaybackStt.Listener {
    public static final String START="app.hitel.callflowlab.v14.SPEAKER_START";
    public static final String STOP="app.hitel.callflowlab.v14.SPEAKER_STOP";
    public static final String UPDATE="app.hitel.callflowlab.v14.SPEAKER_UPDATE";
    public static final String KEY_RESULT="result";
    public static final String KEY_DATA="data";
    public static final String KEY_KIND="kind";
    public static final String KEY_TEXT="text";
    public static final String KEY_TARGET_UID="target_uid";
    public static final String KEY_TARGET_PACKAGE="target_package";
    public static final String KEY_TARGET_LABEL="target_label";
    private static final String CHANNEL="hitel-v14-speaker-capture";
    private static final int NOTIFY_ID=1415;
    private final Handler main=new Handler(Looper.getMainLooper());
    private SpeakerPlaybackStt speaker;
    private MediaProjection projection;
    private boolean destroying=false;

    @Override public void onCreate(){
        super.onCreate();
        ((NotificationManager)getSystemService(Context.NOTIFICATION_SERVICE))
            .createNotificationChannel(new NotificationChannel(
                CHANNEL,"HITEL 출력음 STT",NotificationManager.IMPORTANCE_LOW));
    }
    private Notification notification(){
        PendingIntent open=PendingIntent.getActivity(this,7,
            new Intent(this,W03ConsoleActivity.class),
            PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this,CHANNEL)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("HITEL14 · 출력음 STT")
            .setContentText("허용된 미디어 출력음만 캡처 중 · 삼성 문자통화 비사용")
            .setContentIntent(open)
            .setOngoing(true).build();
    }
    private void emit(String kind,String text){
        Intent i=new Intent(UPDATE);
        i.setPackage(getPackageName());
        i.putExtra(KEY_KIND,kind);
        i.putExtra(KEY_TEXT,text);
        // Store first, before broadcasts: W03 may be backgrounded or already
        // exported, and LabStore only covers a running W03 session.
        SpeakerCaptureLog.append(this,"SPEAKER_"+kind,text);
        sendBroadcast(i);
        try{
            if("FINAL".equals(kind))LabStore.log("SPEAKER_STT_FINAL",text);
            else if("STATUS".equals(kind))LabStore.log("SPEAKER_STT_STATUS",text);
        }catch(Throwable error){
            SpeakerCaptureLog.append(this,"W03_LOG_UNAVAILABLE",String.valueOf(error));
        }
    }
    @Override public void onStatus(String message){
        emit("STATUS",message);
        if(message.startsWith("출력음 STT 세션 종료")||
           message.startsWith("출력음 STT 종료")){
            main.post(()->{if(!destroying)stopCapture(true);});
        }
    }
    @Override public void onPartial(String text){emit("PARTIAL",text);}
    @Override public void onFinal(String text){emit("FINAL",text);}

    private void releaseProjection(){
        MediaProjection p=projection;
        projection=null;
        if(p!=null)try{p.stop();}catch(Throwable ignored){}
    }
    private void stopCapture(boolean stopService){
        SpeakerPlaybackStt s=speaker;speaker=null;
        if(s!=null)s.stop();
        releaseProjection();
        if(stopService&&!destroying){
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
    }
    @Override public int onStartCommand(Intent command,int flags,int startId){
        if(command==null||command.getAction()==null){
            stopSelf();
            return START_NOT_STICKY;
        }
        if(STOP.equals(command.getAction())){
            emit("STATUS","사용자 요청: 출력음 STT 중지 (원본 마이크 STT는 유지)");
            stopCapture(true);
            return START_NOT_STICKY;
        }
        if(!START.equals(command.getAction()))return START_NOT_STICKY;
        SpeakerCaptureLog.append(this,"CAPTURE_REQUEST",
            "MediaProjection single-app or entire-screen selection; source audio "+
            "must be MEDIA/GAME/UNKNOWN produced by selected app. "+
            "This HITEL14 diagnostic app does not play recordings.");
        try{
            startForeground(NOTIFY_ID,notification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
            if(speaker!=null&&speaker.isRunning()){
                emit("STATUS","출력음 STT가 이미 실행 중입니다.");
                return START_NOT_STICKY;
            }
            int result=command.getIntExtra(KEY_RESULT,Activity.RESULT_CANCELED);
            Intent captureData=command.getParcelableExtra(KEY_DATA);
            if(result!=Activity.RESULT_OK||captureData==null)
                throw new IllegalArgumentException("사용자 MediaProjection 동의가 필요합니다.");
            MediaProjectionManager manager=
                (MediaProjectionManager)getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if(manager==null)throw new IllegalStateException("MediaProjectionManager 없음");
            int uid=command.getIntExtra(KEY_TARGET_UID,-1);
            String pkg=command.getStringExtra(KEY_TARGET_PACKAGE);
            String label=command.getStringExtra(KEY_TARGET_LABEL);
            if(pkg==null)pkg="";
            if(label==null||label.isEmpty())label="전체 앱";
            if(!pkg.isEmpty()){
                // Resolve the UID fresh at START: a stored UID must never
                // be used if Android assigned a new UID after app reinstall.
                ApplicationInfo appInfo=getPackageManager().getApplicationInfo(pkg,0);
                uid=appInfo.uid;
                if(uid<0)throw new IllegalStateException("선택 앱 UID를 확인할 수 없습니다.");
            }else{
                uid=-1;
                label="전체 앱";
            }
            final int selectedUid=uid;
            final String selectedLabel=label;
            final String selectedPkg=pkg;
            SpeakerCaptureLog.append(this,"CAPTURE_SELECTED_TARGET",
                "package="+selectedPkg+" uid="+selectedUid+" label="+selectedLabel+
                " (UI selection does not launch target app)");
            projection=manager.getMediaProjection(result,captureData);
            if(projection==null)throw new IllegalStateException("MediaProjection null");
            projection.registerCallback(new MediaProjection.Callback(){
                @Override public void onStop(){
                    main.post(()->{
                        if(destroying)return;
                        emit("STATUS","Android에서 출력 캡처를 종료했습니다.");
                        stopCapture(true);
                    });
                }
            },main);
            speaker=new SpeakerPlaybackStt(this,projection,
                selectedUid,selectedLabel,this);
            emit("STATUS","선택된 출력음 캡처 대상: "+selectedLabel+
                " · UID="+(selectedUid<0?"전체":selectedUid)+
                " · 원본 마이크 STT는 변경하지 않음"+
                (selectedPkg.toLowerCase(java.util.Locale.US).contains("dialer") ||
                 selectedPkg.toLowerCase(java.util.Locale.US).contains("incallui") ||
                 selectedPkg.equals("com.android.phone")
                    ?" · 전화 통화 수신음은 스피커폰에서도 Android Playback Capture 대상 아님"
                    :""));
            speaker.start();
        }catch(Throwable error){
            emit("STATUS","출력음 STT 시작 실패: "+error.toString());
            stopCapture(true);
        }
        return START_NOT_STICKY;
    }
    @Override public void onDestroy(){
        destroying=true;
        stopCapture(false);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent){return null;}
}
