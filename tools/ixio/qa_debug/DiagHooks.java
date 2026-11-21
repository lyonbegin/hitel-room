package com.lguplus.aicallagent.hitelqa;

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

/**
 * Floating in-app diagnostics button; no manifest/overlay permission required.
 * Attaches to each original IXIO Activity without altering its call/recorder UI.
 */
public final class DiagHooks implements Application.ActivityLifecycleCallbacks {
    private static final String BUTTON_TAG = "HITEL_IXIO_QA_LOG_BUTTON";
    private static boolean registered;

    private DiagHooks() {}

    public static synchronized void install(Application app) {
        if (registered || app == null) return;
        registered = true;
        DiagLog.initialize(app);
        app.registerActivityLifecycleCallbacks(new DiagHooks());
        DiagLog.event("UI", "LOG_BUTTON_LIFECYCLE_REGISTERED");
    }

    private static int dp(Activity a, float value) {
        return (int) (a.getResources().getDisplayMetrics().density * value + 0.5f);
    }

    @Override public void onActivityCreated(Activity a, Bundle b) {}
    @Override public void onActivityStarted(Activity a) {}
    @Override public void onActivityPaused(Activity a) {}
    @Override public void onActivityStopped(Activity a) {}
    @Override public void onActivitySaveInstanceState(Activity a, Bundle b) {}
    @Override public void onActivityDestroyed(Activity a) {}

    @Override public void onActivityResumed(Activity a) {
        try {
            View view = a.findViewById(android.R.id.content);
            if (!(view instanceof FrameLayout)) return;
            FrameLayout content = (FrameLayout)view;
            if (content.findViewWithTag(BUTTON_TAG) != null) return;
            Button logButton = new Button(a);
            logButton.setText("로그");
            logButton.setContentDescription("HITEL 진단 로그 열기");
            logButton.setTextSize(13f);
            logButton.setAllCaps(false);
            logButton.setTag(BUTTON_TAG);
            logButton.setElevation(dp(a, 9));
            logButton.setMinWidth(dp(a, 54));
            logButton.setMinimumHeight(dp(a, 42));
            FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    Gravity.TOP | Gravity.RIGHT);
            layout.topMargin = dp(a, 64);
            layout.rightMargin = dp(a, 8);
            content.addView(logButton, layout);
            logButton.setOnClickListener(v -> show(a));
            DiagLog.event("UI", "LOG_BUTTON_ATTACHED " + a.getClass().getSimpleName());
        } catch (Throwable t) {
            // Diagnostics must NEVER prevent calls or app launch.
            DiagLog.event("UI", "LOG_BUTTON_ATTACH_FAILED " + t.getClass().getSimpleName());
        }
    }

    private static void show(Activity a) {
        try {
            String text = DiagLog.snapshot();
            String preview = text.length() > 4300
                    ? "…최근 기록…\n" + text.substring(text.length() - 4300) : text;
            new AlertDialog.Builder(a)
                .setTitle("IXIO 진단 로그")
                .setMessage("시험 전 [로그 지우기], 시험 후 [로그 복사]를 누르시면 됩니다.\n"
                         + "계정·토큰·전화번호·통화내용은 수집하지 않습니다.\n\n" + preview)
                .setNegativeButton("닫기", (d, which) -> { })
                .setNeutralButton("로그 지우기", (d, which) -> {
                    boolean cleared = DiagLog.clear();
                    Toast.makeText(a, cleared ? "로그를 지웠습니다." : "로그 삭제에 실패했습니다.",
                            Toast.LENGTH_SHORT).show();
                    // Don't add a row after delete; next action is a clean trace.
                })
                .setPositiveButton("로그 복사", (d, which) -> {
                    String copy = DiagLog.copySnapshot();
                    ClipboardManager cb = (ClipboardManager)
                            a.getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cb != null) {
                        cb.setPrimaryClip(ClipData.newPlainText("IXIO 진단 로그", copy));
                        Toast.makeText(a, "진단 로그를 복사했습니다. 채팅창에 붙여넣으십시오.",
                                Toast.LENGTH_LONG).show();
                        DiagLog.event("UI", "LOG_COPIED_TO_CLIPBOARD");
                    }
                })
                .show();
            DiagLog.event("UI", "LOG_DIALOG_OPENED");
        } catch (Throwable t) {
            DiagLog.event("UI", "LOG_DIALOG_FAILED " + t.getClass().getSimpleName());
        }
    }
}
