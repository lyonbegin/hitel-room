// Inspect the genuine installed Android app by Android WebView Chrome DevTools.
// No mock RTC peers, model inference, frames, or status fields.
import {writeFileSync} from 'node:fs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const save=(name,data)=>writeFileSync(new URL('../test-results/'+name,import.meta.url),JSON.stringify(data,null,2));
let target;
for(let i=0;i<45;i++){
  try{
    const r=await fetch('http://127.0.0.1:9222/json');
    if(r.ok){
      const tabs=await r.json();
      target=tabs.find(x=>x.type==='page'&&x.url?.includes('appassets.androidplatform.net'));
      if(target?.webSocketDebuggerUrl) break;
    }
  }catch(e){}
  await sleep(1000);
}
if(!target?.webSocketDebuggerUrl) throw Error('FAIL: no Android WebView debugging page target');
console.log('WEBVIEW',target.url);
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{
  ws.addEventListener('open',resolve,{once:true});
  ws.addEventListener('error',reject,{once:true});
});
let serial=0;
const callbacks=new Map();
ws.addEventListener('message',event=>{
  let msg;
  try{msg=JSON.parse(event.data)}catch{return}
  const pending=callbacks.get(msg.id);
  if(!pending)return;
  callbacks.delete(msg.id);clearTimeout(pending.timer);
  if(msg.error)pending.reject(Error(JSON.stringify(msg.error)));
  else pending.resolve(msg.result);
});
const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++serial;
  const timer=setTimeout(()=>{callbacks.delete(id);reject(Error(method+' request timeout'))},20000);
  callbacks.set(id,{resolve,reject,timer});
  ws.send(JSON.stringify({id,method,params}));
});
async function evaluate(expression,userGesture=false){
  const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture});
  if(r.exceptionDetails)throw Error('WebView runtime exception '+JSON.stringify(r.exceptionDetails).slice(0,500));
  return r.result?.value;
}
await send('Runtime.enable');
const probe=[
 '(() => {',
 'const v=document.getElementById("rtc-preview"), c=document.getElementById("canvas_video");',
 'if(!v||!c)return {documentReady:document.readyState,domLoaded:false,status:document.body?.textContent?.slice(0,250)||"no body"};',
 'return {status:document.getElementById("status")?.textContent,',
 'rtcStatus:document.getElementById("rtc-status")?.textContent,',
 'indicator:document.getElementById("indicator")?.textContent,',
 'screen:[c.width,c.height],',
 'captureStream:typeof c.captureStream==="function",',
 'rtcSupported:typeof RTCPeerConnection==="function",',
 'wasm:typeof Module!=="undefined"&&typeof Module._processImage==="function",',
 'audioApi:typeof Module!=="undefined"&&typeof Module._setAudioBuffer==="function",',
 'frames:typeof dataSets==="undefined"?0:dataSets.length,',
 'sending:typeof activeSender==="undefined"?null:activeSender?.connectionState,',
 'receiving:typeof activeReceiver==="undefined"?null:activeReceiver?.connectionState,',
 'receivedVideo:v.hidden===false,',
 'videoTime:v.currentTime,',
 'track:v.srcObject?.getVideoTracks()[0]?.readyState||null};',
 '})()'
].join('');
const diagnostics=[
 '(() => ({',
 'webgl:typeof gl==="undefined"?"not_defined":!!gl,',
 'moduleAsm:typeof Module!=="undefined"&&!!Module.asm,',
 'wasmMemory:typeof Module!=="undefined"?Module.HEAPU8?.length||0:0,',
 'loaderDisplay:document.getElementById("loadingSpinner")?.style.display,',
 'video:typeof videoProcessor==="undefined"?null:{src:videoProcessor.video?.currentSrc,readyState:videoProcessor.video?.readyState,networkState:videoProcessor.video?.networkState,errorCode:videoProcessor.video?.error?.code,width:videoProcessor.video?.videoWidth,height:videoProcessor.video?.videoHeight},',
 'config:typeof CONFIG==="undefined"?null:{video:CONFIG.videoSrc,data:CONFIG.dataSrc},',
 'jsonLoaded:typeof videoProcessor!=="undefined"&&!!videoProcessor.combinedData,',
 'dataLength:typeof dataSets==="undefined"?"no dataSets":dataSets?.length,',
 '}) )()'
].join('');
async function pathStatuses(){
  return await evaluate('(async()=>{const paths=["vendor/js/DHLiveMini.wasm","assets/01.mp4","assets/combined_data.bin"];return await Promise.all(paths.map(async p=>{try{const r=await fetch(p,{method:"HEAD"});return {p,status:r.status,type:r.headers.get("Content-Type"),len:r.headers.get("Content-Length")}}catch(e){return {p,error:String(e)}}}))})()');
}
const results=[];
let p;
for(let i=0;i<95;i++){
  p=await evaluate(probe);
  if(i===12||i===36){const d=await evaluate(diagnostics);const paths=await pathStatuses(); console.log("DIAGNOSTICS",i,JSON.stringify({d,paths}));save("diagnostics-"+i+".json",{d,paths});}
  if(i%5===0 || i===0){ console.log('PROBE',i,JSON.stringify(p));results.push({atSec:i,...p});}
  if(p.wasm && p.frames>0 && p.track==='live' && p.receivedVideo && p.videoTime>0.3)break;
  await sleep(1000);
}
save('status-observations.json',results);
save('final-status.json',p);
if(!p.wasm)throw Error('FAIL: actual DH_live mini WASM not loaded');
if(!(p.frames>0))throw Error('FAIL: generated face frames are not available');
if(!p.captureStream)throw Error('FAIL: WebView canvas.captureStream unavailable');
if(!p.rtcSupported)throw Error('FAIL: RTCPeerConnection unavailable');
if(p.track!=='live'||!p.receivedVideo)throw Error('FAIL: real WebRTC received track unavailable');
const before=p.videoTime;
await sleep(2400);
p=await evaluate(probe);
save('frame-progress.json',p);
if(p.videoTime-before<0.5)throw Error('FAIL: WebRTC received video time not progressing');
console.log('PASS: real Android avatar canvas -> WebRTC send -> WebRTC receive -> live video');

await evaluate('window.__hitelAudioCalls=0;const old=Module._setAudioBuffer;Module._setAudioBuffer=function(){window.__hitelAudioCalls++;return old.apply(this,arguments)};document.getElementById("test-audio").click();',true);
await sleep(1600);
const audio=await evaluate('({calls:window.__hitelAudioCalls,status:document.getElementById("status").textContent})');
save('audio-test.json',audio);
console.log('AUDIO',JSON.stringify(audio));
if(audio.calls<1)throw Error('FAIL: WAV audio did not reach actual WASM module');
console.log('PASS: real WAV reached Module._setAudioBuffer');
ws.close();
