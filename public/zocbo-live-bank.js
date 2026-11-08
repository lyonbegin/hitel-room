/* HITEL source-based mobile exam bank.
 * Faithful anonymous hierarchy: source chapters -> subchapters -> detail -> episodes.
 * Source: m.zocbo.com public mobile AJAX. Never claims authenticated download success.
 */
(function(){
'use strict';
const UI=window.ZOCBOUI;
if(!UI)throw Error('ZOCBOUI dependency missing');
const priorPage=UI.page,priorAction=UI.onAction;
const cache=new Map(),inFlight=new Set(),gradeSubjects=new Map();
const grades=['중1','중2','중3','고1','고2'];
const fallbackSubjects=[['MT','수학'],['KR','국어'],['EG','영어'],['SC','과학'],['LS','사회'],['HI','역사']];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const arrays=x=>Array.isArray(x)?x:[];
function state(s){
 const z=s.zocbo||(s.zocbo={});
 if(!grades.includes(z.liveGrade))z.liveGrade=grades.includes(z.grade)?z.grade:'고1';
 if(!/^[A-Z0-9]{2,5}$/.test(z.liveSubject||''))z.liveSubject='MT';
 if(typeof z.liveQuery!=='string')z.liveQuery='';
 if(!['chapters','titles'].includes(z.liveMode))z.liveMode='chapters';
 return z;
}
function filter(z){return {site:z.liveGrade[0]==='중'?'M':'H',grade:z.liveGrade.slice(1),subject:z.liveSubject}}
function key(q){return [q.site,q.grade,q.subject].join(':')}
function origin(q){const url=new URL(q.site==='H'?UI.PATHS.high:UI.PATHS.middle);url.searchParams.set('grade',q.grade);url.searchParams.set('subject_cd',q.subject);return url.href}
function sourceSubjects(z){
 const list=gradeSubjects.get(z.liveGrade);
 return list?.length?list:fallbackSubjects.map(([code,name])=>({code,name}));
}
function lookup(data,id){return arrays(data?.exams).find(e=>e.id===id)}
function treeOf(data){
 const roots=new Map(),rootOrder=[],partNames=new Map();
 function ensureRoot(code,name){
  const k=code||name||'기타';
  if(!roots.has(k)){roots.set(k,{code:k,name:name||'기타',subs:new Map(),count:0});rootOrder.push(k)}
  const r=roots.get(k);if(name&&(!r.name||(/^\s*\d+[.\-]/.test(name)&&!/^\s*\d+[.\-]/.test(r.name))))r.name=name;return r;
 }
 function ensureSub(r,code,name){
  const k=code||name||'기타';
  if(!r.subs.has(k))r.subs.set(k,{code:k,name:name||'기타',details:new Map(),count:0});
  const sub=r.subs.get(k);if(name&&(/^\s*\d+[.\-]/.test(name)&&!/^\s*\d+[.\-]/.test(sub.name)))sub.name=name;return sub;
 }
 function ensureDetail(sub,code,name){
  const k=code||name||'기타';
  if(!sub.details.has(k))sub.details.set(k,{code:k,name:name||'기타',exams:[]});
  const detail=sub.details.get(k);if(name&&(/^\s*\d+[.\-]/.test(name)&&!/^\s*\d+[.\-]/.test(detail.name)))detail.name=name;return detail;
 }
 for(const part of arrays(data.parts)){
  const r=ensureRoot(part.rootCode,part.root);
  const sub=ensureSub(r,part.subCode,part.sub);
  ensureDetail(sub,part.detailCode,part.detail);
  partNames.set([part.rootCode,part.subCode,part.detailCode].join('/'),part);
 }
 for(const e of arrays(data.exams)){
  const names=partNames.get([e.rootPart,e.subPart,e.detailPart].join('/'));
  const r=ensureRoot(e.rootPart,e.rootName||names?.root);
  const sub=ensureSub(r,e.subPart,e.subName||names?.sub);
  const detail=ensureDetail(sub,e.detailPart,e.detailName||names?.detail);
  detail.exams.push(e);r.count++;sub.count++;
 }
 return rootOrder.map(k=>roots.get(k)).filter(r=>r.count>0||r.subs.size>0);
}
function notice(entry){
 if(!entry)return '<div class="zb-native-loading" role="status">문제은행 자료를 불러오는 중입니다.</div>';
 if(entry.error)return '<div class="zb-native-error" role="alert">자료 조회에 실패했습니다. '+esc(entry.error)+'</div>';
 return '';
}
function chooser(z){
 const ss=sourceSubjects(z),gradeHtml=grades.map(g=>'<button type="button" data-action="zbNativeGrade" data-value="'+g+'" aria-pressed="'+(z.liveGrade===g)+'" class="'+(z.liveGrade===g?'is-on':'')+'">'+g+'</button>').join('');
 const subjectHtml=ss.map(x=>'<button type="button" data-action="zbNativeSubject" data-value="'+attr(x.code)+'" aria-pressed="'+(z.liveSubject===x.code)+'" class="'+(z.liveSubject===x.code?'is-on':'')+'">'+esc(x.name)+'</button>').join('');
 return '<div class="zb-native-selects"><div class="zb-native-select-row" aria-label="학년 선택">'+gradeHtml+'</div><div class="zb-native-select-row" aria-label="과목 선택">'+subjectHtml+'</div></div>';
}
function examTitle(e){return e.detailName||e.title||'시험지'}
function episode(e){return e.episode||((e.title.match(/\((\d+회)\)/)||[])[1])||'시험지'}
function episodeButton(e,z){
 return '<button type="button" class="zb-native-episode'+(z.liveSelected===e.id?' is-current':'')+'" data-action="zbNativePaper" data-id="'+attr(e.id)+'" aria-label="'+attr(examTitle(e)+' '+episode(e))+'">'+esc(episode(e))+'</button>';
}
function detailBlock(d,z){
 if(!d.exams.length)return '';
 const byLevel=new Map();
 for(const e of d.exams){
  const level=e.level||'기타';
  if(!byLevel.has(level))byLevel.set(level,[]);
  byLevel.get(level).push(e);
 }
 const levels=[...byLevel.entries()].map(([level,exams])=>{
  const label=level==='2'?'기본':level==='3'?'심화':level==='1'?'기초':'수준 '+level;
  return '<div class="zb-native-level"><span class="zb-native-level-label">'+esc(label)+'</span><div class="zb-native-episodes">'+exams.map(e=>episodeButton(e,z)).join('')+'</div></div>';
 }).join('');
 return '<div class="zb-native-detail"><div class="zb-native-detail-name">'+esc(d.name)+'</div>'+levels+'</div>';
}
function subBlock(sub,z,rootCode){
 if(sub.count===0)return '';
 const subKey=rootCode+'|'+sub.code;
 const opened=z.liveOpenSub===subKey;
 return '<div class="zb-native-sub"><button type="button" class="zb-native-sub-head" data-action="zbNativeSub" data-value="'+attr(subKey)+'" aria-expanded="'+opened+'"><span>'+esc(sub.name)+'</span><small>'+sub.count+'건</small><b aria-hidden="true">'+(opened?'−':'+')+'</b></button>'
 +(opened?'<div class="zb-native-sub-body">'+[...sub.details.values()].map(d=>detailBlock(d,z)).join('')+'</div>':'')+'</div>';
}
function chapterRows(data,z){
 const roots=treeOf(data);
 if(!roots.length)return '<div class="zb-native-empty">표시할 단원이 없습니다.</div>';
 return '<div class="zb-native-chapters">'+roots.map(root=>{
  const opened=z.liveOpenRoot===root.code;
  return '<section class="zb-native-root"><button type="button" class="zb-native-root-head" data-action="zbNativeRoot" data-value="'+attr(root.code)+'" aria-expanded="'+opened+'"><span>'+esc(root.name)+'</span><small>'+root.count+'건</small><b aria-hidden="true">'+(opened?'⌄':'›')+'</b></button>'
   +(opened?'<div class="zb-native-root-body">'+[...root.subs.values()].map(sub=>subBlock(sub,z,root.code)).join('')+'</div>':'')+'</section>';
 }).join('')+'</div>';
}
function titleRows(data,z){
 const term=z.liveQuery.trim().toLocaleLowerCase('ko-KR');
 const rows=arrays(data.exams).filter(e=>!term||[e.title,e.rootName,e.subName,e.detailName,e.episode].join(' ').toLocaleLowerCase('ko-KR').includes(term));
 return '<div class="zb-native-match-count">검색 결과 '+rows.length+'건 / 원본 '+data.exams.length+'건</div>'
 +(rows.length?'<div class="zb-native-titles">'+rows.map(e=>
 '<button type="button" class="zb-native-title-item" data-action="zbNativePaper" data-id="'+attr(e.id)+'"><span><b>'+esc(e.title)+'</b><small>'+esc([e.rootName,e.subName,e.detailName].filter(Boolean).join(' › '))+'</small></span><em>›</em></button>'
 ).join('')+'</div>':'<div class="zb-native-empty">검색 조건과 일치하는 시험지가 없습니다.</div>');
}
function selectedSheet(data,z,q){
 if(!z.liveSelected)return '';
 const e=lookup(data,z.liveSelected);
 if(!e)return '';
 const chapter=[e.rootName,e.subName,e.detailName].filter(Boolean).join(' › ');
 return '<div class="zb-native-sheet-mask" data-action="zbNativeClose" role="presentation"></div>'
 +'<section class="zb-native-sheet" role="dialog" aria-modal="true" aria-label="시험지 정보"><div class="zb-native-sheet-top"><h3>시험지 정보</h3><button type="button" data-action="zbNativeClose" aria-label="닫기">×</button></div>'
 +'<h4>'+esc(e.title)+'</h4><dl><dt>단원</dt><dd>'+esc(chapter||'확인되지 않음')+'</dd>'
 +'<dt>회차</dt><dd>'+esc(episode(e))+'</dd><dt>자료번호</dt><dd>'+esc(e.id)+'</dd></dl>'
 +'<p>문항 열람·다운로드는 족보닷컴 계정의 이용 권한을 확인한 후 원본 서비스에서 진행됩니다.</p>'
 +'<a class="zb-native-official-link" href="'+attr(origin(q))+'" target="_blank" rel="noopener noreferrer">족보닷컴에서 해당 과목 열기</a>'
 +'<button type="button" class="zb-native-sheet-copy" data-action="zbNativeCopy" data-value="'+attr(e.id)+'">자료번호 복사</button></section>';
}
function panel(s){
 const z=state(s),q=filter(z),entry=cache.get(key(q));
 if(!entry||entry.error)return notice(entry);
 const data=entry.data;
 const showTitles=!!z.liveQuery.trim()||z.liveMode==='titles';
 return '<div class="zb-native-summary"><b>원본 시험지 '+data.exams.length+'건</b><small>대단원 '+treeOf(data).length+'개</small></div>'
 +'<div class="zb-native-tabs" role="tablist"><button type="button" data-action="zbNativeMode" data-value="chapters" aria-selected="'+!showTitles+'" class="'+(!showTitles?'is-on':'')+'">단원별</button><button type="button" data-action="zbNativeMode" data-value="titles" aria-selected="'+showTitles+'" class="'+(showTitles?'is-on':'')+'">전체 시험지</button></div>'
 +(showTitles?titleRows(data,z):chapterRows(data,z))
 +selectedSheet(data,z,q);
}
function view(s){
 const z=state(s),q=filter(z);
 window.ZOCBO_NATIVE_STATE=s;
 request(q);
 return '<div class="zb-shortcuts"><button data-go="bankHome">문제은행 홈</button><button data-go="bankDownload">기말고사 자료</button><button data-go="bankSaved">책갈피</button></div>'
 +'<div class="zb-native-bank"><div class="zb-native-head"><h3>단원별 학습</h3></div>'
 +chooser(z)
 +'<div class="zb-native-static-filter"><span>공통</span><span>기본</span></div>'
 +'<label class="zb-native-search-wrap"><span>검색</span><input type="search" data-zb-native-search="1" placeholder="단원명 또는 시험지 검색" value="'+attr(z.liveQuery)+'"></label>'
 +'<div id="zb-native-results" data-source-key="'+attr(key(q))+'">'+panel(s)+'</div>'
 +'<div class="zb-native-footer"><button type="button" data-action="zbNativeRefresh">자료 새로고침</button><a href="'+attr(origin(q))+'" target="_blank" rel="noopener noreferrer">원본 문제은행 열기</a></div></div>';
}
function redraw(){
 const s=window.ZOCBO_NATIVE_STATE;if(!s)return;
 const z=state(s),q=filter(z),host=document.querySelector('#phone .zb-native-bank');
 if(!host)return;
 host.innerHTML='<div class="zb-native-head"><h3>단원별 학습</h3></div>'+chooser(z)
 +'<div class="zb-native-static-filter"><span>공통</span><span>기본</span></div>'
 +'<label class="zb-native-search-wrap"><span>검색</span><input type="search" data-zb-native-search="1" placeholder="단원명 또는 시험지 검색" value="'+attr(z.liveQuery)+'"></label>'
 +'<div id="zb-native-results" data-source-key="'+attr(key(q))+'">'+panel(s)+'</div>'
 +'<div class="zb-native-footer"><button type="button" data-action="zbNativeRefresh">자료 새로고침</button><a href="'+attr(origin(q))+'" target="_blank" rel="noopener noreferrer">원본 문제은행 열기</a></div>';
 request(q);
}
function request(q){
 const k=key(q);
 if(cache.has(k)||inFlight.has(k))return;
 inFlight.add(k);
 setTimeout(async()=>{
  try{
   const response=await fetch('/api/zocbo/public-catalog?'+new URLSearchParams(q),{credentials:'omit',cache:'no-store'});
   const data=await response.json();
   if(!response.ok||data.ok!==true)throw Error(data.reason||data.error||'HTTP_'+response.status);
   if(!Array.isArray(data.exams)||!Array.isArray(data.parts))throw Error('응답 데이터 구조 오류');
   cache.set(k,{data});
   if(arrays(data.subjects).length)gradeSubjects.set((q.site==='H'?'고':'중')+q.grade,data.subjects);
  }catch(e){cache.set(k,{error:String(e.message||e).slice(0,100)})}
  finally{
   inFlight.delete(k);
   const host=document.querySelector('#phone .zb-native-bank');
   if(host&&document.querySelector('#zb-native-results')?.dataset.sourceKey===k)redraw();
  }
 },0);
}
UI.page=function(id,s){
 if(id==='bankSearch'||id==='bankResults')return view(s);
 return priorPage(id,s);
};
UI.onAction=function(act,el,s,go,render,toast){
 const actions=['zbNativeGrade','zbNativeSubject','zbNativeRoot','zbNativeSub','zbNativePaper','zbNativeClose','zbNativeMode','zbNativeRefresh','zbNativeCopy'];
 if(!actions.includes(act))return priorAction(act,el,s,go,render,toast);
 const z=state(s);
 if(act==='zbNativeGrade'&&grades.includes(el.dataset.value)){
  z.liveGrade=el.dataset.value;z.liveSubject='MT';z.liveOpenRoot='';z.liveOpenSub='';z.liveSelected='';
 }else if(act==='zbNativeSubject'&&/^[A-Z0-9]{2,5}$/.test(el.dataset.value||'')){
  z.liveSubject=el.dataset.value;z.liveOpenRoot='';z.liveOpenSub='';z.liveSelected='';
 }else if(act==='zbNativeRoot'){
  z.liveOpenRoot=z.liveOpenRoot===el.dataset.value?'':el.dataset.value;z.liveOpenSub='';z.liveSelected='';
 }else if(act==='zbNativeSub'){
  z.liveOpenSub=z.liveOpenSub===el.dataset.value?'':el.dataset.value;z.liveSelected='';
 }else if(act==='zbNativePaper'){
  z.liveSelected=el.dataset.id||'';
 }else if(act==='zbNativeClose'){
  z.liveSelected='';
 }else if(act==='zbNativeMode'){
  if(['chapters','titles'].includes(el.dataset.value)){z.liveMode=el.dataset.value;z.liveQuery=''}
  z.liveSelected='';
 }else if(act==='zbNativeRefresh'){
  cache.delete(key(filter(z)));z.liveSelected='';
 }else if(act==='zbNativeCopy'){
  const id=el.dataset.value;
  if(id&&navigator.clipboard?.writeText)navigator.clipboard.writeText(id).then(()=>toast('자료번호를 복사했습니다.')).catch(()=>toast('복사가 제한되었습니다.'));
  return;
 }
 window.ZOCBO_NATIVE_STATE=s;redraw();
};
document.addEventListener('input',ev=>{
 if(!ev.target.matches('[data-zb-native-search]'))return;
 const s=window.ZOCBO_NATIVE_STATE;if(!s)return;
 const z=state(s);z.liveQuery=ev.target.value;z.liveSelected='';
 const target=document.querySelector('#zb-native-results');
 if(target)target.innerHTML=panel(s);
});
document.addEventListener('keydown',ev=>{
 if(ev.key!=='Escape'||!window.ZOCBO_NATIVE_STATE)return;
 const z=state(window.ZOCBO_NATIVE_STATE);
 if(!z.liveSelected)return;
 z.liveSelected='';redraw();
});
})();