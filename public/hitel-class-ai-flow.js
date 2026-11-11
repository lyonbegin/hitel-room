/* Single HITEL learning-class contract: one AI leader, configurable seats (1–5).
 * Textbooks are resources; neither solo nor group tutoring are separate products.
 * The series ratings in Moonzip are snapshot metadata, not teacher quality scores.
 */
(function(){
'use strict';
const WP=window.HITEL_WORKPLACE_BRIDGE;
const LIB=window.HITEL_BOOKSHELF_BRIDGE;
if(!WP||!LIB)return;
const model=WP.getModel(),CAT=LIB.getCatalog(),DATA=window.HITEL_MOONZIP_SOURCE;
const clean=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MATCH_SERIES={'쎈':'ssen','개념원리':'concept','EBS 수능특강':'ebs','100발 100중':'100bal'};
const cur={seriesId:'',catalogId:'',editionId:'',pending:null,origin:'series'};
const pageBefore=groupPage,bottomBefore=bottomFor;
const routes={groupBookClassSelect:'AI 선생님을 지정할 학습반 선택'};
for(const [id,title] of Object.entries(routes)){
 window.YPT_GRAPH[id]={title,evidence:[],actions:[{text:'AI 과외',go:'groupAITutor'}]};
 if(!GROUPS['스터디 그룹']?.includes(id))GROUPS['스터디 그룹']?.push(id);
}
const subjectOf=g=>String(g?.subject||'').split(/[,·/]/)[0].trim();
const seats=g=>Math.max(1,Math.min(5,Number(g?.capacity)||5));
const currentCatalog=()=>CAT.find(b=>b.id===cur.catalogId)||LIB.currentBook?.()||null;
const seriesById=id=>DATA?.series?.find(b=>b.id===id)||null;
function metaSeries(b){
 return b?{name:b.name,series:b.name,publisher:b.publisher||'',image:b.image||'',subject:'수학',
  source:'문집 제공 원본 HTML',sourceId:b.id,score:b.score,votes:b.votes,cats:b.cats||[],purpose:b.purpose||[],bookId:'',verified:false,grade:'',term:''}:null;
}
function metaCatalog(b){
 return b?{name:b.name,series:b.series||b.name,publisher:b.publisher||'',image:b.image||'',subject:b.subject||'수학',
  source:'HITEL 등록 교재 목록',sourceId:b.id,score:null,votes:0,cats:[],purpose:[],
  bookId:b.id,verified:true,grade:b.grade||'',term:b.term||''}:null;
}
function choicesFor(b){
 const tag=MATCH_SERIES[b?.name]||'';
 return tag?CAT.filter(x=>x.series===tag&&subjectOf(x)==='수학'&&x.id):[];
}
function linkedTeacherList(subject){
 const out=new Map();
 try{const own=JSON.parse(localStorage.getItem('hitel.education.trainers-v1')||'[]');
  if(Array.isArray(own))for(const x of own)if(x?.id&&x?.subject===subject)out.set(x.id,x.name||subject+' AI 선생님');
 }catch{}
 for(const g of model.groups||[])if(subjectOf(g)===subject&&g.coachId)
  out.set(g.trainerId||g.coachId,g.coachName||subject+' AI 선생님');
 return [...out.entries()].map(([id,name])=>({id,name}));
}
function detailHtml(b,series=false){
 if(!b)return '<section class="ca-flow"><p>교재를 찾을 수 없습니다.</p><button data-go="groupAITutor">AI 과외로 돌아가기</button></section>';
 const variants=series?choicesFor(b):[],picked=series?CAT.find(x=>x.id===cur.editionId)||null:null;
 const final=picked?metaCatalog(picked):(series?metaSeries(b):metaCatalog(b));
 const owner=linkedTeacherList(final.subject);
 const purpose=Array.isArray(b.purpose)?['개념','유형','연산','심화'].map((n,i)=>({label:n,value:b.purpose[i]||0})).filter(x=>x.value>0):[];
 const desc=series?'문제집 시리즈에 대한 평가 정보입니다. 특정 판본이나 AI 선생님의 학습 능력 점수가 아닙니다.':'HITEL에서 등록된 교재 정보입니다. AI 선생님은 학습반에 지정됩니다.';
 return '<section class="ca-flow ca-detail">'+
 '<button type="button" class="ca-back" data-go="groupMoonzipSearch">‹ 문제집 찾기로</button>'+
 '<div class="ca-hero"><div class="ca-cover">'+(b.image?'<img src="'+clean(b.image)+'" alt="'+clean(b.name)+' 표지" loading="lazy" onerror="this.style.display=&quot;none&quot;" />':'<span>▤</span>')+'</div>'+
 '<div class="ca-bookinfo"><small>선택한 학습 교재</small><h2>'+clean(b.name)+'</h2><p>'+clean(b.publisher||'')+'</p>'+
 (b.score!=null?'<span class="ca-score">문집 시리즈 난이도 '+Number(b.score).toFixed(1)+'/10 · 투표 '+(b.votes||0)+'개</span>':'')+
 '<p class="ca-smallnote">'+clean(desc)+'</p></div></div>'+
 (variants.length?'<div class="ca-panel"><strong>학년·학기별 교재 선택</strong><p>AI 과외에 연결할 정확한 교재를 선택해 주세요.</p>'+
 '<select id="ca-edition" aria-label="교재 학년 학기 선택"><option value="">시리즈만 선택 (학년·판본 미확정)</option>'+
 variants.map(x=>'<option value="'+clean(x.id)+'"'+(cur.editionId===x.id?' selected':'')+'>'+clean([x.name,x.grade,x.term?x.term+'학기':''].filter(Boolean).join(' · '))+'</option>').join('')+'</select></div>':
 '<div class="ca-panel"><strong>교재 정보</strong><p>'+(series?'HITEL에 개별 판본이 연결되지 않은 시리즈입니다. 정확한 학년·학기·판본은 학습반 개설 시 확인해 주세요.':
 clean([b.grade,b.term?b.term+'학기':''].filter(Boolean).join(' · ')||'학년·학기 정보 미기재'))+'</p></div>')+
 '<div class="ca-panel ca-teacher"><small>학습반의 중심</small><h3>이 교재를 지도할 담당 AI 선생님</h3>'+
 '<p>AI 선생님 한 명이 학습반을 이끌며 문제풀이·질문·미션을 담당합니다. 기존 선생님은 같은 과목이면 교재와 학년이 달라도 재사용할 수 있습니다.</p>'+
 (owner.length?'<div class="ca-teachers">'+owner.slice(0,4).map(x=>'<span>✦ '+clean(x.name)+'</span>').join('')+'</div>':
 '<div class="ca-teachers"><span>아직 보유한 '+clean(final.subject)+' AI 선생님이 없습니다 · 학습반 개설 후 지정</span></div>')+
 '</div>'+
 '<div class="ca-panel"><h3>이 교재로 AI 과외에서 할 일</h3><div class="ca-method"><span>✦ 문제 촬영·질문</span><span>✦ 힌트와 풀이 과정</span><span>✦ 교재별 진도·오답</span><span>✦ 학습반 미션</span></div>'+
 (purpose.length?'<details><summary>문제집 성격·학습 목적 보기</summary>'+
 '<div class="ca-purpose">'+purpose.map(x=>'<div><span>'+clean(x.label)+'</span><meter min="0" max="100" value="'+x.value+'"></meter><b>'+x.value+'%</b></div>').join('')+'</div>'+
 '<small>문집 원본의 시리즈 투표 분포이며 개인별 추천 결과가 아닙니다.</small></details>':'')+'</div>'+
 '<div class="ca-cta-stack">'+
 '<button type="button" class="ca-primary" data-ca="begin">이 AI 선생님을 학습반에 지정하기 →</button>'+
 '<button type="button" class="ca-secondary" data-ask="open">사진·음성·글로 먼저 질문하기</button>'+
 '</div><p class="ca-honesty">학습반 정원은 1~5명이며 1명도 학습반으로 이용합니다. 별도 ‘개인 과외’ 상품은 없습니다. AI 모델의 실제 연결 상태와 교재 원문 확보 여부는 별도로 확인해야 합니다.</p>'+
 '</section>';
}
function getActiveDetail(){
 if(cur.origin==='catalog'){const b=currentCatalog();return metaCatalog(b)}
 return metaSeries(seriesById(cur.seriesId));
}
function ensureSeries(b){
 if(!b)return null;
 if(cur.seriesId!==b.id||cur.origin!=='series'){cur.seriesId=b.id;cur.catalogId='';cur.editionId='';cur.origin='series';}
 return b;
}
function renderSeries(b){return detailHtml(ensureSeries(b),true)}
function renderCatalogBook(){
 cur.origin='catalog';let b=currentCatalog();
 if(cur.catalogId)b=CAT.find(x=>x.id===cur.catalogId)||b;
 return detailHtml(b,false);
}
function startSelected(){
 const source=getActiveDetail();
 if(!source){toast('먼저 교재를 선택해 주세요.');return}
 const edition=cur.origin==='series'?CAT.find(b=>b.id===cur.editionId):null;
 cur.pending=edition?metaCatalog(edition):source;
 go('groupBookClassSelect');
}
function existing(){
 const pending=cur.pending;if(!pending)return null;
 const matching=(model.groups||[]).filter(g=>g.members?.includes('나')&&subjectOf(g)===pending.subject);
 return '<section class="ca-flow ca-class-select"><button type="button" class="ca-back" data-go="groupMoonzipSeries">‹ 교재별 AI 과외로</button>'+
 '<div class="ca-section-label">학습반 · 담당 AI 선생님 지정</div>'+
 '<h2>어느 학습반에서 공부하시겠습니까?</h2>'+
 '<p class="ca-intro">학생 수와 관계없이 하나의 학습반을 사용합니다. 교재를 연결한 다음 그 반을 이끌 AI 선생님을 지정합니다.</p>'+
 '<div class="ca-panel"><small>선택한 교재</small><strong>'+clean(pending.name)+'</strong>'+
 '<p>'+clean(pending.publisher||'')+' · '+clean(pending.grade||'학년 미확정')+(pending.term?' · '+clean(pending.term)+'학기':'')+'</p></div>'+
 '<div class="ca-select-heading"><b>내 '+clean(pending.subject)+' 학습반</b><small>'+matching.length+'개</small></div>'+
 (matching.length?matching.map(g=>'<button type="button" class="ca-existing" data-ca="useClass" data-value="'+clean(g.id)+'">'+
 '<span class="ca-existing-head"><b>'+clean(g.name)+'</b><small>'+(g.members?.length||1)+'/'+seats(g)+'명</small></span>'+
 '<span>'+clean([g.institutionName||g.school,g.grade,g.subject].filter(Boolean).join(' · '))+'</span>'+
 '<span>'+(g.coachName?'담당: '+clean(g.coachName):'담당 AI 선생님 지정 필요')+'</span><strong>이 학습반에 교재 연결하고 AI 지정 →</strong></button>').join(''):
 '<div class="ca-empty">현재 과목에 맞는 내 학습반이 없습니다. 정원 1명으로도 새 학습반을 개설할 수 있습니다.</div>')+
 '<div class="ca-new-class"><h3>새 학습반 만들기</h3><p>학교·학원, 학년, 과목, 목표, 정원(1~5명)을 정하고 AI 선생님을 지정합니다.</p>'+
 '<button type="button" class="ca-primary" data-ca="newClass">＋ 새 학습반 만들기 →</button></div>'+
 '<p class="ca-honesty">개설 인원에 따른 가격·24시간 내 결제 처리는 이번 단계에 구현하지 않았습니다.</p></section>';
}
function applyGroup(id){
 const p=cur.pending,g=model.groups.find(x=>x.id===id);
 if(!p||!g||!g.members?.includes('나')){toast('연결할 학습반을 찾지 못했습니다.');return}
 if(subjectOf(g)!==p.subject){toast('학습반 과목과 교재 과목이 같아야 합니다.');return}
 if(p.grade&&g.grade&&p.grade!==g.grade){toast('학년이 다른 교재입니다. 학습반 학년에 맞는 교재를 선택해 주세요.');return}
 g.studyBook={series:p.series||p.name,publisher:p.publisher||'',source:p.source||'',verified:!!p.verified,grade:p.grade||'',term:p.term||''};
 g.bookTitle=p.name;
 if(p.verified&&p.bookId){
  g.bookId=p.bookId;g.bookShelf=[...new Set([...(g.bookShelf||[]),p.bookId])];
  LIB.setBook(p.bookId);
 }else{
  g.bookId=''; // Do not imply an exact verified edition exists for a series-only selection.
 }
 model.activeGroupId=id;WP.saveModel();
 go('groupTrainerSelect');
}
function openCatalogBook(id){
 const b=CAT.find(x=>x.id===id);if(!b){toast('선택한 교재가 현재 목록에 없습니다.');return}
 cur.catalogId=b.id;cur.seriesId='';cur.editionId='';cur.origin='catalog';LIB.setBook(id);
 go('groupCoachProfile');
}
function clearPending(){cur.pending=null}
function pending(){return cur.pending&&{...cur.pending}}
window.HITEL_CLASS_AI_FLOW={pending,clearPending,renderSeries,renderCatalogBook,openCatalogBook,inspect:()=>({
 selectedSeries:cur.seriesId,selectedEdition:cur.editionId,selectedCatalog:cur.catalogId,
 pending:pending(),classCount:model.groups?.length||0,mode:'single-learning-class',paymentImplemented:false})};
groupPage=function(route){
 if(route==='groupTutorMine')return pageBefore('groups'); // old saved URL now resolves to the existing class-home page
 if(route==='groupBookClassSelect')return existing()||'<section class="ca-flow"><p>교재를 다시 선택해 주세요.</p><button data-go="groupAITutor">AI 과외로 돌아가기</button></section>';
 if(route==='groupTutorCatalog')return pageBefore('groupMoonzipSearch'); // no second catalogue
 if(['groupCoachProfile','groupBookDetail'].includes(route))return renderCatalogBook(); // one teacher-first book detail
 if(['groupMoonzipRoadmap','groupMoonzipCompare'].includes(route))return pageBefore('groupMoonzipSearch'); // stale deep links
 return pageBefore(route);
};
bottomFor=function(route){if(route==='groupTutorMine')return bottomBefore('groups');return ['groupBookClassSelect','groupTutorCatalog','groupCoachProfile','groupBookDetail','groupMoonzipRoadmap','groupMoonzipCompare'].includes(route)?bottomBefore('groupAITutor'):bottomBefore(route)};
document.addEventListener('click',ev=>{
 const btn=ev.target.closest?.('#phone [data-ca]');
 if(!btn)return;
 ev.preventDefault();ev.stopPropagation();
 const act=btn.dataset.ca,value=btn.dataset.value||'';
 if(act==='begin'){startSelected();return}
 if(act==='newClass'){go('groupCreate');return}
 if(act==='useClass'){applyGroup(value);return}
});
document.addEventListener('change',ev=>{
 if(ev.target?.id==='ca-edition'){
  const id=ev.target.value;
  const b=CAT.find(x=>x.id===id);
  cur.editionId=b?.id||'';
  render();
 }
});
render();
})();