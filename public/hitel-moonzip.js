/* Moonzip-style workbook curation inside HITEL AI tutoring.
   Based on the original homepage and search HTML supplied by the user.
   Snapshot data only; these are not live Moonzip votes or subscriptions. */
(function(){
'use strict';
const DATA=window.HITEL_MOONZIP_SOURCE;
if(!DATA||!window.YPT_GRAPH)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ROUTES={groupMoonzipSearch:'문제집 찾기',groupMoonzipSeries:'교재 분석',groupMoonzipRoadmap:'문제집 로드맵',groupMoonzipCompare:'문제집 비교'};
for(const[id,title] of Object.entries(ROUTES)){
 window.YPT_GRAPH[id]={title,evidence:[],actions:[{text:'AI 과외',go:'groupAITutor'}]};
 if(GROUPS['스터디 그룹']&&!GROUPS['스터디 그룹'].includes(id))GROUPS['스터디 그룹'].push(id);
}
const oldPage=groupPage,oldBottom=bottomFor;
const load=()=>{try{let x=JSON.parse(localStorage.getItem('hitel.moonzip.bookshelf.v1')||'[]');return Array.isArray(x)?x:[]}catch{return []}};
const previousSelection=(()=>{try{return sessionStorage.getItem('hitel.moonzip.selected-series.v1')||'1'}catch{return'1'}})();
const ui={q:'',cat:[],min:1,max:10,sort:'votes',selected:previousSelection,saved:new Set(load()),compare:new Set(),roadmap:0,showFilters:false};
const levelColor=n=>n<=2?'#0d9b7c':n<=4?'#659b27':n<=6?'#b87917':'#d65a30';
/* The entire AI tutoring page is one workbook-curation surface, not a personal tutor inventory. */
function nav(){return ''}
function searchForm(){return '<form class="mzx-search" id="mzx-search-form"><input name="q" type="search" autocomplete="off" placeholder="문제집 검색" aria-label="문제집 시리즈명 또는 출판사 검색" value="'+esc(ui.q)+'"><button type="submit" aria-label="문제집 찾기">⌕</button></form>'}
function shell(route){return '<section class="mzx">'+nav(route)+searchForm()}
function sec(title,description='',more=''){return '<div class="mzx-section"><div><h3>'+title+'</h3>'+(description?'<p>'+description+'</p>':'')+'</div>'+more+'</div>'}
function act(text,action,value='',cls=''){return '<button type="button" class="'+cls+'" data-mzx="'+action+'" data-value="'+esc(value)+'">'+text+'</button>'}
function sourceNotice(){return '<p class="mzx-capture">문집 원본 제공 HTML(' + esc(DATA.sourceDate) + ') 기준 재구성 · 투표·순위 실시간 연동 아님</p>'}
function tags(cats){return '<div class="mzx-tags">'+cats.map(t=>'<span class="mzx-tag mzx-tag-'+esc(t==='N제'?'N':t)+'">'+esc(t)+'</span>').join('')+'</div>'}
function cover(src,name,cls=''){return '<img class="'+cls+'" src="'+esc(src)+'" alt="'+esc(name)+' 표지" decoding="async" loading="lazy" onerror="this.style.opacity=0.18" />'}
function purpose(book){
 return '<div class="mzx-purpose"><small>학습 목적 분포</small>'+['개념','유형','연산','심화'].map((label,i)=>{
  const pct=book.purpose[i];
  return '<div class="mzx-purpose-line"><span>'+label+'</span><div class="mzx-meter" role="progressbar" aria-label="'+label+' '+pct+'%" aria-valuenow="'+pct+'" aria-valuemin="0" aria-valuemax="100"><div class="mzx-meter-fill mzx-meter-'+label+'" style="width:'+pct+'%"></div></div><b>'+pct+'%</b></div>';
 }).join('')+'</div>';
}
function bookCard(book){
 return '<article class="mzx-book-card"><div class="mzx-book-main">'+
 act(cover(book.image,book.name,'mzx-cover'),'detail',book.id,'mzx-cover-action')+
 '<div class="mzx-book-info">'+tags(book.cats)+act(esc(book.name),'detail',book.id,'mzx-book-name')+
 '<span class="mzx-publisher">'+esc(book.publisher)+'</span>'+
 '<div class="mzx-book-actionline">'+
 act(ui.saved.has(book.id)?'▣ 저장됨':'▢ 저장','save',book.id,'mzx-lite-action'+(ui.saved.has(book.id)?' on':''))+
 act('이 교재의 AI 과외 ›','detail',book.id,'mzx-lite-action mzx-info-action')+'</div></div></div>'+
 '<div class="mzx-book-analysis"><div class="mzx-score"><span>난이도 <small>(투표 '+book.votes+')</small></span>'+
 '<strong style="color:'+levelColor(book.score)+'">'+book.score.toFixed(1)+'</strong><em>/10</em></div>'+purpose(book)+'</div></article>';
}
function filters(){
 return '<div class="mzx-filterbox"><div class="mzx-filter-top"><b>필터</b><div>'+act('초기화','reset','','mzx-link')+act('닫기','filter','','mzx-link')+'</div></div>'+
 '<div class="mzx-filter-label"><b>난이도</b><small>'+ui.min+' ~ '+ui.max+'</small></div>'+
 '<div class="mzx-slider-row"><label>최소<input type="range" id="mzx-min" min="1" max="10" value="'+ui.min+'"></label>'+
 '<label>최대<input type="range" id="mzx-max" min="1" max="10" value="'+ui.max+'"></label></div>'+
 '<div class="mzx-steps">'+DATA.levels.map(l=>'<span>'+l[0]+' '+l[1]+'</span>').join('')+'</div>'+
 '<div class="mzx-filter-label"><b>카테고리</b><small>복수 선택</small></div>'+
 '<div class="mzx-filter-options">'+DATA.categories.map(x=>'<label><input type="checkbox" data-mzx-category="'+esc(x[1])+'" '+(ui.cat.includes(x[1])?'checked':'')+'><span>'+x[1]+'</span></label>').join('')+'</div></div>';
}
function results(){
 let rs=DATA.series.filter(b=>b.score>=ui.min&&b.score<=ui.max&&(!ui.cat.length||ui.cat.some(c=>b.cats.includes(c)))&&
  (!ui.q||(b.name+' '+b.publisher+' '+b.cats.join(' ')).toLocaleLowerCase('ko').includes(ui.q.toLocaleLowerCase('ko'))));
 if(ui.sort==='votes')rs.sort((a,b)=>b.votes-a.votes);
 else if(ui.sort==='hard')rs.sort((a,b)=>b.score-a.score);
 else if(ui.sort==='easy')rs.sort((a,b)=>a.score-b.score);
 else if(ui.sort==='name')rs.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
 return rs;
}
function resolveSelected(id){
 const found=DATA.series.find(b=>b.id===id);
 if(found)return found;
 const match=/^(hero|popular):(\d+)$/.exec(id);
 if(!match)return null;
 const i=Number(match[2]);
 const record=match[1]==='hero'?DATA.hero[i]:DATA.popular[i];
 if(!record)return null;
 const [name,score,image]=record;
 return DATA.series.find(b=>b.name===name)||{
  id,name,score,image:image||'',publisher:'',votes:null,cats:[],purpose:[],
  snapshotOnly:true
 };
}
function showBook(id){
 if(!resolveSelected(id)){toast('선택한 교재를 찾을 수 없습니다.');return}
 ui.selected=id;
 try{sessionStorage.setItem('hitel.moonzip.selected-series.v1',id)}catch{}
 go('groupMoonzipSeries');
}
function home(){
 const hero=DATA.hero;
 return shell('groupAITutor')+
 '<div class="mzx-home-intro"><small>투표 2,169개 · 이번 주 +129 <em>제공 원본 화면 기준</em></small>'+
 '<h2>감이 아니라 <strong>데이터로</strong><br>문제집을 비교하세요.</h2>'+
 '<div class="mzx-cover-row">'+hero.map(([name,score,src],i)=>{
  return '<button type="button" data-mzx="openBook" data-value="hero:'+i+'" class="mzx-cover-tile"><span>난이도 <b style="color:'+levelColor(score)+'">'+score.toFixed(1)+'</b></span>'+
  cover(src,name,'mzx-hero-cover')+'<strong>'+esc(name)+'</strong></button>';
 }).join('')+
 '<button type="button" class="mzx-cover-tile mzx-cover-more" data-go="groupMoonzipSearch"><span>전체 보기</span><b>›</b><strong>더보기</strong></button></div>'+
 '<p>사용자 투표와 리뷰를 바탕으로 교재를 비교하는 문집의 화면 구성입니다.</p></div>'+
 sec('카테고리별 문제집 찾기')+
 '<div class="mzx-categories">'+DATA.categories.map(x=>'<button type="button" data-mzx="category" data-value="'+esc(x[1])+'"><span>'+x[2]+'</span><strong>'+x[0]+'</strong></button>').join('')+'</div>'+
 sec('난이도별 문제집 찾기','내 수준에 맞는 문제집을 찾아보세요')+
 '<div class="mzx-level-grid">'+DATA.levels.map(l=>'<button type="button" data-mzx="level" data-value="'+l[3]+','+l[4]+'"><b>'+l[0]+'</b><strong>'+l[1]+'</strong><small>'+l[2]+'</small></button>').join('')+'</div>'+
 sec('실시간 인기 문제집','제공된 원본 화면의 11월 11일 기준 항목')+
 '<div class="mzx-popular">'+DATA.popular.map(([name,score],i)=>'<button type="button" data-mzx="openBook" data-value="popular:'+i+'"><b>'+(i+1)+'</b>'+
 '<span>'+esc(name)+'</span><em>난이도 '+score.toFixed(1)+'</em></button>').join('')+'</div>'+
 sec('최근 리뷰','원본 HTML에 포함된 리뷰 발췌')+
 '<div class="mzx-review"><b>마플시너지</b><small>난이도 3.0 · 개념·유형</small><p>쎈(두껍고 더 지루한)</p></div>'+
 '<div class="mzx-review"><b>포카칩 모의고사 2027</b><small>난이도 9.5 · 심화</small><p>ㅇㅇ</p></div>'+
 sec('첫 리뷰를 기다리는 문제집','제공된 원본 화면의 리뷰 0개 교재')+
 '<div class="mzx-popular">'+[
 ['4점코드','6c1605c0-2d74-4dd3-a0ed-a56216fd0e31'],
 ['천재일우 시즌1','7b1a757a-41ea-4ba0-84b7-a8d99c70dd85'],
 ['기출코드','77224e3e-4de0-469f-8ae2-5e4f3f435397']
 ].map(([name,id],i)=>'<a class="mzx-unreviewed" href="https://moonzip.kr/series/'+id+'" target="_blank" rel="noopener noreferrer"><b>'+(i+1)+'</b><span>'+esc(name)+'</span><em>리뷰 0개 ›</em></a>').join('')+'</div>'+
 '<div class="mzx-convert"><strong>고른 문제집으로 AI 과외를 시작하세요</strong><p>교재별 데이터와 AI 선생님, 최대 5인 학습반을 연결합니다.</p>'+
 '<button type="button" data-go="groupTutorCatalog">HITEL 교재별 AI 과외 찾아보기 →</button></div>'+
 sourceNotice()+'</section>';
}
function search(){
 const rs=results();
 return shell('groupMoonzipSearch')+'<div class="mzx-catalog"><aside class="mzx-filter-aside '+(ui.showFilters?'open':'')+'">'+filters()+'</aside>'+
 '<div class="mzx-result-list"><div class="mzx-result-toolbar"><div><strong>원본 전체 '+DATA.originalSeriesCount+'개 시리즈</strong>'+
 '<small>제공된 목록 '+DATA.series.length+'개 · 현재 '+rs.length+'개 표시</small></div>'+
 act('☷ 필터','filter','','mzx-filter-button')+
 '<label class="mzx-sort"><span>정렬</span><select id="mzx-sort"><option value="votes" '+(ui.sort==='votes'?'selected':'')+'>투표 많은순</option>'+
 '<option value="hard" '+(ui.sort==='hard'?'selected':'')+'>난이도 높은순</option>'+
 '<option value="easy" '+(ui.sort==='easy'?'selected':'')+'>난이도 낮은순</option>'+
 '<option value="name" '+(ui.sort==='name'?'selected':'')+'>이름순</option></select></label></div>'+
 (rs.length?rs.map(bookCard).join(''):'<div class="mzx-noresults">현재 확보된 목록에서 조건에 맞는 교재가 없습니다. 검색 조건을 바꿔 주세요.</div>')+
 '<div class="mzx-data-note">문집 원본은 전체 370개 시리즈로 표시되지만 제공된 HTML에 실제 추출된 목록 행은 12개입니다. '+
 '<a href="https://moonzip.kr/search" target="_blank" rel="noopener noreferrer">문집 원본에서 전체 찾아보기 ↗</a></div></div></div>'+
 sourceNotice()+'</section>';
}
function catalogBridge(book){
 const list=window.HITEL_BOOKSHELF_BRIDGE?.getCatalog?.()||[];
 const map={'쎈':'ssen','개념원리':'concept','EBS 수능특강':'ebs','100발 100중':'100bal'};
 const k=map[book.name];return k?list.find(b=>b.series===k)||null:null;
}
function detail(){
 const current=ui.selected||'';
 const saved=(()=>{try{return sessionStorage.getItem('hitel.moonzip.selected-series.v1')||''}catch{return''}})();
 const b=resolveSelected(current)||resolveSelected(saved)||DATA.series[1],linked=catalogBridge(b);
 if(window.HITEL_CLASS_AI_FLOW?.renderSeries)return window.HITEL_CLASS_AI_FLOW.renderSeries(b);
 return shell('groupMoonzipSearch')+act('‹ 문제집 목록','route','groupMoonzipSearch','mzx-link')+
 '<div class="mzx-detail-intro">'+cover(b.image,b.name,'mzx-detail-cover')+'<div>'+tags(b.cats)+
 '<h2>'+esc(b.name)+'</h2><p>'+esc(b.publisher||'원본 첫 화면에만 정보 있음')+'</p><div class="mzx-detail-score" style="color:'+levelColor(b.score)+'">'+b.score.toFixed(1)+'<small>/10'+(Number.isFinite(b.votes)?' · 투표 '+b.votes+'개':' · 첫 화면 표시')+'</small></div></div></div>'+
 sec('학습 목적 분포')+purpose(b)+
 '<div class="mzx-detail-tip"><strong>어떤 공부에 적합한 교재인가요?</strong><p>원본의 학습 분류는 '+esc(b.cats.join('·'))+
 '입니다. 투표에 따른 목적 분포를 참고하여 선택하세요. 현재 데이터만으로 개인 적합도를 단정할 수 없습니다.</p></div>'+
 '<div class="mzx-detail-action">'+act(ui.saved.has(b.id)?'▣ 내 책장 저장됨':'▢ 내 책장에 저장','save',b.id,'mzx-primary')+
 act(ui.compare.has(b.id)?'✓ 비교에서 선택됨':'＋ 문제집 비교에 담기','compareToggle',b.id,'mzx-secondary')+
 '<button type="button" class="mzx-secondary" data-ask="open">✦ AI 선생님에게 질문하기</button>'+
 (linked?'<button type="button" class="mzx-primary" data-tp="chooseBook" data-value="'+esc(linked.id)+'">이 교재 시리즈로 AI 과외 알아보기 →</button>':
 '<button type="button" class="mzx-primary" data-go="groupTutorCatalog">HITEL 등록 교재별 AI 과외 찾기 →</button>')+'</div>'+
 '<p class="mzx-data-note">'+(linked?'HITEL에서 연결된 시리즈입니다. 학년·학기 및 정확한 판본은 선택 화면에서 확인해야 합니다.':
 '이 교재 시리즈는 현재 HITEL 교재 목록과 자동 연결되지 않았습니다. 새 AI 구독 상품을 만들어 표시하지 않습니다.')+'</p>'+
 '<a class="mzx-source-link" target="_blank" rel="noopener noreferrer" href="'+esc(b.url)+'">문집 원본 상세페이지 열기 ↗</a>'+
 sourceNotice()+'</section>';
}
function roadmap(){
 const r=DATA.roadmap[Math.min(DATA.roadmap.length-1,Math.max(0,ui.roadmap))];
 return shell('groupMoonzipRoadmap')+sec('문제집 로드맵','원본에 있는 강사·학생의 학습 경로')+
 '<div class="mzx-roadmap-grid">'+DATA.roadmap.map((x,i)=>'<button type="button" data-mzx="roadmap" data-value="'+i+'" class="mzx-roadmap-card '+(ui.roadmap===i?'active':'')+'">'+
 '<small>'+esc(x.author)+' · '+esc(x.subtitle)+'</small><strong>'+esc(x.title)+'</strong><p>'+esc(x.desc)+'</p></button>').join('')+'</div>'+
 '<div class="mzx-roadmap-detail"><h3>'+esc(r.title)+'</h3><p>'+esc(r.author)+' · '+esc(r.subtitle)+'</p>'+
 r.steps.map((x,i)=>'<div><span>'+(i+1)+'</span><b>'+esc(x)+'</b></div>').join('')+'</div>'+
 '<button type="button" data-go="groupTutorCatalog" class="mzx-primary mzx-wide">관련 교재별 AI 과외 찾기 →</button>'+
 '<p class="mzx-data-note">원본 HTML에서 확인된 순서만 나타냈습니다. 완전한 로드맵 전체 교재 데이터는 아직 확보되지 않았습니다.</p>'+
 sourceNotice()+'</section>';
}
function compare(){
 const books=DATA.series.filter(x=>ui.compare.has(x.id));
 return shell('groupMoonzipCompare')+sec('문제집 비교','최대 3개 시리즈의 난이도와 학습 성격을 비교하세요')+
 '<div class="mzx-compare-picker">'+DATA.series.map(x=>'<label><input type="checkbox" data-mzx-cmp="'+x.id+'" '+(ui.compare.has(x.id)?'checked':'')+'><span>'+
 esc(x.name)+' · '+x.score.toFixed(1)+'</span></label>').join('')+'</div>'+
 (books.length?'<div class="mzx-compare-scroll"><div class="mzx-compare-grid" style="--comparison-count:'+books.length+'">'+
 '<div class="mzx-compare-row"><b>항목</b>'+books.map(x=>'<b>'+esc(x.name)+'</b>').join('')+'</div>'+
 [['난이도',x=>x.score.toFixed(1)+'/10'],['투표',x=>x.votes+'개'],['분류',x=>x.cats.join('·')],
 ['개념',x=>x.purpose[0]+'%'],['유형',x=>x.purpose[1]+'%'],['연산',x=>x.purpose[2]+'%'],['심화',x=>x.purpose[3]+'%']].map(([label,fn])=>
 '<div class="mzx-compare-row"><strong>'+label+'</strong>'+books.map(x=>'<span>'+esc(fn(x))+'</span>').join('')+'</div>').join('')+'</div></div>':
 '<div class="mzx-noresults">비교할 문제집을 위에서 선택해 주세요.</div>')+
 sourceNotice()+'</section>';
}
groupPage=function(route){
 if(route==='groupAITutor')return home();
 if(route==='groupMoonzipSearch')return search();
 if(route==='groupMoonzipSeries')return detail();
 if(route==='groupMoonzipRoadmap'||route==='groupMoonzipCompare')return search();
 return oldPage(route);
};
bottomFor=function(route){return ROUTES[route]?oldBottom('groupAITutor'):oldBottom(route)};
const refresh=()=>render();
function openSearch(cat=null,min=1,max=10){
 ui.q='';ui.cat=cat?[cat]:[];ui.min=min;ui.max=max;ui.showFilters=false;
 go('groupMoonzipSearch');
}
document.addEventListener('click',ev=>{
 const b=ev.target.closest?.('#phone [data-mzx]');if(!b)return;
 ev.preventDefault();ev.stopPropagation();const a=b.dataset.mzx,v=b.dataset.value||'';
 if(a==='route'){go(v);return}
 if(a==='category'){openSearch(v);return}
 if(a==='level'){const [lo,hi]=v.split(',').map(Number);openSearch(null,lo,hi);return}
 if(a==='query'){ui.q=v;ui.min=1;ui.max=10;ui.cat=[];go('groupMoonzipSearch');return}
 if(a==='openBook'||a==='detail'){showBook(v);return}
 if(a==='roadmap'){ui.roadmap=Number(v);if(state.screen==='groupMoonzipRoadmap')refresh();else go('groupMoonzipRoadmap');return}
 if(a==='reset'){ui.q='';ui.cat=[];ui.min=1;ui.max=10;refresh();return}
 if(a==='filter'){ui.showFilters=!ui.showFilters;refresh();return}
 if(a==='save'){ui.saved.has(v)?ui.saved.delete(v):ui.saved.add(v);
  try{localStorage.setItem('hitel.moonzip.bookshelf.v1',JSON.stringify([...ui.saved]))}catch{}refresh();return}
 if(a==='compareToggle'){toast('이 기능은 AI 학습반 연결로 통합되었습니다.');return}
});
document.addEventListener('submit',ev=>{
 if(ev.target?.id!=='mzx-search-form')return;
 ev.preventDefault();ev.stopPropagation();
 ui.q=String(new FormData(ev.target).get('q')||'').trim();ui.cat=[];ui.min=1;ui.max=10;
 if(state.screen==='groupMoonzipSearch')refresh();else go('groupMoonzipSearch');
});
document.addEventListener('change',ev=>{
 const el=ev.target;if(!el)return;
 if(el.hasAttribute?.('data-mzx-category')){
  const c=el.getAttribute('data-mzx-category');ui.cat=el.checked?[...new Set([...ui.cat,c])]:ui.cat.filter(x=>x!==c);refresh();return;
 }
 if(el.hasAttribute?.('data-mzx-cmp')){toast('비교 화면은 AI 과외로 통합되었습니다.');return}
 if(el.id==='mzx-sort'){ui.sort=el.value;refresh();return}
 if(el.id==='mzx-min'){ui.min=Math.min(Number(el.value),ui.max);refresh();return}
 if(el.id==='mzx-max'){ui.max=Math.max(Number(el.value),ui.min);refresh();return}
});
window.HITEL_MOONZIP_INSPECT=()=>({screens:['groupAITutor','groupMoonzipSearch','groupMoonzipSeries'],catalogCount:DATA.series.length,
originalDisplayedCount:DATA.originalSeriesCount,origin:'user-provided HTML',live:false,
filtered:results().length,saved:ui.saved.size,compare:ui.compare.size});
render();
})();