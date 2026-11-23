package com.hitel.zocbodiag;
import android.net.Uri;
import org.json.JSONObject;
import java.util.Locale;

/**
 * Exact TWO-COLUMN flow: choose a left region first, then click its dynamic
 * right-side "[region] 전체" option. R10 incorrectly assumed all region-wide
 * rows were simultaneously visible.
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
      Uri u=Uri.parse(url);String h=u.getHost(),p=u.getPath();
      return "https".equalsIgnoreCase(u.getScheme())
        && h!=null&&(h.equalsIgnoreCase("m.zocbo.com")||h.toLowerCase(Locale.US).endsWith(".zocbo.com"))
        && p!=null&&p.toLowerCase(Locale.US).endsWith("/school_region_filter.asp");
    }catch(Throwable t){return false;}
  }

  private static String helpers(){
    return "function norm(s){return String(s||'').replace(/\\s+/g,' ').trim();}"
      +"var names='서울|세종|대구|대전|부산|인천|울산|경기|강원|광주|충북|충남|전북|전남|경북|경남|제주|제주도|강원도|경기도|경상남도|경상북도|전라남도|전라북도|충청남도|충청북도'.split('|');"
      +"function nodes(){"
      +"var out=[],root=document.body;if(!root)return out;"
      +"var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false),t;"
      +"while((t=w.nextNode())){"
      +"var e=t.parentElement;if(!e||e.closest('script,style,template,noscript,option'))continue;"
      +"var v=norm(t.nodeValue);if(v.length>0&&v.length<60)out.push({el:e,text:v});"
      +"}return out;}"
      +"function click(n){if(!n||!document.contains(n))return false;"
      +"try{n.scrollIntoView({block:'center',inline:'nearest'});}catch(e){}"
      +"try{n.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return true;}"
      +"catch(e){try{n.click();return true;}catch(e2){return false;}}"
      +"}";
  }

  public static String scan(String nonce){
    return "(function(){try{"+helpers()
      +"var list=nodes(),found=[],seen={};"
      +"for(var i=0;i<list.length;i++){var s=list[i].text;"
      +"if(names.indexOf(s)<0||seen[s])continue;seen[s]=1;"
      +"found.push({name:s,label:s});}"
      +"window.__hitelAreaCandidates=found;"
      +"window.hitelCollectorNative.areaCandidates("+JSONObject.quote(nonce)+",JSON.stringify(found));"
      +"return 'left-area-options:'+found.length;"
      +"}catch(e){window.hitelCollectorNative.areaError("+JSONObject.quote(nonce)+",String(e));"
      +"return 'scan-error';}})();";
  }

  public static String click(String nonce,int index){
    return "(function(){try{"+helpers()
      +"var ls=window.__hitelAreaCandidates||[];"
      +"if("+index+"<0||"+index+">=ls.length)throw Error('city index missing');"
      +"var city=ls["+index+"].name,list=nodes(),left=null;"
      +"for(var i=0;i<list.length;i++){if(list[i].text===city){left=list[i].el;break;}}"
      +"if(!left)throw Error('left city text missing:'+city);"
      +"window.hitelCollectorNative.areaClick("+JSONObject.quote(nonce)+",city+' left-region');"
      +"if(!click(left))throw Error('left city click failed:'+city);"
      +"var attempt=0;"
      +"function total(){var now=nodes(),a=null,exact=city+' 전체';"
      +"for(var i=0;i<now.length;i++){if(now[i].text===exact){a=now[i].el;break;}}"
      +"if(!a){for(var j=0;j<now.length;j++){if(now[j].text==='전체'){a=now[j].el;break;}}}"
      +"if(!a&&++attempt<14){setTimeout(total,250);return;}"
      +"if(!a){window.hitelCollectorNative.areaError("+JSONObject.quote(nonce)+",'right area 전체 missing for '+city);return;}"
      +"window.hitelCollectorNative.areaClick("+JSONObject.quote(nonce)+",city+' right-전체');"
      +"if(!click(a))window.hitelCollectorNative.areaError("+JSONObject.quote(nonce)+",'right 전체 click failed for '+city);"
      +"}"
      +"setTimeout(total,400);return 'two-column-region-requested:'+city;"
      +"}catch(e){window.hitelCollectorNative.areaError("+JSONObject.quote(nonce)+",String(e));"
      +"return 'click-error';}})();";
  }
}
