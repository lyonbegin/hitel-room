/* 2026-11-08: Original Zocbo exam subsector, inline. Zero iframes, no
 * credentials collected, no cross-origin API proxies, no fabricated file URL.
 * Exact original markup and scoped CSS: zocbo-original-event.[js|css],
 * generated from the public original 2026 final-exam HTML by CI.
 */
(function(){
'use strict';
const legacy=window.ZOCBOUI;
const original=window.ZOCBO_ORIGINAL_EVENT;
if(!legacy||!original||original.count!==35)throw Error('Verified original inline document evidence missing');
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const SOURCE=original.source;
const rows=window.ZOCBO_CATALOG||[];
const lookup=id=>rows.find(x=>x.id===id);
const originalCache=document.createElement('template');originalCache.innerHTML=original.originalMarkup;
const BASE_TAG=originalCache.content.querySelector('#event-content .promotion__section.is-data');
if(!BASE_TAG||originalCache.content.querySelectorAll('button[data-act="sampleDown"]').length!==35)throw Error('Original source document structure changed');
function zState(s){const raw=new URLSearchParams(location.search).get('paper');const deepId=rows.some(r=>r.id===raw)?raw:null;const z=s.zocbo||(s.zocbo={grade:'전체',subject:'전체',query:'',paperId:deepId,saved:[]});if(!z.eventGrade){const chosen=lookup(z.paperId);z.eventGrade=chosen?.grade||(/^(중|고)[123]$/.test(z.grade)?z.grade:'고1');}return z}
function gradename(button){return (button.dataset.siteid==='H'?'고':'중')+button.dataset.grade}
function grouping(z){
 const grade=z.eventGrade||'고1',school=grade.startsWith('고')?'H':'M';
 const sourceDoc=originalCache.content.cloneNode(true);
 const main=sourceDoc.querySelector('main#event-content');
 main.querySelectorAll('[id]').forEach(el=>{if(el!==main)el.removeAttribute('id')});
 main.querySelectorAll('.ui-tab').forEach(tab=>{
  const active=(school==='H'?tab.classList.contains('is-secondary'):tab.classList.contains('is-primary'));
  tab.dataset.groupActive=active?'1':'0';
  const tabs=tab.querySelectorAll('.ui-tab-nav button');
  const contents=tab.querySelectorAll('.ui-tab-content');
  tabs.forEach((button,index)=>{
   const selected=button.textContent.trim()===grade;
   button.dataset.selected=selected?'1':'0';button.setAttribute('aria-pressed',String(selected));
   button.classList.toggle('active',selected);
   if(contents[index]){contents[index].dataset.active=selected?'1':'0';contents[index].classList.toggle('active',selected)}
  });
 });
 const selected=lookup(z.paperId);
 for(const item of main.querySelectorAll('[data-doc-id]')){
  const isSelected=selected?.id===item.dataset.docId;
  item.dataset.selected=isSelected?'1':'0';
  item.hidden=!!z.eventFilter&&item.dataset.docId!==z.eventFilter;
 }
 return main.outerHTML;
}
function nav(){
 return '<div class="zb-shortcuts"><button data-go="bankHome">문제은행 홈</button><button data-go="bankSearch">문제 검색</button><button data-go="bankDownload">공식 자료</button><button data-go="bankSaved">책갈피</button></div>';
}
function selectedInfo(z){
 const r=lookup(z.paperId);
 return r?'<div class="zocbo-doc-context"><span>'+esc(r.grade)+'</span><span>'+esc(r.subject)+'</span><span>2026년 2학기 기말고사</span></div>':'';
}
function continueCard(s){
 const z=zState(s),r=lookup(z.downloadIntent);
 if(!r)return '';
 return '<div class="zocbo-handoff" role="region" aria-label="공식 다운로드 연결">'
  +'<strong>'+esc(r.grade)+' · '+esc(r.subject)+'</strong>'
  +'<p>선택하신 자료의 원본 다운로드 처리는 족보닷컴에서 진행됩니다. 공식 페이지에서 같은 학년·과목의 <b>다운로드</b>를 선택하시면 로그인·시험범위 선택·파일 생성 절차가 이어집니다.</p>'
  +'<a href="'+esc(SOURCE)+'" target="_blank" rel="noopener noreferrer" class="zocbo-handoff-open">공식 사이트에서 다운로드 계속하기 ↗</a>'
  +'<button data-action="zbClearIntent" type="button">선택 안내 닫기</button></div>';
}
function eventPage(s){
 const z=zState(s),group=z.eventGrade?.startsWith('중')?'M':'H';
 return nav()+'<div class="zocbo-inline-title"><h3>2026 기말고사 자료</h3><p>족보닷컴 원본 공개자료에서 가져온 과목별 다운로드 목록입니다.</p></div>'
 +continueCard(s)
 +'<div class="zocbo-inline-grade-switch" role="group" aria-label="학교급">'
 +'<button type="button" data-action="zbEventGroup" data-value="중2" aria-pressed="'+String(group==='M')+'">중학교</button>'
 +'<button type="button" data-action="zbEventGroup" data-value="고1" aria-pressed="'+String(group==='H')+'">고등학교</button></div>'
 +'<div class="zb-inline-root">'+grouping(z)+'</div>'
 +'<div class="zocbo-inline-footer"><a href="'+esc(SOURCE)+'" target="_blank" rel="noopener noreferrer">족보닷컴 원본 페이지 열기 ↗</a><button type="button" data-go="bankLogin">원본 계정 로그인</button></div>';
}
function originalItem(id){
 const tpl=originalCache.content.querySelector('[data-doc-id="'+String(id).replace(/[^A-Z0-9-]/g,'')+'"]');
 return tpl?tpl.outerHTML:'';
}
function onePaper(s){
 const z=zState(s),r=lookup(z.paperId);
 if(!r)return nav()+'<div class="zb-no-results">선택된 자료가 없습니다.</div><button data-go="bankSearch">문제 검색</button>';
 z.eventGrade=r.grade;
 return nav()+'<div class="zocbo-inline-title"><span>2026년 2학기 기말고사</span><h3>'+esc(r.title)+'</h3><p>'+esc(r.grade)+' · '+esc(r.subject)+'</p></div>'
 +continueCard(s)
 +'<div class="zb-inline-root"><main class="promotion" id="event-content"><section class="promotion__section is-data"><div class="keyvisual__inner">'
 +'<h2 class="section__title">원본 과목별 자료</h2><div class="ui-tab"><div class="ui-tab-container"><div class="ui-tab-content" data-active="1">'
 +'<div class="has-data1st">'+originalItem(r.id)+'</div></div></div></div></div></section></main></div>'
 +'<div class="zocbo-inline-footer"><button data-action="zbOpenSelectedInList" type="button">원본 목록에서 이 자료 찾기</button><a href="'+esc(legacy.subjectListUrl(r))+'" target="_blank" rel="noopener noreferrer">이 과목의 문제 목록 ↗</a><button type="button" data-action="zbRemember" data-id="'+esc(r.id)+'">'+((z.saved||[]).includes(r.id)?'책갈피 해제':'책갈피에 저장')+'</button></div>';
}
function officialOnly(title,desc,url,secondary){
 if(!legacy.isOfficial(url))return '<p>확인된 원본 주소가 아닙니다.</p>';
 return nav()+'<div class="zocbo-native-handoff"><h3>'+esc(title)+'</h3><p>'+esc(desc)+'</p><div class="zocbo-origin">공식 주소: '+esc(new URL(url).hostname)+'</div>'
 +'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" class="zocbo-handoff-open">공식 족보닷컴에서 열기 ↗</a>'
 +'<a href="'+esc(url)+'" target="_self" rel="noopener noreferrer">현재 창에서 열기</a>'
 +(secondary?'<a href="'+esc(secondary)+'" target="_blank" rel="noopener noreferrer">앱 내부용 웹 주소 별도 확인 ↗</a>':'')
 +'</div>';
}
const oldPage=legacy.page,oldAction=legacy.onAction;
legacy.page=function(id,s){
 switch(id){
  case 'bankPaper':return onePaper(s);
  case 'bankDownload':return eventPage(s);
  case 'bankOriginal':return officialOnly('족보닷컴 원본 서비스','원본 서비스의 로그인·검색 및 자료 열람은 공식 사이트에서 진행됩니다.',zState(s).viewUrl&&legacy.isOfficial(zState(s).viewUrl)?zState(s).viewUrl:legacy.PATHS.app);
  case 'bankLogin':return officialOnly('족보닷컴 로그인','아이디와 비밀번호는 공식 족보닷컴 도메인에서만 입력하십시오. 로그인 후 자료 다운로드 페이지로 돌아와 이용하실 수 있습니다.',legacy.PATHS.login);
  case 'bankSchool':return officialOnly('학교별 맞춤학습','학교 검색과 시험범위별 자료 목록은 원본 서비스에서 확인합니다.',zState(s).grade?.startsWith('고')?legacy.PATHS.highExpected:legacy.PATHS.middleExpected);
  case 'bankDiagnostic':return officialOnly('성적 진단평가','원본 학년·과목 및 시험 설정에 따라 진행합니다.',legacy.PATHS.diagnostic);
  case 'bankFree':return officialOnly('학교별 기출 무료 열람','이 기능은 원본 족보닷컴 앱의 전용 뷰어로 연결됩니다. 일반 브라우저에서 앱 전용 콘텐츠를 표시하는 기능은 검증되지 않았습니다.',legacy.PATHS.freeReading,legacy.PATHS.freeReadingWeb);
  default:return oldPage(id,s);
 }
};
legacy.onAction=function(act,button,s,go,render,toast){
 const z=zState(s);
 if(act==='zbEventGroup'||act==='zbEventTab'){
  z.eventGrade=button.dataset.value||'고1';z.downloadIntent=null;z.eventFilter=null;render();return;
 }
 if(act==='zbOriginalDownload'){
  const id=button.dataset.id,doc=lookup(id);
  if(!doc){toast('원본 자료 식별자를 찾지 못했습니다.');return}
  z.paperId=id;z.eventGrade=doc.grade;z.downloadIntent=id;z.eventFilter=null;render();
  const section=document.querySelector('#phone .zocbo-handoff');
  section?.scrollIntoView({block:'nearest',behavior:'instant'});
  return;
 }
 if(act==='zbClearIntent'){z.downloadIntent=null;render();return}
 if(act==='zbOpenSelectedInList'){z.eventFilter=z.paperId;z.downloadIntent=null;go('bankDownload');return}
 if(act==='zbRemember'){
  return oldAction(act,button,s,go,render,toast);
 }
 return oldAction(act,button,s,go,render,toast);
};
})();
