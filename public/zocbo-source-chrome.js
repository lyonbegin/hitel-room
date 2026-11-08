/* Original mobile source chrome: all visible DOM fragments come from the
   actual 700 Chromium-captured m.zocbo.com pages, not a generated menu copy.
   Active only under ?original=1, preserving HITEL's ordinary navigation. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('original')!=='1')return;
document.body.classList.add('zb-original-site');
const cache=new Map();
const mainCodes={'1':'concept','4':'unit','5':'practice','6':'revision','2':'school','8':'gangnam'};
let pending=false;
const escape=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function template(html,selector){
 if(!html)return null;
 const tpl=document.createElement('template');
 tpl.innerHTML=html;
 return selector?tpl.content.querySelector(selector):tpl.content.firstElementChild;
}
function srcHead(doc){
 const logo=escape(doc.logoSrc||'https://m.zocbo.com/cloudfront/images/mo/img_logoTop.svg');
 const coupon=escape(doc.couponSrc||'https://m.zocbo.com/cloudfront/images/mo/ico_coupon.svg');
 const header=document.createElement('div');
 header.className='zb-original-head';
 header.innerHTML='<button type="button" class="zb-original-menu-button" data-zb-menu aria-label="전체 메뉴">☰</button>'
  +'<button type="button" class="zb-original-student" data-zb-student>학생 <span>⌄</span></button>'
  +'<a class="zb-original-logo" target="_blank" rel="noopener noreferrer" href="https://m.zocbo.com/"><img width="94" src="'+logo+'" alt="족보닷컴"></a>'
  +'<a class="zb-original-coupon" target="_blank" rel="noopener noreferrer" href="https://m.zocbo.com/payment/"><img src="'+coupon+'" width="53" alt="이용권"></a>'
  +'<a class="zb-original-login" target="_blank" rel="noopener noreferrer" href="https://sign.zocbo.com/account/default.asp">로그인</a>';
 return header;
}
function augmentTabs(host,doc){
 const top=template(doc.topHTML,'.tabLineRound');
 if(top){
  for(const li of top.querySelectorAll('li[data-mn]')){
   const action=mainCodes[li.dataset.mn];
   const anchor=li.querySelector('a');
   if(action&&anchor){anchor.dataset.zbMain=action;anchor.setAttribute('href','#');}
  }
  const wrapper=document.createElement('nav');wrapper.className='zb-original-main-tabs';wrapper.setAttribute('aria-label','족보닷컴 원본 상단 메뉴');
  wrapper.appendChild(top);host.appendChild(wrapper);
 }
 const sub=template(doc.subHTML,'.lnb');
 if(sub){
  const codes=(doc.sub||[]).map(x=>(x.onclick||'').match(/'(\d{15})'/)?.[1]||'');
  for(const [i,button] of [...sub.querySelectorAll('button')].entries()){
   if(codes[i])button.dataset.zbSubcode=codes[i];
  }
  const wrapper=document.createElement('nav');wrapper.className='zb-original-sub-tabs';wrapper.setAttribute('aria-label','족보닷컴 원본 하위 메뉴');
  wrapper.appendChild(sub);host.appendChild(wrapper);
 }
 const filters=template(doc.filterHTML,'.zbFilter')||template(doc.filterHTML,'#filter');
 if(filters){
  const items=doc.filters||[];
  for(const [i,button] of [...filters.querySelectorAll('button')].entries()){
   const f=items[i];if(!f)continue;
   const match=(f.onclick||'').match(/getBottomSheetLayer\('([A-Z_]+)'/);
   const key=match?.[1]||f.action;
   if(key)button.dataset.zbFilter=key;
   // The original school dropdown enables downstream fields after selection.
   if(key==='filter_gu'&&window.ZOCBO_FAITHFUL_INSPECT?.().current?.fDisplay?.filter_si)button.disabled=false;
   if(key==='filter_sch'&&window.ZOCBO_FAITHFUL_INSPECT?.().current?.fDisplay?.filter_gu)button.disabled=false;
  }
  const wrapper=document.createElement('div');wrapper.className='zb-original-filters';
  wrapper.appendChild(filters);host.appendChild(wrapper);
 }
}
function attachPromo(host,doc){
 const banner=template(doc.bannerHTML,'.hijeckingBanner');
 if(banner){
  const anchor=banner.querySelector('a');
  if(anchor){anchor.href='https://m.zocbo.com/payment/';anchor.target='_blank';anchor.rel='noopener noreferrer';}
  for(const b of banner.querySelectorAll('button'))b.type='button';
  const box=document.createElement('div');box.className='zb-original-banner';box.appendChild(banner);host.appendChild(box);
 }
 const guide=template(doc.utilityHTML,'.content__utility');
 if(guide){
  const btn=guide.querySelector('#MenuDescription button');
  if(btn){btn.dataset.zbGuide='1';btn.type='button';}
  const wrap=document.createElement('div');wrap.className='zb-original-utility';wrap.appendChild(guide);host.appendChild(wrap);
 }
}
function sourceFooter(app){
 if(!app||app.querySelector(':scope > .zb-original-footer'))return;
 const footer=document.createElement('nav');
 footer.className='zb-original-footer';
 footer.setAttribute('aria-label','족보닷컴 원본 모바일 하단 메뉴');
 footer.innerHTML='<a href="https://m.zocbo.com/" target="_blank" rel="noopener noreferrer"><b>⌂</b><small>홈</small></a>'
  +'<button data-zb-site="M" type="button"><b>Ⓜ</b><small>중등</small></button>'
  +'<button data-zb-site="H" type="button"><b>Ⓗ</b><small>고등</small></button>'
  +'<a href="https://m.zocbo.com/H/" target="_blank" rel="noopener noreferrer"><b>▤</b><small>고등 문제제</small></a>'
  +'<a href="https://m.zocbo.com/freetrial/freereading.asp" target="_blank" rel="noopener noreferrer"><b>▣</b><small>기출열람실</small></a>';
 const scroll=app.querySelector(':scope > .appscroll');
 if(scroll)scroll.insertAdjacentElement('afterend',footer);
}
function originalDialog(title,body){
 const current=document.querySelector('.zb-original-dialog');
 if(current)current.remove();
 const box=document.createElement('section');box.className='zb-original-dialog';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
 box.innerHTML='<div class="zb-original-dialog-bg" data-zb-close></div><div class="zb-original-dialog-panel"><div class="zb-original-dialog-title"><strong>'+escape(title)+'</strong><button type="button" data-zb-close>×</button></div><div class="zb-original-dialog-body">'+body+'</div></div>';
 document.querySelector('#phone .app')?.appendChild(box);
}
function guideDialog(doc){
 const source=doc.originalUrl||'https://m.zocbo.com/';
 originalDialog('이용 안내','<p>원본 모바일 사이트의 해당 학습 메뉴 이용 안내로 이동하실 수 있습니다.</p><a target="_blank" rel="noopener noreferrer" href="'+escape(source)+'">족보닷컴 해당 메뉴 열기</a>');
}
function decorate(host,doc){
 if(host.dataset.zbChromeReady==='1')return;
 host.dataset.zbChromeReady='1';
 const top=document.createElement('div');top.className='zb-original-top-chrome';
 top.appendChild(srcHead(doc));augmentTabs(top,doc);
 host.insertBefore(top,host.firstChild);
 const below=document.createElement('div');below.className='zb-original-after-filters';attachPromo(below,doc);
 const content=host.querySelector(':scope > .zb-f-content');
 if(content)content.before(below);else host.appendChild(below);
 sourceFooter(host.closest('.app'));
}
function check(){
 pending=false;
 const host=document.querySelector('#phone .zb-faithful[data-source-case]');
 if(!host||host.dataset.zbChromeReady==='1')return;
 const key=host.dataset.sourceCase;
 if(!key)return;
 if(!cache.has(key))cache.set(key,fetch('/api/zocbo/faithful-page?'+new URLSearchParams({case:key}),{credentials:'omit'}).then(async r=>{if(!r.ok)throw Error('Source '+r.status);return r.json()}));
 cache.get(key).then(doc=>{
  const current=document.querySelector('#phone .zb-faithful[data-source-case]');
  if(current&&current.dataset.sourceCase===key)decorate(current,doc);
 }).catch(e=>{host.dataset.zbChromeReady='error';console.error('Original source chrome unavailable',e)});
}
const observer=new MutationObserver(()=>{
 if(pending)return;pending=true;queueMicrotask(check);
});
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',ev=>{
 const el=ev.target.closest('[data-zb-main],[data-zb-subcode],[data-zb-filter],[data-zb-site],[data-zb-menu],[data-zb-student],[data-zb-guide],[data-zb-close]');
 if(!el||!el.closest('#phone'))return;
 const host=el.closest('.zb-faithful')||document.querySelector('#phone .zb-faithful');
 if(el.hasAttribute('data-zb-close')){ev.preventDefault();document.querySelector('.zb-original-dialog')?.remove();return;}
 if(el.hasAttribute('data-zb-menu')){
  ev.preventDefault();
  const links=['개념학습','단원별 학습','실전대비','직전대비','학교별 맞춤학습','강남 3구 유형공략'];
  const ids=['concept','unit','practice','revision','school','gangnam'];
  originalDialog('전체 메뉴',links.map((name,i)=>'<button type="button" data-zb-main="'+ids[i]+'">'+name+'</button>').join(''));return;
 }
 if(el.hasAttribute('data-zb-student')){
  ev.preventDefault();originalDialog('학생 / 선생님','<button type="button" data-zb-close>학생</button><a target="_blank" rel="noopener noreferrer" href="https://m.zocbo.com/T/">선생님 원본 사이트</a>');return;
 }
 if(el.hasAttribute('data-zb-guide')){
  ev.preventDefault();
  const key=host?.dataset.sourceCase;
  if(key)cache.get(key)?.then(guideDialog);
  return;
 }
 let control;
 if(el.hasAttribute('data-zb-main'))control=host?.querySelector('.zb-f-main-tabs [data-action="zbFMain"][data-value="'+el.dataset.zbMain+'"]');
 if(el.hasAttribute('data-zb-subcode'))control=host?.querySelector('.zb-f-subtabs [data-action="zbFSub"][data-value="'+el.dataset.zbSubcode+'"]');
 if(el.hasAttribute('data-zb-filter'))control=host?.querySelector('.zb-f-filter [data-action="zbFFilter"][data-value="'+el.dataset.zbFilter+'"]');
 if(el.hasAttribute('data-zb-site'))control=host?.querySelector('.zb-f-sitebar [data-action="zbFSite"][data-value="'+el.dataset.zbSite+'"]');
 if(control){ev.preventDefault();document.querySelector('.zb-original-dialog')?.remove();control.click();}
},{capture:true});
check();
})();
