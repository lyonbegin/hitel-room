package com.hitel.zocbodiag;

import android.app.Activity;
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

  // Selection requests are separate from the native local processing pool.
  // The existing site's confirmation and authorization remain in the UI.
  private final java.util.ArrayDeque<String> selections = new java.util.ArrayDeque<>();
  private String currentSelection;
  private static final int MAX_SELECTIONS = 256;

  @JavascriptInterface
  public void titleSelected(String expaprNo) {
    enqueueSelection(expaprNo);
  }

  @JavascriptInterface
  public String enqueueSelection(String expaprNo) {
    if (expaprNo == null || !expaprNo.matches("[1-9][0-9]{0,9}")) return "INVALID";
    try { Integer.parseInt(expaprNo); } catch (NumberFormatException e) { return "INVALID"; }
    WebView web = target.get();
    if (web == null) return "NO_VIEW";
    synchronized (selections) {
      if (expaprNo.equals(currentSelection) || selections.contains(expaprNo)) return "DUPLICATE";
      if (selections.size() >= MAX_SELECTIONS) return "FULL";
      selections.addLast(expaprNo);
    }
    web.post(this::dispatchSelection);
    return "ACCEPTED";
  }

  @JavascriptInterface
  public String queueStatus() {
    synchronized (selections) {
      return "{\"selectionWaiting\":" + selections.size()
          + ",\"selectionActive\":" + (currentSelection != null)
          + ",\"localRunning\":" + NativeWorkQueue.running()
          + ",\"localWaiting\":" + NativeWorkQueue.waiting() + "}";
    }
  }

  /** Called explicitly after the current normal UI selection has finished or
   * been cancelled. Never automatically confirm a site's authorization prompt. */
  @JavascriptInterface
  public void nextSelection() {
    WebView web = target.get();
    if (web != null) web.post(() -> {
      synchronized (selections) { currentSelection = null; }
      dispatchSelection();
    });
  }

  @JavascriptInterface
  public void clearSelections() {
    synchronized (selections) { selections.clear(); }
  }

  private void dispatchSelection() {
    WebView web = target.get();
    if (web == null || !web.isAttachedToWindow() || !web.hasWindowFocus()
        || !isFreeReadingPage(web.getUrl())) return;
    final String id;
    synchronized (selections) {
      if (currentSelection != null || selections.isEmpty()) return;
      id = selections.removeFirst();
      currentSelection = id;
    }
    // Select only the existing visible row; the original site handler owns
    // confirmation, authorization and navigation.
    String js = "(function(){var nodes=document.querySelectorAll('button[id^=li_freereading][data-no]');"
        + "for(var i=0;i<nodes.length;i++){var b=nodes[i];"
        + "if(b.getAttribute('data-no')==='" + id + "'&&!b.disabled&&b.getClientRects().length){"
        + "b.click();return 'selected';}}return 'missing';})()";
    web.evaluateJavascript(js, result -> {
      if (!"\"selected\"".equals(result)) {
        synchronized (selections) {
          if (id.equals(currentSelection)) currentSelection = null;
        }
        Diag.log("READING_SELECTION_NOT_VISIBLE", id);
      } else {
        Diag.log("READING_SELECTION_DISPATCHED", id);
      }
    });
  }

  /**
   * Only title text areas are intercepted. Original answer and '기출'
   * buttons keep their original click handlers. The selected data-no is
   * taken from the SAME list row, never from a cached previous selection.
   */
  public static String titleClickScript(){
    return "(function(){"
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
