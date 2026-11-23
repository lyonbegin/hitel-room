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

  /** Observer of rendered DOM inside the already authorized original WebView.
   *  No request interception, cookie exposure, or authentication alteration. */
  private static final java.util.WeakHashMap<WebView,Boolean> probeBridges = new java.util.WeakHashMap<WebView,Boolean>();
  private static final String MODAL_JS = "(function(){\n if(window.__hitelZocboModalObserver){return \"already\";};\n var bridge=window.hitelZocboDiag;\n if(!bridge||typeof bridge.hit!==\"function\")return \"bridge_missing\";\n window.__hitelZocboModalObserver=true;\n var sent={};\n function emit(kind,s){try{\n   var val=String(s||\"\").replace(/[\\r\\n\\t]+/g,\" \").slice(0,450);\n   var key=kind+\"|\"+val;if(sent[key])return;sent[key]=true;\n   bridge.hit(\"FREE_MEMBER_THREE_\"+kind+\"|\"+val);\n }catch(e){}}\n function matches(s){return /(?:무료\\s*회원.{0,70}?하루.{0,50}?(?:3|세)\\s*회)|(?:하루.{0,30}?(?:3|세)\\s*회.{0,80}?열람)|(?:(?:3|세)\\s*회.{0,60}?열람)/i.test(String(s||\"\").replace(/\\s+/g,\" \"));}\n function scan(){\n  try{\n   var root=document.body;if(!root)return;\n   var text=root.innerText||\"\";\n   var m=text.replace(/\\s+/g,\" \").match(/.{0,85}(?:무료\\s*회원.{0,70}?하루.{0,40}?(?:3|세)\\s*회|하루.{0,25}?(?:3|세)\\s*회.{0,50}열람).{0,100}/i);\n   if(m)emit(\"BODY_MATCH\",m[0]);\n   var qs='dialog,[role=\"dialog\"],.modal,.popup,.pop,.layer,.alert,.dialog,.modal-content,.layer-popup';\n   var nodes=document.querySelectorAll(qs);\n   for(var i=0;i<nodes.length&&i<120;i++){\n    var node=nodes[i];var t=(node.innerText||node.textContent||\"\").replace(/\\s+/g,\" \");\n    if(matches(t)){\n      var pos=node.tagName+\"#\"+(node.id||\"\")+\".\"+(typeof node.className===\"string\"?node.className.slice(0,90):\"\");\n      emit(\"MODAL_ELEMENT\",pos+\"|\"+t.slice(0,240));\n    }\n   }\n  }catch(e){emit(\"PROBE_ERROR\",e.name);}\n }\n function scriptAudit(){\n  try {\n   if(!/exam|previous/i.test(location.pathname))return;\n   var scripts=document.scripts||[];\n   emit(\"SCRIPT_COUNT\",String(scripts.length)+\"|path=\"+location.pathname);\n   var paths=[];\n   for(var i=0;i<scripts.length&&i<90;i++){\n     var n=scripts[i];\n     if(n.src){try{paths.push(new URL(n.src,location.href).pathname.slice(0,130));}catch(e){}}\n     else if(matches(n.textContent||\"\")) emit(\"INLINE_SCRIPT_MATCH\",\"index=\"+i+\"|\"+\n       ((n.textContent||\"\").replace(/\\s+/g,\" \").match(/.{0,65}(?:무료\\s*회원|하루.{0,15}(?:3|세)\\s*회).{0,100}/i)||[\"phrase-in-inline-script\"])[0]);\n   }\n   emit(\"SCRIPT_PATHS\",paths.slice(0,14).join(\",\"));\n  }catch(e){}\n }\n scriptAudit();scan();\n var pending=false;\n var mo=new MutationObserver(function(){if(pending)return;pending=true;\n   setTimeout(function(){pending=false;scan();},180);\n });\n if(document.documentElement)mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[\"style\",\"class\",\"hidden\"]});\n window.addEventListener(\"load\",scan);\n return \"observer_installed\";\n})()";
  public static final class WebPageProbe {
    @android.webkit.JavascriptInterface
    public void hit(String message) {
      if(message == null || message.length()>900 || !message.startsWith("FREE_MEMBER_THREE_")) return;
      log("WEBPAGE_MODAL_PROBE",protect(message));
    }
  }
  public static void probeBeforeLoad(WebView w,String url) {
    if(w==null || url==null || !url.startsWith("https://m.zocbo.com/"))return;
    try {
      synchronized(probeBridges) {
        if(probeBridges.containsKey(w)) return;
        w.addJavascriptInterface(new WebPageProbe(),"hitelZocboDiag");
        probeBridges.put(w,Boolean.TRUE);
      }
      log("WEBPAGE_MODAL_BRIDGE","installed_before_navigation");
    } catch(Throwable t){log("WEBPAGE_MODAL_BRIDGE","error="+t.getClass().getSimpleName());}
  }
  public static void jsDialog(String message) {
    if(message==null)return;
    String normalized=message.replaceAll("\\s+"," ");
    if(normalized.contains("3회") || normalized.contains("세 회") || normalized.contains("무료회원"))
      log("WEBPAGE_JS_ALERT_MODAL",protect(normalized.substring(0,Math.min(350,normalized.length()))));
  }
  public static void inspectLivePage(WebView w,String currentUrl) {
    if(w==null || currentUrl==null || !currentUrl.startsWith("https://m.zocbo.com/"))return;
    try {
      w.evaluateJavascript(MODAL_JS,new android.webkit.ValueCallback<String>() {
        @Override public void onReceiveValue(String result) {
          log("WEBPAGE_MODAL_WATCHER",String.valueOf(result).substring(0,Math.min(90,String.valueOf(result).length())));
        }
      });
    } catch(Throwable t){log("WEBPAGE_MODAL_WATCHER","error="+t.getClass().getSimpleName());}
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
    WebForensic.started(w,currentUrl);
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
    inspectLivePage(w,currentUrl);
    WebForensic.finished(w,currentUrl);
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
      bar.setOrientation(LinearLayout.VERTICAL);
      bar.setBackgroundColor(Color.argb(220,17,30,45));
      Diag listener=new Diag(a);
      for(String[] labels:new String[][]{
        {"로그","복사","공유","지우기"},
        {"웹덤프","JS전체","통신감시","ZIP저장","DevTools"}
      }) {
        LinearLayout line=new LinearLayout(a);
        line.setOrientation(LinearLayout.HORIZONTAL);
        for(String label:labels) {
          Button btn=new Button(a);
          btn.setText(label);
          btn.setTag(label);
          btn.setTextSize(9);
          btn.setAllCaps(false);
          btn.setMinHeight(0);btn.setMinimumHeight(0);
          btn.setPadding(dp(a,1),0,dp(a,1),0);
          LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(dp(a,52),dp(a,37));
          line.addView(btn,bp);
          btn.setOnClickListener(listener);
        }
        bar.addView(line);
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
    if(op.equals("웹덤프")) { WebForensic.dump(activity); return; }
    if(op.equals("JS전체")) { WebForensic.collectPageSources(activity); return; }
    if(op.equals("통신감시")) { WebForensic.toggleNetwork(activity); return; }
    if(op.equals("ZIP저장")) { WebForensic.save(activity); return; }
    if(op.equals("DevTools")) { WebForensic.toggleDevTools(activity); return; }
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