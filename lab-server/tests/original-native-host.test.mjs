import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {createOriginalNativeHost} from '../original-native-host.mjs';

test('original native host publishes ONLY registered real HTTPS scrcpy URL',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'android-original-native-'));
 let healthy=true;
 const service=createOriginalNativeHost({root,probeLiveUrl:async()=>healthy,
   probeCacheMs:0,verifyCI:async req=>{
   if(req.headers.authorization!=='Bearer signed-runner')throw Error('UNTRUSTED');
   return {run_id:'400123'};
 }});
 const server=http.createServer((req,res)=>service.http(req,res,new URL(req.url,'http://localhost')));
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,{method='GET',body,auth=''}={})=>fetch(base+route,{
   method,redirect:'manual',headers:{...(auth?{authorization:'Bearer '+auth}:{}),...(body?{'content-type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 try{
   let res=await call('/lab-api/android-native/status'),info=await res.json();
   assert.equal(info.online,false);
   res=await call('/lab-api/android-native/open');
   assert.equal(res.status,503);
   res=await call('/lab-api/android-native/ci/register',{method:'POST',body:{url:'https://upstream.example.com'}});
   assert.equal(res.status,403,'unsigned registration must fail');
   res=await call('/lab-api/android-native/ci/register',{method:'POST',auth:'signed-runner',body:{url:'https://upstream.example.com'}});
   assert.equal(res.status,400,'arbitrary domains are not accepted');
   res=await call('/lab-api/android-native/ci/register',{method:'POST',auth:'signed-runner',body:{url:'https://real-original-phone.trycloudflare.com'}});
   assert.equal(res.status,201);
   res=await call('/lab-api/android-native/status');info=await res.json();
   assert.equal(info.online,true);
   assert.equal(info.transport,'original-scrcpy-novnc');
   res=await call('/lab-api/android-native/open');
   assert.equal(res.status,302);
   assert.equal(res.headers.get('location'),'https://real-original-phone.trycloudflare.com/');
   res=await call('/lab-api/android-native/view');
   assert.equal(res.status,302);
   assert.equal(res.headers.get('location'),
      'https://real-original-phone.trycloudflare.com/stream/1/phone.html');
   // Expired external tunnel must NOT continue displaying "Android running".
   healthy=false;
   res=await call('/lab-api/android-native/status');info=await res.json();
   assert.equal(info.online,false);
   assert.equal(info.error,'host_unreachable');
   res=await call('/lab-api/android-native/view');
   assert.equal(res.status,503);
   assert.equal(info.url,undefined);
   res=await call('/lab-api/android-native/open');
   assert.equal(res.status,503);
   healthy=true;
   res=await call('/lab-api/android-native/status');
   assert.equal((await res.json()).online,true);
   res=await call('/lab-api/android-native/ci/stop-requested',{auth:'signed-runner'});
   assert.equal((await res.json()).stop,false);
   await mkdir(path.join(root,'apk-manager'),{recursive:true});
   await writeFile(path.join(root,'apk-manager','interactive-request.json'),JSON.stringify({status:'completed'}));
   res=await call('/lab-api/android-native/ci/stop-requested',{auth:'signed-runner'});
   assert.equal((await res.json()).stop,false,'old completed session must not stop new runner');
   await writeFile(path.join(root,'apk-manager','interactive-request.json'),JSON.stringify({status:'stopping',claimRunId:'other-run'}));
   res=await call('/lab-api/android-native/ci/stop-requested',{auth:'signed-runner'});
   assert.equal((await res.json()).stop,false,'other run cannot stop current emulator');
   await writeFile(path.join(root,'apk-manager','interactive-request.json'),JSON.stringify({status:'stopping',claimRunId:'400123'}));
   res=await call('/lab-api/android-native/ci/stop-requested',{auth:'signed-runner'});
   assert.equal((await res.json()).stop,true);
   res=await call('/lab-api/android-native/ci/finish',{method:'POST',body:{},auth:'signed-runner'});
   assert.equal(res.status,200);
   res=await call('/lab-api/android-native/status');
   assert.equal((await res.json()).online,false);
 }finally{
   await new Promise(done=>server.close(done));
   await rm(root,{recursive:true,force:true});
 }
});
