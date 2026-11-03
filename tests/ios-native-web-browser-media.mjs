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
  // Assert actual rendered IMAGE colors, not a UI badge or an RTP-only state.
  // The web VideoCore texture must contain visible blue AND white facial detail.
  await page.waitForFunction(()=>{
    const v=[...document.querySelectorAll('.video-grid video')][1];
    if(!v || v.readyState<2 || v.videoWidth<120)return false;
    const c=document.createElement('canvas');
    c.width=320;c.height=240;
    const context=c.getContext('2d',{willReadFrequently:true});
    context.drawImage(v,0,0,320,240);
    const pixels=context.getImageData(0,0,320,240).data;
    let blue=0,white=0;
    for(let i=0;i<pixels.length;i+=4*4){
      const [r,g,b,a]=pixels.slice(i,i+4);
      if(a<200)continue;
      if(b>120&&b>g+32&&b>r+45)blue++;
      if(r>170&&g>170&&b>170)white++;
    }
    return blue>80&&white>25;
  },null,{timeout:45000,polling:600});
  const photo=await page.evaluate(()=>{
    const video=[...document.querySelectorAll('.video-grid video')][1];
    const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;
    c.getContext('2d').drawImage(video,0,0);
    return c.toDataURL('image/png');
  });
  fs.writeFileSync('hitel-ios-original-blue-mask-remote.png',Buffer.from(photo.split(',')[1],'base64'));
  console.log('NATIVE_IOS_ORIGINAL_BLUE_WHITE_MINDAR_FACE_MASK_RENDERED_IN_BROWSER_PASS');
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
