/* Actual anonymous original mobile problem-bank metadata, not example questions.
 * Requests hit the HITEL read-only server adapter. Official file viewing stays on
 * original domain; no login/session/token data pass through this component.
 */
(function(){
'use strict';
const UI=window.ZOCBOUI;
if(!UI)throw Error('ZOCBOUI not loaded');
const priorPage=UI.page;
const priorAction=UI.onAction;
const cache=new Map();
const inFlight=new Set();
const gradeSubjects=new Map();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const grades=['중1','중2','중3','고1','고2'];
const subjects=[['MT','수학'],['KR','국어'],['EG','영어'],['SC','과학'],['LS','사회'],['HI','역사']];
function filters(s){
 const z=s.zocbo||(s.zocbo={});
 if(!grades.includes(z.liveGrade))z.liveGrade=grades.includes(z.grade)?z.grade:'고1';
 if(!/^[A-Z0-9]{2,5}$/.test(z.liveSubject||''))z.liveSubject='MT';
 return z;
}
function spec(z){
 return {site:z.liveGrade[0]==='중'?'M':'H',grade:z.liveGrade.slice(1),subject:z.liveSubject};
}
function key(q){return [q.site,q.grade,q.subject].join(':')}
function info(q){const o=q.site==='H'?UI.PATHS.high:UI.PATHS.middle,u=new URL(o);u.searchParams.set('grade',q.grade);u.searchParams.set('subject_cd',q.subject);return u.href}
function chooser(z){
 return '<div class="zb-live-chooser" role="group" aria-label="원본 문제은행 필터"><div class="zb-live-options">'
 +grades.map(g=>'<button type="button" data-action="zbLiveGrade" data-value="'+g+'" class="'+(z.liveGrade===g?'on':'')+'" aria-pressed="'+(z.liveGrade===g?'true':'false')+'">'+g+'</button>').join('')+'</div><div class="zb-live-options">'
 +(gradeSubjects.get(z.liveGrade)||subjects.map(([code,name])=>({code,name}))).map(({code,name})=>'<button type="button" data-action="zbLiveSubject" data-value="'+esc(code)+'" class="'+(z.liveSubject===code?'on':'')+'" aria-pressed="'+(z.liveSubject===code?'true':'false')+'">'+esc(name)+'</button>').join('')+'</div>'
 +'<input type="search" class="zb-live-search" data-zb-live-query="1" placeholder="실제 시험지 제목 검색" value="'+esc(z.liveQuery||'')+'" aria-label="실시간 자료 목록 검색"></div>';
}
function rootGroups(parts){
 const groups=new Map();
 for(const p of parts||[]){
  if(!p.root&&!p.sub)continue;
  const root=p.root||p.rootCode||'기타';
  if(!groups.has(root))groups.set(root,new Set());
  if(p.sub)groups.get(root).add(p.sub);
 }
 return [...groups.entries()].slice(0,35);
}
function results(q,z){
 const entry=cache.get(key(q));
 if(!entry)return '<div class="zb-live-state" role="status">원본 서버의 공개 문제 목록을 조회하고 있습니다.</div>';
 if(entry.error)return '<div class="zb-live-state" role="alert">현재 서버 자료를 조회할 수 없습니다. 오류: '+esc(entry.error)+'</div><a class="zb-link" href="'+esc(info(q))+'" target="_blank" rel="noopener noreferrer">원본 문제은행에서 확인하기</a>';
 const data=entry.data,term=(z.liveQuery||'').trim().toLowerCase();
 const exams=(data.exams||[]).filter(e=>!term||e.title.toLowerCase().includes(term));
 const units=rootGroups(data.parts);
 return '<div class="zb-live-count"><b>시험지 '+exams.length+'건 표시</b><small>원본 조회 '+(data.exams||[]).length+'건 · 단원 '+units.length+'개</small></div>'
 +'<section class="zb-live-units"><h4>실제 단원 목록</h4>'
 +(units.length?units.map(([root,subs])=>'<details><summary>'+esc(root)+'</summary><div>'+[...subs].slice(0,30).map(v=>'<p>'+esc(v)+'</p>').join('')+'</div></details>').join(''):'<p class="zb-live-empty">표시할 단원 정보가 없습니다.</p>')+'</section>'
 +'<section class="zb-live-exams"><h4>실제 시험지 목록</h4>'
 +(exams.length?exams.map(e=>'<div class="zb-live-exam"><div><strong>'+esc(e.title)+'</strong><small>자료번호 '+esc(e.id)+'</small></div><a href="'+esc(info(q))+'" target="_blank" rel="noopener noreferrer">원본에서 열기</a></div>').join(''):'<p class="zb-live-empty">선택한 조건의 시험지 제목이 없습니다. 단원별 문제는 위 원본 메뉴에서 확인하실 수 있습니다.</p>')+'</section>';
}
function content(s){
 const z=filters(s),q=spec(z);
 schedule(q);
 return '<div class="zb-shortcuts"><button data-go="bankHome">문제은행 홈</button><button data-go="bankDownload">기말고사 원본자료</button><button data-go="bankSaved">책갈피</button></div>'
 +'<section class="zb-live-bank"><header class="zb-live-top"><h3>단원별 문제은행</h3><p>족보닷컴 모바일 페이지의 공개 서버 응답을 기준으로 표시합니다.</p></header>'
 +chooser(z)
 +'<div class="zb-live-panel" id="zb-live-panel" data-source-key="'+esc(key(q))+'">'+results(q,z)+'</div>'
 +'<div class="zb-live-bottom"><a class="zb-primary-link" href="'+esc(info(q))+'" target="_blank" rel="noopener noreferrer">원본에서 문항·다운로드 확인</a><button type="button" data-action="zbLiveRefresh">다시 조회</button></div></section>';
}
function updatePanel(){
 const s=window.ZOCBO_LIVE_STATE;if(!s)return;
 const z=filters(s),q=spec(z),host=document.querySelector('#phone .zb-live-bank');
 if(!host)return;
 host.innerHTML='<header class="zb-live-top"><h3>단원별 문제은행</h3><p>족보닷컴 모바일 페이지의 공개 서버 응답을 기준으로 표시합니다.</p></header>'
  +chooser(z)+'<div class="zb-live-panel" id="zb-live-panel" data-source-key="'+esc(key(q))+'">'+results(q,z)+'</div>'
  +'<div class="zb-live-bottom"><a class="zb-primary-link" href="'+esc(info(q))+'" target="_blank" rel="noopener noreferrer">원본에서 문항·다운로드 확인</a><button type="button" data-action="zbLiveRefresh">다시 조회</button></div>';
 schedule(q);
}
function schedule(q){
 const k=key(q);
 if(cache.has(k)||inFlight.has(k))return;
 inFlight.add(k);
 setTimeout(async()=>{
  try{
   const v=await fetch('/api/zocbo/public-catalog?'+new URLSearchParams(q),{credentials:'omit',cache:'no-store'});
   const data=await v.json();
   if(!v.ok||!data.ok)throw Error(data.reason||data.error||'HTTP_'+v.status);
   cache.set(k,{data});
   if(Array.isArray(data.subjects)&&data.subjects.length){gradeSubjects.set((q.site==='H'?'고':'중')+q.grade,data.subjects)}
  }catch(e){cache.set(k,{error:String(e.message||e).slice(0,120)})}
  finally{inFlight.delete(k);const panel=document.getElementById('zb-live-panel');if(panel&&panel.dataset.sourceKey===k)updatePanel()}
 },0);
}
UI.page=function(id,s){
 if(id==='bankSearch'||id==='bankResults'){window.ZOCBO_LIVE_STATE=s;return content(s)}
 return priorPage(id,s);
};
UI.onAction=function(act,el,s,go,render,toast){
 if(act==='zbLiveGrade'||act==='zbLiveSubject'||act==='zbLiveRefresh'){
  const z=filters(s);
  if(act==='zbLiveGrade'&&grades.includes(el.dataset.value))z.liveGrade=el.dataset.value;
  if(act==='zbLiveSubject'&&/^[A-Z0-9]{2,5}$/.test(el.dataset.value||''))z.liveSubject=el.dataset.value;
  if(act==='zbLiveRefresh')cache.delete(key(spec(z)));
  window.ZOCBO_LIVE_STATE=s;
  updatePanel();
  return;
 }
 return priorAction(act,el,s,go,render,toast);
};
document.addEventListener('input',event=>{
 if(!event.target.matches('[data-zb-live-query]'))return;
 const s=window.ZOCBO_LIVE_STATE;if(!s)return;
 const value=event.target.value;
 filters(s).liveQuery=value;
 const panel=document.getElementById('zb-live-panel');
 if(panel)panel.innerHTML=results(spec(filters(s)),filters(s));
});
})();