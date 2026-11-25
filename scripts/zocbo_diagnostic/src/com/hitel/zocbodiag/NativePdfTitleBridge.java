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

  /** Compatibility entry: no direct native viewer launch. */
  @JavascriptInterface
  public void titleSelected(String expaprNo) {
    Diag.log("READING_TITLE_DIRECT_DISABLED","use existing authorized page action");
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
