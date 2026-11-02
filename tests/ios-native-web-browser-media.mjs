// Full native-iOS Simulator <-> actual production browser room WebRTC video test.
// Native sends generated simulator-only WebRTC frames; web sends fake Chromium
// camera frames. No credentials are printed or included in artifacts.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin='https://hitel-room-production-ecce.up.railway.app';
const file=process.env.HITEL_E2E_ROOM_FILE;
if(!file)throw Error('HITEL_E2E_ROOM_FILE missing');
const test=JSON.parse(fs.readFileSync(file,'utf8'));
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required'
]});
const context=await browser.newContext({permissions:['camera','microphone']});
const page=await context.newPage();
const failures=[];
page.on('pageerror',e=>failures.push('page: '+e.message));
page.on('console',m=>{if(m.type()==='error')failures.push('console: '+m.text().slice(0,220))});
try{
  await page.goto(origin+'/webrtc-room',{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByLabel('사용자 ID').fill(test.guest.replace(/-ios$/,'-host'));
  await page.getByLabel('표시 이름').fill('Web E2E host');
  await page.getByLabel('접속 유형').selectOption('doctor');
  await page.getByRole('button',{name:/대화방 입장하기/}).click();
  await page.locator('.room-card').first().waitFor({timeout:30000});
  const card=page.locator('.room-card').filter({hasText:'Cross-platform same room'});
  await card.first().click();
  await page.locator('.video-grid video').first().waitFor({timeout:35000});
  await page.waitForFunction(()=>{
    const videos=[...document.querySelectorAll('.video-grid video')];
    return videos.length>=2&&videos.some((v,i)=>i>0&&v.videoWidth>0&&
      v.srcObject?.getVideoTracks().some(t=>t.readyState==='live'));
  },null,{timeout:60000});
  console.log('REAL_RAILWAY_BROWSER_RECEIVED_NATIVE_IOS_SIMULATOR_WEBRTC_VIDEO_PASS');
  await page.screenshot({path:'hitel-ios-web-interoperability.png'});
}catch(e){
  console.log('Browser diagnostics:',JSON.stringify(failures.slice(-10)));
  console.log('Visible browser UI:',(await page.locator('body').innerText().catch(()=>'' )).slice(-1400));
  await page.screenshot({path:'hitel-ios-web-interoperability.png'}).catch(()=>{});
  throw e;
}finally{
  await context.close();
  await browser.close();
}
