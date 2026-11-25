package com.hitel.zocbodiag;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.webkit.WebView;
import org.json.JSONObject;
import java.io.IOException;
import java.lang.ref.WeakReference;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicLong;

/** One-at-a-time local export of files already lawfully downloaded to a user-selected SAF folder.
 * No viewer cache access, network request, credential reuse, or download-limit bypass.
 */
public final class HeadlessPdfJobs {
  private static final String PREF="hitel_authorized_pdf_source";
  private static final String KEY="tree_uri";
  private static final AtomicLong SEQ=new AtomicLong();
  private static final ExecutorService WORK=Executors.newSingleThreadExecutor();
  private static final HashMap<String,Job> ACTIVE=new HashMap<>();
  private static final LinkedHashMap<String,String> RESULTS=new LinkedHashMap<>();
  private static final int MAX_ACTIVE=32;
  private static final class Job {
    final String id;
    final WeakReference<WebView> view;
    boolean started;
    Job(String id,WebView w){this.id=id;this.view=new WeakReference<>(w);}
  }
  private HeadlessPdfJobs(){}
  static boolean hasSource(Context c){return c.getSharedPreferences(PREF,0).contains(KEY);}
  static void setSource(Context c,Uri uri)throws IOException {
    if(!"content".equals(uri.getScheme()) || !DocumentsContract.isTreeUri(uri))
      throw new IOException("INVALID_SOURCE_TREE");
    c.getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);
    String old=c.getSharedPreferences(PREF,0).getString(KEY,null);
    if(!c.getSharedPreferences(PREF,0).edit().putString(KEY,uri.toString()).commit())
      throw new IOException("SOURCE_CONFIG_WRITE_FAILED");
    if(old!=null&&!old.equals(uri.toString())){
      try{c.getContentResolver().releasePersistableUriPermission(Uri.parse(old),Intent.FLAG_GRANT_READ_URI_PERMISSION);}
      catch(RuntimeException ignored){}
    }
  }
  private static String result(String id,String state,String error,String path,long bytes){
    try{
      JSONObject j=new JSONObject();
      j.put("examId",id);j.put("state",state);j.put("success","success".equals(state));
      if(error!=null)j.put("error",error);
      if(path!=null)j.put("path",path);
      if(bytes>=0)j.put("bytes",bytes);
      return j.toString();
    }catch(Exception e){return "{}";}
  }
  private static void deliver(WebView w,String json){
    if(w==null)return;
    w.post(()->{
      if(!NativePdfTitleBridge.isFreeReadingPage(w.getUrl()))return;
      w.evaluateJavascript("(function(r){window.__hitelPdfSaveResults=window.__hitelPdfSaveResults||Object.create(null);window.__hitelPdfSaveResults[r.examId]=r;window.dispatchEvent(new CustomEvent('hitelPdfSaveResult',{detail:r}));})("+json+");",null);
    });
  }
  private static synchronized void remember(String id,String json){
    RESULTS.put(id,json);
    while(RESULTS.size()>256)RESULTS.remove(RESULTS.keySet().iterator().next());
  }
  public static synchronized String register(WebView w,String id){
    for(Job j:ACTIVE.values())if(j.id.equals(id)){
      deliver(w,result(id,"queued",null,null,-1));return null;
    }
    if(ACTIVE.size()>=MAX_ACTIVE){
      deliver(w,result(id,"error","QUEUE_FULL",null,-1));return null;
    }
    String token=Long.toString(SEQ.incrementAndGet());
    ACTIVE.put(token,new Job(id,w));
    String json=result(id,"queued",null,null,-1);
    remember(id,json);deliver(w,json);
    return token;
  }
  public static synchronized void status(WebView w,String id){
    String json=RESULTS.get(id);
    deliver(w,json==null?result(id,"unknown",null,null,-1):json);
  }
  public static synchronized void fail(String token,String error){
    Job j=ACTIVE.remove(token);
    if(j==null)return;
    String json=result(j.id,"error",error,null,-1);
    remember(j.id,json);deliver(j.view.get(),json);
    Diag.log("HEADLESS_PDF_SAVE_ERROR","exam="+j.id+" code="+error);
  }
  public static void execute(Context context,String token,String id){
    final Job j;
    synchronized(HeadlessPdfJobs.class){
      j=ACTIVE.get(token);
      if(j==null || j.started || !j.id.equals(id))return;
      j.started=true;
    }
    WORK.execute(()->{
      try{
        String running=result(id,"running",null,null,-1);
        remember(id,running);deliver(j.view.get(),running);
        String raw=context.getSharedPreferences(PREF,0).getString(KEY,null);
        if(raw==null)throw new IOException("AUTHORIZED_SOURCE_NOT_CONFIGURED");
        Uri tree=Uri.parse(raw);
        String root=DocumentsContract.getTreeDocumentId(tree);
        Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,root);
        String[] columns={DocumentsContract.Document.COLUMN_DOCUMENT_ID,
          DocumentsContract.Document.COLUMN_DISPLAY_NAME,DocumentsContract.Document.COLUMN_MIME_TYPE,
          DocumentsContract.Document.COLUMN_SIZE};
        Uri source=null;long size=-1;
        try(Cursor cursor=context.getContentResolver().query(children,columns,null,null,null)){
          if(cursor==null)throw new IOException("SOURCE_QUERY_FAILED");
          while(cursor.moveToNext()){
            if(!(id+".pdf").equals(cursor.getString(1)))continue;
            if(source!=null)throw new IOException("AMBIGUOUS_SOURCE");
            String mime=cursor.getString(2);
            if(!"application/pdf".equals(mime)&&!"application/octet-stream".equals(mime))
              throw new IOException("SOURCE_NOT_PDF");
            source=DocumentsContract.buildDocumentUriUsingTree(tree,cursor.getString(0));
            size=cursor.isNull(3)?-1:cursor.getLong(3);
          }
        }
        if(source==null)throw new IOException("AUTHORIZED_PDF_NOT_FOUND");
        AuthorizedPdfStore.Result saved=AuthorizedPdfStore.save(context,id,source,size);
        String json=result(id,"success",null,"/sdcard/"+saved.relativePath,saved.bytes);
        synchronized(HeadlessPdfJobs.class){ACTIVE.remove(token);remember(id,json);}
        deliver(j.view.get(),json);
        Diag.log("HEADLESS_PDF_SAVE_OK","exam="+id+" bytes="+saved.bytes);
      }catch(Exception ex){
        String code=ex instanceof IOException && ex.getMessage()!=null && ex.getMessage().matches("[A-Z0-9_]+")
          ?ex.getMessage():ex instanceof SecurityException?"SOURCE_PERMISSION_DENIED":"SAVE_FAILED";
        fail(token,code);
      }
    });
  }
}
