package app.hitel.tmaptest;
import android.accessibilityservice.AccessibilityService;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.*;

public final class TmapService extends AccessibilityService {
  static final String TMAP="com.skt.tmap.ku";
  static volatile TmapService instance;
  @Override protected void onServiceConnected(){super.onServiceConnected();instance=this;}
  @Override public void onAccessibilityEvent(AccessibilityEvent e){}
  @Override public void onInterrupt(){}
  @Override public void onDestroy(){instance=null;super.onDestroy();}
  private static String s(CharSequence c){return c==null?"":c.toString();}
  private AccessibilityNodeInfo root(){AccessibilityNodeInfo r=getRootInActiveWindow();return r!=null&&TMAP.equals(s(r.getPackageName()))?r:null;}
  private List<AccessibilityNodeInfo> all(AccessibilityNodeInfo r){
    ArrayList<AccessibilityNodeInfo> a=new ArrayList<>();if(r==null)return a;
    ArrayDeque<AccessibilityNodeInfo> q=new ArrayDeque<>();q.add(r);
    while(!q.isEmpty()&&a.size()<450){AccessibilityNodeInfo n=q.removeFirst();if(!n.isPassword())a.add(n);
      for(int i=0;i<n.getChildCount();i++){AccessibilityNodeInfo c=n.getChild(i);if(c!=null)q.add(c);}
    }return a;
  }
  private AccessibilityNodeInfo byLabel(AccessibilityNodeInfo r,String... names){
    AccessibilityNodeInfo match=null;
    for(AccessibilityNodeInfo n:all(r))for(String name:names)if(name.equals(s(n.getText()))||name.equals(s(n.getContentDescription()))){
      if(match!=null)return null;match=n;break;
    }return match;
  }
  private AccessibilityNodeInfo input(AccessibilityNodeInfo r){
    AccessibilityNodeInfo match=null;for(AccessibilityNodeInfo n:all(r))if(n.isEditable()){
      if(match!=null)return null;match=n;
    }return match;
  }
  private boolean tap(AccessibilityNodeInfo n){
    for(int i=0;i<7&&n!=null;i++,n=n.getParent())if(n.isClickable())return n.performAction(AccessibilityNodeInfo.ACTION_CLICK);
    return false;
  }
  private AccessibilityNodeInfo after(int ms){SystemClock.sleep(ms);return root();}
  public synchronized String execute(String op,String dest,boolean confirmed){
    if(dest==null||dest.isBlank()||dest.length()>120)return "INVALID_DESTINATION";
    try{
      AccessibilityNodeInfo r=root();if(r==null)return "TMAP_NOT_FOREGROUND";
      if(op.equals("SEARCH")){
        AccessibilityNodeInfo field=input(r);
        if(field==null){AccessibilityNodeInfo search=byLabel(r,"검색","장소 검색","어디로 갈까요?");
          if(search==null||!tap(search))return "SEARCH_ENTRY_NOT_FOUND";
          r=after(650);if(r==null)return "TMAP_SCREEN_CHANGED";field=input(r);
        }
        if(field==null)return "SEARCH_INPUT_NOT_UNIQUE";
        Bundle b=new Bundle();b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,dest);
        if(!field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,b))return "TEXT_INPUT_REJECTED";
        r=after(650);if(r==null)return "TMAP_SCREEN_CHANGED";
        AccessibilityNodeInfo submit=byLabel(r,"검색","Search");
        if(submit==null||!tap(submit))return "SEARCH_SUBMIT_NOT_FOUND";
        r=after(900);if(r==null)return "TMAP_SCREEN_CHANGED";
        return byLabel(r,dest)!=null?"SEARCH_RESULT_VISIBLE":"SEARCH_RESULT_NOT_VERIFIED";
      }
      if(op.equals("ROUTE")){
        AccessibilityNodeInfo place=byLabel(r,dest);if(place==null||!tap(place))return "DESTINATION_NOT_VISIBLE";
        r=after(650);if(r==null)return "TMAP_SCREEN_CHANGED";
        AccessibilityNodeInfo route=byLabel(r,"길찾기","경로 찾기");
        if(route==null||!tap(route))return "ROUTE_BUTTON_NOT_FOUND";
        return "ROUTE_TAP_REQUESTED_NOT_E2E_VERIFIED";
      }
      if(op.equals("NAVIGATE")){
        if(!confirmed)return "USER_CONFIRMATION_REQUIRED";
        if(byLabel(r,dest)==null)return "DESTINATION_NOT_VERIFIED";
        AccessibilityNodeInfo start=byLabel(r,"안내 시작","안내시작");
        if(start==null||!tap(start))return "NAVIGATE_BUTTON_NOT_FOUND";
        return "NAVIGATION_REQUESTED_NOT_E2E_VERIFIED";
      }
      return "UNSUPPORTED_COMMAND";
    }catch(RuntimeException e){return "ANDROID_ACTION_ERROR:"+e.getClass().getSimpleName();}
  }
}