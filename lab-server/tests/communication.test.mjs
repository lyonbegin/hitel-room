import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WebSocket} from 'ws';
import {createCommunicationService} from '../communication.mjs';

function waitFor(ws,predicate,timeout=4000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',handler);reject(Error('Timed out waiting for signaling event'))},timeout);
    function handler(raw){
      let msg;try{msg=JSON.parse(String(raw))}catch{return}
      if(!predicate(msg))return;
      clearTimeout(timer);ws.off('message',handler);resolve(msg);
    }
    ws.on('message',handler);
  });
}
function makeClient(url,token,since=0){
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(url+'/comm-api/ws?token='+encodeURIComponent(token)+'&since='+since);
    ws.once('error',reject);
    ws.once('open',()=>{ws.off('error',reject);resolve(ws)});
  });
}
test('16 scenario contracts: every source/destination pair gets its distinct ID',async()=>{
  const comm=createCommunicationService();
  const server=createServer((req,res)=>void comm.http(req,res,new URL(req.url,'http://localhost').pathname));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const kinds=['P','P+','N','W'];
    for(let i=0;i<4;i++)for(let j=0;j<4;j++){
      const response=await fetch(base+'/comm-api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:kinds[i],to:kinds[j]})});
      assert.equal(response.status,201);
      const value=await response.json();
      assert.equal(value.scenarioId,i*4+j+1);
      assert.notEqual(value.callerToken,value.calleeToken);
    }
  }finally{comm.close();await new Promise(r=>server.close(r))}
});
test('actual two WebSocket clients: call FSM, role policy, presence, reconnect replay, private AI',async()=>{
  const comm=createCommunicationService({ringTimeoutMs:2000});
  const server=createServer((req,res)=>void comm.http(req,res,new URL(req.url,'http://localhost').pathname));
  server.on('upgrade',(req,socket,head)=>comm.upgrade(req,socket,head));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const wsurl='ws://127.0.0.1:'+server.address().port;
  let a,b;
  try{
    const created=await fetch(base+'/comm-api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:'N',to:'W'})});
    const {callerToken,calleeToken,callId,scenarioId}=await created.json();
    assert.equal(scenarioId,12);
    assert.equal((await fetch(base+'/comm-api/session/'+callId)).status,401);
    a=await makeClient(wsurl,callerToken);
    b=await makeClient(wsurl,calleeToken);
    const start=waitFor(b,m=>m.type==='comm.event'&&m.event.type==='call.invite');
    a.send(JSON.stringify({type:'call.action',action:'call.invite',requestId:'invite1'}));
    const invite=await start;assert.equal(invite.event.state,'inviting');
    const unauthorized=waitFor(a,m=>m.type==='comm.error'&&m.requestId==='bad1');
    a.send(JSON.stringify({type:'call.action',action:'call.accept',requestId:'bad1'}));
    assert.match((await unauthorized).error,/Invalid role/);
    const ringWait=waitFor(a,m=>m.type==='comm.event'&&m.event.type==='call.ringing');
    b.send(JSON.stringify({type:'call.action',action:'call.ringing',requestId:'ring1'}));
    await ringWait;
    const accept=waitFor(a,m=>m.type==='comm.event'&&m.event.type==='call.accept');
    b.send(JSON.stringify({type:'call.action',action:'call.accept',requestId:'accept1'}));
    await accept;
    const connect=waitFor(b,m=>m.type==='comm.event'&&m.event.type==='call.connecting');
    a.send(JSON.stringify({type:'call.action',action:'call.connecting',requestId:'conn1'}));
    await connect;
    const firstMedia=waitFor(b,m=>m.type==='comm.event'&&m.event.type==='call.mediaReady');
    a.send(JSON.stringify({type:'call.action',action:'call.active',requestId:'active1'}));
    assert.equal((await firstMedia).event.state,'connecting');
    const active=waitFor(a,m=>m.type==='comm.event'&&m.event.type==='call.active');
    b.send(JSON.stringify({type:'call.action',action:'call.active',requestId:'active2'}));
    assert.equal((await active).event.state,'active');
    const ai=waitFor(a,m=>m.type==='comm.event'&&m.event.type==='ai.result');
    a.send(JSON.stringify({type:'call.action',action:'ai.result',requestId:'ai1',payload:{message:'private caller advice'}}));
    assert.equal((await ai).event.payload.message,'private caller advice');
    const snapshot=await fetch(base+'/comm-api/session/'+callId,{headers:{Authorization:'Bearer '+calleeToken}});
    const snap=await snapshot.json();
    assert.equal(snap.state,'active');
    assert.equal(snap.events.some(e=>e.type==='ai.result'),false);
    await new Promise(resolve=>{b.once('close',resolve);b.close(1000,'Reconnect test')});b=null;
    b=await makeClient(wsurl,calleeToken,0);
    const rep=await fetch(base+'/comm-api/session/'+callId+'?since=0',{headers:{Authorization:'Bearer '+calleeToken}});
    const replay=await rep.json();
    assert.equal(replay.events.some(e=>e.type==='ai.result'),false);
    assert.equal(replay.events.some(e=>e.type==='call.active'),true);
    const ended=waitFor(b,m=>m.type==='comm.event'&&m.event.type==='call.end');
    a.send(JSON.stringify({type:'call.action',action:'call.end',requestId:'end1'}));
    assert.equal((await ended).event.state,'ended');
    const terminal=await fetch(base+'/comm-api/action',{method:'POST',headers:{Authorization:'Bearer '+callerToken,'Content-Type':'application/json'},body:JSON.stringify({action:'call.invite'})});
    assert.equal(terminal.status,409);
  }finally{
    a?.close();b?.close();comm.close();
    await new Promise(resolve=>server.close(resolve));
  }
});

test('two devices sharing callee identity keep independent replay despite one device ACK',async()=>{
  const comm=createCommunicationService();
  const server=createServer((req,res)=>void comm.http(req,res,new URL(req.url,'http://localhost').pathname));
  server.on('upgrade',(req,socket,head)=>comm.upgrade(req,socket,head));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const wsbase='ws://127.0.0.1:'+server.address().port;
  let first,second,restored;
  try {
    const created=await fetch(base+'/comm-api/session',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({from:'W',to:'N'})});
    const {callerToken,calleeToken,callId}=await created.json();
    first=await makeClient(wsbase,calleeToken);
    second=await makeClient(wsbase,calleeToken);
    const delivered1=waitFor(first,m=>m.type==='comm.event'&&m.event.type==='call.invite');
    const delivered2=waitFor(second,m=>m.type==='comm.event'&&m.event.type==='call.invite');
    const invited=await fetch(base+'/comm-api/action',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+callerToken},
      body:JSON.stringify({action:'call.invite'})});
    const msg=await invited.json();assert.equal(msg.state,'inviting');
    const [event1,event2]=await Promise.all([delivered1,delivered2]);
    assert.equal(event1.event.eventId,event2.event.eventId);
    first.send(JSON.stringify({type:'comm.ack',sequence:event1.event.sequence}));
    for(let i=0;i<30;i++){
      const snap=await fetch(base+'/comm-api/session/'+callId,{
        headers:{Authorization:'Bearer '+calleeToken}});
      const state=await snap.json();
      if(state.participants.callee.lastAck>=event1.event.sequence){
        assert.equal(state.participants.callee.connectedDevices,2);break;
      }
      if(i===29)assert.fail('first device ACK not saved');
      await new Promise(r=>setTimeout(r,30));
    }
    await new Promise(r=>{second.once('close',r);second.close()});
    second=null;
    // Attach listener BEFORE socket opens; reconnected device must not inherit first device ACK.
    restored=await new Promise((resolve,reject)=>{
      const ws=new WebSocket(wsbase+'/comm-api/ws?token='+encodeURIComponent(calleeToken));
      const timeout=setTimeout(()=>reject(new Error('Missing replay snapshot')),3000);
      ws.on('error',reject);
      ws.on('message',raw=>{
        const data=JSON.parse(String(raw));
        if(data.type==='comm.snapshot'){
          clearTimeout(timeout);
          resolve({socket:ws,snapshot:data});
        }
      });
    });
    assert.ok(restored.snapshot.events.some(e=>e.type==='call.invite'));
  } finally {
    first?.close();second?.close();restored?.socket.close();
    comm.close();await new Promise(r=>server.close(r));
  }
});

