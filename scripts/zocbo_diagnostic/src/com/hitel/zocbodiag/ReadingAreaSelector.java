package com.hitel.zocbodiag;

import org.json.JSONObject;
import android.net.Uri;

/**
 * Uses the ORIGINAL /exam/include/school/school_region_filter.asp page.
 * We discover clickable '전체' choices from the live DOM; no fabricated
 * school codes, and no hard-coded municipality guesses are required.
 * The normal original page click handler performs its own navigation.
 */
public final class ReadingAreaSelector {
  private ReadingAreaSelector(){}
  public static final String BASE="https://m.zocbo.com/exam/include/school/school_region_filter.asp";
  public static String page(String site){
    return BASE+"?SiteID="+("H".equals(site)?"H":"M")+"&Grade=3";
  }
  public static boolean isSelector(String url){
    if(url==null)return false;
    try{
      Uri u=Uri.parse(url);
      String host=u.getHost(),p=u.getPath();
      return "https".equalsIgnoreCase(u.getScheme())
          && host!=null&&(host.equalsIgnoreCase("m.zocbo.com")||
                 host.toLowerCase(java.util.Locale.US).endsWith(".zocbo.com"))
          && p!=null&&p.toLowerCase(java.util.Locale.US).endsWith("/school_region_filter.asp");
    }catch(Throwable t){return false;}
  }
  public static String scan(String nonce){
    return "(function(){try{"
      +"function norm(s){return String(s||'').replace(/\\s+/g,' ').trim();}"
      +"var nodes=Array.prototype.slice.call(document.querySelectorAll('a,button,input[type=button],input[type=radio],li[onclick],div[onclick],[role=button]'));"
      +"var cities='서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주|기타'.split('|');"
      +"var found=[],seen=Object.create(null);"
      +"for(var i=0;i<nodes.length;i++){var el=nodes[i];"
      +"var label=norm(el.innerText||el.value||el.textContent);"
      +"if(!label||label.length>55||!(label==='전체'||/^[가-힣]{2,6}\\s*전체$/.test(label)))continue;"
      +"var parent=el.closest('li,tr,.region,.region__item,.list__item,.filter__item')||el.parentElement;"
      +"var near=norm(parent&&parent.textContent).slice(0,100);"
      +"var named='';for(var k=0;k<cities.length;k++){if(label.indexOf(cities[k])===0||near.indexOf(cities[k])>=0){named=cities[k];break;}}"
      +"var k=label+'|'+named+'|'+(el.getAttribute('onclick')||'')+'|'+(el.getAttribute('href')||'');"
      +"if(seen[k])continue;seen[k]=1;"
      +"found.push({i:i,label:label,name:named||label,near:near});"
      +"}"
      +"window.__hitelAreaNodes=nodes;"
      +"window.__hitelAreaCandidates=found;"
      +"window.hitelCollectorNative.areaCandidates("+JSONObject.quote(nonce)+",JSON.stringify(found));"
      +"return 'area-total-buttons:'+found.length;"
      +"}catch(e){window.hitelCollectorNative.areaError("+JSONObject.quote(nonce)+",String(e));return 'area-scan-error';}})();";
  }
  public static String click(String nonce,int candidate){
    return "(function(){try{"
      +"var p=window.__hitelAreaCandidates||[],a=window.__hitelAreaNodes||[];"
      +"if("+candidate+"<0||"+candidate+">=p.length)throw Error('choice not found');"
      +"var obj=p["+candidate+"],el=a[obj.i];if(!el||!document.contains(el))throw Error('choice detached');"
      +"window.hitelCollectorNative.areaClick("+JSONObject.quote(nonce)+",obj.name||obj.label);"
      +"el.click();return 'original-area-clicked:'+String(obj.name||obj.label);"
      +"}catch(e){window.hitelCollectorNative.areaError("+JSONObject.quote(nonce)+",String(e));return 'area-click-error';}})();";
  }
}
