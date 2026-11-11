/* HITEL goal-based study groups and daily challenge journeys.
   Browser-local interaction; genuine multi-user sync/LLM is not connected. */
(function(){
'use strict';
const WP=window.HITEL_WORKPLACE_BRIDGE;
if(!WP||!window.YPT_GRAPH)return;
const model=WP.getModel(),oldPage=groupPage,oldNav=bottomFor;
const DBKEY='hitel.education.challenge-v1',TKEY='hitel.education.trainers-v1';
const SUBJECTS=['수학','국어','영어','과학','사회','한국사','정보','기타'];
const GOALS=['학교 내신','문제집 완성','선행학습','경시대회','특목고 입시','수능·모의고사','독해·논술','자유 목표'];
let db=load(DBKEY,{groups:{}}),savedTrainers=load(TKEY,[]);
if(!db.groups)db.groups={};if(!Array.isArray(savedTrainers))savedTrainers=[];
const ui={day:'',mode:'discover',index:0,choice:-1,result:''};
function load(k,f){try{return JSON.parse(localStorage.getItem(k)||'null')||f}catch(e){return f}}
function store(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){console.warn(e);return false}}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function iso(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
const today=()=>iso(new Date());
function date(s){let d=new Date(String(s)+'T12:00:00');return isNaN(d.getTime())?new Date():d}
function plus(s,n){let d=date(s);d.setDate(d.getDate()+n);return iso(d)}
function diff(a,b){return Math.round((date(a)-date(b))/86400000)}
const current=()=>model.groups.find(g=>g.id===model.activeGroupId)||model.groups[0]||null;
const start=g=>g.courseStart||today();
const days=g=>Math.max(3,Math.min(60,Number(g.courseDays)||10));
const subject=g=>String(g.subject||'수학').split(/[,·/]/)[0].trim()||'수학';
const goal=g=>g.goalTitle||g.topics||g.name||'학습 목표 완성';
const dayNo=(g,d)=>diff(d,start(g))+1;
function activeDate(g){if(!ui.day||dayNo(g,ui.day)<1||dayNo(g,ui.day)>days(g))ui.day=dayNo(g,today())>=1&&dayNo(g,today())<=days(g)?today():start(g);return ui.day}
function item(id,text,options,answer,hint,tag){return{id,text,options,answer,hint,tag}}
const qMath={
 discover:[
 item('d1','해가 2와 3인 이차방정식은?',['x² − 5x + 6 = 0','x² + 5x + 6 = 0','x² − 6x + 5 = 0'],0,'(x − 2)(x − 3)을 먼저 만들어 보세요.','규칙 발견'),
 item('d2','(x − 4)(x + 1) = 0의 두 근은?',['4와 −1','−4와 1','4와 1'],0,'두 인수 중 하나가 0이 되는 경우를 생각해 보세요.','개념 검증')],
 practice:[
 item('p1','x² − 5x + 6 = 0의 해는?',['2와 3','−2와 −3','1과 6'],0,'합이 5이고 곱이 6인 수를 찾아보세요.','유형 돌파'),
 item('p2','x² − 9 = 0의 해는?',['−3과 3','0과 9','3과 9'],0,'(x−3)(x+3)=0으로 바꿔 보세요.','유형 돌파')],
 apply:[
 item('a1','두 근이 −1과 4인 이차방정식은?',['x² − 3x − 4 = 0','x² + 3x − 4 = 0','x² − 4x − 1 = 0'],0,'(x+1)(x−4)를 전개하세요.','실전 응용'),
 item('a2','(x − 2)(x + 5) = 0의 두 근의 합은?',['−3','3','7'],0,'근 2와 −5를 더해 보세요.','실전 응용')],
 bonus:item('bo','x² + x − 6 = 0의 두 근은?',['−3과 2','−2와 3','−6과 1'],0,'곱이 −6이고 합이 −1인 수를 찾으세요.','맞춤 보너스'),
 boss:item('boss','두 근이 2와 −5이고 최고차항 계수가 2인 방정식은?',['2x² + 6x − 20 = 0','2x² − 6x − 20 = 0','x² + 3x − 10 = 0'],0,'(x−2)(x+5)를 만들고 2를 곱하세요.','보스 챌린지')
};
const smallBanks={
 국어:[item('k1','“독서는 지식을 넓히지만 비판적 사고가 필요하다.”의 중심 생각은?',['비판적으로 읽어야 한다','독서는 무익하다','지식은 사고를 방해한다'],0,'‘하지만’ 뒤에 주목하세요.','독해'),item('k2','“발이 넓다”는 무슨 뜻입니까?',['아는 사람이 많다','걸음이 빠르다','발이 크다'],0,'관용 표현을 생각해 보세요.','어휘')],
 영어:[item('e1','She ___ to school every day.',['goes','go','going'],0,'현재시제의 3인칭 단수입니다.','문법'),item('e2','I have lived here ___ 2020.',['since','for','during'],0,'시작 시점을 나타냅니다.','문법')],
 과학:[item('s1','상태가 변해도 보존되는 것은?',['질량','부피가 항상 동일','온도가 항상 동일'],0,'입자 수에 주목하세요.','개념'),item('s2','전류의 단위는?',['암페어','볼트','옴'],0,'전압과 전류의 단위를 구별하세요.','기초')],
 사회:[item('c1','수요 증가, 공급 일정이면 균형 가격은 일반적으로?',['상승','하락','불변'],0,'사려는 사람이 많아집니다.','경제'),item('c2','삼권분립의 주된 목적은?',['권력 집중 방지','권력 독점 강화','투표 폐지'],0,'국가 권력 간 견제를 생각하세요.','정치')]
};
const STAGES=[{id:'discover',name:'해에서 원리 찾아내기',tag:'STAGE 01 · 규칙 발견',ico:'◇'},{id:'practice',name:'핵심 유형 돌파',tag:'STAGE 02 · 문제 돌파',ico:'✎'},{id:'apply',name:'숨은 조건을 찾아라',tag:'STAGE 03 · 응용',ico:'◎'}];
function questions(g,k){
 if(subject(g)==='수학')return k==='bonus'?[qMath.bonus]:k==='boss'?[qMath.boss]:qMath[k]||qMath.practice;
 const x=smallBanks[subject(g)]||smallBanks.사회;
 if(k==='bonus'||k==='boss')return[Object.assign({},x[k==='bonus'?0:1],{id:k})];
 return x.map((q,i)=>Object.assign({},q,{id:k+'-'+i}));
}
function record(g,d){
 if(!db.groups[g.id])db.groups[g.id]={};
 if(!db.groups[g.id][d])db.groups[g.id][d]={solved:[],wrong:[],bonus:false,boss:false};
 return db.groups[g.id][d];
}
function tally(g,d,k){const r=record(g,d);return questions(g,k).filter(q=>r.solved.includes(k+':'+q.id)).length}
function stageDone(g,d,k){return tally(g,d,k)>=questions(g,k).length}
function dailyDone(g,d){return STAGES.every(s=>stageDone(g,d,s.id))}
function dayScore(g,d){const x=record(g,d);return(dailyDone(g,d)?100:0)+(x.bonus?60:0)+(x.boss?500:0)}
function totalPoints(g){const x=db.groups[g.id]||{};return Object.keys(x).reduce((v,d)=>v+dayScore(g,d),0)}
function courseCount(g){let n=0;for(let i=0;i<days(g);i++)if(dailyDone(g,plus(start(g),i)))n++;return n}
function trainerList(){
 const out=new Map();
 for(const t of savedTrainers)if(t.id&&t.subject)out.set(t.id,t);
 for(const g of model.groups)if(g.coachId&&!out.has(g.trainerId||g.coachId))out.set(g.trainerId||g.coachId,{id:g.trainerId||g.coachId,name:g.coachName||subject(g)+' AI 트레이너',subject:subject(g)});
 return [...out.values()];
}
function trainerName(g){return g.coachName||trainerList().find(t=>t.id===g.trainerId)?.name||'트레이너 미지정'}
function btn(text,action,value,cls){return '<button type="button" class="hj-btn '+(cls||'')+'" data-hj="'+esc(action)+'" data-value="'+esc(value||'')+'">'+text+'</button>'}
function nav(text,route,cls){return btn(esc(text),'route',route,cls)}
function prog(p){return '<div class="hj-progress"><i style="width:'+Math.min(100,Math.max(0,p))+'%"></i></div>'}
function header(title,sub,back){return '<header class="hj-heading">'+(back?nav('‹ 돌아가기',back,'hj-quiet'):'')+'<h2>'+esc(title)+'</h2>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</header>'}
function tile(g){
 const d=today(),n=STAGES.filter(s=>stageDone(g,d,s.id)).length;
 return '<button class="hj-group" data-hj="group" data-value="'+esc(g.id)+'"><div class="hj-between"><span class="hj-pill">'+esc((g.goalType||'공동학습')+' · '+subject(g))+'</span><small>'+(g.members?.length||1)+'/5명</small></div><b>'+esc(g.name)+'</b><p>'+esc(trainerName(g))+' · '+esc(goal(g))+'</p>'+prog(n/3*100)+'<div class="hj-between"><small>오늘 '+n+'/3단계 완료</small><small>반 입장 ›</small></div></button>'
}
function main(){
 const joined=model.groups.filter(g=>g.members?.includes('나')),own=trainerList().length;
 const solved=joined.reduce((n,g)=>n+STAGES.reduce((s,k)=>s+tally(g,today(),k.id),0),0);
 const material=joined.reduce((n,g)=>n+(model.materials?.[g.id]||[]).length,0);
 return '<section class="hj"><div class="hj-brand"><span class="hj-brand-icon">✧</span><div><strong>HITEL 교육</strong><small>AI 공동학습 플랫폼</small></div>'+btn('＋ 반 만들기','route','groupCreate','hj-black hj-mini')+'</div>'+
 header('스터디그룹','목표가 같은 친구들과 함께 공부하세요.')+
 '<div class="hj-summary"><small>나의 공동학습</small><b>가입한 반 '+joined.length+'개 · AI 트레이너 '+own+'개</b><div class="hj-metrics"><button data-hj="route" data-value="groupLearning"><small>오늘 해결한 문제</small><strong>'+solved+'</strong><small>단계별 풀이</small></button><button data-hj="route" data-value="groupLearningResources"><small>공동 학습자료</small><strong>'+material+'건</strong><small>그룹 공유 자료</small></button></div></div>'+
 '<div class="hj-between hj-section"><strong>내가 참여한 반</strong>'+nav('반 찾기 ›','groupSearch','hj-quiet')+'</div>'+
 (joined.length?joined.map(tile).join(''):'<div class="hj-empty">아직 참여한 반이 없습니다.</div>')+
 '<div class="hj-between hj-section"><strong>목표별 추천 스터디</strong>'+nav('전체 보기 ›','groupSearch','hj-quiet')+'</div>'+
 '<div class="hj-recommend">'+btn('♜<b>수학 경시대회반</b><small>KMO · 스터디 찾기</small>','route','groupSearch')+
 btn('▤<b>비문학 독해반</b><small>국어 · 스터디 찾기</small>','route','groupSearch')+'</div></section>';
}
function create(){
 return '<section class="hj">'+header('새 스터디그룹','반을 개설한 다음 담당 트레이너를 지정합니다.','groups')+
 '<form id="hj-create" class="hj-form">'+
 '<label>반 이름<input name="name" maxlength="70" required placeholder="예: 중3 수학 이차방정식 완성반"></label>'+
 '<div class="hj-formrow"><label>구분<select name="institutionType"><option value="school">학교</option><option value="academy">학원</option></select></label><label>학년<select name="grade">'+['초4','초5','초6','중1','중2','중3','고1','고2','고3','제한 없음'].map(x=>'<option>'+x+'</option>').join('')+'</select></label></div>'+
 '<label>학교·학원명<input name="institutionName" maxlength="100" required placeholder="학교 또는 학원명"></label>'+
 '<div class="hj-formrow"><label>과목<select name="subject">'+SUBJECTS.map(x=>'<option>'+x+'</option>').join('')+'</select></label><label>학습 목표<select name="goalType">'+GOALS.map(x=>'<option>'+x+'</option>').join('')+'</select></label></div>'+
 '<label>완성할 목표<input name="goalTitle" maxlength="150" required placeholder="예: 쎈 수학 C단계 완성"></label>'+
 '<label>학습 범위<input name="topics" maxlength="150" placeholder="단원·범위 (선택)"></label>'+
 '<div class="hj-formrow"><label>시작일<input type="date" name="courseStart" value="'+today()+'" required></label><label>코스 기간<select name="courseDays">'+[5,7,10,14,21,30].map(n=>'<option value="'+n+'"'+(n===10?' selected':'')+'>'+n+'일</option>').join('')+'</select></label></div>'+
 '<label>교재 (선택)<input name="bookTitle" maxlength="120" placeholder="반 개설 후에도 등록할 수 있습니다."></label>'+
 '<p class="hj-muted">교재 구매나 트레이너 선택 없이 반부터 만들 수 있습니다.</p>'+
 '<button type="submit" class="hj-btn hj-black hj-wide">반 개설 후 트레이너 선택 →</button></form></section>';
}
function trainers(){
 const g=current();if(!g)return main();
 const items=trainerList().filter(t=>t.subject===subject(g));
 return '<section class="hj">'+header('AI 트레이너 선택',g.name,'groupDetail')+
 '<div class="hj-panel"><small>이 반의 과목</small><b>'+esc(subject(g))+'</b><p>같은 과목이면 학년·교재·목표에 관계없이 트레이너를 다시 사용할 수 있습니다.</p></div>'+
 '<div class="hj-section"><strong>사용 가능한 트레이너</strong></div>'+
 (items.length?items.map(t=>'<button type="button" class="hj-trainer" data-hj="trainer" data-value="'+esc(t.id)+'"><span>AI</span><div><b>'+esc(t.name)+'</b><small>'+esc(t.subject)+' · 기존 트레이너 재사용</small></div><i>선택 ›</i></button>').join(''):'<div class="hj-empty">이 과목으로 등록된 트레이너가 없습니다.</div>')+
 '<form id="hj-trainer-create" class="hj-form hj-panel"><b>새 트레이너 프로필 등록</b><label>트레이너 이름<input name="name" required maxlength="70" placeholder="예: 수학 AI 트레이너 A"></label><button type="submit" class="hj-btn hj-outline hj-wide">등록 후 지정</button><p class="hj-muted">프로필 등록은 실제 AI 서비스 가입이나 결제와 다릅니다.</p></form>'+
 nav('트레이너 지정 없이 반으로 돌아가기','groupDetail','hj-outline hj-wide')+'</section>';
}
function schedule(g,d){
 let n=dayNo(g,d)-1,range=Math.min(days(g),7),offset=Math.min(Math.max(0,n-3),Math.max(0,days(g)-range)),out='<div class="hj-calendar">';
 for(let i=offset;i<offset+range;i++){
  const dt=plus(start(g),i),dateObj=date(dt);
  out+='<button type="button" data-hj="day" data-value="'+dt+'" class="'+(d===dt?'chosen':'')+'"'+(dt>today()?' disabled':'')+'><small>'+['일','월','화','수','목','금','토'][dateObj.getDay()]+'</small><b>'+dateObj.getDate()+'</b><em>'+(dailyDone(g,dt)?'✓':dt===today()?'●':'·')+'</em></button>';
 }
 return out+'</div>';
}
function stageCard(g,d,s,i){
 const n=tally(g,d,s.id),total=questions(g,s.id).length,locked=i>0&&!stageDone(g,d,STAGES[i-1].id),complete=n===total;
 return '<button data-hj="stage" data-value="'+s.id+'" type="button" class="hj-stage"'+(locked?' disabled':'')+'><span class="hj-stage-icon">'+(complete?'✓':locked?'○':s.ico)+'</span><div><small>'+s.tag+'</small><b>'+s.name+'</b><p>'+(complete?'완료':locked?'앞 단계 해결 후 시작':n?n+'/'+total+'문제 해결 · 이어서 진행':'단계별 문제를 해결하세요.')+'</p></div><span>›</span></button>';
}
function journey(){
 const g=current();if(!g)return main();
 const d=activeDate(g),done=dailyDone(g,d),step=STAGES.filter(x=>stageDone(g,d,x.id)).length;
 const doneDays=courseCount(g);
 return '<section class="hj">'+header(g.name,(g.institutionName||g.school||'스터디')+' · '+(g.grade||'')+' · '+subject(g),'groups')+
 '<div class="hj-between"><span class="hj-pill">'+esc(g.goalType||'목표형 공동학습')+'</span><small>'+(g.members?.length||1)+'/5명</small></div>'+
 '<div class="hj-panel hj-course"><div class="hj-between"><div><small>진행 중인 문제 코스</small><b>'+esc(goal(g))+'</b></div><small>DAY '+Math.max(1,dayNo(g,today()))+'/'+days(g)+'</small></div>'+prog(doneDays/days(g)*100)+'<div class="hj-between"><small>전체 진행률</small><small>'+doneDays+'/'+days(g)+'일</small></div></div>'+
 '<div class="hj-between hj-section"><strong>학습 스케줄</strong><small>'+esc(d.slice(5))+'</small></div>'+
 schedule(g,d)+
 '<div class="hj-between hj-section"><div><strong>'+(d===today()?'오늘의 여정':'선택한 날의 코스')+'</strong><small>'+esc(goal(g))+'</small></div><span class="hj-pill">'+(done?'완료':'진행 '+step+'/3')+'</span></div>'+
 STAGES.map((s,i)=>stageCard(g,d,s,i)).join('')+
 '<div class="hj-bonus"><div class="hj-between"><b>✦ 맞춤 도전</b><strong>+60 P</strong></div><p>'+esc(record(g,d).wrong.length?'틀렸던 유형을 다시 해결해 보세요.':'기존 풀이 기록에 맞는 추가 문제에 도전할 수 있습니다.')+'</p>'+
 btn(record(g,d).bonus?'도전 완료 ✓':'보너스 도전 →','extra','bonus','hj-outline hj-wide')+'</div>'+
 (done?'<div class="hj-boss"><div class="hj-between"><small>★ SPECIAL CHALLENGE</small><b>+500 P</b></div><h3>최종 관문 · 보스 챌린지</h3><p>오늘의 필수 코스를 모두 해결했습니다. 자유롭게 고난도 문제에 도전하세요.</p>'+
 btn(record(g,d).boss?'보스 해결 완료 ✓':'보스 챌린지 도전 →','extra','boss','hj-bossbtn hj-wide')+'</div>':
 '<div class="hj-locked">♛ 필수 코스를 해결하면 특별 도전이 열립니다.</div>')+
 '<div class="hj-between hj-pts"><small>누적 포인트</small><strong>'+totalPoints(g).toLocaleString('ko-KR')+' P</strong></div>'+
 '<div class="hj-teacher"><span>AI</span><div><b>'+esc(trainerName(g))+'</b><small>문제별 힌트 · 풀이 피드백 · 진행 관리</small></div>'+nav('변경','groupTrainerSelect','hj-quiet')+'</div>'+
 '<div class="hj-section"><strong>우리 반</strong></div><div class="hj-links">'+nav('미션','groupMissionJourney')+nav('자료','groupLearningResources')+nav('시험','groupLearningExams')+nav('족보','bankSearch')+nav('공부방','groupLiveRoom')+nav('대화','groupMessages')+nav('일정','calendar')+nav('멤버·설정','groupSettings')+'</div>'+
 '<p class="hj-muted">초기 문제는 검증용 문항입니다. 생성형 AI 출제·다른 기기 동기화는 아직 연결되지 않았습니다.</p></section>';
}
function openProblem(mode){
 const g=current(),d=activeDate(g);if(!g||d>today())return;
 const i=STAGES.findIndex(s=>s.id===mode);
 if(i>0&&!stageDone(g,d,STAGES[i-1].id)){toast('앞 단계를 먼저 해결해 주세요.');return}
 if(mode==='boss'&&!dailyDone(g,d)){toast('필수 코스 완료 후 도전할 수 있습니다.');return}
 ui.mode=mode;ui.index=0;ui.choice=-1;ui.result='';
 if(i>=0){const n=questions(g,mode).findIndex(q=>!record(g,d).solved.includes(mode+':'+q.id));ui.index=n<0?0:n}
 go('groupMissionPlay');
}
function player(){
 const g=current();if(!g)return main();const qs=questions(g,ui.mode),q=qs[ui.index]||qs[0];
 const label=ui.mode==='bonus'?'맞춤 도전':ui.mode==='boss'?'보스 챌린지':STAGES.find(x=>x.id===ui.mode)?.name||'문제';
 return '<section class="hj">'+
 '<div class="hj-between">'+nav('‹ 코스로 돌아가기','groupDetail','hj-quiet')+'<small>'+esc(label)+' · '+(ui.index+1)+'/'+qs.length+'</small></div>'+
 prog((ui.index+1)/qs.length*100)+'<div class="hj-between hj-section"><strong>'+esc(q.tag)+'</strong><span class="hj-pill">'+(ui.mode==='boss'?'+500 P':ui.mode==='bonus'?'+60 P':'필수 코스')+'</span></div>'+
 '<div class="hj-question"><h2>'+esc(q.text)+'</h2><p>알맞은 답을 선택하세요.</p></div>'+
 '<div class="hj-choices">'+q.options.map((v,i)=>'<button type="button" data-hj="choice" data-value="'+i+'" class="'+(ui.choice===i?'chosen ':'')+(ui.result==='correct'&&ui.choice===i?'correct':'')+'"'+(ui.result==='correct'?' disabled':'')+'><span>'+String.fromCharCode(65+i)+'</span>'+esc(v)+'</button>').join('')+'</div>'+
 (ui.result==='wrong'?'<div class="hj-feedback">다시 생각해 보세요. '+esc(q.hint)+'</div>':'')+
 (ui.result==='hint'?'<div class="hj-feedback">'+esc(q.hint)+'</div>':'')+
 (ui.result==='correct'?'<div class="hj-feedback right">정답입니다. 문제를 해결했습니다.</div>'+btn(ui.index+1<qs.length?'다음 문제 →':'미션 결과 보기 →','next','','hj-black hj-wide'):
 btn('정답 확인','check','','hj-black hj-wide')+btn('힌트 보기','hint','','hj-quiet hj-wide'))+
 '<p class="hj-muted">풀이 결과와 획득 점수는 현재 브라우저에 저장됩니다.</p></section>';
}
function checkAnswer(){
 const g=current(),d=activeDate(g),q=questions(g,ui.mode)[ui.index];
 if(!q||ui.choice<0){toast('답을 선택해 주세요.');return}
 const r=record(g,d);
 if(ui.choice!==q.answer){ui.result='wrong';r.wrong.push({id:q.id,tag:q.tag,at:today()});store(DBKEY,db);render();return}
 ui.result='correct';
 if(ui.mode==='bonus')r.bonus=true;
 else if(ui.mode==='boss')r.boss=true;
 else if(!r.solved.includes(ui.mode+':'+q.id))r.solved.push(ui.mode+':'+q.id);
 store(DBKEY,db);render();
}
function trainerHub(){
 return '<section class="hj">'+header('AI 과외','사용 중인 AI 트레이너와 교재별 학습 도구','groups')+
 '<div class="hj-section"><strong>내 AI 트레이너</strong></div>'+
 (trainerList().length?trainerList().map(t=>'<div class="hj-trainer"><span>AI</span><div><b>'+esc(t.name)+'</b><small>'+esc(t.subject)+' · 연결된 반에서 사용</small></div></div>').join(''):'<div class="hj-empty">등록된 트레이너가 없습니다.</div>')+
 '<div class="hj-section"><strong>내 스터디</strong></div>'+
 model.groups.map(g=>tile(g)).join('')+
 nav('기존 교재별 AI 과외·문제집 검색','groupTutorCatalog','hj-outline hj-wide')+
 '<p class="hj-muted">기존 문제집 책장·문제풀이·오답 복습 기능은 보존됩니다.</p></section>';
}
function learning(){
 const g=current();if(!g)return main();
 return '<section class="hj">'+header('학습',g.name,'groups')+
 '<div class="hj-panel"><small>진행 중인 문제 코스</small><b>'+esc(goal(g))+'</b>'+prog(courseCount(g)/days(g)*100)+nav('오늘의 코스 이어하기 →','groupDetail','hj-black hj-wide')+'</div>'+
 '<div class="hj-links">'+nav('미션','groupMissionJourney')+nav('공동 자료','groupLearningResources')+nav('시험·평가','groupLearningExams')+nav('학교별 족보','bankSearch')+'</div>'+
 '<p class="hj-muted">기존 자료·시험·과제 데이터는 유지됩니다.</p></section>';
}
function resources(){
 const g=current();if(!g)return main();
 const items=model.materials?.[g.id]||[];
 return '<section class="hj">'+header('공동 학습자료',g.name,'groupDetail')+
 '<div class="hj-between hj-section"><strong>자료함</strong><small>'+items.length+'건</small></div>'+
 (items.length?items.slice(-50).reverse().map(it=>'<div class="hj-panel"><b>'+esc(it.title||'학습자료')+'</b>'+(it.photo&&it.photo.startsWith('data:image/jpeg;base64,')?'<img class="hj-photo" src="'+it.photo+'" alt="'+esc(it.title||'학습 사진')+'">':'')+(it.text?'<p>'+esc(it.text.slice(0,450))+'</p>':'')+'</div>').join(''):'<div class="hj-empty">아직 등록된 자료가 없습니다.</div>')+
 '<form id="hj-material" class="hj-form hj-panel"><b>자료 등록</b><label>제목<input name="title" maxlength="120" required></label><label>메모<textarea name="text" rows="3" maxlength="2500"></textarea></label><label>풀이·필기 사진 (선택)<input name="image" type="file" accept="image/*"></label><button type="submit" class="hj-btn hj-black hj-wide">자료 저장</button></form>'+
 '<p class="hj-muted">현재 공유 자료는 브라우저에 저장됩니다. 실제 학생 간 서버 공유는 미연결입니다.</p></section>';
}
function exams(){
 const g=current();if(!g)return main();
 const items=(model.exams||[]).filter(e=>e.groupId===g.id);
 return '<section class="hj">'+header('시험·평가',g.name,'groupDetail')+
 '<div class="hj-between hj-section"><strong>시험 일정</strong><small>'+items.length+'건</small></div>'+
 (items.length?items.map(e=>'<div class="hj-panel"><b>'+esc(e.title)+'</b><p>'+esc(e.date||'')+' · '+esc(e.scope||'범위 미등록')+'</p></div>').join(''):'<div class="hj-empty">등록된 시험 일정이 없습니다.</div>')+
 '<form id="hj-exam" class="hj-form hj-panel"><b>시험 등록</b><label>시험명<input name="title" maxlength="120" required></label><label>범위<input name="scope" maxlength="300"></label><label>시험일<input name="date" type="date" value="'+today()+'" required></label><button type="submit" class="hj-btn hj-black hj-wide">저장</button></form></section>';
}
const routes={groupMissionJourney:'학습 코스',groupMissionPlay:'문제 풀기',groupTrainerSelect:'AI 트레이너',groupTutorCatalog:'교재별 AI 과외',groupLearningResources:'공동 학습자료',groupLearningExams:'시험·평가'};
for(const[k,v]of Object.entries(routes)){window.YPT_GRAPH[k]={title:v,evidence:[],actions:[{text:'스터디그룹',go:'groups'}]};if(GROUPS['스터디 그룹'])GROUPS['스터디 그룹'].push(k)}
groupPage=function(route){
 if(route==='groups')return main();
 if(route==='groupCreate')return create();
 if(route==='groupDetail'||route==='groupMissionJourney')return journey();
 if(route==='groupMissionPlay')return player();
 if(route==='groupTrainerSelect')return trainers();
 if(route==='groupAITutor')return trainerHub();
 if(route==='groupTutorCatalog')return oldPage('groupAITutor');
 if(route==='groupLearning')return learning();
 if(route==='groupLearningResources')return resources();
 if(route==='groupLearningExams')return exams();
 return oldPage(route);
};
bottomFor=function(route){
 if(['groupMissionJourney','groupMissionPlay','groupLearningResources','groupLearningExams'].includes(route))return oldNav('groupLearning');
 if(route==='groupTrainerSelect')return oldNav('groups');
 if(route==='groupTutorCatalog')return oldNav('groupAITutor');
 return oldNav(route);
};
function assign(tid){
 const g=current(),t=trainerList().find(t=>t.id===tid);
 if(!g||!t||t.subject!==subject(g)){toast('같은 과목의 트레이너만 선택할 수 있습니다.');return}
 g.trainerId=t.id;g.coachId=t.id;g.coachName=t.name;WP.saveModel();go('groupDetail');
}
function makeGroup(f){
 const d=new FormData(f),v=k=>String(d.get(k)||'').trim();if(!v('name')||!v('institutionName')||!v('goalTitle'))return;
 const type=v('institutionType')==='academy'?'academy':'school',id='group-'+uid();
 model.groups.push({id,name:v('name'),institutionType:type,institutionName:v('institutionName'),school:type==='school'?v('institutionName'):'',grade:v('grade'),subject:v('subject'),goalType:v('goalType'),goalTitle:v('goalTitle'),topics:v('topics'),courseStart:v('courseStart')||today(),courseDays:Number(v('courseDays'))||10,bookId:'',bookTitle:v('bookTitle'),bookShelf:[],coachId:'',coachName:'',trainerId:'',members:['나'],example:false,localDirectoryVisible:false});
 model.activeGroupId=id;WP.saveModel();ui.day=v('courseStart')||today();go('groupTrainerSelect');
}
async function materialSave(f){
 const g=current();if(!g)return;
 const d=new FormData(f),title=String(d.get('title')||'').trim();if(!title)return;
 const file=f.querySelector('input[type=file]')?.files?.[0];let photo='';
 if(file){
  if(!file.type.startsWith('image/')){toast('이미지 파일만 등록할 수 있습니다.');return}
  try{
   const bitmap=await createImageBitmap(file),can=document.createElement('canvas'),ratio=Math.min(1,900/bitmap.width);
   can.width=Math.round(bitmap.width*ratio);can.height=Math.round(bitmap.height*ratio);
   can.getContext('2d').drawImage(bitmap,0,0,can.width,can.height);
   photo=can.toDataURL('image/jpeg',.6);bitmap.close?.();
   if(photo.length>850000){toast('이미지 용량이 너무 큽니다.');return}
  }catch(e){toast('사진을 처리할 수 없습니다.');return}
 }
 if(!model.materials[g.id])model.materials[g.id]=[];
 model.materials[g.id].push({id:'mat-'+uid(),title,text:String(d.get('text')||'').slice(0,2500),photo,unit:'그룹 자료'});
 WP.saveModel();go('groupLearningResources');
}
document.addEventListener('click',e=>{
 const b=e.target.closest('#phone button[data-hj]');if(!b)return;
 e.preventDefault();e.stopPropagation();const a=b.dataset.hj,v=b.dataset.value||'';
 if(a==='route'){go(v);return}
 if(a==='group'){const g=model.groups.find(g=>g.id===v);if(!g)return;model.activeGroupId=g.id;WP.saveModel();ui.day=today();go('groupDetail');return}
 if(a==='trainer'){assign(v);return}
 if(a==='day'){ui.day=v;render();return}
 if(a==='stage'||a==='extra'){openProblem(v);return}
 if(a==='choice'){if(ui.result!=='correct'){ui.choice=Number(v);ui.result='';render()}return}
 if(a==='hint'){ui.result='hint';render();return}
 if(a==='check'){checkAnswer();return}
 if(a==='next'){const q=questions(current(),ui.mode);if(ui.index+1>=q.length)go('groupDetail');else{ui.index++;ui.choice=-1;ui.result='';render()}return}
});
document.addEventListener('submit',e=>{
 const f=e.target;if(!f.id?.startsWith('hj-'))return;
 e.preventDefault();e.stopImmediatePropagation();
 if(f.id==='hj-create'){makeGroup(f);return}
 if(f.id==='hj-trainer-create'){
  const g=current(),name=String(new FormData(f).get('name')||'').trim();if(!g||!name)return;
  const t={id:'trainer-'+uid(),name,subject:subject(g)};savedTrainers.push(t);store(TKEY,savedTrainers);assign(t.id);return
 }
 if(f.id==='hj-exam'){const g=current(),d=new FormData(f);if(!g)return;model.exams.push({id:'exam-'+uid(),groupId:g.id,title:String(d.get('title')||''),scope:String(d.get('scope')||''),date:String(d.get('date')||today())});WP.saveModel();go('groupLearningExams');return}
 if(f.id==='hj-material')materialSave(f);
});
window.HITEL_JOURNEY_INSPECT=()=>({screen:state.screen,groupId:current()?.id||'',groupCount:model.groups.length,trainerCount:trainerList().length,points:current()?totalPoints(current()):0,serverShared:false,llmQuestionGeneration:false});
render();
})();