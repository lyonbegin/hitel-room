/* HITEL learning coach UI integration.
 * Benchmark patterns: Solve/ORZO problem reader and correction,
 * MathFLAT unit and similar-problem flow, MathKing adaptive status,
 * QANDA/Photomath photo intake, Khanmigo/Brilliant Koji guided question
 * pattern, Brilliant interactive steps, Bookmory/Libby notes and resume,
 * BookFusion annotations. Independent practice templates, not publisher text.
 * Rules-based local demonstrator; explicitly NOT connected to a generative LLM.
 */
(function(){
'use strict';
const B=window.HITEL_BOOKSHELF_BRIDGE;
if(!B)return;
const KEY='hitel.education.coach-suite.v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const now=()=>Date.now();
const date=ts=>new Date(ts||now()).toLocaleDateString('ko-KR');
const uid=()=>now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
const initial=()=>({selected:'',filters:'all',seed:{},attempts:[],coach:{},drafts:{},manual:[],uploads:{},drawings:{},favorites:[],startTime:now(),view:'list'});
let x;
try{x=Object.assign(initial(),JSON.parse(localStorage.getItem(KEY)||'null')||{});}catch(_){x=initial()}
for(const key of ['seed','coach','drafts','uploads','drawings'])if(!x[key]||typeof x[key]!=='object')x[key]={};
for(const key of ['attempts','manual','favorites'])if(!Array.isArray(x[key]))x[key]=[];
const store=()=>{try{localStorage.setItem(KEY,JSON.stringify({...x,uploads:{}}));}catch(_){}}; // images are session-only
let sheetCanvas=null,paint=false,lastPoint=null;
function book(){return B.currentBook()}
function unit(){return B.currentUnit()}
function group(){return B.getGroup()}
function key(){return book().id+'|'+B.currentUnitIndex()}
function formButton(label,action,value='',extra=''){
 return '<button type="button" class="cs-btn '+extra+'" data-cs="'+esc(action)+'" data-value="'+esc(value)+'">'+esc(label)+'</button>';
}
function card(s){return '<section class="cs-card">'+s+'</section>'}
function header(title,subtitle=''){
 const b=book(),g=group();
 return '<div class="cs-heading"><div><span class="cs-eyebrow">'+esc(b.name)+' · '+esc(unit())+'</span><h3>'+esc(title)+'</h3>'+
 (subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div></div>'+
 '<nav class="cs-subnav" aria-label="과외 학습 메뉴">'+[
 ['groupPractice','문제풀이'],['groupCoach','코치'],['groupMistakes','오답'],['groupCoachDashboard','학습기록']
 ].map(([id,t])=>'<button type="button" data-cs="route" data-value="'+id+'" class="'+(state.screen===id||state.screen==='groupProblemDetail'&&id==='groupPractice'?'current':'')+'">'+t+'</button>').join('')+'</nav>'+
 '<div class="cs-book-ctx"><span>현재 그룹 <strong>'+esc(g?.name||'개인')+'</strong></span>'+formButton('교재 바꾸기','route','groupAITutor')+'</div>';
}
function chapterMeta(){return '<div class="cs-scope">'+formButton('‹ 교재 상세','route','groupBookDetail')+
 '<span>'+esc(unit())+'</span>'+formButton('단원 변경','route','groupBookDetail')+'</div>'}
const safeInt=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.trunc(Number(v)||0)));
/* Generate mathematically valid independent sample questions, never original workbook content. */
function templateFor(index,variant=0){
 const label=unit(),b=book(),stage=safeInt(index,0,5),n=safeInt(variant,0,1000);
 const ofs=(n%4),pad=stage%3,lev=stage<2?'기초':stage<4?'유형':'도전';
 let question,answer,hints,steps,story,concept,kind='number',title;
 if(/이차방정식/.test(label)){
   const a=2+pad+ofs,c=3+((stage+ofs)%4),sum=a+c,product=a*c;
   question='x² − '+sum+'x + '+product+' = 0 의 모든 해를 작은 수부터 차례대로 입력하세요.';
   answer=[a,c].sort((u,v)=>u-v).join(',');kind='pair';
   hints=['직사각형의 변 길이를 알아내려는 상황에서 출발해 봅니다. 어떤 두 수가 필요한가요?',
   '두 해의 합은 '+sum+', 곱은 '+product+'입니다.',
   '곱해서 '+product+'이면서 더해서 '+sum+'이 되는 두 수를 찾아보세요.'];
   steps=['합이 '+sum+', 곱이 '+product+'인 두 수를 찾습니다.','('+ 'x−'+a+')('+ 'x−'+c+')=0 으로 인수분해합니다.','x='+a+' 또는 x='+c+'입니다.'];
   story='옛 수학자들은 땅의 넓이와 변의 조건에서 미지의 길이를 알아내려 했습니다. 오늘의 식도 그 질문을 바탕으로 생각해 보겠습니다.';
   concept='두 수의 합과 곱을 이용한 이차방정식';
 }else if(/연립/.test(label)){
   const a=2+pad+ofs,c=4+((stage+ofs)%3);question='x+y='+(a+c)+', x−y='+(a-c)+'를 동시에 만족하는 x,y를 입력하세요.';
   answer=a+','+c;kind='pair';
   hints=['두 조건을 동시에 만족해야 합니다. 한 식만으로 충분할까요?','두 식을 더하면 y항이 없어집니다.','2x='+(2*a)+'이므로 x를 구하고 x+y 식에 대입해 보세요.'];
   steps=['두 식을 더하면 2x='+(2*a)+'입니다.','x='+a+'입니다.','y='+(a+c)+'−'+a+'='+c+'입니다.'];
   story='물건 두 종류의 개수를 알 수 없을 때 서로 다른 조건을 결합하면 답을 찾을 수 있습니다.';
   concept='두 조건을 한꺼번에 해결하는 연립방정식';
 }else if(/함수/.test(label)){
   const slope=2+pad,intercept=1+ofs,input=2+stage;
   question='y='+slope+'x+'+intercept+'일 때 x='+input+'에서 y의 값을 구하세요.';
   answer=String(slope*input+intercept);
   hints=['x값이 정해졌다면 식에 무엇을 대입할 수 있을까요?','x를 '+input+'으로 바꾸어 보세요.',''+slope+'×'+input+'+'+intercept+'을 계산해 보세요.'];
   steps=['x='+input+'을 대입합니다.','y='+slope+'×'+input+'+'+intercept+'입니다.','결과는 '+answer+'입니다.'];
   story='시간이 흐름에 따라 쌓이는 거리처럼, 한 값이 변할 때 다른 값이 어떻게 달라지는지 살펴봅니다.';
   concept='입력과 출력 사이의 규칙';
 }else if(/부등식/.test(label)){
   const k=2+pad+ofs,z=4+stage;
   question='x+'+k+' > '+(k+z)+' 를 풀어 x의 범위를 쓰세요.';
   answer='x>'+z;kind='ineq';
   hints=['등호가 아니라 크기 비교입니다. 좌우에 같은 수를 빼면 어떻게 될까요?','두 변에서 '+k+'를 빼 보세요.','x > '+(k+z)+'−'+k+' 로 정리해 보세요.'];
   steps=['x+'+k+' > '+(k+z)+'입니다.','양쪽에서 '+k+'를 뺍니다.','x > '+z+'입니다.'];
   story='어떤 기준보다 더 크거나 작은 값을 찾을 때는 정확한 하나의 답이 아니라 범위가 필요합니다.';
   concept='가능한 수의 범위';
 }else if(/다항식|인수분해/.test(label)){
   const a=2+pad+ofs,c=1+(stage%3),d=3+ofs,e=1+pad;
   question='(' +a+'x+'+d+') − ('+c+'x−'+e+') 를 정리하세요.';
   answer=(a-c)+'x+'+(d+e);kind='expression';
   hints=['괄호 앞의 − 기호가 두 번째 괄호 안에 어떤 영향을 주나요?','−('+c+'x−'+e+')를 전개하면 −'+c+'x+'+e+'가 됩니다.','x항끼리, 상수항끼리 모아 보세요.'];
   steps=['괄호를 풀어 '+a+'x+'+d+'−'+c+'x+'+e+'로 씁니다.','x항끼리 모으고 상수항끼리 모읍니다.','답은 '+answer+'입니다.'];
   story='여러 가지 수량을 한 번에 표현하기 위해 수학자들은 문자와 연산 규칙을 발전시켰습니다.';
   concept='다항식의 항 결합';
 }else if(/순환소수|유리수|제곱근/.test(label)){
   const den=2+((stage+ofs)%3),num=1+pad;
   question=num+'/'+den+'을 분수의 형태로 그대로 입력하세요.';
   answer=num+'/'+den;kind='fraction';
   hints=['분수는 전체를 같은 크기로 나눈 부분을 나타냅니다.','분자는 '+num+', 분모는 '+den+'입니다.','분자/분모 형식으로 입력하세요.'];
   steps=['분자는 '+num+'입니다.','분모는 '+den+'입니다.','답은 '+answer+'입니다.'];
   story='고대 사람들은 물건을 공평하게 나누거나 측정한 양을 나타내기 위해 분수를 사용했습니다.';
   concept='분수의 의미';
 }else{
   const a=2+pad+ofs,z=3+stage;
   question='x+'+a+'='+(a+z)+' 일 때 x의 값을 구하세요.';
   answer=String(z);
   hints=['양쪽에 똑같은 연산을 하면 등식은 유지됩니다.','양쪽에서 '+a+'를 빼 보세요.','x='+(a+z)+'−'+a+'를 계산해 보세요.'];
   steps=['x+'+a+'='+(a+z)+'입니다.','양쪽에서 '+a+'를 뺍니다.','x='+z+'입니다.'];
   story='알지 못하는 수를 기호로 놓으면 수를 직접 찾지 않고도 관계를 표현할 수 있습니다.';
   concept='미지수와 등식';
 }
 title=(pad===0?'원리 확인':pad===1?'유형 적용':'새로운 조건')+' '+String(stage+1).padStart(2,'0');
 return {id:key()+'|'+stage,key:key(),index:stage,title,level:lev,question,answer,hints,steps,story,concept,kind,unit:label,bookId:b.id};
}
function generated(){return Array.from({length:6},(_,i)=>templateFor(i,x.seed[key()+'|'+i]||0))}
function manualProblems(){return x.manual.filter(v=>v.key===key()).map(v=>({...v,kind:'manual',title:v.title||'직접 등록한 문제',level:'내 문제',hints:[],steps:[],story:'',concept:''}))}
function allProblems(){return [...generated(),...manualProblems()]}
function selected(){const list=allProblems(),v=list.find(z=>z.id===x.selected)||list[0];if(v)x.selected=v.id;return v;}
function attempts(id){return x.attempts.filter(a=>a.problemId===id)}
function mistakeIds(){return [...new Set(x.attempts.filter(a=>a.correct===false).map(a=>a.problemId))]}
function counts(){
 const a=x.attempts.filter(v=>v.bookId===book().id),ok=a.filter(v=>v.correct).length,bad=a.filter(v=>v.correct===false).length,review=mistakeIds().length;
 return {attempts:a.length,correct:ok,wrong:bad,review,rate:a.length?Math.round(100*ok/a.length):0};
}
function norm(s){return String(s??'').toLowerCase().replace(/[ \t\n\r]/g,'').replace(/−/g,'-').replace(/[（]/g,'(').replace(/[）]/g,')').replace(/²/g,'^2').replace(/[，]/g,',').replace(/;/g,',').replace(/또는/g,',').replace(/그리고/g,',').replace(/x=/g,'').replace(/y=/g,'').replace(/[\[\]{}]/g,'').replace(/(\d)\.0\b/g,'$1')}
function rightAnswer(p,value){
 if(p.kind==='manual')return null;
 if(p.kind==='pair'){
 const num=norm(value).match(/-?\d+(?:\.\d+)?/g)||[],sol=norm(p.answer).match(/-?\d+(?:\.\d+)?/g)||[];
 return num.length===2&&num.map(Number).sort((a,b)=>a-b).join(',')===sol.map(Number).sort((a,b)=>a-b).join(',');
 }
 let a=norm(value),z=norm(p.answer);
 if(p.kind==='ineq')return a===z;
 if(p.kind==='expression')return a===z||a.replace(/\+0$/,'')===z.replace(/\+0$/,'');
 return a===z;
}
function cstate(p){return x.coach[p.id]||(x.coach[p.id]={messages:[],hint:0,turns:0})}
function addCoach(p,by,text,kind='text'){
 const h=cstate(p);h.messages.push({by,text,kind,at:now()});if(h.messages.length>70)h.messages=h.messages.slice(-70);h.turns++;store();
}
function advise(p,msg){
 const h=cstate(p),lower=String(msg).trim().toLocaleLowerCase(),n=h.hint;
 if(!msg.trim())return '어떤 부분이 가장 궁금하신가요? 조건부터 하나씩 확인해 보겠습니다.';
 if(/정답|답만|해설|풀이전부/.test(lower)){
  return '정답을 바로 제시하기보다 먼저 스스로 찾을 수 있도록 도와드리겠습니다. '+(p.hints[Math.min(n,p.hints.length-1)]||'문제에 주어진 조건부터 정리해 보세요.');
 }
 if(/왜|역사|유래|처음|배경|수학자/.test(lower))return p.story+' 어떤 실생활의 질문이 지금 문제와 연결되는지 한 문장으로 설명해 보시겠습니까?';
 if(/힌트|모르|막혀|어려|도움/.test(lower)){
  h.hint=Math.min(p.hints.length-1,n+1);return (p.hints[h.hint]||'주어진 조건을 다시 나누어 살펴보세요.')+' 여기까지는 이해되셨습니까?';
 }
 if(/다른|방법|그림|표|그래프/.test(lower))return '다른 방법으로 생각해 보겠습니다. '+p.concept+'을 식이나 그림으로 바꾸면 어떤 관계가 드러날까요?';
 if(/맞|검산|확인/.test(lower))return '답을 원래 문제에 대입해 조건을 모두 만족하는지 확인해 보십시오. 그런 다음 오른쪽이 아닌 아래의 「답 제출」 기능으로 채점을 진행해 보세요.';
 if(/다음|변형|새문제|재도전/.test(lower))return '다른 숫자를 적용한 새 문제를 「비슷한 문제」에서 열어 보실 수 있습니다. 이번에는 힌트를 보지 않고 풀어 보세요.';
 if(p.kind==='manual')return '입력하신 문제의 자동 수식 인식은 아직 연결되지 않았습니다. 핵심 조건과 구하려는 값을 따로 써 보시겠습니까? 사진은 참고자료로만 표시됩니다.';
 return '말씀하신 내용을 바탕으로 질문을 한 단계 좁히겠습니다. '+(p.hints[Math.min(n,p.hints.length-1)]||'먼저 주어진 수량과 미지수를 구분해 주세요.')+' 어떻게 접근하시겠습니까?';
}
function startCoach(p){const h=cstate(p);if(h.messages.length)return;
 addCoach(p,'coach','먼저 이 문제를 풀어야 했던 이유부터 살펴보겠습니다. '+(p.story||'어떤 값을 알아내려는 문제일까요?')+' '+(p.concept||'주어진 조건')+'을 어떻게 설명하시겠습니까?');
}
function stat(){const a=counts();return '<div class="cs-stats">'+[
 ['풀어본 횟수',a.attempts],['정답',a.correct],['오답',a.wrong],['정답률',a.rate+'%']
 ].map(([t,v])=>'<div><b>'+v+'</b><small>'+t+'</small></div>').join('')+'</div>'}
function buttonsFor(p){return '<div class="cs-links">'+
 formButton('코치와 대화','route','groupCoach')+formButton('비슷한 문제','variant',p.id)+formButton('오답 복습','route','groupMistakes')+'</div>'}
function problemCard(p,detail=false){
 const a=attempts(p.id),ok=a.some(v=>v.correct),bad=a.some(v=>v.correct===false),saved=x.favorites.includes(p.id);
 return '<div class="cs-problem '+(detail?'cs-full':'')+'">'+
 '<div class="cs-problem-tags"><span>'+esc(p.level)+'</span><span>'+esc(p.title)+'</span>'+
 (ok?'<span class="cs-correct-tag">풀이 완료</span>':bad?'<span class="cs-wrong-tag">복습 대상</span>':'')+'</div>'+
 '<div class="cs-question">'+esc(p.question)+'</div>'+
 (detail?'':'<div class="cs-problem-actions">'+formButton('문제풀기','open',p.id,'primary')+
 formButton(saved?'저장됨 ★':'저장 ☆','favorite',p.id)+formButton('코치','openCoach',p.id)+'</div>')+
 '</div>';
}
function practiceList(){
 const all=allProblems(),miss=new Set(mistakeIds()),done=new Set(x.attempts.filter(a=>a.correct).map(a=>a.problemId));
 const list=all.filter(p=>x.filters==='all'||x.filters==='miss'&&miss.has(p.id)||x.filters==='done'&&done.has(p.id)||x.filters==='saved'&&x.favorites.includes(p.id)||x.filters==='new'&&!done.has(p.id));
 return header('문제풀이','교재별 단원을 선택하고 문제를 차례로 풀어보세요.')+
 chapterMeta()+stat()+
 card('<h4>문항 탐색</h4><div class="cs-filters">'+[
 ['all','전체'],['new','미완료'],['miss','오답'],['done','완료'],['saved','저장']
 ].map(([k,t])=>formButton(t,'filter',k,x.filters===k?'selected':'')).join('')+'</div>'+
 '<div class="cs-question-list">'+(list.length?list.map(p=>problemCard(p)).join(''):'<p class="cs-empty">해당 조건의 문제가 없습니다.</p>')+'</div></section>')+
 card('<h4>문제 직접 입력하기</h4><p class="cs-muted">시중 교재의 페이지·번호 또는 본인이 작성한 문제를 기록하고 풀 수 있습니다.</p>'+
 '<form id="cs-manual-form"><div class="cs-fields">'+
 '<label>문항 위치<input name="location" maxlength="60" placeholder="예: 32쪽 7번" required /></label>'+
 '<label>문제 내용<textarea name="question" maxlength="1800" placeholder="문제 내용을 직접 적어 주세요." required></textarea></label></div>'+
 '<button type="submit" class="cs-btn primary">내 문제에 추가</button></form>'+
 '<p class="cs-muted">직접 입력한 문제는 원본 교재 문항을 자동으로 불러오거나 채점하지 않습니다.</p></section>')+
 card('<h4>함께 공부하기</h4><div class="cs-links">'+formButton('학교별 족보','route','bankSearch')+
 formButton('그룹 자료','route','groupLearning')+formButton('그룹 질문','route','groupQuestions')+'</div></section>');
}
function canvasMarkup(p){
 return '<div class="cs-scratch"><div class="cs-scratch-head"><strong>손글씨 풀이 공간</strong>'+
 formButton('지우기','erase',p.id)+'</div>'+
 '<canvas id="cs-canvas" width="620" height="285" aria-label="손가락이나 펜으로 풀이를 적는 공간"></canvas>'+
 '<small>한 손가락 또는 터치펜으로 쓰실 수 있습니다. 필기는 이 브라우저에서 다시 열람할 수 있습니다.</small></div>';
}
function detail(){
 const p=selected();if(!p)return header('문제풀이')+'<p>문제를 선택해 주세요.</p>';
 const h=cstate(p);const prev=attempts(p.id);const last=prev[prev.length-1];const uploaded=x.uploads[p.id];
 return header('문항별 문제풀이','문제를 먼저 풀고, 필요할 때 코치에게 도움을 요청하세요.')+
 formButton('‹ 문항 목록','route','groupPractice','cs-back')+
 problemCard(p,true)+
 card('<h4>내 답안</h4>'+
 '<form id="cs-answer-form"><label class="cs-input-label" for="cs-answer">답 또는 풀이식</label>'+
 '<input id="cs-answer" name="answer" autocomplete="off" maxlength="220" required value="'+esc(x.drafts[p.id]||'')+'" placeholder="'+(p.kind==='pair'?'예: 2, 3':p.kind==='ineq'?'예: x>3':'예: 6')+'"/>'+
 '<div class="cs-keyboard" aria-label="수식 입력 도구">'+['x','²','+','−','/','(',')','=','>','<',','].map(k=>formButton(k,'symbol',k)).join('')+'</div>'+
 '<button type="submit" class="cs-btn primary">'+(p.kind==='manual'?'내 풀이 저장':'답 제출하고 채점')+'</button></form>'+
 (last?'<div class="cs-result '+(last.correct?'correct':'wrong')+'">'+(last.correct===true?'정답입니다. 스스로 확인한 방법을 말로 설명해 보세요.':last.correct===false?'다른 방법으로 다시 생각해 보세요. 아래 힌트나 코치에게 질문할 수 있습니다.':'직접 입력한 문제의 풀이를 저장했습니다.')+'</div>':'')+
 (p.kind==='manual'?'<p class="cs-muted">직접 입력 문항은 자동 정오 판정이 지원되지 않습니다.</p>':'')+'</section>')+
 card('<div class="cs-splithead"><h4>힌트와 풀이 과정</h4><span>'+h.hint+'/'+p.hints.length+'단계</span></div>'+
 (h.hint?'<div class="cs-hint">'+esc(p.hints[h.hint-1]||'')+'</div>':'<p class="cs-muted">답을 바로 표시하지 않고 작은 힌트를 순서대로 제공합니다.</p>')+
 '<div class="cs-links">'+formButton('힌트 한 단계','hint',p.id)+formButton('코치에게 묻기','route','groupCoach')+
 (last||h.hint>=p.hints.length?formButton('해설 단계보기','explain',p.id):'')+'</div>'+
 (x.drafts['explain:'+p.id]==='yes'&&p.steps.length?'<ol class="cs-explanation">'+p.steps.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ol>':'')+'</section>')+
 canvasMarkup(p)+
 card('<h4>사진 · 자료 첨부</h4><label class="cs-file-label" for="cs-file">사진 선택 / 카메라 열기<input id="cs-file" type="file" accept="image/*" capture="environment" /></label>'+
 (uploaded?'<div class="cs-upload"><img src="'+uploaded+'" alt="첨부한 문제 또는 풀이 사진"/>'+
 formButton('사진 삭제','removePhoto',p.id)+'</div>':'')+
 '<p class="cs-muted">사진은 현재 기기에서 미리보기로만 사용합니다. 이미지에서 문항을 자동 판독하거나 정답을 추출하지 않습니다.</p></section>')+
 card('<h4>학습 이어가기</h4>'+buttonsFor(p)+
 '<div class="cs-links">'+formButton('그룹에 이 문항 공유','shareProblem',p.id)+formButton('단원 바꾸기','route','groupBookDetail')+'</div></section>');
}
function chat(){
 const p=selected();if(!p)return header('코치');
 startCoach(p);const h=cstate(p),a=attempts(p.id),recent=a[a.length-1];
 return header('학습 코치','문제와 풀이 시도를 참고하여 다음 질문을 이어갑니다.')+
 '<p class="cs-coach-notice">현재는 <strong>규칙형 질문 코치</strong>입니다. 생성형 AI 모델과 이미지 인식은 연결되지 않았습니다.</p>'+
 card('<div class="cs-coach-problem"><small>현재 공부하는 문항</small><strong>'+esc(p.question)+'</strong>'+
 (recent?'<span>최근 풀이: '+esc(recent.answer||'입력 없음')+' · '+(recent.correct===true?'정답':recent.correct===false?'오답':'직접 등록')+'</span>':'')+
 '<div class="cs-links">'+formButton('문제로 돌아가기','route','groupProblemDetail')+
 formButton('다른 문제 선택','route','groupPractice')+'</div></div></section>')+
 '<div class="cs-coach-quick">'+[
 ['역사에서 시작','history'],['첫 질문','first'],['힌트','hint'],['다른 방법','alternative'],['검산 방법','check'],['비슷한 문제','variant']
 ].map(([t,k])=>formButton(t,'coachQuick',k)).join('')+'</div>'+
 '<section class="cs-chat" aria-label="코치와의 대화">'+h.messages.map(m=>
 '<div class="cs-bubble '+(m.by==='student'?'student':'coach')+'"><small>'+(m.by==='student'?'학생':'학습 코치 · 규칙형')+'</small><p>'+esc(m.text)+'</p></div>').join('')+'</section>'+
 '<form id="cs-chat-form" class="cs-chat-compose"><label for="cs-message" class="cs-visually-hidden">질문 입력</label>'+
 '<textarea id="cs-message" name="message" rows="2" required maxlength="700" placeholder="어느 부분에서 막히셨나요? 생각한 방법을 말씀해 보세요."></textarea>'+
 '<button type="submit" class="cs-btn primary">전송</button></form>'+
 '<p class="cs-muted">현재 문제와 풀이 결과가 코치 대화의 기준입니다. 생성형 AI가 도입되면 여기에 실제 문맥 기반 응답을 연결합니다.</p>';
}
function mistakes(){
 const miss=mistakeIds(),all=[...new Map(x.attempts.filter(a=>a.correct===false).map(a=>[a.problemId,a])).values()].reverse();
 const a=all.filter(v=>v.bookId===book().id);
 return header('오답 복습','틀린 이유를 확인하고 같은 원리의 새 조건으로 다시 풀어보세요.')+
 stat()+
 card('<div class="cs-splithead"><h4>오답 문항</h4><span>'+a.length+'건</span></div>'+
 (a.length?a.map(entry=>{
  const p=allProblems().find(z=>z.id===entry.problemId)||{id:entry.problemId,question:entry.question||'이전 문제',answer:entry.expected||''};
  return '<div class="cs-mistake"><div><strong>'+esc(p.question)+'</strong><small>내 답: '+esc(entry.answer)+' · '+date(entry.at)+'</small></div>'+
  '<div class="cs-links">'+formButton('재도전','review',p.id,'primary')+
  formButton('코치','openCoach',p.id)+formButton('그룹 공유','shareProblem',p.id)+'</div></div>';
 }).join(''):'<p class="cs-empty">아직 오답 기록이 없습니다. 문항을 풀어 보시면 자동으로 정리됩니다.</p>')+'</section>')+
 card('<h4>복습 방법</h4><p class="cs-muted">다시 도전할 때는 같은 수학적 원리를 유지하되 숫자를 바꿉니다. 이전의 정답을 외우는 방식이 아니라 풀이 과정을 복습합니다.</p>'+
 formButton('문항 목록으로','route','groupPractice','primary')+'</section>');
}
function dashboard(){
 const a=counts(),hist=x.attempts.filter(v=>v.bookId===book().id).slice(-12).reverse();
 const acts=B.getState()?.activity||[],days=[];
 for(let j=6;j>=0;j--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-j);
 const ymd=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const num=acts.filter(v=>v.date===ymd).length+x.attempts.filter(v=>new Date(v.at).toLocaleDateString('sv-SE')===ymd).length;
 days.push('<div><small>'+['일','월','화','수','목','금','토'][d.getDay()]+'</small><b>'+d.getDate()+'</b><i class="'+(num?'on':'')+'"></i></div>')}
 const next=a.wrong>a.correct?'오답 문항부터 다시 살펴보세요.':a.attempts>0?'다른 유형을 선택해 풀이 방법을 설명해 보세요.':'먼저 쉬운 문제 한 개를 풀어보세요.';
 return header('학습기록','실제 이 브라우저에 기록된 풀이·학습을 확인합니다.')+
 stat()+card('<h4>최근 7일 학습</h4><div class="cs-week">'+days.join('')+'</div></section>')+
 card('<h4>다음 학습 제안</h4><p class="cs-advice">'+next+'</p>'+
 '<div class="cs-links">'+formButton('오답부터 복습','route','groupMistakes')+
 formButton('계속 문제풀기','route','groupPractice','primary')+'</div></section>')+
 card('<h4>최근 풀이 기록</h4>'+
 (hist.length?hist.map(v=>'<div class="cs-history">'+
 '<span class="'+(v.correct===true?'yes':v.correct===false?'no':'')+'">'+(v.correct===true?'✓':v.correct===false?'×':'·')+'</span>'+
 '<div><strong>'+esc(v.question)+'</strong><small>내 답: '+esc(v.answer||'')+' · '+date(v.at)+'</small></div></div>').join(''):
 '<p class="cs-empty">아직 풀이 기록이 없습니다.</p>')+'</section>')+
 card('<h4>그룹 학습과 연결</h4><div class="cs-links">'+formButton('그룹 자료함','route','groupLearning')+
 formButton('학교별 족보','route','bankSearch')+formButton('그룹 질문','route','groupQuestions')+'</div></section>');
}
function selectProblem(id){const p=allProblems().find(z=>z.id===id);if(!p)return false;x.selected=id;store();return true}
function duplicateProblem(id){const p=allProblems().find(z=>z.id===id);if(!p)return;const s=(x.seed[id]||0)+1;x.seed[id]=s;x.selected=id;delete x.drafts[id];delete x.drafts['explain:'+id];const h=cstate(p);h.hint=0;h.messages=[];store();go('groupProblemDetail')}
function share(id){
 const p=allProblems().find(z=>z.id===id);const g=group(),m=B.getGroupModel();
 if(!p||!g||!m)return;
 const docs=m.materials[g.id]||(m.materials[g.id]=[]);
 if(!docs.some(v=>v.id==='coach-'+id)){
   docs.push({id:'coach-'+id,title:'문항 공유 · '+p.title,site:'학생 문제풀이',bookId:p.bookId,unit:p.unit,question:p.question,kind:'coach-problem'});
 }
 B.saveGroup();toast('현재 그룹의 자료함에 문항 정보를 저장했습니다.');render();
}
function submitAnswer(val){
 const p=selected(),text=String(val||'').trim();if(!p||!text)return;
 const result=rightAnswer(p,text),entry={id:uid(),problemId:p.id,bookId:p.bookId,unit:p.unit,question:p.question,answer:text,expected:p.answer||'',correct:result,at:now()};
 x.attempts.push(entry);if(x.attempts.length>3000)x.attempts=x.attempts.slice(-3000);
 x.drafts[p.id]=text;
 if(result===true){B.updateCoachProgress(p.bookId,4);addCoach(p,'coach','정답입니다. 그 답이 나오는 이유를 직접 설명해 주시겠습니까?')}
 else if(result===false){B.addCoachNote(p.bookId,'오답','내 답: '+text+' / 점검할 문제: '+p.question,p.unit);addCoach(p,'coach','아직 조건을 모두 만족하지 않습니다. '+(p.hints[0]||'문제의 조건을 다시 확인해 주세요.')+' 어떤 근거로 이 답을 구하셨나요?')}
 else addCoach(p,'coach','직접 입력한 문제와 풀이가 기록되었습니다. 자동 정오 판정은 하지 않습니다. 조건과 풀이 과정을 스스로 확인해 보시겠습니까?');
 store();render();
}
function saveManual(fd){
 const location=String(fd.get('location')||'').trim().slice(0,60),text=String(fd.get('question')||'').trim().slice(0,1800);
 if(!location||!text)return;
 const id='my-'+uid();
 x.manual.push({id,key:key(),bookId:book().id,unit:unit(),title:location,question:text,answer:'',kind:'manual',at:now()});
 x.selected=id;store();go('groupProblemDetail');
}
function markAnswerText(value){const el=document.getElementById('cs-answer');if(!el)return;const s=el.selectionStart||0,e=el.selectionEnd||0;let t=value==='²'?'²':value==='−'?'−':value;
 el.value=el.value.slice(0,s)+t+el.value.slice(e);el.focus();el.setSelectionRange(s+t.length,s+t.length);x.drafts[selected().id]=el.value;store()}
function coachQuick(type){
 const p=selected();if(!p)return;const h=cstate(p);
 const map={
  history:'왜 이 문제가 등장했나요?',
  first:'처음 어떤 조건부터 살펴봐야 할까요?',
  hint:'힌트가 필요합니다.',
  alternative:'다른 풀이 방법을 생각해 보고 싶습니다.',
  check:'제가 계산한 답이 맞는지 어떻게 검산하나요?',
  variant:'비슷한 다른 문제로 연습하고 싶습니다.'
 };
 const q=map[type]||'처음부터 생각해 보고 싶습니다.';
 addCoach(p,'student',q);
 if(type==='first'){h.hint=0;addCoach(p,'coach',(p.story||'주어진 조건부터 살펴봅니다.')+' 무엇을 구해야 하는지부터 말씀해 주시겠습니까?')}
 else addCoach(p,'coach',advise(p,q));
 store();render();
}
function action(k,v){
 const p=selected();
 if(k==='route'){go(v);return}
 if(k==='filter'){x.filters=v;store();render();return}
 if(k==='open'){if(selectProblem(v))go('groupProblemDetail');return}
 if(k==='openCoach'){if(selectProblem(v))go('groupCoach');return}
 if(k==='favorite'){x.favorites=x.favorites.includes(v)?x.favorites.filter(z=>z!==v):[...x.favorites,v];store();render();return}
 if(k==='variant'||k==='review'){duplicateProblem(v);return}
 if(k==='hint'){if(!p)return;const h=cstate(p);h.hint=Math.min(p.hints.length,h.hint+1);store();render();return}
 if(k==='explain'){if(!p)return;x.drafts['explain:'+p.id]='yes';store();render();return}
 if(k==='symbol'){markAnswerText(v);return}
 if(k==='coachQuick'){coachQuick(v);return}
 if(k==='shareProblem'){share(v);return}
 if(k==='removePhoto'){if(p)delete x.uploads[p.id];render();return}
 if(k==='erase'){if(p){x.drawings[p.id]='';store();mountCanvas()}return}
}
function routePage(id){
 if(id==='groupPractice')return practiceList();
 if(id==='groupProblemDetail')return detail();
 if(id==='groupCoach')return chat();
 if(id==='groupMistakes')return mistakes();
 if(id==='groupCoachDashboard')return dashboard();
 return null;
}
const ROUTES={groupPractice:'문제풀이',groupProblemDetail:'문항 상세',groupCoach:'학습 코치',groupMistakes:'오답 복습',groupCoachDashboard:'학습기록'};
for(const [id,title] of Object.entries(ROUTES)){
 window.YPT_GRAPH[id]={title,evidence:[],actions:[{text:'문제집',go:'groupAITutor'}]};
 if(GROUPS['스터디 그룹']&&!GROUPS['스터디 그룹'].includes(id))GROUPS['스터디 그룹'].push(id);
}
const oldGroup=groupPage,oldBottom=bottomFor,oldRender=render;
groupPage=function(id){return routePage(id)??oldGroup(id)};
bottomFor=function(id){if(Object.hasOwn(ROUTES,id))return oldBottom('groupAITutor');return oldBottom(id)};
function point(canvas,e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]}
function mountCanvas(){
 const canvas=document.getElementById('cs-canvas');if(!canvas)return;
 sheetCanvas=canvas;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 const p=selected(),data=p?x.drawings[p.id]:null;
 if(data){const im=new Image();im.onload=()=>{if(sheetCanvas===canvas)ctx.drawImage(im,0,0,canvas.width,canvas.height)};im.src=data}
 if(canvas.dataset.bound)return;canvas.dataset.bound='1';canvas.style.touchAction='none';
 canvas.addEventListener('pointerdown',e=>{paint=true;lastPoint=point(canvas,e);try{canvas.setPointerCapture(e.pointerId)}catch(_){}});
 canvas.addEventListener('pointermove',e=>{if(!paint||!lastPoint)return;const next=point(canvas,e);ctx.strokeStyle='#343b46';ctx.lineWidth=2.6;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(...lastPoint);ctx.lineTo(...next);ctx.stroke();lastPoint=next});
 const end=()=>{if(!paint)return;paint=false;lastPoint=null;const p=selected();if(p){try{x.drawings[p.id]=canvas.toDataURL('image/png');store()}catch(_){}}};
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
}
render=function(){oldRender();if(state.screen==='groupProblemDetail')mountCanvas()};
document.addEventListener('click',e=>{
 const target=e.target.closest('#phone [data-cs]');if(!target)return;
 e.preventDefault();e.stopImmediatePropagation();action(target.dataset.cs,target.dataset.value||'');
},true);
document.addEventListener('input',e=>{
 if(e.target?.id==='cs-answer'){const p=selected();if(p){x.drafts[p.id]=e.target.value;store()}}
},true);
document.addEventListener('submit',e=>{
 const id=e.target?.id;if(!['cs-manual-form','cs-answer-form','cs-chat-form'].includes(id))return;
 e.preventDefault();e.stopImmediatePropagation();
 const fd=new FormData(e.target);
 if(id==='cs-manual-form')saveManual(fd);
 else if(id==='cs-answer-form')submitAnswer(fd.get('answer'));
 else{
  const p=selected(),msg=String(fd.get('message')||'').trim().slice(0,700);if(!p||!msg)return;
  addCoach(p,'student',msg);addCoach(p,'coach',advise(p,msg));render();
 }
},true);
document.addEventListener('change',e=>{
 if(e.target?.id!=='cs-file')return;
 const file=e.target.files?.[0],p=selected();if(!file||!p)return;
 if(!file.type.startsWith('image/')){toast('이미지 파일만 첨부할 수 있습니다.');return}
 if(file.size>7*1024*1024){toast('사진은 7MB 이하로 선택해 주세요.');return}
 const reader=new FileReader();reader.onload=()=>{
  const data=String(reader.result||'');
  const im=new Image();im.onload=()=>{
    const c=document.createElement('canvas'),factor=Math.min(1,900/Math.max(im.width,im.height));c.width=Math.round(im.width*factor);c.height=Math.round(im.height*factor);
    const context=c.getContext('2d');context.drawImage(im,0,0,c.width,c.height);
    try{x.uploads[p.id]=c.toDataURL('image/jpeg',0.76);render()}catch(_){toast('사진 미리보기를 만들지 못했습니다.')}
  };im.src=data;
 };reader.readAsDataURL(file);
},true);
window.HITEL_COACH_INSPECT=()=>({
 screen:state.screen,bookId:book()?.id,unit:unit(),problemCount:allProblems().length,
 attempts:x.attempts.length,wrong:mistakeIds().length,coachMessages:Object.values(x.coach).reduce((sum,h)=>sum+(h.messages?.length||0),0),
 localRuleCoach:true,llmConnected:false,photoOCR:false,serverShared:false,
 currentSelected:selected()?.id
});
if(Object.hasOwn(ROUTES,state.screen))render();
})();
