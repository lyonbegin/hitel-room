/* HITEL source-DOM assembly. GitHub clone CSS, HTML and scripts are imported unchanged from the generated parts manifest. */
(()=>{
'use strict';
const $=s=>document.querySelector(s),apis={},mounts={},roots={};
const state={view:'categories',group:'이사/청소',service:'',region:'서울 서초구',person:'',query:''};
let timer=0;
function toast(message){const el=$('#uiToast');el.textContent=message;el.style.display='block';clearTimeout(timer);timer=setTimeout(()=>el.style.display='none',3400)}
function scopeScript(js,id){
 let s=js.replace(/\bdocument\.querySelectorAll\s*\(/g,'shadow.querySelectorAll(')
 .replace(/\bdocument\.querySelector\.bind\s*\(\s*document\s*\)/g,'shadow.querySelector.bind(shadow)')
 .replace(/\bdocument\.querySelector\s*\(/g,'shadow.querySelector(')
 .replace(/\bhistory\.replaceState\s*\(/g,'bridge.replaceState(')
 .replace(/\blocation\.search\b/g,'bridge.search')
 .replace(/\blocation\.href\s*=\s*['"]\/clone['"]/g,'bridge.focus("'+id+'")')
 .replace(/(['"])\/artifacts\/original\.json\1/g,(_,q)=>q+'/source/'+id+'/artifacts/original.json'+q);
 if(id==='categories')s=s.replace(/(['"])\/api\/categories\?group=/g,'$1/source/categories/api/categories?group=');
 return s;
}
const rules={
 categories:':host{display:block;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR","Malgun Gothic",Arial,sans-serif}.global-header,.footer,.hint-strip{display:none!important}.hero{top:0!important;position:relative!important}.left-inner{top:94px;max-height:none}.category-layout{min-height:0}',
 providers:':host{display:block;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR","Malgun Gothic",Arial,sans-serif}.global-header,.footer{display:none!important}.wrapper{padding:18px 0 38px}.content{margin-top:28px}.main-title{margin-top:0}',
 local:':host{display:block;background:#f3f4f5;font-family:-apple-system,BlinkMacSystemFont,"Pretendard Variable","Noto Sans KR",sans-serif}.shell{min-height:720px}.map{height:740px;min-height:500px;top:18px}.research{display:none}',
 compare:':host{display:block;background:#eef3f6;font-family:-apple-system,BlinkMacSystemFont,"Pretendard Variable","Noto Sans KR",sans-serif}.frame{max-width:1240px;margin:0 auto}.bottom,.last{display:none!important}',
 events:':host{display:block;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif}.top,.foot{display:none!important}.screen{min-height:0;padding-top:0}'
};
function mount(part,slot){
 const host=document.createElement('section');host.className='clone-piece';host.dataset.part=part.id;slot.append(host);
 const shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML='<style>'+part.css+'\n'+rules[part.id]+'</style>'+part.html;
 mounts[part.id]=host;roots[part.id]=shadow;
 const bridge={search:location.search,replaceState(){},register(k,fn){(apis[part.id]??={})[k]=fn},focus(name){changeView(name==='providers'?'providers':'categories')}};
 let extra='';
 if(part.id==='categories'){
   extra=[
    "bridge.register('group',g=>selectGroup(g));",
    "bridge.register('search',q=>{filterText=q;shadow.querySelector('#search').value=q;render()});",
    "bridge.register('getGroup',()=>currentGroup);"
   ].join('\n');
   shadow.addEventListener('click',e=>{
    const a=e.target.closest('a.service-link');
    if(a){e.preventDefault();e.stopImmediatePropagation();const name=new URL(a.href,location.origin).searchParams.get('service')||a.textContent.trim();selectService(name);return}
    const b=e.target.closest('.group-tab');if(b){state.group=b.dataset.group;context()}
   },true);
 }
 if(part.id==='providers'){
   extra=[
    "bridge.register('service',v=>{currentService=v;shadow.querySelector('#serviceName').textContent=v.length>18?v.slice(0,17)+'…':v;render()});",
    "bridge.register('search',q=>{term=q;shadow.querySelector('#query').value=q;render()});",
    "bridge.register('region',r=>{currentRegion=r;shadow.querySelector('#regionName').textContent=r;render()});"
   ].join('\n');
   shadow.addEventListener('click',e=>{
    const card=e.target.closest('.pro-card');if(card){state.person=card.querySelector('.pro-name')?.textContent?.trim()||card.textContent.trim().slice(0,50);context()}
    const region=e.target.closest('#regions [data-value]');if(region)chooseRegion(region.dataset.value);
   },true);
 }
 if(part.id==='local'){
   extra=[
    "bridge.register('search',q=>{shadow.querySelector('#query').value=q;renderBusinesses()});",
    "bridge.register('region',r=>{region=r;shadow.querySelector('#location').textContent='선택 지역: '+r;shadow.querySelector('#heading').textContent=r+' 동네업체 검색 결과';renderBusinesses()});"
   ].join('\n');
   shadow.addEventListener('click',e=>{const b=e.target.closest('#cities [data-city]');if(b)chooseRegion(b.dataset.city)},true);
 }
 if(part.id==='compare')extra="bridge.register('search',q=>{keyword=q;shadow.querySelector('#searchInput').value=q;render()});";
 if(part.id==='events')extra="bridge.register('category',c=>{selected=c;draw()});";
 try{
  const code=part.scripts.map(s=>scopeScript(s,part.id)).join('\n;\n')+'\n'+extra;
  new Function('shadow','bridge',code)(shadow,bridge);
  console.info('HITEL_PART_READY',part.id,'CSS',part.css.length,'HTML',part.html.length);
 }catch(err){console.error('HITEL_PART_FAILED',part.id,err);host.dataset.error=err.message;const node=document.createElement('p');node.textContent='부품 실행 오류: '+err.message;node.style.color='red';shadow.append(node)}
}
function context(){
 const words=[state.group,state.service,state.region,state.person].filter(Boolean);
 $('#contextText').textContent=words.join(' › ');
 $('#callSelection').textContent=state.person?'선택 상대: '+state.person+' · 실제 연결 전화번호는 미등록':state.service?'선택 서비스: '+state.service+' · 실제 연결 상대는 미등록':'통신 연결 상대가 선택되지 않았습니다.';
}
function selectService(name){
 if(!name)return;
 state.service=name;state.person='';
 $('#serviceCaption').textContent=name;
 const matched=/청소|클린|방역|정리수납|곰팡이/.test(name);
 $('#providerWarning').textContent=matched?'숨고에서 복제한 청소 고수 프로필·필터 UI를 재사용합니다.':'해당 분야의 실제 제공자 자료는 아직 수집하지 않았습니다. 아래 목록은 입주청소 UI 검증용 복제 샘플입니다.';
 apis.providers?.service?.(name);
 changeView('providers');context();
}
function chooseRegion(name){if(!name)return;state.region=name;apis.providers?.region?.(name);apis.local?.region?.(name);context()}
function changeView(v){
 const view=['categories','providers','local','compare','events','call'].includes(v)?v:'categories';
 state.view=view;
 $('#workspace').hidden=!['categories','providers'].includes(view);
 $('#localMode').hidden=view!=='local';$('#compareMode').hidden=view!=='compare';
 $('#eventsMode').hidden=view!=='events';$('#callMode').hidden=view!=='call';
 const layout=roots.categories?.querySelector('.category-layout');
 if(layout)layout.style.display=view==='providers'?'none':'';
 $('#providerPanel').hidden=view!=='providers';
 $('#categoryTab').classList.toggle('active',view==='categories');
 $('#providerTab').classList.toggle('active',view==='providers');
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 const naverTarget=view==='events'?$('#eventsFullMount'):$('#eventsMount');
 if(mounts.events&&mounts.events.parentNode!==naverTarget)naverTarget.append(mounts.events);
 const u=new URL(location.href);u.searchParams.set('view',view);history.replaceState(null,'',u.pathname+u.search);
 window.scrollTo(0,0);
}
async function start(){
 try{
  const res=await fetch('./assembly-parts.json',{cache:'no-store'});
  if(!res.ok)throw Error('부품 데이터 HTTP '+res.status);
  const manifest=await res.json();
  for(const part of manifest.parts){
   const slots={categories:'#categoriesMount',providers:'#providersMount',local:'#localMount',compare:'#compareMount',events:'#eventsMount'};
   if(slots[part.id])mount(part,$(slots[part.id]));
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>changeView(b.dataset.view));
  $('#categoryTab').onclick=()=>changeView('categories');
  $('#providerTab').onclick=()=>changeView('providers');
  $('#resetContext').onclick=()=>{state.group='이사/청소';state.service='';state.person='';state.query='';$('#searchText').value='';apis.categories?.group?.('이사/청소');changeView('categories');context()};
  $('#globalSearch').onsubmit=e=>{
   e.preventDefault();const q=$('#searchText').value.trim();state.query=q;
   if(!q)return toast('검색어를 입력하세요.');
   if(/청소|설치|수리|이사|외주|자동차|과외|법률|인테리어/.test(q)){changeView('categories');apis.categories?.search?.(q)}
   else if(/눈|코|필러|피부|리프팅|보톡스|제모|시술/.test(q)){changeView('compare');apis.compare?.search?.(q)}
   else{changeView('local');apis.local?.search?.(q)}
   context();
  };
  changeView(new URLSearchParams(location.search).get('view')||'categories');
  context();document.documentElement.dataset.assembled='true';
  console.info('HITEL_ASSEMBLY_READY',Object.keys(roots));
 }catch(err){console.error('HITEL_ASSEMBLY_FAILED',err);$('#contextText').textContent='통합 부품 오류: '+err.message;toast(err.message)}
}
start();
})();