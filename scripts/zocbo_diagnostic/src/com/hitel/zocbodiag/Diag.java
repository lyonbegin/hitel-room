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
    String s=stamp()+" ["+category+"] "+data+"\n";
    live.append(s);
    if(live.length()>220000) live.delete(0,100000);
    if(app!=null) {
      try {
        File f=new File(app.getFilesDir(),FILE);
        if(f.length()>900000) {
          File old=new File(app.getFilesDir(),"zocbo_free_exam_previous.txt");
          if(old.exists())old.delete();
          f.renameTo(old);
        }
        FileOutputStream o=new FileOutputStream(f,true);
        try{o.write(s.getBytes(StandardCharsets.UTF_8));}
        finally{o.close();}
      } catch(Exception e) {android.util.Log.w(TAG,"Internal trace file unavailable");}
    }
  }
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
    StringBuilder b=new StringBuilder("ZOCBO_ORIGINAL_4.3.11(2)_DIAGNOSTIC\n"+
      "Only redacted metadata is recorded. Never paste credentials.\n\n");
    if(app!=null) {
      try {
        File f=new File(app.getFilesDir(),FILE);
        if(f.exists()) {
          FileInputStream is=new FileInputStream(f);
          ByteArrayOutputStream os=new ByteArrayOutputStream();
          byte[] buf=new byte[16384];int n;
          while((n=is.read(buf))!=-1) {
            os.write(buf,0,n);
            if(os.size()>300000)break;
          }
          is.close();
          b.append(os.toString("UTF-8"));
          return b.toString();
        }
      } catch(Exception ignored){}
    }
    b.append(live);
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
    try {
      FrameLayout root=a.findViewById(android.R.id.content);
      if(root==null) {log("DIAG_UI","activity has no content root");return;}
      if(root.findViewWithTag(TAG)!=null)return;
      LinearLayout bar=new LinearLayout(a);
      bar.setTag(TAG);
      bar.setOrientation(LinearLayout.HORIZONTAL);
      bar.setBackgroundColor(Color.argb(215,17,30,45));
      Diag listener=new Diag(a);
      for(String label:new String[]{"로그","복사","공유","지우기"}) {
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
        try{new File(activity.getFilesDir(),FILE).delete();}catch(Exception ignored){}
      }
      log("TRACE_CLEAR","by user");
      Toast.makeText(activity,"진단 로그를 초기화했습니다",Toast.LENGTH_SHORT).show();
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