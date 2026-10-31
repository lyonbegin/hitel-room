package app.hitel.screen;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import org.json.JSONObject;
import java.util.ArrayDeque;

public class ScreenAccessibilityService extends AccessibilityService {
 public interface Result { void finish(boolean ok,String error); }
 private static volatile ScreenAccessibilityService instance;
 private final Handler main=new Handler(Looper.getMainLooper());
 public static boolean enabled(){return instance!=null;}
 @Override protected void onServiceConnected(){
  super.onServiceConnected();instance=this;
  ScreenService.state="원격 터치 접근성 권한 연결됨";
 }
 @Override public boolean onUnbind(android.content.Intent i){
  if(instance==this)instance=null;return super.onUnbind(i);
 }
 @Override public void onDestroy(){
  if(instance==this)instance=null;super.onDestroy();
 }
 @Override public void onAccessibilityEvent(AccessibilityEvent event){}
 @Override public void onInterrupt(){}
 public static void execute(JSONObject command,Result done){
  ScreenAccessibilityService svc=instance;
  if(svc==null){done.finish(false,"ACCESSIBILITY_PERMISSION_REQUIRED");return;}
  svc.main.post(()->svc.control(command,done));
 }
 private void control(JSONObject c,Result done){
  String action=c.optString("action","");
  try{
   switch(action){
    case "home":
    case "back":
    case "recents":
    case "notifications":{
     int operation="home".equals(action)?GLOBAL_ACTION_HOME:
      "back".equals(action)?GLOBAL_ACTION_BACK:
      "recents".equals(action)?GLOBAL_ACTION_RECENTS:GLOBAL_ACTION_NOTIFICATIONS;
     boolean ok=performGlobalAction(operation);
     done.finish(ok,ok?"":"GLOBAL_ACTION_FAILED");return;
    }
    case "tap":
    case "longPress":
    case "swipe":{
     DisplayMetrics m=new DisplayMetrics();
     ((WindowManager)getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(m);
     float x=(float)(c.getDouble("x")*Math.max(1,m.widthPixels-1));
     float y=(float)(c.getDouble("y")*Math.max(1,m.heightPixels-1));
     Path p=new Path();p.moveTo(x,y);
     long duration;
     if("swipe".equals(action)){
      p.lineTo((float)(c.getDouble("endX")*Math.max(1,m.widthPixels-1)),
       (float)(c.getDouble("endY")*Math.max(1,m.heightPixels-1)));
      duration=Math.max(90,Math.min(2000,c.optLong("duration",350)));
     }else duration="longPress".equals(action)?800:75;
     GestureDescription.Builder b=new GestureDescription.Builder();
     b.addStroke(new GestureDescription.StrokeDescription(p,0,duration));
     boolean queued=dispatchGesture(b.build(),new GestureResultCallback(){
      @Override public void onCompleted(GestureDescription gesture){done.finish(true,"");}
      @Override public void onCancelled(GestureDescription gesture){done.finish(false,"GESTURE_CANCELLED");}
     },main);
     if(!queued)done.finish(false,"GESTURE_NOT_DISPATCHED");
     return;
    }
    case "text":
    case "erase":
    case "enter":{
     AccessibilityNodeInfo node=focusedInput();
     if(node==null){done.finish(false,"FOCUSED_TEXT_FIELD_REQUIRED");return;}
     if("enter".equals(action)){
      if(Build.VERSION.SDK_INT>=30){
       boolean ok=node.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.getId());
       done.finish(ok,ok?"":"IME_ENTER_FAILED");
      }else done.finish(false,"IME_ENTER_NOT_SUPPORTED");
      return;
     }
     String value;
     if("erase".equals(action)){
      CharSequence before=node.getText();
      value=before==null?"":before.toString();
      if(!value.isEmpty())value=value.substring(0,value.offsetByCodePoints(value.length(),-1));
     }else value=c.optString("text","");
     Bundle args=new Bundle();
     args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,value);
     boolean ok=node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,args);
     done.finish(ok,ok?"":"TEXT_SET_FAILED");return;
    }
    default:done.finish(false,"UNSUPPORTED_ACTION");
   }
  }catch(Exception e){done.finish(false,"CONTROL_EXCEPTION_"+e.getClass().getSimpleName());}
 }
 private AccessibilityNodeInfo focusedInput(){
  AccessibilityNodeInfo root=getRootInActiveWindow();
  if(root==null)return null;
  AccessibilityNodeInfo focused=root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
  if(focused!=null && focused.isEditable())return focused;
  ArrayDeque<AccessibilityNodeInfo> q=new ArrayDeque<>();q.add(root);
  int checked=0;
  while(!q.isEmpty()&&checked++<120){
   AccessibilityNodeInfo n=q.removeFirst();
   if(n.isFocused()&&n.isEditable())return n;
   for(int i=0;i<n.getChildCount();i++){
    AccessibilityNodeInfo child=n.getChild(i);
    if(child!=null)q.add(child);
   }
  }
  return null;
 }
}
