import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {wsScrcpyRoute} from '../sandbox-control/ws-scrcpy-host.mjs';

const origin='https://hitel-communication-web-production.up.railway.app';
const repo='lyonbegin/hitel-room';
const branch='feature/ws-scrcpy-android11-20261028';
const workflow='hitel-ws-scrcpy-live.yml';

test('web launch dispatches immediately and never falls back to scheduled polling',async()=>{
 const server=createServer((req,res)=>wsScrcpyRoute(req,res,new URL(req.url,'http://localhost').pathname));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const get=()=>fetch(base+'/ws-scrcpy/status').then(r=>r.json());
 const post=path=>fetch(base+'/ws-scrcpy/'+path,{method:'POST',headers:{Origin:origin,'content-type':'application/json'},body:'{}'}).then(async r=>({status:r.status,body:await r.json()}));
 const originalToken=process.env.HITEL_GITHUB_WORKFLOW_TOKEN;
 const originalFetch=globalThis.fetch;
 const dispatches=[];
 let dispatchStatus=204;
 try{
  delete process.env.HITEL_GITHUB_WORKFLOW_TOKEN;
  let s=await get();
  assert.equal(s.online,false);
  assert.equal(s.launchAvailable,false);
  assert.equal(s.dispatchConfigured,false);
  let response=await post('start');
  assert.equal(response.status,503);
  assert.equal(response.body.error,'GITHUB_WORKFLOW_DISPATCH_NOT_CONFIGURED');
  s=await get();assert.equal(s.progress.stage,'idle');

  process.env.HITEL_GITHUB_WORKFLOW_TOKEN='unit-test-actions-write-token';
  globalThis.fetch=async(url,options)=>{
   if(String(url).includes('/actions/workflows/')){
    dispatches.push({url:String(url),options});
    return new Response(dispatchStatus===204?null:'dispatch denied',{status:dispatchStatus});
   }
   return originalFetch(url,options);
  };

  s=await get();assert.equal(s.launchAvailable,true);assert.equal(s.dispatchConfigured,true);
  response=await post('start');
  assert.equal(response.status,202);
  assert.equal(response.body.launchState,'queued');
  assert.equal(dispatches.length,1);
  assert.equal(dispatches[0].url,
   'https://api.github.com/repos/'+repo+'/actions/workflows/'+workflow+'/dispatches');
  assert.equal(dispatches[0].options.headers.authorization,'Bearer unit-test-actions-write-token');
  assert.deepEqual(JSON.parse(dispatches[0].options.body),{ref:branch});
  s=await get();assert.equal(s.progress.stage,'queued');assert.equal(s.progress.history[0].stage,'queued');
  assert.ok(s.progress.elapsedSeconds>=0);
  const repeat=await post('start');assert.equal(repeat.status,409);
  const stop=await post('stop');assert.equal(stop.status,200);assert.equal(stop.body.cancelled,true);
  s=await get();assert.equal(s.progress.stage,'stopped');

  dispatchStatus=403;
  response=await post('start');
  assert.equal(response.status,502);
  assert.equal(response.body.error,'GITHUB_DISPATCH_FAILED');
  s=await get();assert.equal(s.progress.stage,'failed');
  assert.equal(s.launchAvailable,true);
 }finally{
  globalThis.fetch=originalFetch;
  if(originalToken===undefined)delete process.env.HITEL_GITHUB_WORKFLOW_TOKEN;
  else process.env.HITEL_GITHUB_WORKFLOW_TOKEN=originalToken;
  await new Promise(resolve=>server.close(resolve));
 }
});
