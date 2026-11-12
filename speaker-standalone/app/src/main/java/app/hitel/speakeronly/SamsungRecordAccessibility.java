package app.hitel.speakeronly;

import android.accessibilityservice.AccessibilityService;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Explicitly opt-in Samsung in-call UI automation.
 *
 * Android has no public API for starting the Samsung Phone recorder.
 * Only the user's enabled AccessibilityService can attempt to press a
 * labelled RECORD-START control on the *visible* system in-call screen.
 * Never click stop-recording or end-call controls. A click is not proof
 * of recording; the growing M4A verifier supplies that proof.
 */
public final class SamsungRecordAccessibility extends AccessibilityService {
  interface Feedback {void onRecordUiEvent(String event);}
  private static volatile SamsungRecordAccessibility connected;
  private static final Handler MAIN=new Handler(Looper.getMainLooper());
  private boolean requested;
  private boolean startTapped;
  private boolean menuTapped;
  private long lastUiActionAt;
  private Feedback feedback;

  static boolean isAvailable(){return connected!=null;}

  static boolean requestRecording(Feedback listener){
    SamsungRecordAccessibility service=connected;
    if(service==null)return false;
    MAIN.post(()->{
      if(connected==service)service.arm(listener);
    });
    return true;
  }

  static void cancelRequest(){
    SamsungRecordAccessibility service=connected;
    if(service!=null)MAIN.post(service::reset);
  }

  private void arm(Feedback listener){
    if(!requested){
      requested=true;startTapped=false;menuTapped=false;
      lastUiActionAt=0;
    }
    feedback=listener;
    inspectCurrentWindow();
  }

  private void reset(){
    requested=false;startTapped=false;menuTapped=false;feedback=null;
  }

  @Override protected void onServiceConnected(){
    super.onServiceConnected();
    connected=this;
  }

  @Override public void onDestroy(){
    if(connected==this)connected=null;
    reset();
    super.onDestroy();
  }

  @Override public void onInterrupt(){}

  @Override public void onAccessibilityEvent(AccessibilityEvent event){
    if(!requested||event==null)return;
    int type=event.getEventType();
    if(type!=AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
       type!=AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
       type!=AccessibilityEvent.TYPE_WINDOWS_CHANGED)return;
    inspectCurrentWindow();
  }

  private static boolean phonePackage(CharSequence name){
    if(name==null)return false;
    String value=name.toString();
    return value.equals("com.samsung.android.incallui") ||
      value.equals("com.samsung.android.dialer") ||
      value.equals("com.samsung.android.app.telephonyui") ||
      value.equals("com.android.incallui");
  }

  private void emit(String event){
    Feedback listener=feedback;
    if(listener!=null)listener.onRecordUiEvent(event);
  }

  private void inspectCurrentWindow(){
    if(!requested)return;
    AccessibilityNodeInfo root=getRootInActiveWindow();
    if(root==null||!phonePackage(root.getPackageName()))return;
    List<AccessibilityNodeInfo> nodes=new ArrayList<>();
    collect(root,nodes,0);
    // Observe UI state, but never claim recording until M4A growth is proved.
    for(AccessibilityNodeInfo n:nodes){
      String label=label(n);
      if(isStopRecordingLabel(label)){
        emit("RECORDING_UI_INDICATES_ACTIVE");
        requested=false;
        return;
      }
    }
    if(startTapped)return;
    long now=SystemClock.elapsedRealtime();
    if(now-lastUiActionAt<700)return;
    for(AccessibilityNodeInfo n:nodes){
      if(isStartRecordingLabel(label(n)) && clickClickable(n)){
        startTapped=true;
        lastUiActionAt=now;
        emit("RECORD_START_BUTTON_TAPPED_NOT_YET_VERIFIED");
        return;
      }
    }
    if(!menuTapped){
      for(AccessibilityNodeInfo n:nodes){
        if(isMoreMenuLabel(label(n)) && clickClickable(n)){
          menuTapped=true;lastUiActionAt=now;
          emit("PHONE_RECORD_MENU_OPENED");
          return;
        }
      }
    }
  }

  private static void collect(AccessibilityNodeInfo node,
                              List<AccessibilityNodeInfo> out,int depth){
    if(node==null||depth>24||out.size()>=500)return;
    if(node.isVisibleToUser())out.add(node);
    for(int i=0;i<node.getChildCount();i++)
      collect(node.getChild(i),out,depth+1);
  }

  private static String label(AccessibilityNodeInfo n){
    String text=n.getText()==null?"":n.getText().toString();
    String desc=n.getContentDescription()==null?"":n.getContentDescription().toString();
    String s=(text.isEmpty()?desc:text).trim().toLowerCase(Locale.ROOT);
    return s.replaceAll("\\s+"," ");
  }

  private static boolean isStopRecordingLabel(String s){
    return s.contains("녹음 중지")||s.contains("녹음중지")||
      s.contains("통화 녹음 중")||s.contains("녹음 중")||
      s.contains("recording in progress")||s.contains("stop recording")||
      s.equals("recording")||s.equals("pause recording");
  }

  private static boolean isStartRecordingLabel(String s){
    return s.equals("녹음")||s.equals("통화 녹음")||
      s.equals("녹음 시작")||s.equals("통화 녹음 시작")||
      s.equals("record")||s.equals("record call")||
      s.equals("start recording")||s.equals("start call recording");
  }

  private static boolean isMoreMenuLabel(String s){
    return s.equals("더보기")||s.equals("더 보기")||
      s.equals("추가 옵션")||s.equals("more options")||
      s.equals("more")||s.equals("메뉴");
  }

  private static boolean clickClickable(AccessibilityNodeInfo node){
    for(AccessibilityNodeInfo current=node;current!=null;current=current.getParent()){
      if(current.isVisibleToUser()&&current.isEnabled()&&current.isClickable())
        return current.performAction(AccessibilityNodeInfo.ACTION_CLICK);
    }
    return false;
  }
}
