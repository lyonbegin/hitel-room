// Full end-to-end integration against the REAL Swift HitelCall.app process
// installed and launched by xcrun simctl. No mocked app/device WebSocket.
// Simulators cannot prove physical iPhone hardware media or PushKit delivery.
import WebSocket from 'ws';
import {randomUUID,randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const base='https://hitel-communication-web-production.up.railway.app',root='/lab-sandbox/playground';
const check=(value,description)=>{if(!value)throw Error('HITEL_ACTUAL_SWIFT_NATIVE_E2E_FAILED '+description)};
const post=async(path,data,timeout=12000)=>{
 const r=await fetch(base+root+path,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(timeout)});
 const o=await r.json();if(!r.ok)throw Error('HTTP '+path+': '+r.status+' '+JSON.stringify(o));return o;
};
const pause=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const open=async(s,side)=>{
 const ws=new WebSocket(base.replace('https','wss')+root+'/socket?id='+s.id+'&side='+side+'&secret='+s.secret,{headers:{origin:base}});
 await new Promise((res,rej)=>{
  const timer=setTimeout(()=>rej(Error('WS_CONNECT_TIMEOUT')),9000);
  ws.once('open',()=>{clearTimeout(timer);res()});
  ws.once('error',rej);
 });return ws;
};
const incoming=(ws,predicate,timeout=17000)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.off('message',handle);reject(Error('EVENT_TIMEOUT'))},timeout);
 function handle(raw){let msg;try{msg=JSON.parse(String(raw))}catch{return}
  if(predicate(msg)){clearTimeout(timer);ws.off('message',handle);resolve(msg)}}
 ws.on('message',handle);
});
if(process.argv[2]==='setup'){
 const id=randomUUID(),secret=randomBytes(32).toString('hex');
 writeFileSync(process.argv[3],['HITEL_CALL_SIM_ID='+id,'HITEL_CALL_SIM_SECRET='+secret].join('\n')+'\n',{mode:0o600});
 console.log('SIMULATOR_IDENTITY_PREPARED');
}else if(process.argv[2]==='verify'){
 const id=process.env.HITEL_CALL_SIM_ID,secret=process.env.HITEL_CALL_SIM_SECRET;
 check(id&&secret,'missing identity');
 let device;
 for(let t=0;t<55;t++){
  try{
   const x=await post('/device/verify',{id,key:secret});
   if(x.device?.online){device=x;break}
  }catch(e){if(!String(e).includes('404'))console.log('REGISTER_WAIT',String(e).slice(0,140))}
  await pause(1200);
 }
 check(device&&device.device.online,'REAL Swift iOS Simulator app did not register and open its own WSS');
 console.log('REAL_SWIFT_IOS_SIMULATOR_DEVICE_REGISTRATION_AND_WSS_PASS');
 const token=device.pageUrl.split('/').at(-1);
 check(/^[a-f0-9]{64}$/.test(token),'device-specific page token');
 for(const [routeId,nativeSide,peerSide] of [[12,'A','B'],[15,'B','A']]){
  const session=await post('/session',{routeId});
  let web;
  try{
   web=await open(session,peerSide);
   if(routeId===12){
    const ringing=incoming(web,m=>m.type==='event'&&m.event?.type==='call.ringing',22000);
    await post('/device/attach',{pageToken:token,sessionId:session.id,sessionSecret:session.secret,side:nativeSide});
    const event=await ringing;
    check(event.event.by==='A','real Swift A did not send call.invite');
    const state=await post('/status',{id:session.id,secret:session.secret});
    check(state.peerKinds.A==='native-protocol'&&state.peerKinds.B==='browser','true standalone native+web participants');
    web.send(JSON.stringify({type:'call.reject',requestId:'reject-e2e'}));
    console.log('HITEL_REAL_SWIFT_N_TO_W_NATIVE_INVITE_PASS');
   }else{
    await post('/device/attach',{pageToken:token,sessionId:session.id,sessionSecret:session.secret,side:nativeSide});
    let online=false;
    for(let i=0;i<20;i++){
     const status=await post('/status',{id:session.id,secret:session.secret});
     if(status.peerKinds.B==='native-protocol'){online=true;break}
     await pause(450);
    }
    check(online,'real Swift B did not join W→N session');
    const accepted=incoming(web,m=>m.type==='event'&&m.event?.type==='call.accept',20000);
    web.send(JSON.stringify({type:'call.invite',requestId:'w-to-native-accept'}));
    const event=await accepted;
    check(event.event.by==='B','Swift CallKit receiver B did not accept');
    web.send(JSON.stringify({type:'call.end',requestId:'end-w-n'}));
    console.log('HITEL_REAL_SWIFT_W_TO_N_NATIVE_ACCEPT_PASS');
   }
  }finally{
   web?.close();
   await post('/end',{id:session.id,secret:session.secret}).catch(()=>{});
  }
 }
 await post('/device/unregister',{id,key:secret}).catch(()=>{});
 console.log('HITEL_REAL_SWIFT_IOS_SIMULATOR_NO_PIN_E2E_PASS',{nativeSwift:true,registeredBySwift:true,
  persistentDeviceWSS:true,perAppUrl:true,NtoW:true,WtoN:true,numericPairing:false,
  realPhysicalIPhone:false,realMedia:false});
}else throw Error('Usage: script setup file | verify');
