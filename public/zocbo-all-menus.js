/* HITEL — actual original mobile six-menu layer.
 * The four user-supplied mobile HTML DOMs are preserved verbatim in docs.
 * Mode metadata is captured from original public mobile pages in GitHub Actions.
 * Never simulates a successful password, PDF download, purchase, or video playback.
 */
(function(){
'use strict';
const UI=window.ZOCBOUI;
const oldPage=UI.page,oldAction=UI.onAction;
const tabs=[
 {id:'concept',name:'개념학습',href:'/exam/examListWeb.asp?menu_cd=000010000100001&siteid=M&subject_cd=MT'},
 {id:'unit',name:'단원별 학습',href:'/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=MT'},
 {id:'practice',name:'실전대비',href:'/exam/examListWeb.asp?menu_cd=000010000300001&siteid=M&subject_cd=MT'},
 {id:'final',name:'직전대비',href:'/exam/examListWeb.asp?menu_cd=000010000400001&siteid=M&subject_cd=MT'},
 {id:'school',name:'학교별 맞춤학습',href:'/M/expected.asp'},
 {id:'gangnam',name:'강남 3구 유형공략',href:'/M/?menu=2&type=4'}
];
const subtabs={
 concept:[['concept_complete','개념완성','000010000100001'],['concept_calculation','계산력 문제','000010000100004']],
 unit:[['unit_level','수준별 학습','000010000200003'],['unit_master','수학 MASTER','000010000200002']],
 practice:[
  ['practice_essay','서술형 공략','000010000300001'],
  ['practice_frequent','최다빈출 공략','000010000300002'],
  ['practice_wrong','최다오답 공략','000010000300003'],
  ['practice_top','최상위 공략','000010000300004'],
  ['practice_performance','수행평가 공략','000010000300009'],
  ['practice_textbook','교과서 변형','000010000300008']],
 final:[['final_main','직전대비','000010000400001']],
 school:[['school_expected','학교별 예상족보','']],
 gangnam:[['gangnam_list','강남 3구 유형공략','']]
};
const rawFallback={concept:'concept',practice:'practice',gangnam:'gangnam',unit:'unit'};
const sourceCache=new Map(),loading=new Set();
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const arr=x=>Array.isArray(x)?x:[];
const attr=esc;
function zstate(s){
 const z=s.zocbo||(s.zocbo={});
 if(!tabs.some(t=>t.id===z.allMenu))z.allMenu='unit';
 if(!subtabs[z.allMenu].some(x=>x[0]===z.allSub))z.allSub=subtabs[z.allMenu][0][0];
 if(typeof z.allQuery!=='string')z.allQuery='';
 return z;
}
function official(t,z){
 const url=new URL(t.href,'https://m.zocbo.com');
 if(url.pathname.toLowerCase().endsWith('examlistweb.asp')){
  url.searchParams.set('siteid',z.liveGrade?.startsWith('고')?'H':'M');
  url.searchParams.set('subject_cd',z.liveSubject||'MT');
  const code=(subtabs[z.allMenu]||[]).find(x=>x[0]===z.allSub)?.[2];
  if(code)url.searchParams.set('menu_cd',(z.liveGrade?.startsWith('고')?'00002':'00001')+code.slice(5));
 }
 return url.href;
}
function itemHref(z){
 const t=tabs.find(x=>x.id===z.allMenu)||tabs[1];
 return official(t,z);
}
function parseSnapshot(mode,html){
 const doc=new DOMParser().parseFromString(html,'text/html');
 if(mode==='gangnam'){
  const records=[...doc.querySelectorAll('#list_A li[data-no]')].map(li=>({
   id:li.dataset.no||'',title:li.dataset.title||li.querySelector('.title')?.textContent?.trim()||'',
   site:li.dataset.siteid||'M',grade:li.dataset.grade||'',subject:li.dataset.subjcode||'',
   tx:li.dataset.tx||'',year:li.dataset.year||'',
   tags:[...li.querySelectorAll('.tag span')].map(e=>e.textContent.trim())
  })).filter(x=>x.id&&x.title);
  return {slug:'gangnam_list',records,source:'user-original-html'};
 }
 const roots=[...doc.querySelectorAll('#ROOT_PART_CD > .zbAccordion__item')];
 const chapters=roots.map(root=>{
  const name=root.querySelector(':scope > .zbAccordion__header .zbAccordion__button')?.textContent?.trim()||'';
  const subs=[...root.querySelectorAll('.zbAccordion__item')].map(sub=>{
   const subName=sub.querySelector(':scope > .zbAccordion__header .zbAccordion__button')?.textContent?.trim()||'';
   const details=[...sub.querySelectorAll('div.download')].map(block=>{
    const label=block.querySelector('.grouping__title')?.textContent?.trim()||'';
    const tags=[...block.querySelectorAll('.download__badge span')].map(x=>x.textContent.trim());
    const items=[...block.querySelectorAll('button[onclick]')].map(btn=>{
     const call=btn.getAttribute('onclick')||'';
     const kind=call.includes('goExpaprLayer')?'exam':call.includes('goDownLayer')?'video':'unknown';
     const ids=[...call.matchAll(/\b\d{5,}\b/g)].map(m=>m[0]);
     let id=ids[0]||'';
     if(kind==='video')id=ids[0]||'';
     return {name:btn.textContent.trim(),kind,id,videoId:kind==='video'?ids[ids.length-1]:null,sourceAction:call};
    }).filter(x=>x.id&&x.kind!=='unknown');
    return {name:label,tags,items};
   }).filter(x=>x.items.length>0);
   return {name:subName,details};
  }).filter(x=>x.details.length>0);
  return {name,subs};
 }).filter(x=>x.subs.length>0);
 return {slug:mode,chapters,items:chapters.flatMap(x=>x.subs.flatMap(y=>y.details.flatMap(z=>z.items))).length,source:'user-original-html'};
}
function load(slug,category){
 if(sourceCache.has(slug)||loading.has(slug))return;
 loading.add(slug);
 setTimeout(async()=>{
  try{
   let data=null;
   const res=await fetch('/api/zocbo/menu-data?'+new URLSearchParams({slug}),{credentials:'omit'});
   if(res.ok){data=await res.json();}
   const incomplete=!data||(!arr(data.chapters).length&&!arr(data.records).length&&slug!=='school_expected');
   if(incomplete&&rawFallback[category]&&['concept_complete','unit_level','practice_essay','gangnam_list'].includes(slug)){
    const fallback=await fetch('/api/zocbo/original-html?'+new URLSearchParams({mode:rawFallback[category]}),{credentials:'omit'});
    if(fallback.ok)data=parseSnapshot(rawFallback[category],await fallback.text());
   }
   if(!data)throw Error('해당 원본 메뉴의 데이터가 아직 확보되지 않았습니다.');
   sourceCache.set(slug,{data});
  }catch(e){sourceCache.set(slug,{error:String(e.message||e).slice(0,120)});}
  finally{
   loading.delete(slug);
   const s=window.ZOCBO_ALL_MENUS_STATE;
   if(s&&zstate(s).allSub===slug&&document.querySelector('#phone .zb-all-wrapper'))window.ZOCBO_ALL_MENUS_RENDER?.();
  }
 },0);
}
function topMenu(z){
 return '<nav class="zb-all-tabs" aria-label="족보닷컴 원본 학습 메뉴">'+tabs.map(t=>
  '<button type="button" data-action="zbAllMenu" data-value="'+t.id+'" class="'+(z.allMenu===t.id?'active':'')+'" aria-pressed="'+(z.allMenu===t.id)+'">'+esc(t.name)+'</button>'
 ).join('')+'</nav>';
}
function subMenu(z){
 const items=subtabs[z.allMenu];
 if(items.length<2)return '';
 return '<nav class="zb-all-subtabs" aria-label="원본 하위 메뉴">'+items.map(x=>
 '<button type="button" data-action="zbAllSub" data-value="'+x[0]+'" aria-pressed="'+(z.allSub===x[0])+'" class="'+(z.allSub===x[0]?'active':'')+'">'+esc(x[1])+'</button>'
 ).join('')+'</nav>';
}
function sourceGradeBar(z){
 return '<div class="zb-all-current"><span>중2</span><span>수학</span><span>공통</span>'
 +(z.allMenu==='unit'?'<span>기본</span>':'')
 +'<button type="button" data-action="zbAllChangeGrade">학년·과목 변경</button></div>';
}
function originalButton(z){
 return '<div class="zb-all-official"><a target="_blank" rel="noopener noreferrer" href="'+attr(itemHref(z))+'">족보닷컴 해당 원본 메뉴 열기</a></div>';
}
function rootPanel(chapters,z,slug){
 const all=arr(chapters),query=z.allQuery.trim().toLowerCase();
 const filtered=query?all.map(r=>({...r,subs:arr(r.subs).map(s=>({...s,details:arr(s.details).map(d=>({...d,items:arr(d.items).filter(item=>
  [r.name,s.name,d.name,item.name].join(' ').toLowerCase().includes(query))})).filter(x=>x.items.length)})).filter(x=>x.details.length)})).filter(x=>x.subs.length):all;
 const count=filtered.reduce((a,r)=>a+arr(r.subs).reduce((b,s)=>b+arr(s.details).reduce((c,d)=>c+arr(d.items).length,0),0),0);
 return '<div class="zb-native-summary"><b>원본 자료 '+count+'건</b><small>대단원 '+filtered.length+'개</small></div>'
 +'<div class="zb-all-roots">'+filtered.map((root,i)=>{
  const rk=slug+':'+i,open=query||z.allRoot===rk;
  return '<section class="zb-native-root"><button class="zb-native-root-head" data-action="zbAllRoot" data-value="'+attr(rk)+'" aria-expanded="'+!!open+'"><span>'+esc(root.name)+'</span><small>'+arr(root.subs).length+'개 소단원</small><b>'+(open?'⌄':'›')+'</b></button>'
   +(open?'<div class="zb-native-root-body">'+arr(root.subs).map((sub,j)=>{
    const sk=rk+':'+j,so=query||z.allOpenSub===sk;
    return '<div class="zb-native-sub"><button class="zb-native-sub-head" data-action="zbAllOpenSub" data-value="'+attr(sk)+'" aria-expanded="'+!!so+'"><span>'+esc(sub.name)+'</span><b>'+(so?'−':'+')+'</b></button>'
     +(so?'<div class="zb-native-sub-body">'+arr(sub.details).map(d=>
      '<div class="zb-native-detail"><div class="zb-native-detail-name">'+esc(d.name)+'</div>'
       +'<div class="zb-all-tags">'+arr(d.tags).map(tag=>'<span>'+esc(tag)+'</span>').join('')+'</div>'
       +'<div class="zb-native-episodes">'+arr(d.items).map(x=>
        '<button type="button" class="zb-native-episode zb-all-record '+(x.kind==='video'?'has-video':'')+'" data-action="zbAllRecord" data-value="'+attr(x.id)+'" data-slug="'+attr(slug)+'">'+esc(x.name||x.id)+(x.kind==='video'?' ▶':'')+'</button>'
       ).join('')+'</div></div>').join('')+'</div>':'')+'</div>';
   }).join('')+'</div>':'')+'</section>';
 }).join('')+'</div>';
}
function listPanel(records,z,slug){
 const q=z.allQuery.trim().toLowerCase();
 const rows=arr(records).filter(e=>!q||[e.title,e.name,...arr(e.tags)].join(' ').toLowerCase().includes(q));
 return '<div class="zb-native-summary"><b>원본 검색결과 '+rows.length+'건</b><small>자료번호 연동</small></div><div class="zb-native-titles">'
 +rows.map(e=>'<button class="zb-native-title-item" data-action="zbAllRecord" data-value="'+attr(e.id)+'" data-slug="'+attr(slug)+'"><span><b>'+esc(e.title||e.name)+'</b><small>'+arr(e.tags).map(esc).join(' · ')+'</small></span><em>›</em></button>').join('')+'</div>';
}
function findRecord(data,id){
 for(const root of arr(data?.chapters))for(const sub of arr(root.subs))for(const detail of arr(sub.details))for(const item of arr(detail.items))if(String(item.id)===id)return {...item,chapter:[root.name,sub.name,detail.name].join(' › ')};
 return arr(data?.records).find(x=>String(x.id)===id);
}
function infoSheet(z,data){
 if(!z.allSelected)return '';
 const item=findRecord(data,z.allSelected);if(!item)return '';
 return '<div class="zb-native-sheet-mask" data-action="zbAllClose"></div><section class="zb-native-sheet" role="dialog" aria-modal="true" aria-label="원본 자료 정보">'
 +'<div class="zb-native-sheet-top"><h3>원본 자료 정보</h3><button data-action="zbAllClose" aria-label="닫기">×</button></div>'
 +'<h4>'+esc(item.title||item.name)+'</h4><dl><dt>자료번호</dt><dd>'+esc(item.id)+'</dd>'
 +'<dt>유형</dt><dd>'+esc(item.kind==='video'?'원본 동영상 관련 항목':item.kind==='exam'?'원본 시험자료':'원본 검색자료')+'</dd>'
 +(item.chapter?'<dt>단원</dt><dd>'+esc(item.chapter)+'</dd>':'')+'</dl>'
 +'<p>원본 자료번호와 버튼 항목을 확인했습니다. 원본 사이트의 개별 파일·동영상 재생은 별도 계정 및 이용권 확인이 필요하며, 이 화면에서는 성공으로 처리하지 않습니다.</p>'
 +'<a class="zb-native-official-link" href="'+attr(itemHref(z))+'" target="_blank" rel="noopener noreferrer">족보닷컴 원본 메뉴 열기</a>'
 +'<button class="zb-native-sheet-copy" data-action="zbAllCopy" data-value="'+attr(item.id)+'">자료번호 복사</button></section>';
}
function schoolPanel(z,data){
 const src=arr(data?.filters);
 const sourceValue=(act,def)=>{const label=src.find(x=>x.action===act)?.name;return !label||['지역','구/군','학교'].includes(label)?def:label;};
 const controls=[
  ['filter_type','학교별 예상족보','종류'],
  ['filter_si',sourceValue('filter_si','서울'),'시·도'],
  ['filter_gu',sourceValue('filter_gu','강남구'),'시·군·구'],
  ['filter_sch',sourceValue('filter_sch','숙명여자중학교'),'학교'],
  ['filter_grade',sourceValue('filter_grade','2학년'),'학년'],
  ['filter_subject',sourceValue('filter_subject','수학'),'과목'],
  ['filter_Chapter','범위 선택','시험 범위']
 ];
 return '<div class="zb-all-school"><p class="zb-all-school-intro">학교별 예상족보</p>'
  +'<div class="zb-all-school-controls">'+controls.map(([a,v,n])=>
    '<button type="button" data-action="zbAllSchoolFilter" data-value="'+attr(a)+'" aria-label="'+esc(n)+' 선택"><small>'+esc(n)+'</small><span>'+esc(v)+'</span><b>⌄</b></button>'
   ).join('')+'</div>'
  +'<div class="zb-all-school-zero"><b>총 '+esc(data?.total||'0')+'개</b><p>선택 학교의 원본 결과는 계정 및 학교·범위 검색 상태에 따라 달라집니다. 현재 확보된 원본 HTML에는 검색 결과가 없습니다.</p></div>'
  +'</div>';
}
function content(z){
 const slug=z.allSub;
 const entry=sourceCache.get(slug);
 if(!entry){load(slug,z.allMenu);return '<div class="zb-native-loading" role="status">원본 모바일 메뉴 자료를 불러오는 중입니다.</div>';}
 if(entry.error)return '<div class="zb-native-error" role="alert">'+esc(entry.error)+'</div>'+originalButton(z);
 const data=entry.data;
 const body=z.allMenu==='school'?schoolPanel(z,data):
    z.allMenu==='gangnam'?listPanel(data.records,z,slug):
    arr(data.chapters).length?rootPanel(data.chapters,z,slug):
    '<div class="zb-native-empty">해당 메뉴에서 공개 단원·회차 자료가 확인되지 않았습니다. 원본 화면에서 메뉴를 확인하실 수 있습니다.</div>';
 return body+infoSheet(z,data);
}
function sourcePage(s){
 const z=zstate(s);
 window.ZOCBO_ALL_MENUS_STATE=s;
 const t=tabs.find(x=>x.id===z.allMenu);
 const modeHtml= z.allMenu==='unit'&&z.allSub==='unit_level'
  ?oldPage('bankSearch',s).replace(/<div class="zb-shortcuts">[\s\S]*?<\/div>/,'')
  :('<div class="zb-all-raw"><div class="zb-all-source-title"><h3>'+esc(t.name)+'</h3><small>중2 · 수학 원본 자료 기준</small></div>'
    +(z.allMenu==='school'?'':'<label class="zb-native-search-wrap"><span>검색</span><input type="search" data-zb-all-search placeholder="원본 단원·제목 검색" value="'+attr(z.allQuery)+'"></label>')
    +'<div id="zb-all-source-results">'+content(z)+'</div>'+originalButton(z)+'</div>');
 return '<div class="zb-all-wrapper">'+topMenu(z)+subMenu(z)
  +(z.allMenu==='unit'&&z.allSub==='unit_level'?'':sourceGradeBar(z))
  +'<div class="zb-all-section">'+modeHtml+'</div></div>';
}
function update(){const s=window.ZOCBO_ALL_MENUS_STATE;if(s)window.ZOCBO_ALL_MENUS_RENDER?.(s);}
function renderInPlace(s){
 if(!s)return;
 const host=document.querySelector('#phone .zb-all-wrapper');
 if(host){host.outerHTML=sourcePage(s);}
}
window.ZOCBO_ALL_MENUS_RENDER=renderInPlace;
UI.page=function(id,s){
 const z=zstate(s);
 if(id==='bankSchool'){z.allMenu='school';z.allSub='school_expected';return sourcePage(s);}
 if(id==='bankCategory'){z.allMenu='concept';z.allSub='concept_complete';return sourcePage(s);}
 if(id==='bankHome'||id==='bankSearch'||id==='bankResults')return sourcePage(s);
 return oldPage(id,s);
};
UI.onAction=function(act,el,s,go,render,toast){
 const z=zstate(s);
 if(!act.startsWith('zbAll'))return oldAction(act,el,s,go,render,toast);
 const value=el?.dataset?.value||'';
 if(act==='zbAllMenu'){
  if(!tabs.some(x=>x.id===value))return;
  z.allMenu=value;z.allSub=subtabs[value][0][0];z.allSelected='';z.allRoot='';z.allOpenSub='';z.allQuery='';
  // All four supplied reference pages explicitly use middle-school year 2 mathematics.
  if(value!=='unit'){z.liveGrade='중2';z.liveSubject='MT';}
 }else if(act==='zbAllSub'){
  if(!subtabs[z.allMenu]?.some(x=>x[0]===value))return;
  z.allSub=value;z.allRoot='';z.allOpenSub='';z.allSelected='';z.allQuery='';
 }else if(act==='zbAllRoot'){z.allRoot=z.allRoot===value?'':value;z.allOpenSub='';}
 else if(act==='zbAllOpenSub')z.allOpenSub=z.allOpenSub===value?'':value;
 else if(act==='zbAllRecord'){z.allSelected=value;}
 else if(act==='zbAllClose'){z.allSelected='';}
 else if(act==='zbAllChangeGrade'){
  z.allMenu='unit';z.allSub='unit_level';z.allSelected='';
  render();return;
 }else if(act==='zbAllSchoolFilter'){
  // Original dropdown contents are not in the supplied HTML. Do not invent school options.
  const src=sourceCache.get('school_expected')?.data;
  const f=arr(src?.filters).find(x=>x.action===value);
  const label=f?.name||value;
  toast(label+' — 다른 선택지는 족보닷컴 원본에서 확인합니다.');
  return;
 }else if(act==='zbAllCopy'){
  navigator.clipboard?.writeText(value).then(()=>toast('원본 자료번호를 복사했습니다.')).catch(()=>toast('복사가 제한되었습니다.'));
  return;
 }
 window.ZOCBO_ALL_MENUS_STATE=s;
 render();
};
document.addEventListener('input',ev=>{
 if(!ev.target.matches('[data-zb-all-search]'))return;
 const s=window.ZOCBO_ALL_MENUS_STATE;if(!s)return;
 const z=zstate(s);z.allQuery=ev.target.value;
 const host=document.getElementById('zb-all-source-results');
 if(host)host.innerHTML=content(z);
});
})();