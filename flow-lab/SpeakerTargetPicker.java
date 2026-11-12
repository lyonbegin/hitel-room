package app.hitel.samsungprobe;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.function.Consumer;

/**
 * In-app playback CAPTURE target picker; deliberately NEVER launches a target.
 * The Android 14+ system single-app screen-sharing picker auto-opens a chosen
 * app, and doesn't reveal its UID to ordinary third party capture clients.
 * Instead obtain the user's explicitly chosen package/UID and filter native
 * AudioPlaybackCaptureConfiguration with addMatchingUid(uid).
 *
 * A separate, mandatory OS MediaProjection permission still applies.
 */
public final class SpeakerTargetPicker {
    private SpeakerTargetPicker(){}
    private static final String PREF="hitel_output_capture_target";
    private static final String PACKAGE="selected_package";
    private static final String LABEL="selected_label";

    public static final class Target {
        public final String packageName;
        public final String label;
        public final int uid;
        public Target(String pkg,String name,int id){
            packageName=pkg==null?"":pkg;
            label=name==null?"":name;
            uid=id;
        }
        public boolean isAll(){return packageName.isEmpty();}
        public String display(){
            return isAll()?"전체 앱의 캡처 허용된 미디어 소리":
                label+" ("+packageName+" · UID="+uid+")";
        }
        public boolean isPhone(){
            String p=packageName.toLowerCase(Locale.US);
            return p.equals("com.android.phone") ||
                p.equals("com.android.dialer") ||
                p.equals("com.google.android.dialer") ||
                p.equals("com.samsung.android.dialer") ||
                p.equals("com.samsung.android.incallui") ||
                p.contains("incallui");
        }
    }

    public static Target get(Context context){
        SharedPreferences prefs=context.getSharedPreferences(PREF,Context.MODE_PRIVATE);
        String pkg=prefs.getString(PACKAGE,"");
        String label=prefs.getString(LABEL,"");
        if(pkg==null||pkg.isEmpty())
            return new Target("","전체 앱", -1);
        try{
            ApplicationInfo info=context.getPackageManager().getApplicationInfo(pkg,0);
            String actualName=String.valueOf(context.getPackageManager().getApplicationLabel(info));
            return new Target(pkg,actualName,info.uid);
        }catch(Exception e){
            // Keep last user choice visible; do not silently capture ALL apps
            // when the selected package was uninstalled or became invisible.
            return new Target(pkg,label.isEmpty()?pkg:label,-2);
        }
    }

    public static void save(Context context,Target item){
        context.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit()
            .putString(PACKAGE,item.packageName).putString(LABEL,item.label)
            .apply();
    }

    private static ArrayList<Target> available(Context ctx){
        PackageManager pm=ctx.getPackageManager();
        LinkedHashMap<String,Target> apps=new LinkedHashMap<>();
        Intent main=new Intent(Intent.ACTION_MAIN);
        main.addCategory(Intent.CATEGORY_LAUNCHER);
        for(ResolveInfo resolve:pm.queryIntentActivities(main,0)){
            if(resolve.activityInfo==null)continue;
            String pkg=resolve.activityInfo.packageName;
            if(apps.containsKey(pkg))continue;
            try{
                ApplicationInfo ai=pm.getApplicationInfo(pkg,0);
                String title=String.valueOf(pm.getApplicationLabel(ai));
                apps.put(pkg,new Target(pkg,title,ai.uid));
            }catch(Exception ignored){}
        }
        // Dialer and InCallUI packages may have no launcher activity.
        for(String pkg:new String[]{
            "com.samsung.android.dialer",
            "com.samsung.android.incallui",
            "com.google.android.dialer",
            "com.android.dialer",
            "com.android.phone"}){
            if(apps.containsKey(pkg))continue;
            try{
                ApplicationInfo ai=pm.getApplicationInfo(pkg,0);
                apps.put(pkg,new Target(pkg,
                    String.valueOf(pm.getApplicationLabel(ai)),ai.uid));
            }catch(Exception ignored){}
        }
        Target selected=get(ctx);
        if(!selected.isAll() && !apps.containsKey(selected.packageName)){
            // Choice remains on screen if visibility/installation changed;
            // disabled package is reported by the STT service before starting.
            apps.put(selected.packageName,selected);
        }
        ArrayList<Target> sorted=new ArrayList<>(apps.values());
        sorted.sort(Comparator.comparing(t->t.label.toLowerCase(Locale.getDefault())));
        sorted.add(0,new Target("","전체 앱 (UID 필터 없음)",-1));
        return sorted;
    }

    public static void show(Activity activity,Consumer<Target> onSelected){
        ArrayList<Target> options=available(activity);
        int pad=(int)(12*activity.getResources().getDisplayMetrics().density);
        LinearLayout layout=new LinearLayout(activity);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(pad,pad,pad,pad);
        Target current=get(activity);
        TextView currentText=new TextView(activity);
        currentText.setText("현재 선택: "+current.display()+
            "\n목록 선택은 앱을 실행하지 않습니다. 변경 후 출력음 STT 시작을 눌러주세요.");
        currentText.setTextSize(13);
        layout.addView(currentText,new LinearLayout.LayoutParams(-1,-2));
        EditText search=new EditText(activity);
        search.setSingleLine(true);
        search.setHint("앱 이름 또는 패키지 검색");
        layout.addView(search,new LinearLayout.LayoutParams(-1,-2));
        ListView list=new ListView(activity);
        layout.addView(list,new LinearLayout.LayoutParams(-1,0,1));
        ArrayList<Target> visible=new ArrayList<>(options);
        ArrayAdapter<String> adapter=new ArrayAdapter<>(
            activity,android.R.layout.simple_list_item_1,new ArrayList<>());
        list.setAdapter(adapter);
        Runnable update=()->{
            String query=search.getText().toString().toLowerCase(Locale.getDefault()).trim();
            visible.clear();adapter.clear();
            for(Target t:options){
                if(!query.isEmpty() && !t.label.toLowerCase(Locale.getDefault()).contains(query)
                    && !t.packageName.toLowerCase(Locale.US).contains(query))
                    continue;
                visible.add(t);
                String mark=(!current.isAll()&&current.packageName.equals(t.packageName))
                    ||(current.isAll()&&t.isAll())?"✓ ":"";
                adapter.add(mark+t.label+(t.isAll()?"":"\n"+t.packageName));
            }
            adapter.notifyDataSetChanged();
        };
        search.addTextChangedListener(new TextWatcher(){
            @Override public void beforeTextChanged(CharSequence s,int st,int c,int a){}
            @Override public void onTextChanged(CharSequence s,int st,int before,int count){update.run();}
            @Override public void afterTextChanged(Editable e){}
        });
        update.run();
        AlertDialog dialog=new AlertDialog.Builder(activity)
            .setTitle("출력음 캡처 대상 선택·변경")
            .setView(layout)
            .setNegativeButton("취소",null)
            .create();
        list.setOnItemClickListener((parent,view,pos,id)->{
            if(pos<0||pos>=visible.size())return;
            Target choice=visible.get(pos);
            save(activity,choice);
            dialog.dismiss();
            onSelected.accept(choice);
        });
        dialog.setOnShowListener(v->{
            // Half-to-two-thirds height: app list remains scrollable.
            if(dialog.getWindow()!=null)
                dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT,
                    (int)(activity.getResources().getDisplayMetrics().heightPixels*0.70));
        });
        dialog.show();
    }
}
