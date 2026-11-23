package com.hitel.zocbodiag;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;
import java.util.UUID;

/**
 * R19: metadata collection INSIDE the real Zocbo application's own WebView.
 * Neither launches a new Activity nor instantiates a second WebView.
 * Original MainActivity, CommonWebviewActivity, cookies, app bridge, login,
 * and page navigation remain the only UI/session path.
 *
 * First page and chosen original region scopes are saved independently;
 * this class does NOT assert that an entire region or all pages were collected.
 */
public final class OriginalInAppMetadataCollector {
  private static final Map<WebView,OriginalInAppMetadataCollector> HOLDERS=new WeakHashMap<>();
  private static WeakReference<OriginalInAppMetadataCollector> mostRecent=new WeakReference<>(null);
  private static volatile boolean pendingQaNine=false;
  static void requestEmulatorAutoNine() {
    if(ReadingCollectorQaProof.emulator())pendingQaNine=true;
  }
  private static final String[] SITES={"M","H"};
  private static final int REGION_COUNT=9;
  private static final String RUN="original-in-app-nine-seoul-2026-v1";
  private final WeakReference<WebView> webRef;
  private final Handler ui=new Handler(Looper.getMainLooper());
  private final ReadingCollectorStore store;
  private final String nonce=UUID.randomUUID().toString();
  private boolean active=false,awaitingRegion=false,awaitingSnapshot=false;
  private int siteIdx=0,regionIdx=0,retries=0;
  private String selected="",sourceUrl="";
  private final List<String> regionNames=new ArrayList<>();
  private final List<Integer> originalTabs=new ArrayList<>();

