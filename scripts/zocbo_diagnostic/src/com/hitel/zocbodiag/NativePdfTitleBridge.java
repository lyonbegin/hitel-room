package com.hitel.zocbodiag;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import org.json.JSONObject;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import java.lang.ref.WeakReference;
import java.util.Locale;

/**
 * User-initiated title taps invoke the existing same-row free-reading
 * action. The website retains its original authority checks and native
 * viewer handoff. No new document acquisition or cache logic.
 */
public final class NativePdfTitleBridge {
  public static final String EXTRA_EXAM_ID = "com.hitel.zocbodiag.SELECTED_EXAM_ID";
  private final WeakReference<WebView> target;
  private static final String RESULT_REQUEST = "com.hitel.zocbodiag.RESULT_REQUEST";
  private static final ConcurrentHashMap<String, Pending> pending = new ConcurrentHashMap<>();
  private static boolean lifecycleRegistered;
  private static final class Pending {
    final WeakReference<WebView> web;
    final String exam;
    volatile JSONObject result;
    Pending(WebView web, String exam) {
      this.web = new WeakReference<>(web);
      this.exam = exam;
    }
  }

  private static JSONObject outcome(String id, Pending p, boolean success, String status, String message) {
    JSONObject result = new JSONObject();
    try {
      result.put("requestId", id);
      result.put("examNo", p.exam);
      result.put("success", success);
      result.put("status", status);
      result.put("message", message);
    } catch (org.json.JSONException impossible) { throw new AssertionError(impossible); }
    return result;
  }

  // Record a terminal work result before the original Activity finishes.
  static void recordResult(Activity host, boolean success, String status, String message) {
    String id = host.getIntent().getStringExtra(RESULT_REQUEST);
    Pending p = id == null ? null : pending.get(id);
    if (p != null && p.result == null) p.result = outcome(id, p, success, status, message);
  }

  private static void deliver(String id, String fallback) {
    Pending p = pending.remove(id);
    if (p == null) return;
    JSONObject result = p.result == null ? outcome(id, p, false, fallback, "Activity ended before work confirmed") : p.result;
    android.util.Log.i("hitel_zocbo_result", "RESULT " + id + " " + result.optString("status"));
    WebView web = p.web.get();
    if (web == null) return;
    web.post(() -> {
      if (!web.isAttachedToWindow() || !isFreeReadingPage(web.getUrl())) return;
      try {
        web.evaluateJavascript("window.dispatchEvent(new CustomEvent('hitelTitleResult',{detail:JSON.parse("
            + JSONObject.quote(result.toString()) + ")}));", null);
      } catch (RuntimeException ignored) { /* The originating page is gone. */ }
    });
  }

