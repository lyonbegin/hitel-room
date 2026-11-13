package app.hitel.samsungprobe;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.projection.MediaProjectionManager;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.TextView;
import java.io.File;

/** Isolated Android CI ONLY: real MediaPlayer(M4A) -> system MediaProjection
 * -> AudioPlaybackCapture AudioRecord -> original SpeakerPlaybackStt (Sherpa).
 * Uses publicly available Korean control WAV encoded as M4A, NOT user call data.
 */
public final class M4aPlaybackCaptureTestActivity extends Activity {
    private static final String TAG="HITEL-M4A-TEST";
    private static final int CONSENT=993;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private TextView status;
    private boolean started=false;
    private long startMs;
    private final BroadcastReceiver receiver=new BroadcastReceiver(){
        @Override public void onReceive(Context context,Intent i){
            if(!SpeakerPlaybackCaptureService.UPDATE.equals(i.getAction()))return;
            String kind=i.getStringExtra(SpeakerPlaybackCaptureService.KEY_KIND);
            String detail=i.getStringExtra(SpeakerPlaybackCaptureService.KEY_TEXT);
            Log.i(TAG,"B_"+kind+" "+detail);
            status.setText("B_"+kind+" "+detail);
            if("STATUS".equals(kind)&&detail!=null &&
                    detail.contains("미디어/게임 출력음 캡처 시작")&&!started){
                started=true;
                handler.postDelayed(()->playFixture(),1200);
            }
        }
    };
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);
        status=new TextView(this);
        status.setTextSize(18);
        status.setText("M4A MediaProjection AudioRecord Sherpa test: preparing");
        setContentView(status);
        IntentFilter filter=new IntentFilter(SpeakerPlaybackCaptureService.UPDATE);
        if(Build.VERSION.SDK_INT>=33)registerReceiver(receiver,filter,Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver,filter);
        MediaProjectionManager mgr=(MediaProjectionManager)getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if(mgr==null){Log.e(TAG,"NO_MEDIA_PROJECTION_MANAGER");return;}
        handler.postDelayed(()->{
            Log.i(TAG,"CONSENT_REQUEST_REAL_ANDROID_MEDIA_PROJECTION");
            startActivityForResult(mgr.createScreenCaptureIntent(),CONSENT);
        },750);
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request!=CONSENT)return;
        Log.i(TAG,"CONSENT_RETURN result="+result+" data="+(data!=null));
        if(result!=RESULT_OK||data==null){Log.e(TAG,"CONSENT_NOT_GRANTED");return;}
        Intent service=new Intent(this,SpeakerPlaybackCaptureService.class);
        service.setAction(SpeakerPlaybackCaptureService.START);
        service.putExtra(SpeakerPlaybackCaptureService.KEY_RESULT,result);
        service.putExtra(SpeakerPlaybackCaptureService.KEY_DATA,data);
        startForegroundService(service);
    }
    private void playFixture(){
        try{
            File file=new File(getFilesDir(),"public-korean-media.m4a");
            if(!file.isFile())throw new IllegalStateException("NO_PUBLIC_M4A "+file);
            player=new MediaPlayer();
            AudioAttributes attrs=new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .setAllowedCapturePolicy(AudioAttributes.ALLOW_CAPTURE_BY_ALL)
                .build();
            player.setAudioAttributes(attrs);
            player.setDataSource(file.getAbsolutePath());
            player.setOnCompletionListener(mp->Log.i(TAG,"MEDIA_PLAYER_COMPLETED elapsedMs="+
                (android.os.SystemClock.elapsedRealtime()-startMs)));
            player.prepare();
            startMs=android.os.SystemClock.elapsedRealtime();
            Log.i(TAG,"MEDIA_PLAYER_STARTED source=public-0.wav-to-m4a"+
                " durationMs="+player.getDuration()+" usage=USAGE_MEDIA capture=ALLOW_CAPTURE_BY_ALL");
            player.start();
        }catch(Exception ex){Log.e(TAG,"MEDIA_PLAYER_FAILED",ex);}
    }
    @Override protected void onDestroy(){
        try{unregisterReceiver(receiver);}catch(Exception ignored){}
        try{if(player!=null)player.release();}catch(Exception ignored){}
        super.onDestroy();
    }
}
