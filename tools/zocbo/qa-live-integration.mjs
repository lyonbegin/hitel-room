import {chromium} from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('zocbo-qa',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const failures=[],checks=[],officialSiteWarnings=[];
page.on('pageerror',e=>{const message=e.message||String(e);if(message==="Cannot read properties of undefined (reading 'on')")officialSiteWarnings.push(message);else failures.push('JavaScript: '+message)});
function check(ok,name){checks.push({name,pass:!!ok});if(!ok)failures.push(name);console.log(ok?'PASS':'FAIL',name)}
async function open(id){await page.goto('http://127.0.0.1:3000/?screen='+id);await page.waitForSelector('#phone .app');await page.waitForTimeout(200)}
try {
 await open('home');
 check((await page.locator('#phone .timer-hero').count())===1,'Original YPT home timer preserved');
 check((await page.locator('#phone nav.bottomnav button').count())===5,'Integrated five-tab navigation present');
 check((await page.locator('#phone [data-go="bankSearch"]').count())>=1,'Bank quick entry present on home');
 await page.locator('#phone nav.bottomnav [data-go="bankHome"]').click();
 check((await page.locator('#stageTitle').textContent())==='문제은행','Bank navigable from bottom tab');
 check((await page.locator('#phone .zb-grid button').count())===4,'Bank home shows actual search/view/download sections');
 check((await page.locator('#phone .zb-subtitle').count())===0,'No reverse engineering developer text inside mobile UI');
 await page.locator('#phone .appbar [data-go="bankCategory"]').click();
 check((await page.locator('#stageTitle').textContent())==='문제 유형별 학습','Problem bank overflow menu navigates correctly');
 await page.locator('#phone nav.bottomnav [data-go="bankHome"]').click();
 const icon=await page.request.get('http://127.0.0.1:3000/zocbo-assets/app-icon.png');
 check(icon.ok()&&icon.headers()['content-type'].includes('image/png'),'Original Zocbo APK icon served');
 await page.screenshot({path:'zocbo-qa/bank-home.png'});
 await page.locator('#phone [data-go="bankSearch"]').first().click();
 check((await page.locator('#phone .zb-paper-card:not([hidden])').count())===8,'Middle school grade 2 returns 8 published records');
 await page.locator('#phone .zb-grades [data-value="고1"]').click();
 check((await page.locator('#phone .zb-paper-card:not([hidden])').count())===6,'High school grade 1 returns 6 published records');
 await page.locator('#phone .zb-grades [data-value="중2"]').click();
 await page.locator('#phone [data-zb-input="query"]').fill('수학');
 check((await page.locator('#phone .zb-paper-card:not([hidden])').count())===1,'Search query filters actual public records');
 await page.screenshot({path:'zocbo-qa/bank-search-math.png'});
 await page.locator('#phone .zb-paper-card:not([hidden]) [data-action="zbPick"]').first().click();
 check((await page.locator('#stageTitle').textContent())==='시험자료 상세','Actual catalog item opens detail');
 check((await page.locator('#phone .zb-detail-head').textContent()).includes('수학'),'Selected real item subject shown');
 const downloadLink=page.locator('#phone a[href="https://m.zocbo.com/event/pre-test2026d/"]').first();
 check(await downloadLink.count()>=1,'Download opens exact official event page');
 await page.screenshot({path:'zocbo-qa/bank-paper-detail.png'});
 check(await page.locator('#phone .zb-live-iframe').count()===1,'Actual official iframe in document detail, without intermediate navigation');
 await open('bankOriginal');
 check((await page.locator('#stageTitle').textContent())==='족보닷컴 원본 화면','Original document viewer route registered and reached');
 const iframe=page.locator('#phone iframe');
 check((await iframe.getAttribute('src'))==='https://m.zocbo.com/app/main_v2.asp','Original app WebView url embedded for browsing');
 check(await page.locator('#phone a[target="_self"][href="https://m.zocbo.com/app/main_v2.asp"]').count()>=1,'Full-page original document fallback available');
 const frameObservations=[];
 const sites=[
  ['bankSchool','https://m.zocbo.com/M/expected.asp'],
  ['bankFree','https://m.zocbo.com/Freetrial/FreeReading.asp'],
  ['bankDownload','https://m.zocbo.com/event/pre-test2026d/'],
  ['bankLogin','https://m.zocbo.com/Member/login.asp'],
  ['bankDiagnostic','https://m.zocbo.com/Freetrial/learningtest.asp']
 ];
 for(const [screen,expectedUrl] of sites){
   await open(screen);
   const embedded=page.locator('#phone .zb-live-iframe');
   check(await embedded.count()===1,'Iframe primary page: '+screen);
   check((await embedded.getAttribute('src'))===expectedUrl,'Original WebView URL: '+screen);
   check(await page.locator('#phone .zb-external-bar').count()===0,'No link-only placeholder: '+screen);
   const r=await page.request.get(expectedUrl,{timeout:15000}).catch(e=>null);
   const headers=r?.headers()||{};
   let frameText='',frameUrl='',frameError='';
   try{await page.waitForTimeout(900);const frame=page.frames().find(f=>f.url().includes('zocbo.com'));frameUrl=frame?.url()||'';frameText=(await frame?.locator('body').innerText({timeout:3000}))?.slice(0,120)||''}catch(e){frameError=String(e).slice(0,180)}
   frameObservations.push({screen,expectedUrl,httpStatus:r?.status()||null,xFrameOptions:headers['x-frame-options']||null,csp:headers['content-security-policy']||null,frameUrl,frameText,frameError});
   if(screen==='bankSchool')await page.screenshot({path:'zocbo-qa/bank-school-real-iframe.png'});
 }
 fs.writeFileSync('zocbo-qa/iframe-observations.json',JSON.stringify(frameObservations,null,2));
 console.log('IFRAME OBSERVATIONS',JSON.stringify(frameObservations));
 await open('bankOriginal');
 const reload=page.locator('#phone [data-action="zbReloadWebview"]');
 check(await reload.count()===1,'Original WebView reload button present');
 await reload.click();
 check(await page.locator('#phone iframe[src="https://m.zocbo.com/app/main_v2.asp"]').count()===1,'Reload retains original WebView URL');
 await open('bankLogin');
 check(await page.locator('#phone a[href="https://m.zocbo.com/Member/login.asp"][target="_self"]').count()>0,'Original official login accessible in same browser tab');
 await open('bankSchool');
 check(await page.locator('#phone a[href="https://m.zocbo.com/M/expected.asp"]').count()>0,'Real school-specific catalog linked');
 await open('bankFree');
 check(await page.locator('#phone a[href="https://m.zocbo.com/Freetrial/FreeReading.asp"]').count()>0,'Real free reading path linked');
 await open('bankDownload');
 check(await page.locator('#phone a[href="https://m.zocbo.com/event/pre-test2026d/"]').count()>0,'Original official download entry linked');
 await open('subjects');
 check(await page.locator('#phone [data-go="bankSearch"]').count()>0,'Original subject page integrated with bank');
 await open('groupDetail');
 check(await page.locator('#phone [data-go="bankSearch"]').count()>0,'Original group detail integrated with bank');
 await open('calendar');
 check(await page.locator('#phone .calendar-grid button.date').count()===42,'Original calendar preserved');
 await open('todo');
 check(await page.locator('#phone .todo-item').count()===4,'Original todo preserved');
 const health=await page.request.get('http://127.0.0.1:3000/health');const meta=await health.json();
 check(meta.officialZocboPublicDocuments===35,'Server reports verified 35 published docs');
} catch(e){failures.push('Unexpected test error: '+e.stack)}
fs.writeFileSync('zocbo-qa/results.json',JSON.stringify({checked:checks.length,checks,failures,officialSiteWarnings:officialSiteWarnings.slice(0,8),officialSiteWarningsCount:officialSiteWarnings.length,externalAccountLoginTested:false,externalAuthenticatedDownloadTested:false},null,2));
await browser.close();
console.log('QA',checks.length,'checks; failures',failures.length,failures);
if(failures.length)process.exit(1);
