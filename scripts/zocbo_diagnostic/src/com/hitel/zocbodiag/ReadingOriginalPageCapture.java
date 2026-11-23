package com.hitel.zocbodiag;

import org.json.JSONObject;

/**
 * Read-only snapshot of the already rendered, authenticated original
 * /exam/school/previousExam.asp page, including its SERVER-RENDERED first page.
 * Uses the original global script values rather than R8's invented empty fields.
 */
public final class ReadingOriginalPageCapture {
  private ReadingOriginalPageCapture(){}

  public static String script(String nonce) {
    return "(function(){try{"
      +"var q=new URLSearchParams(location.search);"
      +"var scripts=Array.prototype.map.call(document.scripts,function(x){return x.textContent||'';}).join('\\n');"
      +"function g(n){try{var x=window[n];if(x!==undefined&&x!==null&&String(x).length)return String(x);}catch(e){}"
      +"try{var m=scripts.match(new RegExp('\\\\bvar\\\\s+'+n+'\\\\s*=\\\\s*[\"\\\\x27]([^\"\\\\x27]*)[\"\\\\x27]'));return m?m[1]:'';}catch(e){return '';}}"
      +"function param(n){return q.get(n)||'';}"
      +"function injected(n){var needle='&'+n+'=';var p=scripts.indexOf(needle);"
      +"if(p<0)return '';var line=scripts.slice(p,scripts.indexOf('\\n',p)<0?scripts.length:scripts.indexOf('\\n',p));"
      +"var m=line.match(/\\+\\s*[\"]([^\"]*)[\"]\\s*;/);return m?m[1]:'';}"
      +"var site=g('SiteID')||param('SiteID'),grade=g('Grade')||param('Grade');"
      +"var year=g('ExPapr_TestYear')||param('ExPapr_TestYear');"
      +"var term=g('ExPapr_MidEndTerm')||param('ExPapr_MidEndTerm');"
      +"var subject=g('Subj_Code')||param('Subj_Code');"
      +"var schools=g('scl_id')||param('scl_id')||param('Scl_ID');"
      +"var city=param('Rg_CitiesProvinces')||injected('Rg_CitiesProvinces');"
      +"var district=param('Rg_District')||injected('Rg_District');"
      +"var filter=g('filter_gugun')||param('filter_gugun');"
      +"var paid='N';try{paid=(appCLS.getIsRecoomendedVersion(appCLS.getAnswerPaidRecoomendedVersion())?'Y':'N');}catch(e){}"
      +"var rows=[],seen=Object.create(null);"
      +"var els=document.querySelectorAll('#div_add_school .download, .download__list .download');"
      +"for(var i=0;i<els.length;i++){var row=els[i];"
      +"var btn=row.querySelector('[id^=\"li_freereading\"][data-no]');if(!btn)continue;"
      +"var no=String(btn.getAttribute('data-no')||'').trim();"
      +"if(!/^[1-9][0-9]{0,12}$/.test(no)||seen[no])continue;seen[no]=1;"
      +"function txt(s){var v=row.querySelector(s);return v?(v.textContent||'').trim():'';}"
      +"var school=txt('.text__school'),rg=txt('.download__badge .area');"
      +"var subjectName=txt('.class__subject');"
      +"rows.push({expapr_no:no,scl_short_name:school,ExPapr_TestYear:txt('.download__badge .badge')||year,"
      +"Grade:grade,Subj_Code:subject,Subj_Name:subjectName,"
      +"viewer_title:school+' '+txt('.text__subject')+' '+subjectName,"
      +"Rg_City:city||rg,Rg_District:district,exPapr_CoreType:btn.getAttribute('data-coretype')||''});"
      +"}"
      +"window.hitelCollectorNative.snapshot("+JSONObject.quote(nonce)+",JSON.stringify({"
      +"site:site,grade:grade,year:year,term:term,subject:subject,"
      +"schools:schools,city:city,district:district,filter:filter,paid:paid,"
      +"rows:rows,renderedCount:els.length}));"
      +"return 'original-page-snapshot:'+rows.length;"
      +"}catch(e){window.hitelCollectorNative.snapshotError("+JSONObject.quote(nonce)+",String(e));"
      +"return 'capture-error';}})();";
  }
}
