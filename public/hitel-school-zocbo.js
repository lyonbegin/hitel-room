/* HITEL School Zocbo ↔ Learning Class, 2026-11-11
 * This is an additive UI to the faithful Zocbo original.
 * Existing M/H, city, school, grade, subject, middle/final and source DOM remain intact.
 * Only a real source paper ID is accepted as source evidence.
 * Question body and teacher AI grading are NOT faked.
 */
(function(){
'use strict';
const UI=window.ZOCBOUI,WP=window.HITEL_WORKPLACE_BRIDGE;
if(!UI||!WP||!window.YPT_GRAPH)return;
const model=WP.getModel(),oldPage=UI.page,oldGroupPage=groupPage;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const own=()=>Array.isArray(model.groups)?model.groups.filter(g=>g?.members?.includes('나')):[];
const schoolOf=g=>String(g?.school||g?.institutionName||'').trim();
const classes=()=>own().filter(g=>/^[중고][123]$/.test(g.grade||'')&&schoolOf(g));
const subject=g=>String(g?.subject||'').split(/[,·/]/)[0].trim();
const normSchool=s=>String(s||'').trim().replace(/\s/g,'').replace(/(고등학교|중학교|초등학교|고|중|초)$/,'');
const metaSchool=x=>x?.category==='school'&&!!x.paperId;
const records=g=>Array.isArray(g?.examResources)?g.examResources.filter(metaSchool):[];
const questionList=g=>Array.isArray(g?.schoolExamQuestions)?g.schoolExamQuestions:[];
const answerList=g=>(g?.schoolExamAnswers&&typeof g.schoolExamAnswers==='object')?g.schoolExamAnswers:{};
const buttons=[
 ['school','학교 내신'],['mock','모의·수능'],['admission','고입 전형'],
 ['contest','경시'],['university','대학별고사'],['diagnostic','진단·평가']
];
const ui={groupId:model.activeGroupId||'',prefilledFor:'',selectedPaperKey:''};
window.YPT_GRAPH.bankSchoolPractice={title:'우리 반 기출 학습',evidence:[],actions:[{text:'족보',go:'bankSearch'}]};
function group(){return classes().find(x=>x.id===ui.groupId)||classes().find(x=>x.id===model.activeGroupId)||classes()[0]||null}
function choose(id){const g=classes().find(x=>x.id===id);if(!g)return;ui.groupId=id;ui.prefilledFor='';model.activeGroupId=id;WP.saveModel();apply(g,state);render()}
function apply(g,s){
 if(!g||!s)return false;
 const z=s.zocbo||(s.zocbo={});
 const site=g.grade.startsWith('중')?'M':'H';
 z.fSite=site;z.fGrade=g.grade.slice(1);z.fMain='school';
 z.fCase='';z.fDrawer='';z.fSelected=null;
 z.fDisplay={filter_sch:schoolOf(g),filter_grade:z.fGrade+'학년'};
 const city=String(g.region||g.city||g.si||'').trim();
 if(city)z.fDisplay.filter_si=city;
 const sub=subject(g);
 if(sub==='수학'){z.fSubject='MT';z.fDisplay.filter_subject='수학'}
 else {z.fSubject=z.fSubject||'MT';/* keep source code until its mapping is verified */}
 z.fDynamicData=null;z.fDynamicError='';z.fDynamicChanged=false;
 ui.groupId=g.id;ui.prefilledFor=g.id;
 return true;
}
function maybePrefill(s){
 const g=group();
 if(g&&ui.prefilledFor!==g.id)apply(g,s);
}
function cats(){
 return '<nav class="hsc-types" aria-label="시험 종류">'+buttons.map(([type,label])=>
 '<button type="button" data-hsc="category" data-v="'+type+'" class="'+(type==='school'?'current':'')+'">'+esc(label)+'</button>').join('')+'</nav>';
}
function shown(g){
 const n=records(g).length,count=questionList(g).length;
 return '<div class="hsc-class-card"><div class="hsc-class-top"><span>내 학습반의 기출</span><span class="hsc-count">'+n+'건 연결</span></div>'+
 '<strong>'+esc(g.name)+'</strong>'+
 '<div class="hsc-class-meta">'+[schoolOf(g),g.grade,subject(g),g.goalType].filter(Boolean).map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>'+
 '<div class="hsc-class-cta">'+
 '<button type="button" data-hsc="apply" class="hsc-primary">이 반의 검색조건 불러오기</button>'+
 '<button type="button" data-hsc="study" class="hsc-outline">연결 기출·문항 '+count+'건 보기</button></div></div>';
}
function home(s){
 maybePrefill(s);
 const groups=classes(),g=group(),linked=records(g);
 return '<section class="hsc-home" aria-label="학습반과 학교별 족보 통합">'+
 '<div class="hsc-hero"><div><span>학교별 기출 × AI 학습반</span><h2>우리 반 시험 기출 찾기</h2><p>학교별 기출을 찾고, 실제 자료번호를 학습반에 연결해 공부합니다.</p></div></div>'+
 (groups.length?
  '<div class="hsc-select-row"><label for="hsc-class-picker">학습반</label>'+
  '<select id="hsc-class-picker" aria-label="족보를 검색할 학습반 선택">'+groups.map(x=>
  '<option value="'+esc(x.id)+'"'+(g?.id===x.id?' selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></div>'+shown(g):
  '<div class="hsc-no-class"><strong>학습반을 선택해 학교별 기출을 연결해 보세요.</strong>'+
  '<p>학습반이 없으셔도 아래의 중·고등·지역·학교별 족보는 그대로 검색하실 수 있습니다.</p>'+
  '<button type="button" data-go="groups">내 학습반 보기 ›</button></div>')+
 '<div class="hsc-tabs-label"><strong>다른 시험 기출도 찾아보세요</strong></div>'+cats()+
 (g&&linked.length?'<div class="hsc-linked"><strong>우리 반에 연결된 기출</strong>'+
 linked.slice(-2).reverse().map(x=>'<button type="button" data-hsc="study" class="hsc-linked-paper"><b>'+esc(x.title||'기출시험지')+
 '</b><small>원본번호 '+esc(x.paperId)+' · 문제 본문은 별도 확보</small></button>').join('')+'</div>':'')+
 '<div class="hsc-original-heading"><h3>학교별 기출 원본 검색</h3>'+
 '<p>'+(g?esc(schoolOf(g)+' · '+g.grade+' · '+subject(g))+' 검색조건을 불러왔습니다. ':'')+
 '기존 중·고등, 지역·학교·학년·과목·중간·기말 선택을 그대로 이용합니다.</p></div>'+
 (g?'<p class="hsc-original-caution">학교명은 검색조건으로 적용됩니다. 아래 자료가 실제 해당 학교에서 출제됐는지는 원본 자료를 확인해 주세요.</p>':'')+
 '</section>';
}
function teacherGroupCard(g){
 const linked=records(g),list=questionList(g),answers=answerList(g);
 const completed=list.filter(q=>answers[q.id]?.response).length;
 return '<div class="hsc-group-panel"><div><small>학교별 기출 학습</small><strong>'+linked.length+'개 기출 연결 · 등록 문항 '+list.length+'개</strong>'+
 '<p>'+completed+'/'+list.length+'문항에 답안 기록 · 원문 확보 전 자료는 별도 표시</p></div>'+
 '<button type="button" data-go="bankSchoolPractice">기출 문항 학습하기 →</button></div>';
}
groupPage=function(route){
 const raw=oldGroupPage(route);
 if(!['groupDetail','groupMissionJourney'].includes(route)||typeof raw!=='string')return raw;
 const g=own().find(x=>x.id===model.activeGroupId);
 if(!g||!records(g).length)return raw;
 const extra=teacherGroupCard(g);
 return /<\/section>\s*$/.test(raw)?raw.replace(/<\/section>\s*$/,extra+'</section>'):raw+extra;
};
function study(){
 const g=group()||own().find(x=>x.id===model.activeGroupId);
 if(!g)return '<section class="hsc-study"><h2>기출 학습</h2><p>참여 중인 학습반을 먼저 선택해 주세요.</p><button data-go="groups">학습반 보기</button></section>';
 model.activeGroupId=g.id;
 const papers=records(g),questions=questionList(g),answers=answerList(g);
 const list=papers.filter(x=>!ui.selectedPaperKey||ui.selectedPaperKey===x.key);
 return '<section class="hsc-study"><button type="button" class="hsc-back" data-go="bankSearch">‹ 족보로 돌아가기</button>'+
 '<small>학습반의 기출</small><h2>'+esc(g.name)+'</h2>'+
 '<div class="hsc-study-lead"><strong>담당 AI 선생님: '+esc(g.coachName||'미지정')+'</strong>'+
 '<p>자료번호가 있는 기출을 기반으로 학생이 실제 문제를 등록하고 답안을 남깁니다. AI 자동 채점·문항 생성은 아직 연결되지 않았습니다.</p></div>'+
 '<h3>연결된 원본 기출 '+papers.length+'건</h3>'+
 (papers.length?papers.map(x=>'<div class="hsc-paper"><b>'+esc(x.title)+'</b><small>자료번호 '+esc(x.paperId)+
 ' · '+esc(x.school||schoolOf(g))+'</small>'+
 '<div><button type="button" data-hsc="paper" data-v="'+esc(x.key)+'">이 시험지 문항 보기</button>'+
 (/^https:\/\/(?:m\.|www\.)?zocbo\.com\//.test(x.sourceUrl||'')?
 '<a href="'+esc(x.sourceUrl)+'" target="_blank" rel="noopener noreferrer">원본 자료 확인 ↗</a>':'')+'</div></div>').join(''):
 '<p class="hsc-empty">연결된 기출이 없습니다. 족보에서 자료번호가 확인된 기출을 선택해 연결해 주세요.</p>')+
 (papers.length?
 '<div class="hsc-add-question"><h3>기출 문항 등록</h3><p>실제 문제를 입력하거나 촬영해 등록합니다. 입력하지 않은 기출문항을 자동 생성하지 않습니다.</p>'+
 '<form id="hsc-problem-form"><label>원본 기출 선택<select name="paperKey" required>'+
 papers.map(x=>'<option value="'+esc(x.key)+'"'+(x.key===ui.selectedPaperKey?' selected':'')+'>'+esc(x.title)+' ('+esc(x.paperId)+')</option>').join('')+
 '</select></label><label>문항 번호<input name="number" placeholder="예: 7번" maxlength="30"></label>'+
 '<label>문제 내용<textarea name="prompt" maxlength="3500" rows="3" placeholder="문제를 입력하거나 아래에서 사진을 첨부하세요."></textarea></label>'+
 '<label>실제 문제 사진 (선택)<input type="file" accept="image/*" name="image" capture="environment"></label>'+
 '<label>정답 (알고 있는 경우만)<input name="answer" maxlength="250" placeholder="확인한 정답만 입력해 주세요"></label>'+
 '<button class="hsc-primary" type="submit">이 기출의 학습문항으로 등록</button></form></div>':'')+
 '<div class="hsc-question-section"><h3>기출 기반 문제풀이 · '+questions.length+'문항</h3>'+
 (questions.length?questions.filter(q=>!ui.selectedPaperKey||q.paperKey===ui.selectedPaperKey).map(q=>{
 const record=answers[q.id],src=papers.find(x=>x.key===q.paperKey);
 return '<article class="hsc-question"><div class="hsc-question-head"><b>'+esc(q.number||'기출 문항')+'</b>'+
 '<small>'+esc(src?.title||'연결된 기출')+'</small></div>'+
 (q.prompt?'<p>'+esc(q.prompt)+'</p>':'')+
 (q.photo&&/^data:image\/jpeg;base64,/.test(q.photo)?'<img src="'+q.photo+'" alt="등록된 기출 문제 사진" loading="lazy">':'')+
 '<form data-hsc-answer="'+esc(q.id)+'"><label>내 답안<input name="response" maxlength="1000" required value="'+esc(record?.response||'')+'" placeholder="풀이 결과나 답을 적어 주세요"></label>'+
 '<button type="submit">답안 기록</button></form>'+
 (record?.response?'<div class="hsc-answer-state">'+(record.status==='matched'?'등록 정답과 일치':record.status==='mismatch'?'등록 정답과 다릅니다 · 다시 검토':'답안 기록됨 · 자동 채점 미지원')+'</div>':'')+
 '<button type="button" data-ask="open" class="hsc-question-ask">✦ 이 문제를 AI에게 질문하기</button></article>'
 }).join(''):'<p class="hsc-empty">등록된 기출 문항이 없습니다.</p>')+'</div>'+
 '<p class="hsc-disclosure">문항·답안·사진은 현재 브라우저의 학습반 데이터에 저장됩니다. 여러 학생 간 실시간 공유와 실제 AI 문항 분석·채점은 아직 지원되지 않습니다.</p></section>';
}
const oldBankPage=UI.page;
UI.page=function(id,s){
 if(id==='bankSchoolPractice')return study();
 if(id==='bankSearch')return home(s)+oldBankPage(id,s);
 return oldBankPage(id,s);
};
document.addEventListener('click',event=>{
 const button=event.target.closest?.('#phone [data-hsc]');
 if(!button)return;
 event.preventDefault();event.stopPropagation();
 const action=button.dataset.hsc,v=button.dataset.v||'';
 if(action==='category'){
  if(v==='school')go('bankSearch');
  else window.HITEL_EXAM_FLOW?.chooseCategory?.(v);
  return;
 }
 if(action==='apply'){const g=group();if(g){apply(g,state);render()}return}
 if(action==='study'){ui.selectedPaperKey='';go('bankSchoolPractice');return}
 if(action==='paper'){ui.selectedPaperKey=v;render();return}
});
document.addEventListener('change',event=>{
 if(event.target?.id==='hsc-class-picker'){choose(event.target.value);return}
});
async function photoToJpeg(file){
 if(!file)return '';
 if(!file.type?.startsWith('image/'))throw Error('이미지 파일만 등록할 수 있습니다.');
 if(file.size>15000000)throw Error('이미지 원본이 너무 큽니다.');
 if(typeof createImageBitmap!=='function')throw Error('이 브라우저는 이미지 크기 조절을 지원하지 않습니다.');
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));
  const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(bitmap.width*scale));
  cv.height=Math.max(1,Math.round(bitmap.height*scale));
  cv.getContext('2d').drawImage(bitmap,0,0,cv.width,cv.height);
  const photo=cv.toDataURL('image/jpeg',.55);
  if(photo.length>700000)throw Error('사진을 더 작게 촬영해 주세요.');
  return photo;
 }finally{bitmap.close?.()}
}
document.addEventListener('submit',async event=>{
 const form=event.target;
 if(form?.id==='hsc-problem-form'){
  event.preventDefault();event.stopImmediatePropagation?.();
  const g=group(),f=new FormData(form);
  const paperKey=String(f.get('paperKey')||''),p=records(g).find(x=>x.key===paperKey);
  if(!g||!p){toast('학습반과 원본 기출을 선택해 주세요.');return}
  const prompt=String(f.get('prompt')||'').trim().slice(0,3500);
  const file=form.querySelector?.('input[type="file"]')?.files?.[0];
  if(!prompt&&!file){toast('문제 내용이나 사진을 등록해 주세요.');return}
  try{
   const photo=file?await photoToJpeg(file):'';
   if(!Array.isArray(g.schoolExamQuestions))g.schoolExamQuestions=[];
   if(g.schoolExamQuestions.length>=150){toast('등록 가능한 기출문항은 150개입니다.');return}
   g.schoolExamQuestions.push({id:'q-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),
    paperKey,number:String(f.get('number')||'').slice(0,30),prompt,photo,
    answerKey:String(f.get('answer')||'').trim().slice(0,250),createdAt:new Date().toISOString()});
   WP.saveModel();toast('학습반의 기출 문제로 등록했습니다.');render();
  }catch(err){toast(err.message||'문항을 저장하지 못했습니다.')}
  return;
 }
 const id=form?.getAttribute?.('data-hsc-answer');
 if(!id)return;
 event.preventDefault();event.stopImmediatePropagation?.();
 const g=group(),q=questionList(g).find(x=>x.id===id);
 if(!g||!q)return;
 const answer=String(new FormData(form).get('response')||'').trim().slice(0,1000);
 if(!answer)return;
 if(!g.schoolExamAnswers||typeof g.schoolExamAnswers!=='object')g.schoolExamAnswers={};
 const normalize=x=>String(x||'').replace(/\s/g,'').toLocaleLowerCase('ko-KR');
 const status=q.answerKey?(normalize(answer)===normalize(q.answerKey)?'matched':'mismatch'):'unverified';
 g.schoolExamAnswers[id]={response:answer,status,updatedAt:new Date().toISOString()};
 WP.saveModel();toast(status==='unverified'?'답안을 기록했습니다. 자동 채점은 지원되지 않습니다.':'등록된 정답과 대조했습니다.');
 render();
});
window.HITEL_SCHOOL_ZOCBO_INSPECT=()=>({
 selectedGroup:group()?.id||'',selectedSchool:schoolOf(group()),
 groupCount:classes().length,schoolPaperCount:records(group()).length,
 registeredQuestions:questionList(group()).length,
 originalSchoolSourcePreserved:true,originalPaperIdRequired:true,autoAiGrading:false
});
render();
})();