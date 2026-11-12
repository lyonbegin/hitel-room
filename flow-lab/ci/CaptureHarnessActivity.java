package app.hitel.samsungprobe;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Emulator-only UI harness for the EXACT production capture service.
 * Android's native consent UI is shown; this class never bypasses consent.
 * This source is added only in the experimental emulator build, NOT V28 APK.
 */
public final class CaptureHarnessActivity extends Activity {
    private static final int REQUEST_PROJECTION=4521;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private String testCase="local-file";
    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        testCase=getIntent().getStringExtra("testCase");
        if(testCase==null)testCase="local-file";
        TextView instructions=new TextView(this);
        instructions.setPadding(24,32,24,24);
        instructions.setTextSize(22);
        instructions.setText("HITEL14 V28 • Playback STT comparison test\n"+
            "Test: "+testCase+"\n"+
            "Android's native MediaProjection consent is required.\n"+
            "Selecting Entire screen permits observing playback from this app or YouTube.\n"+
            "This is an emulator-only test driver.");
        LinearLayout layout=new LinearLayout(this);
        layout.addView(instructions);
        setContentView(layout);
        Log.i("HitelCaptureHarness","HARNESS_OPEN testCase="+testCase);
        SpeakerCaptureLog.append(this,"HARNESS_OPEN","testCase="+testCase);
        handler.postDelayed(()->{
            MediaProjectionManager manager=(MediaProjectionManager)
                getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if(manager==null){
                Log.e("HitelCaptureHarness","NO_PROJECTION_MANAGER");
                return;
            }
            Log.i("HitelCaptureHarness","NATIVE_CONSENT_REQUEST testCase="+testCase);
            startActivityForResult(manager.createScreenCaptureIntent(),REQUEST_PROJECTION);
        },700);
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request!=REQUEST_PROJECTION)return;
        if(result!=RESULT_OK||data==null){
            Log.e("HitelCaptureHarness","NATIVE_CONSENT_DENIED testCase="+testCase);
            SpeakerCaptureLog.append(this,"HARNESS_DENIED","testCase="+testCase);
            return;
        }
        Log.i("HitelCaptureHarness","NATIVE_CONSENT_APPROVED testCase="+testCase);
        SpeakerCaptureLog.append(this,"HARNESS_APPROVED","testCase="+testCase);
        Intent i=new Intent(this,SpeakerPlaybackCaptureService.class);
        i.setAction(SpeakerPlaybackCaptureService.START);
        i.putExtra(SpeakerPlaybackCaptureService.KEY_RESULT,result);
        i.putExtra(SpeakerPlaybackCaptureService.KEY_DATA,data);
        startForegroundService(i);
        Log.i("HitelCaptureHarness","REAL_CAPTURE_SERVICE_START_SENT testCase="+testCase);
    }
}
