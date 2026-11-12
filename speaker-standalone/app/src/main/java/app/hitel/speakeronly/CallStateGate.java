package app.hitel.speakeronly;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.SystemClock;
import android.telephony.TelephonyManager;
import android.telephony.TelephonyCallback;
import android.telephony.PhoneStateListener;
import android.os.Build;
import java.io.Closeable;
import java.io.IOException;
import java.util.function.BooleanSupplier;

/**
 * Event-driven phone state gate.
 * READ_PHONE_STATE is requested by MainActivity before live-folder monitoring.
 * OFFHOOK means dialing/connected/on hold; an actually growing M4A is the
 * independent second proof that Samsung recording has started.
 * No call number/contacts/call-log permission is requested.
 */
final class CallStateGate implements Closeable {
  interface Listener { void onPhoneState(int state,boolean afterOffhook); }
  private final Context context;
  private final TelephonyManager tm;
  private final TraceJournal log;
  private final Listener listener;
  private final Object lock=new Object();
  private volatile boolean opened;
  private volatile boolean hadOffhook;
  private volatile int state=TelephonyManager.CALL_STATE_IDLE;
  private volatile long callStartedAtMs;
  private TelephonyCallback modernCallback;
  private PhoneStateListener legacyListener;
  private final BroadcastReceiver changes=new BroadcastReceiver(){
    @Override public void onReceive(Context c,Intent i){
      if(i==null||!TelephonyManager.ACTION_PHONE_STATE_CHANGED.equals(i.getAction()))return;
      String value=i.getStringExtra(TelephonyManager.EXTRA_STATE);
      if(TelephonyManager.EXTRA_STATE_OFFHOOK.equals(value))update(TelephonyManager.CALL_STATE_OFFHOOK,"PHONE_STATE_EVENT");
      else if(TelephonyManager.EXTRA_STATE_IDLE.equals(value))update(TelephonyManager.CALL_STATE_IDLE,"PHONE_STATE_EVENT");
      else if(TelephonyManager.EXTRA_STATE_RINGING.equals(value))update(TelephonyManager.CALL_STATE_RINGING,"PHONE_STATE_EVENT");
    }
  };
  CallStateGate(Context context,TraceJournal journal,Listener listener) throws IOException{
    this.context=context.getApplicationContext();
    tm=(TelephonyManager)this.context.getSystemService(Context.TELEPHONY_SERVICE);
    log=journal;this.listener=listener;
    if(tm==null)throw new IOException("전화 상태 서비스를 사용할 수 없습니다.");
    if(this.context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE)!=PackageManager.PERMISSION_GRANTED)
      throw new IOException("통화 감지를 위한 '전화 상태' 권한이 필요합니다.");
    opened=true;
    try{
      // Android 12+: actual telephony callback, not UI polling.
      if(Build.VERSION.SDK_INT>=31){
        final class StateEvents extends TelephonyCallback
            implements TelephonyCallback.CallStateListener {
          @Override public void onCallStateChanged(int next){
            update(next,"TELEPHONY_CALLBACK");
          }
        }
        modernCallback=new StateEvents();
        tm.registerTelephonyCallback(this.context.getMainExecutor(),modernCallback);
      }else{
        legacyListener=new PhoneStateListener(){
          @Override public void onCallStateChanged(int next,String ignored){
            update(next,"PHONE_STATE_LISTENER");
          }
        };
        tm.listen(legacyListener,PhoneStateListener.LISTEN_CALL_STATE);
      }
      // Protected system broadcast: additional fallback for Samsung variants.
      IntentFilter f=new IntentFilter(TelephonyManager.ACTION_PHONE_STATE_CHANGED);
      if(Build.VERSION.SDK_INT>=33)
        this.context.registerReceiver(changes,f,Context.RECEIVER_NOT_EXPORTED);
      else this.context.registerReceiver(changes,f);
      update(tm.getCallState(),"INITIAL_STATE");
    }catch(SecurityException|IllegalArgumentException ex){
      close();throw new IOException("전화 상태 감지 등록 실패",ex);
    }
  }
  private void update(int next,String source){
    int previous;
    boolean had;
    synchronized(lock){
      previous=state;
      if(next==TelephonyManager.CALL_STATE_OFFHOOK){
        if(state!=TelephonyManager.CALL_STATE_OFFHOOK){
          callStartedAtMs=SystemClock.elapsedRealtime();
          hadOffhook=true;
        }
      }
      had=hadOffhook;
      state=next;
      lock.notifyAll();
    }
    if(previous!=next||"INITIAL_STATE".equals(source)){
      log.event("TELEPHONY","PHONE_STATE",
          "previous",previous,"state",next,"offhook",
          next==TelephonyManager.CALL_STATE_OFFHOOK,
          "source",source,"hadOffhook",had);
      if(listener!=null)listener.onPhoneState(next,had);
    }
  }
  boolean isOffhook(){return state==TelephonyManager.CALL_STATE_OFFHOOK;}
  long startedAtMs(){return callStartedAtMs;}
  boolean awaitOffhook(BooleanSupplier stopped) throws InterruptedException{
    while(!stopped.getAsBoolean()&&opened){
      if(isOffhook())return true;
      synchronized(lock){lock.wait(350);}
      // Fallback when a vendor drops the state broadcast; no busy poll.
      try{
        int now=tm.getCallState();
        if(now!=state)update(now,"FALLBACK_QUERY");
      }catch(SecurityException ignored){}
    }
    return false;
  }
  @Override public void close(){
    if(!opened)return;
    opened=false;
    try{context.unregisterReceiver(changes);}catch(IllegalArgumentException ignored){}
    if(Build.VERSION.SDK_INT>=31&&modernCallback!=null){
      try{tm.unregisterTelephonyCallback(modernCallback);}catch(RuntimeException ignored){}
      modernCallback=null;
    }
    if(Build.VERSION.SDK_INT<31&&legacyListener!=null){
      try{tm.listen(legacyListener,PhoneStateListener.LISTEN_NONE);}catch(RuntimeException ignored){}
      legacyListener=null;
    }
    synchronized(lock){lock.notifyAll();}
  }
}
