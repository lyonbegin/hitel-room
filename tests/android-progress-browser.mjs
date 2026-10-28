import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='mobile-test-results/android-progress-ui';
mkdirSync(out,{recursive:true});
let stage='idle',startCount=0;
const bootOrder=['queued','claimed','kvm','sdk','emulator','booted','scrcpy','tunnel','ready'];
const startedAt=new Date(Date.now()-12000).toISOString();
const stages={
 queued:'GitHub 예약 실행기에서 작업 수락을 기다리고 있습니다.',
 claimed:'GitHub 실행기가 요청을 수락했습니다.',
 kvm:'실제 /dev/kvm 가속 장치를 확인했습니다.',
 failed:'KVM 장치에 연결할 수 없습니다.',
 stopped:'실행 요청이 취소되었습니다.'
};
const snapshot=()=>({ok:true,online:false,engine:'ws-scrcpy',launchAvailable:true,
 launchState:stage==='queued'?'queued':stage==='idle'?'idle':'booting',
 progress:{stage,message:stages[stage]||'실행 준비',updatedAt:new Date().toISOString(),
 startedAt,elapsedSeconds:12,runId:stage==='idle'||stage==='queued'?null:'12345678',
 runUrl:stage==='idle'||stage==='queued'?null:'https://github.com/lyonbegin/hitel-room/actions/runs/12345678',
 error:stage==='failed'?stages.failed:null,history:bootOrder.filter(x=>x===stage || (bootOrder.indexOf(x)<bootOrder.indexOf(stage))).slice(0,9).map(x=>({stage:x,time:new Date().toISOString(),message:stages[x]||x}))}});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1100,height:950}});
const url='https://hitel-communication-web-production.up.railway.app/android-original/';
try{
 await page.route('**/lab-sandbox/ws-scrcpy/status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot()),headers:{'cache-control':'no-store'}}));
 await page.route('**/lab-sandbox/ws-scrcpy/start',route=>{
  startCount++;stage='queued';return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({ok:true,launchState:'queued'})});
 });
 await page.route('**/lab-sandbox/ws-scrcpy/stop',route=>{
  stage='stopped';return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,cancelled:true})});
 });
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
 await page.getByText('Android 11 실행 진행현황').waitFor({timeout:12000});
 assert.ok(await page.getByText('실행 요청 접수').count());
 assert.ok(await page.getByText('KVM 가속 확인').count());
 await page.getByRole('button',{name:/Android 11 실제 실행/}).click();
 await page.getByText(stages.queued).first().waitFor({timeout:12000});
 assert.equal(startCount,1);
 assert.equal(await page.getByRole('button',{name:/Android 실행 진행 중/}).isDisabled(),true);
 await page.screenshot({path:out+'/queue-live-progress.png',fullPage:true});
 stage='kvm';
 await page.getByText(stages.kvm).first().waitFor({timeout:14000});
 assert.ok(await page.getByText('#12345678 실행 로그 확인').count());
 await page.screenshot({path:out+'/kvm-live-progress.png',fullPage:true});
 stage='failed';
 await page.getByText(stages.failed).first().waitFor({timeout:14000});
 assert.equal(await page.getByRole('button',{name:/Android 11 실제 실행/}).isDisabled(),false);
 await page.screenshot({path:out+'/failed-and-retry.png',fullPage:true});
 stage='queued';
 await page.getByRole('button',{name:/실행 대기 취소·종료/}).click();
 await page.getByText(stages.stopped).first().waitFor({timeout:14000});
 await page.screenshot({path:out+'/cancelled-progress.png',fullPage:true});
 writeFileSync(out+'/result.json',JSON.stringify({pass:true,startCount,stages:['idle','queued','kvm','failed','stopped']},null,2));
 console.log('HITEL_PROGRESS_BROWSER_UI_PASS',JSON.stringify({startCount,stages:['idle','queued','kvm','failed','stopped']}));
}finally{await browser.close()}