test('call cancellation, rejection, missed timeout and forbidden late acceptance are enforced',async()=>{
  const comm=createCommunicationService({ringTimeoutMs:200});
  const server=createServer((req,res)=>void comm.http(req,res,new URL(req.url,'http://localhost').pathname));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port+'/comm-api';
  async function session(){
    const r=await fetch(base+'/session',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({from:'N',to:'W'})});
    assert.equal(r.status,201);return r.json();
  }
  async function action(token,type){
    const r=await fetch(base+'/action',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body:JSON.stringify({action:type})});
    return {code:r.status,data:await r.json()};
  }
  try{
    const cancelled=await session();
    assert.equal((await action(cancelled.callerToken,'call.invite')).data.state,'inviting');
    assert.equal((await action(cancelled.callerToken,'call.cancel')).data.state,'cancelled');
    assert.equal((await action(cancelled.calleeToken,'call.accept')).code,409);
    const rejected=await session();
    assert.equal((await action(rejected.callerToken,'call.invite')).data.state,'inviting');
    assert.equal((await action(rejected.calleeToken,'call.ringing')).data.state,'ringing');
    assert.equal((await action(rejected.calleeToken,'call.reject')).data.state,'rejected');
    assert.equal((await action(rejected.callerToken,'call.connecting')).code,409);
    const missed=await session();
    await action(missed.callerToken,'call.invite');
    await new Promise(resolve=>setTimeout(resolve,380));
    const r=await fetch(base+'/session/'+missed.callId,{
      headers:{Authorization:'Bearer '+missed.calleeToken}});
    const snapshot=await r.json();
    assert.equal(snapshot.state,'missed');
    assert.ok(snapshot.events.some(e=>e.type==='call.missed'));
    assert.equal((await action(missed.calleeToken,'call.accept')).code,409);
  }finally{comm.close();await new Promise(resolve=>server.close(resolve))}
});

