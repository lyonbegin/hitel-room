/* HITEL problem-book library, borrowed UX patterns not copied app source.
 * Real verified covers only for matching editions; elsewhere neutral text covers.
 * Browser-local saved shelves / progress; no fake remote collaboration or paid access.
 */
(function(){
'use strict';
const KEY='hitel.education.bookshelf.v1';
const COVER={
 concept:'https://cdn.imweb.me/thumbnail/20250611/ddafb2d56407a.png',
 rpm:'https://thumbnail8.coupangcdn.com/thumbnails/remote/492x492ex/image/retail/images/2024/08/20/19/9/0983c71f-f9a5-407a-ad08-5412f94c26a2.jpg',
 ssen:'https://image.yes24.com/goods/126414948/XL',
 ssenb:'https://cdn.imweb.me/thumbnail/20250227/106956f749b60.png',
 black:'https://asset.m-gs.kr/prod/1098087145/1/550',
 check:'https://asset.m-gs.kr/prod/1088174191/1/2000'
};
const SERIES=[
 ['concept','개념원리','개념원리','개념'],
 ['rpm','개념원리 RPM','개념원리','유형'],
 ['ssen','쎈','좋은책신사고','유형'],
 ['ssenb','쎈B','좋은책신사고','유형'],
 ['lightssen','라이트쎈','좋은책신사고','기초'],
 ['black','블랙라벨','진학사','심화'],
 ['check','체크체크','천재교육','개념'],
 ['ilpum','일품','좋은책신사고','심화'],
 ['concepttype','개념+유형','비상교육','유형'],
 ['suryuk','수력충전','수경출판사','기초'],
 ['pungsan','풍산자','지학사','개념']
];
const VARIANTS=[['중1','2'],['중2','1'],['중3','1']];
const BOOKS=VARIANTS.flatMap(([grade,term])=>SERIES.map(([series,name,publisher,level],i)=>({
 id:series+'-'+grade+'-'+term,series,name:(name+(series==='black'?' 중학 수학':series==='check'?' 중학 수학':' 중등 수학'))+' '+grade.replace('중','')+'-'+term,
 grade,term,subject:'수학',publisher,level,rank:i+1,
 image:grade==='중2'&&term==='1'?COVER[series]||'':'',
 verifiedCover:grade==='중2'&&term==='1'&&Boolean(COVER[series]),
 subtitle:series==='black'?'심화·고난도':series==='concept'?'개념과 원리':level+' 학습',
})));
const MAP=new Map(BOOKS.map(x=>[x.id,x]));
const UNIT={
 '중1-2':['기본 도형','위치 관계와 작도','평면도형','입체도형','자료의 정리'],
 '중2-1':['유리수와 순환소수','단항식과 다항식','일차부등식','연립일차방정식','일차함수'],
 '중3-1':['제곱근과 실수','다항식의 곱셈과 인수분해','이차방정식','이차함수']
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newState=()=>({tab:'all',grade:'중2',term:'1',subject:'수학',level:'전체',publisher:'전체',
 sort:'recommended',view:'grid',query:'',queryDraft:'',folder:'전체',mine:[],favorites:[],folders:['학습 중','복습','보관함'],
 assignment:{},selected:BOOKS.find(b=>b.series==='concept'&&b.grade==='중2')?.id||BOOKS[0].id,
 progress:{},unit:{},memo:{},last:{},openCount:0});
let db;
try{db=Object.assign(newState(),JSON.parse(localStorage.getItem(KEY)||'null')||{});}catch(_){db=newState();}
if(!Array.isArray(db.mine))db.mine=[];
if(!Array.isArray(db.favorites))db.favorites=[];
if(!Array.isArray(db.folders))db.folders=['학습 중','복습','보관함'];
for(const key of ['assignment','progress','unit','memo','last'])if(!db[key]||typeof db[key]!=='object')db[key]={};
function save(){try{localStorage.setItem(KEY,JSON.stringify(db));}catch(_){}}
function groupModel(){return window.HITEL_WORKPLACE_BRIDGE?.getModel?.()||null;}
function group(){const m=groupModel();return m?.groups?.find(g=>g.id===m.activeGroupId)||m?.groups?.[0]||null;}
function groupBooks(){const g=group();return Array.isArray(g?.bookShelf)?g.bookShelf:[];}
function updateGroupBooks(items){const g=group();if(!g)return;g.bookShelf=[...new Set(items)].filter(id=>MAP.has(id));window.HITEL_WORKPLACE_BRIDGE?.saveModel?.();}
function currentBook(){return MAP.get(db.selected)||BOOKS.find(b=>b.grade==='중2'&&b.series==='concept')||BOOKS[0];}
function htmlButton(label,action,value='',cls=''){return '<button type="button" class="bs-btn '+cls+'" data-bs="'+esc(action)+'" data-val="'+esc(value)+'">'+esc(label)+'</button>';}
function toolbarButton(label,action,value='',active=false){return htmlButton(label,action,value,'bs-tab'+(active?' active':''));}
function formatDate(ts){if(!ts)return '';try{return new Date(ts).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'});}catch(_){return '';}}
function cover(b,compact=false){
 const thumb=b.verifiedCover?'<img src="'+esc(b.image)+'" alt="'+esc(b.name)+' 교재 표지" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=&quot;none&quot;;this.parentElement.classList.add(&quot;bs-cover-missing&quot;)" />':
 '<span class="bs-text-cover"><small>'+esc(b.publisher)+'</small><strong>'+esc(b.name.split(' 중')[0])+'</strong><em>'+esc(b.grade)+'-'+esc(b.term)+'</em></span>';
 return '<span class="bs-cover '+(compact?'bs-small-cover':'')+'" aria-label="'+esc(b.name)+'">'+thumb+'</span>';
}
function searchForm(){
 return '<form id="bs-search-form" class="bs-search"><label for="bs-query" class="bs-visually-hidden">문제집 검색</label>'+
 '<input id="bs-query" type="search" name="query" placeholder="문제집·출판사 검색" value="'+esc(db.queryDraft||db.query)+'" autocomplete="off" />'+
 '<button type="submit" aria-label="검색">검색</button></form>';
}
function selectField(label,key,options,value){
 return '<label class="bs-filter"><span>'+esc(label)+'</span><select data-bs-change="'+esc(key)+'">'+
 options.map(([val,text])=>'<option value="'+esc(val)+'"'+(String(value)===String(val)?' selected':'')+'>'+esc(text)+'</option>').join('')+
 '</select></label>';
}
function filters(){
 const pub=['전체',...new Set(SERIES.map(x=>x[2]))];
 return '<div class="bs-filters">'+
 selectField('학년','grade',['중1','중2','중3'].map(x=>[x,x]),db.grade)+
 selectField('학기','term',[['1','1학기'],['2','2학기']],db.term)+
 selectField('난이도','level',['전체','기초','개념','유형','심화'].map(x=>[x,x]),db.level)+
 selectField('출판사','publisher',pub.map(x=>[x,x]),db.publisher)+
 '</div>';
}
function booksForTab(){
 let books=db.tab==='mine'?db.mine.map(id=>MAP.get(id)).filter(Boolean):
  db.tab==='group'?groupBooks().map(id=>MAP.get(id)).filter(Boolean):BOOKS.slice();
 const term=String(db.term||'');
 if(db.tab==='all')books=books.filter(b=>b.grade===db.grade&&(term==='전체'||b.term===term));
 if(db.level!=='전체')books=books.filter(b=>b.level===db.level);
 if(db.publisher!=='전체')books=books.filter(b=>b.publisher===db.publisher);
 const q=db.query.trim().toLocaleLowerCase();
 if(q)books=books.filter(b=>(b.name+' '+b.publisher+' '+b.level).toLocaleLowerCase().includes(q));
 if(db.tab==='mine'&&db.folder!=='전체')books=books.filter(b=>db.assignment[b.id]===db.folder);
 if(db.sort==='name')books.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
 else if(db.sort==='recent')books.sort((a,b)=>(db.last[b.id]||0)-(db.last[a.id]||0));
 else if(db.sort==='progress')books.sort((a,b)=>(db.progress[b.id]||0)-(db.progress[a.id]||0));
 else books.sort((a,b)=>a.rank-b.rank);
 return books;
}
function bookTile(b){
 const mine=db.mine.includes(b.id), shared=groupBooks().includes(b.id);
 const progress=Math.max(0,Math.min(100,Number(db.progress[b.id])||0));
 const mode=db.view;
 return '<div class="bs-book '+(mode==='list'?'bs-book-list':'')+'">'+
 '<button type="button" class="bs-book-open" data-bs="open" data-val="'+esc(b.id)+'" aria-label="'+esc(b.name)+' 상세 보기">'+cover(b)+
 '<span class="bs-book-info"><strong>'+esc(b.name)+'</strong><small>'+esc(b.publisher)+'</small><small>'+esc(b.level)+(progress?' · '+progress+'% 학습':'')+'</small></span></button>'+
 (progress?'<div class="bs-progress" aria-label="학습 진도 '+progress+'%"><span style="width:'+progress+'%"></span></div>':'')+
 '<div class="bs-quick">'+
 htmlButton(mine?'내 책장 ✓':'내 책장 +','mineToggle',b.id,mine?'checked':'')+
 htmlButton(shared?'그룹 ✓':'그룹 +','groupToggle',b.id,shared?'checked':'')+
 '</div></div>';
}
function noResult(){
 return '<div class="bs-empty"><strong>'+(db.tab==='mine'?'내 책장에 문제집이 없습니다.':db.tab==='group'?'그룹 책장이 비어 있습니다.':'조건에 맞는 문제집이 없습니다.')+'</strong>'+
 '<p>전체 문제집에서 교재를 선택하고 책장에 추가해 보세요.</p>'+
 htmlButton('전체 문제집 보기','tab','all','primary')+'</div>';
}
function mainPage(){
 const g=group();const arr=booksForTab();
 const recent=Object.entries(db.last).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id])=>MAP.get(id)).filter(Boolean);
 const groupName=g?.name||'그룹 미선택';
 return '<section class="bs-library" aria-label="문제집 책장">'+
 '<div class="bs-title"><div><h3>문제집 책장</h3><p>문제집을 찾고, 내 서재와 스터디그룹에 보관하세요.</p></div><span class="bs-price">5인 공동구독</span></div>'+
 '<div class="bs-major-tabs" role="tablist">'+[
 ['all','전체 문제집'],['mine','내 책장'],['group','그룹 책장']
 ].map(([key,label])=>'<button type="button" role="tab" aria-selected="'+(db.tab===key)+'" class="'+(db.tab===key?'active':'')+'" data-bs="tab" data-val="'+key+'">'+label+'</button>').join('')+'</div>'+
 searchForm()+
 (db.tab==='all'?filters():'<div class="bs-subline">'+(db.tab==='mine'?'<span>개인별 문제집과 학습 진도</span>':'<span>'+esc(groupName)+' · '+(g?.members?.length||0)+'/5명</span>')+'</div>')+
 (db.tab==='mine'?'<div class="bs-folders">'+['전체',...db.folders].map(f=>toolbarButton(f,'folder',f,db.folder===f)).join('')+htmlButton('새 책장 +','addFolder','','bs-tab')+'</div>':'')+
 (db.tab==='group'?'<p class="bs-local-warning">그룹 책장 공유 내용은 현재 브라우저에 저장됩니다. 다른 학생과의 서버 동기화는 아직 연결되지 않았습니다.</p>':'')+
 (db.tab==='all'&&recent.length?'<div class="bs-recent"><div class="bs-heading"><h4>이어서 공부하기</h4><small>최근 열어본 문제집</small></div>'+
 '<div class="bs-recent-scroll">'+recent.map(b=>'<button data-bs="open" data-val="'+esc(b.id)+'" type="button">'+cover(b,true)+'<span>'+esc(b.name)+'<small>'+esc(db.progress[b.id]||0)+'% 진행 · '+formatDate(db.last[b.id])+'</small></span></button>').join('')+'</div></div>':'')+
 '<div class="bs-heading"><div><h4>'+(db.tab==='all'?'학년별 문제집':db.tab==='mine'?'내가 선택한 문제집':'공동으로 보는 문제집')+'</h4><small>'+arr.length+'권 · '+(db.tab==='all'?'표지 중심 도서 탐색':'학습 기록 및 보관')+'</small></div>'+
 '<div class="bs-layout-controls">'+
 '<label><span class="bs-visually-hidden">정렬</span><select data-bs-change="sort">'+[['recommended','추천순'],['name','이름순'],['recent','최근 학습순'],['progress','진도순']].map(([k,t])=>'<option value="'+k+'"'+(db.sort===k?' selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
 htmlButton('▦','view','grid',db.view==='grid'?'on':'')+
 htmlButton('☷','view','list',db.view==='list'?'on':'')+'</div></div>'+
 (arr.length?'<div class="bs-books '+(db.view==='list'?'list-view':'')+'">'+arr.map(bookTile).join('')+'</div>':noResult())+
 '<div class="bs-catalog-note">수학 33권은 11개 교재 시리즈의 학년별 책장 구성 예시입니다. 실제 표지가 확인된 중2 1학기 교재에만 표지 이미지를 사용합니다. 본 화면은 교재 원문·문항을 제공하지 않습니다.</div>'+
 '</section>';
}
function detailPage(){
 const b=currentBook();const mine=db.mine.includes(b.id),shared=groupBooks().includes(b.id);
 const units=UNIT[b.grade+'-'+b.term]||UNIT['중2-1'],selected=db.unit[b.id]||0,p=Math.max(0,Math.min(100,Number(db.progress[b.id])||0));
 const folder=db.assignment[b.id]||'학습 중';
 db.last[b.id]=db.last[b.id]||Date.now();save();
 return '<section class="bs-library bs-detail" aria-label="문제집 상세">'+
 htmlButton('‹ 책장으로','back','','bs-back')+
 '<div class="bs-detail-hero">'+cover(b)+
 '<div class="bs-detail-info"><small>'+esc(b.publisher)+' · '+esc(b.grade)+'-'+esc(b.term)+'</small><h3>'+esc(b.name)+'</h3>'+
 '<p>'+esc(b.subtitle)+' · '+esc(b.subject)+'</p>'+
 '<span class="bs-tag">'+(b.verifiedCover?'표지 확인 교재':'표지 미확인 · 제목형 표시')+'</span>'+
 '<div class="bs-progress"><span style="width:'+p+'%"></span></div><small>내 학습 진도 '+p+'%</small></div></div>'+
 '<div class="bs-detail-actions">'+htmlButton(mine?'내 책장에 저장됨':'내 책장에 추가','mineToggle',b.id,mine?'checked':'primary')+
 htmlButton(shared?'그룹에 공유됨':'그룹 책장에 공유','groupToggle',b.id,shared?'checked':'')+'</div>'+
 (mine?'<div class="bs-folder-assignment">'+selectField('내 책장 분류','assignFolder',[...db.folders].map(x=>[x,x]),folder)+'</div>':'')+
 '<div class="bs-section-title"><h4>학습할 단원</h4><small>독립 학습 목표 · 실제 교재 목차가 아닙니다</small></div>'+
 '<div class="bs-chapters">'+units.map((u,i)=>'<button data-bs="unit" data-val="'+i+'" class="'+(Number(selected)===i?'active':'')+'" type="button"><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+esc(u)+'</strong><span>›</span></button>').join('')+'</div>'+
 '<div class="bs-learning-actions"><strong>'+esc(units[selected]||units[0])+'</strong>'+
 '<p>원리 발견 → 쉬운 질문 → 반복 훈련 → 목표문제 재도전</p>'+
 htmlButton('이 단원 학습 시작','learn',b.id,'primary')+'</div>'+
 '<div class="bs-section-title"><h4>학습 진행 상태</h4><small>직접 기록한 내용만 저장됩니다</small></div>'+
 '<div class="bs-progress-buttons">'+[0,25,50,75,100].map(n=>htmlButton(n+'%','progress',String(n),p===n?'checked':'')).join('')+'</div>'+
 '<label class="bs-note-label" for="bs-memo">풀이 메모 · 오답 정리</label>'+
 '<textarea id="bs-memo" data-bs-memo="'+esc(b.id)+'" placeholder="공부한 내용을 기록하세요.">'+esc(db.memo[b.id]||'')+'</textarea>'+
 '<div class="bs-detail-bottom">'+htmlButton('학교별 족보','go','bankSearch')+htmlButton('그룹 학습자료','go','groupLearning')+'</div>'+
 '<p class="bs-local-warning">학습 진도·메모·책장 상태는 이 브라우저에만 저장됩니다. 온라인 회원 연동은 아직 연결되지 않았습니다.</p>'+
 '</section>';
}
function readingPage(){
 const b=currentBook(),units=UNIT[b.grade+'-'+b.term]||UNIT['중2-1'];
 const i=Number(db.unit[b.id])||0;
 return '<section class="bs-library bs-reading">'+htmlButton('‹ 교재로','go','groupBookDetail','bs-back')+
 '<div class="bs-reading-head"><small>'+esc(b.name)+'</small><h3>'+esc(units[i]||units[0])+'</h3></div>'+
 '<div class="bs-reading-paper"><div class="bs-reading-label">AI 과외 학습 흐름</div>'+
 '<h4>어떤 문제를 해결해야 할까요?</h4>'+
 '<p>이 단원을 학습하는 목적을 먼저 생각하고, 질문과 대화를 통해 원리를 발견한 뒤 반복 훈련합니다.</p>'+
 '<div class="bs-reading-steps">'+['문제가 생긴 이유','이전 수학자의 접근','작은 질문으로 발견','다른 방법과 비교','새로운 문제에 적용'].map((t,k)=>'<div><span>'+String(k+1).padStart(2,'0')+'</span><strong>'+t+'</strong></div>').join('')+'</div>'+
 '<p class="bs-reading-foot">실제 교재 원문이나 생성형 AI 문제풀이가 제공되는 화면은 아닙니다. 아래 체험은 이차방정식 예시 고정 질문 8단계입니다.</p></div>'+
 '<div class="bs-reading-actions">'+htmlButton('이차방정식 대화 시연','go','groupAITutorPractice','primary')+
 htmlButton('AI에 질문하기','go','groupQuestions')+
 htmlButton('다음 단원','nextUnit')+'</div>'+
 '</section>';
}
const oldGroupPage=groupPage,oldBottom=bottomFor;
window.YPT_GRAPH.groupAITutor=Object.assign({},window.YPT_GRAPH.groupAITutor,{title:'문제집 책장 · AI 과외'});
const NEW={groupBookDetail:'문제집 상세',groupBookLearn:'문제집 학습',groupAITutorPractice:'AI 수학 트레이너 체험'};
for(const [id,title] of Object.entries(NEW)){
 window.YPT_GRAPH[id]={title,evidence:[],actions:[{text:'문제집 책장',go:'groupAITutor'}]};
 if(GROUPS['스터디 그룹']&&!GROUPS['스터디 그룹'].includes(id))GROUPS['스터디 그룹'].push(id);
}
groupPage=function(id){
 if(id==='groupAITutor')return mainPage();
 if(id==='groupBookDetail')return detailPage();
 if(id==='groupBookLearn')return readingPage();
 if(id==='groupAITutorPractice')return oldGroupPage('groupAITutor');
 return oldGroupPage(id);
};
bottomFor=function(id){
 if(NEW[id]||id==='groupAITutor')return oldBottom('groupAITutor');
 return oldBottom(id);
};
function redraw(){render();}
function open(id){if(!MAP.has(id))return;db.selected=id;db.last[id]=Date.now();save();go('groupBookDetail');}
function action(type,val){
 const b=currentBook(),gid=group()?.id;
 if(type==='tab'){db.tab=val;db.query='';db.queryDraft='';db.folder='전체';save();redraw();return;}
 if(type==='folder'){db.folder=val;save();redraw();return;}
 if(type==='addFolder'){
  const name=prompt('새 책장 이름을 입력하세요.');if(!name?.trim())return;
  const v=name.trim().slice(0,24);if(!db.folders.includes(v))db.folders.push(v);
  db.folder=v;save();redraw();return;
 }
 if(type==='view'){db.view=val;save();redraw();return;}
 if(type==='open'){open(val);return;}
 if(type==='back'){go('groupAITutor');return;}
 if(type==='go'){go(val);return;}
 if(type==='mineToggle'){
  if(!MAP.has(val))return;
  db.mine=db.mine.includes(val)?db.mine.filter(id=>id!==val):[...db.mine,val];
  if(db.mine.includes(val)&&!db.assignment[val])db.assignment[val]='학습 중';
  save();redraw();return;
 }
 if(type==='groupToggle'){
  if(!gid||!MAP.has(val)){toast('스터디그룹을 먼저 선택해 주세요.');return;}
  const old=groupBooks();
  updateGroupBooks(old.includes(val)?old.filter(id=>id!==val):[...old,val]);
  redraw();return;
 }
 if(type==='unit'){db.unit[b.id]=Number(val)||0;save();redraw();return;}
 if(type==='learn'){db.last[b.id]=Date.now();save();go('groupBookLearn');return;}
 if(type==='nextUnit'){
  const units=UNIT[b.grade+'-'+b.term]||UNIT['중2-1'];
  db.unit[b.id]=((db.unit[b.id]||0)+1)%units.length;
  db.last[b.id]=Date.now();save();redraw();return;
 }
 if(type==='progress'){const n=Number(val);db.progress[b.id]=n;db.last[b.id]=Date.now();
  if(n===100){if(!db.mine.includes(b.id))db.mine.push(b.id);if(!db.folders.includes('완료'))db.folders.push('완료');db.assignment[b.id]='완료';}
  save();redraw();return;}
}
document.addEventListener('click',e=>{
 const button=e.target.closest('#phone [data-bs]');if(!button)return;
 e.preventDefault();e.stopImmediatePropagation();action(button.dataset.bs,button.dataset.val||'');
},true);
document.addEventListener('change',e=>{
 const t=e.target;if(!t.closest('#phone'))return;
 if(t.dataset.bsChange){
  const key=t.dataset.bsChange,allowed=['grade','term','level','publisher','sort','assignFolder'];
  if(!allowed.includes(key))return;
  if(key==='assignFolder'){db.assignment[currentBook().id]=t.value;}
  else db[key]=t.value;
  save();redraw();return;
 }
 if(t.dataset.bsMemo){db.memo[t.dataset.bsMemo]=t.value;save();}
},true);
document.addEventListener('input',e=>{
 if(e.target?.id==='bs-query'){db.queryDraft=e.target.value;}
 if(e.target?.dataset?.bsMemo){db.memo[e.target.dataset.bsMemo]=e.target.value;save();}
});
document.addEventListener('submit',e=>{
 if(e.target.id!=='bs-search-form')return;
 e.preventDefault();e.stopImmediatePropagation();db.query=String(new FormData(e.target).get('query')||'').trim();db.queryDraft=db.query;save();redraw();
},true);
window.HITEL_BOOKSHELF_INSPECT=()=>({
 screen:state.screen,libraryCount:BOOKS.length,actualCoverCount:BOOKS.filter(b=>b.verifiedCover).length,
 tab:db.tab,grade:db.grade,term:db.term,selected:db.selected,
 personalBooks:db.mine.length,groupBooks:groupBooks().length,groupId:group()?.id||null,
 persistence:'browser-local',serverShared:false,llmConnected:false
});
if(['groupAITutor','groupBookDetail','groupBookLearn','groupAITutorPractice'].includes(state.screen))redraw();
})();
