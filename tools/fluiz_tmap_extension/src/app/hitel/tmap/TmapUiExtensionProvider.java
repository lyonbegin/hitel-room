package app.hitel.tmap;

import android.app.*;
import android.content.*;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.util.Log;
import android.view.*;
import android.widget.*;

public final class TmapUiExtensionProvider extends ContentProvider {
    private static final String TAG="HITEL_TMAP_ADDON";
    private static final String CARD_TAG="HITEL_TMAP_CARD_V1";
    @Override public boolean onCreate() {
        Context c=getContext();
        if(c==null || !(c.getApplicationContext() instanceof Application))return false;
        ((Application)c.getApplicationContext()).registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks(){
            public void onActivityCreated(Activity a,Bundle b){}
            public void onActivityStarted(Activity a){}
            public void onActivityResumed(Activity a){
                if(!"com.fluiz.seoulai.MainActivity".equals(a.getClass().getName()))return;
                a.getWindow().getDecorView().post(()->attach(a));
            }
            public void onActivityPaused(Activity a){}
            public void onActivityStopped(Activity a){}
            public void onActivitySaveInstanceState(Activity a,Bundle b){}
            public void onActivityDestroyed(Activity a){}
        });
        Log.i(TAG,"PROVIDER_REGISTERED");
        return true;
    }
    private static int dp(Context c,int n){return Math.round(n*c.getResources().getDisplayMetrics().density);}
    private static void attach(Activity a) {
        try {
            int id=a.getResources().getIdentifier("marquee_row","id",a.getPackageName());
            View root=id==0?null:a.findViewById(id);
            if(!(root instanceof ViewGroup)){Log.w(TAG,"MARQUEE_ROW_UNAVAILABLE");return;}
            ViewGroup row=(ViewGroup)root;
            for(int i=0;i<row.getChildCount();i++){
                if(CARD_TAG.equals(row.getChildAt(i).getTag()))return;
            }
            TextView b=new TextView(a);
            b.setTag(CARD_TAG);
            b.setText("티맵");
            b.setContentDescription("티맵 목적지 검색");
            b.setTextColor(Color.WHITE);
            b.setTextSize(16);
            b.setGravity(Gravity.CENTER);
            b.setPadding(dp(a,14),dp(a,10),dp(a,14),dp(a,10));
            b.setClickable(true);b.setFocusable(true);
            GradientDrawable bg=new GradientDrawable();
            bg.setColor(Color.rgb(29,95,159));bg.setCornerRadius(dp(a,15));
            b.setBackground(bg);b.setOnClickListener(v->dialog(a));
            if(row instanceof LinearLayout){
                LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-2,-2);
                p.setMargins(dp(a,5),dp(a,2),dp(a,5),dp(a,2));
                row.addView(b,p);
            }else{row.addView(b,new ViewGroup.LayoutParams(-2,-2));}
            Log.i(TAG,"TMAP_CARD_ADDED_TO_ORIGINAL_MAIN_ACTIVITY");
        }catch(RuntimeException e){Log.e(TAG,"TMAP_CARD_ERROR",e);}
    }
    private static void dialog(Activity a){
        EditText field=new EditText(a);
        field.setSingleLine(true);field.setHint("예: 서울역, 경복궁");
        field.setContentDescription("티맵 목적지");
        LinearLayout holder=new LinearLayout(a);holder.setOrientation(1);
        holder.setPadding(dp(a,18),0,dp(a,18),0);holder.addView(field);
        new AlertDialog.Builder(a).setTitle("티맵 목적지 검색")
            .setMessage("검색 명령을 보낸 뒤 길안내 시작은 티맵에서 직접 확인해 주십시오.")
            .setView(holder).setNegativeButton("취소",(d,w)->{})
            .setNeutralButton("접근성 설정",(d,w)->
                a.startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)))
            .setPositiveButton("검색",(d,w)->{
                String dest=field.getText().toString().trim();
                if(dest.isEmpty()||dest.length()>120){notice(a,"목적지는 1~120자로 입력해 주십시오.");return;}
                if(!TmapExtensionService.isReady()){
                    notice(a,"티맵 자동조작 접근성 권한을 먼저 켜 주십시오.");
                    a.startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
                    return;
                }
                TmapExtensionService.search(a,dest);
            }).show();
    }
    static void notice(Context c,String message){
        new Handler(Looper.getMainLooper()).post(()->
            Toast.makeText(c,message,Toast.LENGTH_LONG).show());
    }
    public Cursor query(Uri u,String[] p,String s,String[] a,String o){return null;}
    public String getType(Uri u){return null;}
    public Uri insert(Uri u,ContentValues v){return null;}
    public int delete(Uri u,String s,String[] a){return 0;}
    public int update(Uri u,ContentValues v,String s,String[] a){return 0;}
}
