// Real Google Chrome + ws-scrcpy MSE + Android 11 UI test.
// Run on the same ephemeral GitHub KVM worker as the ADB server.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='mobile-test-results/ws-scrcpy-live';
mkdirSync(out,{recursive:true});
const adb=(args)=>execFileSync('adb',args,{encoding:'utf8',timeout:25000});
const dump=()=>{adb(['shell','uiautomator','dump','/sdcard/hitel-ui.xml']);return adb(['shell','cat','/sdcard/hitel-ui.xml']);};
const status=(await (await fetch('https://hitel-communication-web-production.up.railway.app/lab-sandbox/ws-scrcpy/status')).json());
if(status.online!==true)throw Error('RAILWAY_ANDROID_NOT_ONLINE');
const site=status.url;
const socket=new URL(site.replace(/^https/,'wss'));
socket.searchParams.set('action','proxy-adb');
socket.searchParams.set('remote','tcp:8886');
socket.searchParams.set('udid','emulator-5554');
const hash=new URLSearchParams({action:'stream',udid:'emulator-5554',player:'mse',ws:socket.toString(),captureKeyboard:'true',fitToScreen:'true'});
const link=site+'/#!/'+hash.toString();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1080,height:980}});
const events=[];let streamFrames=0;
page.on('console',m=>{if(m.type()==='error')events.push(['console-error',m.text().slice(0,350)]);});
page.on('pageerror',e=>events.push(['pageerror',String(e).slice(0,350)]));
page.on('websocket',s=>{events.push(['socket',s.url()]);s.on('framereceived',f=>{if(s.url().includes('proxy-adb'))streamFrames++;});});
const report={url:link,results:{},events};
try{
 const capabilities=await page.evaluate(()=>({userAgent:navigator.userAgent,ms:typeof MediaSource!=='undefined',mseH264:typeof MediaSource!=='undefined'&&MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'),webCodecs:typeof VideoDecoder!=='undefined'}));
 report.capabilities=capabilities;
 if(!capabilities.mseH264)throw Error('CHROME_MSE_H264_UNSUPPORTED');
 await page.goto(link,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.videoWidth>0&&v.videoHeight>0&&v.readyState>=2;},{timeout:35000}).catch(async e=>{await page.screenshot({path:out+'/viewer-failed.png'});throw e;});
 await page.waitForTimeout(3500);
 const frame=await page.evaluate(()=>{
  const v=document.querySelector('video');
  const c=document.createElement('canvas');c.width=160;c.height=300;
  const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(v,0,0,c.width,c.height);
  const d=cx.getImageData(0,0,c.width,c.height).data;
  let colored=0,nonBlack=0;for(let i=0;i<d.length;i+=4){
   if(d[i]+d[i+1]+d[i+2]>70)nonBlack++;
   if(Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2])>24)colored++;
  }
  return {width:v.videoWidth,height:v.videoHeight,readyState:v.readyState,nonBlackFraction:nonBlack/(d.length/4),colorFraction:colored/(d.length/4)};
 });
 report.results.video=frame;
 await page.screenshot({path:out+'/browser-video.png'});
 if(frame.nonBlackFraction<0.05)throw Error('BROWSER_VIDEO_BLACK');
 if(streamFrames<10)throw Error('BROWSER_H264_FRAMES_NOT_RECEIVED');
 const before=dump();writeFileSync(out+'/apk-ui-before-browser.xml',before);
 if(!before.includes('HITEL TAP TEST'))throw Error('TEST_APK_NOT_FOREGROUND');
 const video=page.locator('video').first();
 const box=await video.boundingBox();
 if(!box||box.width<50||box.height<100)throw Error('VIDEO_NOT_VISIBLE_FOR_TOUCH');
 const m=adb(['shell','wm','size']).match(/(\d+)x(\d+)/);
 if(!m)throw Error('ANDROID_SIZE_NOT_AVAILABLE');
 const resolution={width:Number(m[1]),height:Number(m[2])};
 const locate=(name)=>{
  const tag=before.match(new RegExp('<node[^>]*text="'+name+'"[^>]*>'))?.[0]||before.match(new RegExp('<node[^>]*text="'+name+'"[^>]*/>'))?.[0];
  const coords=tag?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if(!coords)throw Error('ANDROID_VIEW_COORDINATES_MISSING:'+name);
  return {x: (Number(coords[1])+Number(coords[3]))/2,y:(Number(coords[2])+Number(coords[4]))/2};
 };
 const appClick=async p=>{await page.mouse.click(box.x+box.width*(p.x/resolution.width),box.y+box.height*(p.y/resolution.height));};
 const input=locate(''); // Android EditText generally has empty text before typing
 await appClick(input);
 await page.keyboard.type('HITEL123',{delay:65});
 await page.waitForTimeout(900);
 const typed=dump();writeFileSync(out+'/apk-ui-keyboard.xml',typed);
 report.results.keyboard=typed.includes('HITEL123');
 if(!report.results.keyboard)throw Error('WEB_BROWSER_KEYBOARD_NOT_DELIVERED_TO_ANDROID');
 const button=locate('HITEL TAP TEST');
 await appClick(button);
 await page.waitForTimeout(1000);
 const after=dump();writeFileSync(out+'/apk-ui-after-browser.xml',after);
 report.results.touch=after.includes('TOUCH_OK:HITEL123');
 await page.screenshot({path:out+'/browser-touch-keyboard.png'});
 if(!report.results.touch)throw Error('WEB_BROWSER_TOUCH_NOT_DELIVERED_TO_ANDROID');
 report.results.frames=streamFrames;
 console.log('HITEL_COMPLETE_REAL_ANDROID_E2E_PASS',JSON.stringify(report.results));
}finally{
 report.events=events.slice(-100);
 writeFileSync(out+'/real-e2e-result.json',JSON.stringify(report,null,2));
 await browser.close();
}
