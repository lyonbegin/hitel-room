package com.hitel.zocbodiag;
import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.webkit.*;
import android.widget.Toast;
import java.io.*;
import java.lang.ref.WeakReference;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.zip.*;

/** Local, opt-in WebView forensic tools. Captures only after the owner presses a button.
 * A full DOM may contain sensitive content. Never upload these files automatically.
 * DevTools sees more than JavaScript hooks: enable only for trusted USB debugging.
 */
public final class WebForensic {
 private WebForensic(){}
 private static Context app;
 private static WeakReference<WebView> active=new WeakReference<WebView>(null);
 private static final Set<WebView> bound=Collections.newSetFromMap(new WeakHashMap<WebView,Boolean>());
 private static boolean netOn=false,devOn=false;
 private static String dumpId="",fileName="";
 private static OutputStream output=null;
 private static long bytes=0,netBytes=0;
 private static final String SESSION=new SimpleDateFormat("yyyyMMdd_HHmmss",Locale.US).format(new Date());
 private static File dir(){File d=new File(app.getFilesDir(),"zocbo_capture_"+SESSION);d.mkdirs();return d;}
 private static void log(String s,String v){Diag.log("CAPTURE_"+s,v);}
 private static String scrub(String str){
  if(str==null)return "";
  String s=str.replaceAll("(?i)(authorization|cookie|set-cookie|access_token|refresh_token|id_token|onetime_token_key|password|sessionid|CID)([\\\"'\\\\s:=]+)([^,;\\\\s\\\"'&}]{2,})","$1$2[REDACTED]");
  s=s.replaceAll("(?i)([?&](?:onetime_token_key|access_token|refresh_token|id_token|password|CID|sessionid)=)[^&#]+","$1[REDACTED]");
  return s;
 }
 private static String urlPath(String s){try{Uri u=Uri.parse(s);return u.getScheme()+"://"+u.getHost()+u.getPath();}catch(Exception e){return "[unavailable]";}}
 public static synchronized void init(Context c){if(app==null)app=c.getApplicationContext();}
 public static void bind(WebView w){
  if(w==null)return;init(w.getContext());synchronized(WebForensic.class){
   active=new WeakReference<WebView>(w);
   if(bound.add(w))try{w.addJavascriptInterface(new Bridge(),"hitelForensicBridge");log("BRIDGE","registered");}catch(Throwable t){log("BRIDGE_ERROR",t.getClass().getSimpleName());}
  }
 }
 public static void started(WebView w,String url){bind(w);if(netOn && isSite(url))installJS(w);}
 public static void finished(WebView w,String url){bind(w);if(netOn && isSite(url))installJS(w);}
 private static boolean isSite(String url){return url!=null && url.startsWith("https://m.zocbo.com/");}
 public static synchronized boolean networkOn(){return netOn;}
 public static synchronized boolean devtoolsOn(){return devOn;}
 public static void toggleNetwork(Activity a){
  init(a);boolean on;synchronized(WebForensic.class){netOn=!netOn;on=netOn;}
  if(on){WebView w=active.get();if(w!=null)installJS(w);}
  log("NETWORK",on?"ON":"OFF");
  Toast.makeText(a,on?"XHR·fetch 감시 ON: 이 시점 이후 기록":"XHR·fetch 감시 OFF",Toast.LENGTH_LONG).show();
 }
 public static void toggleDevTools(Activity a){
  init(a);boolean on;synchronized(WebForensic.class){devOn=!devOn;on=devOn;}
  try{WebView.setWebContentsDebuggingEnabled(on);log("DEVTOOLS",on?"ON chrome://inspect/#devices":"OFF");
   Toast.makeText(a,on?"PC Chrome: chrome://inspect/#devices → inspect":"DevTools OFF",Toast.LENGTH_LONG).show();
  }catch(Throwable e){log("DEVTOOLS_ERROR",e.getClass().getSimpleName());}
 }
 private static final String NET_JS="(function(){\nif(window.__hitelNetRecorderInstalled)return \"already\";\nif(location.hostname!==\"m.zocbo.com\")return \"other_host\";\nif(!window.hitelForensicBridge)return \"bridge_missing\";\nwindow.__hitelNetRecorderInstalled=true;\nvar B=window.hitelForensicBridge;\nfunction emit(x){try{B.event(JSON.stringify(x));}catch(e){}}\nfunction small(s,n){try{return String(s==null?\"\":s).slice(0,n||80000);}catch(e){return \"[unreadable]\";}}\nfunction safeUrl(s){try{var u=new URL(s,location.href);[\"onetime_token_key\",\"access_token\",\"refresh_token\",\"id_token\",\"CID\",\"password\",\"sessionid\"].forEach(function(k){if(u.searchParams.has(k))u.searchParams.set(k,\"[REDACTED]\")});return u.href}catch(e){return small(s,250)}}\nvar originalFetch=window.fetch;\nif(originalFetch)window.fetch=function(input,init){var start=Date.now(),url=(typeof input===\"string\")?input:(input&&input.url)||\"\",method=(init&&init.method)||(input&&input.method)||\"GET\";\nreturn originalFetch.apply(this,arguments).then(function(r){\nvar ev={type:\"FETCH\",url:safeUrl(url),method:method,status:r.status,ms:Date.now()-start};\ntry{var ct=r.headers.get(\"content-type\")||\"\",len=Number(r.headers.get(\"content-length\")||0);\nif(/json|text|html|xml|javascript/i.test(ct)&&(!len||len<120000)){r.clone().text().then(function(t){ev.response=small(t,100000);emit(ev)},function(e){ev.error=small(e,300);emit(ev)})}else emit(ev)\n}catch(e){emit(ev)}return r;},function(e){emit({type:\"FETCH_ERROR\",url:safeUrl(url),method:method,error:small(e,300),ms:Date.now()-start});throw e})};\nvar X=window.XMLHttpRequest;\nif(X&&X.prototype){var op=X.prototype.open,sn=X.prototype.send;\nX.prototype.open=function(method,url){this.__hitelNet={type:\"XHR\",method:String(method),url:safeUrl(url),start:Date.now()};return op.apply(this,arguments)};\nX.prototype.send=function(body){var req=this,ev=req.__hitelNet||{type:\"XHR\"};\nev.requestBody=(typeof body===\"string\")?small(body,10000):(body?\"[binary/form-data]\":\"[empty]\");\nreq.addEventListener(\"loadend\",function(){ev.status=req.status;ev.ms=Date.now()-(ev.start||Date.now());\ntry{ev.response=(req.responseType===\"\"||req.responseType===\"text\")?small(req.responseText,100000):\"[nontext]\"\n}catch(e){ev.response=\"[unavailable]\"}emit(ev)},{once:true});\nreturn sn.apply(this,arguments)}}\nemit({type:\"MONITOR_READY\",path:location.pathname,time:Date.now()});return \"installed\";\n})()";
 private static void installJS(WebView w){
  try{w.evaluateJavascript(NET_JS,new ValueCallback<String>(){public void onReceiveValue(String result){log("JS_HOOK",String.valueOf(result).substring(0,Math.min(String.valueOf(result).length(),80)));}});}
  catch(Throwable t){log("JS_ERROR",t.getClass().getSimpleName());}
 }

