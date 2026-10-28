import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='mobile-test-results/ws-scrcpy-browser';
mkdirSync(out,{recursive:true});
const statusUrl='https://hitel-communication-web-production.up.railway.app/lab-sandbox/ws-scrcpy/status';
const current=await (await fetch(statusUrl,{signal:AbortSignal.timeout(12000)})).json();
if(current.online!==true||!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(current.url||''))throw Error('REAL_ANDROID_WS_SCRCPY_HOST_NOT_ONLINE');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:850},ignoreHTTPSErrors:false});
const events=[];
let received=0;
page.on('console',m=>events.push(['console',m.type(),m.text().slice(0,300)]));
page.on('pageerror',e=>events.push(['pageerror',String(e).slice(0,300)]));
page.on('websocket',socket=>{
 events.push(['websocket',socket.url()]);
 socket.on('framereceived',frame=>{received++;if(received<=15)events.push(['frame',socket.url(),typeof frame.payload==='string'?'text':'binary',frame.payload.length]);});
 socket.on('socketerror',e=>events.push(['socketerror',String(e)]));
});
try{
 await page.goto(current.url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(10000);
 await page.screenshot({path:out+'/viewer-initial.png',fullPage:true});
 const before=await page.evaluate(()=>({
  title:document.title,text:document.body.innerText.slice(0,2500),
  canvases:[...document.querySelectorAll('canvas')].map(e=>({width:e.width,height:e.height})),
  buttons:[...document.querySelectorAll('button')].slice(0,40).map(e=>e.innerText||e.title||e.ariaLabel)
 }));
 events.push(['DOM',before]);
 const deviceText=page.getByText(/emulator-5554|Pixel_4|Pixel 4|Android 11/i).first();
 if(await deviceText.count()){
  await deviceText.click({timeout:5000}).catch(e=>events.push(['device-click-error',String(e).slice(0,200)]));
 }
 await page.waitForTimeout(16000);
 await page.screenshot({path:out+'/viewer-after-device-select.png',fullPage:true});
 const after=await page.evaluate(()=>({
   text:document.body.innerText.slice(0,3000),
   canvases:[...document.querySelectorAll('canvas')].map(e=>({width:e.width,height:e.height})),
   videos:[...document.querySelectorAll('video')].map(e=>({width:e.videoWidth,height:e.videoHeight,readyState:e.readyState})),
   images:[...document.querySelectorAll('img')].map(e=>({width:e.naturalWidth,height:e.naturalHeight}))
 }));
 events.push(['DOM_AFTER',after]);
 const canvases=page.locator('canvas');
 if(await canvases.count()){
   const rect=await canvases.first().boundingBox();
   if(rect&&rect.width>=50&&rect.height>=50){
    await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.mouse.down();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2-90,{steps:8});await page.mouse.up();
    await page.keyboard.press('Escape');
    events.push(['native-input-sent','click','drag','key']);
   }
 }
 await page.waitForTimeout(1000);
 await page.screenshot({path:out+'/viewer-after-input.png',fullPage:true});
 writeFileSync(out+'/report.json',JSON.stringify({online:current.online,url:current.url,websocketFrames:received,before,after,events},null,2));
 console.log('HITEL_REAL_BROWSER_E2E',JSON.stringify({websocketFrames:received,before,after,events:events.slice(-12)}));
 if(received===0)throw Error('NO_LIVE_WEBSOCKET_FRAMES');
}finally{await browser.close();}
