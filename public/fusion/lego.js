/* This file only mounts independently deployed UI clones. It does not recreate or alter their CSS, images, fonts or product markup. */
(() => {
'use strict';
const SOURCES={
categories:{id:'categories',title:'전체 분야 · 숨고 카테고리 원형',desc:'11개 대분류 · 중분류 2단 · 서비스 목록 · 원본 SVG/배너',url:'https://soomgo-browser-audit-production.up.railway.app/categories',original:'https://soomgo.com/categories?from=web_gnb',kind:'category'},
providers:{id:'providers',title:'고수찾기 · 숨고 고수목록 원형',desc:'검색 · 필터 · 300/630px 레이아웃 · 프로필 이미지',url:'https://soomgo-browser-audit-production.up.railway.app/clone',original:'https://soomgo.com/search/pro',kind:'provider'},
local:{id:'local',title:'내 주변 · 당근 검색·지도 원형',desc:'600px 동네업체 목록 · 위치 선택 · 오른쪽 지도',url:'https://daangn-browser-audit-production.up.railway.app/clone',original:'https://www.daangn.com/',kind:'local'},
compare:{id:'compare',title:'상세비교 · 강남언니 카드 원형',desc:'600px 이미지 패널 · 616px 모바일 목록 · 실제 시술 이미지·평점',url:'https://unni-browser-audit-production.up.railway.app/clone',original:'https://unni.app/events',kind:'compare'},
events:{id:'events',title:'기획전·예약 · 네이버 예약 원형',desc:'600px 화면 · 2열 이미지 카드 · 행사 분류·기간',url:'https://naver-booking-promotions-audit-production.up.railway.app/clone',original:'https://booking.map.naver.com/promotions/home',kind:'events'},
call:{id:'call',title:'전화 · 기존 HITEL 통합 UI',desc:'기존 구현 보존: 신규 재현이 아닌 이전 화면',url:'./legacy.html',original:null,kind:'call'}};
const viewRoutes=['all','categories','providers','local','compare','events','workspace','call'];
const app=document.getElementById('app');const nav=document.getElementById('mainNav');
const esc=(s)=>String(s).replace(/[&<>"']/g,t=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[t]));
function getView(){const p=new URLSearchParams(location.search).get('view')||'all';return viewRoutes.includes(p)?p:'all'}
function head(s,frameId){return '<div class="section-head"><div><h2>'+esc(s.title)+'</h2><span>'+esc(s.desc)+'</span></div><div class="actions"><a href="?view='+s.id+'">원형 전체 보기</a><a href="'+esc(s.url)+'" target="_blank" rel="noopener">복제 화면 ↗</a>'+(s.original?'<a href="'+esc(s.original)+'" target="_blank" rel="noopener">공식 원본 ↗</a>':'')+'</div></div>'}
function frame(s,lazy=false){return '<iframe class="original-frame" title="'+esc(s.title)+'" src="'+esc(s.url)+'" loading="'+(lazy?'lazy':'eager')+'" referrerpolicy="no-referrer-when-downgrade" allow="microphone;camera"></iframe>'}
function section(s,{lazy=false}={}){let cl=s.kind==='local'?'map-body':s.kind==='events'?'booking-body':s.kind==='compare'?'compare-body':'';
return '<section class="section" id="section-'+s.id+'">'+head(s)+'<div class="section-body '+cl+(s.kind==='events'?' narrow-center':'')+'">'+frame(s,lazy)+'</div></section>'}
function all(){return '<div class="assembly-intro"><h1>기존 복제 UI 통합 조립</h1><p>당근·강남언니·숨고·네이버 예약을 새로 그리지 않았습니다. 아래 화면 각각은 기존 Railway에 배포된 복제 HTML/CSS/폰트/이미지/동작을 실제로 불러옵니다. 스크롤하여 원형 화면을 모두 확인하거나 위 메뉴로 전체 화면을 전환하십시오.</p></div>'+
['categories','providers','local','compare','events'].map((k,i)=>section(SOURCES[k],{lazy:i>1})).join('')}
function full(k){const s=SOURCES[k];return '<section class="frame-stage">'+head(s)+'<div class="one-screen">'+frame(s)+'</div></section>'}
function workspace(){
  const src=[SOURCES.categories,SOURCES.local,SOURCES.compare];
  return '<div class="assembly-intro"><h1>3단 조립형 화면</h1><p>각 칸은 새 디자인이 아닌 실제 복제 화면입니다. 화면 폭에 따라 각 원형 페이지의 기존 반응형 CSS가 작동합니다. 좁은 화면에서는 가로 스크롤로 전환됩니다.</p></div><div class="split-container">'+src.map(s=>'<section class="split-panel">'+head(s)+frame(s)+'</section>').join('')+'</div>'+
  '<div class="note">기존 전화/AI 화면은 상단 «전화·AI(기존)» 메뉴에 따로 보존했습니다. 3단 구성의 소스 화면별 검색·선택·스크롤은 독립 동작합니다.</div>'+
  section(SOURCES.providers,{lazy:true})+section(SOURCES.events,{lazy:true});
}
function render(){const view=getView();document.querySelectorAll('#mainNav a').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});app.innerHTML=view==='all'?all():view==='workspace'?workspace():full(view);document.title='HITEL · '+(view==='all'?'전체 UI 원형 조립':view==='workspace'?'3단 통합 조립':SOURCES[view].title);window.scrollTo(0,0)}
document.addEventListener('click',e=>{const a=e.target.closest('a[data-view],a[href^="?view="]');if(!a)return;const next=new URL(a.href,location.href);if(next.origin!==location.origin)return;e.preventDefault();history.pushState({},'',next.pathname+next.search);render()});
window.addEventListener('popstate',render);render();
})();