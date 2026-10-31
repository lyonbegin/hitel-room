// Diagnostic-only protocol test. No real Android hardware or screen pixels involved.
// Checks that private same-origin pairing, device socket and viewer socket work end-to-end.
import WebSocket from 'ws';
const root='https://hitel-communication-web-production.up.railway.app/lab-sandbox/physical';
const origin='https://hitel-communication-web-production.up.railway.app';
function assert(v,what){if(!v)throw Error('ASSERTION_FAILED: '+what)}
async function post(path,value){
 for(let attempt=1;attempt<=4;attempt++){
  try{
   const r=await fetch(root+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(12000)});
   const body=await r.json();
   if(!r.ok){
    if(r.status===502||r.status===503){if(attempt<4){await new Promise(resolve=>setTimeout(resolve,1000*attempt));continue;}}
    throw Error(path+' HTTP '+r.status+' '+JSON.stringify(body));
   }
   return body;
  }catch(e){if(attempt===4||!/fetch failed|ECONNRESET|timeout/i.test(String(e)))throw e;
   await new Promise(resolve=>setTimeout(resolve,1000*attempt));}
 }
 throw Error(path+' service unavailable');
}
function open(url,opts={}){
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(url,opts);
  const timeout=setTimeout(()=>reject(Error('WS_OPEN_TIMEOUT '+url.split('?')[0])),12000);
  ws.once('open',()=>{clearTimeout(timeout);resolve(ws)});
  ws.once('error',e=>{clearTimeout(timeout);reject(e)});
 });
}
function waitFor(ws,pred){
 return new Promise((resolve,reject)=>{
  const t=setTimeout(()=>{ws.off('message',onMessage);reject(Error('WS_MESSAGE_TIMEOUT'))},12000);
  function onMessage(data,binary){if(pred(data,binary)){clearTimeout(t);ws.off('message',onMessage);resolve(data)}}
  ws.on('message',onMessage);
 });
}
let viewer,device,token;
try{
 const session=await post('/session',{});
 token=session.viewerToken;
 assert(/^[a-f0-9]{64}$/.test(token),'unique viewer token');
 assert(/^\d{8}$/.test(session.pairCode),'temporary PIN');
 const wsroot=root.replace('https:','wss:')+'/socket';
 viewer=await open(wsroot+'?role=viewer&viewerToken='+token,{headers:{origin}});
 device=await open(wsroot+'?role=device&code='+session.pairCode);
 const paired=await new Promise(resolve=>{
  // The first message may have arrived before this listener: wait for state through API instead.
  device.once('message',data=>resolve(String(data)));
  setTimeout(()=>resolve(''),200);
 });
 const binaryPromise=waitFor(viewer,(data,binary)=>binary===true);
 device.send(JSON.stringify({type:'hello',name:'HITEL_PROTOCOL_TEST',android:'test',width:540,height:1080}));
 device.send(Buffer.from([0xff,0xd8,0xff,0xd9]));
 const frame=await binaryPromise;
 assert(Buffer.from(frame)[0]===255&&Buffer.from(frame)[1]===216,'JPEG envelope forwarded');

 // Use this isolated paired synthetic device ONLY to verify remote-control routing.
 const commandPromise=waitFor(device,(bytes,binary)=>{
  if(binary)return false;
  try{const m=JSON.parse(String(bytes));return m.type==='control'&&m.action==='tap'&&m.id===91;}catch{return false}
 });
 viewer.send(JSON.stringify({type:'control',id:91,action:'tap',x:0.25,y:0.75}));
 const command=JSON.parse(String(await commandPromise));
 assert(command.x===0.25&&command.y===0.75,'tap normalized coordinates forwarded');
 const ackPromise=waitFor(viewer,(bytes,binary)=>{
  if(binary)return false;
  try{const m=JSON.parse(String(bytes));return m.type==='controlAck'&&m.id===91;}catch{return false}
 });
 device.send(JSON.stringify({type:'controlAck',id:91,ok:true,accessibilityEnabled:true}));
 const ack=JSON.parse(String(await ackPromise));
 assert(ack.ok===true&&ack.accessibilityEnabled===true,'phone execution acknowledgement returned');
 const statusNow=await post('/status',{viewerToken:token});
 assert(statusNow.accessibilityEnabled===true,'accessibility status observable');
 // Refuse arbitrary actions even for a paired viewer.
 const deniedPromise=waitFor(viewer,(bytes,binary)=>{
  if(binary)return false;
  try{const m=JSON.parse(String(bytes));return m.type==='controlAck'&&m.id===92;}catch{return false}
 });
 viewer.send(JSON.stringify({type:'control',id:92,action:'shell',text:'untrusted-command'}));
 const denied=JSON.parse(String(await deniedPromise));
 assert(denied.ok===false&&denied.error==='INVALID_CONTROL','unrecognized command rejected');
 const state=await post('/status',{viewerToken:token});
 assert(state.online===true,'device socket online');
 assert(state.paired===true,'device pairing persisted');
 assert(state.deviceInfo?.name==='HITEL_PROTOCOL_TEST','device metadata forwarded');
 console.log('PHYSICAL_ANDROID_TRANSPORT_SMOKE_PASS',JSON.stringify({transport:'WSS',paired:state.paired,online:state.online,frameBytes:frame.length,control:'tap',ack:true,rejectUntrustedAction:true}));
}finally{
 if(token){try{await post('/stop',{viewerToken:token})}catch(e){console.error('TEST_CLEANUP_ERROR',String(e))}}
 if(device)device.close();if(viewer)viewer.close();
}
