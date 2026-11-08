/* HITEL/Zocbo source-first native sector, 2026-11-08.
 * Each view is a sanitized, actual Playwright-captured mobile original DOM.
 * All menu/filter labels and source IDs are selected from original grade+subject records.
 * No iframe; no imitation of authenticated PDF/download success.
 */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('mobile')==='1')document.body.classList.add('zb-standalone');
const UI=window.ZOCBOUI;
if(!UI)throw Error('ZOCBOUI missing');
const priorPage=UI.page,priorAction=UI.onAction;
const MAIN=[['concept','개념학습'],['unit','단원별 학습'],['practice','실전대비'],
 ['revision','직전대비'],['school','학교별 맞춤학습'],['gangnam','강남 3구 유형공략']];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc,arr=x=>Array.isArray(x)?x:[];
let sourceIndex=null,indexPromise=null;
const views=new Map(),loading=new Set();
let sCurrent=null;
function state(s){
 const z=s.zocbo||(s.zocbo={});
 if(!z.fSite){const g=z.liveGrade||'고1';z.fSite=g.startsWith('중')?'M':'H';z.fGrade=g.slice(1)==='3'&&z.fSite==='H'?'2':(g.slice(1)||'1');}
 if(!['1','2','3'].includes(z.fGrade))z.fGrade='1';
 if(!z.fSubject)z.fSubject=/^[A-Z0-9]{2,8}$/.test(z.liveSubject||'')?z.liveSubject:'MT';
 if(!MAIN.some(x=>x[0]===z.fMain))z.fMain='unit';
 if(!z.fDisplay||typeof z.fDisplay!=='object')z.fDisplay={};
 if(typeof z.fCase!=='string')z.fCase='';
 return z;
}
function groupKey(z){return [z.fSite,z.fGrade,z.fSubject,z.fMain].join(':')}
function ensureIndex(){
 if(sourceIndex||indexPromise)return;
 indexPromise=fetch('/api/zocbo/faithful-index',{credentials:'omit',cache:'no-store'})
  .then(async r=>{const data=await r.json();if(!r.ok||!data.byView)throw Error(data.error||'원본 화면 목록 조회 실패');return data})
  .then(x=>{sourceIndex=x;redraw()})
  .catch(e=>{sourceIndex={error:String(e.message||e),cases:{},byView:{},subjects:{}};redraw()});
}
function casesFor(z){return arr(sourceIndex?.byView?.[groupKey(z)])}
function selectCase(z){
 const ids=casesFor(z);
 if(z.fCase&&ids.includes(z.fCase))return z.fCase;
 const primary=ids.find(x=>!sourceIndex?.cases?.[x]?.subCode);
 z.fCase=primary||ids[0]||'';
 return z.fCase;
}
function load(caseId){
 if(!caseId||loading.has(caseId)||views.has(caseId))return;
 loading.add(caseId);
 fetch('/api/zocbo/faithful-page?'+new URLSearchParams({case:caseId}),{credentials:'omit',cache:'no-store'})
 .then(async r=>{const v=await r.json();if(!r.ok||!v.case)throw Error(v.error||'원본 화면 자료 없음');return v})
 .then(v=>{
  const needsLive=['concept','unit','practice','revision'].includes(v.category)
     && Number(v.episodeCount)===0 && arr(v.originalPublicRequests).length>0;
  views.set(caseId,{data:v,liveLoading:needsLive});redraw();
  if(needsLive){
   fetch('/api/zocbo/public-case-catalog?'+new URLSearchParams({case:caseId}),{credentials:'omit'})
    .then(async r=>{const data=await r.json();if(!r.ok||!data.ok)throw Error(data.reason||data.error||'원본 목록 조회 실패');return data})
    .then(data=>{views.set(caseId,{data:v,liveData:data});redraw()})
    .catch(e=>{views.set(caseId,{data:v,liveError:String(e.message||e).slice(0,110)});redraw()});
  }
 })
 .catch(e=>{views.set(caseId,{error:String(e.message||e).slice(0,150)});redraw()})
 .finally(()=>loading.delete(caseId));
}
function getMeta(z){return sourceIndex?.cases?.[selectCase(z)]}
function getPage(z){
 const id=selectCase(z);
 if(!id)return null;
 load(id);
 return views.get(id)||null;
}
function sourceSubjectOptions(z){
 return arr(sourceIndex?.subjects?.[z.fSite+z.fGrade]).map(x=>({name:x.name||x.code,code:x.code}));
}
function filterKey(item){
 let call=item.onclick||'',m=call.match(/getBottomSheetLayer\('([A-Z_]+)'/);
 return m?.[1]||item.action||item.source||'';
}
function kind(z,meta){
 const orig=meta?.originalSubject;
 if(!orig||z.fSubject!==orig)return z.fSubject;
 return orig;
}
function menuLabel(z,meta){
 const name=MAIN.find(x=>x[0]===z.fMain)?.[1]||'단원별 학습';
 return name;
}
function siteBar(z){
 const opts=[['M','중등'],['H','고등']];
 return '<div class="zb-f-sitebar" role="group" aria-label="중등 고등 선택">'
  +opts.map(([code,name])=>'<button type="button" data-action="zbFSite" data-value="'+code+'" aria-pressed="'+(z.fSite===code)+'" class="'+(z.fSite===code?'is-active':'')+'">'+name+'</button>').join('')
  +'</div>';
}
function topTabs(z,meta){
 const tabs=arr(meta?.top);
 const entries=MAIN.map(([id,label],i)=>{
  const item=tabs[i],caption=item?.name?.replace(/신규 오픈|2학기.*?고사/g,'').trim()||label;
  const active=id===z.fMain;
  return '<button type="button" data-action="zbFMain" data-value="'+id+'" class="'+(active?'is-active':'')+'" aria-selected="'+active+'">'+esc(caption)+'</button>';
 });
 return '<nav class="zb-f-main-tabs" aria-label="원본 학습 메뉴">'+entries.join('')+'</nav>';
}
function subTabs(z,meta){
 const subs=arr(meta?.sub);
 if(!subs.length)return '';
 return '<nav class="zb-f-subtabs" aria-label="원본 하위 메뉴">'+subs.map((e,i)=>{
  const code=(e.onclick||'').match(/'(\d{15})'/)?.[1]||'';
  const active=!!e.active;
  return '<button type="button" data-action="zbFSub" data-value="'+attr(code)+'" class="'+(active?'is-active':'')+'" aria-selected="'+active+'">'+esc(e.name)+'</button>';
 }).join('')+'</nav>';
}
function filterOptions(z,key,meta){
 const source=arr(meta?.filterOptions?.[key]);
 if(source.length)return source;
 if(key==='SEARCH_GRADE')return (z.fSite==='H'?['고1','고2·3']:['중1','중2','중3']).map(name=>({name}));
 if(key==='SEARCH_SUBJECT_CD')return sourceSubjectOptions(z);
 if(key==='SEARCH_TX_CD')return [{name:arr(meta?.filters).find(f=>filterKey(f)===key)?.name||'공통'}];
 if(key==='filter_si')return ['서울','세종','대구','대전','부산','인천','울산','경기','강원','충남','충북','경남','경북','전남광주','전북','제주','기타'].map(name=>({name}));
 return [];
}
function selectedFilterLabel(z,f){
 const k=filterKey(f);
 return z.fDisplay[k]||f.name||'선택';
}
function filterBar(z,meta){
 const filters=arr(meta?.filters);
 if(!filters.length)return '';
 return '<div class="zb-f-filter" aria-label="원본 검색 필터">'+filters.map((f,i)=>
  '<button type="button" class="zb-f-filter-item" data-action="zbFFilter" data-value="'+attr(filterKey(f))+'" data-index="'+i+'" aria-label="'+esc(f.name)+' 선택"><span>'+esc(selectedFilterLabel(z,f))+'</span><b aria-hidden="true"></b></button>'
 ).join('')+'</div>';
}
function dynamicMarkup(data){
 const exams=arr(data.exams),parts=arr(data.parts);
 if(!exams.length)return '<div class="zb-f-empty">원본 공개 검색 결과 0건입니다.</div>';
 const roots=new Map();
 const partMap=new Map(parts.map(p=>[[p.rootCode,p.subCode,p.detailCode].join('/'),p]));
 for(const e of exams){
  const pn=partMap.get([e.rootPart,e.subPart,e.detailPart].join('/'))||{};
  const rk=e.rootPart||e.rootName||'기타';
  if(!roots.has(rk))roots.set(rk,{name:e.rootName||pn.root||'단원',subs:new Map()});
  const root=roots.get(rk),sk=e.subPart||e.subName||'기타';
  if(!root.subs.has(sk))root.subs.set(sk,{name:e.subName||pn.sub||'세부 단원',exams:[]});
  root.subs.get(sk).exams.push(e);
 }
 return '<div class="zbContainer is-secondary" id="examMain"><div class="zbAccordion has-toggle" id="ROOT_PART_CD">'
  +[...roots.values()].map(root=>'<div class="zbAccordion__item EXAM_PART_ITEM"><div class="zbAccordion__header">'
  +'<button type="button" class="zbAccordion__button is-unit has-nextUnit">'+esc(root.name)+'</button></div>'
  +'<div class="zbAccordion__body"><div class="zbAccordion__content"><div class="zbAccordion">'
  +[...root.subs.values()].map(sub=>'<div class="zbAccordion__item EXAM_PART_ITEM"><div class="zbAccordion__header">'
  +'<button type="button" class="zbAccordion__button is-unit">'+esc(sub.name)+'</button></div><div class="zbAccordion__body">'
  +sub.exams.map(e=>'<div class="download"><div class="grouping__box"><strong class="grouping__title">'+esc(e.detailName||e.title||'시험지')+'</strong></div>'
  +'<div class="episode__buttons"><button type="button" class="download__button" data-zb-paper-id="'+attr(e.id)+'" data-zb-paper-kind="exam">'
  +'<span class="button__text">'+esc(e.episode||e.title||'시험지')+'</span></button></div></div>').join('')
  +'</div></div>').join('')
  +'</div></div></div></div>').join('')
  +'</div></div>';
}

function pageHtml(z,meta,entry){
 if(!entry)return '<div class="zb-f-loading" role="status">원본 모바일 화면의 단원·시험지 자료를 가져오고 있습니다.</div>';
 if(entry.error)return '<div class="zb-f-error" role="alert">'+esc(entry.error)+'</div>';
 const doc=entry.data;
 if(z.fDynamicChanged)return '<div class="zb-f-loading" role="status">선택하신 조건의 원본 자료를 조회하고 있습니다.</div>';
 if(z.fDynamicError)return '<div class="zb-f-error" role="alert">선택 조건의 원본 자료를 확인할 수 없습니다. '+esc(z.fDynamicError)+'</div>';
 if(z.fDynamicData)return dynamicMarkup(z.fDynamicData);
 if(entry.liveLoading)return '<div class="zb-f-loading" role="status">원본 공개 자료 목록을 실시간으로 조회하고 있습니다.</div>';
 if(entry.liveError)return '<div class="zb-f-error" role="alert">원본 자료 목록을 확인하지 못했습니다. '+esc(entry.liveError)+'</div>';
 if(entry.liveData)return dynamicMarkup(entry.liveData);
 return doc.html||'<div class="zb-f-empty">원본 공개 결과가 없습니다.</div>';
}
function infoSheet(z,meta){
 if(!z.fSelected)return '';
 const item=z.fSelected;
 return '<div class="zb-f-backdrop" data-action="zbFClose" role="presentation"></div>'
 +'<section class="zb-f-sheet" role="dialog" aria-modal="true" aria-label="원본 자료 상세">'
 +'<div class="zb-f-sheet-head"><strong>원본 자료</strong><button type="button" data-action="zbFClose" aria-label="닫기">×</button></div>'
 +'<h3>'+esc(item.title||'시험 자료')+'</h3>'
 +'<div class="zb-f-sheet-meta">원본 자료번호 <b>'+esc(item.id)+'</b></div>'
 +'<p>실제 족보닷컴에서 확인된 자료번호입니다. 문제 본문·정답·해설 및 동영상·파일 열람은 원본 계정의 권한을 확인하여 진행됩니다.</p>'
 +'<a href="'+attr(meta?.originalUrl||'https://m.zocbo.com/')+'" target="_blank" rel="noopener noreferrer">족보닷컴 원본 화면 열기</a>'
 +'<button type="button" data-action="zbFCopy" data-value="'+attr(item.id)+'">자료번호 복사</button></section>';
}
function optionSheet(z,meta){
 const key=z.fDrawer;if(!key)return '';
 const title=({'SEARCH_GRADE':'학년','SEARCH_SUBJECT_CD':'과목','SEARCH_TX_CD':'교과서',
   'SEARCH_LEVEL_CD':'난이도','SEARCH_STEP_CD':'학습 단계','filter_type':'유형',
   'filter_si':'시·도','filter_gu':'시·군·구','filter_sch':'학교','filter_grade':'학년',
   'filter_subject':'과목','filter_Chapter':'범위 선택'})[key]||'선택';
 let opts=z.fOptionsOverride&&z.fOptionsOverride[key]||filterOptions(z,key,meta);
 return '<div class="zb-f-backdrop" data-action="zbFClose" role="presentation"></div>'
 +'<section class="zb-f-sheet zb-f-picker" role="dialog" aria-modal="true" aria-label="'+title+' 선택">'
 +'<div class="zb-f-sheet-head"><strong>'+esc(title)+'</strong><button data-action="zbFClose" aria-label="닫기">×</button></div>'
 +(z.fOptionsLoading?'<p>원본 선택지를 불러오는 중입니다.</p>':'')
 +(z.fOptionsError?'<p class="zb-f-error">'+esc(z.fOptionsError)+'</p>':'')
 +'<div class="zb-f-choices">'+arr(opts).map((o,i)=>{
  const name=o.name||o.label||String(o);
  const current=(z.fDisplay[key]||arr(meta?.filters).find(f=>filterKey(f)===key)?.name||'');
  return '<button type="button" data-action="zbFChoose" data-value="'+i+'" data-key="'+attr(key)+'" class="'+(current===name?'is-active':'')+'"><span>'+esc(name)+'</span><span class="zb-f-choice-check">'+(current===name?'✓':'')+'</span></button>';
 }).join('')+'</div></section>';
}
function sourcePage(s){
 sCurrent=s;
 const z=state(s);
 ensureIndex();
 if(!sourceIndex)return '<div class="zb-faithful"><div class="zb-f-loading" role="status">원본 족보닷컴 학년·과목 메뉴를 불러오는 중입니다.</div></div>';
 if(sourceIndex.error)return '<div class="zb-faithful zb-f-error">'+esc(sourceIndex.error)+'</div>';
 const meta=getMeta(z),entry=getPage(z);
 if(!meta)return '<div class="zb-faithful"><div class="zb-f-error">해당 학년·과목·메뉴의 원본 화면이 확인되지 않았습니다. 임의의 수학 화면으로 대체하지 않았습니다.</div><button type="button" data-action="zbFReset">중2 수학 원본 보기</button></div>';
 const content=pageHtml(z,meta,entry);
 const originalIsDifferent=meta.originalSubject&&meta.originalSubject!==z.fSubject;
 return '<div class="zb-faithful" data-source-case="'+attr(z.fCase)+'">'
  +siteBar(z)+topTabs(z,meta)+subTabs(z,meta)+filterBar(z,meta)
  +'<div class="zb-f-content">'+content+'</div>'
  +(originalIsDifferent?'<p class="zb-f-source-notice">원본 사이트가 선택 요청을 '+esc(meta.originalSubject)+' 과목으로 이동시킨 화면입니다.</p>':'')
  +(z.fDrawer?optionSheet(z,meta):'')
  +(z.fSelected?infoSheet(z,meta):'')
  +'</div>';
}
function redraw(){
 if(!sCurrent||!document.querySelector('#phone .zb-faithful'))return;
 const host=document.querySelector('#phone .zb-faithful');
 if(host)host.outerHTML=sourcePage(sCurrent);
}
function clearSelection(z){
 z.fCase='';z.fDrawer='';z.fSelected=null;z.fDisplay={};z.fDynamicChanged=false;z.fDynamicData=null;z.fDynamicError='';
}
function setMain(z,cat){
 if(!MAIN.some(x=>x[0]===cat))return;
 z.fMain=cat;clearSelection(z);
}
function gradeFromName(z,name){
 if(name.startsWith('중')){z.fSite='M';z.fGrade=name.match(/[123]/)?.[0]||'2';}
 else if(name.startsWith('고')){z.fSite='H';z.fGrade=name.match(/[12]/)?.[0]||'2';}
}
function pickFromOptions(z,meta,key,value,toast,render){
 const opts=z.fOptionsOverride&&z.fOptionsOverride[key]||filterOptions(z,key,meta);
 const opt=opts[Number(value)];
 if(!opt)return;
 const name=opt.name||opt.label||String(opt);
 if(key==='SEARCH_GRADE'||key==='filter_grade'){
  gradeFromName(z,name);
  const allowed=sourceSubjectOptions(z);
  if(!allowed.some(x=>x.code===z.fSubject))z.fSubject=allowed[0]?.code||'MT';
  clearSelection(z);
 }else if(key==='SEARCH_SUBJECT_CD'||key==='filter_subject'){
  const row=sourceSubjectOptions(z).find(x=>x.name===name||x.code===opt.code);
  if(row){z.fSubject=row.code;clearSelection(z);}
  else {z.fDisplay[key]=name;z.fDrawer='';}
 }else if(key==='filter_si'||key==='filter_gu'||key==='filter_sch'){
  z.fDisplay[key]=name;z.fDrawer='';
  if(key==='filter_si'){z.fDisplay.filter_gu='';z.fDisplay.filter_sch='';}
  if(key==='filter_gu')z.fDisplay.filter_sch='';
 }else{
  z.fDisplay[key]=name;
  z.fDrawer='';
  z.fDynamicChanged=false;
  // SOURCE SELECTED: only explicitly captured source state may be shown; never re-label old dataset as new textbook.
  if(key==='SEARCH_TX_CD'||key==='SEARCH_LEVEL_CD'||key==='SEARCH_STEP_CD'){
   const original=arr(meta.filters).find(f=>filterKey(f)===key)?.name||'';
   z.fDynamicData=null;z.fDynamicError='';
   if(name!==original){
    z.fDynamicChanged=true;
    requestChangedFilter(z,meta,key,opt,render,toast);
   }
  }
 }
 render();
}
function requestChangedFilter(z,meta,key,opt,render,toast){
 const original=meta.originalUrl||'';
 const params=new URLSearchParams({
  case:z.fCase,changedFilter:key,choice:opt.value||''
 });
 fetch('/api/zocbo/public-filtered?'+params,{credentials:'omit'})
 .then(async r=>{const data=await r.json();if(!r.ok||!data.ok)throw Error(data.reason||data.error||'원본 검색 불가');return data})
 .then(data=>{z.fDynamicData=data;z.fDynamicChanged=false;render();})
 .catch(e=>{z.fDynamicChanged=false;z.fDynamicError=String(e.message||e);render();});
}
function requestSchoolChoices(z,meta,key,render){
 if(key!=='filter_gu'&&key!=='filter_sch')return;
 z.fOptionsLoading=true;z.fOptionsError='';
 const city=z.fDisplay.filter_si||'서울';
 const gu=z.fDisplay.filter_gu||'강남구';
 const params=new URLSearchParams({site:z.fSite,si:city});
 if(key==='filter_sch')params.set('gu',gu);
 fetch('/api/zocbo/public-school-options?'+params,{credentials:'omit'})
 .then(async r=>{const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'원본 조회 오류');return data})
 .then(data=>{z.fOptionsOverride=z.fOptionsOverride||{};z.fOptionsOverride[key]=data.list;z.fOptionsLoading=false;render();})
 .catch(e=>{z.fOptionsLoading=false;z.fOptionsError=String(e.message||e);render();});
}
UI.page=function(id,s){
 if(['bankHome','bankSearch','bankResults','bankSchool','bankCategory'].includes(id)){
  const z=state(s);
  if(id==='bankSchool'&&z.fMain!=='school')setMain(z,'school');
  if(id==='bankCategory'&&z.fMain!=='concept')setMain(z,'concept');
  return sourcePage(s);
 }
 return priorPage(id,s);
};
UI.onAction=function(act,el,s,go,render,toast){
 if(!act||!act.startsWith('zbF'))return priorAction(act,el,s,go,render,toast);
 const z=state(s),value=el.dataset.value||'',meta=getMeta(z);
 if(act==='zbFSite'){
  if(value!=='M'&&value!=='H')return;
  z.fSite=value;z.fGrade=value==='M'?'2':'1';z.fSubject='MT';clearSelection(z);
 }else if(act==='zbFMain'){
  setMain(z,value);
 }else if(act==='zbFSub'){
  const ids=casesFor(z);
  const selected=ids.find(id=>sourceIndex.cases[id].subCode===value);
  if(!selected){toast('원본 하위 메뉴 자료가 확인되지 않았습니다.');return;}
  z.fCase=selected;z.fDisplay={};z.fDrawer='';z.fSelected=null;z.fDynamicData=null;z.fDynamicError='';z.fDynamicChanged=false;
  const source=sourceIndex.cases[selected];
  if(source.originalSubject!==z.fSubject&&source.originalSubject){
   z.fSubject=source.originalSubject;
   const other=casesFor(z).find(id=>sourceIndex.cases[id].subCode===value);
   if(other)z.fCase=other;
  }
 }else if(act==='zbFFilter'){
  z.fDrawer=value;z.fOptionsError='';z.fOptionsLoading=false;z.fOptionsOverride={};
  requestSchoolChoices(z,meta,value,render);
 }else if(act==='zbFChoose'){
  pickFromOptions(z,meta,el.dataset.key||z.fDrawer,value,toast,render);
  return;
 }else if(act==='zbFClose'){
  z.fDrawer='';z.fSelected=null;
 }else if(act==='zbFReset'){
  z.fSite='M';z.fGrade='2';z.fSubject='MT';z.fMain='unit';clearSelection(z);
 }else if(act==='zbFCopy'){
  const id=value;
  navigator.clipboard?.writeText(id).then(()=>toast('자료번호를 복사했습니다.')).catch(()=>toast('클립보드 접근이 제한됐습니다.'));
  return;
 }
 render();
};
document.addEventListener('click',ev=>{
 const host=ev.target.closest('#phone .zb-faithful');
 if(!host)return;
 const paper=ev.target.closest('[data-zb-paper-id], #list_A li[data-no]');
 if(paper){
  ev.preventDefault();ev.stopPropagation();
  const s=sCurrent;if(!s)return;
  const z=state(s);
  z.fSelected={id:paper.dataset.zbPaperId||paper.dataset.no||'',
    title:paper.querySelector('.button__text,.title,.download__title')?.textContent?.trim()||paper.textContent.trim().slice(0,110)};
  redraw();return;
 }
 const acc=ev.target.closest('.zbAccordion__header > button');
 if(acc){
  ev.preventDefault();ev.stopPropagation();
  const item=acc.closest('.zbAccordion__item');
  if(!item)return;
  const opening=!item.classList.contains('zb-f-open');
  item.classList.toggle('zb-f-open',opening);
  acc.setAttribute('aria-expanded',String(opening));
  return;
 }
});
window.ZOCBO_FAITHFUL_INSPECT=()=>({current:sCurrent?.zocbo,source:sourceIndex?.stats,loadedPages:views.size});
})();
