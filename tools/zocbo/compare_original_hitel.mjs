import { chromium } from 'playwright';
import fs from 'node:fs';
const out='original-vs-hitel'; fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ko-KR'});
const page=await context.newPage();
const base='https://hitel-ypt-ui-resource-rebuild-production.up.railway.app/';
const pairs=[
 {key:'event',label:'기말고사 원본 자료 목록',original:'https://m.zocbo.com/event/pre-test2026d/',hitel:base+'?screen=bankDownload',orig:'main#event-content .promotion__section.is-data',clone:'#phone .zb-inline-root'},
 {key:'science',label:'고1 통합과학 시험자료 상세',original:'https://m.zocbo.com/event/pre-test2026d/',hitel:base+'?screen=bankPaper&paper=H1-SC',orig:'main#event-content .promotion__section.is-data',clone:'#phone .appscroll'},
 {key:'login',label:'로그인',original:'https://m.zocbo.com/Member/login.asp',hitel:base+'?screen=bankLogin',orig:'main > form#form1',clone:'#phone .zocbo-native-handoff'},
 {key:'search',label:'고등 문제은행 검색',original:'https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000020000100001&siteid=H&subject_cd=SC',hitel:base+'?screen=bankSearch',orig:'main.content > #examMain',clone:'#phone .zb-paper-list'}
];
const report=[];
for(const pair of pairs){
 const item={key:pair.key,label:pair.label};
 for(const type of ['original','hitel']){
  const original=type==='original',url=pair[type],selector=original?pair.orig:pair.clone,rec={url,selector,errors:[]};
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:28000}); rec.status=response?.status();
   await page.waitForTimeout(2500);
   if(original&&pair.key!=='search') await page.locator(selector).first().scrollIntoViewIfNeeded({timeout:9000}).catch(e=>rec.errors.push('scroll: '+e.message.slice(0,120)));
   if(original && (pair.key==='event' || pair.key==='science')){
     const btn=page.locator('main#event-content .ui-tab.is-secondary .ui-tab-nav button').first();
     await btn.click({timeout:9000}).catch(e=>rec.errors.push('high1 tab: '+e.message.slice(0,140)));
     await page.waitForTimeout(400);
     if(pair.key==='science'){
       const subject=page.locator('main#event-content button[data-act="sampleDown"][data-grade="1"][data-siteid="H"][data-subjcode="SC"]').first();
       const row=subject.locator('xpath=ancestor::*[contains(@class,"data__item")][1]');
       await row.scrollIntoViewIfNeeded({timeout:8500}).catch(e=>rec.errors.push('science row: '+e.message.slice(0,140)));
     }
   }
   if(!original && pair.key==='search'){
     await page.locator('#phone .zb-grades button[data-value="고1"]').first().click({timeout:8000}).catch(e=>rec.errors.push('hitel grade: '+e.message.slice(0,120)));
     await page.locator('#phone .zb-subject-choices button[data-value="통합과학"]').first().click({timeout:8000}).catch(e=>rec.errors.push('hitel subject: '+e.message.slice(0,120)));
   }
   rec.finalUrl=page.url();
   rec.layout=await page.evaluate((selector)=>{
     const root=document.querySelector(selector)||document.body;
     const el=document.querySelector(selector),cs=el?getComputedStyle(el):null;
     const buttons=root.querySelectorAll('button');
     const bound=el?.getBoundingClientRect();
     return {found:!!el,elementWidth:Math.round(bound?.width||0),elementHeight:Math.round(bound?.height||0),x:Math.round(bound?.x||0),y:Math.round(bound?.y||0),
      htmlBytes:el?new TextEncoder().encode(el.outerHTML).length:0,buttonCount:buttons.length,formCount:root.querySelectorAll('form').length,loginPasswordInputs:root.querySelectorAll('input[type=password]').length,
      downloadButtonCount:root.querySelectorAll('button[data-act="sampleDown"]').length,cloneDownloadButtons:root.querySelectorAll('button[data-action="zbOriginalDownload"]').length,
      images:root.querySelectorAll('img').length,iframes:document.querySelectorAll('iframe').length,tabButtons:root.querySelectorAll('.ui-tab-nav button').length,
      pageWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,font:cs?.fontFamily,fontSize:cs?.fontSize,color:cs?.color,background:cs?.backgroundColor,
      headings:[...root.querySelectorAll('h1,h2,h3')].slice(0,7).map(x=>({text:x.textContent.trim().slice(0,90),fontSize:getComputedStyle(x).fontSize})),
      sampleText:(root.innerText||'').replace(/\s+/g,' ').slice(0,800)};
   },selector);
   await page.screenshot({path:out+'/'+pair.key+'-'+type+'.png',fullPage:false,timeout:20000,animations:'disabled'}).catch(e=>rec.errors.push('screenshot: '+e.message.slice(0,140)));
   if(original && await page.locator(selector).count()){
    await page.locator(selector).first().screenshot({path:out+'/'+pair.key+'-original-section.png',timeout:15000,animations:'disabled'}).catch(e=>rec.errors.push('section shot: '+e.message.slice(0,160)));
   }
  }catch(e){rec.errors.push('capture: '+String(e.stack||e).slice(0,450))}
  item[type]=rec;
  console.log(pair.key,type,'HTTP',rec.status,'DOM',rec.layout?.found,'buttons',rec.layout?.buttonCount,'html',rec.layout?.htmlBytes,'errors',rec.errors.length);
 }
 report.push(item);
}
fs.writeFileSync(out+'/comparison.json',JSON.stringify(report,null,2));
const lines=['# 실제 족보닷컴 모바일 원본 vs HITEL 구현 비교','동일 브라우저·동일 모바일 390×844, 2026-11-08 공개 페이지 기준. 계정 로그인이나 파일 다운로드 미실행.',''];
for(const r of report){
 lines.push('## '+r.label,'- 원본 URL: '+r.original.url,'- HITEL URL: '+r.hitel.url);
 for(const t of ['original','hitel']){
  const v=r[t],d=v.layout||{};
  lines.push('- '+(t==='original'?'**원본**':'**HITEL**')+': HTTP '+v.status+', 대상 DOM '+d.found+', 본문 HTML '+d.htmlBytes+' bytes, 버튼 '+d.buttonCount+'개, 폼 '+d.formCount+'개, 비밀번호 입력 '+d.loginPasswordInputs+'개, 다운로드 버튼 '+d.downloadButtonCount+' / HITEL 재작성 다운로드 버튼 '+d.cloneDownloadButtons+', 이미지 '+d.images+'개, 가로폭 '+d.pageWidth+'/'+d.clientWidth+', 폰트 '+d.font+', 배경 '+d.background);
  if(v.errors.length)lines.push('  - 관측 제한: '+v.errors.join('; '));
 }
 lines.push('- 캡처: '+r.key+'-original.png / '+r.key+'-hitel.png','');
}
fs.writeFileSync(out+'/comparison.md',lines.join('\n'));
console.log('DONE: '+report.length+' pairs compared');
await browser.close();