import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApkManager} from '../apk-manager.mjs';

const ADMIN='test-admin-token-with-sufficient-entropy';
const AGENT='test-agent-token-with-sufficient-entropy';
async function fixture(){
  const store=await mkdtemp(join(tmpdir(),'hitel-apk-'));
  const apk=createApkManager({root:store,adminToken:ADMIN,agentToken:AGENT,maxBytes:8192});
  const server=http.createServer((req,res)=>apk.http(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {store,server,url:'http://127.0.0.1:'+server.address().port,
    async dispose(){await new Promise(resolve=>server.close(resolve));await rm(store,{recursive:true,force:true})}};
}
async function call(f,path,{method='GET',body,token,device,headers={}}={}){
  const res=await fetch(f.url+'/lab-api/apk/'+path,{
    method,body,headers:{...(token?{authorization:'Bearer '+token}:{}),
      ...(device?{'x-emulator-device':device}:{}),...headers}
  });
  return {status:res.status,body:await res.json()};
}
test('APK installation API rejects anonymous access and non-APK payloads',async()=>{
  const f=await fixture();
  try{
    assert.equal((await call(f,'files')).status,401);
    assert.equal((await call(f,'jobs',{method:'POST',body:'{}'})).status,401);
    assert.equal((await call(f,'agent/next',{method:'POST',body:'{}',device:'android-lab-01'})).status,401);
    const fake=await call(f,'upload',{method:'POST',token:ADMIN,body:Buffer.alloc(120),
      headers:{'x-apk-filename':'evil.apk'}});
    assert.equal(fake.status,400);
    assert.equal(fake.body.error,'INVALID_APK_ZIP_HEADER');
    assert.equal((await call(f,'files',{token:ADMIN})).body.files.length,0);
  }finally{await f.dispose()}
});
test('binary upload, SHA verification, real agent lease, download and report lifecycle',async()=>{
  const f=await fixture();
  try{
    const buf=Buffer.concat([Buffer.from('504b0304','hex'),Buffer.alloc(145,0x1d)]);
    const upload=await call(f,'upload',{method:'POST',token:ADMIN,body:buf,
      headers:{'content-type':'application/vnd.android.package-archive',
               'x-apk-filename':encodeURIComponent('third-party.apk')}});
    assert.equal(upload.status,201);
    assert.equal(upload.body.file.filename,'third-party.apk');
    assert.equal(upload.body.file.size,149);
    assert.equal(upload.body.file.sha256.length,64);
    const apkId=upload.body.file.id;
    const wanted=await call(f,'jobs',{method:'POST',token:ADMIN,
      body:JSON.stringify({apkId,deviceId:'android-lab-01',launchAfterInstall:true})});
    assert.equal(wanted.status,201);
    assert.equal(wanted.body.job.status,'pending');
    const ask=await call(f,'agent/next',{method:'POST',token:AGENT,
      device:'android-lab-01',body:'{}'});
    assert.equal(ask.status,200);
    const lease=ask.body.job;
    assert.equal(lease.apkId,apkId);
    assert.equal(lease.launchAfterInstall,true);
    const binary=await fetch(f.url+'/lab-api/apk/agent/file/'+lease.id,{
      headers:{authorization:'Bearer '+AGENT,'x-emulator-device':'android-lab-01'}});
    assert.equal(binary.status,200);
    assert.deepEqual(Buffer.from(await binary.arrayBuffer()),buf);
    const wrong=await call(f,'agent/report',{method:'POST',token:AGENT,device:'android-lab-01',
      body:JSON.stringify({jobId:lease.id,leaseId:'not-the-lease',success:true})});
    assert.equal(wrong.status,409);
    const done=await call(f,'agent/report',{method:'POST',token:AGENT,device:'android-lab-01',
      body:JSON.stringify({jobId:lease.id,leaseId:lease.leaseId,success:true,
        packageName:'com.example.test',installLog:'Success'})});
    assert.equal(done.body.status,'installed');
    const results=await call(f,'jobs',{token:ADMIN});
    assert.equal(results.body.jobs[0].status,'installed');
    assert.equal(results.body.jobs[0].packageName,'com.example.test');
    const host=await call(f,'hosts',{token:ADMIN});
    assert.equal(host.body.hosts[0].online,true);
    const empty=await call(f,'agent/next',{method:'POST',token:AGENT,
      device:'android-lab-01',body:'{}'});
    assert.equal(empty.body.job,null);
  }finally{await f.dispose()}
});

test('OIDC CI upload seeds a real install job restricted to disposable ci-android',async()=>{
  const store=await mkdtemp(join(tmpdir(),'hitel-apk-ci-'));
  const service=createApkManager({root:store,adminToken:ADMIN,agentToken:AGENT,
    verifyCI:async()=>({run_id:'40000000000'}),maxBytes:8192});
  const server=http.createServer((req,res)=>service.http(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port+'/lab-api/apk/';
    const sample=Buffer.concat([Buffer.from('504b0304','hex'),Buffer.alloc(220)]);
    const uploaded=await fetch(base+'ci/seed',{
      method:'POST',body:sample,headers:{authorization:'Bearer CI_TEST_FAKE_OIDC'}});
    assert.equal(uploaded.status,201);
    assert.equal((await uploaded.json()).seeded,true);
    const result=await fetch(base+'agent/next',{method:'POST',body:'{}',
      headers:{authorization:'Bearer '+AGENT,'x-emulator-device':'ci-android'}});
    const job=(await result.json()).job;
    assert.equal(job.filename,'hitel-native-ci.apk');
    assert.equal(job.launchAfterInstall,true);
    const no=await fetch(base+'agent/next',{method:'POST',body:'{}',
      headers:{authorization:'Bearer CI_TEST_FAKE_OIDC','x-emulator-device':'android-lab-01'}});
    assert.equal(no.status,401,'OIDC may control only disposable ci-android');
  }finally{await new Promise(resolve=>server.close(resolve));await rm(store,{recursive:true,force:true})}
});

test('authenticated full-device frame and actual touch-command lease are isolated',async()=>{
  const f=await fixture();
  try{
    const png=Buffer.alloc(128);
    Buffer.from('89504e470d0a1a0a','hex').copy(png,0);
    png.writeUInt32BE(1080,16);png.writeUInt32BE(2340,20);
    const sent=await call(f,'agent/frame',{method:'POST',token:AGENT,
      device:'android-lab-01',body:png,headers:{'content-type':'image/png'}});
    assert.equal(sent.status,200);
    assert.equal(sent.body.width,1080);
    const unauthorized=await fetch(f.url+'/lab-api/apk/frame/android-lab-01');
    assert.equal(unauthorized.status,401);
    const frame=await fetch(f.url+'/lab-api/apk/frame/android-lab-01',
      {headers:{authorization:'Bearer '+ADMIN}});
    assert.equal(frame.status,200);
    assert.deepEqual(Buffer.from(await frame.arrayBuffer()),png);
    const rejected=await call(f,'control',{method:'POST',token:ADMIN,
      body:JSON.stringify({deviceId:'android-lab-01',action:'tap',x:1800,y:200})});
    assert.equal(rejected.status,400);
    const queued=await call(f,'control',{method:'POST',token:ADMIN,
      body:JSON.stringify({deviceId:'android-lab-01',action:'tap',x:540,y:1170})});
    assert.equal(queued.status,201);
    const delivered=await call(f,'agent/next',{method:'POST',token:AGENT,device:'android-lab-01',body:'{}'});
    assert.equal(delivered.body.job.operation,'control');
    assert.equal(delivered.body.job.action,'tap');
    assert.deepEqual(delivered.body.job.args,{x:540,y:1170});
    const report=await call(f,'agent/report',{method:'POST',token:AGENT,device:'android-lab-01',
      body:JSON.stringify({jobId:delivered.body.job.id,leaseId:delivered.body.job.leaseId,
        success:true,installLog:'ADB input tap done'})});
    assert.equal(report.body.status,'completed');
  }finally{await f.dispose()}
});
