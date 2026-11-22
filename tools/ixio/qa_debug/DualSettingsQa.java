package com.lguplus.aicallagent.hitelqa;
import android.app.Activity;
import android.app.AlertDialog;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;
/** Local UI-only QA fixture. Never writes live setting, grants permissions,
 * invokes repositories, initiates calls, or makes network requests. */
public final class DualSettingsQa {
    private DualSettingsQa() {}
    private static void log(String event) {
        try { DiagLog.event("DUAL_SETTINGS",event); } catch(Throwable ignored) {}
    }
    public static void attach(Activity a) {
        try {
            View v=a.findViewById(android.R.id.content);
            if(v==null)return;
            View button=v.findViewWithTag("HITEL_IXIO_QA_LOG_BUTTON");
            if(button==null)return;
            button.setOnLongClickListener(view->{show(a);return true;});
        } catch(Throwable t){log("QA_ATTACH_ERROR "+t.getClass().getSimpleName());}
    }
    private static void show(Activity a) {
        LinearLayout layout=new LinearLayout(a);
        layout.setOrientation(LinearLayout.VERTICAL);
        int pad=(int)(16*a.getResources().getDisplayMetrics().density);
        layout.setPadding(pad,pad,pad,pad);
        TextView note=new TextView(a);
        note.setText("로컬 모의 상태 전용. 실제 서비스 권한, DB, 녹음 및 AI 엔진에는 영향을 주지 않습니다.");
        layout.addView(note);
        Switch ai=new Switch(a), rec=new Switch(a);
        ai.setText("통화 AI (QA)"); rec.setText("통화 녹음 (QA)");
        ai.setChecked(true);rec.setChecked(true);
        TextView result=new TextView(a);
        Runnable render=()->{
            String av=ai.isChecked()?"ON":"OFF",rv=rec.isChecked()?"ON":"OFF";
            result.setText("통화 AI: "+av+" / 통화 녹음: "+rv);
            log("LOCAL_FIXTURE_RENDER ai="+ai.isChecked()+" recording="+rec.isChecked()+" network=NONE actualServiceState=UNCHANGED");
        };
        ai.setOnCheckedChangeListener((b,checked)->render.run());
        rec.setOnCheckedChangeListener((b,checked)->render.run());
        layout.addView(ai);layout.addView(rec);layout.addView(result);
        render.run();
        new AlertDialog.Builder(a).setTitle("통화 AI / 녹음 상태 QA")
            .setView(layout).setPositiveButton("닫기",null).show();
    }
    public static void point(String label) { log(label); }
    public static void value(String label,int value) {log(label+" value="+value);}
    public static void object(String label,Object value) {
        if(value instanceof String && ("ON".equalsIgnoreCase((String)value)||"OFF".equalsIgnoreCase((String)value))) {
            log(label+" displayed="+value);return;
        }
        try {
            DiagTrace.flowObject("DUAL_SETTINGS "+label,value);
            if(value instanceof Throwable) {
                Throwable t=(Throwable)value;
                int count=0;
                for(StackTraceElement f:t.getStackTrace()) {
                    if(count++>=30)break;
                    log(label+" stack="+f.getClassName()+"."+f.getMethodName()+":"+f.getLineNumber());
                }
            }
        } catch(Throwable ignored){}
    }
}
