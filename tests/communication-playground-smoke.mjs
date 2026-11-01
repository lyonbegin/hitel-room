// Test the actual Railway WebSocket playground, not a mocked WebSocket.
// This covers all 16 independent caller/receiver signaling flows. WebRTC SDP
// forwarding is tested separately from REAL browser media (manual device test).
import WebSocket from 'ws';
const base='https://hitel-communication-web-production.up.railway.app';
const path='/lab-sandbox/playground';
const assert=(x,msg)=>{if(!x)throw Error('COMM_PLAYGROUND_TEST_FAILED '+msg)};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const transient=err=>/Unexpected server response: (502|503|504)|ECONNRESET|ETIMEDOUT|fetch failed|HTTP_(502|503|504)/.test(String(err));
const api=async(route,data)=>{
 for(let attempt=0;attempt<7;attempt++){
  try{
   const r=await fetch(base+path+route,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(12_000)});
   if([502,503,504].includes(r.status))throw Error('HTTP_'+r.status);
   const payload=await r.json();
   if(!r.ok)throw Error(route+':'+r.status+':'+JSON.stringify(payload));
   return payload;
  }catch(e){
   if(!transient(e)||attempt===6)throw e;
   await pause(600+attempt*450);
  }
 }
};
const until=(ws,predicate,timeoutMs=7000)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.off('message',listen);reject(Error('EVENT_TIMEOUT'))},timeoutMs);
 function listen(data){let p;try{p=JSON.parse(String(data))}catch{return}
  if(predicate(p)){clearTimeout(timer);ws.off('message',listen);resolve(p)}}
 ws.on('message',listen);
});
const connect=async(id,secret,side)=>{
 const u=base.replace('https:','wss:')+path+'/socket?id='+encodeURIComponent(id)+'&secret='+encodeURIComponent(secret)+'&side='+side;
 for(let attempt=0;attempt<7;attempt++){
  const ws=new WebSocket(u,{headers:{origin:base}});
  try{
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('CONNECT_TIMEOUT')),8000);
    ws.once('open',()=>{clearTimeout(timer);resolve()});
    ws.once('error',err=>{clearTimeout(timer);reject(err)});
   });
   return ws;
  }catch(e){
   ws.terminate();
   if(!transient(e)||attempt===6)throw e;
   await pause(600+attempt*450);
  }
 }
};
const action=async(ws,name,payload)=>{
 const requestId=Math.random().toString(16).slice(2);
 const waiting=until(ws,m=>m.type==='ack'&&m.requestId===requestId);
 ws.send(JSON.stringify({type:name,payload,requestId}));
 const ack=await waiting;assert(ack.ok===true,name+' '+ack.reason);return ack;
};
for(let routeId=1;routeId<=16;routeId++){
 const s=await api('/session',{routeId});
 assert(s.route.id===routeId,'route ID '+routeId);
 let a,b;
 try{
  a=await connect(s.id,s.secret,'A');
  b=await connect(s.id,s.secret,'B');
  let presence=await api('/status',{id:s.id,secret:s.secret});
  assert(presence.peers.A===true&&presence.peers.B===true,'both independent WS '+routeId);
  const ringing=until(b,m=>m.type==='event'&&m.event?.type==='call.ringing');
  await action(a,'call.invite');assert((await ringing).event.type==='call.ringing','ringing '+routeId);
  const accepted=until(a,m=>m.type==='event'&&m.event?.type==='call.accept');
  await action(b,'call.accept');await accepted;
  const qualifies=['N','W'].includes(s.route.from)&&['N','W'].includes(s.route.to);
  if(qualifies){
   const offer=until(b,m=>m.type==='rtc.offer');
   await action(a,'rtc.offer',{type:'offer',sdp:'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n'});
   const forwarded=await offer;assert(forwarded.payload?.type==='offer','WebRTC offer forward '+routeId);
   const answer=until(a,m=>m.type==='rtc.answer');
   await action(b,'rtc.answer',{type:'answer',sdp:'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n'});
   await answer;
  }else{
   const id='blocked'+routeId, ack=until(a,m=>m.type==='ack'&&m.requestId===id);
   a.send(JSON.stringify({type:'rtc.offer',payload:{type:'offer',sdp:'v=0'},requestId:id}));
   assert((await ack).ok===false,'no false WebRTC on PSTN route '+routeId);
  }
  const ended=until(b,m=>m.type==='event'&&m.event?.type==='call.end');
  await action(a,'call.end');await ended;
  console.log('SCENARIO_'+String(routeId).padStart(2,'0')+'_PASS',s.route.from+'→'+s.route.to,{ws:2,ringing:true,accepted:true,rtcRelay:qualifies,pstn:false,native:false,ai:false});
 }finally{
  a?.close();b?.close();await api('/end',{id:s.id,secret:s.secret}).catch(()=>undefined);
 }
}
console.log('COMM_PLAYGROUND_16_OF_16_WS_SCENARIOS_PASS · actual browser media and native/PSTN require separate real-device tests');
