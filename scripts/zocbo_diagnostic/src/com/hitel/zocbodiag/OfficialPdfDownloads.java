package com.hitel.zocbodiag;

import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.SystemClock;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebView;
import org.json.JSONObject;
import java.lang.ref.WeakReference;
import java.util.Locale;
import java.util.UUID;
import java.util.WeakHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One explicitly armed, official WebView PDF attachment. No viewer cache
 * export, invented URL, entitlement change, or repeated download request. */
public final class OfficialPdfDownloads {
  private static final WeakHashMap<WebView,State> STATES = new WeakHashMap<>();
  private static final ExecutorService IO = Executors.newCachedThreadPool();
  private static final long ARM_MS=60000L, DOWNLOAD_MS=120000L;
  private OfficialPdfDownloads(){}
  private static final class State {
    DownloadListener original;
    boolean installed, running;
    String examId;
    long expires;
    volatile String result = json(null,"idle",null,null,-1);
  }
  private static synchronized State state(WebView view) {
    State s=STATES.get(view);
    if(s==null){s=new State();STATES.put(view,s);}
    return s;
  }
  private static String json(String id,String stage,String error,String path,long bytes) {
    try {
      JSONObject j=new JSONObject();
      j.put("examId",id==null?JSONObject.NULL:id);
      j.put("state",stage);j.put("success","success".equals(stage));
      if(error!=null)j.put("error",error);
      if(path!=null)j.put("path",path);
      if(bytes>=0)j.put("bytes",bytes);
      return j.toString();
    }catch(Exception e){return "{}";}
  }
  private static void finish(State s,String id,String stage,String error,String path,long bytes) {
    synchronized(s){s.running=false;s.examId=null;s.expires=0;
      s.result=json(id,stage,error,path,bytes);}
    Diag.log("OFFICIAL_PDF_SAVE_"+stage.toUpperCase(Locale.US),
      "exam="+id+" bytes="+bytes+" code="+(error==null?"none":error));
  }
  /** Existing DownloadListener setters are redirected here, retaining the original. */
  public static void setOriginalListener(WebView view,DownloadListener original) {
    State s=state(view);
    synchronized(s){s.original=original;}
    install(view);
  }
  public static void install(WebView view) {
    State s=state(view);
    synchronized(s) {
      if(s.installed)return;
      WeakReference<WebView> ref=new WeakReference<>(view);
      view.setDownloadListener((url,ua,disposition,mime,length)->{
        WebView current=ref.get();
        if(current!=null)received(current,s,url,ua,disposition,mime,length);
      });
      s.installed=true;
    }
  }
  static void arm(WebView view,String id) {
    State s=state(view);
    view.post(()->{
      if(!NativePdfTitleBridge.isFreeReadingPage(view.getUrl()))return;
      synchronized(s){
        if(s.running)return;
        if(id==null||!id.matches("[1-9][0-9]{0,9}")){
          s.result=json(null,"error","INVALID_EXAM_ID",null,-1);return;}
        if(Build.VERSION.SDK_INT<29){
          s.result=json(id,"error","ANDROID_10_REQUIRED",null,-1);return;}
        s.examId=id;s.expires=SystemClock.elapsedRealtime()+ARM_MS;
        s.result=json(id,"armed",null,null,-1);
      }
      Diag.log("OFFICIAL_PDF_ARMED","exam="+id+" one attachment; 60s");
    });
  }
  static String status(WebView view) {
    State s=state(view);
    synchronized(s){
      if(!s.running&&s.examId!=null&&SystemClock.elapsedRealtime()>s.expires){
        String id=s.examId;s.examId=null;s.expires=0;
        s.result=json(id,"error","NO_OFFICIAL_PDF_ATTACHMENT",null,-1);
      }
      return s.result;
    }
  }
  private static boolean trusted(String url) {
    try{
      Uri u=Uri.parse(url);String host=u.getHost();
      return "https".equalsIgnoreCase(u.getScheme())&&u.getUserInfo()==null&&host!=null
        &&("zocbo.com".equalsIgnoreCase(host)||host.toLowerCase(Locale.US).endsWith(".zocbo.com"));
    }catch(Exception e){return false;}
  }
  private static boolean attachment(String disposition,String mime){
    if(disposition==null||!disposition.trim().toLowerCase(Locale.US).startsWith("attachment"))return false;
    String m=mime==null?"":mime.split(";",2)[0].trim().toLowerCase(Locale.US);
    return "application/pdf".equals(m)||
      ("application/octet-stream".equals(m)&&disposition.toLowerCase(Locale.US).contains(".pdf"));
  }
  private static void received(WebView w,State s,String url,String ua,String disp,String mime,long length) {
    String id=null;DownloadListener original;
    synchronized(s){
      original=s.original;
      if(!s.running&&s.examId!=null&&SystemClock.elapsedRealtime()<=s.expires
          &&NativePdfTitleBridge.isFreeReadingPage(w.getUrl())&&trusted(url)&&attachment(disp,mime)){
        id=s.examId;s.running=true;s.result=json(id,"starting",null,null,-1);
      }
    }
    if(id==null){
      if(original!=null)original.onDownloadStart(url,ua,disp,mime,length);
      return;
    }
    final String exam=id;
    Context ctx=w.getContext().getApplicationContext();
    // Normal Android browser-download handoff. The existing official page must
    // have produced an HTTPS attachment callback; the native viewer alone cannot.
    try{
      DownloadManager dm=(DownloadManager)ctx.getSystemService(Context.DOWNLOAD_SERVICE);
      if(dm==null)throw new IllegalStateException("DOWNLOAD_MANAGER_UNAVAILABLE");
      DownloadManager.Request req=new DownloadManager.Request(Uri.parse(url));
      req.setMimeType("application/pdf");
      req.setTitle("HITEL PDF "+exam);
      req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
      req.setDestinationInExternalFilesDir(ctx,Environment.DIRECTORY_DOWNLOADS,
        "hitel-official-stage-"+UUID.randomUUID()+".pdf");
      String cookie=CookieManager.getInstance().getCookie(url);
      if(cookie!=null&&!cookie.isEmpty())req.addRequestHeader("Cookie",cookie);
      if(ua!=null&&!ua.isEmpty())req.addRequestHeader("User-Agent",ua);
      long job=dm.enqueue(req);
      synchronized(s){s.result=json(exam,"downloading",null,null,-1);}
      IO.execute(()->monitor(ctx,dm,job,s,exam,length));
    }catch(Exception ex){finish(s,exam,"error","DOWNLOAD_START_FAILED",null,-1);}
  }
  private static void monitor(Context ctx,DownloadManager dm,long job,State s,String id,long declared) {
    try{
      long deadline=SystemClock.elapsedRealtime()+DOWNLOAD_MS;
      while(SystemClock.elapsedRealtime()<deadline){
        try(Cursor c=dm.query(new DownloadManager.Query().setFilterById(job))){
          if(c==null||!c.moveToFirst())throw new java.io.IOException("DOWNLOAD_RECORD_MISSING");
          int status=c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
          if(status==DownloadManager.STATUS_FAILED){
            int reason=c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
            throw new java.io.IOException("DOWNLOAD_FAILED_"+reason);
          }
          if(status==DownloadManager.STATUS_SUCCESSFUL){
            long total=c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            long received=c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            if(received<=5||(total>=0&&received!=total)||(declared>0&&received!=declared))
              throw new java.io.IOException("DOWNLOAD_LENGTH_MISMATCH");
            Uri source=dm.getUriForDownloadedFile(job);
            if(source==null)throw new java.io.IOException("DOWNLOAD_URI_MISSING");
            AuthorizedPdfStore.Result saved=AuthorizedPdfStore.save(ctx,id,source,received);
            finish(s,id,"success",null,"/sdcard/"+saved.relativePath,saved.bytes);
            return;
          }
        }
        Thread.sleep(500);
      }
      throw new java.io.IOException("DOWNLOAD_TIMEOUT");
    }catch(Exception ex){
      String msg=ex.getMessage();
      finish(s,id,"error",msg!=null&&msg.matches("[A-Z0-9_]+")?msg:"DOWNLOAD_OR_SAVE_FAILED",null,-1);
    }finally{
      try{dm.remove(job);}catch(Exception ignored){}
    }
  }
}
