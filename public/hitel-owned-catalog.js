/* HITEL first-party education catalog. Bibliographic metadata only.
 * No external source's categories/ratings are used in the student UI.
 * 1,739 books, 2,154 learning-resource records, 370 series.
 */
(function () {
'use strict';
if (!window.YPT_GRAPH || typeof window.groupPage !== 'function') return;
const script = document.currentScript;
const DATA_BASE = new URL('./data/catalog-v3/', script.src);
const INDEX = {
  series: ['id','title','cover','count','complete','url'],
  books: ['id','series_id','title','cover','isbn','publisher','author','published_at','url','school','grade','semester','subject','category','checked'],
  materials: ['id','title','url','school','grade','semester','subject','category','material_type','related_book_id','related_series_id','relation_status','edition_warning','deep_reviewed']
};
const FILTERS = ['전체','개념·기본','연산·기초','유형·연습','심화·탐구','학교·내신','수능·실전','정답·해설','기타·미분류'];
const ROUTES = new Set(['groupAITutor','groupMoonzipSearch','groupMoonzipSeries','groupTutorCatalog']);
const esc = x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog={series:[],books:[],materials:[],manifest:null};
let phase='waiting',failure='',fetchTask=null;
let booksById=new Map(),seriesById=new Map(),docsByBook=new Map();
const ui={tab:'all',q:'',school:'전체',grade:'전체',subject:'전체',semester:'전체',category:'전체',sort:'title',page:1,chosen:''};
try{ui.chosen=sessionStorage.getItem('hitel.catalog.selected.v3')||'';}catch(_){}
const oldPage=groupPage,oldBottom=bottomFor;
window.YPT_GRAPH.groupAITutor={title:'HITEL 교재 찾기',evidence:[],actions:[{text:'학습반',go:'groups'}]};
window.YPT_GRAPH.groupMoonzipSearch={title:'HITEL 교재 검색',evidence:[],actions:[{text:'AI 과외',go:'groupAITutor'}]};
window.YPT_GRAPH.groupMoonzipSeries={title:'교재 상세',evidence:[],actions:[{text:'교재 목록',go:'groupMoonzipSearch'}]};
window.YPT_GRAPH.groupTutorCatalog={title:'교재별 AI 과외',evidence:[],actions:[{text:'AI 과외',go:'groupAITutor'}]};
function rowToObject(row,labels){let obj={};for(let i=0;i<labels.length;i++)obj[labels[i]]=row[i];return obj;}
function snapshot(){
 return {
  loaded:phase==='ready',status:phase,countBooks:catalog.books.length,
  countMaterials:catalog.materials.length,countSeries:catalog.series.length,
  selected:ui.chosen,visibleTab:ui.tab,privateBackend:false
 };
}
window.HITEL_OWNED_CATALOG_INSPECT=snapshot;
function rerender(){
 if (!ROUTES.has(state.screen)) return;
 try {render();} catch(err){ console.error('[HITEL catalog] render failure',err); }
}
function load(){
 if(fetchTask)return fetchTask;
 phase='loading';
 fetchTask=fetch(new URL('manifest.json',DATA_BASE),{cache:'no-store'}).then(async r=>{
  if(!r.ok)throw Error('카탈로그 목록을 읽을 수 없습니다 ('+r.status+')');
  const manifest=await r.json();
  if (!Array.isArray(manifest.files) || manifest.files.length!==40)throw Error('카탈로그 파일 목록이 올바르지 않습니다');
  const subsets=await Promise.all(manifest.files.map(async f=>{
   const rr=await fetch(new URL(f.file,DATA_BASE));
   if(!rr.ok)throw Error('교재 데이터 '+f.file+' 불러오기 실패 ('+rr.status+')');
   const data=await rr.json();
   if(!INDEX[data.type] || data.type!==f.type || !Array.isArray(data.rows) || data.rows.length!==f.rows){
    throw Error('교재 데이터 검증 오류 '+f.file);
   }
   return {type:data.type,items:data.rows.map(r=>rowToObject(r,INDEX[data.type]))};
  }));
  const loaded={series:[],books:[],materials:[],manifest};
  for(const part of subsets)loaded[part.type].push(...part.items);
  const counts=manifest.counts||{};
  if (loaded.series.length!==counts.series || loaded.books.length!==counts.books ||
      loaded.materials.length!==counts.materials || loaded.books.length!==1739 || loaded.materials.length!==2154){
   throw Error('교재 수량 검증에 실패했습니다');
  }
  catalog=loaded;
  booksById=new Map(loaded.books.map(b=>[b.id,b]));
  seriesById=new Map(loaded.series.map(s=>[s.id,s]));
  docsByBook=new Map();
  for(const m of loaded.materials){
   if(!m.related_book_id||!booksById.has(m.related_book_id))continue;
   const arr=docsByBook.get(m.related_book_id)||[];
   arr.push(m);docsByBook.set(m.related_book_id,arr);
  }
  phase='ready';failure='';
  rerender();
 }).catch(e=>{phase='error';failure=String(e.message||e);rerender();console.error('[HITEL catalog]',e);});
 return fetchTask;
}
function title(v){return v.title||'교재명 미확인';}
function labelSchool(v){return [v.school,v.grade,v.semester?v.semester+'학기':'',v.subject].filter(Boolean).join(' · ')||'학습 대상 정보 미확인';}
function convert(kind,v){
 return kind==='books'?{...v,kind,uid:'book:'+v.id,name:title(v)}:
  kind==='materials'?{...v,kind,uid:'material:'+v.id,name:title(v),cover:''}:
  {...v,kind,uid:'series:'+v.id,name:title(v),school:'',grade:'',semester:'',subject:'',category:'기타·미분류'};
}
function allItems(){
 if(ui.tab==='books')return catalog.books.map(v=>convert('books',v));
 if(ui.tab==='materials')return catalog.materials.map(v=>convert('materials',v));
 if(ui.tab==='series')return catalog.series.map(v=>convert('series',v));
 return [...catalog.books.map(v=>convert('books',v)),...catalog.materials.map(v=>convert('materials',v))];
}
function filterList(items){
 const q=ui.q.trim().toLocaleLowerCase('ko-KR');
 const listed=items.filter(v=>{
  if(ui.school!=='전체'&&(v.school||'미확인')!==ui.school)return false;
  if(ui.grade!=='전체'&&(v.grade||'미확인')!==ui.grade)return false;
  if(ui.semester!=='전체'&&(v.semester||'미확인')!==ui.semester)return false;
  if(ui.subject!=='전체'&&(v.subject||'미확인')!==ui.subject)return false;
  if(ui.category!=='전체'&&v.category!==ui.category)return false;
  if(q&&!([v.name,v.publisher,v.author,v.isbn,v.subject,seriesById.get(v.series_id)?.title]
       .filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(q)))return false;
  return true;
 });
 listed.sort((a,b)=>{
  if(ui.sort==='recent')return String(b.published_at||'').localeCompare(String(a.published_at||''))||a.name.localeCompare(b.name,'ko');
  if(ui.sort==='category')return String(a.category||'').localeCompare(String(b.category||''),'ko')||a.name.localeCompare(b.name,'ko');
  return a.name.localeCompare(b.name,'ko');
 });
 return listed;
}
function options(values,current,all='전체'){
 return [all,...[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ko'))]
    .map(x=>'<option'+(x===current?' selected':'')+' value="'+esc(x)+'">'+esc(x)+'</option>').join('');
}
function select(name,label,values){
 return '<label class="hc-filter"><span>'+esc(label)+'</span><select data-hc-filter="'+name+'">'+options(values,ui[name])+'</select></label>';
}
function cover(v){
 const image=v.cover?'<img loading="lazy" referrerpolicy="no-referrer" src="'+esc(v.cover)+'" alt="'+esc(v.name)+' 표지" onerror="this.remove()"/>':'';
 const titleShort=(v.name||'학습교재').replace(/[()[\]]/g,' ').slice(0,22);
 return '<div class="hc-cover">'+image+'<div class="hc-text-cover"><small>HITEL 학습 교재</small><b>'+esc(titleShort)+'</b><em>'+esc(v.grade||v.subject||'교재 정보')+'</em></div></div>';
}
function kindName(v){return v.kind==='books'?'교재':v.kind==='materials'?'학습자료':'교재 시리즈';}
function tile(v){
 const desc=v.kind==='series'?v.count+'권 확인 · '+(v.complete?'수록자료 확인':'추가 정보 보강 중'):
  [v.publisher||'',labelSchool(v)].filter(Boolean).join(' · ');
 return '<article class="hc-tile"><button class="hc-open" type="button" data-hc="open" data-id="'+esc(v.uid)+'">'+
 cover(v)+'<span class="hc-tile-body"><small>'+kindName(v)+(v.category?' · '+esc(v.category):'')+'</small>'+
 '<strong>'+esc(v.name)+'</strong><span>'+esc(desc)+'</span></span></button></article>';
}
function tabs(){
 return '<div class="hc-tabs" role="tablist">'+[
  ['all','전체 목록',catalog.books.length+catalog.materials.length],
  ['books','교재',catalog.books.length],
  ['materials','학습자료',catalog.materials.length],
  ['series','시리즈',catalog.series.length]
 ].map(([key,label,n])=>'<button type="button" role="tab" aria-selected="'+(key===ui.tab)+'" class="'+(ui.tab===key?'selected':'')+'" data-hc="tab" data-value="'+key+'">'+label+' <span>'+n.toLocaleString('ko-KR')+'</span></button>').join('')+'</div>';
}
function screen(){
 if(phase!=='ready')return '<section class="hc-app"><h2>HITEL 문제집 찾기</h2><div class="hc-state" role="status">'+
  (phase==='error'?'<strong>교재 목록을 불러오지 못했습니다.</strong><p>'+esc(failure)+'</p><button data-hc="retry">다시 시도</button>':'실제 교재 목록을 불러오는 중입니다.')+'</div></section>';
 const data=allItems();
 const found=filterList(data),perPage=36;
 const maxPages=Math.max(1,Math.ceil(found.length/perPage));
 ui.page=Math.min(maxPages,Math.max(1,ui.page));
 const visible=found.slice((ui.page-1)*perPage,ui.page*perPage);
 return '<section class="hc-app">'+
 '<div class="hc-heading"><small>HITEL AI LEARNING</small><h2>나에게 맞는 교재 찾기</h2>'+
 '<p>학년·과목과 학습 목표에 맞춰 등록된 교재와 학습자료를 찾아보세요.</p></div>'+
 '<div class="hc-stats"><span><strong>'+catalog.books.length.toLocaleString('ko-KR')+'</strong><small>등록 교재</small></span>'+
 '<span><strong>'+catalog.materials.length.toLocaleString('ko-KR')+'</strong><small>관련 학습자료</small></span>'+
 '<span><strong>'+catalog.series.length+'</strong><small>시리즈</small></span></div>'+
 tabs()+
 '<form id="hc-search" class="hc-search"><input name="q" aria-label="교재명 검색" placeholder="교재명 · 출판사 · 과목 · ISBN 검색" value="'+esc(ui.q)+'"/><button type="submit">검색</button></form>'+
 '<div class="hc-filters">'+
 select('school','학교급',['초등','중등','고등','미확인'])+
 select('grade','학년',data.map(x=>x.grade||'미확인'))+
 select('semester','학기',['1','2','미확인'])+
 select('subject','과목',data.map(x=>x.subject||'미확인'))+
 select('category','학습 목적',FILTERS.slice(1))+
 '<label class="hc-filter"><span>정렬</span><select data-hc-filter="sort">'+
 [['title','교재명순'],['category','학습 목적순'],['recent','최근 발행순']].map(([key,n])=>'<option value="'+key+'"'+(ui.sort===key?' selected':'')+'>'+n+'</option>').join('')+'</select></label>'+
 '</div><div class="hc-results-head"><strong>검색 결과 '+found.length.toLocaleString('ko-KR')+'건</strong>'+
 '<button type="button" data-hc="clear">조건 초기화</button></div>'+
 (visible.length?'<div class="hc-grid">'+visible.map(tile).join('')+'</div>':
 '<div class="hc-state">일치하는 교재가 없습니다. 검색 조건을 변경해 주세요.</div>')+
 (maxPages>1?'<nav class="hc-pagination"><button data-hc="prev"'+(ui.page===1?' disabled':'')+'>이전</button>'+
 '<span>'+ui.page+' / '+maxPages+' 페이지</span><button data-hc="next"'+(ui.page===maxPages?' disabled':'')+'>다음</button></nav>':'')+
 '<p class="hc-caution">학습 목적은 확보된 교재명과 서지정보를 기준으로 정리했습니다. 미확인 학년·판본은 확정 표시하지 않습니다.</p></section>';
}
function chosen(){
 const [kind,id]=ui.chosen.split(/:(.+)/);
 if(kind==='book')return booksById.has(id)?convert('books',booksById.get(id)):null;
 if(kind==='material'){const v=catalog.materials.find(x=>x.id===id);return v?convert('materials',v):null;}
 if(kind==='series')return seriesById.has(id)?convert('series',seriesById.get(id)):null;
 return null;
}
function field(label,value){
 return value?'<div class="hc-field"><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>':'';
}
function link(url,label){
 if(!/^https:\/\/[^\s"<>]+$/i.test(url||''))return '';
 return '<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(label)+'</a>';
}
function related(v){
 let list=[];
 if(v.kind==='books')list=docsByBook.get(v.id)||[];
 if(v.kind==='series')list=catalog.books.filter(b=>b.series_id===v.id);
 if(v.kind==='materials'&&v.related_book_id&&booksById.has(v.related_book_id))list=[booksById.get(v.related_book_id)];
 if(!list.length)return '';
 const kind=v.kind==='books'?'materials':'books';
 const shown=list.slice(0,24);
 return '<section class="hc-related"><h3>'+ (v.kind==='materials'?'관련 교재 후보':v.kind==='series'?'이 시리즈의 등록 교재':'관련 학습자료 후보')+
 '</h3><p>교재명·학습자료 제목의 연관성만으로 동일 판본이나 원문 일치를 확정하지 않습니다.</p>'+
 shown.map(x=>'<button type="button" data-hc="open" data-id="'+esc((kind==='books'?'book:':'material:')+x.id)+'">'+
 '<strong>'+esc(title(x))+'</strong><span>상세 보기</span></button>').join('')+
 (list.length>24?'<small>추가 '+(list.length-24)+'건</small>':'')+'</section>';
}
function detail(){
 const v=chosen();
 if(!v)return '<section class="hc-app"><button class="hc-back" data-hc="back">‹ 교재 목록</button><p>선택한 항목을 찾을 수 없습니다.</p></section>';
 const isBook=v.kind==='books';
 const isDoc=v.kind==='materials';
 const actualBook=isBook?true:isDoc&&v.related_book_id&&booksById.has(v.related_book_id);
 const canGroup=!!v.subject && v.kind!=='series';
 const desc=isBook?'등록된 교재의 개별 판본·서지정보입니다.':
  isDoc?'학습자료의 제목과 구분에 따라 정리한 자료입니다. 개별 교재 본문과의 일치 여부는 확인이 필요합니다.':
 '교재 시리즈입니다. 판본을 선택하면 학습반과 연결할 수 있습니다.';
 return '<section class="hc-app hc-detail"><button type="button" class="hc-back" data-hc="back">‹ 문제집 검색</button>'+
 '<div class="hc-detail-hero">'+cover(v)+'<div><small>'+kindName(v)+'</small><h2>'+esc(v.name)+'</h2>'+
 '<p>'+esc(labelSchool(v))+'</p><p>'+esc(desc)+'</p>'+
 '<div class="hc-tags"><span>'+esc(v.category||'교재정보')+'</span>'+
 (v.kind==='series'?'<span>'+(v.complete?'기본 정보 확인':'자료 보강 중')+'</span>':
 '<span>'+(v.cover?'등록된 표지':'표지 확인 예정')+'</span>')+'</div></div></div>'+
 '<div class="hc-detail-sections"><section><h3>교재 기본정보</h3><dl>'+
 field('교재명',v.name)+field('출판사',v.publisher)+field('ISBN',v.isbn)+
 field('저자',v.author)+field('출판일',v.published_at)+
 field('학교급·학년',labelSchool(v))+field('학습 목적',v.category)+
 (isDoc?field('자료 구분',v.material_type||'확인 중'):'')+
 (v.kind==='series'?field('확인된 교재',v.count+'권'):'')+
 '</dl></section><section><h3>학습 안내</h3>'+
 '<p>이 자료의 정확한 단원 구성, 학습 난이도, 문제 본문은 현재 서지정보만으로 확정할 수 없습니다. 교재별 AI 선생님을 지정하면 학습반에서 질문과 학습자료를 관리할 수 있습니다.</p>'+
 (canGroup?'<button type="button" class="hc-primary" data-hc="class">이 교재를 학습반에 연결</button>':
 '<p class="hc-subtle">학습반 연결에는 정확한 과목과 교재 정보가 필요합니다.</p>')+
 '<div class="hc-reference">'+link(v.url,'교재 상세정보 확인')+'</div></section></div>'+
 related(v)+'<p class="hc-caution">HITEL은 도서 원문·문항을 자동 보유했다고 표시하지 않습니다. 표지·교재 정보는 판본을 확인하여 순차적으로 보강합니다.</p></section>';
}
groupPage=function(route){
 if(route==='groupMoonzipSeries') {load(); return detail();}
 if(ROUTES.has(route)) {load();return screen();}
 return oldPage(route);
};
bottomFor=function(route){
 if(ROUTES.has(route))return oldBottom('groupAITutor');
 return oldBottom(route);
};
function changeFilter(key,value){
 if(!Object.hasOwn(ui,key))return;
 ui[key]=value;ui.page=1;rerender();
}
document.addEventListener('change',e=>{
 const el=e.target.closest?.('#phone [data-hc-filter]');
 if(el){changeFilter(el.dataset.hcFilter,el.value);}
},true);
document.addEventListener('submit',e=>{
 if(e.target.id!=='hc-search')return;
 e.preventDefault();e.stopImmediatePropagation();
 ui.q=String(new FormData(e.target).get('q')||'').trim();ui.page=1;rerender();
},true);
document.addEventListener('click',e=>{
 const btn=e.target.closest?.('#phone [data-hc]');
 if(!btn)return;
 e.preventDefault();e.stopImmediatePropagation();
 const act=btn.dataset.hc,value=btn.dataset.value||'';
 if(act==='tab') {ui.tab=value;ui.school='전체';ui.grade='전체';ui.subject='전체';ui.semester='전체';ui.category='전체';ui.page=1;rerender();}
 else if(act==='clear'){ui.q='';ui.school='전체';ui.grade='전체';ui.semester='전체';ui.subject='전체';ui.category='전체';ui.sort='title';ui.page=1;rerender();}
 else if(act==='open'){ui.chosen=btn.dataset.id||'';try{sessionStorage.setItem('hitel.catalog.selected.v3',ui.chosen);}catch(_){}go('groupMoonzipSeries');}
 else if(act==='back'){go('groupMoonzipSearch');}
 else if(act==='prev'){ui.page=Math.max(1,ui.page-1);rerender();}
 else if(act==='next'){ui.page+=1;rerender();}
 else if(act==='retry'){fetchTask=null;load();}
 else if(act==='class'){
  const v=chosen();
  if(!v?.subject){toast('과목 정보가 확인된 교재만 학습반과 연결할 수 있습니다.');return;}
  if(!window.HITEL_CLASS_AI_FLOW?.chooseOwnedBook){toast('학습반 연결 화면을 사용할 수 없습니다.');return;}
  window.HITEL_CLASS_AI_FLOW.chooseOwnedBook({
   id:v.uid,title:v.name,subject:v.subject,grade:v.grade||'',semester:v.semester||'',
   publisher:v.publisher||'',cover:v.cover||'',series:v.series_id?seriesById.get(v.series_id)?.title||'':'',
   kind:v.kind,verified:isBookRecord(v)
  });
 }
},true);
function isBookRecord(v){return v.kind==='books'&&Boolean(v.isbn);}
if(ROUTES.has(state.screen)) {load();rerender();}
})();