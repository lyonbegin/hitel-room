import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {wsScrcpyRoute} from '../sandbox-control/ws-scrcpy-host.mjs';
const origin='https://hitel-communication-web-production.up.railway.app';
test('queued Android request exposes real stage and cancel resets it',async()=>{
 const server=createServer((req,res)=>wsScrcpyRoute(req,res,new URL(req.url,'http://localhost').pathname));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const get=()=>fetch(base+'/ws-scrcpy/status').then(r=>r.json());
 const post=path=>fetch(base+'/ws-scrcpy/'+path,{method:'POST',headers:{Origin:origin,'content-type':'application/json'},body:'{}'}).then(async r=>({status:r.status,body:await r.json()}));
 try{
  let s=await get();assert.equal(s.online,false);assert.equal(s.progress.stage,'idle');
  const request=await post('start');
  assert.equal(request.status,202);assert.equal(request.body.launchState,'queued');
  s=await get();assert.equal(s.progress.stage,'queued');assert.equal(s.progress.history[0].stage,'queued');assert.equal(s.progress.queued,true);
  assert.ok(s.progress.elapsedSeconds>=0);
  const repeat=await post('start');assert.equal(repeat.status,409);
  const stop=await post('stop');assert.equal(stop.status,200);assert.equal(stop.body.cancelled,true);
  s=await get();assert.equal(s.progress.stage,'stopped');
  const restart=await post('start');assert.equal(restart.status,202);
  s=await get();assert.equal(s.progress.stage,'queued');
  const final=await post('stop');assert.equal(final.status,200);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