 /** Fetches same-origin public JavaScript/CSS assets from within already signed-in WebView.
  * No token export, no extra login, no calls to viewing/usage metering endpoints. */
 private static final String ALL_JS_SOURCE_SCRIPT="(function(){\n\"use strict\";\nvar B=window.hitelForensicBridge;\nif(!B){return \"bridge_missing\";}\nif(location.origin!==\"https://m.zocbo.com\"){return \"wrong_origin\";}\nvar id=\"CAPTURE_ID\";\nvar assets=[],seen={};\nfunction add(type,src){\n try{\n  var u=new URL(src,location.href);\n  if(u.origin!==location.origin)return;\n  var k=u.href;if(seen[k])return;seen[k]=true;\n  assets.push({type:type,url:u.href,path:u.pathname});\n }catch(e){}\n}\nArray.prototype.forEach.call(document.querySelectorAll(\"script[src]\"),function(e){add(\"js\",e.src)});\nArray.prototype.forEach.call(document.querySelectorAll('link[rel~=\"stylesheet\"][href]'),function(e){add(\"css\",e.href)});\nfunction sendFile(name,value){\n B.begin(id,name,value.length);\n for(var k=0;k<value.length;k+=8000){\n  var chunk=value.slice(k,k+8000);\n  if(chunk.length && chunk.charCodeAt(chunk.length-1)>=0xD800 && chunk.charCodeAt(chunk.length-1)<=0xDBFF)chunk=value.slice(k,k+7999);\n  B.part(id,name,chunk);\n }\n B.end(id,name);\n}\nvar report={started:new Date().toISOString(),page_path:location.pathname,found:assets.length,entries:[]};\nfunction safeName(a,n){\n var t=(a.path.split(\"/\").pop()||\"source\").replace(/[^A-Za-z0-9._-]/g,\"_\").slice(0,75);\n if(!/\\.(js|css)$/i.test(t))t+=\".\"+a.type;\n return \"asset_\"+(\"000\"+n).slice(-3)+\"_\"+t;\n}\nvar position=0;\nfunction next(){\n if(position>=assets.length){\n  sendFile(\"js_collection_manifest.json\",JSON.stringify(report,null,2));\n  B.assetsDone(id,JSON.stringify({found:report.found,success:report.entries.filter(function(e){return e.status===\"saved\"}).length,failed:report.entries.filter(function(e){return e.status!==\"saved\"}).length}));\n  return;\n }\n var index=position++,item=assets[index],out={type:item.type,path:item.path,name:safeName(item,index),status:\"pending\"};\n report.entries.push(out);\n fetch(item.url,{method:\"GET\",credentials:\"same-origin\",cache:\"force-cache\"}).then(function(r){\n  out.http_status=r.status;out.content_type=r.headers.get(\"content-type\")||\"\";\n  if(!r.ok)throw Error(\"HTTP_\"+r.status);\n  return r.text();\n }).then(function(body){\n  if(body.length>2*1024*1024){out.status=\"too_large\";out.chars=body.length;}\n  else{\n   sendFile(out.name,body);\n   out.status=\"saved\";out.chars=body.length;\n   if(/무료\\s*회원.{0,150}?(?:하루.{0,100}?)?3\\s*회|previous[-_ ]?viewer[-_ ]?not[-_ ]?auth/i.test(body))out.has_free_modal_markers=true;\n  }\n }).catch(function(err){out.status=\"error\";out.error=String(err&&err.message||err).slice(0,160);}).then(function(){\n  B.assetsProgress(id,JSON.stringify({completed:position,total:assets.length,saved:out.status===\"saved\",path:out.path}));\n  next();\n });\n}\nnext();\nreturn JSON.stringify({started:true,count:assets.length});\n})()";
 private static boolean assetsRunning=false;
 public static void collectPageSources(Activity a){
  init(a);
  WebView w=active.get();
  if(w==null||!isSite(w.getUrl())){Toast.makeText(a,"먼저 기출열람실을 여십시오",Toast.LENGTH_LONG).show();return;}
  String id=UUID.randomUUID().toString().replace("-","");
  synchronized(WebForensic.class){
   if(assetsRunning){Toast.makeText(a,"JS 파일 수집이 아직 진행 중입니다",Toast.LENGTH_LONG).show();return;}
   assetsRunning=true;closeOutput();dumpId=id;
  }
  log("JS_CAPTURE_START",urlPath(w.getUrl()));
  try {
   w.evaluateJavascript(ALL_JS_SOURCE_SCRIPT.replace("CAPTURE_ID",id),new ValueCallback<String>(){
    @Override public void onReceiveValue(String v){
     log("JS_CAPTURE_REQUEST",String.valueOf(v).substring(0,Math.min(100,String.valueOf(v).length())));
     if(String.valueOf(v).contains("bridge_missing")||String.valueOf(v).contains("wrong_origin")){
      synchronized(WebForensic.class){assetsRunning=false;}
     }
    }
   });
   Toast.makeText(a,"페이지의 JS·CSS 원문 수집을 시작했습니다",Toast.LENGTH_LONG).show();
  } catch(Throwable t){
   synchronized(WebForensic.class){assetsRunning=false;}
   log("JS_CAPTURE_ERROR",t.getClass().getSimpleName());
  }
 }
 private static synchronized void assetsProgress(String id,String details){
  if(!id.equals(dumpId))return;
  log("JS_ASSET_PROGRESS",String.valueOf(details).substring(0,Math.min(260,String.valueOf(details).length())));
 }
 private static synchronized void assetsDone(String id,String details){
  if(!id.equals(dumpId))return;
  closeOutput();assetsRunning=false;
  log("JS_CAPTURE_FINISHED",String.valueOf(details).substring(0,Math.min(260,String.valueOf(details).length())));
 }

