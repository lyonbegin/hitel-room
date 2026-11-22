package com.lguplus.callrecorder.hitelqa;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Application;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.Toast;

/** Inside the original recorder companion, separate from IXIO main-app logs. */
public final class RecorderLogUi implements Application.ActivityLifecycleCallbacks {
    private static final String BUTTON_TAG="HITEL_RECORDER_LOG_UI";
    private static boolean installed;
    private RecorderLogUi(){}
    public static synchronized void install(Application app) {
        if(installed || app==null)return;
        installed=true;
        RecorderLog.initialize(app);
        app.registerActivityLifecycleCallbacks(new RecorderLogUi());
        RecorderLog.mark("UI_RECORDER_LOG_BUTTON_REGISTERED");
    }
    @Override public void onActivityCreated(Activity a,Bundle b){}
    @Override public void onActivityStarted(Activity a){}
    @Override public void onActivityPaused(Activity a){}
    @Override public void onActivityStopped(Activity a){}
    @Override public void onActivitySaveInstanceState(Activity a,Bundle b){}
    @Override public void onActivityDestroyed(Activity a){}
    @Override public void onActivityResumed(Activity a){
        try {
            a.getWindow().getDecorView().post(() -> attach(a));
        } catch(Throwable t) { RecorderLog.mark("UI_RECORDER_LOG_POST_FAILED "+t.getClass().getSimpleName()); }
    }
    private static void attach(Activity a){
        try{
            if(a.isFinishing() || a.isDestroyed())return;
            View view=a.findViewById(android.R.id.content);
            if(!(view instanceof FrameLayout))view=a.getWindow().getDecorView();
            if(!(view instanceof FrameLayout)){RecorderLog.mark("UI_RECORDER_LOG_ROOT_UNSUPPORTED "+view.getClass().getSimpleName());return;}
            FrameLayout root=(FrameLayout)view;
            if(root.findViewWithTag(BUTTON_TAG)!=null)return;
            Button btn=new Button(a);
            btn.setText("녹음 로그");btn.setTextSize(12);btn.setAllCaps(false);
            btn.setTag(BUTTON_TAG);
            FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.TOP|Gravity.RIGHT);
            lp.topMargin=(int)(70*a.getResources().getDisplayMetrics().density);
            lp.rightMargin=(int)(8*a.getResources().getDisplayMetrics().density);
            root.addView(btn,lp);
            btn.bringToFront();
            btn.setElevation(100f);
            btn.setOnClickListener(v->show(a));
            RecorderLog.mark("UI_RECORDER_LOG_BUTTON_ATTACHED "+a.getClass().getSimpleName());
        }catch(Throwable t){RecorderLog.mark("UI_RECORDER_LOG_BUTTON_FAILED "+t.getClass().getSimpleName());}
    }
    private static void show(Activity a){
        try{
            String text=RecorderLog.snapshot();
            String last=text.length()>3500?text.substring(text.length()-3500):text;
            new AlertDialog.Builder(a)
                .setTitle("IXIO 녹음 앱 내부 로그")
                .setMessage("통화 전 로그 지우기, 통화 후 로그 복사.\n"
                   +"전화번호, 토큰, 통화 음성은 저장하지 않습니다.\n\n"+last)
                .setNegativeButton("닫기",(d,w)->{})
                .setNeutralButton("로그 지우기",(d,w)->{
                    boolean ok=RecorderLog.clear();
                    RecorderLog.mark("UI_RECORDER_LOG_CLEAR_RESULT "+ok);
                    Toast.makeText(a,ok?"녹음 앱 로그 삭제 완료":"로그 삭제 실패",Toast.LENGTH_SHORT).show();
                })
                .setPositiveButton("로그 복사",(d,w)->{
                    ClipboardManager cb=(ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE);
                    if(cb!=null){
                        cb.setPrimaryClip(ClipData.newPlainText("IXIO 녹음 앱 내부 로그",RecorderLog.copy()));
                        RecorderLog.mark("UI_RECORDER_LOG_COPY_COMPLETED");
                        Toast.makeText(a,"녹음 앱 로그 복사 완료",Toast.LENGTH_LONG).show();
                    }
                })
                .show();
            RecorderLog.mark("UI_RECORDER_LOG_DIALOG_OPENED");
        }catch(Throwable t){RecorderLog.mark("UI_RECORDER_LOG_DIALOG_FAILED "+t.getClass().getSimpleName());}
    }
}
