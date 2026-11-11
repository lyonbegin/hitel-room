/* HITEL Education 2026-11-11 — group-bound textbook tutor platform.
 * One textbook-specific coach may serve any number of independent school/academy study groups.
 * Every enrolled group has its own teacher, questions, materials, assignments and exams.
 * Presentation/interaction are browser-local; no claims of LLM training, cross-device sync or billing.
 * This module is loaded last and reuses the pre-existing group model, catalog, practice and Zocbo flows.
 */
(function(){
'use strict';
const WP=window.HITEL_WORKPLACE_BRIDGE,LIB=window.HITEL_BOOKSHELF_BRIDGE;
if(!WP||!LIB)throw Error('HITEL group/book dependencies not loaded');
const model=WP.getModel(),catalog=LIB.getCatalog();
const catalogMap=new Map(catalog.map(b=>[b.id,b]));
const PAGES={
 groups:'내 스터디',groupSearch:'내 스터디',
 groupCreate:'스터디 개설',groupJoin:'스터디 가입',
 groupDetail:'스터디 상세',groupSettings:'스터디 설정',
 groupQuestions:'질문하기',groupTeacherChat:'AI 선생님과 대화',
 groupMessages:'그룹 대화',groupLearning:'학습',
 groupAITutor:'AI 과외',groupBookDetail:'AI 선생님 소개',groupCoachProfile:'AI 선생님 소개',
 groupTutorSettings:'교재 및 선생님 설정'
};
for(const [id,title] of Object.entries(PAGES)){
 window.YPT_GRAPH[id]={title,evidence:[],actions:[{text:'내 스터디',go:'groups'}]};
 if(GROUPS['스터디 그룹']&&!GROUPS['스터디 그룹'].includes(id))GROUPS['스터디 그룹'].push(id);
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=p=>p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
const today=()=>new Date().toLocaleDateString('sv-SE');
const time=()=>Date.now();
const gById=gid=>model.groups.find(g=>g.id===gid)||null;
const active=()=>gById(model.activeGroupId)||model.groups[0]||null;
const labelInstitution=g=>(g.institutionType==='academy'?'학원':'학교')+' · '+(g.institutionName||g.school||'미지정');
const coachLabel=b=>b?b.coachName||((b.name||b.title||'교재')+' AI 선생님'):'AI 선생님';
const customBooks=()=>Array.isArray(model.customBooks)?model.customBooks:[];
const bookById=bid=>catalogMap.get(bid)||customBooks().find(b=>b.id===bid)||null;
const bookFor=g=>g?bookById(g.bookId):null;
const coachFor=g=>g?.coachName||coachLabel(bookFor(g));
const titleOf=g=>[g.institutionName||g.school,g.grade,g.subject].filter(Boolean).join(' · ')||g.name;
const groupMatchesBook=g=>!!(g&&g.coachId&&g.bookId&&bookFor(g));
const save=()=>WP.saveModel();
const todayTitle=()=>new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric'});
const bt=(text,action,value='',primary=false)=>'<button type="button" class="tp-btn'+(primary?' primary':'')+'" data-tp="'+esc(action)+'" data-value="'+esc(value)+'">'+esc(text)+'</button>';
const goBtn=(text,route,primary=false)=>'<button type="button" class="tp-btn'+(primary?' primary':'')+'" data-tp="route" data-value="'+esc(route)+'">'+esc(text)+'</button>';
const panel=(children,cls='')=>'<section class="tp-panel '+cls+'">'+children+'</section>';
const heading=(h,sub='')=>'<div class="tp-head"><h2>'+esc(h)+'</h2>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div>';
const empty=(label,sub='',button='')=>'<div class="tp-empty"><strong>'+esc(label)+'</strong>'+(sub?'<p>'+esc(sub)+'</p>':'')+button+'</div>';
const tags=items=>'<div class="tp-tags">'+items.filter(Boolean).map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>';
const actions=a=>'<div class="tp-actions">'+a.join('')+'</div>';
const placeContext=g=>[g.institutionName||g.school,g.grade,g.subject].filter(Boolean).join(' · ');
const getTeacherQuery=g=>model.teacherChats?.[g.id]?.me||[];
const getChatRecord=g=>{
 if(!model.teacherChats||typeof model.teacherChats!=='object')model.teacherChats={};
 if(!model.teacherChats[g.id])model.teacherChats[g.id]={me:[]};
 if(!Array.isArray(model.teacherChats[g.id].me))model.teacherChats[g.id].me=[];
 return model.teacherChats[g.id].me;
};
if(!Array.isArray(model.customBooks))model.customBooks=[];
if(!model.teacherChats||typeof model.teacherChats!=='object')model.teacherChats={};
if(!Array.isArray(model.examResults))model.examResults=[];
if(!Array.isArray(model.exams))model.exams=[];
for(const g of model.groups){
 if(!Array.isArray(g.members))g.members=['나'];
 if(!g.institutionType)g.institutionType='school';
 if(!g.institutionName)g.institutionName=g.school||'';
 if(typeof g.topics!=='string')g.topics='';
 // Never guess or silently assign a teacher to a legacy study group.
 if(!g.bookId)g.bookId='';
 if(!g.coachId)g.coachId='';
 if(!g.coachName)g.coachName='';
}
const ui={subject:'전체',grade:'전체',query:'',selectedBook:'',groupQuery:'',groupType:'all',learningTab:'assignments',formMode:'',chatListQuery:'',chatSubject:'전체'};
const urlInit=new URLSearchParams(location.search),path=urlInit.get('screen');
if(urlInit.get('book')&&bookById(urlInit.get('book')))ui.selectedBook=urlInit.get('book');
function selectGroup(gid,route){
 const g=gById(gid);if(!g)return;
 model.activeGroupId=g.id;save();
 if(route){if(g.bookId&&catalogMap.has(g.bookId))LIB.setBook(g.bookId);go(route)}
 else render();
}
function selectedBook(){return bookById(ui.selectedBook)||bookById(active()?.bookId)||catalog[0]||null}
function bookCover(b){
 if(b?.verifiedCover&&b.image)return '<div class="tp-cover"><img src="'+esc(b.image)+'" loading="lazy" alt="'+esc(b.name)+' 교재 표지" onerror="this.style.display=&quot;none&quot;" /></div>';
 return '<div class="tp-cover tp-cover-plain"><small>'+esc(b?.publisher||b?.subject||'교재')+'</small><strong>'+esc((b?.name||'교재').split(' ')[0])+'</strong><span>'+esc(b?.grade||'')+'</span></div>';
}
function coachNameForBook(b){return (b?.name||'선택한 교재')+' AI 선생님'}
function compactGroup(g,buttons=true){
 const book=bookFor(g),recent=getTeacherQuery(g).slice(-1)[0];
 return '<article class="tp-group-item"><div class="tp-item-head">'+
 '<div><strong>'+esc(g.name)+'</strong><small>'+esc(placeContext(g)||'학교·학원 설정 필요')+'</small></div>'+
 '<span class="tp-chevron" aria-hidden="true">›</span></div>'+
 '<div class="tp-teacher-summary"><span class="tp-teacher-mark">AI</span><div><strong>'+esc(groupMatchesBook(g)?coachFor(g):'교재·AI 선생님 미설정')+'</strong>'+
 '<small>'+esc(book?.name||'교재를 선택해 주세요')+'</small></div></div>'+
 (recent?'<p class="tp-recent">최근 질문 · '+esc(recent.text).slice(0,78)+'</p>':'')+
 (buttons?actions([
 bt('스터디 열기','selectGroup',g.id,true),
 bt(groupMatchesBook(g)?'바로 질문':'선생님 설정',groupMatchesBook(g)?'openChat':'setupTutor',g.id)
 ]):'')+'</article>';
}
function selectGroupControl(){
 return '<label class="tp-switch"><span>내 스터디</span><select data-tp-select="group" aria-label="현재 스터디 선택">'+
 model.groups.map(g=>'<option value="'+esc(g.id)+'"'+(g.id===model.activeGroupId?' selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select></label>';
}
function groupIndex(){
 const groups=model.groups.filter(g=>(ui.groupType==='all'||g.institutionType===ui.groupType)&&(!ui.groupQuery||(
 g.name+' '+placeContext(g)+' '+coachFor(g)+' '+(bookFor(g)?.name||'')).toLocaleLowerCase().includes(ui.groupQuery.toLocaleLowerCase())));
 return '<section class="tp-app">'+heading('내 스터디','가입한 스터디와 담당 AI 선생님을 확인하세요.')+
 '<form id="tp-group-search-form" class="tp-search"><input name="q" value="'+esc(ui.groupQuery)+'" placeholder="학교·학원·과목·선생님 검색" aria-label="스터디 검색" />'+
 '<button type="submit">검색</button></form>'+
 '<div class="tp-chips">'+[['all','전체'],['school','학교'],['academy','학원']].map(([k,n])=>bt(n,'groupFilter',k,ui.groupType===k)).join('')+'</div>'+
 '<div class="tp-group-list">'+(groups.length?groups.map(g=>compactGroup(g)).join(''):empty('조건에 맞는 스터디가 없습니다.'))+'</div>'+
 actions([goBtn('새 스터디 만들기','groupCreate',true),goBtn('초대 코드로 참여','groupJoin')])+
 '</section>';
}
function teacherFinder(){
 let books=[...catalog,...customBooks()],grouped=new Set(['전체',...books.map(b=>b.subject||'수학')]);
 books=books.filter(b=>(ui.subject==='전체'||b.subject===ui.subject)&&(ui.grade==='전체'||b.grade===ui.grade)&&
 (!ui.query||(b.name+' '+b.publisher+' '+b.subject+' '+b.grade).toLocaleLowerCase().includes(ui.query.toLocaleLowerCase())));
 const grades=['전체','중1','중2','중3','고1','고2','고3'];
 return '<section class="tp-app">'+heading('AI 과외','교재를 선택하고 전문 AI 선생님과 스터디를 시작하세요.')+
 '<form id="tp-catalog-search-form" class="tp-search"><input name="q" value="'+esc(ui.query)+'" placeholder="교재명·출판사 검색" aria-label="AI 과외 교재 검색"/><button type="submit">검색</button></form>'+
 '<div class="tp-chips">'+[...grouped].map(k=>bt(k,'filterSubject',k,ui.subject===k)).join('')+'</div>'+
 '<label class="tp-inline-select">학년 <select data-tp-select="catalogGrade">'+grades.map(x=>'<option value="'+x+'"'+(x===ui.grade?' selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
 '<div class="tp-book-grid">'+books.map(b=>'<button type="button" class="tp-book-item" data-tp="chooseBook" data-value="'+esc(b.id)+'">'+
 bookCover(b)+'<strong>'+esc(b.name)+'</strong><small>'+esc(b.publisher||'선택 교재')+'</small></button>').join('')+'</div>'+
 (books.length?'':empty('검색된 교재가 없습니다.','아래에서 사용하실 교재를 직접 등록할 수 있습니다.'))+
 panel('<strong>원하는 교재가 없으신가요?</strong><p class="tp-subtle">교재명을 등록해 스터디를 구성할 수 있습니다.</p>'+
 '<form id="tp-register-book" class="tp-form">'+
 '<label>과목<select name="subject" required>'+['수학','영어','국어','과학','사회','기타'].map(s=>'<option>'+s+'</option>').join('')+'</select></label>'+
 '<label>학년<select name="grade" required>'+['초5','초6','중1','중2','중3','고1','고2','고3'].map(s=>'<option>'+s+'</option>').join('')+'</select></label>'+
 '<label>문제집 이름<input name="name" maxlength="100" placeholder="정확한 교재명" required/></label>'+
 '<button type="submit" class="tp-btn primary">교재 등록</button></form>'+
 '<p class="tp-note">교재 등록은 코치 설정을 위한 첫 단계입니다. 등록만으로 교재 원문이나 AI 학습이 완료되지는 않습니다.</p>')+
 '</section>';
}
function profile(){
 const b=selectedBook();if(!b)return '<section class="tp-app">'+empty('교재를 선택해 주세요.','AI 과외에서 교재를 선택하실 수 있습니다.',goBtn('AI 과외로','groupAITutor',true))+'</section>';
 const qualified=model.groups.filter(g=>g.bookId===b.id);
 return '<section class="tp-app">'+bt('‹ AI 과외','route','groupAITutor')+
 heading('AI 선생님','선택한 교재를 기준으로 스터디를 시작할 수 있습니다.')+
 '<div class="tp-profile">'+bookCover(b)+'<div><small>'+esc([b.grade,b.subject||'수학'].filter(Boolean).join(' · '))+'</small>'+
 '<h3>'+esc(coachNameForBook(b))+'</h3><p>'+esc(b.publisher||'')+'</p></div></div>'+
 panel('<strong>학습 방향</strong><p>교재의 개념을 이해하고, 질문과 복습을 통해 스스로 문제를 해결하도록 돕는 수업 흐름입니다.</p>'+
 tags(['개념 이해','질문·답변','오답 복습','학교별 학습 연결']))+
 actions([bt('이 선생님으로 스터디 만들기','createFromBook',b.id,true),
 goBtn('초대받은 스터디 참여','groupJoin')])+
 (qualified.length?panel('<strong>내가 참여 중인 이 교재의 스터디</strong>'+
 qualified.map(g=>'<div class="tp-small-row"><span>'+esc(g.name)+'</span>'+bt('열기','selectGroup',g.id)+'</div>').join('')):'')+
 '<p class="tp-note">현재 교재 전문 AI 모델의 실제 학습 완료 여부는 검증되지 않았습니다. 이 화면은 코치와 스터디 연결 UI입니다.</p>'+
 '</section>';
}
function createGroup(){
 const b=selectedBook(),grade=b?.grade||'중2',subject=b?.subject||'수학';
 return '<section class="tp-app">'+heading('스터디 만들기','학교·학원, 학년, 과목과 교재를 지정합니다.')+
 panel('<form id="tp-group-create-form" class="tp-form">'+
 '<label>학교 또는 학원<select name="institutionType">'+
 '<option value="school">학교</option><option value="academy">학원</option></select></label>'+
 '<label>학교·학원 이름<input name="institutionName" maxlength="100" placeholder="예: 등촌고등학교 또는 ○○수학학원" required /></label>'+
 '<label>학년<select name="grade">'+['초5','초6','중1','중2','중3','고1','고2','고3'].map(v=>'<option value="'+v+'"'+(v===grade?' selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
 '<label>과목<select name="subject">'+['수학','영어','국어','과학','사회','기타'].map(v=>'<option'+(v===subject?' selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
 '<label>문제집<select id="tp-create-book" name="bookId"><option value="">교재 선택</option>'+
 [...catalog,...customBooks()].map(v=>'<option value="'+esc(v.id)+'"'+(b?.id===v.id?' selected':'')+'>'+esc(v.name)+'</option>').join('')+'</select></label>'+
 '<label>스터디 이름<input name="name" maxlength="70" placeholder="예: 등촌고 2학년 수학" required /></label>'+
 '<label>학습 범위 (선택)<input name="topics" maxlength="120" placeholder="예: 중간고사 대비 1~3단원" /></label>'+
 '<button type="submit" class="tp-btn primary">스터디 개설</button></form>'+
 '<p class="tp-note">가입 인원 및 초대 기능은 스터디 관리에서 확인합니다. 다른 기기와의 실시간 회원 동기화는 아직 연결되지 않았습니다.</p>')+
 '</section>';
}
function joinGroup(){
 return '<section class="tp-app">'+heading('스터디 참여','초대받은 스터디에 참여합니다.')+
 panel('<form id="tp-join-form" class="tp-form"><label>초대 코드<input name="code" maxlength="40" placeholder="초대 코드 입력" required autocomplete="off" /></label>'+
 '<button type="submit" class="tp-btn primary">코드 확인</button></form>'+
 '<p class="tp-note">현재는 이 브라우저에 등록된 스터디의 코드만 확인할 수 있습니다. 다른 기기에서 실제 가입하는 서버 기능은 미연결입니다.</p>')+
 goBtn('내 스터디로 돌아가기','groups')+'</section>';
}
function currentGroupHero(g,includeSwitcher=true){
 const b=bookFor(g);
 return (includeSwitcher?selectGroupControl():'')+
 '<div class="tp-group-head"><small>'+esc(placeContext(g)||'스터디')+'</small><h2>'+esc(g.name)+'</h2></div>'+
 '<div class="tp-hero-coach"><span class="tp-teacher-mark large">AI</span><div class="tp-hero-text">'+
 '<strong>'+esc(groupMatchesBook(g)?coachFor(g):'AI 선생님을 설정해 주세요')+'</strong>'+
 '<small>'+esc(b?.name||'담당 교재 미설정')+'</small></div></div>';
}
function groupDetail(){
 const g=active();if(!g)return groupIndex();
 const tasks=(model.tasks||[]).filter(t=>t.groupId===g.id&&!t.done),exams=(model.exams||[]).filter(v=>v.groupId===g.id&&v.date>=today()).sort((a,b)=>a.date.localeCompare(b.date));
 const docs=(model.materials[g.id]||[]);
 const ready=groupMatchesBook(g);
 const quick=ready?bt('AI 선생님에게 질문하기','openChat',g.id,true):bt('AI 선생님 설정하기','setupTutor',g.id,true);
 return '<section class="tp-app">'+currentGroupHero(g)+
 panel(actions([quick,goBtn('숙제·미션 확인','groupLearning')]),'tp-cta')+
 '<div class="tp-panel tp-info">'+
 '<strong>오늘의 학습</strong>'+
 (tasks.length?tasks.slice(0,2).map(t=>'<div class="tp-small-row"><span>'+esc(t.title)+'</span>'+bt('확인','learningTab','assignments')+'</div>').join(''):
 '<p class="tp-subtle">등록된 미완료 과제가 없습니다.</p>')+
 (exams[0]?'<p class="tp-subtle">예정 시험 · '+esc(exams[0].title)+' ('+esc(exams[0].date)+')</p>':'')+'</div>'+
 '<div class="tp-three-actions">'+[
 ['숙제·미션','assignments'],['자료','materials'],['시험','exams']
 ].map(([label,id])=>bt(label,'learningTab',id)).join('')+'</div>'+
 panel('<strong>학습 도구</strong>'+actions([
 ready&&catalogMap.has(g.bookId)?bt('문제풀이','practice',g.id):'',
 ready&&catalogMap.has(g.bookId)?bt('오답 복습','mistakes',g.id):'',
 goBtn('학교별 족보','bankSearch')
 ].filter(Boolean)))+
 panel('<strong>스터디 관리</strong>'+actions([
 goBtn('공동 공부방','groupLiveRoom'),goBtn('자료 전체','groupMaterials'),
 goBtn('일정','calendar'),goBtn('구성원','groupMembers'),goBtn('그룹 대화','groupMessages'),
 goBtn('설정','groupSettings')
 ]),'tp-manage')+
 '</section>';
}
function questionIndex(){
 const rows=model.groups.filter(g=>groupMatchesBook(g)).filter(g=>{
  const q=(ui.chatListQuery||'').toLocaleLowerCase(),s=ui.chatSubject;
  return (s==='전체'||g.subject===s)&&(!q||(g.name+' '+coachFor(g)+' '+placeContext(g)).toLocaleLowerCase().includes(q));
 }).sort((a,b)=>(getTeacherQuery(b).slice(-1)[0]?.at||0)-(getTeacherQuery(a).slice(-1)[0]?.at||0));
 const subjects=['전체',...new Set(model.groups.map(g=>g.subject).filter(Boolean))];
 return '<section class="tp-app">'+heading('질문하기','내 스터디의 AI 선생님을 선택해 주세요.')+
 '<form id="tp-chat-search-form" class="tp-search"><input name="q" value="'+esc(ui.chatListQuery)+'" placeholder="선생님·학교·과목 검색" aria-label="AI 선생님 검색" /><button type="submit">검색</button></form>'+
 '<div class="tp-chips">'+subjects.map(s=>bt(s,'chatSubject',s,ui.chatSubject===s)).join('')+'</div>'+
 '<div class="tp-group-list">'+(rows.length?rows.map(g=>{
  const recent=getTeacherQuery(g).slice(-1)[0];
  return '<button class="tp-chat-item" type="button" data-tp="openChat" data-value="'+esc(g.id)+'">'+
  '<span class="tp-teacher-mark">AI</span><span class="tp-chat-meta"><small>'+esc(placeContext(g)||g.name)+'</small>'+
  '<strong>'+esc(coachFor(g))+'</strong><small>'+esc(recent?.text?.slice(0,65)||g.name)+'</small></span><span class="tp-chevron">›</span></button>';
 }).join(''):empty('표시할 AI 선생님이 없습니다.','스터디에서 교재와 AI 선생님을 설정하거나 새 스터디에 참여해 주세요.',goBtn('내 스터디 보기','groups',true)))+'</div></section>';
}
function ruleReply(g,message){
 const s=message.trim(),subject=g.subject||'과목';
 if(/기출|중간고사|기말고사|내신|시험범위|학교 시험|출제/.test(s)){
  const next=(model.exams||[]).find(e=>e.groupId===g.id);
  return '학교별 시험 자료를 확인하고 진행하겠습니다. '+(next?'등록된 시험은 '+next.title+'('+next.date+')입니다. ':'')+
   '현재 학교의 공식 출제범위나 기출문항 원문은 연결되지 않았습니다. 확보하신 시험범위·자료를 올려 주시면 해당 조건부터 정리해 보겠습니다.';
 }
 if(/숙제|미션|과제/.test(s)){
  const tasks=(model.tasks||[]).filter(t=>t.groupId===g.id&&!t.done);
  return tasks.length?'현재 등록된 미완료 과제는 '+tasks.slice(0,2).map(t=>t.title).join(', ')+'입니다. 어떤 부분에서 막히셨는지 알려 주시겠습니까?':
    '아직 등록된 과제가 없습니다. 오늘 연습하고 싶은 단원이나 어려운 부분을 말씀해 주시겠습니까?';
 }
 if(/답만|정답만|빨리 답/.test(s))return '바로 정답을 제시하기보다 먼저 조건을 함께 확인해 보겠습니다. 문제에서 무엇을 구해야 하는지 말씀해 주시겠습니까?';
 if(/모르|어렵|이해|헷갈/.test(s))return subject+'에서 이미 알고 있는 부분과 막히는 부분을 나누어 보겠습니다. 어떤 단계까지 직접 설명하실 수 있습니까?';
 if(/다른|설명|왜|원리/.test(s))return '다른 관점으로 접근해 보겠습니다. 주어진 조건과 찾으려는 값을 먼저 구분해 보시겠습니까?';
 return '말씀하신 질문을 확인했습니다. '+(g.topics?'현재 학습 범위는 '+g.topics+'입니다. ':'')+
 '먼저 문제의 조건 또는 생각하신 풀이 과정을 한 단계씩 설명해 주시겠습니까?';
}
function teacherChat(){
 const g=active();if(!g)return groupIndex();
 if(!groupMatchesBook(g))return '<section class="tp-app">'+currentGroupHero(g)+empty('먼저 AI 선생님을 설정해 주세요.','해당 스터디의 문제집이 아직 지정되지 않았습니다.',bt('교재 선택','setupTutor',g.id,true))+'</section>';
 const history=getChatRecord(g);
 return '<section class="tp-app tp-chat-page">'+
 '<div class="tp-chat-top">'+bt('‹ 선생님 목록','route','groupQuestions')+
 '<div class="tp-chat-top-details"><strong>'+esc(coachFor(g))+'</strong><small>'+esc(placeContext(g))+'</small></div></div>'+
 '<div class="tp-chat-history" aria-label="AI 선생님과 개인 대화 기록">'+
 (history.length?history.map(m=>'<div class="tp-bubble '+(m.role==='student'?'student':'teacher')+'"><small>'+(m.role==='student'?'나':'AI 선생님')+'</small><p>'+esc(m.text)+'</p></div>').join(''):
 '<div class="tp-welcome"><strong>무엇이 궁금하신가요?</strong><p>'+esc(bookFor(g)?.name||'선택 교재')+' 학습과 '+esc(g.institutionName||'학교')+' 수업에 관한 질문을 남겨보세요.</p></div>')+'</div>'+
 '<div class="tp-topic-tools">'+
 bt('현재 숙제','chatQuick','숙제')+
 bt('시험 준비','chatQuick','시험')+
 (catalogMap.has(g.bookId)?bt('문제풀이','practice',g.id):'')+
 goBtn('자료','groupLearning')+
 '</div>'+
 '<form id="tp-chat-compose" class="tp-compose"><label class="tp-visually-hidden" for="tp-question">질문 입력</label>'+
 '<textarea id="tp-question" name="question" rows="3" maxlength="1600" required placeholder="궁금한 내용을 입력하세요."></textarea>'+
 '<button class="tp-btn primary" type="submit">질문</button></form>'+
 '<p class="tp-note">이 대화는 현재 그룹과 이 브라우저의 학생별 기록으로 구분됩니다. 생성형 AI·교재 원문·사진 해석은 아직 연결되지 않아 규칙형 응답만 제공합니다.</p>'+
 '</section>';
}
function studyTabs(tab){
 return '<nav class="tp-study-tabs" aria-label="학습 메뉴">'+[
 ['assignments','숙제·미션'],['materials','자료'],['exams','시험']
 ].map(([k,n])=>bt(n,'learningTab',k,tab===k)).join('')+'</nav>';
}
function studyPage(){
 const g=active();if(!g)return groupIndex();
 const tab=ui.learningTab,taskList=(model.tasks||[]).filter(t=>t.groupId===g.id),docs=model.materials[g.id]||[];
 const exams=(model.exams||[]).filter(e=>e.groupId===g.id).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 let content='';
 if(tab==='assignments'){
  content=(taskList.length?taskList.map(t=>'<div class="tp-learning-row">'+
   bt(t.done?'✓':'○','toggleTask',t.id)+
   '<div><strong'+(t.done?' class="tp-done"':'')+'>'+esc(t.title)+'</strong><small>'+esc(t.assignee||'나')+' · '+esc(t.date||'')+'</small></div></div>').join(''):
   empty('등록된 숙제·미션이 없습니다.'))+
   actions([bt('숙제·미션 추가','toggleForm','assignments',true)])+
   (ui.formMode==='assignments'?'<form id="tp-task-form" class="tp-form">'+
    '<label>과제명<input name="title" maxlength="120" required placeholder="숙제 또는 미션"/></label>'+
    '<label>담당 학생<input name="assignee" maxlength="40" value="나"/></label>'+
    '<label>마감일<input type="date" name="date" value="'+today()+'"/></label>'+
    '<button class="tp-btn primary" type="submit">과제 저장</button></form>':'');
 }else if(tab==='materials'){
  content=(docs.length?docs.map(d=>'<div class="tp-learning-row"><span class="tp-file-icon">▤</span>'+
   '<div><strong>'+esc(d.title||'학습자료')+'</strong><small>'+esc(d.unit||d.site||'그룹 자료')+'</small>'+
   (d.text?'<p>'+esc(d.text.slice(0,350))+'</p>':'')+'</div></div>').join(''):
   empty('아직 등록된 학습자료가 없습니다.'))+
   actions([bt('자료 직접 등록','toggleForm','materials',true),goBtn('학교별 족보','bankSearch')])+
   (ui.formMode==='materials'?'<form id="tp-material-form" class="tp-form">'+
    '<label>자료 제목<input name="title" maxlength="120" required placeholder="예: 1단원 오답노트"/></label>'+
    '<label>내용<textarea name="text" rows="4" maxlength="3500" required></textarea></label>'+
    '<button class="tp-btn primary" type="submit">자료 저장</button></form>':'');
 }else{
  content=(exams.length?exams.map(e=>'<div class="tp-learning-row"><span class="tp-file-icon">◷</span><div><strong>'+esc(e.title)+'</strong>'+
   '<small>'+esc(e.date||'')+' · '+esc(e.scope||'시험범위 미등록')+'</small></div></div>').join(''):
   empty('등록된 시험 일정이 없습니다.'))+
   actions([bt('시험 일정 등록','toggleForm','exams',true),goBtn('족보에서 자료 찾기','bankSearch')])+
   (ui.formMode==='exams'?'<form id="tp-exam-form" class="tp-form">'+
    '<label>시험명<input name="title" maxlength="120" required placeholder="예: 2학기 중간고사"/></label>'+
    '<label>시험범위<input name="scope" maxlength="300" placeholder="예: 1~3단원"/></label>'+
    '<label>시험일<input type="date" name="date" value="'+today()+'" required/></label>'+
    '<button class="tp-btn primary" type="submit">시험 저장</button></form>':'');
 }
 return '<section class="tp-app">'+selectGroupControl()+heading('학습',g.name)+
 '<div class="tp-study-teacher"><span class="tp-teacher-mark">AI</span><div><strong>'+esc(groupMatchesBook(g)?coachFor(g):'담당 교재 미설정')+'</strong>'+
 '<small>'+esc(placeContext(g))+'</small></div>'+bt('질문','openChat',g.id)+'</div>'+
 studyTabs(tab)+panel(content)+
 '<p class="tp-note">실제 AI 자동 과제 배정과 시험 채점은 연결되지 않았습니다. 등록한 내용은 이 브라우저에서 보관됩니다.</p>'+
 '</section>';
}
function groupSettings(){
 const g=active();if(!g)return groupIndex();
 return '<section class="tp-app">'+selectGroupControl()+heading('스터디 설정',g.name)+
 panel('<strong>학습 기준</strong>'+
 '<div class="tp-small-row"><span>학교·학원</span><strong>'+esc(labelInstitution(g))+'</strong></div>'+
 '<div class="tp-small-row"><span>학년·과목</span><strong>'+esc([g.grade,g.subject].filter(Boolean).join(' · '))+'</strong></div>'+
 '<div class="tp-small-row"><span>담당 교재</span><strong>'+esc(bookFor(g)?.name||'미지정')+'</strong></div>'+
 '<div class="tp-small-row"><span>AI 선생님</span><strong>'+esc(groupMatchesBook(g)?coachFor(g):'미지정')+'</strong></div>'+
 (!g.coachId?actions([bt('AI 선생님 설정','setupTutor',g.id,true)]):'<p class="tp-subtle">이 스터디의 교재와 AI 선생님은 고정됩니다. 다른 교재를 이용하려면 새 스터디를 만드세요.</p>'))+
 panel('<strong>스터디 관리</strong>'+
 '<form id="tp-settings-form" class="tp-form"><label>스터디 이름<input name="name" maxlength="70" required value="'+esc(g.name)+'"/></label>'+
 '<label>학습범위<input name="topics" maxlength="150" value="'+esc(g.topics||'')+'"/></label>'+
 '<button class="tp-btn primary" type="submit">변경사항 저장</button></form>')+
 panel('<strong>참여 및 초대</strong><div class="tp-small-row"><span>현재 구성원</span><strong>'+g.members.length+'명</strong></div>'+
 '<div class="tp-small-row"><span>그룹 코드</span><strong>'+esc(g.inviteCode||'아직 발급되지 않음')+'</strong></div>'+
 actions([bt('이 기기용 초대 코드 발급','generateInvite',g.id),goBtn('멤버 관리','groupMembers')])+
 '<p class="tp-note">초대 코드는 현재 브라우저 내 등록된 그룹 확인용입니다. 실시간 초대·가입은 별도 서버가 필요합니다.</p>')+
 '</section>';
}
function tutorSettings(){
 const g=active();if(!g)return groupIndex();
 if(groupMatchesBook(g))return '<section class="tp-app">'+heading('담당 AI 선생님',g.name)+
 panel('<strong>'+esc(coachFor(g))+'</strong><p>'+esc(bookFor(g)?.name||'')+'</p>'+
 '<p>이 스터디의 교재·AI 선생님은 변경되지 않습니다. 다른 교재는 새 스터디를 만들어 이용해 주세요.</p>')+goBtn('스터디로','groupDetail')+'</section>';
 return '<section class="tp-app">'+heading('AI 선생님 설정',g.name)+
 panel('<p class="tp-subtle">기존 스터디의 교재를 한 번 지정합니다.</p>'+
 '<form id="tp-set-teacher-form" class="tp-form"><label>교재<select name="bookId" required>'+
 '<option value="">교재 선택</option>'+[...catalog,...customBooks()].map(b=>'<option value="'+esc(b.id)+'"'+(b.id===ui.selectedBook?' selected':'')+'>'+esc(b.name)+'</option>').join('')+
 '</select></label><button type="submit" class="tp-btn primary">선생님 연결</button></form>')+
 goBtn('교재 찾아보기','groupAITutor')+'</section>';
}
function groupTalk(){
 const g=active();if(!g)return groupIndex();
 const messages=model.chats[g.id]||[];
 return '<section class="tp-app">'+selectGroupControl()+heading('그룹 대화',g.name)+
 '<div class="tp-chat-history">'+(messages.length?messages.slice(-35).map(m=>'<div class="tp-bubble"><small>'+esc(m.by||'구성원')+'</small><p>'+esc(m.text)+'</p></div>').join(''):
 empty('아직 그룹 대화가 없습니다.'))+'</div>'+
 '<form id="tp-group-talk" class="tp-compose"><label class="tp-visually-hidden" for="tp-talk">그룹 메시지</label>'+
 '<textarea name="text" id="tp-talk" rows="2" maxlength="700" required placeholder="그룹원에게 메시지 남기기"></textarea>'+
 '<button class="tp-btn primary" type="submit">등록</button></form>'+
 '<p class="tp-note">그룹 메시지는 현재 브라우저에만 기록됩니다. 실제 멤버에게 전송되지는 않습니다.</p>'+
 '</section>';
}
function currentRoute(id){
 if(id==='groups'||id==='groupSearch')return groupIndex();
 if(id==='groupAITutor')return teacherFinder();
 if(id==='groupBookDetail'||id==='groupCoachProfile')return profile();
 if(id==='groupCreate')return createGroup();
 if(id==='groupJoin')return joinGroup();
 if(id==='groupDetail')return groupDetail();
 if(id==='groupQuestions')return questionIndex();
 if(id==='groupTeacherChat')return teacherChat();
 if(id==='groupMessages')return groupTalk();
 if(id==='groupLearning')return studyPage();
 if(id==='groupSettings')return groupSettings();
 if(id==='groupTutorSettings')return tutorSettings();
 return null;
}
const oldGroup=groupPage,oldBottom=bottomFor;
groupPage=function(id){return currentRoute(id)??oldGroup(id)};
bottomFor=function(id){
 if(id==='groupQuestions'||id==='groupTeacherChat'||id==='groupMessages')return oldBottom('groupQuestions');
 if(id==='groupLearning')return oldBottom('groupLearning');
 if(['groupAITutor','groupBookDetail','groupCoachProfile'].includes(id))return oldBottom('groupAITutor');
 if(['groups','groupSearch','groupCreate','groupJoin','groupDetail','groupSettings','groupTutorSettings'].includes(id))return oldBottom('groups');
 return oldBottom(id);
};
function updateRoute(route){ui.formMode='';go(route)}
function practice(gid,route){
 const g=gById(gid);if(!g)return;
 selectGroup(g.id);
 if(!catalogMap.has(g.bookId)){toast('이 교재는 실제 연습문제가 연결되지 않았습니다.');return;}
 LIB.setBook(g.bookId);updateRoute(route);
}
function action(name,val){
 const g=active();
 if(name==='route'){updateRoute(val);return}
 if(name==='groupFilter'){ui.groupType=val;render();return}
 if(name==='filterSubject'){ui.subject=val;render();return}
 if(name==='chatSubject'){ui.chatSubject=val;render();return}
 if(name==='chooseBook'){if(!bookById(val))return;ui.selectedBook=val;LIB.setBook(val);updateRoute('groupCoachProfile');return}
 if(name==='createFromBook'){if(!bookById(val))return;ui.selectedBook=val;updateRoute('groupCreate');return}
 if(name==='selectGroup'){selectGroup(val,'groupDetail');return}
 if(name==='openChat'){selectGroup(val,'groupTeacherChat');return}
 if(name==='setupTutor'){selectGroup(val,'groupTutorSettings');return}
 if(name==='practice'){practice(val,'groupPractice');return}
 if(name==='mistakes'){practice(val,'groupMistakes');return}
 if(name==='learningTab'){ui.learningTab=['assignments','materials','exams'].includes(val)?val:'assignments';ui.formMode='';updateRoute('groupLearning');return}
 if(name==='toggleForm'){ui.formMode=ui.formMode===val?'':val;render();return}
 if(name==='chatQuick'){const e=document.getElementById('tp-question');if(e){e.value=val==='숙제'?'오늘 숙제 중 어떤 것을 해야 하나요?':'이번 시험 대비는 무엇부터 시작해야 하나요?';e.focus()}return}
 if(name==='toggleTask'){
  const t=model.tasks.find(t=>t.id===val&&t.groupId===g?.id);if(!t)return;t.done=!t.done;save();render();return;
 }
 if(name==='generateInvite'){if(!g||g.id!==val)return;g.inviteCode=g.inviteCode||('ST-'+Math.random().toString(36).slice(2,8).toUpperCase());save();render();return}
}
function registeredBook(name,subject,grade){
 const match=customBooks().find(b=>b.name===name&&b.subject===subject&&b.grade===grade);
 if(match)return match;
 const b={id:id('manualbook'),name,subject,grade,publisher:'직접 등록',manual:true,verifiedCover:false,image:''};
 model.customBooks.push(b);save();return b;
}
function forms(form){
 const data=new FormData(form);
 const v=k=>String(data.get(k)||'').trim();
 const g=active();
 if(form.id==='tp-catalog-search-form'){ui.query=v('q');render();return}
 if(form.id==='tp-group-search-form'){ui.groupQuery=v('q');render();return}
 if(form.id==='tp-chat-search-form'){ui.chatListQuery=v('q');render();return}
 if(form.id==='tp-register-book'){
  if(!v('name')||!v('subject')||!v('grade'))return;
  const b=registeredBook(v('name').slice(0,100),v('subject'),v('grade'));ui.selectedBook=b.id;updateRoute('groupCoachProfile');return;
 }
 if(form.id==='tp-group-create-form'){
  const name=v('name'),inst=v('institutionName'),grade=v('grade'),subject=v('subject'),book=bookById(v('bookId'));
  if(!name||!inst||!grade||!subject||!book){toast('학교·학년·과목·교재를 모두 지정해 주세요.');return}
  if(book.subject!==subject||book.grade!==grade){toast('교재의 학년·과목이 스터디 설정과 일치해야 합니다.');return}
  const group={
   id:id('group'),name:name.slice(0,70),institutionType:v('institutionType')==='academy'?'academy':'school',
   institutionName:inst.slice(0,100),school:v('institutionType')==='academy'?'':inst.slice(0,100),
   grade,subject,topics:v('topics').slice(0,120),members:['나'],example:false,
   bookId:book.id,bookTitle:book.name,coachId:'coach:'+book.id,coachName:coachNameForBook(book),
   bookShelf:[book.id]
  };
  model.groups.push(group);model.activeGroupId=group.id;save();
  if(catalogMap.has(book.id))LIB.setBook(book.id);
  updateRoute('groupDetail');return;
 }
 if(form.id==='tp-join-form'){
  const g=model.groups.find(g=>g.inviteCode&&g.inviteCode.toUpperCase()===v('code').toUpperCase());
  if(!g){toast('현재 기기에 등록된 초대 코드를 찾을 수 없습니다.');return}
  if(!g.members.includes('나')){
   if(g.members.length>=5){toast('이 스터디는 참여 인원이 찼습니다.');return}
   g.members.push('나');
  }
  model.activeGroupId=g.id;save();updateRoute('groupDetail');return;
 }
 if(form.id==='tp-chat-compose'){
  if(!g||!groupMatchesBook(g))return;
  const q=v('question').slice(0,1600);if(!q)return;
  const messages=getChatRecord(g);
  messages.push({id:id('q'),role:'student',text:q,at:time()});
  messages.push({id:id('a'),role:'teacher',text:ruleReply(g,q),mode:'rule-demo',at:time()});
  if(messages.length>150)messages.splice(0,messages.length-150);
  save();render();
  const history=document.querySelector('#phone .tp-chat-history');if(history)history.scrollTop=history.scrollHeight;
  return;
 }
 if(form.id==='tp-group-talk'){
  if(!g||!v('text'))return;
  (model.chats[g.id]||(model.chats[g.id]=[])).push({by:'나',text:v('text').slice(0,700),at:new Date().toLocaleTimeString('ko-KR')});
  save();render();return;
 }
 if(form.id==='tp-task-form'){
  if(!g||!v('title'))return;
  model.tasks.unshift({id:id('task'),groupId:g.id,title:v('title').slice(0,120),date:v('date')||today(),
  assignee:v('assignee')||'나',done:false,source:'student'});
  ui.formMode='';save();render();return;
 }
 if(form.id==='tp-material-form'){
  if(!g||!v('title')||!v('text'))return;
  (model.materials[g.id]||(model.materials[g.id]=[])).push({
   id:id('material'),title:v('title').slice(0,120),text:v('text').slice(0,3500),kind:'note',
   site:g.institutionName||'',bookId:g.bookId,unit:g.topics||'',source:'student'});
  ui.formMode='';save();render();return;
 }
 if(form.id==='tp-exam-form'){
  if(!g||!v('title')||!v('date'))return;
  model.exams.push({id:id('exam'),groupId:g.id,title:v('title').slice(0,120),
  scope:v('scope').slice(0,300),date:v('date')});ui.formMode='';save();render();return;
 }
 if(form.id==='tp-settings-form'){
  if(!g||!v('name'))return;g.name=v('name').slice(0,70);g.topics=v('topics').slice(0,150);save();updateRoute('groupDetail');return;
 }
 if(form.id==='tp-set-teacher-form'){
  if(!g||groupMatchesBook(g))return;
  const book=bookById(v('bookId'));if(!book)return;
  if(g.grade&&g.grade!==book.grade||g.subject&&g.subject!==book.subject){toast('스터디의 학년·과목과 일치하는 교재를 선택해 주세요.');return}
  g.grade=g.grade||book.grade;g.subject=g.subject||book.subject;
  g.bookId=book.id;g.bookTitle=book.name;g.coachId='coach:'+book.id;g.coachName=coachNameForBook(book);
  g.bookShelf=[...new Set([...(g.bookShelf||[]),book.id])];save();
  if(catalogMap.has(book.id))LIB.setBook(book.id);
  updateRoute('groupDetail');return;
 }
}
document.addEventListener('click',ev=>{
 const b=ev.target.closest('#phone [data-tp]');if(!b)return;
 ev.preventDefault();ev.stopImmediatePropagation();action(b.dataset.tp,b.dataset.value||'');
},true);
document.addEventListener('submit',ev=>{
 const form=ev.target;if(!form.id?.startsWith('tp-'))return;
 ev.preventDefault();ev.stopImmediatePropagation();forms(form);
},true);
document.addEventListener('change',ev=>{
 const t=ev.target;if(!t?.dataset?.tpSelect)return;
 const type=t.dataset.tpSelect;
 if(type==='group'){selectGroup(t.value);return}
 if(type==='catalogGrade'){ui.grade=t.value;render();return}
},true);
window.HITEL_TUTOR_PLATFORM={
 getModel:()=>model,
 getCurrentGroup:()=>active(),
 getCoach:g=>g?{bookId:g.bookId,coachId:g.coachId,coachName:coachFor(g)}:null,
 getChat:gid=>getTeacherQuery(gById(gid)||{id:'none'}).slice(),
 getState:()=>({screen:state.screen,groupId:active()?.id,groupCount:model.groups.length,
 groupCoach:active()?.coachId||'',bookId:active()?.bookId||'',teacherCount:model.groups.filter(groupMatchesBook).length,
 serverShared:false,llmConnected:false,mode:'BROWSER_LOCAL'})
};
const requested=new URLSearchParams(location.search);
if(PAGES[requested.get('screen')])state.screen=requested.get('screen');
if(requested.get('group')&&gById(requested.get('group')))model.activeGroupId=requested.get('group');
if(['groupBookDetail','groupCoachProfile'].includes(state.screen)&&requested.get('book')&&bookById(requested.get('book')))ui.selectedBook=requested.get('book');
save();render();
})();