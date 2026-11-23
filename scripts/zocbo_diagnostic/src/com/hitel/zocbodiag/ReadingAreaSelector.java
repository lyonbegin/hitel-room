package com.hitel.zocbodiag;

import android.net.Uri;
import org.json.JSONObject;
import java.util.Locale;

/**
 * Based on the ORIGINAL bundled cloudfront/js/app/ui.js regionFilter():
 *  left  = .region .tab__button [data-order]
 *  right = .region .tab__content [data-order]
 * The original handler synchronizes active tabs by data-order.
 *
 * Choose a province on the left, then ONLY the matching right tab's
 * city-wide '전체' row. No guessed numeric region/school identifiers.
 */
public final class ReadingAreaSelector {
  private ReadingAreaSelector(){}
  public static final String PATH="/exam/include/school/school_region_filter.asp";
  public static final String BASE="https://m.zocbo.com"+PATH;
  public static String page(String site){
    return BASE+"?SiteID="+("H".equals(site)?"H":"M")+"&Grade=3";
  }
  public static String page(String source,String site,int endYear){
    if(source==null||!NativePdfTitleBridge.isFreeReadingPage(source))return page(site);
    try {
      Uri original=Uri.parse(source);
      Uri.Builder b=original.buildUpon().path(PATH).clearQuery();
      // Same parameters the original #btn_addSchool_Region_Filter passes to
      // the region selector, except school/region-specific filters.
      for(String k:original.getQueryParameterNames()) {
        if("SiteID".equalsIgnoreCase(k)||"Grade".equalsIgnoreCase(k)||
          "scl_id".equalsIgnoreCase(k)||"filter_gugun".equalsIgnoreCase(k)||
          "Scl_ID".equalsIgnoreCase(k)||"search_scl_id".equalsIgnoreCase(k))continue;
        if(!k.matches("[A-Za-z0-9_-]{1,48}"))continue;
        for(String val:original.getQueryParameters(k))
          if(val!=null && val.length()<=320)b.appendQueryParameter(k,val);
      }
      b.appendQueryParameter("SiteID","H".equals(site)?"H":"M");
      b.appendQueryParameter("Grade","3");
      return b.build().toString();
    }catch(Throwable t){return page(site);}
  }
  public static boolean isSelector(String url){
    if(url==null)return false;
    try{
      Uri u=Uri.parse(url);String h=u.getHost(),p=u.getPath();
      return "https".equalsIgnoreCase(u.getScheme()) &&
        h!=null&&(h.equalsIgnoreCase("m.zocbo.com")||
          h.toLowerCase(Locale.US).endsWith(".zocbo.com")) &&
        p!=null&&p.equalsIgnoreCase(PATH);
    }catch(Throwable t){return false;}
  }

  private static String functions(){
    return "function norm(x){return String(x||'').replace(/\\s+/g,' ').trim();}"
      +"function visible(e){if(!e||!document.documentElement.contains(e))return false;"
      +"var s=window.getComputedStyle(e);"
      +"return s.display!=='none'&&s.visibility!=='hidden';}"
      +"function emitError(x){window.hitelCollectorNative.areaError("
      +"__NONCE__,String(x));}"
      +"function nearestClickable(e,panel){if(!e)return null;"
      +"var t=e.closest('label,button,a,li,[role=button],[onclick],input')||e;"
      +"return panel.contains(t)?t:e;}"
      +"function matchTotal(panel,city){"
      +"var els=panel.querySelectorAll('button,a,label,li,[role=button],input,span,p,div');"
      +"var best=null,bestScore=-1;"
      +"for(var k=0;k<els.length;k++){var e=els[k],s=norm(e.innerText||e.value||e.textContent);"
      +"if(!visible(e)||s.length>32)continue;"
      +"var score=-1;"
      +"if(s===city+' 전체')score=9;"
      +"else if(s==='전체')score=8;"
      +"else if(s.endsWith(' 전체')&&s.indexOf(city)>=0)score=7;"
      +"if(score<0)continue;"
      +"var c=nearestClickable(e,panel);"
      +"if(/^(LABEL|BUTTON|A|LI|INPUT)$/.test(c.tagName))score+=2;"
      +"if(score>bestScore){best=c;bestScore=score;}"
      +"}return best;}";
  }
  public static String scan(String nonce){
    return "(function(){try{"
      +"function norm(s){return String(s||'').replace(/\\s+/g,' ').trim();}"
      +"var buttons=document.querySelectorAll('.region .tab__button'),out=[];"
      +"for(var i=0;i<buttons.length;i++){"
      +"var e=buttons[i],name=norm(e.textContent),order=e.getAttribute('data-order');"
      +"if(!name||!order||name.length>36)continue;"
      +"var panel=Array.prototype.find.call(document.querySelectorAll('.region .tab__content'),"
      +"function(p){return p.getAttribute('data-order')===order;});"
      +"if(!panel)continue;"
      +"out.push({name:name,order:order});"
      +"}"
      +"window.__hitelAreaCandidates=out;"
      +"window.hitelCollectorNative.areaCandidates("+JSONObject.quote(nonce)+",JSON.stringify(out));"
      +"return 'source-regionFilter-buttons:'+buttons.length+';mapped:'+out.length;"
      +"}catch(e){window.hitelCollectorNative.areaError("+JSONObject.quote(nonce)+",String(e));"
      +"return 'source-regionFilter-scan-failed';}})();";
  }
  public static String click(String nonce,int idx){
    // functions() contains an internal diagnostic helper; replace its nonce
    // placeholder with a properly JSON-escaped literal.
    String fn=functions().replace("__NONCE__",JSONObject.quote(nonce));
    return "(function(){try{"+fn
      +"var list=window.__hitelAreaCandidates||[];"
      +"if("+idx+"<0||"+idx+">=list.length)throw Error('left city index missing');"
      +"var entry=list["+idx+"],name=entry.name,order=entry.order;"
      +"var left=Array.prototype.find.call(document.querySelectorAll('.region .tab__button'),"
      +"function(e){return e.getAttribute('data-order')===order;});"
      +"var panel=Array.prototype.find.call(document.querySelectorAll('.region .tab__content'),"
      +"function(e){return e.getAttribute('data-order')===order;});"
      +"if(!left||!panel)throw Error('regionFilter data-order pair missing:'+name);"
      +"window.hitelCollectorNative.areaClick("+JSONObject.quote(nonce)+",name+' left data-order='+order);"
      +"left.click();"  // invoke original ui.js regionFilter() handler
      +"var tries=0;"
      +"function choose(){"
      +"if(!document.documentElement.contains(panel))return emitError('right panel detached:'+name);"
      +"if(!panel.classList.contains('is-active')){"
      +"if(++tries<18){setTimeout(choose,200);return;}"
      +"return emitError('original regionFilter did not activate right panel:'+name);}"
      +"var total=matchTotal(panel,name);"
      +"if(!total){if(++tries<18){setTimeout(choose,200);return;}"
      +"return emitError('selected right tab has no 전체 row:'+name);}"
      +"window.hitelCollectorNative.areaClick("+JSONObject.quote(nonce)+",name+' right 전체');"
      +"total.click();"
      +"}setTimeout(choose,250);"
      +"return 'original-regionFilter-click:'+name+'/'+order;"
      +"}catch(e){window.hitelCollectorNative.areaError("+JSONObject.quote(nonce)+",String(e));"
      +"return 'original-regionFilter-click-failed';}})();";
  }
}
