import {chromium} from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('zocbo-inline-qa',{recursive:true});
// Regression: YPT shell padding must not force 410px original DOM width on a 390px viewport.
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();
const checks=[],errors=[];
page.on('pageerror',err=>errors.push({msg:err.message,stack:String(err.stack||'').slice(0,300)}));
const check=(yes,label)=>{const pass=!!yes;checks.push({label,pass});console.log((pass?'PASS':'FAIL')+' '+label);if(!pass)errors.push({test:label})};
const count=s=>page.locator(s).count();
async function visit(screen,search=''){await page.goto('http://127.0.0.1:3000/?screen='+encodeURIComponent(screen)+search,{waitUntil:'domcontentloaded'});await page.waitForSelector('#phone .app',{timeout:10000});await page.waitForTimeout(120)}
async function shot(name){await page.locator('#phone').screenshot({path:'zocbo-inline-qa/'+name,timeout:18000})}
async function dimensions(){return page.locator('#phone .appscroll').evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}))}
try{
 await visit('bankDownload');
 check(await count('#phone iframe')===0,'No iframe on original official download page');
 check(await count('#phone .zb-inline-root #event-content')===1,'Original public DOM content inserted directly inside HITEL');
 check(await count('#phone .zb-inline-root button[data-act="sampleDown"]')===35,'Exact 35 original HTML download controls preserved');
 check(await count('#phone .zb-inline-root button[data-action="zbOriginalDownload"]')===35,'All original download buttons wired');
 check(await count('#phone .zb-inline-root .ui-tab.is-secondary[data-group-active="1"]')===1,'Original high school tab active');
 check(await count('#phone .zb-inline-root .ui-tab.is-secondary .ui-tab-content[data-active="1"] .data__item')===6,'High school grade 1 six original subjects');
 check(await count('#phone .appbar')===1,'Only one HITEL top bar');
 check(await count('#phone nav.bottomnav')===1,'Only one bottom navigation bar');
 const dm=await dimensions();const overflowDiag=await page.locator('#phone .appscroll').evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('*')].map(n=>({tag:n.tagName,cl:n.className?.baseVal||n.className,right:Math.round(n.getBoundingClientRect().right-r.right),width:Math.round(n.getBoundingClientRect().width)})).filter(x=>x.right>2).sort((a,b)=>b.right-a.right).slice(0,9)});console.log('LAYOUT_DIMENSIONS',JSON.stringify({dm,overflowDiag}));check(dm.scrollWidth<=dm.clientWidth+3,'No horizontal overflow at 390 px');
 check(dm.scrollHeight>dm.clientHeight,'One independent HITEL scrolling content');
 check(await count('#phone .zb-iframe-wrap')===0,'Old double-scrolling iframe container removed');
 const origStyle=await page.locator('#phone .data__subject strong').first().evaluate(el=>getComputedStyle(el).fontSize);
 check(origStyle==='17px','Original CSS rule applied and adapted responsively');
 await shot('01-inline-official-high1.png');

 await page.locator('#phone .ui-tab.is-secondary .ui-tab-nav button[data-value="고2"]').click();
 check(await count('#phone .ui-tab.is-secondary .ui-tab-content[data-active="1"] .data__item')===8,'Original grade 2 buttons show 8 subjects');
 await page.locator('#phone .zocbo-inline-grade-switch button[data-value="중2"]').click();
 check(await count('#phone .ui-tab.is-primary[data-group-active="1"] .ui-tab-content[data-active="1"] .data__item')===8,'Middle grade 2 source rows 8');
 await page.locator('#phone .ui-tab.is-primary .ui-tab-nav button[data-value="중3"]').click();
 check(await count('#phone .ui-tab.is-primary .ui-tab-content[data-active="1"] .data__item')===7,'Middle grade 3 source rows 7');
 await shot('02-inline-original-middle3.png');

 await visit('bankPaper','&paper=H1-SC');
 check(await count('#phone iframe')===0,'No iframe on integrated H1 science detail');
 check((await page.locator('#phone .zocbo-inline-title').textContent()).includes('통합과학'),'H1 integrated science title from public source');
 check(await count('#phone .zb-inline-root .data__item')===1,'Actual source DOM subject row alone displayed inline');
 check((await page.locator('#phone .zb-inline-root .data__subject strong').textContent()).includes('통합과학'),'Subject label precisely matches original markup');
 await shot('03-inline-high1-science-detail.png');
 await page.locator('#phone button[data-action="zbOriginalDownload"]').click();
 check(await count('#phone .zocbo-handoff')===1,'Original download click opens credential-safe official handoff');
 check(await count('#phone .zocbo-handoff a[href="https://m.zocbo.com/event/pre-test2026d/"]')===1,'Correct official original download page target');
 check((await page.locator('#phone .zocbo-handoff').textContent()).includes('고1 · 통합과학'),'Original source subject context retained in handoff');
 await shot('04-inline-science-download-handoff.png');
 await page.locator('#phone button[data-action="zbOpenSelectedInList"]').click();
 check((await page.locator('#stageTitle').textContent()).includes('다운로드'),'Selected subject routes into full original list');
 check(await count('#phone .ui-tab.is-secondary .data__item[data-selected="1"]')===1,'Selected source item highlighted among original rows');
 check((await page.locator('#phone .ui-tab.is-secondary .data__item[data-selected="1"] .data__subject').textContent()).includes('통합과학'),'Chosen science subject maintained on new page');

 await visit('bankLogin');
 check(await count('#phone iframe')===0,'No third-party login iframe');
 check(await count('#phone input[type="password"]')===0,'User password never collected on HITEL domain');
 check(await count('#phone .zocbo-native-handoff a[href="https://m.zocbo.com/Member/login.asp"]')===2,'Direct official login offers new/current tab');
 await shot('05-inline-login-official-handoff.png');
 await visit('bankFree');
 check(await count('#phone iframe')===0,'Native-only free reader has no broken iframe');
 check(await count('#phone .zocbo-native-handoff a[href="https://m.zocbo.com/Freetrial/FreeReading.asp"]')===2,'Official native app link retained');
 await visit('bankSearch');
 check(await count('#phone .zb-paper-card')===35,'Original public 35 document search maintained');
 await visit('home');
 check(await count('#phone .timer-hero')===1,'Original YPT time tracking home preserved');
 check(await count('#phone nav.bottomnav button')===5,'Existing five tab navigation preserved');
 const health=await page.request.get('http://127.0.0.1:3000/health');const data=await health.json();
 check(data.zocboOriginalInline&&data.zocboIframeCount===0,'Server identifies iframe-free source integration');
} catch(e){errors.push({execution:String(e.stack||e)})}
const report={count:checks.length,passed:checks.filter(x=>x.pass).length,errors,checks,iframeUsed:false,sourceRows:35,credentialLoginTested:false,actualProtectedFileDownloaded:false};
fs.writeFileSync('zocbo-inline-qa/report.json',JSON.stringify(report,null,2));
await browser.close();
console.log('SUMMARY',report.count,'checks, passes',report.passed,'errors',errors.length);
if(errors.length)process.exit(1);
