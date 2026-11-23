package com.hitel.zocbodiag;

import android.net.Uri;
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONObject;
import java.lang.reflect.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Original Zocbo 4.3.11(2) instrumented OkHttp diagnostic.
 * Observe only; do not change HTTP requests/responses, authentication, response bodies or permission gates.
 * All stored/shared entries are redacted, including bearer/cookie/PK/signed URL query values.
 */
public final class NetTrace {
  private static final AtomicLong SEQ=new AtomicLong(0);
  private static final int MAX_JSON_SAMPLE=131072;
  private NetTrace(){}
  public static void apiClient(Object builder){attach(builder,"DOTCOM_API");}
  public static void pdfClient(Object builder){attach(builder,"PDF_DOWNLOAD");}

  private static String hash(String value) {
    if(value==null)return "null";
    try {
      byte[] b=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder h=new StringBuilder();
      for(int i=0;i<8;i++)h.append(String.format(Locale.US,"%02x",b[i]&0xff));
      return h.toString();
    }catch(Throwable t){return "unavailable";}
  }
  private static String fingerprint(String value){
    if(value==null||value.length()==0)return "[absent]";
    return "[present len="+value.length()+" sha256_16="+hash(value)+"]";
  }
  private static String trunc(String s,int n){
    return s==null?"[null]":(s.length()>n?s.substring(0,n)+"…[TRUNCATED originalChars="+s.length()+"]":s);
  }
  private static boolean privateKey(String key){
    if(key==null)return true;
    String k=key.toLowerCase(Locale.US);
    return k.contains("authorization")||k.contains("bearer")||k.contains("token")
       ||k.contains("cookie")||k.contains("secret")||k.contains("password")
       ||k.contains("auth")||k.contains("session")||k.contains("signature")
       ||k.equals("sig")||k.equals("pk")||k.equals("key")||k.contains("credential")
       ||k.contains("jwt")||k.contains("cid")||k.contains("x-amz")
       ||k.contains("x-goog")||k.equals("policy")||k.equals("expires");
  }
  private static String safeText(String s) {
    if(s==null)return "[null]";
    String x=s.replaceAll("(?i)(https?://[^\\s\"']+)", "[URL_REDACTED]");
    x=x.replaceAll("(?i)(authorization|bearertoken|token|access_token|refresh_token|cookie|session|password)\\s*[:=]\\s*[^\\s,&]+", "$1=[REDACTED]");
    return trunc(x,550);
  }
  public static String safeUrl(String s) {
    if(s==null)return "[null]";
    try {
      Uri uri=Uri.parse(s);
      String scheme=uri.getScheme();
      if(scheme==null)return "[nonurl "+fingerprint(s)+"]";
      String host=uri.getHost();
      StringBuilder result=new StringBuilder();
      result.append(scheme).append("://").append(host==null?"[no-host]":host);
      if(uri.getPort()>0)result.append(":").append(uri.getPort());
      String path=uri.getEncodedPath();
      result.append(path==null?"/":trunc(path,2200));
      boolean first=true;
      for(String key:uri.getQueryParameterNames()) {
        result.append(first?"?":"&");first=false;
        String val=uri.getQueryParameter(key);
        result.append(key).append("=");
        result.append(!privateKey(key)&&("cmd".equalsIgnoreCase(key)||"expapr_no".equalsIgnoreCase(key)||"file_type".equalsIgnoreCase(key)||"qr".equalsIgnoreCase(key)||"device".equalsIgnoreCase(key))
          ?trunc(val,100):fingerprint(val));
      }
      if(uri.getFragment()!=null)result.append("#[redacted]");
      return trunc(result.toString(),9000);
    }catch(Throwable t){return "[URL_PARSE_ERROR "+fingerprint(s)+"]";}
  }
  private static String cause(Throwable t){
    if(t instanceof InvocationTargetException && ((InvocationTargetException)t).getTargetException()!=null)
      t=((InvocationTargetException)t).getTargetException();
    StringBuilder b=new StringBuilder();int depth=0;
    while(t!=null && depth++<4){
      if(depth>1)b.append(" causedBy ");
      b.append(t.getClass().getName()).append(":").append(safeText(t.getMessage()));
      if(depth==1) {
        StackTraceElement[] st=t.getStackTrace();
        for(int i=0;i<Math.min(st.length,5);i++)b.append(" @").append(st[i].getClassName()).append(":").append(st[i].getLineNumber());
      }
      if(t==t.getCause())break;t=t.getCause();
    }
    return trunc(b.toString(),3000);
  }
  private static Object invoke(Class<?> c,Object target,String name,Class<?>[] sig,Object...args)throws Throwable{
    try{return c.getMethod(name,sig).invoke(target,args);}
    catch(InvocationTargetException t){throw t.getTargetException();}
  }
  private static Object zero(Class<?> c,Object target,String name)throws Throwable {
    return invoke(c,target,name,new Class<?>[0]);
  }
  private static void event(String context,String name,String value) {
    try {Diag.log(context+"_"+name,value);}catch(Throwable ignored){}
  }
  private static void attach(Object builder,final String role) {
    try {
      final Class<?> intr=Class.forName("okhttp3.Interceptor");
      Object instance=Proxy.newProxyInstance(intr.getClassLoader(),new Class<?>[]{intr},
        new InvocationHandler(){
          @Override public Object invoke(Object proxy,Method method,Object[] args)throws Throwable {
            String name=method.getName();
            if("toString".equals(name))return "HITEL_"+role+"_TRACE";
            if("hashCode".equals(name))return System.identityHashCode(proxy);
            if("equals".equals(name))return args!=null&&args.length==1&&proxy==args[0];
            if(!"intercept".equals(name)||args==null||args.length!=1)
              throw new IllegalArgumentException("unexpected interceptor invocation "+name);
            return trace(args[0],role);
          }
        });
      builder.getClass().getMethod("addInterceptor",intr).invoke(builder,instance);
      Diag.log("PDF_TRACE_HOOK_OK",role+" installed on "+builder.getClass().getName());
    }catch(Throwable ex){Diag.log("PDF_TRACE_HOOK_ERROR",role+" "+cause(ex));}
  }
  private static String headerLines(Object hdr)throws Throwable {
    if(hdr==null)return "[none]";
    Class<?> c=Class.forName("okhttp3.Headers");
    int count=((Number)zero(c,hdr,"size")).intValue();
    StringBuilder out=new StringBuilder("count="+count+" ");
    for(int i=0;i<Math.min(count,50);i++){
      String k=String.valueOf(invoke(c,hdr,"name",new Class<?>[]{int.class},i));
      String v=String.valueOf(invoke(c,hdr,"value",new Class<?>[]{int.class},i));
      out.append(k).append(":");
      if(privateKey(k)||"location".equalsIgnoreCase(k)||"set-cookie".equalsIgnoreCase(k))
        out.append(fingerprint(v));
      else if("content-type".equalsIgnoreCase(k)||"content-length".equalsIgnoreCase(k)
           ||"accept".equalsIgnoreCase(k)||"user-agent".equalsIgnoreCase(k)
           ||"app-version".equalsIgnoreCase(k)||"os-type".equalsIgnoreCase(k)
           ||"os-version".equalsIgnoreCase(k)||"content-encoding".equalsIgnoreCase(k)
           ||"transfer-encoding".equalsIgnoreCase(k)||"cache-control".equalsIgnoreCase(k))
        out.append(safeText(v));
      else out.append(fingerprint(v));
      out.append(" | ");
    }
    return trunc(out.toString(),5500);
  }
  private static Object safeJson(Object value,String key,int depth){
    if(privateKey(key))return fingerprint(String.valueOf(value));
    if(value==null||value==JSONObject.NULL)return JSONObject.NULL;
    if(value instanceof JSONObject) {
      if(depth>4)return "[object maxDepth]";
      JSONObject input=(JSONObject)value, output=new JSONObject();
      int count=0;
      Iterator<String> names=input.keys();
      while(names.hasNext() && count++<100){
        String k=names.next();Object v=input.opt(k);
        try {output.put(k,safeJson(v,k,depth+1));}catch(Throwable ignored){}
      }
      return output;
    }
    if(value instanceof JSONArray) {
      JSONArray arr=(JSONArray)value;
      if(arr.length()>10)return "[array length="+arr.length()+" truncated]";
      JSONArray out=new JSONArray();
      for(int i=0;i<arr.length();i++)out.put(safeJson(arr.opt(i),key,depth+1));
      return out;
    }
    if(value instanceof String) {
      String v=(String)value;
      if("pdf_path".equalsIgnoreCase(key)||key.toLowerCase(Locale.US).contains("url")||
         key.toLowerCase(Locale.US).endsWith("_path")||v.startsWith("https://")||v.startsWith("http://"))return safeUrl(v);
      return trunc(v,400);
    }
    return value;
  }
  private static void jsonDetails(String context,String input){
    try {
      JSONObject json=new JSONObject(input);
      event(context,"JSON_KEYS",String.valueOf(json.names()));
      JSONObject safe=(JSONObject)safeJson(json,"response",0);
      event(context,"JSON_REDACTED",trunc(safe.toString(),24000));
      if(json.has("expapr_no")) event(context,"EX_PAPR_NO",String.valueOf(json.opt("expapr_no")));
      if(json.has("file_type")) event(context,"FILE_TYPE",String.valueOf(json.opt("file_type")));
      if(json.has("qr")) event(context,"QR",String.valueOf(json.opt("qr")));
      if(json.has("device")) event(context,"DEVICE",String.valueOf(json.opt("device")));
      if(json.has("short_url")) event(context,"SHORT_URL",safeUrl(json.optString("short_url","")));
      if(json.has("pk")) event(context,"PK",fingerprint(json.optString("pk","")));
      if(json.has("response_code")) event(context,"RESPONSE_CODE",String.valueOf(json.opt("response_code")));
      if(json.has("response_message")) event(context,"RESPONSE_MESSAGE",safeText(json.optString("response_message","")));
      if(json.has("pdf_path")){
        String pdf=json.optString("pdf_path","");
        event(context,"PDF_PATH_PRESENT",String.valueOf(!pdf.isEmpty()));
        event(context,"PDF_PATH_LENGTH",String.valueOf(pdf.length()));
        event(context,"PDF_PATH_SHA256_16",hash(pdf));
        event(context,"PDF_PATH_URL_REDACTED",safeUrl(pdf));
      }
    }catch(Throwable t){
      event(context,"JSON_PARSE_ERROR",cause(t));
      event(context,"BODY_PREFIX_REDACTED",safeText(trunc(input,800)));
    }
  }
  private static String requestBody(Object body)throws Throwable {
    if(body==null)return "[no body]";
    Class<?> cls=Class.forName("okhttp3.RequestBody");
    Object len=zero(cls,body,"contentLength");
    if(len instanceof Number && ((Number)len).longValue()>MAX_JSON_SAMPLE)return "[body too large]";
    Class<?> bufCls=Class.forName("okio.Buffer");
    Object buffer=bufCls.getConstructor().newInstance();
    invoke(cls,body,"writeTo",new Class<?>[]{Class.forName("okio.BufferedSink")},buffer);
    return trunc(String.valueOf(zero(bufCls,buffer,"readUtf8")),MAX_JSON_SAMPLE);
  }
  private static Object trace(Object chain,String role)throws Throwable{
    Class<?> chainClass=Class.forName("okhttp3.Interceptor$Chain");
    Class<?> requestClass=Class.forName("okhttp3.Request");
    Class<?> responseClass=Class.forName("okhttp3.Response");
    Object req=zero(chainClass,chain,"request");
    String url=String.valueOf(zero(requestClass,req,"url"));
    String method=String.valueOf(zero(requestClass,req,"method"));
    boolean isPdf="PDF_DOWNLOAD".equals(role);
    boolean viewerPath=url.contains("VIEWER_FILE_PATH");
    String target=isPdf?"PDF_DOWNLOAD":viewerPath?"VIEWER_FILE_PATH":"DOTCOM_OTHER";
    long seq=SEQ.incrementAndGet();
    String ctx=target+"_N"+seq;
    long started=SystemClock.elapsedRealtime();
    event(ctx,"START","method="+method+" thread="+Thread.currentThread().getName()
        +" elapsedRealtime="+started+" route="+role);
    event(ctx,"REQUEST_URL_REDACTED",safeUrl(url));
    event(ctx,"REQUEST_URL_SHA256_16",hash(url));
    event(ctx,"REQUEST_URL_LENGTH",String.valueOf(url.length()));
    try {
      Object headers=zero(requestClass,req,"headers");
      event(ctx,"REQUEST_HEADERS",headerLines(headers));
      Object body=zero(requestClass,req,"body");
      if(viewerPath){
        String json=requestBody(body);
        jsonDetails(ctx+"_REQUEST",json);
      }else if(body!=null){
        Object len=zero(Class.forName("okhttp3.RequestBody"),body,"contentLength");
        event(ctx,"REQUEST_BODY_BYTES",String.valueOf(len));
      }
    }catch(Throwable t){event(ctx,"REQUEST_INSTRUMENTATION_ERROR",cause(t));}
    Object response;
    try {
      response=invoke(chainClass,chain,"proceed",new Class<?>[]{requestClass},req);
    }catch(Throwable originalError){
      event(ctx,"NETWORK_EXCEPTION",cause(originalError));
      event(ctx,"FAIL_ELAPSED_MS",String.valueOf(SystemClock.elapsedRealtime()-started));
      throw originalError;
    }
    try {
      event(ctx,"HTTP_STATUS",String.valueOf(zero(responseClass,response,"code")));
      event(ctx,"HTTP_MESSAGE",safeText(String.valueOf(zero(responseClass,response,"message"))));
      event(ctx,"ELAPSED_MS",String.valueOf(SystemClock.elapsedRealtime()-started));
      event(ctx,"PROTOCOL",String.valueOf(zero(responseClass,response,"protocol")));
      event(ctx,"RESPONSE_HEADERS",headerLines(zero(responseClass,response,"headers")));
      try{
        event(ctx,"SENT_REQUEST_AT_MS",String.valueOf(zero(responseClass,response,"sentRequestAtMillis")));
        event(ctx,"RECEIVED_RESPONSE_AT_MS",String.valueOf(zero(responseClass,response,"receivedResponseAtMillis")));
      }catch(Throwable ignored){}
      try{
        Object handshake=zero(responseClass,response,"handshake");
        event(ctx,"TLS_HANDSHAKE_PRESENT",String.valueOf(handshake!=null));
        if(handshake!=null){
          Class<?> hc=Class.forName("okhttp3.Handshake");
          event(ctx,"TLS_VERSION",String.valueOf(zero(hc,handshake,"tlsVersion")));
          event(ctx,"TLS_CIPHER",String.valueOf(zero(hc,handshake,"cipherSuite")));
        }
      }catch(Throwable ignored){}
      Object body=zero(responseClass,response,"body");
      if(body!=null){
        Class<?> bc=Class.forName("okhttp3.ResponseBody");
        event(ctx,"CONTENT_TYPE",String.valueOf(zero(bc,body,"contentType")));
        event(ctx,"CONTENT_LENGTH",String.valueOf(zero(bc,body,"contentLength")));
        if(viewerPath || isPdf) {
          int bytes=isPdf?16:MAX_JSON_SAMPLE;
          try{
            Object peek=invoke(responseClass,response,"peekBody",new Class<?>[]{long.class},(long)bytes);
            if(isPdf){
              String prefix=String.valueOf(zero(bc,peek,"string"));
              event(ctx,"PDF_MAGIC",prefix.startsWith("%PDF-")?"PDF_MAGIC_CONFIRMED":"NOT_PDF_MAGIC");
              String printable=prefix.replaceAll("[^\\x20-\\x7e]","?");
              event(ctx,"CONTENT_PREFIX_ASCII",trunc(printable,24));
            }else{
              String text=String.valueOf(zero(bc,peek,"string"));
              event(ctx,"RESPONSE_PEEK_CHARS",String.valueOf(text.length()));
              jsonDetails(ctx+"_RESPONSE",text);
            }
          }catch(Throwable t){event(ctx,"BODY_PEEK_ERROR",cause(t));}
        }
      }else event(ctx,"RESPONSE_BODY","none");
    }catch(Throwable instrumentError) {
      event(ctx,"RESPONSE_INSTRUMENTATION_ERROR",cause(instrumentError));
    }
    event(ctx,"END","ok");
    return response;
  }
  public static void pdfPath(String url){
    event("VIEWER_MODEL","PDF_PATH_URL_REDACTED",safeUrl(url));
    event("VIEWER_MODEL","PDF_PATH_FINGERPRINT",fingerprint(url));
  }
}
