import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { createAndroidOriginalAdapter } from '../android-original-adapter.mjs';

const ORIGIN='http://127.0.0.1';

test('untouched original UI API queues real runner request and never invents an Android frame',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'hitel-android-original-'));
  const adapter=createAndroidOriginalAdapter({root});
  const server=http.createServer((req,res)=>adapter.http(req,res,new URL(req.url,ORIGIN)));
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const base='http://127.0.0.1:'+server.address().port;
  const call=async(route,{method='GET',cookie='',body=null}={})=>{
    const r=await fetch(base+route,{
      method,headers:{...(method!=='GET'?{origin:ORIGIN}:{}),
        ...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const data=await r.json();return {status:r.status,data,cookie:r.headers.get('set-cookie')||''};
  };
  try{
    let x=await call('/api/emulator/devices');
    assert.equal(x.status,200);
    assert.equal(x.data.devices.length,1);
    assert.equal(x.data.devices[0].free,1);
    x=await call('/api/emulator/session',{method:'POST',
      body:{device:x.data.devices[0].device,timeout:13}});
    assert.equal(x.status,201);
    const id=x.data.sessionId;
    assert.match(id,/^[a-f0-9-]{36}$/);
    assert.equal(x.data.connected,false,'Enqueued is not a running Android device');
    assert.match(x.data.vncUrl,/ci-playstore/);
    assert.match(x.cookie,/HttpOnly/);
    const ownerCookie=x.cookie.split(';')[0];
    let own=await call('/api/emulator/sessions',{cookie:ownerCookie});
    assert.equal(own.data.count,1);
    let other=await call('/api/emulator/sessions');
    assert.equal(other.data.count,0,'Do not disclose other browser sessions');
    x=await call('/api/emulator/frame/'+id,{cookie:ownerCookie});
    assert.equal(x.status,404,'Must never return a fabricated Android screenshot');
    x=await call('/api/emulator/key/'+id,{method:'POST',cookie:ownerCookie,body:{key:'HOME'}});
    assert.equal(x.status,409,'Native host required before ADB commands');
    x=await call('/api/emulator/session/'+id,{method:'DELETE',cookie:ownerCookie});
    assert.equal(x.status,200);
    x=await call('/api/emulator/devices');
    assert.equal(x.data.devices[0].free,1);
    x=await call('/api/emulator/sessions',{cookie:ownerCookie});
    assert.equal(x.data.count,0);
  }finally{
    await new Promise(done=>server.close(done));
    await rm(root,{recursive:true,force:true});
  }
});


test('original Apps UI supports isolated APK upload, listing and deletion before Android starts',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'hitel-android-apk-original-'));
  const adapter=createAndroidOriginalAdapter({root});
  const server=http.createServer((req,res)=>adapter.http(req,res,new URL(req.url,ORIGIN)));
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const opening=await fetch(base+'/api/emulator/devices');
    assert.equal(opening.status,200);
    const guest=opening.headers.get('set-cookie').split(';')[0];
    assert.match(guest,/hitel_android_original_guest=/);
    const form=new FormData();
    const bytes=Buffer.alloc(240,0x20);
    Buffer.from([0x50,0x4b,0x03,0x04]).copy(bytes,0);
    form.append('apk',new Blob([bytes],{type:'application/vnd.android.package-archive'}),'demo.apk');
    const upload=await fetch(base+'/api/upload/apk',{method:'POST',
      headers:{origin:ORIGIN,cookie:guest},body:form});
    assert.equal(upload.status,201);
    // First response body was consumed only if assertion failed.
    const listed=await fetch(base+'/api/upload/apks',{headers:{cookie:guest}});
    const list=await listed.json();
    assert.equal(list.apks.length,1);
    assert.equal(list.apks[0].original_name,'demo.apk');
    const stranger=await fetch(base+'/api/upload/apks');
    assert.equal((await stranger.json()).apks.length,0);
    const deleted=await fetch(base+'/api/upload/apk/'+list.apks[0].id,{
      method:'DELETE',headers:{cookie:guest,origin:ORIGIN}});
    assert.equal(deleted.status,200);
    const empty=await fetch(base+'/api/upload/apks',{headers:{cookie:guest}});
    assert.equal((await empty.json()).apks.length,0);
  }finally{
    await new Promise(done=>server.close(done));
    await rm(root,{recursive:true,force:true});
  }
});