test('persisted call can resume after server restart with caller and callee tokens intact',async()=>{
  const store=await mkdtemp(join(tmpdir(),'hitel-comm-persist-'));
  let server,comm;
  async function start(){
    comm=createCommunicationService({storageDir:store,ringTimeoutMs:30_000});
    server=createServer((req,res)=>void comm.http(req,res,new URL(req.url,'http://localhost').pathname));
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    return 'http://127.0.0.1:'+server.address().port+'/comm-api';
  }
  async function stop(){
    comm.close();
    await new Promise(resolve=>server.close(resolve));
  }
  async function action(base,token,type){
    const r=await fetch(base+'/action',{method:'POST',
      headers:{'content-type':'application/json',authorization:'Bearer '+token},
      body:JSON.stringify({action:type})});
    assert.equal(r.status,200);
    return r.json();
  }
  try{
    let base=await start();
    const created=await fetch(base+'/session',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify({from:'W',to:'N'})});
    const session=await created.json();
    await action(base,session.callerToken,'call.invite');
    await action(base,session.calleeToken,'call.ringing');
    const savedFiles=await readdir(store);
    assert.equal(savedFiles.length,1);
    const saved=JSON.parse(await readFile(join(store,savedFiles[0]),'utf8'));
    assert.equal(saved.state,'ringing');
    assert.equal(saved.caller.token,undefined);
    assert.equal(saved.callee.token,undefined);
    assert.equal(saved.caller.tokenHash.length,64);
    assert.equal(JSON.stringify(saved).includes(session.callerToken),false);
    assert.equal(JSON.stringify(saved).includes(session.calleeToken),false);
    await stop();
    base=await start();
    const snapshotRequest=await fetch(base+'/session/'+session.callId,{
      headers:{authorization:'Bearer '+session.calleeToken}});
    assert.equal(snapshotRequest.status,200);
    const snapshot=await snapshotRequest.json();
    assert.equal(snapshot.state,'ringing');
    assert.ok(snapshot.events.some(e=>e.type==='call.invite'));
    assert.ok(snapshot.events.some(e=>e.type==='call.ringing'));
    const response=await action(base,session.calleeToken,'call.accept');
    assert.equal(response.state,'accepted');
    await action(base,session.callerToken,'call.end');
    const check=await fetch(base+'/session/'+session.callId,{
      headers:{authorization:'Bearer '+session.callerToken}});
    assert.equal((await check.json()).state,'ended');
    await stop();
    base=await start();
    const afterRestart=await fetch(base+'/session/'+session.callId,{
      headers:{authorization:'Bearer '+session.callerToken}});
    assert.equal((await afterRestart.json()).state,'ended');
  }finally{
    try{await stop()}catch{}
    await rm(store,{recursive:true,force:true});
  }
});