  private OriginalInAppMetadataCollector(WebView w) {
    webRef=new WeakReference<>(w);
    store=new ReadingCollectorStore(w.getContext());
  }
  public static synchronized void attach(WebView web) {
    if(web==null)return;
    if(HOLDERS.containsKey(web))return;
    OriginalInAppMetadataCollector c=new OriginalInAppMetadataCollector(web);
    web.addJavascriptInterface(c,"hitelOriginalList");
    HOLDERS.put(web,c);
    Diag.log("ORIGINAL_LIST_BRIDGE_ATTACHED","existing-original-WebView-only");
  }
  private static boolean previous(String u) {
    if(!NativePdfTitleBridge.isFreeReadingPage(u))return false;
    try {return "/exam/school/previousExam.asp".equalsIgnoreCase(android.net.Uri.parse(u).getPath());}
    catch(Throwable t){return false;}
  }
  private static String js(String code) {
    return code.replace("hitelCollectorNative","hitelOriginalList");
  }
  private void event(String stage,String detail) {
    String v="stage="+stage+" site="+SITES[Math.min(siteIdx,1)]
      +" region_position="+(regionIdx+1)+"/"+REGION_COUNT
      +" region="+ReadingCollectorStore.sanitize(selected,40)
      +" db_live="+store.countLive()
      +" areas="+store.countAreas(RUN)+" "+ReadingCollectorStore.sanitize(detail,130);
    Log.i("ZocboInApp",v);
    Diag.log("ORIGINAL_IN_APP_"+stage,v);
  }
  public static void onOriginalPageFinished(WebView w,String url) {
    if(w==null)return;
    OriginalInAppMetadataCollector c;
    synchronized(OriginalInAppMetadataCollector.class) {c=HOLDERS.get(w);}
    if(c==null)return;
    if(ReadingAreaSelector.isSelector(url)) {
      if(c.active) c.ui.postDelayed(()->c.scan(),850);
      return;
    }
    if(previous(url)) {
      c.sourceUrl=url;
      if(c.active&&c.awaitingRegion){c.awaitingRegion=false;c.awaitingSnapshot=true;}
      mostRecent=new WeakReference<>(c);
      // Wait until the ORIGINAL site's scripts and list DOM are present.
      c.retries=0;
      c.ui.postDelayed(()->c.capture(),600);
    }
  }
  private void capture() {
    WebView w=webRef.get();
    if(w==null||!previous(w.getUrl()))return;
    try {
      w.evaluateJavascript(js(ReadingOriginalPageCapture.script(nonce)),v->
        Diag.log("ORIGINAL_IN_APP_SNAPSHOT_JS",v==null?"null":ReadingCollectorStore.sanitize(v,110)));
    }catch(Throwable t) {event("BLOCKED","snapshot JS "+t.getClass().getSimpleName());active=false;}
  }
  @JavascriptInterface public void snapshot(String auth,String payload) {
    if(!nonce.equals(auth)||payload==null||payload.length()>220000)return;
    ui.post(()->{
      WebView w=webRef.get();
      if(w==null||!previous(w.getUrl()))return;
      try {
        JSONObject j=new JSONObject(payload);
        JSONArray rows=j.optJSONArray("rows");
        if(rows==null)throw new IllegalStateException("Original DOM rows absent");
        if(rows.length()==0){
          if(++retries<5) {ui.postDelayed(()->capture(),1300);return;}
          if(active)stop("original selected area rendered no rows (cannot verify region first page)");
          else event("NO_ROWS","original current page yielded zero real exam IDs");
          return;
        }
        String site=j.optString("site",""),grade=j.optString("grade","");
        String year=j.optString("year",""),term=j.optString("term",""),subject=j.optString("subject","");
        if(!site.matches("[MH]")||!grade.matches("[123]")||!year.matches("[0-9]{4}")||
           !term.matches("(1M|1E|2M|2E)")||!subject.matches("[A-Z]{2}"))
          throw new IllegalStateException("Original page filter values incomplete");
        String key="original-in-app-firstpage-"+site+"-"+year+"-"+grade+"-"+term+"-"+subject
          +(active?"-region-"+siteIdx+"-"+regionIdx:"-observed");
        ReadingCollectorStore.Progress p=new ReadingCollectorStore.Progress();
        p.page=2;p.pagesDone=1;p.rowsSeen=rows.length();
        int saved=store.savePage(key,p,rows,site,grade,year,term,subject,
          "LIVE_ORIGINAL_EMBEDDED_WEBVIEW_PAGE1");
        event("PAGE1_SQLITE_COMMIT","observed_rows="+rows.length()+" persisted="+saved);
        if(!active&&pendingQaNine&&ReadingCollectorQaProof.emulator()) {
          pendingQaNine=false;
          ui.postDelayed(()->start(),750);
          event("QA_AUTO_NINE_AFTER_AUTHENTIC_PAGE1","original source IDs verified first");
        }
        if(!active||!awaitingSnapshot)return;
        String schools=j.optString("schools","").trim();
        String city=j.optString("city","").trim();
        String district=j.optString("district","").trim();
        String filter=j.optString("filter","").trim();
        if(schools.length()==0||(city.length()==0&&filter.length()==0))
          throw new IllegalStateException("Original area school IDs/region filter not available");
        ReadingCollectorController.AreaScope area=new ReadingCollectorController.AreaScope(
          selected,SITES[siteIdx],schools,city,district,filter,j.optString("paid","N"),
          grade,year,term,subject,rows);
        area.ordinal=originalTabs.get(regionIdx);
        store.saveArea(RUN,siteIdx*REGION_COUNT+regionIdx,area);
        event("REGION_SCOPE_COMMITTED","original_tab="+area.ordinal+
          " real_first_page="+rows.length());
        awaitingSnapshot=false;
        regionIdx++;
        if(regionIdx>=REGION_COUNT) {regionIdx=0;siteIdx++;originalTabs.clear();}
        if(siteIdx>=SITES.length) {
          active=false;
          event("FIRST_PAGES_FINISHED","only first real pages verified; pagination NOT yet complete");
        }else ui.postDelayed(()->openSelector(),650);
      }catch(Throwable t){if(active)stop("snapshot/store: "+t.getClass().getSimpleName());
        else event("SOURCE_SNAPSHOT_FAILED",t.getClass().getSimpleName());}
    });
  }
  @JavascriptInterface public void snapshotError(String auth,String error) {
    if(nonce.equals(auth))ui.post(()->{if(active)stop("JS snapshot "+error);else event("SOURCE_JS_ERROR",error);});
  }
  /** Triggered by the original app's existing diagnostic toolbar, never a new Activity. */
  public static void startNineFromOriginalApp() {
    OriginalInAppMetadataCollector c=mostRecent.get();
    if(c==null||c.webRef.get()==null||!previous(c.webRef.get().getUrl())){
      Diag.log("ORIGINAL_IN_APP_NOT_READY","Open original Zocbo free-reading list in its original MainActivity first");
      return;
    }
    c.start();
  }
  private void start() {
    if(active)return;
    active=true;siteIdx=0;regionIdx=0;awaitingRegion=false;awaitingSnapshot=false;
    regionNames.clear();originalTabs.clear();
    event("START","source-original-common-WebView only");
    openSelector();
  }
  private void openSelector() {
    if(!active)return;
    WebView w=webRef.get();
    if(w==null){stop("source WebView vanished");return;}
    awaitingRegion=false;awaitingSnapshot=false;
    String url=ReadingAreaSelector.page(sourceUrl,SITES[siteIdx],2026);
    event("OPEN_ORIGINAL_SELECTOR","from original app session");
    w.loadUrl(url);
    final int s=siteIdx,i=regionIdx;
    ui.postDelayed(()->{
      if(active&&s==siteIdx&&i==regionIdx&&!awaitingSnapshot)
        stop("Source region selector did not produce a region page in 20 seconds");
    },20000);
  }
  private void scan() {
    if(!active)return;
    WebView w=webRef.get();
    if(w==null||!ReadingAreaSelector.isSelector(w.getUrl()))return;
    w.evaluateJavascript(js(ReadingAreaSelector.scan(nonce)),null);
  }
  @JavascriptInterface public void areaCandidates(String auth,String json) {
    if(!nonce.equals(auth)||json==null||json.length()>190000)return;
    ui.post(()->{
      if(!active)return;
      try {
        JSONArray a=new JSONArray(json);
        if(a.length()<REGION_COUNT) {stop("Original selector has fewer than nine regions");return;}
        ArrayList<Integer> chosen=new ArrayList<>();
        int seoul=-1;
        for(int i=0;i<a.length();i++){
          JSONObject v=a.optJSONObject(i);
          if(v==null)continue;
          String name=v.optString("name","");
          if("서울".equals(name)||"서울특별시".equals(name)){seoul=i;break;}
        }
        if(seoul<0){stop("Seoul missing in original source selector");return;}
        chosen.add(seoul);
        for(int i=0;i<a.length()&&chosen.size()<REGION_COUNT;i++){
          if(i!=seoul&&a.optJSONObject(i)!=null
             &&!a.optJSONObject(i).optString("name","").trim().isEmpty())chosen.add(i);
        }
        if(chosen.size()!=REGION_COUNT)throw new IllegalStateException("Only partial original region list");
        if(originalTabs.isEmpty())originalTabs.addAll(chosen);
        else if(!originalTabs.equals(chosen))throw new IllegalStateException("Original region order changed");
        if(regionNames.isEmpty())for(int idx:chosen)regionNames.add(a.getJSONObject(idx).optString("name",""));
        else for(int n=0;n<REGION_COUNT;n++)
          if(!regionNames.get(n).equals(a.getJSONObject(chosen.get(n)).optString("name","")))
            throw new IllegalStateException("Original region names changed");
        selected=regionNames.get(regionIdx);
        awaitingRegion=true;
        event("ORIGINAL_REGION_CLICK","source_tab="+chosen.get(regionIdx)+" source_count="+a.length());
        WebView w=webRef.get();
        if(w==null)throw new IllegalStateException("WebView vanished");
        w.evaluateJavascript(js(ReadingAreaSelector.click(nonce,chosen.get(regionIdx))),null);
      }catch(Throwable t){stop("Original selector parsed: "+t.getClass().getSimpleName());}
    });
  }
  @JavascriptInterface public void areaClick(String auth,String label) {
    if(nonce.equals(auth))Diag.log("ORIGINAL_REGION_REAL_CLICK",
      ReadingCollectorStore.sanitize(label,80));
  }
  @JavascriptInterface public void areaError(String auth,String detail) {
    if(nonce.equals(auth))ui.post(()->stop("Original regionFilter() click failed: "+detail));
  }
  private void stop(String error) {
    if(!active)return;
    active=false;awaitingRegion=false;awaitingSnapshot=false;
    event("BLOCKED",error);
  }
}
