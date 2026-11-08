import {chromium} from 'playwright';
import fs from 'node:fs';
const base='http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1400,height:1000}});
const failures=[],checks=[];
page.on('pageerror',e=>failures.push('JavaScript: '+e.message));
page.on('console',m=>{if(m.type()==='error') failures.push('Console: '+m.text())});
const assert=(yes,label)=>{checks.push({label,pass:!!yes});if(!yes) failures.push(label);console.log(yes?'PASS':'FAIL',label)};
async function open(id){
 await page.goto(base+'/?screen='+id,{waitUntil:'load'});
 await page.waitForSelector('#phone .app');
 await page.waitForTimeout(120);
}
await open('rankWeek');
assert(await page.locator('#phone .podium-item').count()===3,'Weekly ranking: 3 podium cells');
assert(await page.locator('#phone .rank-row').count()>=5,'Weekly ranking: positions 4 through 8');
assert(await page.locator('#phone img[src*="/rank/ic_crown.png"]').count()===1,'Original XAPK crown image rendered');
await page.screenshot({path:'qa/ypt-weekly-ranking.png'});
await page.locator('#phone [data-go="rankMonth"]').first().click();
assert((await page.locator('#stageTitle').textContent()).includes('월간'),'Monthly ranking tab navigates');
await page.locator('#phone nav.bottomnav [data-go="todo"]').first().click();
assert(await page.locator('#phone .todo-item').count()===4,'Todo: four sample content rows');
await page.screenshot({path:'qa/ypt-todo.png'});
await page.locator('#phone .todo-check').nth(1).click();
assert(await page.locator('#phone .todo-check.checked').count()===2,'Todo: checkbox toggles local state');
await page.locator('#phone [data-go="todoAdd"]').first().click();
await page.locator('#phone [data-form="taskName"]').fill('테스트 과제');
await page.locator('#phone [data-action="taskAdd"]').click();
assert(await page.locator('#phone .todo-item').count()===5,'Todo: added fifth task');
assert((await page.locator('#phone').textContent()).includes('테스트 과제'),'Todo: added task text visible');
await page.locator('#phone nav.bottomnav [data-go="calendar"]').first().click();
assert(await page.locator('#phone .calendar-grid button.date').count()===42,'Calendar: full 7x6 date grid');
await page.screenshot({path:'qa/ypt-calendar.png'});
await page.locator('#phone .calendar-grid button.date[data-value="14"]').first().click();
assert(await page.locator('#phone .calendar-grid button.date.on[data-value="14"]').count()===1,'Calendar: selected date switches');
await page.locator('#phone nav.bottomnav [data-go="home"]').first().click();
assert(await page.locator('#phone .timer-hero').count()===1,'Home: large orange timer header');
assert(await page.locator('#phone .subject-row').count()>=4,'Home: populated study subject rows');
await page.screenshot({path:'qa/ypt-home.png'});
await page.locator('#phone [data-go="timerRunning"]').first().click();
await page.locator('#phone [data-action="timerToggle"]').click();
assert((await page.locator('#phone').textContent()).includes('공부 중'),'Timer: click changes running state');
await page.locator('#phone [data-action="timerToggle"]').click();
await page.screenshot({path:'qa/ypt-timer.png'});
const graph=JSON.parse(fs.readFileSync('public/ypt-graph.js','utf8').replace(/^window\.YPT_GRAPH=/,'').trim().replace(/;$/,''));let count=0;
for(const id of Object.keys(graph)){
 await open(id);
 const content=(await page.locator('#phone .appscroll').textContent())||'';
 const ok=content.trim().length>10&&!content.includes('APK REVERSE-ENGINEERED MENU MOCK')&&!content.includes('원본 AOT 문자키:');
 if(!ok)failures.push('Empty or debug-content screen: '+id);
 count++;
}
assert(count===65,'65 UI routes all render body content');
fs.writeFileSync('qa/results.json',JSON.stringify({checks,routeCount:count,failures},null,2));
await browser.close();
if(failures.length){console.error('FAILURES',failures);process.exit(1)}
console.log('PASSED',checks.length,'checks; '+count+' body routes; no JS exceptions');
