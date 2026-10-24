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
  CommunicationSDK,CommunicationCallSession,createCommunicationSession
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
