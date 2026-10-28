import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='mobile-test-results/ws-scrcpy-preview';
mkdirSync(out,{recursive:true});
const status=await (await fetch('https://hitel-communication-web-production.up.railway.app/lab-sandbox/ws-scrcpy/status')).json();
if(!status.online)throw Error('HITEL_GUEST_NOT_ONLINE');
const socket=new URL(status.url.replace('https://','wss://'));
socket.searchParams.set('action','proxy-adb');
socket.searchParams.set('remote','tcp:8886');
socket.searchParams.set('udid','emulator-5554');
const hash=new URLSearchParams({action:'stream',udid:'emulator-5554',player:'mse',ws:socket.toString(),captureKeyboard:'true',fitToScreen:'true'});
const url=status.url+'/#!'+hash;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1100,height:1000}});
const errors=[],frames=[];
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('pageerror',e=>errors.push(String(e)));
page.on('websocket',s=>s.on('framereceived',m=>{if(s.url().includes('proxy-adb'))frames.push(typeof m.payload==='string'?m.payload.length:m.payload.length)}));
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForFunction(()=>{const v=document.querySelector('video');return Boolean(v&&v.readyState>=2&&v.videoWidth>0&&v.videoHeight>0)},null,{timeout:40000});
 await page.waitForTimeout(2000);
 const data=await page.evaluate(()=>{
 const v=document.querySelector('video');const c=document.createElement('canvas');c.width=80;c.height=180;
 c.getContext('2d').drawImage(v,0,0,c.width,c.height);const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 let lit=0;for(let i=0;i<a.length;i+=4)if(a[i]+a[i+1]+a[i+2]>45)lit++;
 return {width:v.videoWidth,height:v.videoHeight,readyState:v.readyState,pixelFraction:lit/(a.length/4)};
 });
 await page.screenshot({path:out+'/actual-h264-frame.png'});
 const result={url,frames:frames.length,screen:data,errors};
 console.log('HITEL_CHROME_MSE_VIDEO_PROOF',JSON.stringify(result));
 writeFileSync(out+'/result.json',JSON.stringify(result,null,2));
 if(data.pixelFraction<0.05||frames.length<10)throw Error('H264_BROWSER_NOT_RENDERED');
}finally{await browser.close()}
