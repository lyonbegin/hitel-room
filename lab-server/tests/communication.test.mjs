import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
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
