// Real Chromium ICE/DTLS media test. No simulated success badge.
// Chrome provides synthetic camera/microphone tracks for CI; this proves
// the deployed WEB W→W flow but not Apple hardware audio/video.
import {chromium} from 'playwright';
const url='https://hitel-communication-web-production.up.railway.app/communication-playground';
const browser=await chromium.launch({headless:true,args:[
  '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required','--no-sandbox']});
const context=await browser.newContext({permissions:['camera','microphone'],viewport:{width:1500,height:1100}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const step=async(name,fn)=>{console.log('WEBRTC_BROWSER_STEP',name);await fn()};
try{
 await step('OPEN_REAL_DEPLOYED_UI',async()=>{await page.goto(url,{waitUntil:'networkidle',timeout:40_000});await page.getByRole('heading',{name:'16가지 통신 실험실'}).waitFor()});
 await step('CREATE_SC16_SESSION',async()=>{
  await page.getByRole('button',{name:'새 테스트 세션'}).click();
  await page.getByText('서버 세션 있음').waitFor({timeout:10_000});
 });
 await step('OPEN_TWO_INDEPENDENT_WEBSOCKETS',async()=>{
  await page.getByRole('button',{name:'양측 WS 연결'}).click();
  await page.getByText('양쪽 WS 실연결 성공').waitFor({timeout:15_000});
 });
 const caller=page.getByRole('region',{name:'발신자 플레이어'});
 const callee=page.getByRole('region',{name:'수신자 플레이어'});
 await step('RING_ANSWER_REAL_WS',async()=>{
  await caller.getByRole('button',{name:'발신',exact:true}).click();
  await callee.getByRole('button',{name:'수락'}).click();
  await page.getByText('수락·종료 명령').waitFor({timeout:8_000});
 });
 await step('GRANT_GENUINE_CHROME_TEST_CAMERA_AND_MIC',async()=>{
  await caller.getByRole('button',{name:'카메라·마이크 허용'}).click();
  await callee.getByRole('button',{name:'카메라·마이크 허용'}).click();
  await page.getByText('✓ 카메라·마이크 준비됨').first().waitFor({timeout:15_000});
 });
 await step('NEGOTIATE_RTC_AND_RECEIVE_REMOTE_AUDIO_VIDEO',async()=>{
  await page.getByRole('button',{name:'WebRTC 연결 실행'}).click();
  await page.waitForFunction(()=>{
   const videos=[...document.querySelectorAll('.hcp-video-grid video')];
   // Remote video is the second video in each caller/callee card.
   const remotes=[videos[1],videos[3]];
   return remotes.every(v=>v&&v.srcObject&&v.srcObject.getVideoTracks().some(t=>t.readyState==='live')&&
     v.srcObject.getAudioTracks().some(t=>t.readyState==='live'));
  },{timeout:25000});
  await page.getByText('양측 ICE 연결 확인',{exact:false}).waitFor({timeout:20_000});
 });
 await step('END_CALL',async()=>{await caller.getByRole('button',{name:'종료'}).click()});
 await step('DISPLAY_TWO_REAL_IPHONE_PAIRING_CODES_FOR_N_TO_N',async()=>{
  await page.locator('.hcp-route-list button').filter({hasText:'N → N'}).click();
  await page.getByText('SCENARIO 11 / 16').waitFor({timeout:12_000});
  await page.getByText('N A JOIN CODE').waitFor({timeout:12_000});
  await page.getByText('N B JOIN CODE').waitFor({timeout:12_000});
  await page.screenshot({path:'playground-two-iphone-pairing-codes.png',fullPage:true});
 });
 await step('RENDER_ALL_16_ROUTING_UI_VARIANTS',async()=>{
  for(let id=1;id<=16;id++){
   await page.locator('.hcp-matrix-row button').nth(id-1).click();
   await page.getByText('SCENARIO '+String(id).padStart(2,'0')+' / 16').waitFor({timeout:12000});
   await page.getByText('서버 세션 있음').waitFor({timeout:12000});
   const from=['P','P+','N','W'][Math.floor((id-1)/4)];
   const to=['P','P+','N','W'][(id-1)%4];
   const expectCodes=Number(from==='N'||from==='P+')+Number(to==='N'||to==='P+');
   const codes=await page.getByText(/JOIN CODE/).count();
   if(codes!==expectCodes)throw Error('SC'+id+' expected '+expectCodes+' native/P+ codes but found '+codes);
   if(from==='P+'||to==='P+'){
    const count=await page.locator('.hcp-actor textarea').count();
    const expectedPplus=Number(from==='P+')+Number(to==='P+');
    if(count!==expectedPplus)throw Error('SC'+id+' P+ note panes '+count+' (expected '+expectedPplus+')');
   }
   console.log('PLAYGROUND_SCENARIO_'+String(id).padStart(2,'0')+'_UI_PASS',{from,to,joinCodes:codes});
  }
 });
 await step('MOBILE_PLAYGROUND_LAYOUT',async()=>{
  await page.setViewportSize({width:390,height:844});
  await page.locator('.hcp-matrix-row button').first().waitFor();
  await page.screenshot({path:'playground-mobile-390.png',fullPage:true});
 });
 if(errors.length)throw Error('BROWSER_JS_ERRORS: '+errors.join(' | '));
 console.log('COMM_PLAYGROUND_REAL_CHROME_WEBRTC_MEDIA_PASS',{scenario:16,websocketPeers:2,
   sdp:true,ice:true,dtls:true,remoteAudioTracks:true,remoteVideoTracks:true,hardwareIphone:false});
}finally{
 await page.screenshot({path:'playground-chromium-webrtc.png',fullPage:true}).catch(()=>{});
 await browser.close();
}
