import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin=process.env.HITEL_ROOM_TEST_ORIGIN || 'https://hitel-web-preview-production.up.railway.app';
const testId='hitel-browser-'+Date.now();
const title='공개 영상 테스트 '+testId;
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
 '--autoplay-policy=no-user-gesture-required'
]});
const host=await browser.newContext({permissions:['camera','microphone']});
const guest=await browser.newContext({permissions:['camera','microphone']});
const hp=await host.newPage(),gp=await guest.newPage();
const errors=[];
for(const [tag,p] of [['host',hp],['guest',gp]]){
 p.on('pageerror',e=>errors.push(tag+' pageerror: '+e.message));
 p.on('console',e=>{if(e.type()==='error')errors.push(tag+' console: '+e.text().slice(0,220))});
}
async function login(page,user,role){
 await page.goto(origin+'/webrtc-room',{waitUntil:'domcontentloaded'});
 await page.getByLabel('사용자 ID').fill(user);
 await page.getByLabel('표시 이름').fill(user);
 await page.getByLabel('접속 유형').selectOption(role);
 await page.getByRole('button',{name:/대화방 입장하기/}).click();
 await page.getByText('공개 영상 대화방',{exact:true}).waitFor({timeout:30000});
}
async function remoteReady(page){
 await page.waitForFunction(()=>{
  const videos=[...document.querySelectorAll('.video-grid video')];
  return videos.length>=2&&videos.some(v=>{
   const media=v.srcObject;
   return media && [...media.getTracks()].some(track=>track.kind==='video'&&track.readyState==='live') &&
     v.videoWidth>0&&v.readyState>=2;
  });
 },null,{timeout:45000});
}
try {
 await login(hp,testId+'-host','doctor');
 await hp.getByRole('button',{name:/공개방 만들기/}).click();
 await hp.getByLabel('방 이름').fill(title);
 await hp.getByRole('button',{name:/방을 만들고 입장/}).click();
 await hp.locator('.video-grid video').first().waitFor({timeout:35000});
 assert.equal(await hp.locator('.video-grid video').count(),1);
 console.log('Browser host created and entered public room: PASS');

 await login(gp,testId+'-guest','user');
 await gp.getByRole('button',{name:new RegExp(title)}).click();
 await gp.locator('.video-grid video').first().waitFor({timeout:35000});
 console.log('Browser guest entered from shared room list: PASS');

 await Promise.all([remoteReady(hp),remoteReady(gp)]);
 console.log('Two Chromium browsers received live remote video tracks: PASS');
 for(const [label,page] of [['host',hp],['guest',gp]]){
   const audio=await page.evaluate(()=>{
     const videos=[...document.querySelectorAll('.video-grid video')];
     return videos.some((v,i)=>i>0&&v.srcObject?.getAudioTracks().some(t=>t.readyState==='live'));
   });
   assert.ok(audio,label+' must receive a live remote audio track');
 }
 console.log('Two Chromium browsers received live remote audio tracks: PASS');
 await hp.screenshot({path:'hitel-public-host.png'});
 await gp.screenshot({path:'hitel-public-guest.png'});
} catch(e){
 console.log('E2E browser diagnostics:',JSON.stringify(errors.slice(-9)));
 console.log('Host page status:',(await hp.locator('body').innerText()).slice(-1400));
 console.log('Guest page status:',(await gp.locator('body').innerText()).slice(-1000));
 await hp.screenshot({path:'hitel-public-host.png'}).catch(()=>{});
 await gp.screenshot({path:'hitel-public-guest.png'}).catch(()=>{});
 throw e;
} finally {
 hp.once('dialog',dialog=>void dialog.accept());
 await hp.getByRole('button',{name:'대화방 종료'}).click({timeout:2500}).catch(()=>{});
 await Promise.all([host.close(),guest.close()]);
 await browser.close();
}
