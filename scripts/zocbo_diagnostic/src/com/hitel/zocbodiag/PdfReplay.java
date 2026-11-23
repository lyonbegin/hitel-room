package com.hitel.zocbodiag;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/** User-initiated POST using the original configured client, then download
 * the PDF from the authorized server response. No cookie/token duplication,
 * no bypass, no networking on the UI thread. A click may count as a view.
 */
public final class PdfReplay {
  private static final AtomicBoolean BUSY=new AtomicBoolean(false);
  private static final String ENDPOINT="https://m.zocbo.com/_AppApi/app.api.asp?cmd=VIEWER_FILE_PATH";
  private static final long MAX_PDF_BYTES=64L*1024*1024;
  private PdfReplay(){}

  public static void start(Activity activity, int exam) {
    if(exam<=0){Diag.log("MANUAL_POST_INPUT_ERROR","invalid exam id");return;}
    if(!BUSY.compareAndSet(false,true)) {
      Diag.log("MANUAL_POST_BUSY","previous POST/download still running");
      toast(activity,"이미 PDF 요청을 처리하고 있습니다.");
      return;
    }
    final Context context=activity.getApplicationContext();
    Diag.log("MANUAL_POST_BUTTON","clicked exam="+exam+" source=existing app session");
    toast(activity,"원본 앱 세션으로 POST 요청을 시작했습니다.");
    new Thread(()->{
      try{
        run(context,exam);
        toast(activity,"PDF 요청이 끝났습니다. 로그를 확인해 주십시오.");
      }catch(Throwable t){
        Diag.log("MANUAL_POST_ERROR",ex(t));
        toast(activity,"PDF 요청 실패 — 로그에서 원인을 확인해 주십시오.");
      }finally{BUSY.set(false);}
    },"Zocbo-Manual-PDF-POST").start();
  }
  private static void toast(Activity a,String s) {
    try{a.runOnUiThread(()->Toast.makeText(a,s,Toast.LENGTH_LONG).show());}
    catch(Throwable ignored){}
  }
  private static String ex(Throwable error) {
    if(error instanceof java.lang.reflect.InvocationTargetException
       && ((java.lang.reflect.InvocationTargetException)error).getTargetException()!=null)
      error=((java.lang.reflect.InvocationTargetException)error).getTargetException();
    StringBuilder b=new StringBuilder(error.getClass().getName());
    String message=error.getMessage();
    if(message!=null) {
      // Avoid leaking authorization/short_url in exception messages.
      message=message.replaceAll("(?i)(https?://\\S+)","[URL]");
      message=message.replaceAll("(?i)(token|authorization|password|session|cookie)\\s*[=:]\\s*[^\\s&]+","$1=[REDACTED]");
      b.append(": ").append(message.length()>300?message.substring(0,300):message);
    }
    for(StackTraceElement e:error.getStackTrace()) {
      if(b.length()>1000)break;
      b.append(" @").append(e.getClassName()).append(":").append(e.getLineNumber());
    }
    return b.toString();
  }
  private static Object call(Object o,String name,Class<?>[] signature,Object...values)throws Exception {
    try{return o.getClass().getMethod(name,signature).invoke(o,values);}
    catch(java.lang.reflect.InvocationTargetException ex){
      Throwable t=ex.getTargetException();
      if(t instanceof Exception)throw (Exception)t;
      throw new RuntimeException(t);
    }
  }
  private static Object zero(Object o,String name)throws Exception {
    return call(o,name,new Class<?>[0]);
  }
  /** OkHttp 3.x and 4.x expose different factory argument ordering. */
  private static Object requestBody(String json)throws Exception {
    Class<?> bodyClass=Class.forName("okhttp3.RequestBody");
    Class<?> mediaClass=Class.forName("okhttp3.MediaType");
    Object media;
    try{
      media=mediaClass.getMethod("parse",String.class).invoke(null,"application/json; charset=utf-8");
    }catch(NoSuchMethodException noStatic){
      Object comp=mediaClass.getField("Companion").get(null);
      media=comp.getClass().getMethod("parse",String.class).invoke(comp,"application/json; charset=utf-8");
    }
    for(Method factory:bodyClass.getMethods()){
      if(!factory.getName().equals("create")||!Modifier.isStatic(factory.getModifiers()))continue;
      Class<?>[] p=factory.getParameterTypes();
      if(p.length!=2)continue;
      if(p[0]==mediaClass && p[1]==String.class)return factory.invoke(null,media,json);
      if(p[0]==String.class && p[1]==mediaClass)return factory.invoke(null,json,media);
    }
    // OkHttp Kotlin Companion factory fallback
    Object companion=bodyClass.getField("Companion").get(null);
    for(Method factory:companion.getClass().getMethods()) {
      if(!factory.getName().equals("create"))continue;
      Class<?>[] p=factory.getParameterTypes();
      if(p.length!=2)continue;
      if(p[0]==mediaClass&&p[1]==String.class)return factory.invoke(companion,media,json);
      if(p[0]==String.class&&p[1]==mediaClass)return factory.invoke(companion,json,media);
    }
    throw new NoSuchMethodException("original OkHttp RequestBody.create factory not located");
  }
  private static Object request(String url,String method,String json)throws Exception {
    Class<?> rb=Class.forName("okhttp3.Request$Builder");
    Object b=rb.getConstructor().newInstance();
    call(b,"url",new Class<?>[]{String.class},url);
    if("POST".equals(method)){
      Object body=requestBody(json);
      call(b,"post",new Class<?>[]{Class.forName("okhttp3.RequestBody")},body);
    }else {
      call(b,"get",new Class<?>[0]);
    }
    return zero(b,"build");
  }
  private static Object clientFromOriginalApp()throws Exception {
    Object builder=NetTrace.originalApiBuilder();
    if(builder==null)throw new IllegalStateException("original Retrofit OkHttp builder not initialized. Log into the original app first.");
    // The original HeaderInterceptor remains installed and injects fresh
    // bearer/CID/version fields on each request; no raw credential is read.
    Object client=zero(builder,"build");
    Diag.log("MANUAL_POST_CLIENT","clone of original OkHttp builder, with app HeaderInterceptor; "+client.getClass().getName());
    return client;
  }
  private static Object newCall(Object client,Object req)throws Exception {
    return call(client,"newCall",new Class<?>[]{Class.forName("okhttp3.Request")},req);
  }
  private static Object execute(Object c)throws Exception{return zero(c,"execute");}
  private static int status(Object r)throws Exception{return ((Number)zero(r,"code")).intValue();}
  private static String contentType(Object response) {
    try{
      Object body=zero(response,"body");
      Object type=body==null?null:zero(body,"contentType");
      return String.valueOf(type);
    }catch(Throwable t){return "[error]";}
  }
  private static void closeResponse(Object r) {
    if(r==null)return;
    try{zero(r,"close");}
    catch(Throwable ex){
      try{Object body=zero(r,"body");if(body!=null)zero(body,"close");}
      catch(Throwable ignored){}
    }
  }
  private static String header(Object response,String name) {
    try{return String.valueOf(call(response,"header",new Class<?>[]{String.class},name));}
    catch(Throwable ignored){return "[not-readable]";}
  }
  private static void run(Context context,int exam)throws Exception {
    String json=NetTrace.replayJsonForExam(exam);
    if(json==null) {
      JSONObject b=new JSONObject();
      b.put("expapr_no",exam);
      b.put("file_type","Q");
      b.put("short_url","");
      b.put("pk","");
      b.put("qr",false);
      b.put("device","M");
      json=b.toString();
      Diag.log("MANUAL_POST_BODY_SOURCE","six-field general viewer defaults, phone M; R4 model not yet captured for exam");
    } else {
      Diag.log("MANUAL_POST_BODY_SOURCE","exact last original six-field model, same exam");
    }
    JSONObject body=new JSONObject(json);
    Diag.log("MANUAL_POST_VARS","expapr_no="+body.optInt("expapr_no")
        +" file_type="+body.optString("file_type")+" short_url_length="+body.optString("short_url").length()
        +" pk_length="+body.optString("pk").length()
        +" qr="+body.optBoolean("qr")+" device="+body.optString("device"));
    Diag.rawPdf("MANUAL_POST_SIX_FIELDS_JSON",json);
    Object apiClient=clientFromOriginalApp();
    Object response=null;
    try {
      Object apiReq=request(ENDPOINT,"POST",json);
      Diag.log("MANUAL_POST_API_URL",ENDPOINT);
      Diag.log("MANUAL_POST_API_BEGIN","POST, live original interceptor, no custom authorization");
      long start=android.os.SystemClock.elapsedRealtime();
      response=execute(newCall(apiClient,apiReq));
      int code=status(response);
      Diag.log("MANUAL_POST_API_STATUS",String.valueOf(code));
      Diag.log("MANUAL_POST_API_ELAPSED_MS",String.valueOf(android.os.SystemClock.elapsedRealtime()-start));
      Diag.log("MANUAL_POST_API_CONTENT_TYPE",contentType(response));
      Object rbody=zero(response,"body");
      if(rbody==null)throw new java.io.IOException("API response body missing");
      String payload=String.valueOf(zero(rbody,"string"));
      JSONObject obj=new JSONObject(payload);
      String result=obj.optString("response_code","");
      String msg=obj.optString("response_message","");
      Diag.log("MANUAL_POST_API_RESPONSE","code="+result+" message="+msg);
      String pdf=obj.optString("pdf_path","");
      Diag.log("MANUAL_POST_PDF_PATH","present="+(!pdf.isEmpty())+" redacted="+NetTrace.safeUrl(pdf));
      if(code!=200||!"200".equals(result)||pdf.isEmpty()) {
        Diag.log("MANUAL_POST_REJECTED","server did not authorize/return PDF; no GET attempted");
        return;
      }
      Uri target=Uri.parse(pdf);
      String hostname=target.getHost();
      if(!"https".equalsIgnoreCase(target.getScheme())||
        hostname==null||
        !("m.zocbo.com".equalsIgnoreCase(hostname)||
          hostname.toLowerCase(Locale.US).endsWith(".zocbo.com"))||
        !target.getPath().startsWith("/cv/")) {
        Diag.log("MANUAL_POST_PDF_URL_REJECTED","unexpected server PDF host/path, "+NetTrace.safeUrl(pdf));
        return;
      }
      Diag.rawPdf("MANUAL_POST_SERVER_PDF_PATH",pdf);
      downloadPdf(context,exam,pdf);
    }finally{closeResponse(response);}
  }
  private static String sha256(File input)throws Exception {
    MessageDigest d=MessageDigest.getInstance("SHA-256");
    byte[] buffer=new byte[8192];
    try(InputStream i=new java.io.FileInputStream(input)) {
      int n;while((n=i.read(buffer))!=-1)d.update(buffer,0,n);
    }
    StringBuilder b=new StringBuilder();
    for(byte x:d.digest())b.append(String.format(Locale.US,"%02x",x&255));
    return b.toString();
  }
  private static void downloadPdf(Context context,int exam,String url)throws Exception {
    // Original source uses a NEW plain OkHttpClient.Builder().build() for PDF GET.
    Class<?> builderClass=Class.forName("okhttp3.OkHttpClient$Builder");
    Object plainBuilder=builderClass.getConstructor().newInstance();
    Object plainClient=zero(plainBuilder,"build");
    Object response=null;
    File temp=null;
    try {
      Diag.log("MANUAL_PDF_GET_BEGIN",NetTrace.safeUrl(url)+" (plain original client, no added headers)");
      long start=android.os.SystemClock.elapsedRealtime();
      response=execute(newCall(plainClient,request(url,"GET",null)));
      int code=status(response);
      Diag.log("MANUAL_PDF_GET_STATUS",String.valueOf(code));
      Diag.log("MANUAL_PDF_GET_ELAPSED_MS",String.valueOf(android.os.SystemClock.elapsedRealtime()-start));
      Diag.log("MANUAL_PDF_GET_CONTENT_TYPE",contentType(response));
      String clen=header(response,"Content-Length");
      Diag.log("MANUAL_PDF_GET_HEADER_BYTES",clen);
      if(code!=200){Diag.log("MANUAL_PDF_GET_REJECTED","HTTP "+code+" (no PDF written)");return;}
      Object b=zero(response,"body");
      if(b==null)throw new java.io.IOException("PDF response body missing");
      InputStream in=new BufferedInputStream((InputStream)zero(b,"byteStream"),32768);
      byte[] first=new byte[5];int got=0;
      while(got<5){int n=in.read(first,got,5-got);if(n==-1)break;got+=n;}
      if(got!=5||first[0]!='%'||first[1]!='P'||first[2]!='D'||first[3]!='F'||first[4]!='-') {
        Diag.log("MANUAL_PDF_BAD_MAGIC","response is not %PDF-, nothing saved");
        return;
      }
      Diag.log("MANUAL_PDF_MAGIC","%PDF- verified");
      temp=File.createTempFile("zocbo_pdf_"+exam+"_","_partial",context.getCacheDir());
      long total=5L,lastUpdate=0L;
      try(OutputStream out=new BufferedOutputStream(new FileOutputStream(temp),32768)) {
        out.write(first);
        byte[] buffer=new byte[32768];int n;
        while((n=in.read(buffer))!=-1){
          total+=n;
          if(total>MAX_PDF_BYTES)throw new java.io.IOException("PDF exceeds 64MiB safety cap");
          out.write(buffer,0,n);
          if(total-lastUpdate>=1024*1024) {
            lastUpdate=total;Diag.log("MANUAL_PDF_PROGRESS_BYTES",String.valueOf(total));
          }
        }
      }
      String sum=sha256(temp);
      Diag.log("MANUAL_PDF_DOWNLOADED","bytes="+total+" sha256="+sum);
      String name="Zocbo_"+exam+"_"+
        new SimpleDateFormat("yyyyMMdd_HHmmss",Locale.US).format(new Date())+".pdf";
      String location=saveCompleted(context,temp,name);
      Diag.log("MANUAL_PDF_SAVED","name="+name+" size="+total+" sha256="+sum+" location="+location);
      Diag.log("MANUAL_PDF_RESULT","SUCCESS");
    }catch(Throwable err){
      Diag.log("MANUAL_PDF_DOWNLOAD_ERROR",ex(err));
      if(err instanceof Exception)throw (Exception)err;
      throw new RuntimeException(err);
    }finally{
      if(temp!=null&&temp.exists())temp.delete();
      closeResponse(response);
    }
  }
  private static String saveCompleted(Context context,File temp,String filename)throws Exception {
    if(Build.VERSION.SDK_INT>=29){
      Uri item=null;
      try{
        ContentValues values=new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME,filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE,"application/pdf");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/HITEL-Zocbo");
        values.put(MediaStore.MediaColumns.IS_PENDING,1);
        item=context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
        if(item==null)throw new java.io.IOException("MediaStore Downloads insert returned null");
        try(InputStream in=new java.io.FileInputStream(temp);
            OutputStream out=context.getContentResolver().openOutputStream(item)){
          if(out==null)throw new java.io.IOException("MediaStore output stream unavailable");
          byte[] buf=new byte[32768];int n;
          while((n=in.read(buf))!=-1)out.write(buf,0,n);
        }
        ContentValues done=new ContentValues();
        done.put(MediaStore.MediaColumns.IS_PENDING,0);
        context.getContentResolver().update(item,done,null,null);
        return Environment.DIRECTORY_DOWNLOADS+"/HITEL-Zocbo/"+filename+" (MediaStore "+item.toString()+")";
      }catch(Throwable ex){
        if(item!=null)context.getContentResolver().delete(item,null,null);
        if(ex instanceof Exception)throw (Exception)ex;
        throw new RuntimeException(ex);
      }
    }else {
      File dir=new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),"HITEL-Zocbo");
      if(!dir.exists()&&!dir.mkdirs())throw new java.io.IOException("cannot make app Downloads directory");
      File to=new File(dir,filename);
      try(InputStream in=new java.io.FileInputStream(temp);
          OutputStream out=new FileOutputStream(to)){
        byte[] buf=new byte[32768];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);
      }
      return to.getAbsolutePath();
    }
  }
}
