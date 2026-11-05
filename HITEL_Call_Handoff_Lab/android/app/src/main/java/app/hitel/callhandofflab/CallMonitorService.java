package app.hitel.callhandofflab;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.os.*;
import android.provider.Settings;
import android.telephony.*;
import android.util.Log;
import android.view.*;
import android.widget.*;

/** Only call state observation and user-approved visual overlay. */
public final class CallMonitorService extends Service {
    public static final String START="app.hitel.callhandofflab.START";
    private static final String TAG="HITEL_HANDOFF_LAB",CHANNEL="hitel-handoff";
    private final CallHandoffStateMachine state=new CallHandoffStateMachine();
    private TelephonyManager telephony;
    private PhoneStateListener oldListener;
    private TelephonyCallback newListener;
    private WindowManager manager;
    private View overlay;
    private CallHandoffStateMachine.Display shown=CallHandoffStateMachine.Display.HIDDEN;
    @Override public void onCreate(){
        super.onCreate();
        manager=(WindowManager)getSystemService(WINDOW_SERVICE);
        NotificationManager notifications=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        notifications.createNotificationChannel(new NotificationChannel(CHANNEL,"HITEL 통화 관찰",NotificationManager.IMPORTANCE_LOW));
    }
    @Override public int onStartCommand(Intent intent,int flags,int id) {
        if(intent!=null && "app.hitel.callhandofflab.STOP".equals(intent.getAction())) {
            stopSelf();return START_NOT_STICKY;
        }
        Notification notification=new Notification.Builder(this,CHANNEL)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle("HITEL · 전화 상태 관찰")
            .setContentText("기본 전화 앱 유지 · 통화 실제 연결은 미검증")
            .setContentIntent(PendingIntent.getActivity(this,1,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT))
            .setOngoing(true).build();
        try{
            if(Build.VERSION.SDK_INT>=34)startForeground(1,notification,android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(1,notification);
        }catch(Exception e){Log.e(TAG,"FGS_DENIED",e);stopSelf();return START_NOT_STICKY;}
        if(telephony==null){
            if(Build.VERSION.SDK_INT>=23 && checkSelfPermission(Manifest.permission.READ_PHONE_STATE)!=PackageManager.PERMISSION_GRANTED){
                Log.e(TAG,"PHONE_PERMISSION_MISSING");stopSelf();return START_NOT_STICKY;
            }
            telephony=(TelephonyManager)getSystemService(TELEPHONY_SERVICE);
            if(telephony==null){Log.e(TAG,"NO_TELEPHONY");stopSelf();return START_NOT_STICKY;}
            try{
                if(Build.VERSION.SDK_INT>=31) {
                    ModernListener l=new ModernListener();newListener=l;
                    telephony.registerTelephonyCallback(getMainExecutor(),l);
                } else{
                    oldListener=new PhoneStateListener(){
                        @Override public void onCallStateChanged(int call,String number){onCall(call);}
                    };
                    telephony.listen(oldListener,PhoneStateListener.LISTEN_CALL_STATE);
                }
                Log.i(TAG,"MONITOR_STARTED; DEFAULT_DIALER_UNCHANGED");
            }catch(Exception e){Log.e(TAG,"LISTENER_FAILED",e);stopSelf();}
        }
        return START_NOT_STICKY;
    }
    @android.annotation.TargetApi(31)
    private final class ModernListener extends TelephonyCallback implements TelephonyCallback.CallStateListener{
        @Override public void onCallStateChanged(int call){onCall(call);}
    }
    private void onCall(int call){
        Log.i(TAG,"CALL_STATE="+call+" OFFHOOK_NOT_PROOF_OF_CONNECTION");
        render(state.stateChanged(call));
    }
    private void render(CallHandoffStateMachine.Display display){
        if(display==shown && overlay!=null)return;
        clear();shown=display;
        if(display==CallHandoffStateMachine.Display.HIDDEN)return;
        if(!Settings.canDrawOverlays(this)){Log.w(TAG,"OVERLAY_NOT_ALLOWED");return;}
        try{
            boolean full=display==CallHandoffStateMachine.Display.CONFIRMED_BY_USER;
            LinearLayout panel=new LinearLayout(this);
            panel.setOrientation(LinearLayout.VERTICAL);
            panel.setPadding(24,24,24,24);
            panel.setBackgroundColor(Color.WHITE);
            panel.addView(text(full?"HITEL · 통화 중 전면 표시 시험":"HITEL · 연결 상태 확인",20));
            panel.addView(text(full
                ?"사용자가 상대방 연결을 확인했습니다.\n삼성 기본 전화는 계속 유지됩니다.\n음성 자막·통역·음성 주입 기능은 아직 없습니다."
                :"OFFHOOK 관측. 상대방과의 연결은 아직 확인되지 않았습니다.\n발신 중이어도 OFFHOOK일 수 있습니다.",15));
            if(!full)panel.addView(button("실제로 연결되었음을 확인",()->render(state.userConfirms())));
            panel.addView(button("HITEL 창 닫기 (전화 유지)",()->render(state.dismiss())));
            WindowManager.LayoutParams p=new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                full?WindowManager.LayoutParams.MATCH_PARENT:WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
            p.gravity=Gravity.TOP;
            manager.addView(panel,p);
            overlay=panel;
            Log.i(TAG,"OVERLAY_ATTACHED="+display+"; REAL_DEVICE_VISIBILITY_NOT_PROVEN");
        }catch(Exception e){Log.e(TAG,"OVERLAY_ADD_FAILED",e);clear();}
    }
    private TextView text(String s,int size){
        TextView t=new TextView(this);t.setText(s);t.setTextColor(Color.BLACK);
        t.setTextSize(size);t.setPadding(10,12,10,12);return t;
    }
    private Button button(String s,Runnable click){
        Button b=new Button(this);b.setAllCaps(false);b.setText(s);b.setOnClickListener(v->click.run());return b;
    }
    private void clear(){
        if(overlay!=null){try{manager.removeView(overlay);}catch(Exception e){Log.w(TAG,"OVERLAY_REMOVE_FAILED",e);} overlay=null;}
    }
    @Override public void onDestroy(){
        clear();shown=CallHandoffStateMachine.Display.HIDDEN;
        if(telephony!=null){
            try{
                if(Build.VERSION.SDK_INT>=31 && newListener!=null)telephony.unregisterTelephonyCallback(newListener);
                else if(oldListener!=null)telephony.listen(oldListener,PhoneStateListener.LISTEN_NONE);
            }catch(Exception e){Log.w(TAG,"UNREGISTER_FAILED",e);}
        }
        telephony=null;oldListener=null;newListener=null;
        Log.i(TAG,"MONITOR_STOPPED");
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent i){return null;}
}
