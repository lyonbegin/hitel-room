/* HITEL AI Study Captain -- group-scoped, browser-local operational prototype.
 * This module does not impersonate a connected LLM, background worker, or push server.
 * Its proactive Socratic prompts, submissions, logs and settings are deterministic,
 * editable UI state; actual cross-user synchronization requires the group backend.
 */
(()=>{
'use strict';
const WK='hitel.ypt.group-workplace.v1',AK='hitel.ypt.ai-captain.v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const uid=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
const when=()=>new Date().toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
function read(k,fallback){try{const x=JSON.parse(localStorage.getItem(k)||'null');return x&&typeof x==='object'?x:fallback;}catch(_){return fallback;}}
function wp(){return window.HITEL_WORKPLACE_BRIDGE?.getModel?.()||read(WK,{groups:[],tasks:[],exams:[],materials:{},chats:{},sessions:[],activeGroupId:''});}
function db(){const x=read(AK,{version:2,groups:{}});if(!x.groups||typeof x.groups!=='object')x.groups={};return x;}
function saveDB(d){try{localStorage.setItem(AK,JSON.stringify(d));}catch(err){console.warn('AI captain local storage not available',err);}}
function saveWP(w){try{if(window.HITEL_WORKPLACE_BRIDGE?.saveModel)window.HITEL_WORKPLACE_BRIDGE.saveModel();else localStorage.setItem(WK,JSON.stringify(w));}catch(err){console.warn('Group local storage not available',err);}}
function groupData(){
 const w=wp(),g=w.groups.find(x=>x.id===w.activeGroupId)||w.groups[0];
 return {w,g};
}
function captain(g,d=db()){
 if(!g)return null;
 if(!d.groups[g.id])d.groups[g.id]={budget:50000,dailyTime:'18:00',reminders:true,questions:[],activity:[],notes:[],submissions:{},examAnswers:{},lastDaily:'',notified:{}};
 const c=d.groups[g.id];if(!Array.isArray(c.questions))c.questions=[];
 if(!Array.isArray(c.activity))c.activity=[];
 if(!Array.isArray(c.notes))c.notes=[];
 if(!c.submissions)c.submissions={};
 if(!c.examAnswers)c.examAnswers={};
 if(!c.notified)c.notified={};
 return c;
}
function topic(g){return String(g.topics||g.subject||'오늘 학습').trim()||'오늘 학습';}
function link(label,screen,cls=''){return '<button class="wp-btn '+cls+'" type="button" data-go="'+esc(screen)+'">'+esc(label)+'</button>';}
function act(label,action,id='',cls=''){return '<button class="wp-btn '+cls+'" type="button" data-captain="'+esc(action)+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';}
function section(title,more=''){return '<div class="wp-section-head"><strong>'+esc(title)+'</strong><small>'+esc(more)+'</small></div>';}
function note(text){return '<p class="wp-muted">'+esc(text)+'</p>';}
function actions(content){return '<div class="wp-actions">'+content.join('')+'</div>';}
function selectGroup(w){
 return '<div class="wp-group-choice"><label for="wp-group-switch">스터디그룹</label><select id="wp-group-switch" aria-label="스터디그룹 선택">'+
 w.groups.map(g=>'<option value="'+esc(g.id)+'"'+(w.activeGroupId===g.id?' selected':'')+'>'+esc(g.name)+'</option>').join('')+
 '</select></div>';
}
function log(c,kind,text){
 c.activity.unshift({id:uid('activity'),kind,text,at:when(),date:today()});
 c.activity=c.activity.slice(0,150);
}
function addMessage(w,g,text,by='AI 방장 · 규칙형 진행'){
 (w.chats[g.id]||(w.chats[g.id]=[])).push({by,text,at:new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})});
 if(w.chats[g.id].length>150)w.chats[g.id]=w.chats[g.id].slice(-150);
}
function questionText(g){
 return '오늘 '+topic(g)+' 학습에서 가장 중요한 개념 한 가지를 본인의 말로 설명해 주시겠습니까? 왜 그렇게 생각하셨는지도 말씀해 주세요.';
}
function notifyBrowser(c,body){
 if(!c.reminders||typeof Notification==='undefined'||Notification.permission!=='granted')return;
 try{new Notification('HITEL 스터디그룹 · AI 방장',{body,tag:'hitel-captain-'+today()});}catch(_){}
}
function startDaily(w,g,c,d,reason='scheduled'){
 const key=today();
 if(c.lastDaily===key)return false;
 const text=questionText(g);
 c.lastDaily=key;
 c.questions.unshift({id:uid('question'),date:key,text,kind:reason,answers:0});
 addMessage(w,g,text);
 log(c,'질문',reason==='scheduled'?'오늘의 질문을 등록했습니다.':'오늘의 질문을 시작했습니다.');
 saveWP(w);saveDB(d);notifyBrowser(c,'오늘의 질문: '+topic(g));
 return true;
}
function scheduledTick(){
 const w=wp();if(!w.groups?.length)return;
 const d=db(),t=new Date(),hm=[String(t.getHours()).padStart(2,'0'),String(t.getMinutes()).padStart(2,'0')].join(':');
 let changed=false;
 for(const g of w.groups){
  const c=captain(g,d);
  if(hm>=(c.dailyTime||'18:00')&&c.lastDaily!==today()) {
   if(startDaily(w,g,c,d,'scheduled'))changed=true;
  }
  for(const task of (w.tasks||[]).filter(x=>x.groupId===g.id&&!x.done&&x.date&&x.date<=today())){
   const key='task-'+task.id+'-'+today();
   if(!c.notified[key]){
    c.notified[key]=true;
    log(c,'숙제',task.title+' · 제출 확인이 필요합니다.');
    changed=true;
    notifyBrowser(c,'미완료 숙제: '+task.title);
   }
  }
 }
 if(changed){saveWP(w);saveDB(d);}
}
function followup(g,c,text){
 const n=Object.values(c.submissions).length;
 if(/모르겠|잘 모르|어렵|헷갈|이해 못/.test(text))return '괜찮습니다. '+topic(g)+'에서 이미 알고 계신 내용은 무엇인가요? 거기서부터 함께 확인해 보겠습니다.';
 const questions=[
  '그렇게 생각하신 근거를 한 단계씩 설명해 주시겠습니까?',
  '조건 하나가 달라진다면 같은 설명이 성립할까요? 반례를 생각해 보시겠습니까?',
  '다른 그룹원은 어떻게 생각할까요? 같은 결론에 도달하는 다른 방법이 있을까요?',
  '지금 내용을 새로운 예시에 적용한다면 어떻게 설명하시겠습니까?'
 ];
 return questions[(c.activity.filter(x=>x.kind==='문답').length+n)%questions.length];
}
function groupHero(){
 const {w,g}=groupData();if(!g)return '<div class="wp-panel">스터디그룹을 먼저 만들어 주십시오.</div>';
 const d=db(),c=captain(g,d),tasks=(w.tasks||[]).filter(x=>x.groupId===g.id),pending=tasks.filter(x=>!x.done);
 const exams=(w.exams||[]).filter(x=>x.groupId===g.id&&x.date>=today()).sort((a,b)=>a.date.localeCompare(b.date));
 const docs=(w.materials?.[g.id]||[]).length+c.notes.length;
 const recent=c.activity.slice(0,4);
 const due=c.questions.find(x=>x.date===today());
 const validMembers=Math.max(1,(g.members||[]).length);
 return selectGroup(w)+
 '<section class="wp-group-hero cap-hero"><strong>'+esc(g.name)+'</strong>'+
 '<p>'+esc((g.institutionType==='academy'?'학원':'학교')+' · '+(g.institutionName||g.school||'기관 미지정')+' · '+(g.grade||'학년 미지정'))+
 ' · '+validMembers+'/5명</p><p>'+esc(topic(g))+'</p>'+
 '<div class="wp-mini-metrics"><span>멤버 '+validMembers+'명</span><span>학습자료 '+docs+'건</span><span>미완료 숙제 '+pending.length+'건</span></div></section>'+
 '<section class="cap-captain wp-panel"><div class="cap-caption"><span class="cap-avatar" aria-hidden="true">AI</span><div><strong>스터디그룹 AI 방장</strong><small>정해진 시간에 질문·미션·진도를 관리하는 운영 화면</small></div></div>'+
 '<p class="cap-status">현재: 규칙형 문답·일정 기록 · 외부 AI 모델 및 실제 푸시 서버 미연결</p>'+
 (due?'<strong class="cap-question">'+esc(due.text)+'</strong>':
  '<strong class="cap-question">오늘의 질문 예정 · '+esc(c.dailyTime||'18:00')+'</strong>')+
 actions([link('답변하기','groupQuestions','wp-primary'),!due?act('지금 질문 시작','startDaily'):link('AI 방장 설정','groupCaptainSettings')])+'</section>'+
 '<div class="cap-metrics">'+
 metric('숙제·미션',pending.length+'건','groupLearning','assignments')+
 metric('예정된 시험',exams.length+'건','groupLearning','exams')+
 metric('등록 자료',docs+'건','groupLearning','materials')+'</div>'+
 section('AI 방장의 최근 활동','그룹별 기록')+
 '<div class="wp-panel cap-activity">'+(recent.length?recent.map(x=>'<div class="wp-line"><div><strong>'+esc(x.text)+'</strong><small>'+esc(x.kind)+' · '+esc(x.at)+'</small></div></div>').join(''):note('아직 활동 기록이 없습니다. 오늘의 질문을 시작할 수 있습니다.'))+'</div>'+
 section('그룹 학습 진행','상시 참여 · 동시 입장 불필요')+
 '<div class="wp-panel">'+
 (exams.length?'<div class="wp-line"><div><strong>다음 시험</strong><small>'+esc(exams[0].date+' · '+exams[0].title)+'</small></div></div>':'')+
 (pending.length?'<div class="wp-line"><div><strong>미완료 숙제</strong><small>'+esc(pending.slice(0,2).map(x=>x.title).join(' · '))+'</small></div></div>':'')+
 actions([act('복습 미션 제안','assignMission'),link('학습 현황','groupLearning'),link('활동 기록','groupCaptainHistory')])+'</div>'+
 section('일정 · 멤버 · 공부시간 · 공동 비용')+
 '<div class="cap-shortcuts">'+
 link('캘린더','calendar')+link('숙제 전체','todo')+link('구성원','groupMembers')+
 link('공부시간','home')+link('그룹 설정','groupSettings')+link('AI 비용','groupCaptainSettings')+
 '</div>'+
 '<div class="cap-cost wp-panel"><strong>AI 공동 예산</strong><span>월 '+Number(c.budget||0).toLocaleString('ko-KR')+
 '원 · '+validMembers+'명 균등분담 시 1인 '+Math.ceil(Number(c.budget||0)/validMembers).toLocaleString('ko-KR')+
 '원</span>'+note('분담 계산 예시입니다. 실제 AI 사용량이나 청구 금액은 아닙니다.')+'</div>'+
 section('추가 기능')+actions([link('새 일정','calendarAdd'),link('그룹 미션','groupMissions'),link('그룹 랭킹','groupRanking')])+
 '<div class="wp-footnote">스터디그룹 기록은 현재 브라우저에만 저장됩니다. 다른 구성원의 실시간 기록이나 앱 종료 중 자동 발송은 아직 지원되지 않습니다.</div>';
}
function metric(label,value,screen,tab){return '<button type="button" class="cap-metric" data-captain="goLearning" data-id="'+tab+'"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span></button>';}
function questionPage(){
 const {w,g}=groupData();if(!g)return groupHero();
 const d=db(),c=captain(g,d),chats=w.chats?.[g.id]||[];
 const attached=state.capAttachedName||'';
 return selectGroup(w)+section('질문하기',g.name)+
 '<div class="wp-panel cap-intro"><div class="cap-caption"><span class="cap-avatar">AI</span><div><strong>AI 방장과 소크라테스식 문답</strong><small>그룹의 앞선 질문·자료·학습 범위 활용</small></div></div>'+
 note('현재 답변은 규칙형 후속질문 시연입니다. 실제 AI의 자연어 추론·사진 분석·음성 인식은 아직 연결되지 않았습니다.')+
 (c.notes.length?'<small>그룹 등록 학습메모 '+c.notes.length+'건 참조 가능</small>':'')+'</div>'+
 '<div class="wp-chat-log cap-chat" role="log" aria-label="스터디그룹 문답 기록">'+
 (chats.length?chats.slice(-70).map(x=>
  '<div class="wp-bubble '+(String(x.by).includes('AI 방장')?'cap-ai-bubble':'')+'"><small>'+esc(x.by)+' · '+esc(x.at)+'</small><p>'+esc(x.text)+'</p></div>').join(''):note('질문을 남기거나 AI 방장의 오늘 질문을 시작해 보십시오.'))+'</div>'+
 '<form id="cap-question-form" class="wp-panel wp-form">'+
 '<label class="wp-field"><span>말씀하시거나 질문을 입력하세요</span><textarea name="text" rows="3" maxlength="1000" placeholder="예: 왜 이 공식이 성립하는지 설명해 주세요." required></textarea></label>'+
 '<div class="cap-compose-controls"><label class="wp-btn cap-attach">사진·파일 <input id="cap-question-file" type="file" accept="image/*,.pdf" capture="environment" hidden></label>'+
 act('음성 입력','speechInput')+'<span class="cap-attachment-name">'+esc(attached)+'</span></div>'+
 '<button class="wp-btn wp-primary" type="submit">질문 전송</button></form>'+
 actions([act('오늘의 질문 시작','startDaily'),link('그룹 자료','groupLearning')])+
 '<div class="wp-footnote">사진·파일 선택 시 파일명만 질문에 기록합니다. 파일 원본은 서버에 업로드하거나 AI가 분석하지 않습니다.</div>';
}
function learningPage(oldGroup){
 const {w,g}=groupData();if(!g)return groupHero();
 const d=db(),c=captain(g,d),tab=state.wpLearningTab||'assignments';
 const old=oldGroup('groupLearning');
 const intro=selectGroup(w)+section('학습',g.name)+
 '<div class="wp-panel cap-intro"><div class="cap-caption"><span class="cap-avatar">AI</span><div><strong>AI 방장의 학습 관리</strong>'+
 '<small>숙제·미션 / 자료 / 시험</small></div></div>'+
 note('그룹 등록 학습 범위: '+topic(g))+
 (tab==='assignments'?actions([act('복습 미션 제안','assignMission'),act('미완료 확인','checkTasks')]):
  tab==='materials'?actions([act('학습메모 등록','toggleNoteForm'),link('족보','bankSearch')]):
  actions([act('확인 질문 시작','startOralExam'),act('시험 일정 등록','openExamForm')]))+
 '</div>';
 let supplement='';
 if(tab==='materials'){
  supplement=section('그룹 전담 학습메모',c.notes.length+'건')+
  (c.notes.length?c.notes.map(n=>'<div class="wp-panel"><strong>'+esc(n.title)+'</strong><p class="wp-muted">'+esc(n.text.slice(0,250))+'</p>'+act('삭제','deleteNote',n.id)+'</div>').join(''):note('등록된 메모가 없습니다. 설명·오답·수업 내용을 그룹의 학습자료로 남길 수 있습니다.'))+
  (state.capNoteForm?'<form id="cap-note-form" class="wp-panel wp-form">'+
  '<label class="wp-field"><span>자료 제목</span><input name="title" required maxlength="90" placeholder="예: 수학 수업 필기"></label>'+
  '<label class="wp-field"><span>내용</span><textarea name="text" required rows="4" maxlength="5000" placeholder="그룹 AI가 참고할 개념과 설명"></textarea></label>'+
  '<button type="submit" class="wp-btn wp-primary">그룹 학습메모 저장</button></form>':'');
 }
 if(tab==='exams'){
  supplement=section('개별 확인 문답')+
    '<div class="wp-panel">'+note('등록한 시험 범위를 주제로 한 문답형 확인 활동입니다. 자동 채점과 AI 출제 기능은 아직 연결되지 않았습니다.')+
    (state.capOralExam?'<form id="cap-oral-form" class="wp-form">'+
      '<strong>확인 질문: '+esc(topic(g))+'의 핵심 개념을 한 문장으로 설명해 보십시오.</strong>'+
      '<label class="wp-field"><span>내 답변</span><textarea name="answer" rows="3" required maxlength="1000"></textarea></label>'+
      '<button type="submit" class="wp-btn wp-primary">답변 제출</button></form>':act('확인 문답 시작','startOralExam'))+
    '</div>'+
    (Object.values(c.examAnswers).length?note('이 그룹에서 기록한 확인 문답 '+Object.values(c.examAnswers).length+'건'):'');
 }
 if(tab==='assignments'){
  const completed=Object.keys(c.submissions).length;
  supplement=section('숙제 제출 기록',completed+'건')+
    (completed?Object.entries(c.submissions).slice(-4).reverse().map(([k,v])=>'<div class="wp-panel"><small>'+esc(v.at)+' · '+esc(v.title)+'</small><p>'+esc(v.text)+'</p></div>').join(''):
    note('숙제 제출 기록이 없습니다. 숙제를 생성하고 제출·확인하실 수 있습니다.'));
  const tasks=(w.tasks||[]).filter(x=>x.groupId===g.id);
  supplement+=tasks.filter(t=>!t.done).slice(0,3).map(t=>'<div class="wp-panel"><strong>'+esc(t.title)+'</strong><small>'+esc(t.date+' · '+t.assignee)+'</small>'+
    act('답변 제출','openSubmission',t.id)+'</div>').join('');
  if(state.capSubmitId){
   supplement+='<form id="cap-submit-form" class="wp-panel wp-form">'+
    '<strong>숙제 답변 제출</strong><label class="wp-field"><span>풀이 과정·답변</span><textarea name="answer" rows="3" required maxlength="2000"></textarea></label>'+
    '<button type="submit" class="wp-btn wp-primary">제출</button></form>';
  }
 }
 // Remove the duplicate group selector in the original learning component.
 const origWithoutSwitch=old.replace(/^<div class="wp-group-choice">[\s\S]*?<\/select><\/div>/,'');
 return intro+origWithoutSwitch+supplement;
}
function settingsPage(){
 const {w,g}=groupData();if(!g)return groupHero();
 const c=captain(g);
 return selectGroup(w)+section('AI 방장 설정',g.name)+
 '<form id="cap-settings-form" class="wp-panel wp-form">'+
 '<label class="wp-field"><span>매일 선제 질문 시각</span><input type="time" name="dailyTime" value="'+esc(c.dailyTime||'18:00')+'" required></label>'+
 '<label class="wp-field"><span>AI 공동 월 예산 (원)</span><input type="number" name="budget" min="0" max="10000000" step="1000" value="'+Number(c.budget||0)+'"></label>'+
 '<label class="wp-field"><span>알림 설정</span><select name="reminders"><option value="yes"'+(c.reminders?' selected':'')+'>브라우저 알림 사용</option><option value="no"'+(!c.reminders?' selected':'')+'>알림 끄기</option></select></label>'+
 '<button class="wp-btn wp-primary" type="submit">설정 저장</button></form>'+
 '<div class="wp-panel"><strong>알림 권한</strong>'+note('알림을 허용하면 이 화면이 열려 있는 동안에만 일정 및 숙제 알림을 표시할 수 있습니다. 앱이 종료된 상태에서의 원격 푸시는 서버 연동 전입니다.')+
 act('브라우저 알림 권한 요청','requestNotification')+'</div>'+
 actions([link('스터디그룹으로','groupDetail'),link('학습','groupLearning')]);
}
function historyPage(){
 const {w,g}=groupData();if(!g)return groupHero();const c=captain(g);
 return selectGroup(w)+section('AI 방장 활동 기록',g.name)+
 (c.activity.length?c.activity.map(x=>'<div class="wp-panel"><strong>'+esc(x.text)+'</strong><p class="wp-muted">'+esc(x.kind+' · '+x.at)+'</p></div>').join(''):
 note('아직 활동 기록이 없습니다.'))+
 actions([link('스터디그룹','groupDetail'),link('설정','groupCaptainSettings')]);
}
function captainAction(action,id,el){
 const {w,g}=groupData();if(!g)return;
 const d=db(),c=captain(g,d);
 if(action==='startDaily'){
  const was=startDaily(w,g,c,d,'manual');
  if(!was)alertInfo('오늘의 질문이 이미 등록되어 있습니다.');
  go('groupQuestions');return;
 }
 if(action==='goLearning'){state.wpLearningTab=id;go('groupLearning');return;}
 if(action==='assignMission'){
  const due=new Date();due.setDate(due.getDate()+1);
  const t={id:uid('task'),groupId:g.id,title:topic(g)+' · 핵심 개념을 본인 말로 설명하기',
   assignee:'전체',date:today(due),done:false,source:'captain-rule-template'};
  w.tasks.unshift(t);
  addMessage(w,g,'새 복습 미션을 등록했습니다: '+t.title+' (기한 '+t.date+')');
  log(c,'미션','복습 미션을 제안했습니다: '+t.title);
  saveWP(w);saveDB(d);state.wpLearningTab='assignments';go('groupLearning');return;
 }
 if(action==='checkTasks'){
  const n=(w.tasks||[]).filter(x=>x.groupId===g.id&&!x.done).length;
  log(c,'숙제','미완료 숙제 '+n+'건을 확인했습니다.');
  saveDB(d);alertInfo('미완료 숙제 '+n+'건입니다. 다른 구성원에게 원격 푸시를 보내지는 않습니다.');render();return;
 }
 if(action==='toggleNoteForm'){state.capNoteForm=!state.capNoteForm;render();return;}
 if(action==='deleteNote'){c.notes=c.notes.filter(x=>x.id!==id);log(c,'자료','학습메모를 삭제했습니다.');saveDB(d);render();return;}
 if(action==='startOralExam'){state.wpLearningTab='exams';state.capOralExam=true;go('groupLearning');return;}
 if(action==='openExamForm'){state.wpLearningTab='exams';state.wpExamForm=true;go('groupLearning');return;}
 if(action==='openSubmission'){state.wpLearningTab='assignments';state.capSubmitId=id;render();return;}
 if(action==='requestNotification'){
  if(typeof Notification==='undefined'){alertInfo('이 브라우저에서 알림을 지원하지 않습니다.');return;}
  Notification.requestPermission().then(p=>alertInfo(p==='granted'?'이 브라우저에서 알림이 허용되었습니다.':'알림이 허용되지 않았습니다.'));return;
 }
 if(action==='speechInput'){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){alertInfo('이 브라우저에서 음성 인식 입력을 지원하지 않습니다. 텍스트로 입력해 주십시오.');return;}
  try{
   const recognizer=new Recognition();recognizer.lang='ko-KR';recognizer.interimResults=false;
   recognizer.onresult=e=>{const a=document.querySelector('#cap-question-form [name=text]');if(a)a.value+=(a.value?' ':'')+e.results[0][0].transcript;};
   recognizer.onerror=()=>alertInfo('음성 인식을 완료하지 못했습니다.');
   recognizer.start();
  }catch(_){alertInfo('음성 인식을 시작할 수 없습니다.');}
 }
}
function alertInfo(message){const toast=document.getElementById('toast');if(toast){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2800);}else console.info(message);}
function submit(form){
 const {w,g}=groupData();if(!g)return;const d=db(),c=captain(g,d);
 const data=new FormData(form);
 if(form.id==='cap-question-form'){
  const txt=String(data.get('text')||'').trim();if(!txt)return;
  const attached=state.capAttachedName||'';
  addMessage(w,g,txt+(attached?' [첨부 파일명: '+attached+']':'') ,'나');
  const response=followup(g,c,txt);
  addMessage(w,g,response);
  log(c,'문답','질문 후 사고를 확장하는 후속 질문을 제시했습니다.');
  const last=c.questions[0];if(last&&last.date===today())last.answers=(last.answers||0)+1;
  state.capAttachedName='';saveWP(w);saveDB(d);render();return;
 }
 if(form.id==='cap-settings-form'){
  c.dailyTime=String(data.get('dailyTime')||'18:00');
  c.budget=Math.max(0,Math.min(10000000,Number(data.get('budget')||0)));
  c.reminders=data.get('reminders')==='yes';log(c,'설정','AI 방장의 질문 시각과 예산을 변경했습니다.');
  saveDB(d);go('groupDetail');return;
 }
 if(form.id==='cap-note-form'){
  const title=String(data.get('title')||'').trim(),text=String(data.get('text')||'').trim();
  if(!title||!text)return;
  c.notes.unshift({id:uid('note'),title,text,at:when()});
  log(c,'자료','그룹 학습메모를 등록했습니다: '+title);
  saveDB(d);state.capNoteForm=false;render();return;
 }
 if(form.id==='cap-submit-form'){
  const task=w.tasks.find(x=>x.groupId===g.id&&x.id===state.capSubmitId);
  const answer=String(data.get('answer')||'').trim();
  if(!task||!answer)return;
  c.submissions[task.id]={title:task.title,text:answer,at:when()};
  task.done=true;
  log(c,'숙제','숙제 답변을 제출했습니다: '+task.title);
  addMessage(w,g,'숙제를 제출했습니다: '+task.title+' · 학습 내용을 설명한 근거를 다시 한 번 확인해 주시겠습니까?');
  state.capSubmitId='';saveWP(w);saveDB(d);render();return;
 }
 if(form.id==='cap-oral-form'){
  const answer=String(data.get('answer')||'').trim();if(!answer)return;
  c.examAnswers[uid('oral')]={topic:topic(g),answer,at:when()};
  log(c,'시험','확인 문답에 답변했습니다.');
  addMessage(w,g,'확인 문답을 제출했습니다. '+topic(g)+'을 다른 사례에도 적용해 설명할 수 있을까요?');
  state.capOralExam=false;saveWP(w);saveDB(d);render();return;
 }
}
const previousGroupPage=groupPage;
groupPage=function(id){
 if(id==='groupDetail')return groupHero();
 if(id==='groupQuestions'||id==='groupMessages')return questionPage();
 if(id==='groupLearning')return learningPage(previousGroupPage);
 if(id==='groupCaptainSettings')return settingsPage();
 if(id==='groupCaptainHistory')return historyPage();
 return previousGroupPage(id);
};
for(const [key,label] of Object.entries({groupCaptainSettings:'AI 방장 설정',groupCaptainHistory:'AI 방장 활동'})){
 window.YPT_GRAPH[key]={title:label,evidence:[],actions:[{text:'스터디그룹',go:'groupDetail'}]};
 if(typeof GROUPS==='object'&&GROUPS['스터디 그룹']&&!GROUPS['스터디 그룹'].includes(key))GROUPS['스터디 그룹'].push(key);
}
document.addEventListener('click',ev=>{
 const target=ev.target.closest('[data-captain]');if(!target)return;
 ev.preventDefault();ev.stopPropagation();
 captainAction(target.dataset.captain,target.dataset.id||'',target);
},true);
document.addEventListener('submit',ev=>{
 if(!ev.target?.id?.startsWith('cap-'))return;
 ev.preventDefault();ev.stopPropagation();
 submit(ev.target);
},true);
document.addEventListener('change',ev=>{
 if(ev.target.id==='cap-question-file'){
  const file=ev.target.files?.[0];
  state.capAttachedName=file?file.name.slice(0,120):'';
  const el=document.querySelector('#phone .cap-attachment-name');if(el)el.textContent=state.capAttachedName;
 }
},true);
const lastRender=render;
render=function(){scheduledTick();lastRender();};
scheduledTick();
render();
setInterval(()=>{
 scheduledTick();
 if(state.screen==='groupDetail'||state.screen==='groupCaptainHistory')render();
},60000);
window.HITEL_CAPTAIN_INSPECT=()=>{
 const {w,g}=groupData(),d=db(),c=g?captain(g,d):null;
 return {mode:'BROWSER_LOCAL_RULE_BASED',groupId:g?.id||null,groupCount:w.groups.length,
   dailyQuestionCount:c?.questions.length||0,activityCount:c?.activity.length||0,
   groupNoteCount:c?.notes.length||0,groupTaskCount:(w.tasks||[]).filter(x=>x.groupId===g?.id).length,
   groupExamCount:(w.exams||[]).filter(x=>x.groupId===g?.id).length,
   groupMessages:(w.chats?.[g?.id]||[]).length,
   notificationMode:'VISIBLE_BROWSER_ONLY',llmConnected:false,sharedPersistence:false,screen:state.screen};
};
})();