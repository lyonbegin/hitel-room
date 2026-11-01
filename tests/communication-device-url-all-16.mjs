// All 16 routes through the FINAL per-install URL design, NEVER numeric PIN.
// Each N/P+ endpoint has its own device ID, secret and stable management URL.
// W/P peers are separate browser clients; P/P+ actual PSTN media remains absent.
import WebSocket from 'ws';
import {randomBytes,randomUUID} from 'node:crypto';
const base='https://hitel-communication-web-production.up.railway.app';
const root='/lab-sandbox/playground';
const roles=['P','P+','N','W'];
const delay=t=>new Promise(r=>setTimeout(r,t));
const must=(x,msg)=>{if(!x)throw Error('ALL_16_APP_URL_TEST_FAILED '+msg)};
async function post(path,data,native=false){
 const r=await fetch(base+root+path,{method:'POST',headers:{'content-type':'application/json',...(native?{}:{origin:base})},
  body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
 const o=await r.json();if(!r.ok)throw Error(path+' '+r.status+' '+JSON.stringify(o));return o;
}
const wsurl=(path)=>base.replace('https','wss')+root+path;
async function connect(path,native=false){
 const ws=new WebSocket(wsurl(path),native?{}:{headers:{origin:base}});
 await new Promise((ok,fail)=>{
  const tm=setTimeout(()=>fail(Error('WS_CONNECT_TIMEOUT')),10000);
  ws.once('open',()=>{clearTimeout(tm);ok()});ws.once('error',fail)
 });return ws
}
const wait=(ws,predicate,timeout=14000)=>new Promise((ok,fail)=>{
 const tm=setTimeout(()=>{ws.off('message',f);fail(Error('WS_EVENT_TIMEOUT'))},timeout);
 function f(b){let m;try{m=JSON.parse(String(b))}catch{return}
  if(predicate(m)){clearTimeout(tm);ws.off('message',f);ok(m)}}
 ws.on('message',f);
});
const action=async(ws,type)=>{
 const requestId=randomUUID();
 const ack=wait(ws,m=>m.type==='ack'&&m.requestId===requestId);
 ws.send(JSON.stringify({type,requestId}));
 const a=await ack;must(a.ok===true,type+' rejected: '+a.reason)
};
let complete=0, appParticipants=0;
for(let id=1;id<=16;id++){
 const s=await post('/session',{routeId:id});
 const appControllers=[],wsList=[],identities=[];
 try{
  const actualKinds=[s.route.from,s.route.to];
  const peers={};
  for(const side of ['A','B']){
   const nativeType=actualKinds[side==='A'?0:1];
   if(['N','P+'].includes(nativeType)){
    const deviceId=randomUUID(),key=randomBytes(32).toString('hex');
    identities.push({id:deviceId,key});
    const registration=await post('/device/register',{id:deviceId,key},true);
    const next=await post('/device/register',{id:deviceId,key},true);
    must(registration.pageUrl===next.pageUrl,'relaunch changes app URL on SC'+id);
    const token=registration.pageUrl.split('/').at(-1);
    must(/^[a-f0-9]{64}$/.test(token),'valid app control URL');
    const control=await connect('/device/socket',true);appControllers.push(control);
    const ready=wait(control,m=>m.type==='device.ready');
    control.send(JSON.stringify({type:'device.auth',id:deviceId,key}));
    await ready;
    const assigned=wait(control,m=>m.type==='device.assign');
    await post('/device/attach',{pageToken:token,sessionId:s.id,sessionSecret:s.secret,side});
    const assignment=await assigned;
    must(assignment.side===side&&assignment.id===s.id,'wrong auto native side');
    peers[side]=await connect('/socket?id='+s.id+'&side='+side+'&secret='+assignment.secret,true);
    appParticipants++;
   }else{
    peers[side]=await connect('/socket?id='+s.id+'&side='+side+'&secret='+s.secret);
   }
   wsList.push(peers[side]);
  }
  const state=await post('/status',{id:s.id,secret:s.secret});
  must(state.peers.A&&state.peers.B,'missing side '+id);
  for(const side of ['A','B']){
   const kind=actualKinds[side==='A'?0:1];
   must(state.peerKinds[side]===(['N','P+'].includes(kind)?'native-protocol':'browser'),
     'incorrect native/browser role '+id+'/'+side);
  }
  const ringing=wait(peers.B,m=>m.type==='event'&&m.event?.type==='call.ringing');
  await action(peers.A,'call.invite');await ringing;
  const answered=wait(peers.A,m=>m.type==='event'&&m.event?.type==='call.accept');
  await action(peers.B,'call.accept');await answered;
  await action(peers.A,'call.end');
  const ended=await post('/status',{id:s.id,secret:s.secret});
  must(ended.phase==='ended','failed to end '+id);
  console.log('HITEL_APP_URL_SC'+String(id).padStart(2,'0')+'_PASS',{from:s.route.from,to:s.route.to,physicalIphone:false});
  complete++;
 }finally{
  wsList.forEach(ws=>ws.close());appControllers.forEach(ws=>ws.close());
  await post('/end',{id:s.id,secret:s.secret}).catch(()=>{});
  for(const ident of identities)await post('/device/unregister',ident,true).catch(()=>{});
 }
}
must(complete===16,'all 16');
console.log('HITEL_APP_SPECIFIC_URL_16_OF_16_ROUTING_PASS',{scenarios:complete,nativeOrPplusEndpoints:appParticipants,noPairPin:true,
  realServer:true,realPhoneHardware:false,carrierMedia:false});
