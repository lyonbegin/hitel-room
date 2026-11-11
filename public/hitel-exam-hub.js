/* Additive exam categories on top of original HITEL/Zocbo search.
   Do not alter original school/region/grade/term/subject filters.
   Source-search links are not imported question papers. */
(function(){
'use strict';
const UI=window.ZOCBOUI,WP=window.HITEL_WORKPLACE_BRIDGE;
if(!UI||!WP||!window.YPT_GRAPH)return;
const model=WP.getModel(),priorPage=UI.page;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATS=[
 ['school','학교 내신','▣','기존 학교·지역별 검색'],
 ['mock','모의·수능','▤','전국연합·평가원·수능'],
 ['admission','고입 전형','♧','국제고·외고·과학고·영재학교'],
 ['contest','경시대회','★','KMO 등 경시자료'],
 ['university','대학별고사','▥','논술·면접·구술'],
 ['diagnostic','진단·평가','◎','학력평가·검정고시']
];
const SOURCES={
mock:[
 ['ebsi1','EBSi 고1 모의고사 기출','EBSi','https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperList.ebs?targetCd=D100','연도·월·과목별 검색','고1'],
 ['ebsi2','EBSi 고2 모의고사 기출','EBSi','https://cloud.ebsi.co.kr/ebs/xip/xipc/previousPaperList.ebs?targetCd=D200','전국연합 기출·정답 자료 검색','고2'],
 ['ebsi3','EBSi 고3·N수 모의고사 기출','EBSi','https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperList.ebs','연도·월·영역별 검색','고3'],
 ['kice','수능·평가원 모의평가 기출','한국교육과정평가원','https://www.suneung.re.kr/','자료마당에서 수능·모의평가 문제·정답 확인','고3']
],
admission:[
 ['hischool','국제고·외고·과학고 입학전형','고입정보포털','https://www.hischool.go.kr/study/way.jsp','전형 단계·모집요강·면접 안내','중3'],
 ['ksa','한국과학영재학교 전형자료','한국과학영재학교','https://admission.ksa.hs.kr/','창의적 문제해결력평가·입학요강 자료','중3']
],
contest:[['kmo','한국수학올림피아드(KMO)','KMO 공식 사이트','https://www.kmo.or.kr/','공개된 대회 안내·자료 확인','중3']],
university:[['adiga','대학별 논술·면접·구술','대입정보포털 어디가','https://www.adiga.kr/uct/ces/archiveView.do?menuId=PCUCTCE','모집학년도·대학별고사 자료 검색','고3']],
diagnostic:[['kice2','기초학력·학업성취도·검정고시 관련 자료','한국교육과정평가원','https://www.kice.re.kr/','자료마당에서 공개된 평가자료 확인','중3']]
};
const ui={category:'mock',grade:'고2',year:'2026',month:'9',subject:'수학',track:'전국연합',school:'',selected:'ebsi2'};
let active=null,pending=null;
const ROUTES={bankExamExplore:'다른 기출시험 찾기',bankExamDetail:'기출 자료원 안내',bankExamClass:'기출 학습반 연결'};
for(const [id,title] of Object.entries(ROUTES))window.YPT_GRAPH[id]={title,evidence:[],actions:[{text:'학교별 족보',go:'bankSearch'}]};
const source=(id)=>SOURCES[ui.category]?.find(r=>r[0]===id)||null;
const button=(txt,a,v='',cls='')=>'<button type="button" class="'+cls+'" data-hxe="'+a+'" data-value="'+esc(v)+'">'+txt+'</button>';
const raw=(s)=>'<a href="'+esc(s[3])+'" target="_blank" rel="noopener noreferrer" class="hxe-origin">공식 자료원 열기 ↗</a>';
const subj=s=>String(s||'').split(/[,·/]/)[0].trim();
const schoolKey=s=>String(s||'').trim().replace(/\s/g,'').replace(/(고등학교|중학교|초등학교|고|중|초)$/,'');
function subjectKey(s){
 const name=String(s||'');
 if(/수학|미적분|기하|확률|통계/.test(name))return '수학';
 if(/국어|문학|독서|화법|작문/.test(name))return '국어';
 if(/영어/.test(name))return '영어';
 if(/과학|물리|화학|생명|지구/.test(name))return '과학';
 if(/사회|정치|경제|윤리|지리/.test(name))return '사회';
 if(/한국사|역사/.test(name))return '한국사';
 return name.trim().slice(0,35);
}
const seats=g=>Math.max(1,Math.min(5,Number(g.capacity)||5));
function tabs(id){
 return '<div class="hxe-types">'+CATS.map(([key,name,icon])=>
 button('<span aria-hidden="true">'+icon+'</span><b>'+esc(name)+'</b>','category',key,'hxe-type'+(key===id?' selected':''))).join('')+'</div>';
}
/* The compact, class-aware main is supplied by hitel-school-zocbo.js. */
function bankTop(){return ''}
function changeCategory(id){
 if(id==='school'){go('bankSearch');return}
 if(!SOURCES[id])return;
 ui.category=id;ui.selected=SOURCES[id][0][0];ui.school='';
 ui.grade=id==='mock'?'고2':id==='university'?'고3':'중3';
 ui.subject=id==='admission'?'면접':id==='university'?'논술':'수학';
 ui.track=id==='admission'?'국제고':id==='contest'?'KMO':id==='university'?'논술':id==='diagnostic'?'기초학력':'전국연합';
 go('bankExamExplore');
}
function opts(name,label,list){
 return '<label class="hxe-field"><span>'+label+'</span><select data-hxe-field="'+name+'">'+
 list.map(x=>'<option value="'+esc(x)+'"'+(x===ui[name]?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>';
}
function extraFilters(){
 const years=['2026','2025','2024','2023','2022','2021','2020'];
 const grade=ui.category==='mock'?['고1','고2','고3']:ui.category==='admission'?['중1','중2','중3']:
 ['초6','중1','중2','중3','고1','고2','고3'];
 const subjects=ui.category==='admission'?['면접','영어','국어','수학','과학']:ui.category==='university'?
 ['논술','수학','국어','면접','영어','과학']:['수학','국어','영어','과학','사회','한국사','기타'];
 const extra=ui.category==='mock'?opts('month','시행월',['전체','3','4','5','6','7','8','9','10','11','12']):
 opts('track',ui.category==='admission'?'학교 유형':ui.category==='contest'?'대회':ui.category==='university'?'전형 유형':'평가 유형',
 ui.category==='admission'?['국제고','외고','과학고','영재학교','자사고']:
 ui.category==='contest'?['KMO','기타 수학경시','과학경시']:
 ui.category==='university'?['논술','구술면접','제시문 면접']:['기초학력','학업성취도','검정고시']);
 return '<div class="hxe-filters">'+opts('grade','대상 학년',grade)+opts('year','시행연도·모집학년도',years)+extra+opts('subject','과목',subjects)+'</div>'+
 (['admission','university'].includes(ui.category)?'<label class="hxe-field"><span>지원 학교·대학 (선택)</span><input type="text" maxlength="80" placeholder="학교명 입력" data-hxe-field="school" value="'+esc(ui.school)+'"></label>':'');
}
function title(){
 const name={mock:'모의고사·수능',admission:'고입 전형',contest:'경시대회',university:'대학별고사',diagnostic:'진단·평가'}[ui.category];
 const prefix=(ui.school?ui.school+' ':'')+ui.grade+' '+ui.year+
 (['admission','university'].includes(ui.category)?'학년도 ':'년 ')+
 (ui.category==='mock'&&ui.month!=='전체'?ui.month+'월 ':'')+
 (ui.track&&ui.track!=='전국연합'?ui.track+' ':'');
 return (prefix+ui.subject+' '+name+' 자료 찾기').replace(/\s+/g,' ').trim();
}
function explorer(){
 const cat=CATS.find(x=>x[0]===ui.category)||CATS[1];
 return '<section class="hxe-screen"><div class="hxe-back"><button data-go="bankSearch">‹ 기존 학교별 족보</button></div>'+
 '<small>기존 족보 검색 유지 · 다른 시험 확장</small><h2>'+esc(cat[1])+' 자료 찾기</h2><p>'+esc(cat[3])+'</p>'+
 tabs(ui.category)+extraFilters()+
 '<p class="hxe-notice">아래는 공식 자료를 검색할 수 있는 출처입니다. 선택하신 연도·과목의 개별 문제지 확보 여부는 아직 확인되지 않았습니다.</p>'+
 '<div class="hxe-sources">'+SOURCES[ui.category].map(x=>'<div class="hxe-source"><small>'+esc(x[2])+'</small><h3>'+esc(x[1])+'</h3><p>'+esc(x[4])+'</p>'+
 (ui.category==='mock'&&x[5]!==ui.grade?'<em>선택 학년과 다른 자료원</em>':'')+
 '<div class="hxe-actions">'+raw(x)+button('이 출처로 학습반 준비 →','pick',x[0],'hxe-button')+'</div></div>').join('')+'</div>'+
 '<p class="hxe-notice">시험 연도·시행월은 공식 사이트에서도 다시 선택해 주셔야 할 수 있습니다.</p></section>';
}
function description(){
 const x=source(ui.selected);if(!x)return null;
 return {title:title(),category:ui.category,grade:ui.grade,subject:ui.subject,year:ui.year,
 month:ui.category==='mock'?ui.month:'',track:ui.track,school:ui.school,sourceId:x[0],sourceName:x[2],
 sourceUrl:x[3],sourceStatus:'source_search_only',verifiedPaper:false};
}
function detail(){
 if(!active)return '<section class="hxe-screen"><p>먼저 시험 자료원을 선택해 주세요.</p><button data-go="bankExamExplore">찾기로</button></section>';
 const x=source(active.sourceId);
 const zocboLink=active.category==='school'&&/^https:\/\/(?:m\.|www\.)?zocbo\.com\//.test(active.sourceUrl||'')?'<a class="hxe-origin" href="'+esc(active.sourceUrl)+'" target="_blank" rel="noopener noreferrer">족보닷컴 원본 자료 검색 화면 열기 ↗</a>':'';
 return '<section class="hxe-screen"><div class="hxe-back"><button data-go="bankExamExplore">‹ 검색조건 수정</button></div>'+
 '<small>기출자료 탐색 · 원문 미확보</small><h2>'+esc(active.title)+'</h2>'+
 '<div class="hxe-info"><b>공식 자료원</b><p>'+esc(active.sourceName)+'</p>'+(active.paperId?'<p>원본 자료번호: <b>'+esc(active.paperId)+'</b></p>':'')+(active.school?'<p>학교 검색조건: '+esc(active.school)+' (해당 자료의 학교 일치 여부는 원본에서 확인 필요)</p>':'')+(x?raw(x):zocboLink)+'</div>'+
 '<div class="hxe-info"><b>학습반에 연결할 정보</b><p>시험 이름·연도·대상 학년·과목·출처 링크를 연결합니다. 실제 문항·정답·AI 기출 분석은 아직 확보되지 않았습니다.</p></div>'+
 button('이 시험 준비를 학습반에 연결하기 →','start','','hxe-primary')+'</section>';
}
function choices(){
 if(!pending)return '<section class="hxe-screen"><p>먼저 시험 자료원을 선택해 주세요.</p><button data-go="bankExamExplore">찾기</button></section>';
 const gs=(model.groups||[]).filter(g=>g.members?.includes('나')&&subj(g.subject)===pending.subject&&
 (!g.grade||g.grade==='제한 없음'||g.grade===pending.grade)&&
 (pending.category!=='school'||!pending.school||!g.institutionName&&!g.school||schoolKey(g.institutionName||g.school)===schoolKey(pending.school)));
 return '<section class="hxe-screen"><div class="hxe-back"><button data-go="bankExamDetail">‹ 자료 안내로</button></div>'+
 '<small>학습반과 기출자료 연결</small><h2>'+esc(pending.title)+'</h2>'+
 '<p>학생 1명도 학습반으로 이용합니다. 담당 AI 선생님은 학습반에 지정합니다.</p>'+
 '<h3>내 학습반 선택</h3>'+
 (gs.length?gs.map(g=>'<button type="button" class="hxe-group" data-hxe="attach" data-value="'+esc(g.id)+'"><b>'+esc(g.name)+'</b>'+
 '<small>'+esc(g.grade)+' · '+esc(g.subject)+' · '+(g.members?.length||1)+'/'+seats(g)+'명</small>'+
 '<span>담당 AI: '+esc(g.coachName||'미지정')+' · 기출 연결 →</span></button>').join(''):
 '<p class="hxe-notice">과목·학년이 일치하는 학습반이 없습니다. 새 학습반을 개설해 주세요.</p>')+
 '<div class="hxe-info"><b>새 학습반 만들기</b><p>학교·학원, 학년, 과목, 목표, 정원(1~5명)과 담당 AI 선생님을 지정합니다.</p>'+
 button('＋ 학습반 만들기 →','new','','hxe-primary')+'</div></section>';
}
function linkClass(id){
 const g=model.groups.find(x=>x.id===id),r=pending;
 if(!g||!r||!g.members?.includes('나')){toast('연결할 학습반이 없습니다.');return}
 if(subj(g.subject)!==r.subject||(g.grade&&g.grade!=='제한 없음'&&g.grade!==r.grade)||
   (r.category==='school'&&r.school&&(g.institutionName||g.school)&&schoolKey(g.institutionName||g.school)!==schoolKey(r.school))){
  toast('기출의 학년·과목과 학습반이 일치하지 않습니다.');return;
 }
 if(!Array.isArray(g.examResources))g.examResources=[];
 const key=[r.sourceId,r.paperId||'',r.school||'',r.year,r.month,r.track,r.subject,r.grade].join('|');
 if(!g.examResources.some(v=>v.key===key))g.examResources.push({...r,key});
 g.examFocus={...r};
 if(!model.materials||typeof model.materials!=='object')model.materials={};
 if(!Array.isArray(model.materials[g.id]))model.materials[g.id]=[];
 if(!model.materials[g.id].some(x=>x.examKey===key))
 model.materials[g.id].push({id:'exam-'+g.id+'-'+g.examResources.length,title:r.title,
  text:(r.paperId?'족보닷컴 원본 자료번호 '+r.paperId+' · 문제 본문·정답 미확보':'공식 자료원: '+r.sourceName+' · 개별 문제지 미확보'),unit:r.paperId?'학교 기출':'기출 참고자료',
  examKey:key,originalPaperId:r.paperId||'',sourceUrl:r.sourceUrl});
 model.activeGroupId=g.id;WP.saveModel();pending=null;
 go(g.coachId?'groupDetail':'groupTrainerSelect');
}
document.addEventListener('click',e=>{
 const b=e.target.closest?.('#phone [data-hxe]');if(!b)return;
 e.preventDefault();e.stopPropagation();const a=b.dataset.hxe,v=b.dataset.value||'';
 if(a==='category'){changeCategory(v);return}
 if(a==='pick'){ui.selected=v;active=description();if(active)go('bankExamDetail');return}
 if(a==='start'){if(!active){toast('시험 자료원을 먼저 선택해 주세요.');return}window.HITEL_CLASS_AI_FLOW?.clearPending?.();pending={...active};go('bankExamClass');return}
 if(a==='attach'){linkClass(v);return}
 if(a==='new'){window.HITEL_CLASS_AI_FLOW?.clearPending?.();go('groupCreate');return}
});
document.addEventListener('change',e=>{
 const field=e.target?.getAttribute?.('data-hxe-field');if(!field||!Object.hasOwn(ui,field))return;
 ui[field]=String(e.target.value||'').slice(0,80);
 if(field==='grade'&&ui.category==='mock')ui.selected=({고1:'ebsi1',고2:'ebsi2',고3:'ebsi3'})[ui.grade]||ui.selected;
 render();
});
UI.page=function(route,s){
 if(route==='bankSearch')return bankTop()+priorPage(route,s);
 if(route==='bankExamExplore')return explorer();
 if(route==='bankExamDetail')return detail();
 if(route==='bankExamClass')return choices();
 return priorPage(route,s);
};
window.HITEL_EXAM_FLOW={
 chooseCategory:changeCategory,
 beginSchoolPaper:(input)=>{
  const p=input||{},id=String(p.paperId||'').trim().slice(0,120);
  if(!id){toast('먼저 원본 자료번호가 있는 시험지를 선택해 주세요.');return false}
  const subjName=subjectKey(p.subject||''),grade=String(p.grade||'').trim();
  if(!['수학','국어','영어','과학','사회','한국사','면접','논술','정보'].includes(subjName)||
     !/^[중고][123]$/.test(grade)){toast('학년과 과목을 확인한 다음 학습반에 연결해 주세요.');return false}
  const name=String(p.title||'학교별 시험자료').trim().slice(0,150);
  const src=String(p.sourceUrl||'');
  const safeUrl=/^https:\/\/(?:m\.|www\.)?zocbo\.com\//.test(src)?src:'https://m.zocbo.com/';
  active={category:'school',kind:'school',grade,subject:subjName,school:String(p.school||'').trim().slice(0,100),
   city:String(p.city||'').slice(0,40),district:String(p.district||'').slice(0,40),
   title:name,sourceId:'zocbo:'+id,paperId:id,sourceName:'족보닷컴',sourceUrl:safeUrl,
   originalSubject:String(p.subject||''),sourceCase:String(p.sourceCase||''),
   menu:String(p.menu||''),year:'',month:'',track:'학교 내신',sourceStatus:'original_paper_id_only',
   verifiedPaper:false,schoolPaperMatchVerified:false};
  window.HITEL_CLASS_AI_FLOW?.clearPending?.();
  pending={...active};
  go('bankExamClass');
  return true;
 },
 pending:()=>pending?{...pending}:null,clearPending:()=>{pending=null},
 attach:(id,x)=>{pending=x;linkClass(id)},
 inspect:()=>({categories:CATS.map(x=>x[0]),additionalSources:Object.values(SOURCES).reduce((n,x)=>n+x.length,0),
 originalBankPreserved:true,sourceOnly:true,pending:pending?.title||''})};
render();
})();