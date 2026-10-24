import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import net from 'node:net';

const require=createRequire(new URL('../lab-server/package.json',import.meta.url));
const {WebSocket}=require('ws');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){
  const server=net.createServer();
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const port=server.address().port;
  await new Promise(r=>server.close(r));return port;
}
async function connect(url){
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(url);
    ws.once('error',reject);
    ws.once('open',()=>{ws.off('error',reject);resolve(ws)});
  });
}
test('simultaneous Android devices retain isolated controller sockets',async()=>{
  const port=await freePort(),base='http://127.0.0.1:'+port;
  const dir=await mkdtemp(join(tmpdir(),'hitel-relay-multi-'));
  const child=spawn(process.execPath,['lab-server/index.mjs'],{
    cwd:resolve('.'),env:{...process.env,PORT:String(port),LAB_DATA_DIR:dir},
    stdio:['ignore','pipe','pipe']
  });
  const processErrors=[];
  child.stderr.on('data',chunk=>processErrors.push(String(chunk).slice(-600)));
  let first,second;
  async function pair(){
    const resp=await fetch(base+'/lab-api/pair',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify({side:'android'})});
    assert.equal(resp.status,201);return resp.json();
  }
  async function command(pairData){
    const reply=await fetch(base+'/lab-api/command',{method:'POST',
      headers:{'content-type':'application/json',authorization:'Bearer '+pairData.controller},
      body:JSON.stringify({device:'android',action:'ping'})});
    assert.equal(reply.status,202,'each active controller must reach its own native socket');
    return (await reply.json()).requestId;
  }
  async function replyToNative(ws){
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('Native test command not delivered')),2000);
      const handler=raw=>{
        const msg=JSON.parse(String(raw));
        if(msg.type==='command'){
          clearTimeout(timeout);ws.off('message',handler);
          ws.send(JSON.stringify({type:'result',requestId:msg.requestId,ok:true,platform:'android'}));
          resolve(msg.requestId);
        }
      };
      ws.on('message',handler);
    });
  }
  try{
    let ready=false;
    for(let i=0;i<80;i++){
      if(child.exitCode!==null)throw Error('Relay process exited: '+processErrors.join('').slice(-300));
      try{const r=await fetch(base+'/lab-api/health');if(r.ok){ready=true;break}}catch{}
      await delay(100);
    }
    assert.ok(ready,'Relay test process must be reachable');
    const a=await pair(),b=await pair();
    first=await connect('ws://127.0.0.1:'+port+'/lab-api/ws?role=device&side=android&ticket='+encodeURIComponent(a.ticket));
    second=await connect('ws://127.0.0.1:'+port+'/lab-api/ws?role=device&side=android&ticket='+encodeURIComponent(b.ticket));
    const firstArrival=replyToNative(first),secondArrival=replyToNative(second);
    const firstCommand=await command(a);
    const secondCommand=await command(b);
    const [firstReceived,secondReceived]=await Promise.all([firstArrival,secondArrival]);
    assert.equal(firstReceived,firstCommand);
    assert.equal(secondReceived,secondCommand);
    for(const [pairData,id] of [[a,firstCommand],[b,secondCommand]]){
      const res=await fetch(base+'/lab-api/result/'+id,{
        headers:{authorization:'Bearer '+pairData.controller}});
      assert.equal(res.status,200);
      assert.equal((await res.json()).ok,true);
    }
    assert.equal(first.readyState,WebSocket.OPEN);
    assert.equal(second.readyState,WebSocket.OPEN);
  }finally{
    first?.terminate();second?.terminate();
    child.kill('SIGTERM');
    await Promise.race([new Promise(r=>child.once('close',r)),delay(1500)]);
    if(child.exitCode===null)child.kill('SIGKILL');
    await rm(dir,{recursive:true,force:true});
  }
});
