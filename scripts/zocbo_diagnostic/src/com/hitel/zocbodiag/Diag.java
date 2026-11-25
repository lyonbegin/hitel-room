package com.hitel.zocbodiag;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.Toast;

/** Minimal UI and bridge wiring. No disk, cookie, URL or response trace. */
public final class Diag {
  private static final String TAG = "hitel_zocbo_diag";
  private static volatile Context app;
  static Context applicationContext() { return app; }
  private static int dp(Activity a,int x) {
    return Math.round(x*a.getResources().getDisplayMetrics().density);
  }
  public static void log(String category,String detail) {
    if(category.endsWith("ERROR") || category.contains("EXCEPTION"))
      android.util.Log.w(TAG,category);
  }
  public static void viewerLaunch(Activity a) {}
  public static void viewerPause(Activity a) {}
  public static void viewerDestroy(Activity a) {
    PrivatePapers.onHostDestroyed(a);
  }
  public static void event(String category,String detail) { log(category,detail); }
  public static void bandwidth(int kbps) {}
  public static void bridge() {}
  public static void webViewLink() {}
  public static void gate(boolean enabled) {}
  public static void jsInterface() {}
  public static void url(String url) {}
  public static void cookie(String cookie) {}
  public static void page(WebView w,String currentUrl) {}
  private static boolean webViewInspectorEnabled=false;
  private static synchronized void enableWebViewInspector() {
    if(webViewInspectorEnabled)return;
    try {
      WebView.setWebContentsDebuggingEnabled(true);
      webViewInspectorEnabled=true;
      log("DEVTOOLS_WEBVIEW_DEBUG_ENABLED","chrome://inspect/#devices; enable Android USB debugging");
    }catch(Throwable error){
      log("DEVTOOLS_WEBVIEW_DEBUG_ERROR",error.getClass().getName());
    }
  }
  public static void registerTitleBridge(WebView w) {
    enableWebViewInspector();
    try {
      if(w == null)return;
      app=w.getContext().getApplicationContext();
      w.addJavascriptInterface(new NativePdfTitleBridge(w),"hitelPdfTitleLink");
      log("READING_TITLE_BRIDGE_REGISTERED","WebView bridge attached before load");
    } catch(Throwable t) {
      log("READING_TITLE_BRIDGE_ERROR",t.getClass().getName());
    }
  }
  public static void pageFinished(WebView w,String currentUrl) {

    if(NativePdfTitleBridge.isFreeReadingPage(currentUrl)) {
      try {
        w.evaluateJavascript(NativePdfTitleBridge.titleClickScript(),value->
          log("READING_TITLE_LISTENER_RESULT",value==null?"null":value));
        log("READING_TITLE_LISTENER_INJECTED","only previousExam.asp page, same-row data-no");
      }catch(Throwable t){
        log("READING_TITLE_LISTENER_ERROR",t.getClass().getName());
      }
    }
  }

  private static final String DISPLAY_PREFS = "hitel_viewer_display";
  private static final String DISPLAY_KEY = "show_viewer";
  static boolean showViewer(Context a) {
    return a.getSharedPreferences(DISPLAY_PREFS,Context.MODE_PRIVATE)
      .getBoolean(DISPLAY_KEY,true);
  }
  // A dedicated button anchored to the window, not to a scrolling WebView or
  // the diagnostic horizontal toolbar. Do not cover the native PDF viewer.
  static void installFileReaderButton(Activity a) {
    if (a.getClass().getName().endsWith(".ViewerActivity") || a.isFinishing()) return;
    try {
      View decor = a.getWindow().getDecorView();
      if (!(decor instanceof FrameLayout)) return;
      FrameLayout frame = (FrameLayout)decor;
      final String tag = "HITEL_FIXED_FILE_READER";
      View existing = frame.findViewWithTag(tag);
      if (existing != null) { existing.setVisibility(View.VISIBLE); existing.bringToFront(); return; }
      Button file = new Button(a);
      file.setTag(tag);
      file.setText("파일 읽기");
      file.setContentDescription("파일 읽기 · 앱 내부 저장 폴더");
      file.setTextSize(13);
      file.setTextColor(Color.WHITE);
      file.setBackgroundColor(Color.rgb(22,78,128));
      file.setMinWidth(0); file.setMinimumWidth(0);
      file.setPadding(dp(a,12),0,dp(a,12),0);
      file.setElevation(dp(a,12));
      file.setOnClickListener(v -> {
        try { a.startActivity(new Intent(a, NativePdfEntryActivity.class)); }
        catch (Exception e) {
          log("FIXED_FILE_READER_ERROR", e.getClass().getSimpleName());
          Toast.makeText(a,"파일 읽기 화면을 열 수 없습니다.",Toast.LENGTH_LONG).show();
        }
      });
      int status = a.getResources().getIdentifier("status_bar_height","dimen","android");
      int inset = status == 0 ? dp(a,24) : a.getResources().getDimensionPixelSize(status);
      FrameLayout.LayoutParams pos = new FrameLayout.LayoutParams(-2,dp(a,42),Gravity.TOP|Gravity.RIGHT);
      pos.topMargin = inset + dp(a,4);
      pos.rightMargin = dp(a,8);
      frame.addView(file,pos);
      file.bringToFront();
      log("FIXED_FILE_READER_VISIBLE", a.getClass().getName());
    } catch (Throwable e) { log("FIXED_FILE_READER_ERROR", e.getClass().getSimpleName()); }
  }


  public static void install(Activity a) {
    app=a.getApplicationContext();
    enableWebViewInspector();
    if(a.getClass().getName().endsWith(".ViewerActivity") || a.isFinishing())return;
    installFileReaderButton(a);
    try {
      FrameLayout root=a.findViewById(android.R.id.content);
      if(root==null)return;
      View existing=root.findViewWithTag(TAG);
      if(existing instanceof android.widget.Switch){
        ((android.widget.Switch)existing).setChecked(showViewer(a));return;
      }
      android.widget.Switch viewerSwitch=new android.widget.Switch(a);
      viewerSwitch.setTag(TAG);
      viewerSwitch.setText(showViewer(a)?"뷰어 ON":"뷰어 OFF");
      viewerSwitch.setTextColor(Color.WHITE);
      viewerSwitch.setBackgroundColor(Color.argb(215,17,30,45));
      viewerSwitch.setTextSize(12);
      viewerSwitch.setPadding(dp(a,8),0,dp(a,8),0);
      viewerSwitch.setChecked(showViewer(a));
      viewerSwitch.setContentDescription("ON은 바로 열기, OFF는 앱에 저장");
      FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(
          ViewGroup.LayoutParams.WRAP_CONTENT,dp(a,38),Gravity.TOP|Gravity.RIGHT);
      lp.topMargin=dp(a,38);
      root.addView(viewerSwitch,lp);
      viewerSwitch.setOnCheckedChangeListener((button,checked)->{
        a.getSharedPreferences(DISPLAY_PREFS,Context.MODE_PRIVATE)
          .edit().putBoolean(DISPLAY_KEY,checked).apply();
        viewerSwitch.setText(checked?"뷰어 ON":"뷰어 OFF");
      });
    }catch(RuntimeException e){log("DIAG_UI_ERROR",e.getClass().getSimpleName());}
  }
}
