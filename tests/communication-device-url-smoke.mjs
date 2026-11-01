// Real Railway per-install device URL integration. Never use a PIN.
// Simulates an installed independent iOS app's Keychain credential and
// persistent device WebSocket; proves the automatic web-page assignment.
// It does not claim to run the physical iPhone or the iOS Swift app.
import WebSocket from 'ws';
import {randomBytes,randomUUID} from 'node:crypto';
const host='https://hitel-communication-web-production.up.railway.app';
const apiRoot='/lab-sandbox/playground';
const check=(ok,msg)=>{if(!ok)throw Error('DEVICE_URL_AUTO_CONNECT_FAILED: '+msg)};
const post=async(path,body,native=false)=>{
 const res=await fetch(host+apiRoot+path,{method:'POST',headers:{
  'content-type':'application/json',...(native?{}:{origin:host})},
  body:JSON.stringify(body),signal:AbortSignal.timeout(14000)});
 const json=await res.json();
 if(!res.ok)throw Error('HTTP '+path+' '+res.status+' '+JSON.stringify(json));
 return json;
};
const wait=(ws,predicate,timeoutMs=11000)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.off('message',handler);reject(Error('WS_EVENT_TIMEOUT'))},timeoutMs);
 const handler=bytes=>{let value;try{value=JSON.parse(String(bytes))}catch{return}
  if(predicate(value)){clearTimeout(timer);ws.off('message',handler);resolve(value)}};
 ws.on('message',handler);
});
const open=async(path,native=false)=>{
 const u=host.replace(/^https/,'wss')+apiRoot+path;
 const ws=new WebSocket(u,native?{}:{headers:{origin:host}});
 await new Promise((resolve,reject)=>{
  const tm=setTimeout(()=>reject(Error('WS_OPEN_TIMEOUT')),10000);
  ws.once('open',()=>{clearTimeout(tm);resolve()});
  ws.once('error',reject);
 });return ws;
};
const id=randomUUID(),secret=randomBytes(32).toString('hex');
let app,peer,nativeCall,session;
try{
 const registered=await post('/device/register',{id,key:secret},true);
 check(registered.pageUrl.startsWith(host+'/communication-playground/app/'),'unique page URL');
 const token=registered.pageUrl.split('/').at(-1);
 check(/^[a-f0-9]{64}$/.test(token),'64-hex unguessable control URL');
 const again=await post('/device/register',{id,key:secret},true);
 check(again.pageUrl===registered.pageUrl,'stable URL on app restart');
 app=await open('/device/socket',true);
 const ready=wait(app,m=>m.type==='device.ready');
 app.send(JSON.stringify({type:'device.auth',id,key:secret}));
 await ready;
 const device=await post('/device/status',{pageToken:token});
 check(device.device.online===true,'real device WS online');
 session=await post('/session',{routeId:12});
 const assignment=wait(app,m=>m.type==='device.assign');
 const attached=await post('/device/attach',{pageToken:token,sessionId:session.id,sessionSecret:session.secret,side:'A'});
 check(attached.assigned===true,'page auto attached app');
 const assigned=await assignment;
 check(assigned.side==='A'&&assigned.route.id===12,'native A role assigned from unique URL');
 check(assigned.secret!==session.secret,'browser owner credential never sent to device');
 nativeCall=await open('/socket?id='+session.id+'&side=A&secret='+assigned.secret,true);
 peer=await open('/socket?id='+session.id+'&side=B&secret='+session.secret);
 const state=await post('/status',{id:session.id,secret:session.secret});
 check(state.peers.A===true&&state.peers.B===true,'phone and browser independently WS connected');
 check(state.peerKinds.A==='native-protocol'&&state.peerKinds.B==='browser','native peer accurately typed');
 const ringing=wait(peer,m=>m.type==='event'&&m.event?.type==='call.ringing');
 nativeCall.send(JSON.stringify({type:'call.invite',requestId:'callapp-invite'}));
 await ringing;
 const accepted=wait(nativeCall,m=>m.type==='event'&&m.event?.type==='call.accept');
 peer.send(JSON.stringify({type:'call.accept',requestId:'web-accept'}));
 await accepted;
 nativeCall.send(JSON.stringify({type:'call.end',requestId:'end'}));
 const state2=await post('/status',{id:session.id,secret:session.secret});
 check(state2.phase==='ended','call lifecycle without PIN');
 console.log('HITEL_UNIQUE_APP_URL_AUTO_CONNECT_PASS',{perAppUrl:true,
  sameUrlAfterRestart:true,noPin:true,appWss:true,autoAttach:true,callLifecycle:true,hardwareIphone:false});
}finally{
 peer?.close();nativeCall?.close();app?.close();
 if(session)await post('/end',{id:session.id,secret:session.secret}).catch(()=>{});
}
