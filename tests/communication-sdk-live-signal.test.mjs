import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createCommunicationService} from '../lab-server/communication.mjs';

const require=createRequire(new URL('../lab-server/package.json',import.meta.url));
globalThis.WebSocket=require('ws').WebSocket;
globalThis.window=new EventTarget();
globalThis.location={href:'http://127.0.0.1/'};
const {
  CommunicationSDK,CommunicationCallSession,createCommunicationSession,executeCommunicationScenario
}=await import(pathToFileURL(resolve('dist/sdk/communication.esm.js')).href);

test('built Communication SDK runs real call signaling with TWO clients and gated media',async()=>{
  const comm=createCommunicationService({ringTimeoutMs:3000});
  const server=createServer((req,res)=>void comm.http(req,res,new URL(req.url,'http://localhost').pathname));
  server.on('upgrade',(req,socket,head)=>comm.upgrade(req,socket,head));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port+'/comm-api';
  let caller,callee,sdkCaller,sdkCallee;
  try{
    const created=await createCommunicationSession('N','N',base);
    assert.equal(created.scenarioId,11);
    sdkCaller=CommunicationSDK.create({nativeBridge:{platform:()=> 'browser',request:async()=>({ok:true})}});
    sdkCallee=CommunicationSDK.create({nativeBridge:{platform:()=> 'browser',request:async()=>({ok:true})}});
    caller=new CommunicationCallSession(sdkCaller,created.callerToken,base);
    callee=new CommunicationCallSession(sdkCallee,created.calleeToken,base);
    let callerPrivate=0,calleePrivate=0;
    caller.on(e=>{if(e.type==='ai.result')callerPrivate++});
    callee.on(e=>{if(e.type==='ai.result')calleePrivate++});
    await Promise.all([caller.connect(),callee.connect()]);
    await caller.invite();
    // Kill the actual callee transport and prove it reopens with the same
    // participant identity and replays unseen call events before acting.
    const previousSocket=callee.signaling.socket;
    previousSocket.terminate();
    const reconnectDeadline=Date.now()+9000;
    while(Date.now()<reconnectDeadline&&(!callee.signaling.online||callee.signaling.socket===previousSocket))
      await new Promise(resolve=>setTimeout(resolve,100));
    assert.equal(callee.signaling.online,true,'callee reconnects after dropped TCP/WebSocket');
    assert.notEqual(callee.signaling.socket,previousSocket);
    assert.equal((await callee.signaling.snapshot()).state,'inviting');
    await callee.ringing();
    await callee.accept();
    const fakeStream={getTracks:()=>[{readyState:'live'}]};
    let joins=0;
    const rtcAdapter={join:async()=>{joins++;return {isStarted:()=>true,leave:async()=>{}}}};
    await caller.connectMedia('rtc-e2e',fakeStream,rtcAdapter);
    assert.equal(caller.state,'connecting','one participant joining cannot mark ACTIVE');
    await callee.connectMedia('rtc-e2e',fakeStream,rtcAdapter);
    assert.equal(joins,2);
    assert.equal((await caller.signaling.snapshot()).state,'active');
    await caller.signaling.action('ai.result',{message:'PRIVATE'});
    assert.equal(callerPrivate,1);
    assert.equal(calleePrivate,0);
    await callee.end();
    assert.equal((await caller.signaling.snapshot()).state,'ended');
  }finally{
    await caller?.dispose();await callee?.dispose();
    await sdkCaller?.dispose();await sdkCallee?.dispose();
    comm.close();await new Promise(resolve=>server.close(resolve));
  }
});

test('all 16 scenario executors invoke the correct real integration boundary, never fake a carrier call',async()=>{
  const comm=createCommunicationService();
  const server=createServer((req,res)=>void comm.http(req,res,new URL(req.url,'http://localhost').pathname));
  server.on('upgrade',(req,socket,head)=>comm.upgrade(req,socket,head));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port+'/comm-api';
  const kinds=['P','P+','N','W'],calls=[];
  const carrier={
    attachIncomingSidecar:async()=>{calls.push('sidecar-in');return {connected:false}},
    dialCarrierNumber:async()=>{calls.push('native-dialer');return {opened:true}},
    pairSidecars:async()=>{calls.push('sidecar-pair');return {consented:true}}
  };
  const gateway={
    incomingPstn:async()=>{calls.push('gateway-in');return {connected:false}},
    outgoingPstn:async()=>{calls.push('gateway-out');return {connected:false}}
  };
  try{
    for(let i=0;i<4;i++)for(let j=0;j<4;j++){
      const from=kinds[i],to=kinds[j],id=i*4+j+1;
      const sdk=CommunicationSDK.create({nativeBridge:{platform:()=> 'browser',request:async()=>({ok:true})}});
      const isWebRtc=[11,12,15,16].includes(id);
      const session=isWebRtc?await createCommunicationSession(from,to,base):null;
      const result=await executeCommunicationScenario({sdk,from,to,role:'caller',
        ...(session?{participantToken:session.callerToken}:{}),
        phoneNumber:'0212345678',baseUrl:base,carrier,gateway});
      assert.equal(result.scenarioId,id);
      if(id===1)assert.equal(result.status,'external-unmanaged');
      else if(isWebRtc){assert.equal(result.status,'signaling-connected');assert.equal(result.session.callId,session.callId);await result.session.dispose()}
      else assert.notEqual(result.status,'signaling-connected','External telephony cannot be reported as connected WebRTC');
      await sdk.dispose();
    }
    assert.equal(calls.filter(x=>x==='sidecar-in').length,1);
    assert.equal(calls.filter(x=>x==='native-dialer').length,2);
    assert.equal(calls.filter(x=>x==='sidecar-pair').length,1);
    assert.equal(calls.filter(x=>x==='gateway-in').length,2);
    assert.equal(calls.filter(x=>x==='gateway-out').length,6);
  }finally{comm.close();await new Promise(resolve=>server.close(resolve))}
});
