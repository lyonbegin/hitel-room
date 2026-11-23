package com.hitel.zocbodiag;

import android.os.SystemClock;
import java.lang.reflect.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * On-device instrumentation of original Zocbo's OkHttp clients.
 * Does not alter requests, headers, cookies, responses or server permissions.
 * Full target URL is logged only to the app's existing local diagnostic log.
 */
public final class NetTrace {
  private static final String API = "VIEWER_FILE_PATH";
  private static final Pattern PDF_PATH =
      Pattern.compile("\"pdf_path\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"", Pattern.CASE_INSENSITIVE);
  private NetTrace(){}

  public static void apiClient(Object builder) { attach(builder, "VIEWER_FILE_PATH"); }
  public static void pdfClient(Object builder) { attach(builder, "PDF_DOWNLOAD"); }

  private static String err(Throwable t) {
    if(t instanceof InvocationTargetException && ((InvocationTargetException)t).getTargetException()!=null)
      t=((InvocationTargetException)t).getTargetException();
    String m=t.getMessage();
    return t.getClass().getSimpleName()+" "+(m==null?"":m.substring(0,Math.min(m.length(),400)));
  }
  private static String limit(String s,int max){return s.length()>max?s.substring(0,max)+"[TRUNCATED]":s;}
  private static Object call(Class<?> klass,Object target,String name,Class<?>[] sig,Object...args) throws Throwable {
    try{return klass.getMethod(name,sig).invoke(target,args);}
    catch(InvocationTargetException e){throw e.getTargetException();}
  }
  private static Object call0(Class<?> klass,Object target,String name) throws Throwable {
    return call(klass,target,name,new Class<?>[0]);
  }
  private static void attach(Object builder,final String purpose) {
    try {
      if(builder==null){Diag.log("PDF_TRACE_HOOK_ERROR",purpose+" null builder");return;}
      final Class<?> intr=Class.forName("okhttp3.Interceptor");
      Object obj=Proxy.newProxyInstance(intr.getClassLoader(),new Class<?>[]{intr},
        new InvocationHandler(){
          public Object invoke(Object p,Method m,Object[] argv)throws Throwable {
            String n=m.getName();
            if(n.equals("toString"))return "HITEL_"+purpose+"_interceptor";
            if(n.equals("hashCode"))return System.identityHashCode(p);
            if(n.equals("equals"))return argv!=null&&argv.length==1&&p==argv[0];
            if(!n.equals("intercept")||argv==null||argv.length!=1)
              throw new IllegalStateException("unexpected method "+n);
            return intercept(argv[0],purpose);
          }
        });
      builder.getClass().getMethod("addInterceptor",intr).invoke(builder,obj);
      Diag.log("PDF_TRACE_HOOK_OK",purpose+" original OkHttp builder="+builder.getClass().getName());
    }catch(Throwable t) {
      Diag.log("PDF_TRACE_HOOK_ERROR",purpose+" "+err(t));
    }
  }
  private static Object intercept(Object chain,String purpose)throws Throwable {
    Class<?> chainClass=Class.forName("okhttp3.Interceptor$Chain");
    Class<?> reqClass=Class.forName("okhttp3.Request");
    Class<?> resClass=Class.forName("okhttp3.Response");
    Object req=call0(chainClass,chain,"request");
    String method=String.valueOf(call0(reqClass,req,"method"));
    String url=String.valueOf(call0(reqClass,req,"url"));
    boolean relevant=purpose.equals("PDF_DOWNLOAD")||url.contains(API);
    if(relevant){
      Diag.log(purpose+"_REQUEST_METHOD",method);
      Diag.log(purpose+"_REQUEST_URL_FULL",url);
      if(purpose.equals("VIEWER_FILE_PATH")){
        try{
          Object body=call0(reqClass,req,"body");
          Diag.log("VIEWER_FILE_PATH_REQUEST_JSON",requestBody(body));
        }catch(Throwable t){Diag.log("VIEWER_FILE_PATH_REQUEST_ERROR",err(t));}
      }
    }
    long start=SystemClock.elapsedRealtime();
    try{
      Object res=call(chainClass,chain,"proceed",new Class<?>[]{reqClass},req);
      if(relevant){
        try{
          Object status=call0(resClass,res,"code");
          Diag.log(purpose+"_HTTP_STATUS",String.valueOf(status));
          Diag.log(purpose+"_ELAPSED_MS",String.valueOf(SystemClock.elapsedRealtime()-start));
          Object body=call0(resClass,res,"body");
          if(body!=null){
            Class<?> rb=Class.forName("okhttp3.ResponseBody");
            try{Diag.log(purpose+"_CONTENT_TYPE",String.valueOf(call0(rb,body,"contentType")));}
            catch(Throwable ignored){}
            try{Diag.log(purpose+"_CONTENT_LENGTH",String.valueOf(call0(rb,body,"contentLength")));}
            catch(Throwable ignored){}
          }
          if(purpose.equals("VIEWER_FILE_PATH")){
            try{
              Object peek=call(resClass,res,"peekBody",new Class<?>[]{long.class},Long.valueOf(131072L));
              String json=String.valueOf(call0(Class.forName("okhttp3.ResponseBody"),peek,"string"));
              Diag.log("VIEWER_FILE_PATH_RESPONSE_JSON",limit(json,140000));
              Matcher matcher=PDF_PATH.matcher(json);
              if(matcher.find())Diag.log("VIEWER_FILE_PATH_PDF_PATH_RAW",matcher.group(1));
              else Diag.log("VIEWER_FILE_PATH_PDF_PATH_RAW","not present in first 128 KiB");
            }catch(Throwable t){
              Diag.log("VIEWER_FILE_PATH_RESPONSE_ERROR",err(t));
            }
          }
        }catch(Throwable t){Diag.log(purpose+"_HTTP_LOG_ERROR",err(t));}
      }
      return res;
    }catch(Throwable t){
      if(relevant)
        Diag.log(purpose+"_NETWORK_ERROR","type="+err(t)+" elapsedMs="+
          (SystemClock.elapsedRealtime()-start)+" url="+url);
      throw t;
    }
  }
  private static String requestBody(Object body)throws Throwable {
    if(body==null)return "[null]";
    Class<?> cls=Class.forName("okhttp3.RequestBody");
    try{
      Object bytes=call0(cls,body,"contentLength");
      if(bytes instanceof Number && ((Number)bytes).longValue()>131072L)
        return "[request body larger than 128 KiB]";
    }catch(Throwable ignored){}
    Object buffer=Class.forName("okio.Buffer").getConstructor().newInstance();
    call(cls,body,"writeTo",new Class<?>[]{Class.forName("okio.BufferedSink")},buffer);
    return limit(String.valueOf(call0(Class.forName("okio.Buffer"),buffer,"readUtf8")),131072);
  }
  public static void pdfPath(String path){
    if(path==null)Diag.log("VIEWER_MODEL_GET_PDF_PATH","null");
    else Diag.log("VIEWER_MODEL_GET_PDF_PATH",path);
  }
}
