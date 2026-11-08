/* HITEL YPT group-first workplace UI. Presentation and local interaction only.
 * Does not implement Zoom/WebRTC, server-side persistence or shared synchronization.
 * Preserves original YPT/Zocbo renderers and bottom navigation. */
(function () {
  'use strict';
  const KEY='hitel.ypt.group-workplace.v1';
  const NEW_PAGES={
    groupSessionDetail:'공동학습 일정',
    groupLiveRoom:'공동 공부방',
    groupWhiteboard:'공동 화이트보드',
    groupMaterials:'그룹 자료함',
    groupSessionSummary:'학습 결과',
    groupTaskDetail:'그룹 과제',
    groupQuestions:'질문하기',
    groupLearning:'학습',
  };
  const clone=x=>JSON.parse(JSON.stringify(x));
  const instituteTypeName=type=>type==='academy'?'학원':'학교';
  const institutionName=g=>g.institutionName||g.school||'';
  const institutionLine=g=>instituteTypeName(g.institutionType)+' · '+(institutionName(g)||'기관 미지정')+' · '+(g.grade||'학년 미지정');
  const subjectsLabel=g=>[g.subject||'과목 자유 선택',g.topics||''].filter(Boolean).join(' · ');
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateStr=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const newId=(p)=>p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  const timeLabel=s=>(s||'').slice(0,5);
  const block=(content,cl='')=>'<div class="wp-panel '+cl+'">'+content+'</div>';
  const navi=(label,screen,cl='')=>'<button type="button" class="wp-btn '+cl+'" data-go="'+esc(screen)+'">'+esc(label)+'</button>';
  const act=(label,action,value='',cl='')=>'<button type="button" class="wp-btn '+cl+'" data-wp="'+esc(action)+'" data-value="'+esc(value)+'">'+esc(label)+'</button>';
  const chip=(label,cl='')=>'<span class="wp-chip '+cl+'">'+esc(label)+'</span>';
  const title=(str,note='')=>'<div class="wp-section-head"><strong>'+esc(str)+'</strong>'+(note?'<small>'+esc(note)+'</small>':'')+'</div>';
  const muted=str=>'<p class="wp-muted">'+esc(str)+'</p>';
  const line=(label,subtitle='',control='')=>'<div class="wp-line"><div><strong>'+esc(label)+'</strong>'+(subtitle?'<small>'+esc(subtitle)+'</small>':'')+'</div>'+control+'</div>';
  const rowbuttons=items=>'<div class="wp-actions">'+items.join('')+'</div>';
  const input=(name,label,type='text',value='',placeholder='')=>'<label class="wp-field"><span>'+esc(label)+'</span><input name="'+esc(name)+'" type="'+esc(type)+'" value="'+esc(value)+'" placeholder="'+esc(placeholder||label)+'" /></label>';
  const options=(name,label,arr,value)=>'<label class="wp-field"><span>'+esc(label)+'</span><select name="'+esc(name)+'">'+arr.map(x=>{const id=Array.isArray(x)?x[0]:x,text=Array.isArray(x)?x[1]:x;return '<option value="'+esc(id)+'"'+(String(id)===String(value)?' selected':'')+'>'+esc(text)+'</option>';}).join('')+'</select></label>';
  const localHint='<div class="wp-footnote">이 화면에서 추가한 기록은 현재 브라우저에만 저장됩니다. 다른 그룹원의 실제 데이터와 동기화되지 않습니다.</div>';
  function fresh(){
    const day=dateStr();
    return {
      version:1,
      groups:[
        {id:'demo-five',name:'집중 공부방 (예시)',school:'',institutionType:'school',institutionName:'',grade:'',subject:'수학',topics:'',members:['나','학습자 2','학습자 3','학습자 4','학습자 5'],example:true},
        {id:'my-study',name:'내 스터디',school:'',institutionType:'school',institutionName:'',grade:'',subject:'자율 학습',topics:'',members:['나'],example:false}
      ],
      activeGroupId:'demo-five',activeSessionId:'session-example',activePaperId:'',
      sessions:[{id:'session-example',groupId:'demo-five',title:'수학 공동학습 (예시)',date:day,start:'19:00',end:'20:30',repeat:'매주',attendees:['나','학습자 2','학습자 3','학습자 4'],paperIds:[],example:true}],
      tasks:[],materials:{},chats:{},studyLogs:[],boards:{},exams:[]
    };
  }
  function valid(raw){
    return raw && Array.isArray(raw.groups)&&Array.isArray(raw.sessions)&&Array.isArray(raw.tasks)&&raw.materials&&raw.chats;
  }
  function getModel(){
    try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(valid(x))return x;}catch(_){}
    return fresh();
  }
  let model=getModel();
  if(!Array.isArray(model.exams))model.exams=[];
  // Previous groups remain intact; missing institution metadata stays explicitly unset.
  model.groups.forEach(g=>{
    if(!['school','academy'].includes(g.institutionType))g.institutionType='school';
    if(!g.institutionName)g.institutionName=g.school||'';
    if(typeof g.grade!=='string')g.grade='';
    if(typeof g.topics!=='string')g.topics='';
  });
  function save(){try{localStorage.setItem(KEY,JSON.stringify(model));}catch(err){console.warn('HITEL browser-only storage unavailable',err);}}
  function getGroup(id=model.activeGroupId){return model.groups.find(x=>x.id===id)||model.groups[0];}
  function getSession(id=model.activeSessionId){return model.sessions.find(x=>x.id===id)||null;}
  function sessionsFor(id=model.activeGroupId){return model.sessions.filter(x=>x.groupId===id).sort((a,b)=>(a.date+'T'+a.start).localeCompare(b.date+'T'+b.start));}
  function tasksFor(id=model.activeGroupId){return model.tasks.filter(x=>x.groupId===id);}
  function materialsFor(id=model.activeGroupId){return model.materials[id]||[];}
  function groupChoice(){
    return '<div class="wp-group-choice"><label for="wp-group-switch">내 스터디그룹</label><select id="wp-group-switch" data-wp-change="group" aria-label="스터디그룹 전환">'+model.groups.map(g=>'<option value="'+esc(g.id)+'"'+(g.id===model.activeGroupId?' selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select></div>';
  }
  function upcoming(groupId){
    const items=sessionsFor(groupId).filter(x=>x.date>=dateStr());
    return items[0]||sessionsFor(groupId)[0]||null;
  }
  function sessionCard(s,compact=false){
    const group=s.groupId?getGroup(s.groupId):null;
    return '<div class="wp-session-card">'+
      '<div class="wp-session-main"><div>'+chip(s.date+' '+timeLabel(s.start)+'~'+timeLabel(s.end))+
      '<strong>'+esc(s.title)+'</strong>'+
      '<small>'+(group?esc(group.name)+' · ':'개인 · ')+esc(s.repeat||'반복 없음')+' · 참석 '+(s.attendees||[]).length+'명</small></div>'+
      '<button type="button" class="wp-text-action" data-wp="openSession" data-value="'+esc(s.id)+'">상세 ›</button></div>'+
      (compact?'':rowbuttons([act('일정 상세','openSession',s.id),act('공부방','enterSession',s.id,'wp-primary')]))+
      '</div>';
  }
  function groupCard(g){
    const sessions=sessionsFor(g.id);
    return '<div class="wp-group-card" data-group-id="'+esc(g.id)+'"><div class="wp-line"><div>'+
      '<strong>'+esc(g.name)+'</strong><small>'+esc(institutionLine(g))+' · '+g.members.length+'/5명'+(g.example?' · 예시 그룹':'')+'</small><small>'+esc(subjectsLabel(g))+'</small>'+
      '</div>'+act('선택','chooseGroup',g.id,(g.id===model.activeGroupId?'wp-primary':''))+'</div>'+
      (sessions.length?'<small class="wp-muted">예정된 일정: '+esc(sessions[0].title)+' · '+esc(sessions[0].date)+'</small>':'<small class="wp-muted">아직 등록된 일정이 없습니다.</small>')+
      '</div>';
  }
  function groupOverview(){
    const g=getGroup();if(!g)return '';
    const next=upcoming(g.id);
    return block(groupChoice()+
      '<div class="wp-featured"><div class="wp-feature-top"><strong>'+esc(g.name)+'</strong>'+chip(g.members.length+'/5명')+'</div>'+
      '<div class="wp-muted">'+esc(institutionLine(g))+' · '+esc(subjectsLabel(g))+' · '+(g.example?'구성 예시':'내 그룹')+'</div>'+
      (next?'<div class="wp-next"><strong>다음 공동학습</strong><span>'+esc(next.date)+' '+esc(next.start)+' · '+esc(next.title)+'</span></div>':muted('그룹 일정이 없습니다.'))+
      rowbuttons([navi('그룹 상세','groupDetail'),next?act('공부방','enterSession',next.id,'wp-primary'):navi('일정 만들기','calendarAdd','wp-primary')])+
      '</div>','wp-overview');
  }
  function institutionFields(g){
    const type=g?.institutionType||'school';
    return options('institutionType','기관 유형',[['school','학교'],['academy','학원']],type)+
      input('institutionName','학교·학원 이름','text',institutionName(g||{}),'예: 등촌고등학교 또는 ○○학원')+
      input('grade','학년','text',g?.grade||'','예: 초5, 중2, 고2, 2학년')+
      input('subject','학습 과목 (여러 과목 가능)','text',g?.subject||'','예: 국어, 영어, 수학')+
      input('topics','특정 단원·학습 범위 (선택)','text',g?.topics||'','예: 미적분, 수열, 기말고사 범위');
  }
  function groupsPage(){
    const type=state.wpInstitutionFilterType||'all';
    return groupChoice()+title('스터디그룹 찾기','학교·학년 또는 학원·학년으로 구분합니다.')+
      '<div class="wp-panel wp-institution-filter" aria-label="스터디그룹 기관별 검색">'+
      '<div class="wp-fields-two">'+
      options('wpTypeFilter','기관 유형',[['all','학교 + 학원'],['school','학교'],['academy','학원']],type)+
      options('wpGradeFilter','학년',[['all','전체'],['초1','초1'],['초2','초2'],['초3','초3'],['초4','초4'],['초5','초5'],['초6','초6'],['중1','중1'],['중2','중2'],['중3','중3'],['고1','고1'],['고2','고2'],['고3','고3'],['2학년','2학년']],state.wpInstitutionFilterGrade||'all')+
      '</div>'+input('wpNameFilter','학교·학원 이름 검색','text',state.wpInstitutionFilterName||'','학교명 또는 학원명')+
      '</div>'+
      title('참여 중인 스터디그룹','같은 기관·학년에 여러 개 생성할 수 있습니다.')+
      '<div id="wp-filtered-groups">'+model.groups.map(groupCard).join('')+'</div>'+
      '<p id="wp-empty-groups" class="wp-muted" hidden>조건에 맞는 스터디그룹이 없습니다.</p>'+
      rowbuttons([navi('스터디그룹 만들기','groupCreate','wp-primary'),navi('선택 그룹 보기','groupDetail')])+
      title('그룹별 학습 범위')+
      block(muted('학교·학년 또는 학원·학년은 그룹의 기준입니다. 과목은 한 가지·여러 가지·특정 단원으로 자유롭게 정하고 운영 중 수정할 수 있습니다.'))+
      localHint;
  }
  function groupCreatePage(){
    return title('새 스터디그룹 만들기','학교·학년 / 학원·학년 중 선택하여 만듭니다.')+
      '<form id="wp-create-group" class="wp-panel wp-form">'+
      institutionFields(null)+
      input('name','스터디그룹 이름','text','','예: 미적분 집중 스터디')+
      '<div class="wp-field"><span>최대 구성원</span><div>최대 5명 · 최초 구성원은 나 1명</div></div>'+
      '<button type="submit" class="wp-btn wp-primary">스터디그룹 생성</button></form>'+
      muted('동일한 기관·학년에 여러 스터디그룹을 만들 수 있습니다.')+localHint;
  }
  function groupSettingsPage(){
    const g=getGroup();
    return groupChoice()+title('스터디그룹 설정','학교·학원·학년 및 과목·범위 수정')+
      '<form id="wp-edit-group" class="wp-panel wp-form">'+
      institutionFields(g)+input('name','스터디그룹 이름','text',g.name)+
      '<div class="wp-actions"><button class="wp-btn wp-primary" type="submit">변경 내용 저장</button>'+navi('취소','groupDetail')+'</div></form>'+
      title('기존 스터디그룹 기능')+
      rowbuttons([navi('구성원 관리','groupMembers'),navi('그룹 공지','groupNotice')])+
      muted('기관 또는 과목을 변경해도 기존 그룹 ID와 자료·미션·일정·할 일·대화 기록은 그대로 유지됩니다.')+
      localHint;
  }
  function applyInstitutionFilter(){
    const root=document.querySelector('#phone #wp-filtered-groups');if(!root)return;
    const kind=state.wpInstitutionFilterType||'all';
    const grade=(state.wpInstitutionFilterGrade||'all').trim();
    const name=(state.wpInstitutionFilterName||'').trim().toLowerCase();
    let visible=0;
    root.querySelectorAll('.wp-group-card').forEach(el=>{
      const g=model.groups.find(x=>x.id===el.dataset.groupId);
      const show=!!g && (kind==='all'||g.institutionType===kind) &&
        (grade==='all'||(g.grade||'').trim()===grade) &&
        (!name||institutionName(g).toLowerCase().includes(name));
      el.hidden=!show;if(show)visible++;
    });
    const empty=document.querySelector('#phone #wp-empty-groups');
    if(empty)empty.hidden=visible>0;
  }
  function groupDetailPage(){
    const g=getGroup();if(!g)return groupsPage();
    const tab=state.wpGroupTab||'schedule';
    const tabs=[['schedule','일정'],['room','공부방'],['materials','자료'],['tasks','할 일'],['members','멤버']];
    let body='';
    if(tab==='schedule'){
      const list=sessionsFor(g.id);
      body=title('그룹 공동 일정',list.length+'개')+
        (list.length?list.map(s=>sessionCard(s,true)).join(''):block(muted('아직 그룹 일정이 없습니다.'))) +
        rowbuttons([navi('새 공동 일정','calendarAdd','wp-primary'),navi('전체 캘린더','calendar')]);
    }else if(tab==='room'){
      const next=upcoming(g.id);
      body=title('그룹 공부방',g.members.length+'명')+
        block('<div class="wp-participant-strip">'+g.members.map((name,i)=>'<span class="wp-avatar" title="'+esc(name)+'">'+esc(name[0]||'나')+'</span>').join('')+'</div>'+
        '<strong>'+esc(next?next.title:'아직 예약된 공동학습이 없습니다.')+'</strong>'+
        muted('갤러리·발표자·공유자료·화이트보드를 한 세션에서 전환합니다.')+
        rowbuttons([next?act('공부방 열기','enterSession',next.id,'wp-primary'):navi('공동 일정 만들기','calendarAdd','wp-primary'),navi('그룹 채팅','groupMessages')]))+
        localHint;
    }else if(tab==='materials'){
      const docs=materialsFor(g.id);
      body=title('그룹 자료함',docs.length+'개')+
        (docs.length?docs.map(d=>line(d.title,'자료번호 '+d.id,act('확인','viewMaterial',d.id))).join(''):block(muted('문제은행의 자료 상세에서 그룹에 공유하면 이곳에 표시됩니다.'))) +
        rowbuttons([navi('자료함 전체','groupMaterials'),navi('문제은행','bankSearch','wp-primary')]);
    }else if(tab==='tasks'){
      const tasks=tasksFor(g.id);
      body=title('그룹 할 일',tasks.length+'개')+
        (tasks.length?tasks.map(t=>line((t.done?'✓ ':'○ ')+t.title,t.assignee+' · '+t.date,act(t.done?'완료 취소':'완료','toggleTask',t.id))).join(''):block(muted('그룹 공동 과제가 없습니다.'))) +
        rowbuttons([navi('할 일 추가','todoAdd','wp-primary'),navi('할 일 전체','todo')]);
    }else{
      body=title('그룹 구성원',g.members.length+'/5명')+
        g.members.map((name,i)=>line(name,i===0?'그룹 생성자':'구성원')).join('')+
        rowbuttons([navi('구성원 관리','groupMembers','wp-primary'),navi('그룹 메시지','groupMessages')]);
    }
    return groupChoice()+
      '<section class="wp-group-hero"><strong>'+esc(g.name)+'</strong><p>'+esc(institutionLine(g))+' · '+g.members.length+'/5명</p><p>'+esc(subjectsLabel(g))+'</p>'+
      '<div class="wp-mini-metrics"><span>참여 '+g.members.length+'명</span><span>일정 '+sessionsFor(g.id).length+'개</span><span>할 일 '+tasksFor(g.id).length+'개</span></div></section>'+
      '<nav class="wp-tabs" aria-label="그룹 내부 메뉴">'+tabs.map(([id,label])=>act(label,'groupTab',id,id===tab?'wp-active':'')).join('')+'</nav>'+
      '<section class="wp-tab-content">'+body+'</section>'+
      title('기존 열품타 그룹 기능')+
      '<div class="wp-quick-links">'+navi('그룹 미션','groupMissions')+navi('그룹 랭킹','groupRanking')+
      navi('공지사항','groupNotice')+navi('그룹 설정','groupSettings')+'</div>';
  }
  function membersPage(){
    const g=getGroup();return groupChoice()+title('그룹 구성원',g.members.length+'/5명')+
      g.members.map((name,i)=>line(name,i===0?'그룹 생성자':'구성원',i>0?act('제외','removeMember',String(i)):'')).join('')+
      (g.members.length<5?'<div class="wp-panel wp-form">'+
      input('memberName','그룹원 이름','text','','표시할 이름')+act('구성원 추가','addMember','','wp-primary')+'</div>':block(muted('최대 5명까지 참여할 수 있습니다.')))+
      muted('이 화면의 구성원 변경은 브라우저 내부 UI 확인용이며 실제 사용자 초대는 전송되지 않습니다.')+
      rowbuttons([navi('그룹으로','groupDetail'),navi('그룹 채팅','groupMessages')]);
  }
  function groupQuestionsPage(){
    const g=getGroup(),messages=model.chats[g.id]||[];
    return groupChoice()+title('질문하기',g.name)+
      block('<strong>스터디그룹의 질문</strong>'+
        muted('음성·사진·문제·자료는 모두 질문의 방법입니다. 지금은 텍스트 질문을 기록할 수 있으며 AI의 자동 답변은 아직 연결되지 않았습니다.'))+
      '<div class="wp-chat-log" role="log" aria-label="스터디그룹 질문 내역">'+
      (messages.length?messages.map(x=>'<div class="wp-bubble"><small>'+esc(x.by)+' · '+esc(x.at)+'</small><p>'+esc(x.text)+'</p></div>').join(''):
      muted('아직 이 스터디그룹에서 기록한 질문이 없습니다.'))+'</div>'+
      '<div class="wp-compose"><input id="wp-chat-input" type="text" placeholder="AI 방장에게 궁금한 점 질문하기" maxlength="500" />'+
      act('질문 기록','sendChat','','wp-primary')+'</div>'+
      rowbuttons([navi('스터디그룹','groupDetail'),navi('학습','groupLearning')])+localHint;
  }
  function messagesPage(){return groupQuestionsPage();}
  function groupLearningPage(){
    const g=getGroup(),tab=state.wpLearningTab||'assignments';
    const tabs=[['assignments','숙제·미션'],['materials','자료'],['exams','시험']];
    let body='';
    if(tab==='assignments'){
      const list=tasksFor(g.id);
      body=title('숙제·미션',list.length+'건')+
        (list.length?list.map(t=>'<div class="wp-task-row">'+act(t.done?'✓':'○','toggleTask',t.id,'wp-check')+
        '<div><strong class="'+(t.done?'wp-done':'')+'">'+esc(t.title)+'</strong><small>'+esc(t.assignee)+' · '+esc(t.date)+'</small></div></div>').join(''):
        block(muted('등록된 그룹 숙제가 없습니다.')))+
        rowbuttons([act('숙제 추가','newHomework','','wp-primary'),navi('그룹 미션 보기','groupMissions')]);
    }else if(tab==='materials'){
      const docs=materialsFor(g.id);
      body=title('스터디그룹 자료',docs.length+'건')+
        (docs.length?docs.map(d=>line(d.title,'자료번호 '+d.id,act('확인','viewMaterial',d.id))).join(''):
        block(muted('아직 등록한 자료가 없습니다. 족보에서 필요한 문제를 찾아 스터디그룹에 공유할 수 있습니다.')))+
        rowbuttons([navi('전체 자료함','groupMaterials'),navi('족보에서 찾기','bankSearch','wp-primary')]);
    }else{
      const exams=model.exams.filter(x=>x.groupId===g.id).sort((a,b)=>a.date.localeCompare(b.date));
      body=title('스터디그룹 시험',exams.length+'건')+
        (exams.length?exams.map(e=>line(e.title,e.date+' · '+(e.scope||'그룹 학습 범위'))).join(''):
        block(muted('등록된 시험 일정이 없습니다.')))+
        muted('시험 제목·범위·일정은 등록할 수 있습니다. AI 문제 출제·채점은 아직 연결되지 않았습니다.')+
        (state.wpExamForm?
          '<form id="wp-exam-form" class="wp-panel wp-form">'+
          input('title','시험 이름','text','','예: 2학기 기말 대비 확인시험')+
          input('scope','시험 범위','text',g.topics||g.subject||'','예: 미적분 1~3단원')+
          input('date','시험 날짜','date',dateStr())+
          '<button type="submit" class="wp-btn wp-primary">시험 일정 저장</button></form>':
          rowbuttons([act('시험 일정 등록','newExam','','wp-primary')]));
    }
    return groupChoice()+title('학습',esc(g.name))+
      '<nav class="wp-learning-tabs" aria-label="학습 세부 메뉴">'+
      tabs.map(([k,label])=>act(label,'learningTab',k,tab===k?'wp-active':'')).join('')+
      '</nav><section class="wp-learning-panel">'+body+'</section>'+localHint;
  }
  function materialsPage(){
    const g=getGroup(),docs=materialsFor(g.id);
    return groupChoice()+title('그룹 자료함',g.name)+
      (docs.length?docs.map(d=>block(line(d.title,'원본 자료번호 '+d.id+' · '+(d.site||'과목 미지정'),act('삭제','removeMaterial',d.id)))).join(''):block(muted('저장된 자료가 없습니다. 족보닷컴 문제 상세에서 자료를 그룹에 공유해 주세요.')))+
      rowbuttons([navi('족보닷컴 문제은행','bankSearch','wp-primary'),navi('그룹 상세','groupDetail')])+
      muted('현재 공개자료의 제목·번호를 공유합니다. 미확보 문제 본문이나 유료 PDF를 생성하지 않습니다.');
  }
  function calendarPageNew(){
    const m=state.wpMonth||dateStr().slice(0,7);
    const [y,mo]=m.split('-').map(Number),first=new Date(y,mo-1,1).getDay(),days=new Date(y,mo,0).getDate();
    const mode=state.wpCalMode||'all',picked=state.wpDay||dateStr();
    const visible=model.sessions.filter(s=>{
      if(mode==='personal')return !s.groupId;
      if(mode==='group')return s.groupId===model.activeGroupId;
      if(mode==='shared')return !!s.groupId && s.groupId===model.activeGroupId;
      return !s.groupId||s.groupId===model.activeGroupId;
    });
    const dayItems=visible.filter(s=>s.date===picked).sort((a,b)=>a.start.localeCompare(b.start));
    let daysHtml=['일','월','화','수','목','금','토'].map(x=>'<span class="wp-weekday">'+x+'</span>').join('');
    for(let k=0;k<first;k++)daysHtml+='<span class="wp-date-placeholder"></span>';
    for(let d=1;d<=days;d++){
      const ds=m+'-'+String(d).padStart(2,'0');
      daysHtml+='<button type="button" class="wp-day '+(picked===ds?'wp-active':'')+'" data-wp="pickDay" data-value="'+ds+'"><span>'+d+'</span>'+(visible.some(x=>x.date===ds)?'<i aria-label="일정 있음"></i>':'')+'</button>';
    }
    return groupChoice()+
      '<div class="wp-month-head">'+act('‹','monthPrev')+'<strong>'+y+'년 '+mo+'월</strong>'+act('›','monthNext')+'</div>'+
      '<div class="wp-filter-row">'+[['all','전체'],['group','그룹'],['personal','내 일정'],['shared','그룹 공유']].map(([k,label])=>act(label,'calendarMode',k,k===mode?'wp-active':'')).join('')+'</div>'+
      '<div class="wp-calendar" aria-label="'+esc(m)+' 일정 달력">'+daysHtml+'</div>'+
      title(picked+' 일정',dayItems.length+'개')+
      (dayItems.length?dayItems.map(x=>sessionCard(x,false)).join(''):block(muted('이 날짜에 등록된 일정이 없습니다.')))+
      rowbuttons([navi('그룹·개인 일정 만들기','calendarAdd','wp-primary'),navi('그룹으로 이동','groupDetail')])+
      localHint;
  }
  function calendarAddPage(){
    const g=getGroup();const dates=state.wpDay||dateStr();
    return groupChoice()+title('공동학습·개인 일정 만들기')+
      '<form id="wp-session-form" class="wp-panel wp-form">'+
      options('groupId','일정 구분',[['','나만 보기'],...model.groups.map(x=>[x.id,x.name])],state.wpNewScope==='personal'?'':g.id)+
      input('title','일정 제목','text','','예: 수학 함수 공동학습')+
      '<div class="wp-fields-two">'+input('date','날짜','date',dates)+input('start','시작 시간','time','19:00')+'</div>'+
      '<div class="wp-fields-two">'+input('end','종료 시간','time','20:00')+options('repeat','반복',[['없음','반복 없음'],['매일','매일'],['매주','매주'],['매월','매월']],'없음')+'</div>'+
      '<div class="wp-field"><span>참석 대상</span><div class="wp-muted">그룹 일정을 선택하면 해당 그룹의 구성원이 기본 참석자로 등록됩니다. 개인 일정에는 나만 포함됩니다.</div></div>'+
      '<div class="wp-field"><span>연결 자료</span><div class="wp-muted">문제은행에서 공유한 자료는 일정 상세 화면에서 연결할 수 있습니다.</div></div>'+
      '<div class="wp-actions"><button type="submit" class="wp-btn wp-primary">일정 저장</button>'+navi('취소','calendar')+'</div></form>'+localHint;
  }
  function sessionPage(){
    const s=getSession();if(!s)return groupDetailPage();
    const g=s.groupId?getGroup(s.groupId):null;
    const attached=(s.paperIds||[]).map(id=>materialsFor(s.groupId).find(x=>x.id===id)).filter(Boolean);
    const groupDocs=s.groupId?materialsFor(s.groupId):[];
    return title('공동학습 일정 상세')+
      block('<strong class="wp-session-title">'+esc(s.title)+'</strong>'+line('일정',s.date+' · '+s.start+'~'+s.end)+
        line('그룹',g?g.name:'개인')+line('반복',s.repeat||'없음')+line('참석 대상',(s.attendees||[]).join(', ')||'나')+
        '<div class="wp-section-spacer">'+title('연결 자료',attached.length+'개')+
        (attached.length?attached.map(x=>line(x.title,'자료번호 '+x.id)).join(''):muted('연결된 자료가 없습니다.'))+'</div>'+
        (groupDocs.length?'<label class="wp-field"><span>그룹 자료 연결</span><select id="wp-attach-select"><option value="">자료를 선택하세요</option>'+groupDocs.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+'</option>').join('')+'</select></label>'+act('자료 연결','attachMaterial'):'')+
        rowbuttons([act('공부방 열기','enterSession',s.id,'wp-primary'),navi('캘린더','calendar')]))+
      title('이 일정의 할 일')+
      (model.tasks.filter(x=>x.sessionId===s.id).map(t=>line((t.done?'✓ ':'○ ')+t.title,t.assignee,act('상태 변경','toggleTask',t.id))).join('')||block(muted('등록된 과제가 없습니다.')))+
      rowbuttons([navi('할 일 추가','todoAdd'),navi('문제은행','bankSearch')]);
  }
  function roomPage(){
    const s=getSession();if(!s)return block(muted('공부방에 연결된 일정이 없습니다.'))+navi('그룹 상세','groupDetail');
    const g=s.groupId?getGroup(s.groupId):null;
    const members=(s.attendees&&s.attendees.length?s.attendees:g?.members)||['나'];
    const mode=state.wpRoomMode||'gallery';
    const panel=state.wpRoomPanel||'none';
    const list=materialsFor(s.groupId);
    const tiles=(mode==='speaker'&&members.length>1?members.slice(0,1):members).slice(0,5);
    const roomTabs=[['gallery','갤러리'],['speaker','발표자'],['materials','자료'],['whiteboard','화이트보드']];
    let center='';
    if(mode==='gallery'||mode==='speaker'){
      center='<div class="wp-video-grid '+(tiles.length===1?'wp-video-single':'')+'">'+tiles.map((name,i)=>
        '<div class="wp-video-tile"><span class="wp-video-icon" aria-hidden="true">◯</span><small>'+esc(name)+'</small>'+
        '<span class="wp-video-badge">'+(i===0?(state.wpMic?'마이크 켜짐':'마이크 꺼짐'):'연결 대기')+'</span></div>').join('')+'</div>'+
        (mode==='speaker'&&members.length>1?'<div class="wp-side-participants">'+members.slice(1).map(x=>chip(x)).join('')+'</div>':'');
    }else if(mode==='materials'){
      center='<div class="wp-room-docs">'+title('학습 자료 공유')+
        (list.length?list.map(x=>line(x.title,'자료번호 '+x.id)).join(''):muted('공유된 자료가 없습니다.'))+
        muted('원본에서 열람할 수 없는 문제 PDF는 이 화면에서 만들어 표시하지 않습니다.')+
        navi('문제은행','bankSearch')+'</div>';
    }else{
      center='<div class="wp-board-wrapper">'+title('공동 화이트보드 화면')+
      '<canvas id="wp-board" width="800" height="450" aria-label="브라우저에 저장되는 필기 영역"></canvas>'+
      rowbuttons([act('필기 지우기','clearBoard'),navi('전체 화면','groupWhiteboard')])+'</div>';
    }
    let panelHtml='';
    if(panel==='chat'){
      const msgs=model.chats[s.groupId]||[];
      panelHtml='<div class="wp-room-panel">'+title('그룹 채팅')+
        '<div class="wp-chat-log">'+msgs.map(x=>'<p><b>'+esc(x.by)+': </b>'+esc(x.text)+'</p>').join('')+'</div>'+
        '<div class="wp-compose"><input id="wp-chat-input" placeholder="메시지 입력"/>'+act('전송','sendChat','','wp-primary')+'</div></div>';
    }else if(panel==='people'){
      panelHtml='<div class="wp-room-panel">'+title('참석자',members.length+'/5명')+
        members.map(x=>line(x,'영상 연결 상태는 외부 통신 서비스에서 표시')).join('')+'</div>';
    }else if(panel==='share'){
      panelHtml='<div class="wp-room-panel">'+title('화면 공유')+
        muted('화면공유 기능은 별도 개발 중인 영상 연결 서비스와 연동할 화면입니다.')+
        rowbuttons([act('자료 탭 열기','roomMode','materials'),act('공유 패널 닫기','roomPanel','none')])+'</div>';
    }else if(panel==='more'){
      panelHtml='<div class="wp-room-panel">'+title('더보기')+
       rowbuttons([act('손들기 '+(state.wpHand?'취소':''),'toggleHand'),act('발표자 보기','roomMode','speaker'),act('그룹 자료함','roomMode','materials')])+'</div>';
    }
    const enterAt=state.wpEnterAt||Date.now();
    return '<div class="wp-room-header"><div><strong>'+esc(s.title)+'</strong><small>'+esc(g?g.name:'개인 공부방')+' · '+esc(s.date)+'</small></div><span id="wp-elapsed" data-start="'+enterAt+'">00:00</span></div>'+
      '<div class="wp-room-notice">UI 연결 화면 · 실제 영상·음성·화면공유는 외부 통신 기능 연결 전입니다.</div>'+
      '<nav class="wp-room-tabs">'+roomTabs.map(([id,t])=>act(t,'roomMode',id,id===mode?'wp-active':'')).join('')+'</nav>'+
      center+
      '<div class="wp-room-toolbar">'+
      act(state.wpMic?'마이크 켬':'마이크 끔','toggleMic','',state.wpMic?'wp-active':'')+
      act(state.wpCam?'카메라 켬':'카메라 끔','toggleCam','',state.wpCam?'wp-active':'')+
      act('참석자','roomPanel','people')+
      act('채팅','roomPanel','chat')+
      act('공유','roomPanel','share')+
      act('더보기','roomPanel','more')+
      '</div>'+panelHtml+
      rowbuttons([act('공부방 나가기','leaveSession','','wp-danger'),act('그룹으로','exitRoom')]);
  }
  function whiteboardPage(){
    const s=getSession();
    return title('화이트보드',s?.title||'개인 필기')+
      '<div class="wp-board-wrapper"><canvas id="wp-board" width="800" height="600" aria-label="로컬 필기"></canvas>'+
      rowbuttons([act('모두 지우기','clearBoard'),navi('공부방으로','groupLiveRoom')])+'</div>'+
      muted('필기는 이 브라우저에서만 저장됩니다. 다른 사람에게 실시간 전송되지 않습니다.');
  }
  function summaryPage(){
    const s=getSession();const last=model.studyLogs.filter(x=>x.sessionId===s?.id).at(-1);
    return title('학습 결과','이 기기에서 기록된 내용만 표시')+
      block(line('학습 일정',s?.title||'등록된 일정 없음')+
        line('내 체류시간',last?Math.floor(last.seconds/60)+'분 '+last.seconds%60+'초':'기록 없음')+
        line('그룹',s?.groupId?getGroup(s.groupId)?.name||'-':'개인')+
        line('공유자료 수',(s?.paperIds||[]).length+'개'))+
      rowbuttons([navi('그룹으로','groupDetail','wp-primary'),navi('다음 할 일 작성','todoAdd'),navi('캘린더','calendar')])+
      localHint;
  }
  function todoPageNew(){
    const mode=state.wpTaskMode||'group';
    let list=model.tasks.filter(t=>mode==='personal'?!t.groupId:mode==='mine'?t.assignee==='나':t.groupId===model.activeGroupId);
    return groupChoice()+
      '<div class="wp-filter-row">'+[['group','그룹 할 일'],['mine','내가 맡은 일'],['personal','개인 할 일']].map(([k,v])=>act(v,'taskMode',k,k===mode?'wp-active':'')).join('')+'</div>'+
      title('할 일 목록',list.length+'개')+
      (list.length?list.map(t=>'<div class="wp-task-row">'+act(t.done?'✓':'○','toggleTask',t.id,'wp-check')+
      '<div><strong class="'+(t.done?'wp-done':'')+'">'+esc(t.title)+'</strong><small>'+esc(t.assignee)+' · '+esc(t.date)+(t.sessionId?' · 공동학습 연결':'')+'</small></div></div>').join(''):block(muted('이 범위에 등록된 할 일이 없습니다.')))+
      rowbuttons([navi('할 일 추가','todoAdd','wp-primary'),navi('그룹 상세','groupDetail')])+
      localHint;
  }
  function todoAddPage(){
    const g=getGroup();
    return title('할 일 추가')+
      '<form id="wp-task-form" class="wp-panel wp-form">'+
      input('title','과제 제목','text','','예: 수학 문제 20개')+
      options('groupId','소속',[['','개인 비공개'],...model.groups.map(x=>[x.id,x.name])],state.wpTaskMode==='personal'?'':g.id)+
      input('assignee','담당자 이름','text','나')+
      input('date','기한','date',state.wpDay||dateStr())+
      '<div class="wp-actions"><button class="wp-btn wp-primary" type="submit">저장</button>'+navi('취소','todo')+'</div></form>'+localHint;
  }
  function groupPageNew(id){
    if(id==='groups'||id==='groupSearch')return groupsPage();
    if(id==='groupCreate')return groupCreatePage();
    if(id==='groupDetail')return groupDetailPage();
    if(id==='groupSettings')return groupSettingsPage();
    if(id==='groupMembers'||id==='groupMemberSettings')return membersPage();
    if(id==='groupMessages'||id==='groupQuestions')return groupQuestionsPage();
    if(id==='groupLearning')return groupLearningPage();
    if(id==='groupMaterials')return materialsPage();
    if(id==='groupSessionDetail')return sessionPage();
    if(id==='groupLiveRoom')return roomPage();
    if(id==='groupWhiteboard')return whiteboardPage();
    if(id==='groupSessionSummary')return summaryPage();
    return null;
  }
  Object.entries(NEW_PAGES).forEach(([key,tt])=>{
    window.YPT_GRAPH[key]={title:tt,evidence:[],actions:[{text:'그룹으로 이동',go:'groupDetail'}]};
    if(!GROUPS['스터디 그룹'].includes(key))GROUPS['스터디 그룹'].push(key);
  });
  const priorHome=homePage, priorGroup=groupPage,priorCal=calendarPage,priorTodo=todoPage,priorBottom=bottomFor;
  const priorGo=go,priorBack=back,priorRender=render;
  homePage=function(){
    const old=priorHome();
    const pos=old.indexOf('<div class="eyeline"><h3>스터디 그룹</h3>');
    return title('내 학습', '공부시간 · 개인 할 일 · 캘린더')+
      rowbuttons([navi('캘린더','calendar'),navi('할 일','todo')])+
      groupOverview()+title('학습 기록 · 열품타')+(pos>=0?old.slice(0,pos):old);
  };
  groupPage=function(id){const page=groupPageNew(id);return page!==null?page:priorGroup(id);};
  calendarPage=function(id){return id==='calendar'?calendarPageNew():id==='calendarAdd'?calendarAddPage():priorCal(id);};
  todoPage=function(id){return ['todo','todoDay','todoWeek','todoMonth'].includes(id)?todoPageNew():id==='todoAdd'?todoAddPage():priorTodo(id);};
  bottomFor=function(id){
    if(['welcome','signin','signup'].includes(id)||id.startsWith('external_')||
       ['groupLiveRoom','groupWhiteboard'].includes(id))return '';
    const active=id.startsWith('bank')?'bankSearch':
      ['groupQuestions','groupMessages'].includes(id)?'groupQuestions':
      ['groupLearning','groupMaterials','groupTaskDetail'].includes(id)?'groupLearning':
      id.startsWith('group')||id==='groups'?'groups':'home';
    const nav=[
      ['groups','스터디그룹','navigation/bottom_group_fill.svg'],
      ['groupQuestions','질문하기',null],
      ['groupLearning','학습',null],
      ['bankSearch','족보',null],
      ['home','내 학습','navigation/bottom_home_fill.svg']
    ];
    return '<nav class="bottomnav zb-five wp-study-nav" aria-label="하단 내비게이션">'+
      nav.map(([id,label,path])=>
        '<button type="button" class="'+(active===id?'selected':'')+'" data-go="'+id+'" aria-label="'+label+'">'+
        (path?image(path):'<span class="wp-nav-glyph" aria-hidden="true">'+(id==='groupQuestions'?'?':id==='groupLearning'?'▤':'▦')+'</span>')+
        '<span>'+label+'</span></button>').join('')+'</nav>';
  };
  function contextUrl(){
    const q=new URLSearchParams(location.search);
    q.set('screen',state.screen);
    if(model.activeGroupId)q.set('group',model.activeGroupId);
    if(model.activeSessionId)q.set('session',model.activeSessionId);
    if(state.zocbo?.paperId)q.set('paper',state.zocbo.paperId);
    history.replaceState(null,'','?'+q.toString());
  }
  go=function(id){priorGo(id);contextUrl();};
  back=function(){priorBack();contextUrl();};
  render=function(){priorRender();decorateBank();prepareCanvas();applyInstitutionFilter();};
  const args=new URLSearchParams(location.search);
  if(args.get('group')&&getGroup(args.get('group')))model.activeGroupId=args.get('group');
  if(args.get('session')&&getSession(args.get('session')))model.activeSessionId=args.get('session');
  if(NEW_PAGES[args.get('screen')])state.screen=args.get('screen');
  state.wpMonth=dateStr().slice(0,7);
  state.wpDay=dateStr();
  state.wpGroupTab='schedule';
  state.wpCalMode='all';state.wpTaskMode='group';
  state.wpRoomMode='gallery';state.wpRoomPanel='none';
  state.wpMic=false;state.wpCam=false;state.wpHand=false;
  function currentPaper(){
    const z=state.zocbo||{};
    if(z.fSelected?.id)return {id:String(z.fSelected.id),title:z.fSelected.title||'원본 학습자료',site:z.fSite||'',school:z.fDisplay?.filter_sch||''};
    if(z.fGangnamPaper){
      const title=document.querySelector('#phone .zb-f-gangnam-detail h3')?.textContent?.trim()||'강남 3구 원본 자료';
      return {id:String(z.fGangnamPaper),title,site:z.fSite||'',school:z.fGangnamSchool||''};
    }
    return null;
  }
  function decorateBank(){
    const root=document.querySelector('#phone .app');
    if(!root)return;
    const detail=root.querySelector('.zb-f-sheet[role="dialog"], .zb-f-gangnam-detail[role="dialog"]');
    if(detail&&!detail.querySelector('[data-wp="sharePaper"]')&&currentPaper()){
      const btn=document.createElement('button');
      btn.type='button';btn.className='wp-btn wp-bank-share';btn.dataset.wp='sharePaper';btn.textContent='HITEL 그룹 자료함에 공유';
      detail.appendChild(btn);
    }
  }
  function showPaperPicker(){
    const paper=currentPaper();
    if(!paper){toast('선택된 원본 자료가 없습니다.');return;}
    const host=document.querySelector('#phone .app');if(!host)return;
    document.getElementById('wp-paper-picker')?.remove();
    const overlay=document.createElement('div');
    overlay.id='wp-paper-picker';overlay.className='wp-picker-backdrop';
    overlay.innerHTML='<div class="wp-picker-card" role="dialog" aria-modal="true" aria-label="그룹 자료 공유">'+
      title('자료를 공유할 그룹')+
      '<p class="wp-muted">'+esc(paper.title)+' · 원본 번호 '+esc(paper.id)+'</p>'+
      model.groups.map(g=>act(g.name,'confirmPaper',g.id)).join('')+
      act('취소','closePicker')+
      '</div>';
    host.appendChild(overlay);state.wpPendingPaper=paper;
  }
  function prepareCanvas(){
    const canvas=document.getElementById('wp-board');
    if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const key=model.activeSessionId||'personal',strokes=model.boards[key]||[];
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.lineWidth=3;ctx.lineCap='round';ctx.strokeStyle='#35383e';
    for(const arr of strokes){if(!arr.length)continue;ctx.beginPath();arr.forEach(([x,y],i)=>i?ctx.lineTo(x*canvas.width,y*canvas.height):ctx.moveTo(x*canvas.width,y*canvas.height));ctx.stroke();}
    let current=null;
    function pt(ev){const r=canvas.getBoundingClientRect();return [Math.min(1,Math.max(0,(ev.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(ev.clientY-r.top)/r.height))];}
    canvas.onpointerdown=ev=>{ev.preventDefault();canvas.setPointerCapture(ev.pointerId);current=[pt(ev)];ctx.beginPath();ctx.moveTo(current[0][0]*canvas.width,current[0][1]*canvas.height);};
    canvas.onpointermove=ev=>{if(!current)return;const [x,y]=pt(ev);current.push([x,y]);ctx.lineTo(x*canvas.width,y*canvas.height);ctx.stroke();};
    canvas.onpointerup=()=>{if(!current)return;(model.boards[key]||(model.boards[key]=[])).push(current);current=null;save();};
    canvas.onpointercancel=()=>{current=null;};
  }
  const mutate=new MutationObserver(()=>decorateBank());
  mutate.observe(document.getElementById('phone'),{childList:true,subtree:true});
  function toastWp(message){toast(message);}
  function openSession(id){
    const session=getSession(id);if(!session){toastWp('일정을 찾을 수 없습니다.');return;}
    model.activeSessionId=id;
    if(session.groupId)model.activeGroupId=session.groupId;
    save();go('groupSessionDetail');
  }
  function enterSession(id){
    const session=getSession(id);if(!session){toastWp('등록된 일정이 없습니다.');return;}
    model.activeSessionId=id;if(session.groupId)model.activeGroupId=session.groupId;
    state.wpRoomMode='gallery';state.wpRoomPanel='none';state.wpEnterAt=Date.now();save();go('groupLiveRoom');
  }
  function endSession(){
    const s=getSession();
    if(s&&state.wpEnterAt){
      model.studyLogs.push({id:newId('log'),sessionId:s.id,groupId:s.groupId,day:dateStr(),seconds:Math.max(0,Math.floor((Date.now()-state.wpEnterAt)/1000))});
      save();
    }
    state.wpEnterAt=null;go('groupSessionSummary');
  }
  function handle(action,value,btn){
    const g=getGroup();
    if(action==='chooseGroup'){if(!getGroup(value))return;model.activeGroupId=value;state.wpGroupTab='schedule';save();go('groupDetail');return;}
    if(action==='groupTab'){state.wpGroupTab=value;render();return;}
    if(action==='learningTab'){state.wpLearningTab=value;state.wpExamForm=false;render();return;}
    if(action==='newExam'){state.wpExamForm=true;render();return;}
    if(action==='newHomework'){state.wpTaskOrigin='groupLearning';state.wpTaskMode='group';go('todoAdd');return;}
    if(action==='addMember'){
      const input=document.querySelector('[name="memberName"]'),v=input?.value.trim();
      if(!v){toastWp('구성원 이름을 입력해 주세요.');return;}
      if(g.members.length>=5){toastWp('그룹은 최대 5명입니다.');return;}
      if(g.members.includes(v)){toastWp('이미 등록된 이름입니다.');return;}
      g.members.push(v);save();render();return;
    }
    if(action==='removeMember'){const n=Number(value);if(n<=0||n>=g.members.length)return;g.members.splice(n,1);save();render();return;}
    if(action==='openSession'){openSession(value);return;}
    if(action==='enterSession'){enterSession(value);return;}
    if(action==='roomMode'){state.wpRoomMode=value;state.wpRoomPanel='none';render();return;}
    if(action==='roomPanel'){state.wpRoomPanel=state.wpRoomPanel===value?'none':value;render();return;}
    if(action==='toggleMic'){state.wpMic=!state.wpMic;render();return;}
    if(action==='toggleCam'){state.wpCam=!state.wpCam;render();return;}
    if(action==='toggleHand'){state.wpHand=!state.wpHand;render();return;}
    if(action==='exitRoom'){endSession();go('groupDetail');return;}
    if(action==='leaveSession'){endSession();return;}
    if(action==='clearBoard'){model.boards[model.activeSessionId||'personal']=[];save();render();return;}
    if(action==='monthPrev'||action==='monthNext'){
      const [yr,m]=state.wpMonth.split('-').map(Number),d=new Date(yr,m-1+(action==='monthPrev'?-1:1),1);
      state.wpMonth=dateStr(d).slice(0,7);render();return;
    }
    if(action==='pickDay'){state.wpDay=value;render();return;}
    if(action==='calendarMode'){state.wpCalMode=value;render();return;}
    if(action==='taskMode'){state.wpTaskMode=value;render();return;}
    if(action==='toggleTask'){const t=model.tasks.find(x=>x.id===value);if(t){t.done=!t.done;save();render();}return;}
    if(action==='sendChat'){
      const input=document.getElementById('wp-chat-input');const txt=input?.value.trim();if(!txt)return;
      const s=getSession(),id=state.screen==='groupLiveRoom'&&s?.groupId?s.groupId:g.id;
      (model.chats[id]||(model.chats[id]=[])).push({by:'나',text:txt,at:new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})});
      save();render();return;
    }
    if(action==='attachMaterial'){
      const s=getSession(),id=document.getElementById('wp-attach-select')?.value;
      if(!s||!id)return;
      if(!s.paperIds)s.paperIds=[];
      if(!s.paperIds.includes(id))s.paperIds.push(id);
      save();render();return;
    }
    if(action==='viewMaterial'){toastWp('원본 자료번호 '+value+' — 문제은행에서 원본 사이트 링크를 확인해 주세요.');return;}
    if(action==='removeMaterial'){model.materials[g.id]=(model.materials[g.id]||[]).filter(x=>x.id!==value);save();render();return;}
    if(action==='sharePaper'){showPaperPicker();return;}
    if(action==='closePicker'){document.getElementById('wp-paper-picker')?.remove();return;}
    if(action==='confirmPaper'){
      const paper=state.wpPendingPaper;
      if(!paper||!getGroup(value))return;
      const docs=model.materials[value]||(model.materials[value]=[]);
      if(!docs.some(x=>x.id===paper.id))docs.push(clone(paper));
      save();document.getElementById('wp-paper-picker')?.remove();
      toastWp('그룹 자료함에 원본 자료번호가 저장되었습니다.');
      return;
    }
    if(action==='newPersonalSession'){state.wpNewScope='personal';go('calendarAdd');return;}
  }
  document.addEventListener('click',ev=>{
    const el=ev.target.closest('button[data-wp]');if(!el)return;
    ev.preventDefault();ev.stopPropagation();handle(el.dataset.wp,el.dataset.value||'',el);
  },true);
  document.addEventListener('input',ev=>{
    if(ev.target.matches('#phone #wp-filtered-groups'))return;
    if(ev.target.name==='wpNameFilter'){
      state.wpInstitutionFilterName=ev.target.value;applyInstitutionFilter();
    }
  });
  document.addEventListener('change',ev=>{
    if(ev.target.name==='wpTypeFilter'){state.wpInstitutionFilterType=ev.target.value;applyInstitutionFilter();return;}
    if(ev.target.name==='wpGradeFilter'){state.wpInstitutionFilterGrade=ev.target.value;applyInstitutionFilter();return;}
    if(ev.target.id==='wp-group-switch'){
      const val=ev.target.value;if(!getGroup(val))return;
      model.activeGroupId=val;save();state.wpGroupTab='schedule';contextUrl();render();return;
    }
  });
  document.addEventListener('submit',ev=>{
    const form=ev.target;if(!form.id?.startsWith('wp-'))return;
    ev.preventDefault();
    const d=Object.fromEntries(new FormData(form).entries());
    if(form.id==='wp-exam-form'){
      if(!(d.title||'').trim()||!d.date){toastWp('시험 이름과 날짜를 확인해 주십시오.');return;}
      model.exams.push({id:newId('exam'),groupId:model.activeGroupId,title:d.title.trim(),
        date:d.date,scope:(d.scope||'').trim()});
      state.wpExamForm=false;save();state.wpLearningTab='exams';render();return;
    }
    if(form.id==='wp-create-group'||form.id==='wp-edit-group'){
      const name=(d.name||'').trim(),institute=(d.institutionName||'').trim(),grade=(d.grade||'').trim();
      const type=d.institutionType==='academy'?'academy':'school';
      if(!institute){toastWp(instituteTypeName(type)+' 이름을 입력해 주십시오.');return;}
      if(!grade){toastWp('학년을 입력해 주십시오.');return;}
      if(!name){toastWp('스터디그룹 이름을 입력해 주십시오.');return;}
      if(form.id==='wp-create-group'){
        const id=newId('group');
        model.groups.push({id,name,institutionType:type,institutionName:institute,school:type==='school'?institute:'',
          grade,subject:(d.subject||'').trim(),topics:(d.topics||'').trim(),members:['나'],example:false});
        model.activeGroupId=id;
      }else{
        const group=getGroup();if(!group)return;
        Object.assign(group,{name,institutionType:type,institutionName:institute,school:type==='school'?institute:'',
          grade,subject:(d.subject||'').trim(),topics:(d.topics||'').trim()});
      }
      save();state.wpGroupTab='schedule';go('groupDetail');return;
    }
    if(form.id==='wp-session-form'){
      const title=(d.title||'').trim();
      if(!title||!d.date||!d.start||!d.end){toastWp('제목·날짜·시작·종료 시간을 확인해 주세요.');return;}
      if(d.end<=d.start){toastWp('종료 시간은 시작 시간보다 뒤여야 합니다.');return;}
      const group=d.groupId?getGroup(d.groupId):null;
      const id=newId('session');
      model.sessions.push({id,groupId:group?.id||null,title,date:d.date,start:d.start,end:d.end,repeat:d.repeat||'없음',attendees:group?group.members.slice():['나'],paperIds:[],example:false});
      if(group)model.activeGroupId=group.id;
      model.activeSessionId=id;save();go('groupSessionDetail');return;
    }
    if(form.id==='wp-task-form'){
      const t=(d.title||'').trim();if(!t){toastWp('할 일 제목을 입력해 주세요.');return;}
      model.tasks.unshift({id:newId('task'),title:t,groupId:d.groupId||null,assignee:(d.assignee||'나').trim(),date:d.date||dateStr(),sessionId:state.screen==='groupSessionDetail'?model.activeSessionId:null,done:false});
      save();go('todo');return;
    }
  });
  setInterval(()=>{
    const el=document.getElementById('wp-elapsed');
    if(!el||!state.wpEnterAt)return;
    const seconds=Math.floor((Date.now()-state.wpEnterAt)/1000);
    el.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  },1000);
  save();contextUrl();render();
  window.HITEL_WORKPLACE_INSPECT=()=>({
    status:'UI_LOCAL_ONLY',activeGroupId:model.activeGroupId,
    activeSessionId:model.activeSessionId,groupCount:model.groups.length,
    selectedGroupMembers:getGroup()?.members.length,sessionCount:model.sessions.length,
    taskCount:model.tasks.length,materialCount:materialsFor().length,
    screen:state.screen,bottomNavCount:document.querySelectorAll('#phone .bottomnav').length
  });
})();
