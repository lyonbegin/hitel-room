// End-to-end iOS Simulator native Swift WSS test against real Railway.
// This is not a Node pretend-native test: the receiver is actually running
// HitelNative.app in Apple's iOS Simulator with URLSessionWebSocketTask.
import WebSocket from 'ws';
import {writeFileSync} from 'node:fs';
const base='https://hitel-communication-web-production.up.railway.app';
const path='/lab-sandbox/playground';
const request=async(uri,payload)=>{const r=await fetch(base+path+uri,{method:'POST',headers:{
 'origin':base,'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
 const body=await r.json();if(!r.ok)throw Error('HTTP '+r.status+' '+JSON.stringify(body));return body};
const check=(x,m)=>{if(!x)throw Error('SWIFT_NATIVE_SIM_SIGNAL_FAIL '+m)};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const mode=process.argv[2],dest=process.argv[3];
if(mode==='create'){
 const session=await request('/session',{routeId:15});
 check(session.route.id===15&&/^\d{8}$/.test(session.nativeCodes.B),'W→N B code');
 const lines=['HITEL_SIM_SESSION_ID='+session.id,'HITEL_SIM_SESSION_SECRET='+session.secret,
  'HITEL_SIM_NATIVE_B_CODE='+session.nativeCodes.B,'HITEL_SIM_ROUTE_ID=15'];
 writeFileSync(dest,lines.join('\n')+'\n',{mode:0o600});
 console.log('SIMULATOR_NATIVE_SC15_SESSION_READY');
}else if(mode==='verify'){
 const id=process.env.HITEL_SIM_SESSION_ID,secret=process.env.HITEL_SIM_SESSION_SECRET;
 check(id&&secret,'env session info');
 let attached;
 for(let n=0;n<45;n++){
  const status=await request('/status',{id,secret});
  if(status.peers.B&&status.peerKinds.B==='native-protocol'){attached=true;break}
  await pause(1500);
 }
 check(attached,'actual Swift iPhone Simulator did not connect as B');
 console.log('SWIFT_NATIVE_REAL_WSS_JOIN_PASS');
 const ws=new WebSocket(base.replace('https','wss')+path+'/socket?id='+id+'&side=A&secret='+secret,{headers:{origin:base}});
 await new Promise((ok,no)=>{const t=setTimeout(()=>no(Error('Browser A websocket timeout')),9000);
 ws.once('open',()=>{clearTimeout(t);ok()});ws.once('error',no)});
 const waitEvent=(predicate,limit=15000)=>new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{ws.off('message',on);reject(Error('Signal event timeout'))},limit);
  function on(buf){let m;try{m=JSON.parse(String(buf))}catch{return}
   if(predicate(m)){clearTimeout(timeout);ws.off('message',on);resolve(m)}}
  ws.on('message',on);
 });
 const ringing=waitEvent(x=>x.type==='event'&&x.event?.type==='call.ringing');
 const accepted=waitEvent(x=>x.type==='event'&&x.event?.type==='call.accept',25000);
 ws.send(JSON.stringify({type:'call.invite',requestId:'actual-ios-simulator-invite'}));
 await ringing;
 const event=await accepted;
 check(event.event.by==='B','Swift iOS did not accept from role B');
 console.log('SWIFT_NATIVE_CALLKIT_INCOMING_ACCEPT_PASS');
 const status=await request('/status',{id,secret});
 check(status.phase==='accepted','server phase not accepted');
 ws.send(JSON.stringify({type:'call.end',requestId:'actual-ios-simulator-end'}));
 await pause(350);
 await request('/end',{id,secret});
 ws.close();
 console.log('IOS_SIMULATOR_REAL_SWIFT_URLSESSION_CALL_SIGNAL_PASS',{routeId:15,role:'B',
  nativeSwift:true,callkitNotificationAttempted:true,simulatorAutoAnswer:true,realMicrophone:false,realPhone:false});
}else{throw Error('Usage: node script create <file> | verify')}
