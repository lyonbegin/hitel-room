package com.hitel.zocbodiag;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Source-instrumented on-device app-flow diagnostic. No credentials,
 * bearer tokens, CID raw contents, private session cookies, or payloads
 * are ever recorded, copied or written to disk.
 */
public final class Diag implements View.OnClickListener {
  private static final String FILE = "zocbo_free_exam_trace.txt";
  private static final String TAG = "hitel_zocbo_diag";
  private static final String PREVIOUS = "zocbo_free_exam_previous.txt";
  private static long rowSeq=0;
  private static boolean crashHookInstalled=false;
  private static final long startedAt=SystemClock.elapsedRealtime();
  private static Context app;
  private static final StringBuilder live = new StringBuilder(4096);
  private final Activity activity;

  private Diag(Activity a) { this.activity = a; }

  private static int dp(Activity a,int x) {
    return (int)(a.getResources().getDisplayMetrics().density*x+0.5f);
  }
  private static String stamp() {
    return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.KOREA).format(new Date());
  }
  private static String hash(String value) {
    try {
      byte[] d=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder b=new StringBuilder();
      for(int i=0;i<6;i++)b.append(String.format(Locale.US,"%02x",d[i]&0xff));
      return b.toString();
    } catch(Exception e) { return "unavailable"; }
  }
  private static String sensitive(String v) {
    if(v==null || v.length()==0) return "[missing]";
    return "[present;len="+v.length()+";sha256_12="+hash(v)+"]";
  }
  private static boolean allowed(String key) {
    return key.equalsIgnoreCase("search_webview") ||
      key.equalsIgnoreCase("SERVICETYPECD") ||
      key.equalsIgnoreCase("os-type") ||
      key.equalsIgnoreCase("app_version") ||
      key.equalsIgnoreCase("type") ||
      key.equalsIgnoreCase("siteid") ||
      key.equalsIgnoreCase("subject_cd") ||
      key.equalsIgnoreCase("menu_cd") ||
      key.equalsIgnoreCase("site_id");
  }
  private static String protect(String str) {
    if(str==null) return "";
    return str.replaceAll("(?i)(onetime_token_key|access_token|refresh_token|id_token|authorization|cookie|CID|device_id|session|authkey)=[^&\\s#]+", "$1=[REDACTED]");
  }
  private static String sanitizeUrl(String value) {
    if(value==null)return "[null]";
    try {
      if(value.startsWith("/"))return protect(value.length()>500?value.substring(0,500):value);
      if(!value.startsWith("https://") && !value.startsWith("http://"))
        return "[non-url;"+sensitive(value)+"]";
      Uri u=Uri.parse(value);
      String scheme=u.getScheme();
      if(scheme==null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
        return protect(value.length()>500?value.substring(0,500):value);
      }
      StringBuilder b=new StringBuilder();
      b.append(scheme).append("://").append(u.getHost()==null?"[no-host]":u.getHost());
      if(u.getPort()>0)b.append(":").append(u.getPort());
      b.append(u.getEncodedPath()==null?"/":u.getEncodedPath());
      try {
        boolean first=true;
        for(String name:u.getQueryParameterNames()) {
          if(first){b.append("?");first=false;}else b.append("&");
          String v=u.getQueryParameter(name);
          b.append(name).append("=").append(allowed(name)? protect(v) : sensitive(v));
        }
      } catch(Exception ignored) {b.append("?query-parse-failed");}
      return protect(b.toString());
    } catch(Exception e) {return "[url-sanitize-error]";}
  }
  public static synchronized void log(String category,String data) {
    String s=stamp()+" #"+(++rowSeq)+" t+"+(SystemClock.elapsedRealtime()-startedAt)+"ms"
      +" thr="+Thread.currentThread().getName()+" ["+category+"] "+data+"\n";
    live.append(s);
    if(live.length()>850000)live.delete(0,425000);
    try {
      if(category.endsWith("ERROR")||category.contains("EXCEPTION")||category.endsWith("HOOK_OK")
          ||category.contains("HTTP_STATUS")||category.contains("VIEWER_ACTIVITY"))
        android.util.Log.i(TAG,s.length()>950?s.substring(0,950):s);
    }catch(Throwable ignored){}
    if(app!=null) {
      try {
        File f=new File(app.getFilesDir(),FILE);
        if(f.length()>4000000) {
          File old=new File(app.getFilesDir(),PREVIOUS);
          if(old.exists())old.delete();
          if(!f.renameTo(old))android.util.Log.w(TAG,"trace rotate failed");
        }
        FileOutputStream stream=new FileOutputStream(f,true);
        try{stream.write(s.getBytes(StandardCharsets.UTF_8));}
        finally{stream.close();}
      }catch(Exception e){android.util.Log.w(TAG,"Internal trace file unavailable "+e.getClass().getSimpleName());}
    }
  }
  private static String readTail(File f,int maxBytes) throws IOException {
    if(f==null||!f.exists())return "";
    RandomAccessFile raf=new RandomAccessFile(f,"r");
    try {
      long len=raf.length(), start=Math.max(0,len-maxBytes);
      raf.seek(start);
      byte[] bytes=new byte[(int)(len-start)];
      raf.readFully(bytes);
      return (start>0?"\n[TRUNCATED FILE PREFIX; retained last "+bytes.length+" bytes]\n":"")
        +new String(bytes,StandardCharsets.UTF_8);
    }finally{raf.close();}
  }
  private static void copyFile(File src,FileOutputStream dst)throws IOException {
    if(src==null||!src.exists())return;
    FileInputStream in=new FileInputStream(src);
    try {
      byte[] buffer=new byte[32768];int n;
      while((n=in.read(buffer))!=-1)dst.write(buffer,0,n);
    }finally{in.close();}
  }
  private static synchronized String exportToExternal(Context context)throws IOException {
    File dir=context.getExternalFilesDir(null);
    if(dir==null)throw new IOException("app external files directory unavailable");
    if(!dir.exists()&&!dir.mkdirs())throw new IOException("cannot create external log folder");
    File target=new File(dir,"zocbo_full_trace_"+new SimpleDateFormat("yyyyMMdd_HHmmss",Locale.US).format(new Date())+".txt");
    FileOutputStream out=new FileOutputStream(target);
    try {
      out.write(("ZOCBO FULL NATIVE PDF DIAGNOSTICS\n"+
                 "This file contains redacted diagnostic metadata. It is not a PDF.\n\n").getBytes(StandardCharsets.UTF_8));
      copyFile(new File(context.getFilesDir(),PREVIOUS),out);
      copyFile(new File(context.getFilesDir(),FILE),out);
    }finally{out.close();}
    return target.getAbsolutePath()+" ("+target.length()+" bytes)";
  }
  private static synchronized void installCrashHook() {
    if(crashHookInstalled)return;
    crashHookInstalled=true;
    final Thread.UncaughtExceptionHandler previous=Thread.getDefaultUncaughtExceptionHandler();
    Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler(){
      @Override public void uncaughtException(Thread t,Throwable error) {
        try {
          StringBuilder b=new StringBuilder(error.getClass().getName()+": "+protect(String.valueOf(error.getMessage())));
          StackTraceElement[] stack=error.getStackTrace();
          for(int i=0;i<Math.min(stack.length,16);i++)
            b.append("\n at ").append(stack[i].getClassName()).append(".")
              .append(stack[i].getMethodName()).append(":").append(stack[i].getLineNumber());
          log("APP_UNCAUGHT_CRASH",b.toString());
        }catch(Throwable ignored){}
        if(previous!=null&&previous!=this)previous.uncaughtException(t,error);
      }
    });
    log("CRASH_TRACE_HOOK","installed, previousHandler="+String.valueOf(previous!=null));
  }
  public static void viewerLaunch(Activity a) {
    log("VIEWER_ACTIVITY","onResume class="+a.getClass().getName()
      +" sdk="+Build.VERSION.SDK_INT+" appElapsedMs="+(SystemClock.elapsedRealtime()-startedAt));
    try {
      Intent intent=a.getIntent();
      if(intent==null){log("VIEWER_INTENT","missing");return;}
      log("VIEWER_INTENT_ACTION",String.valueOf(intent.getAction()));
      if(intent.getDataString()!=null)log("VIEWER_INTENT_DATA",sanitizeUrl(intent.getDataString()));
      Bundle b=intent.getExtras();
      if(b==null){log("VIEWER_INTENT_EXTRAS","none");return;}
      log("VIEWER_INTENT_EXTRA_KEYS",String.valueOf(b.keySet()));
      for(String key:b.keySet()) {
        try {
          Object value=b.get(key);
          if(value==null){log("VIEWER_EXTRA_"+key,"null");continue;}
          String k=key.toUpperCase(Locale.US);
          String raw=String.valueOf(value);
          String display;
          if(k.contains("PAPR_NO")||k.contains("FILE_TYPE")||k.contains("QR")||
              k.contains("DEVICE")||k.contains("SHOW_ANSWER"))
            display=protect(raw);
          else if(k.contains("SHORT_URL"))display=sanitizeUrl(raw);
          else display=sensitive(raw);
          log("VIEWER_EXTRA_"+key,truncViewer(display)+" type="+value.getClass().getSimpleName());
        }catch(Throwable error){log("VIEWER_EXTRA_READ_ERROR",key+" "+error.getClass().getSimpleName());}
      }
    }catch(Throwable error){log("VIEWER_INTENT_ERROR",error.getClass().getName());}
  }
  private static String truncViewer(String s){return s.length()>1000?s.substring(0,1000)+"[TRUNCATED]":s;}
  public static void viewerPause(Activity a){log("VIEWER_ACTIVITY","onPause "+a.getClass().getName());}
  public static void viewerDestroy(Activity a){log("VIEWER_ACTIVITY","onDestroy "+a.getClass().getName());}
  public static void event(String category,String detail) {
    log(category,protect(detail==null?"":detail));
  }
  public static void bandwidth(int kbps) { log("NETWORK_GATE_DOWNSTREAM_KBPS","reported="+kbps+"; originalThreshold=100; diagnosticThreshold=0"); }
  public static void bridge() {log("JS_BRIDGE_goPreviousExam","invoked");}
  public static void webViewLink() {log("JS_BRIDGE_goWebViewLink","invoked");}
  public static void gate(boolean enabled) {
    log("GO_PREVIOUS_EXAM_ALLOWED",String.valueOf(enabled));
  }
  public static void jsInterface() {
    log("JS_INTERFACE_REGISTERED","name=zocbostudyaos");
  }
  public static void url(String url) {
    log("WEBVIEW_LOADURL",sanitizeUrl(url));
  }
  public static void cookie(String fullCookie) {
    if(fullCookie==null) {log("COOKIE_SET","null");return;}
    String first=fullCookie.split(";",2)[0];
    int i=first.indexOf('=');
    String name=i>=0?first.substring(0,i).trim():first.trim();
    String value=i>=0?first.substring(i+1):"";
    log("COOKIE_SET",name+"="+(allowed(name)?value:sensitive(value))+"; domain=.zocbo.com");
  }
  public static void cookieState() {
    try {
      String all=CookieManager.getInstance().getCookie("https://m.zocbo.com");
      if(all==null){log("COOKIE_SNAPSHOT","none");return;}
      StringBuilder b=new StringBuilder();
      for(String part:all.split(";")) {
        String v=part.trim();int i=v.indexOf('=');
        if(i<=0)continue;
        String name=v.substring(0,i);
        if(b.length()>0)b.append("; ");
        String val=v.substring(i+1);
        b.append(name).append("=").append(allowed(name)?protect(val):sensitive(val));
      }
      log("COOKIE_SNAPSHOT",b.toString());
    } catch(Exception e) {log("COOKIE_SNAPSHOT","unavailable:"+e.getClass().getSimpleName());}
  }
  public static void page(WebView w,String currentUrl) {
    log("ON_PAGE_STARTED",sanitizeUrl(currentUrl));
    try {
      String ua=w.getSettings().getUserAgentString();
      log("WEBVIEW_UA",ua==null?"null":protect(ua));
    } catch(Exception e) {log("WEBVIEW_UA","unavailable");}
    cookieState();
  }
  public static void pageFinished(WebView w,String currentUrl) {
    log("ON_PAGE_FINISHED",sanitizeUrl(currentUrl));
    cookieState();
  }
  private static synchronized String current() {
    StringBuilder b=new StringBuilder("ZOCBO_ORIGINAL_4.3.11(2)_NATIVE_PDF_DIAGNOSTIC\n"+
      "Redacted API/PDF/Viewer diagnostics. Full log can be exported using [저장].\n\n");
    if(app!=null){
      try {
        File latest=new File(app.getFilesDir(),FILE);
        File older=new File(app.getFilesDir(),PREVIOUS);
        if(older.exists() && latest.length()<350000){
          b.append("[PREVIOUS FILE TAIL]\n").append(readTail(older,100000)).append("\n");
        }
        if(latest.exists()){
          b.append("[CURRENT FILE TAIL]\n").append(readTail(latest,480000));
          b.append("\n[END OF COPIED TAIL; full file is available using 저장]\n");
          return b.toString();
        }
      }catch(Exception e){b.append("[log read error "+e.getClass().getSimpleName()+"]\n");}
    }
    b.append(live.length()>480000?live.substring(live.length()-480000):live.toString());
    return b.toString();
  }
  public static void install(Activity a) {
    synchronized(Diag.class) {
      if(app==null) {
        app=a.getApplicationContext();
        // Early WebView cookie/navigation events occur in onCreate, before the onResume UI.
        // Preserve them in the file so the clipboard contains the full trace.
        if(live.length()>0) {
          try {
            FileOutputStream early=new FileOutputStream(new File(app.getFilesDir(),FILE),true);
            try{early.write(live.toString().getBytes(StandardCharsets.UTF_8));}
            finally{early.close();}
          }catch(Exception ignored){}
        }
      }
    }
    installCrashHook();
    try {
      FrameLayout root=a.findViewById(android.R.id.content);
      if(root==null) {log("DIAG_UI","activity has no content root");return;}
      if(root.findViewWithTag(TAG)!=null)return;
      LinearLayout bar=new LinearLayout(a);
      bar.setTag(TAG);
      bar.setOrientation(LinearLayout.HORIZONTAL);
      bar.setBackgroundColor(Color.argb(215,17,30,45));
      Diag listener=new Diag(a);
      for(String label:new String[]{"로그","복사","공유","저장","지우기"}) {
        Button btn=new Button(a);
        btn.setText(label);
        btn.setTag(label);
        btn.setTextSize(10);
        btn.setMinHeight(0);btn.setMinimumHeight(0);
        btn.setPadding(dp(a,2),0,dp(a,2),0);
        LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(dp(a,51),dp(a,38));
        bar.addView(btn,bp);btn.setOnClickListener(listener);
      }
      FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.TOP|Gravity.RIGHT);
      lp.topMargin=dp(a,38);
      root.addView(bar,lp);
      log("DIAG_PANEL","installed Activity="+a.getClass().getName()+" Android="+Build.VERSION.SDK_INT);
      cookieState();
    } catch(Throwable t) {android.util.Log.w(TAG,"UI init failed: "+t.getClass().getSimpleName());}
  }
  @Override public void onClick(View v) {
    String op=String.valueOf(v.getTag());
    if(op.equals("지우기")) {
      synchronized(Diag.class){
        live.setLength(0);
        try{new File(activity.getFilesDir(),FILE).delete();new File(activity.getFilesDir(),PREVIOUS).delete();}catch(Exception ignored){}
      }
      log("TRACE_CLEAR","by user");
      Toast.makeText(activity,"진단 로그를 초기화했습니다",Toast.LENGTH_SHORT).show();
    }else if(op.equals("저장")) {
      try {String path=exportToExternal(activity);log("TRACE_EXPORT",path);Toast.makeText(activity,"전체 로그 저장 완료: "+path,Toast.LENGTH_LONG).show();}
      catch(Exception e){log("TRACE_EXPORT_ERROR",e.getClass().getSimpleName());Toast.makeText(activity,"로그 파일 저장 오류",Toast.LENGTH_LONG).show();}
    }else if(op.equals("복사")) {
      try{
        ClipboardManager cb=(ClipboardManager)activity.getSystemService(Context.CLIPBOARD_SERVICE);
        cb.setPrimaryClip(ClipData.newPlainText("zocbo diagnostic",current()));
        Toast.makeText(activity,"로그가 클립보드에 복사되었습니다",Toast.LENGTH_LONG).show();
      }catch(Exception e) {Toast.makeText(activity,"복사 오류",Toast.LENGTH_SHORT).show();}
    }else if(op.equals("공유")) {
      try{
        Intent send=new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT,current());
        activity.startActivity(Intent.createChooser(send,"진단 로그 전달"));
      }catch(Exception e){Toast.makeText(activity,"공유 오류",Toast.LENGTH_SHORT).show();}
    }else {
      ScrollView scroll=new ScrollView(activity);
      TextView txt=new TextView(activity);
      txt.setText(current());txt.setTextSize(11);txt.setTextIsSelectable(true);
      txt.setPadding(24,24,24,24);
      scroll.addView(txt);
      new AlertDialog.Builder(activity).setTitle("족보닷컴 진단 로그")
        .setView(scroll).setPositiveButton("닫기",null).show();
    }
  }
}