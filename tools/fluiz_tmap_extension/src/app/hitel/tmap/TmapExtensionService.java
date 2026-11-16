package app.hitel.tmap;

import android.accessibilityservice.AccessibilityService;
import android.content.*;
import android.os.*;
import android.util.Log;
import android.view.accessibility.*;
import java.util.ArrayDeque;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Explicit-user-request, TMAP-only automation; never calls vendor private APIs. */
public final class TmapExtensionService extends AccessibilityService {
    private static final String TMAP="com.skt.tmap.ku";
    private static volatile TmapExtensionService instance;
    private static final AtomicBoolean busy=new AtomicBoolean();
    private static final ExecutorService worker=Executors.newSingleThreadExecutor();
    public static boolean isReady(){return instance!=null;}
    public static void search(Context ctx,String destination){
        TmapExtensionService s=instance;
        if(s==null){TmapUiExtensionProvider.notice(ctx,"티맵 접근성 서비스를 켜 주십시오.");return;}
        if(!busy.compareAndSet(false,true)){
            TmapUiExtensionProvider.notice(ctx,"티맵 검색이 이미 진행 중입니다.");return;
        }
        worker.execute(()->{
            try{TmapUiExtensionProvider.notice(ctx,s.runSearch(destination));}
            catch(Exception e){
                Log.e("HITEL_TMAP_ADDON","SEARCH_FAILED",e);
                TmapUiExtensionProvider.notice(ctx,"검색 실패: "+e.getClass().getSimpleName());
            }finally{busy.set(false);}
        });
    }
    private String runSearch(String destination){
        if(destination.length()<1||destination.length()>120)return "목적지가 올바르지 않습니다.";
        Intent launch=getPackageManager().getLaunchIntentForPackage(TMAP);
        if(launch==null)return "티맵이 설치되지 않았거나 표시할 수 없습니다.";
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);startActivity(launch);
        if(!waitTmap(6000))return "티맵 화면을 확인하지 못했습니다.";
        AccessibilityNodeInfo root=getRootInActiveWindow();
        AccessibilityNodeInfo edit=find(root,true,null);
        if(edit==null){
            AccessibilityNodeInfo trigger=find(root,false,"검색");
            if(trigger!=null&&click(trigger)){
                SystemClock.sleep(450);
                root=getRootInActiveWindow();edit=find(root,true,null);
            }
        }
        if(edit==null)return "티맵 검색창을 확인하지 못했습니다. 화면별 보완이 필요합니다.";
        if(edit.isPassword())return "보호된 입력창은 조작하지 않습니다.";
        Bundle b=new Bundle();b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,destination);
        if(!edit.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,b))
            return "티맵 목적지 입력이 거부되었습니다.";
        SystemClock.sleep(250);
        root=getRootInActiveWindow();
        if(root==null||!TMAP.equals(str(root.getPackageName())))return "입력 도중 티맵 화면이 변경되었습니다.";
        AccessibilityNodeInfo submit=find(root,false,"검색");
        if(submit==null||!click(submit))
            return "목적지를 입력했습니다. 검색 버튼을 직접 확인해 주십시오.";
        SystemClock.sleep(450);
        root=getRootInActiveWindow();
        if(root==null||!TMAP.equals(str(root.getPackageName())))
            return "검색 후 앱 화면 검증 실패";
        return "티맵에 검색 명령을 전달했습니다. 결과와 길안내를 확인해 주십시오.";
    }
    private boolean waitTmap(long limit){
        long end=SystemClock.elapsedRealtime()+limit;
        while(SystemClock.elapsedRealtime()<end){
            AccessibilityNodeInfo root=getRootInActiveWindow();
            if(root!=null&&TMAP.equals(str(root.getPackageName())))return true;
            SystemClock.sleep(180);
        }
        return false;
    }
    private static String str(CharSequence s){return s==null?"":s.toString();}
    private static AccessibilityNodeInfo find(AccessibilityNodeInfo root,boolean edit,String label){
        if(root==null||!TMAP.equals(str(root.getPackageName())))return null;
        ArrayDeque<AccessibilityNodeInfo> q=new ArrayDeque<>();q.add(root);
        int count=0;
        while(!q.isEmpty()&&count++<650){
            AccessibilityNodeInfo n=q.removeFirst();
            if(!n.isPassword()){
                if(edit&&n.isEditable())return n;
                if(!edit&&(label.equals(str(n.getText()))||label.equals(str(n.getContentDescription()))))return n;
            }
            for(int i=0;i<n.getChildCount();i++){
                AccessibilityNodeInfo c=n.getChild(i);if(c!=null)q.add(c);
            }
        }
        return null;
    }
    private static boolean click(AccessibilityNodeInfo n){
        for(int i=0;i<6&&n!=null;i++,n=n.getParent())
            if(n.isClickable())return n.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        return false;
    }
    @Override protected void onServiceConnected(){super.onServiceConnected();instance=this;Log.i("HITEL_TMAP_ADDON","ACCESSIBILITY_READY");}
    @Override public void onAccessibilityEvent(AccessibilityEvent e){}
    @Override public void onInterrupt(){}
    @Override public void onDestroy(){if(instance==this)instance=null;super.onDestroy();}
}