 private static final String DUMP_JS="(function(){\nvar B=window.hitelForensicBridge;if(!B)return \"bridge_missing\";\nfunction txt(s){return String(s==null?\"\":s)}\nvar meta={at:new Date().toISOString(),url:location.href,title:document.title,readyState:document.readyState,\nscripts:Array.from(document.scripts||[]).map(function(x){return{src:x.src||\"\",inline:!x.src,type:x.type||\"\"}}),\nstyles:Array.from(document.querySelectorAll(\"link[rel=stylesheet]\")).map(function(x){return x.href}),\nframes:Array.from(document.querySelectorAll(\"iframe,frame\")).map(function(x){return x.src||\"\"}),\nimages:Array.from(document.images||[]).map(function(x){return x.src||\"\"}),\nresourceTiming:(performance.getEntriesByType(\"resource\")||[]).map(function(x){return {url:x.name,type:x.initiatorType,ms:x.duration,bytes:x.transferSize}})};\nfunction dump(name,value){B.begin(DUMP_ID,name,value.length);for(var i=0;i<value.length;i+=12000)B.part(DUMP_ID,name,value.slice(i,i+12000));B.end(DUMP_ID,name);}\nvar html=document.documentElement?document.documentElement.outerHTML:\"\";\ndump(\"current_page_DOM.html\",html);dump(\"page_resources.json\",JSON.stringify(meta,null,2));\nreturn JSON.stringify({htmlChars:html.length,resources:meta.resourceTiming.length,scriptTags:meta.scripts.length});\n})()";
 public static void dump(Activity a){
  init(a);WebView w=active.get();if(w==null||!isSite(w.getUrl())){Toast.makeText(a,"현재 족보닷컴 WebView를 찾지 못했습니다",Toast.LENGTH_LONG).show();return;}
  String id=UUID.randomUUID().toString().replace("-","");
  synchronized(WebForensic.class){if(assetsRunning){Toast.makeText(a,"JS 수집 종료 후 웹덤프를 실행하십시오",Toast.LENGTH_LONG).show();return;}closeOutput();dumpId=id;}
  log("DUMP_START",urlPath(w.getUrl()));
  try{w.evaluateJavascript(DUMP_JS.replace("DUMP_ID","'"+id+"'"),new ValueCallback<String>(){public void onReceiveValue(String r){log("DUMP_DONE",String.valueOf(r).substring(0,Math.min(String.valueOf(r).length(),220)));}});
   Toast.makeText(a,"현재 DOM·리소스 목록을 수집합니다",Toast.LENGTH_LONG).show();
  }catch(Throwable t){log("DUMP_ERROR",t.getClass().getSimpleName());}
 }
 private static void closeOutput(){try{if(output!=null)output.close();}catch(Exception ignored){}output=null;fileName="";}
 private static synchronized void begin(String id,String name){
  if(!id.equals(dumpId)||!(name.equals("current_page_DOM.html")||name.equals("page_resources.json")||name.equals("js_collection_manifest.json")||name.matches("asset_[0-9]{3}_[A-Za-z0-9._-]{1,90}\\.(?:js|css)")))return;
  closeOutput();
  try{output=new FileOutputStream(new File(dir(),name));fileName=name;bytes=0;}catch(Exception e){log("DUMP_WRITE_ERROR",e.getClass().getSimpleName());}
 }
 private static synchronized void part(String id,String name,String data){
  if(!id.equals(dumpId)||!name.equals(fileName)||output==null||data==null||data.length()>14000)return;
  byte[] b=data.getBytes(StandardCharsets.UTF_8);
  if(bytes+b.length>16L*1024*1024){log("DUMP_TRUNCATED","16MB");closeOutput();return;}
  try{output.write(b);bytes+=b.length;}catch(Exception e){log("DUMP_WRITE_ERROR",e.getClass().getSimpleName());closeOutput();}
 }
 private static synchronized void end(String id,String name){if(!id.equals(dumpId)||!name.equals(fileName))return;log("DUMP_FILE",fileName+" bytes="+bytes);closeOutput();}
 private static synchronized void event(String json){
  if(!netOn||app==null||json==null||json.length()>240000||netBytes>12L*1024*1024)return;
  byte[] b=(scrub(json)+"\n").getBytes(StandardCharsets.UTF_8);if(netBytes+b.length>12L*1024*1024)return;
  try(FileOutputStream o=new FileOutputStream(new File(dir(),"xhr_fetch.jsonl"),true)){o.write(b);netBytes+=b.length;}
  catch(Exception e){log("NETWORK_WRITE_ERROR",e.getClass().getSimpleName());}
 }
 public static final class Bridge{
  @JavascriptInterface public void begin(String id,String name,int size){WebForensic.begin(id,name);}
  @JavascriptInterface public void part(String id,String name,String text){WebForensic.part(id,name,text);}
  @JavascriptInterface public void end(String id,String name){WebForensic.end(id,name);}
  @JavascriptInterface public void event(String data){WebForensic.event(data);}
  @JavascriptInterface public void assetsProgress(String id,String info){WebForensic.assetsProgress(id,info);}
  @JavascriptInterface public void assetsDone(String id,String info){WebForensic.assetsDone(id,info);}
 }
 public static void save(Activity a){
  init(a);try{
   synchronized(WebForensic.class){if(assetsRunning){Toast.makeText(a,"JS 수집이 완료된 다음 ZIP 저장을 누르십시오",Toast.LENGTH_LONG).show();return;}closeOutput();}
   File[] files=dir().listFiles();if(files==null||files.length==0){Toast.makeText(a,"먼저 웹 덤프 또는 네트워크 감시를 실행하십시오",Toast.LENGTH_LONG).show();return;}
   String name="Zocbo_Web_Debug_"+SESSION+".zip";
   ContentValues values=new ContentValues();values.put(MediaStore.MediaColumns.DISPLAY_NAME,name);values.put(MediaStore.MediaColumns.MIME_TYPE,"application/zip");
   values.put(MediaStore.MediaColumns.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS);
   if(Build.VERSION.SDK_INT>=29)values.put(MediaStore.MediaColumns.IS_PENDING,1);
   Uri uri=a.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);if(uri==null)throw new IOException("NoDownloadUri");
   try(OutputStream out=a.getContentResolver().openOutputStream(uri);ZipOutputStream zip=new ZipOutputStream(out)){
    byte[] buf=new byte[8192];
    for(File f:files){if(!f.isFile())continue;zip.putNextEntry(new ZipEntry(f.getName()));try(InputStream in=new FileInputStream(f)){int n;while((n=in.read(buf))>0)zip.write(buf,0,n);}zip.closeEntry();}
    File diag=new File(a.getFilesDir(),"zocbo_free_exam_trace.txt");
    if(diag.exists()){zip.putNextEntry(new ZipEntry("app_log.txt"));try(InputStream in=new FileInputStream(diag)){int n;while((n=in.read(buf))>0)zip.write(buf,0,n);}zip.closeEntry();}
   }
   if(Build.VERSION.SDK_INT>=29){ContentValues done=new ContentValues();done.put(MediaStore.MediaColumns.IS_PENDING,0);a.getContentResolver().update(uri,done,null,null);}
   log("ZIP_SAVED","Download/"+name);Toast.makeText(a,"다운로드/"+name,Toast.LENGTH_LONG).show();
  }catch(Throwable t){log("ZIP_ERROR",t.getClass().getSimpleName());Toast.makeText(a,"ZIP 저장 실패: "+t.getClass().getSimpleName(),Toast.LENGTH_LONG).show();}
 }
}
