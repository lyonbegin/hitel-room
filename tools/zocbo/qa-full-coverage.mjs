import {chromium} from 'playwright';
import fs from 'node:fs';
const root='http://127.0.0.1:3000';
fs.mkdirSync('audit-v2',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1460,height:1020}});
const page=await context.newPage();
const results=[],failures=[],jsErrors=[];
page.on('pageerror',e=>jsErrors.push(e.message));
const check=(test,description)=>{const ok=!!test;results.push({description,passed:ok});console.log(ok?'PASS':'FAIL',description);if(!ok)failures.push(description)};
const goto=async(id)=>{await page.goto(root+'/?screen='+encodeURIComponent(id),{waitUntil:'domcontentloaded'});await page.waitForSelector('#phone .app',{timeout:15000});await page.waitForTimeout(90)};
const count=async(sel)=>page.locator(sel).count();
const title=async()=>page.locator('#stageTitle').textContent();
try{
 await goto('home');
 check(await count('#phone .timer-hero')===1,'Home timer retained');
 check(await count('#phone nav.bottomnav button')===5,'Five bottom tabs retained');
 check(await count('#phone [data-go="bankHome"]')>0,'Home bank direct entry');
 await page.screenshot({path:'audit-v2/01-ypt-home.png'});
 await goto('groups');check((await page.locator('#phone').textContent()).includes('스터디'),'Existing group shell preserved');
 await goto('groupDetail');check((await page.locator('#phone').textContent()).includes('5명'),'Five member group cap reflected');
 check(await count('#phone [data-go="bankSearch"]')>0,'Group shared paperbank entry');
 await goto('subjects');check(await count('#phone [data-go="bankSearch"]')>0,'Subject page shared paperbank entry');
 await goto('todo');check(await count('#phone .todo-item')>=4,'Todo list preserved');check(await count('#phone [data-go="bankSearch"]')>0,'Todo to paperbank');
 await goto('calendar');check(await count('#phone .calendar-grid button.date')===42,'Calendar month grid preserved');check(await count('#phone [data-go="bankSearch"]')>0,'Calendar to paperbank');
 await goto('planner');check(await count('#phone [data-go="bankSearch"]')>0,'Planner to paperbank');

 await goto('bankHome');
 check(await count('#phone .zb-grid button')===4,'Main paperbank core functions');
 check(await count('#phone [data-go="bankSaved"]')>0,'Bookmarks entry visible');
 await page.screenshot({path:'audit-v2/02-bank-home.png'});
 await page.locator('#phone nav.bottomnav [data-go="bankSearch"]').first().count().then(async n=>{
  if(n)await page.locator('#phone nav.bottomnav [data-go="bankSearch"]').first().click(); else await page.locator('#phone [data-go="bankSearch"]').first().click();
 });
 check((await title()).includes('문제 검색'),'Search navigation');
 check(await count('#phone .zb-paper-card')===35,'All 35 actual public records rendered by default');
 check((await page.locator('#phone .zb-list-head').textContent()).includes('35건'),'Public count 35');
 await page.locator('#phone .zb-grades [data-value="중2"]').first().click();
 check(await count('#phone .zb-paper-card')===8,'Middle grade 2 count 8');
 await page.locator('#phone .zb-subject-choices [data-value="수학"]').first().click();
 check(await count('#phone .zb-paper-card')===1,'Middle grade 2 Math exact filter');
 let official=page.locator('#phone .zb-external-bar a.zb-primary-link');
 check((await official.getAttribute('href')||'').includes('subject_cd=MT'),'Math routed to official MT subject URL');
 check((await official.getAttribute('href')||'').includes('siteid=M'),'Middle-school official siteid');
 await page.locator('#phone .zb-grades [data-value="고1"]').first().click();
 check(await count('#phone .zb-paper-card')===6,'High grade 1 list 6');
 await page.locator('#phone .zb-subject-choices [data-value="공통영어"]').first().click();
 check(await count('#phone .zb-paper-card')===1,'High grade 1 Common English filter');
 const href=await page.locator('#phone .zb-external-bar a.zb-primary-link').getAttribute('href');
 check(href.includes('subject_cd=EG')&&href.includes('siteid=H'),'English official search URL exact subject code/level');
 await page.screenshot({path:'audit-v2/03-bank-english-filter.png'});
 await page.locator('#phone .zb-paper-card .zb-paper-main').first().click();
 check(await title()==='시험자료 상세','Detail screen opens');
 check((await page.locator('#phone .zb-detail-head').textContent()).includes('공통영어'),'Detail selected matching source item');
 let dl=page.locator('#phone .zb-external-bar a.zb-primary-link').first();
 check((await dl.getAttribute('href'))==='https://m.zocbo.com/event/pre-test2026d/','Download launches genuine original public event list');
 check((await dl.getAttribute('target'))==='_blank','Download preserves HITEL while opening official service');
 check(await count('#phone .zb-live-iframe')>=1,'Real website preview iframe provided');
 check((await page.locator('#phone .zb-external-bar').textContent()).includes('고1 · 공통영어'),'Honest exact subject selection instruction');
 check((await page.locator('#phone .zb-external-bar a.zb-link').first().getAttribute('href')||'').includes('subject_cd=EG'),'Detail provides actual subject-specific original exam list');
 await page.screenshot({path:'audit-v2/04-bank-detail.png'});
 const url=new URL(page.url());check(url.searchParams.get('paper')==='H1-EG','Detail ID retained in shareable URL');
 await page.locator('#phone [data-action="zbRemember"]').click();
 check(await page.locator('#phone [data-action="zbRemember"]').textContent()==='책갈피 해제','Bookmark toggle works');
 check((await page.evaluate(()=>localStorage.getItem('hitel.zocbo.saved.v1'))||'').includes('H1-EG'),'Bookmark persisted locally');
 await page.reload();
 check((await page.locator('#phone .zb-detail-head').textContent()).includes('공통영어'),'Shared detail permalink survives refresh');
 await goto('bankSaved');
 check((await page.locator('#phone').textContent()).includes('공통영어'),'Saved title list rehydrates across page load');
 await page.locator('#phone .zb-paper-main').first().click();
 await page.locator('#phone [data-action="zbRemember"]').click();
 await goto('bankSaved');
 check(await count('#phone .zb-paper-card')===0,'Bookmark removal works');

 await goto('bankFree');
 const freeText=await page.locator('#phone .zb-external-bar').textContent();
 check(freeText.includes('앱')&&freeText.includes('웹'),'Free reading distinguishes installed-app from browser viewer');
 check(await count('#phone a[href="https://m.zocbo.com/Freetrial/FreeReading.asp"]')>0,'Original official app deep-link provided');
 check(await count('#phone a[href="https://m.zocbo.com/exam/school/previousexam.asp?search_webview=Y"]')>0,'Verified direct free reading web viewer provided');
 check((await page.locator('#phone .zb-live-iframe').getAttribute('src')||'').includes('search_webview=Y'),'Viewer iframe uses web path rather than app redirect');
 await page.screenshot({path:'audit-v2/05-free-viewer.png'});

 await goto('bankLogin');
 check(await count('#phone a[href="https://m.zocbo.com/Member/login.asp"][target="_blank"]')>0,'Official login new-tab option retains HITEL');
 check(await count('#phone a[href="https://m.zocbo.com/Member/login.asp"][target="_self"]')>0,'Official login same-tab option exists');
 check((await page.locator('#phone .zb-live-iframe').getAttribute('src'))==='https://m.zocbo.com/Member/login.asp','Official native login webpage configured');
 await page.screenshot({path:'audit-v2/06-login.png'});
 await goto('bankDownload');check((await page.locator('#phone .zb-live-iframe').getAttribute('src'))==='https://m.zocbo.com/event/pre-test2026d/','Download uses actual public event page');
 await goto('bankCategory');check(await count('#phone .zb-feature-row')>=10,'All direct original service sections retained');
 
 const graph=await page.evaluate(()=>window.YPT_GRAPH);
 const routes=Object.keys(graph),missingTargets=[],emptyRoutes=[];
 for(const id of routes){
  await goto(id);
  const stats=await page.evaluate(()=>{
   const area=document.querySelector('#phone');return {len:(area?.textContent||'').trim().length,buttons:[...area.querySelectorAll('[data-go]')].map(x=>x.dataset.go)}});
  if(stats.len<10) emptyRoutes.push(id);
  for(const dest of stats.buttons){if(!graph[dest]&&!['external_google','external_apple','email_entry','more_options','privacy','terms'].includes(dest)) missingTargets.push({screen:id,dest});}
 }
 check(routes.length>=75,'All original YPT and newly integrated bank screen routes retained');
 check(emptyRoutes.length===0,'No blank main UI screens across full route graph');
 check(missingTargets.length===0,'All navigational targets resolve to actual UI routes');
 fs.writeFileSync('audit-v2/routes.json',JSON.stringify({routes:routes.length,emptyRoutes,missingTargets},null,2));
 const catalog=await page.evaluate(()=>window.ZOCBO_CATALOG);
 check(catalog.length===35,'Original public catalog dataset still 35');
 check(catalog.every(x=>x.downloadAction==='sampleDown'&&x.source==='https://m.zocbo.com/event/pre-test2026d/'&&x.grade&&x.subject_cd),'Every public row preserves original action and identifier metadata');
} catch(e){failures.push('Test execution exception: '+e.stack)}
const report={tested:results.length,passes:results.filter(x=>x.passed).length,failures,jsErrors,results,accountLoginExecuted:false,authenticatedFileDownloaded:false};
fs.writeFileSync('audit-v2/results.json',JSON.stringify(report,null,2));
console.log('RESULT',report.tested,'checks; failures',failures.length,'jsErrors',jsErrors.length,failures.slice(0,10));
await browser.close();
if(failures.length||jsErrors.length)process.exit(1);
