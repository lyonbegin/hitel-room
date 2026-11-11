/* HITEL: season-aware class homepage. Preserves existing group, trainer and mission flows. */
(function(){
'use strict';
const wp=window.HITEL_WORKPLACE_BRIDGE;
if(!wp)return;
const model=wp.getModel(),previousPage=groupPage,previousBottom=bottomFor;
const choices={selectedCategory:'all',template:null};
const templates=new Map();
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthNow=()=>Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',month:'numeric'}).format(new Date()));
const currentSubjects=['수학','국어','영어','과학','사회','한국사','정보'];
function season(month){
 if(month<=2)return {label:'겨울방학 · 신학기 준비',lead:'방학 동안 다음 학기를 준비할 때입니다.',items:[
  {id:'winter-intensive',name:'겨울방학 집중반',goalType:'자유 목표',desc:'부족한 단원 보완부터 문제 유형 완성까지',days:21,emoji:'❄',theme:'blue',tag:'방학 집중'},
  {id:'winter-advance',name:'새 학년 선행반',goalType:'선행학습',desc:'다음 학년 필수 개념과 문제를 차근차근',days:21,emoji:'↗',theme:'orange',tag:'개학 준비'}]};
 if(month<=4)return {label:'신학기 · 중간고사 대비',lead:'새 학기 개념과 시험 범위에 집중하세요.',items:[
  {id:'spring-mid',name:'1학기 중간고사 집중반',goalType:'학교 내신',desc:'학교별 시험범위·기출 유형을 중심으로',days:14,emoji:'◎',theme:'orange',tag:'내신 집중'},
  {id:'spring-basic',name:'새 학기 개념완성반',goalType:'선행학습',desc:'새 단원의 원리를 발견하고 문제로 완성',days:14,emoji:'✦',theme:'green',tag:'개념 완성'}]};
 if(month<=6)return {label:'1학기 기말고사 대비',lead:'시험 준비에 필요한 문제를 집중 공략하세요.',items:[
  {id:'summer-final',name:'1학기 기말고사 집중반',goalType:'학교 내신',desc:'학교별 족보·출제범위·예상 유형 집중',days:14,emoji:'◎',theme:'orange',tag:'기말 대비'},
  {id:'summer-weak',name:'기말고사 약점극복반',goalType:'학교 내신',desc:'틀린 유형부터 고난도 응용까지 차례대로',days:10,emoji:'◇',theme:'green',tag:'약점 공략'}]};
 if(month<=8)return {label:'여름방학 · 2학기 준비',lead:'방학에는 복습과 선행을 함께 준비하세요.',items:[
  {id:'summer-intensive',name:'여름방학 집중반',goalType:'자유 목표',desc:'핵심 단원과 문제 유형을 방학 중 완성',days:21,emoji:'☀',theme:'orange',tag:'방학 집중'},
  {id:'summer-ahead',name:'2학기 선행반',goalType:'선행학습',desc:'다음 학기 핵심 원리를 먼저 익혀요',days:21,emoji:'↗',theme:'green',tag:'미리 준비'}]};
 if(month<=10)return {label:'2학기 중간고사 대비',lead:'시험범위와 취약 유형을 지금 점검하세요.',items:[
  {id:'fall-mid',name:'2학기 중간고사 집중반',goalType:'학교 내신',desc:'학교별 기출 문제와 시험범위 중심',days:14,emoji:'◎',theme:'orange',tag:'내신 집중'},
  {id:'fall-practice',name:'중간고사 실전문제반',goalType:'학교 내신',desc:'기초부터 고난도까지 단계별 문제 해결',days:14,emoji:'✎',theme:'green',tag:'실전 집중'}]};
 return {label:'기말고사 · 겨울방학 준비',lead:'기말고사와 다가오는 겨울방학, 지금 알맞은 반을 골라보세요.',items:[
  {id:'year-final',name:'2학기 기말고사 집중반',goalType:'학교 내신',desc:'학교별 족보·시험범위·예상 문제 집중',days:14,emoji:'◎',theme:'orange',tag:'기말고사'},
  {id:'winter-preview',name:'겨울방학 선행반',goalType:'선행학습',desc:'다음 학기 핵심 개념을 미리 발견하고 해결',days:21,emoji:'❄',theme:'blue',tag:'방학 준비'}]};
}
function owned(){return (model.groups||[]).filter(g=>Array.isArray(g.members)&&g.members.includes('나'))}
function preferred(){
 const joined=owned();
 return joined.find(g=>!g.example&&g.institutionName&&g.grade&&currentSubjects.includes(g.subject))||
        joined.find(g=>!g.example&&currentSubjects.includes(g.subject))||null;
}
function recommended(){
 const g=preferred(),sub=g?.subject||'',name=g?.institutionName||g?.school||'',grade=g?.grade||'';
 const place=name&&grade?name+' '+grade+' ':'';
 return [
 {id:'personal-exam',name:place+'내신집중반',goalType:'학교 내신',desc:'학교별 족보와 시험범위로 실전 준비',days:14,emoji:'▣',tag:'학교별 내신',category:'exam'},
 {id:'personal-book',name:(sub?sub+' ':'')+'문제집완성반',goalType:'문제집 완성',desc:'문제집 한 권을 매일의 미션으로 끝까지',days:21,emoji:'▤',tag:'한 권 완성',category:'book'},
 {id:'personal-weak',name:(sub?sub+' ':'')+'약점극복반',goalType:'자유 목표',desc:'전날의 오답과 취약 유형에 집중',days:10,emoji:'◇',tag:'맞춤 공략',category:'weak'},
 {id:'personal-ahead',name:(sub?sub+' ':'')+'선행학습반',goalType:'선행학습',desc:'다음 학기 원리와 기본 유형 미리 익히기',days:21,emoji:'↗',tag:'선행 집중',category:'ahead'}
 ];
}
function b(label,action,value,cls){
 return '<button type="button" class="hclass-btn '+(cls||'')+'" data-hc="'+e(action)+'" data-v="'+e(value||'')+'">'+label+'</button>';
}
function heroCard(c,index){
 return '<article class="hclass-hero hclass-'+e(c.theme)+'">'+
 '<div class="hclass-hero-top"><span>'+e(c.tag)+'</span><small>'+(index+1)+'/2</small></div>'+
 '<div class="hclass-hero-mark">'+e(c.emoji)+'</div>'+
 '<h3>'+e(c.name)+'</h3><p>'+e(c.desc)+'</p>'+
 b('이 학습반 만들기 →','template',c.id,'hclass-hero-action')+'</article>';
}
function miniCard(c){
 return '<button type="button" class="hclass-mini" data-hc="template" data-v="'+e(c.id)+'">'+
 '<span class="hclass-mini-icon">'+e(c.emoji)+'</span><small>'+e(c.tag)+'</small><strong>'+e(c.name)+'</strong>'+
 '<span class="hclass-mini-desc">'+e(c.desc)+'</span><span class="hclass-mini-more">이 유형으로 시작 ›</span></button>';
}
function ownCard(g){
 const n=(g.members||[]).length,teacher=g.coachName||'AI 선생님 선택 대기',label=g.goalType||'공동학습';
 return '<button type="button" class="hclass-owned" data-hc="openClass" data-v="'+e(g.id)+'">'+
 '<div class="hclass-owned-top"><span>'+e(label)+' · '+e(g.subject||'학습')+'</span><small>'+n+'/5명</small></div>'+
 '<strong>'+e(g.name||'내 학습반')+'</strong><p>'+e(teacher)+' · '+e(g.goalTitle||g.topics||'목표를 정해 보세요')+'</p>'+
 '<div class="hclass-owned-foot"><span>'+(g.example?'체험용 학습반':'진행 중인 학습반')+'</span><b>학습반 입장 ›</b></div></button>';
}
function pageHome(){
 const m=monthNow(),seasonData=season(m),rec=recommended(),joined=owned();
 templates.clear();[...seasonData.items,...rec].forEach(x=>templates.set(x.id,x));
 const filtered=choices.selectedCategory==='all'?rec:rec.filter(x=>x.category===choices.selectedCategory);
 const my=preferred(),focus=my?(my.grade||'')+' '+(my.subject||''):'내신 · 선행 · 문제집 · 약점 극복';
 return '<section class="hclass">'+
 '<div class="hclass-brand"><div class="hclass-brand-symbol">✧</div><div><strong>HITEL 교육</strong><small>AI 선생님과 함께하는 최대 5인 학습반</small></div>'+
 b('＋ 학습반 만들기','new','','hclass-top-add')+'</div>'+
 '<div class="hclass-title"><h2>학습반</h2><p>목표가 같은 친구들과 함께 문제를 해결하세요.</p></div>'+
 '<div class="hclass-jump">'+b('⌕ 학습반 찾기','route','groupSearch')+b('◷ 내 학습반 '+joined.length,'mine','')+'</div>'+
 '<header class="hclass-heading"><span>✦ '+m+'월 · '+e(seasonData.label)+'</span><h3>지금 뜨는 학습반</h3><p>'+e(seasonData.lead)+'</p></header>'+
 '<div class="hclass-heroes">'+seasonData.items.map(heroCard).join('')+'</div>'+
 '<div class="hclass-hero-caption"><span>학사 시기에 따른 추천 학습반 유형</span>'+b('기존 반 찾기 ›','route','groupSearch','hclass-text-button')+'</div>'+
 '<header class="hclass-heading"><span>나에게 맞는 공부</span><h3>이런 학습반 어때요?</h3><p>'+e(focus)+' 중심으로 살펴보세요.</p></header>'+
 '<div class="hclass-filters">'+[['all','전체'],['exam','내신'],['book','문제집'],['weak','약점'],['ahead','선행']].map(x=>b(x[1],'filter',x[0],choices.selectedCategory===x[0]?'active':'')).join('')+'</div>'+
 '<div class="hclass-grid">'+filtered.map(miniCard).join('')+'</div>'+
 '<div class="hclass-search-cta"><strong>우리 학교·학년에 맞는 학습반을 찾으시나요?</strong><p>학교 또는 학원, 학년, 과목별로 반을 찾아 참여하세요.</p>'+
 b('학습반 찾아보기 →','route','groupSearch','hclass-search-action')+'</div>'+
 '<section id="hclass-mine" class="hclass-mine"><div class="hclass-mine-header"><div><h3>내 학습반</h3><p>가입한 반에서 미션을 이어서 해결하세요.</p></div><span>'+joined.length+'개</span></div>'+
 (joined.length?joined.map(ownCard).join(''):'<p class="hclass-empty">아직 가입한 학습반이 없습니다. 원하는 학습반 유형을 선택하거나 학습반을 찾아보세요.</p>')+
 '</section></section>';
}
function prefill(markup,c){
 if(!c)return markup.replace('새 스터디그룹','학습반').replace('반을 개설한 다음 담당 트레이너를 지정합니다.','학교·학년·과목과 학습목표를 정해 반을 만듭니다.');
 markup=markup.replace('새 스터디그룹','학습반').replace('반을 개설한 다음 담당 트레이너를 지정합니다.','학교·학년·과목과 학습목표를 정해 반을 만듭니다.');
 for(const [name,value] of [['name',c.name],['goalTitle',c.name]]){
  markup=markup.replace(new RegExp('(<input name="'+name+'"[^>]*)(>)'),(_match,left,right)=>left+' value="'+e(value)+'"'+right);
 }
 markup=markup.replace(/(<select name="goalType">)([\s\S]*?)(<\/select>)/,(_match,before,options,after)=>before+options.replace('<option>'+e(c.goalType)+'</option>','<option selected>'+e(c.goalType)+'</option>')+after);
 markup=markup.replace(/(<select name="courseDays">)([\s\S]*?)(<\/select>)/,(_match,before,options,after)=>before+options.replace(/ selected/g,'').replace('<option value="'+c.days+'">','<option value="'+c.days+'" selected>')+after);
 return '<div class="hclass-prefill"><small>선택하신 학습반 유형</small><strong>'+e(c.name)+'</strong><p>학교와 학년, 과목을 입력하여 개설해 주세요.</p></div>'+markup;
}
groupPage=function(route){
 if(route==='groups')return pageHome();
 if(route==='groupCreate')return prefill(previousPage(route),choices.template);
 const rendered=previousPage(route);
 if(['groupSearch','groupJoin','groupPreview'].includes(route)&&typeof rendered==='string')return rendered.replace(/스터디그룹/g,'학습반').replace(/스터디/g,'학습반');
 return rendered;
};
bottomFor=function(route){
 const rendered=previousBottom(route);
 return typeof rendered==='string'?rendered.replace(/스터디그룹/g,'학습반'):rendered;
};
document.addEventListener('click',ev=>{
 const target=ev.target.closest?.('#phone button[data-hc]');if(!target)return;
 ev.preventDefault();ev.stopPropagation();
 const action=target.dataset.hc,value=target.dataset.v||'';
 if(action==='new'){choices.template=null;go('groupCreate');return;}
 if(action==='template'){const t=templates.get(value);if(!t)return;choices.template=t;go('groupCreate');return;}
 if(action==='route'){if(value==='groupCreate')choices.template=null;go(value);return;}
 if(action==='filter'){choices.selectedCategory=value;render();return;}
 if(action==='mine'){document.querySelector('#hclass-mine')?.scrollIntoView?.({behavior:'smooth',block:'start'});return;}
 if(action==='openClass'){const g=model.groups.find(g=>g.id===value);if(!g)return;model.activeGroupId=g.id;wp.saveModel();go('groupDetail');return;}
});
window.HITEL_CLASS_DISCOVERY_INSPECT=()=>({route:state.screen,month:monthNow(),season:season(monthNow()).label,
 visibleClassCount:owned().length,templateSelected:choices.template?.id||null,source:'browser-local',popularityVerified:false});
})();
