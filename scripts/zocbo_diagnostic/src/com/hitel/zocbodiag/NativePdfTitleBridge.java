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
 * Original Free Reading (previousExam.asp) list title -> existing R6 native
 * Activity with the selected row's exact expapr_no. The title bridge does not
 * make network requests, alter original PDF entitlement, or download files.
 * Invoked only after an actual user taps a title in the already loaded page.
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

  /**
   * Registered on original WebView before load. Browser calls on Java bridge
   * thread, so switch to WebView UI thread before reading URL/startActivity.
   */
  @JavascriptInterface
  public void titleSelected(final String expaprNo) {
    if(expaprNo==null || !expaprNo.matches("[1-9][0-9]{0,9}")) {
      Diag.log("READING_TITLE_INVALID_ID","title click ignored: invalid exam ID");
      return;
    }
    final WebView w=target.get();
    if(w==null){
      Diag.log("READING_TITLE_WEBVIEW_GONE","title click ignored: webview reclaimed");
      return;
    }
    w.post(()->{
      String url=w.getUrl();
      if(!isFreeReadingPage(url)) {
        Diag.log("READING_TITLE_WRONG_ORIGIN","title click ignored: origin mismatch");
        return;
      }
      try {
        Context ctx=w.getContext();
        Activity activity=null;
        Context c=ctx;
        for(int i=0;i<8;i++){
          if(c instanceof Activity){activity=(Activity)c;break;}
          if(!(c instanceof ContextWrapper))break;
          Context b=((ContextWrapper)c).getBaseContext();
          if(b==c)break;
          c=b;
        }
        if(activity!=null && (activity.isFinishing() ||
           (android.os.Build.VERSION.SDK_INT>=17 && activity.isDestroyed()))) {
           Diag.log("READING_TITLE_ACTIVITY_GONE","activity no longer active");
           return;
        }
        Intent intent=new Intent(ctx,NativePdfEntryActivity.class);
        intent.putExtra(EXTRA_EXAM_ID,expaprNo);
        if(activity==null)intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Diag.log("READING_TITLE_SELECTED","exam="+expaprNo+" source=previousExam.asp title");
        if(activity!=null)activity.startActivity(intent);
        else ctx.startActivity(intent);
        Diag.log("READING_TITLE_ACTIVITY_STARTED","NativePdfEntryActivity requested");
      }catch(Throwable t) {
        Diag.log("READING_TITLE_LAUNCH_ERROR",t.getClass().getName());
      }
    });
  }

  @JavascriptInterface
  public void armOfficialSave(String examId) {
    WebView w=target.get();
    if(w!=null)OfficialPdfDownloads.arm(w,examId);
  }

  @JavascriptInterface
  public String officialSaveStatus() {
    WebView w=target.get();
    return w==null?"{}":OfficialPdfDownloads.status(w);
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
      +"if(!el||!el.closest||el.closest('button,a,input,select,label'))return;"
      +"var title=el.closest('.download .text__school, .download .text__subject, .download .class__subject, .download .grouping__box');"
      +"if(!title)return;"
      +"var row=title.closest('.download');if(!row)return;"
      +"var link=row.querySelector('[id^=\"li_freereading\"][data-no]');"
      +"if(!link)return;"
      +"var no=String(link.getAttribute('data-no')||'').trim();"
      +"if(!/^[1-9][0-9]{0,9}$/.test(no))return;"
      +"if(!window.hitelPdfTitleLink||!window.hitelPdfTitleLink.titleSelected)return;"
      +"ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();"
      +"window.hitelPdfTitleLink.titleSelected(no);"
      +"}catch(ex){}"
      +"},true);"
      +"return 'reading-title-listener-ready';"
      +"})();";
  }
}