  private static void installLifecycle(Context context) {
    if (lifecycleRegistered) return;
    Application app = (Application)context.getApplicationContext();
    app.registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
      public void onActivityCreated(Activity a, Bundle state) {}
      public void onActivityStarted(Activity a) {}
      public void onActivityResumed(Activity a) {}
      public void onActivityPaused(Activity a) {}
      public void onActivityStopped(Activity a) {}
      public void onActivitySaveInstanceState(Activity a, Bundle state) {}
      public void onActivityDestroyed(Activity a) {
        if (a.isChangingConfigurations() || a.getIntent() == null) return;
        String id = a.getIntent().getStringExtra(RESULT_REQUEST);
        if (id != null) deliver(id, "ACTIVITY_CLOSED");
      }
    });
    lifecycleRegistered = true;
  }

  public NativePdfTitleBridge(WebView w) {
    target = new WeakReference<>(w);
  }

  static boolean isFreeReadingPage(String raw) {
    if(raw == null)return false;
    try {
      Uri u=Uri.parse(raw);
      String scheme=u.getScheme();
      String host=u.getHost();
      String path=u.getPath();
      if(!"https".equalsIgnoreCase(scheme))return false;
      if(host==null || !("m.zocbo.com".equalsIgnoreCase(host) ||
        host.toLowerCase(Locale.US).endsWith(".zocbo.com")))return false;
      if(path==null)return false;
      return path.toLowerCase(Locale.US).endsWith("/previousexam.asp");
    } catch(Throwable t){return false;}
  }

  /** Read the user's UI preference; no native document request is made. */
  @JavascriptInterface
  public boolean viewerEnabled() {
    WebView w=target.get();
    return w!=null && Diag.showViewer(w.getContext());
  }

  /** Open the requested paper through the original viewer and its current mode. */
  @JavascriptInterface
  public String titleSelected(String expaprNo) {
    if (expaprNo == null || !expaprNo.matches("[1-9][0-9]{0,9}")) return "";
    try { Integer.parseInt(expaprNo); } catch (NumberFormatException e) { return ""; }
    final WebView web = target.get();
    if (web == null) return "";
    final String id = UUID.randomUUID().toString();
    pending.put(id, new Pending(web, expaprNo));
    boolean posted = web.post(() -> {
      if (!web.isAttachedToWindow() || !isFreeReadingPage(web.getUrl())) {
        deliver(id, "PAGE_UNAVAILABLE"); return;
      }
      Context context = web.getContext();
      try {
        installLifecycle(context);
        java.lang.reflect.Method factory = Class.forName("A3.L").getDeclaredMethod("c",
            Context.class, String.class, String.class, String.class, String.class,
            String.class, String.class, String.class, String.class, boolean.class,
            String.class, Integer.class, int.class);
        Intent viewer = (Intent)factory.invoke(null, context, expaprNo, "Q", "", "", "", "", "", "",
            false, "", null, 0);
        if (viewer == null || viewer.getComponent() == null
            || !context.getPackageName().equals(viewer.getComponent().getPackageName())
            || !"com.eduzone.eduzoneviewer.ui.activities.ViewerActivity".equals(viewer.getComponent().getClassName())) {
          deliver(id, "INVALID_VIEWER"); return;
        }
        viewer.putExtra(RESULT_REQUEST, id);
        Context host = context;
        while (host instanceof ContextWrapper && !(host instanceof Activity)) {
          Context base = ((ContextWrapper)host).getBaseContext();
          if (base == host) break;
          host = base;
        }
        if (!(host instanceof Activity)) viewer.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        host.startActivity(viewer);
        android.util.Log.i("hitel_zocbo_result", "START " + id);
      } catch (Exception e) {
        deliver(id, "LAUNCH_ERROR");
        Diag.log("READING_TITLE_LAUNCH_ERROR", e.getClass().getSimpleName());
        android.widget.Toast.makeText(context, "시험지를 열 수 없습니다.", android.widget.Toast.LENGTH_SHORT).show();
      }
    });
    if (!posted) { pending.remove(id); return ""; }
    return id;
  }

  /**
   * Only title text areas are intercepted. Original answer and '기출'
   * buttons keep their original click handlers. The selected data-no is
   * taken from the SAME list row, never from a cached previous selection.
   */
  public static String titleClickScript(){
    return "(function(){"
      +"if(!window.hitelTitleSelectedAsync){"
      +"var waiting=new Map();"
      +"window.addEventListener('hitelTitleResult',function(ev){var r=ev.detail;if(!r)return;var f=waiting.get(r.requestId);if(f){waiting.delete(r.requestId);f(r);}});"
      +"window.hitelTitleSelectedAsync=function(no){return new Promise(function(resolve,reject){try{var id=window.hitelPdfTitleLink.titleSelected(String(no));if(!id){reject(new Error('request rejected'));return;}waiting.set(String(id),resolve);}catch(e){reject(e);}});};"
      +"}"
      +"if(window.__hitelNativePdfTitleBound)return 'already-bound';"
      +"window.__hitelNativePdfTitleBound=true;"
      +"document.addEventListener('click',function(ev){"
      +"try{"
      +"var el=ev.target;"
      +"if(!ev.isTrusted||!el||!el.closest||el.closest('button,a,input,select,label'))return;"
      +"var title=el.closest('.download .text__school, .download .text__subject, .download .class__subject, .download .grouping__box');"
      +"if(!title)return;"
      +"var row=title.closest('.download');if(!row)return;"
      +"var link=row.querySelector('[id^=\"li_freereading\"][data-no]');"
      +"if(!link)return;"
      +"var no=String(link.getAttribute('data-no')||'').trim();"
      +"if(!/^[1-9][0-9]{0,9}$/.test(no))return;"
      +"if(!window.hitelPdfTitleLink||!window.hitelPdfTitleLink.viewerEnabled)return;"
      +"ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();"
      +"link.click();"
      +"}catch(ex){}"
      +"},true);"
      +"return 'reading-title-listener-ready';"
      +"})();";
  }
}
