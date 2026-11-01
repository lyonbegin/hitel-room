import WebSocket from 'ws';
import {randomUUID,randomBytes} from 'node:crypto';
const base='https://hitel-communication-web-production.up.railway.app',root='/lab-sandbox/playground';
const must=(v,m)=>{if(!v)throw Error('PPLUS_COMPANION_FAIL '+m)};
async function api(uri,body,origin=true){
 const r=await fetch(base+root+uri,{method:'POST',headers:{'content-type':'application/json',...(origin?{origin:base}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 const data=await r.json();if(!r.ok)throw Error(uri+' '+r.status+' '+JSON.stringify(data));return data;
}
async function ws(id,secret,side,native){
 const u=base.replace('https','wss')+root+'/socket?id='+id+'&side='+side+'&secret='+secret;
 const w=new WebSocket(u,native?{}:{headers:{origin:base}});
 await new Promise((done,fail)=>{
  const t=setTimeout(()=>fail(Error('SOCKET_TIMEOUT')),10000);
  w.once('open',()=>{clearTimeout(t);done()});w.once('error',fail)});
 return w
}
function until(w,p){
 return new Promise((resolve,reject)=>{
  const t=setTimeout(()=>{w.off('message',f);reject(Error('PPLUS_EVENT_TIMEOUT'))},10000);
  function f(raw){try{const msg=JSON.parse(String(raw));if(p(msg)){clearTimeout(t);w.off('message',f);resolve(msg)}}catch{}}
  w.on('message',f);
 })
}
const routes=[2,5,6,7,8,10,14];
for(const routeId of routes){
 const s=await api('/session',{routeId});let A,B;
 const deviceSockets=[],identities=[];
 try{
  const from=s.route.from,to=s.route.to;
  const tokens={};
  for(const side of ['A','B']){
   const kind=side==='A'?from:to;
   if(kind!=='P+')continue;
   const id=randomUUID(),key=randomBytes(32).toString('hex');
   identities.push({id,key});
   const registration=await api('/device/register',{id,key},false);
   const pageToken=registration.pageUrl.split('/').at(-1);
   must(/^[a-f0-9]{64}$/.test(pageToken),'P+ unique page token');
   const device=new WebSocket(base.replace('https','wss')+root+'/device/socket');
   deviceSockets.push(device);
   await new Promise((resolve,reject)=>{
    const t=setTimeout(()=>reject(Error('PPLUS_DEVICE_SOCKET_TIMEOUT')),10000);
    device.once('open',()=>{clearTimeout(t);resolve()});
    device.once('error',reject);
   });
   const ready=until(device,msg=>msg.type==='device.ready');
   device.send(JSON.stringify({type:'device.auth',id,key}));
   await ready;
   const assigned=until(device,msg=>msg.type==='device.assign');
   await api('/device/attach',{pageToken,sessionId:s.id,sessionSecret:s.secret,side});
   const assignment=await assigned;
   must(assignment.id===s.id&&assignment.side===side,'P+ app-specific assignment');
   tokens[side]=assignment.secret;
  }
  A=await ws(s.id,tokens.A||s.secret,'A',!!tokens.A);
  B=await ws(s.id,tokens.B||s.secret,'B',!!tokens.B);
  const status=await api('/status',{id:s.id,secret:s.secret});
  must((from==='P+'?status.peerKinds.A==='native-protocol':status.peerKinds.A==='browser'), 'A kind');
  must((to==='P+'?status.peerKinds.B==='native-protocol':status.peerKinds.B==='browser'), 'B kind');
  const sender=from==='P+'?A:B,recipient=from==='P+'?B:A;
  const note='P+ 상담 메모 SC'+routeId;
  const received=until(recipient,x=>x.type==='event'&&x.event?.type==='lab.note');
  sender.send(JSON.stringify({type:'lab.note',requestId:'pplus'+routeId,payload:{note}}));
  const event=await received;
  must(event.event.note===note,'P+ note must reach other party');
  const observed=until(recipient,x=>x.type==='event'&&x.event?.type==='carrier.status');
  sender.send(JSON.stringify({type:'carrier.status',requestId:'pplus-state-'+routeId,payload:{state:'connected'}}));
  const stateEvent=await observed;
  must(stateEvent.event.callState==='connected'&&
       stateEvent.event.source==='ios-callkit-unknown-provider','P+ source must remain unverified as carrier');
  const blocked=until(sender,x=>x.type==='ack'&&x.requestId==='pplus-bad-'+routeId);
  sender.send(JSON.stringify({type:'carrier.status',requestId:'pplus-bad-'+routeId,payload:{state:'audioCaptured'}}));
  must((await blocked).ok===false,'forbid false audio capture status');
  console.log('PPLUS_NATIVE_SCENARIO_'+String(routeId).padStart(2,'0')+'_PASS');
 }finally{
  A?.close();B?.close();deviceSockets.forEach(d=>d.close());
  await api('/end',{id:s.id,secret:s.secret}).catch(()=>{});
  for(const ident of identities)await api('/device/unregister',ident,false).catch(()=>{});
 }
}
console.log('PPLUS_NATIVE_COMPANION_7_OF_7_SIGNALING_AND_NOTES_PASS; no PSTN audio or AI provider claimed');
