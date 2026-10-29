import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
const out='mobile-test-results/ws-scrcpy-browser';
mkdirSync(out,{recursive:true});
const statusUrl='https://hitel-communication-web-production.up.railway.app/lab-sandbox/ws-scrcpy/status';
const current=await (await fetch(statusUrl,{signal:AbortSignal.timeout(12000)})).json();
if(current.online!==true||!/^https:\/\/hitel-communication-web-production\.up\.railway\.app\/lab-sandbox\/ws-scrcpy\/proxy\/$/.test(current.url||''))throw Error('RAILWAY_ANDROID_REVERSE_RELAY_NOT_ONLINE');
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
 const deviceText=page.getByText(/Google sdk_gphone_x86_64|emulator-5554|Pixel_4|Pixel 4|Android 11/i).first();
 if(await deviceText.count()){
  await deviceText.click({timeout:5000}).catch(e=>events.push(['device-click-error',String(e).slice(0,200)]));
 }
 await page.waitForTimeout(2000);
 const config=page.getByRole('button',{name:/Configure stream/i});
 if(await config.count()){await config.first().click({timeout:5000}).catch(e=>events.push(['configure-click-error',String(e).slice(0,200)]));}
 await page.waitForTimeout(1800);
 const configured=await page.evaluate(()=>({text:document.body.innerText.slice(0,4500),buttons:[...document.querySelectorAll('button')].map(e=>e.innerText||e.title||e.ariaLabel)}));
 events.push(['DOM_CONFIGURED',configured]);
 for(const expression of [/^Open$/i,/^Start$/i,/Start stream/i,/Start scrcpy/i,/^Connect$/i,/^Apply$/i,/^Stream$/i]){
  const candidate=page.getByRole('button',{name:expression}).first();
  if(await candidate.count() && await candidate.isVisible()){
    await candidate.click({timeout:5000}).catch(e=>events.push(['stream-click-error',String(e).slice(0,200)]));break;
  }
 }
 await page.waitForTimeout(18000);
 await page.screenshot({path:out+'/viewer-after-device-select.png',fullPage:true});
 const after=await page.evaluate(()=>({
   text:document.body.innerText.slice(0,3000),
   canvases:[...document.querySelectorAll('canvas')].map(e=>({width:e.width,height:e.height})),
   videos:[...document.querySelectorAll('video')].map(e=>({width:e.videoWidth,height:e.videoHeight,readyState:e.readyState})),
   images:[...document.querySelectorAll('img')].map(e=>({width:e.naturalWidth,height:e.naturalHeight}))
 }));
 events.push(['DOM_AFTER',after]);
 const controlSurface=page.locator('canvas, video');
 if(await controlSurface.count()){
   const rect=await controlSurface.first().boundingBox();
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
 const screenshot=PNG.sync.read(readFileSync(out+'/viewer-after-input.png'));
 let bright=0,total=0;
 for(let y=50;y<Math.min(screenshot.height,800);y+=8)for(let x=50;x<Math.min(screenshot.width,1100);x+=8){const p=(y*screenshot.width+x)*4;total++;if(screenshot.data[p]+screenshot.data[p+1]+screenshot.data[p+2]>60)bright++;}
 console.log('HITEL_ANDROID_VISIBLE_PIXEL_FRACTION',bright/total);
 if(bright/total<0.03)throw Error('BLACK_ANDROID_SCREEN');
 if(received<12)throw Error('NO_LIVE_H264_STREAM_FRAMES: only '+received+' websocket frames');
 if(after.canvases.length===0 && after.videos.length===0 && after.images.length===0)throw Error('NO_REMOTE_ANDROID_SCREEN_RENDERED');
}finally{await browser.close();}
