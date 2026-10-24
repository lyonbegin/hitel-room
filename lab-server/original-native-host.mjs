import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

/**
 * Ephemeral endpoint directory for the ORIGINAL Android Emulator Platform.
 * Does not implement, modify, or emulate its React UI, Express API, or scrcpy.
 * A signed GitHub Actions KVM runner registers its temporary HTTPS ingress.
 */
export function createOriginalNativeHost({root,verifyCI,probeLiveUrl,probeCacheMs=3000}={}) {
  if(!root||typeof verifyCI!=='function')throw Error('NATIVE_ANDROID_HOST_SETUP_REQUIRED');
  const store=path.join(root,'original-native-endpoint.json');
  const safeUrl=/^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/;
  const json=(res,status,body)=>{
    res.writeHead(status,{'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(body));
  };
  const read=async()=>{try{return JSON.parse(await fs.readFile(store,'utf8'))}
    catch(e){if(e.code==='ENOENT')return null;throw e}};
  const save=async(value)=>{
    await fs.mkdir(root,{recursive:true});
    const temp=store+'.'+crypto.randomBytes(3).toString('hex')+'.tmp';
    await fs.writeFile(temp,JSON.stringify(value),{mode:0o600});
    await fs.rename(temp,store);
  };
  async function body(req){
    let count=0,bytes=[];
    for await(const chunk of req){
      count+=chunk.length;
      if(count>2048)throw Error('BODY_TOO_LARGE');
      bytes.push(chunk);
    }
    return JSON.parse(Buffer.concat(bytes).toString('utf8')||'{}');
  }
  const valid=r=>!!r&&r.status==='online'&&Number(r.expiresAt)>Date.now()&&safeUrl.test(r.url);
  // A saved online flag or a still-valid TTL does NOT prove that an ephemeral
  // GitHub/Cloudflare tunnel is alive. Probe the actual native backend /health.
  // Cache for the frontend 3-second poll cycle to avoid excess tunnel traffic.
  const healthProbe=probeLiveUrl||(async link=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),2300);
    try{
      const reply=await fetch(link+'/health',{
        signal:controller.signal,headers:{accept:'application/json'},cache:'no-store'});
      if(!reply.ok)return false;
      const body=await reply.json();
      return body&&body.status==='healthy';
    }catch{return false}
    finally{clearTimeout(timeout)}
  });
  let lastCheck={key:'',at:0,online:false};
  async function live(current){
    if(!valid(current))return false;
    const key=current.runId+'|'+current.url;
    if(lastCheck.key===key&&Date.now()-lastCheck.at<probeCacheMs)
      return lastCheck.online;
    const ok=Boolean(await healthProbe(current.url));
    lastCheck={key,at:Date.now(),online:ok};
    return ok;
  }
  async function http(req,res,url){
    const route=url.pathname;
    try{
      if(req.method==='POST'&&route==='/lab-api/android-native/ci/register'){
        let identity;
        try{identity=await verifyCI(req)}catch{return json(res,403,{ok:false,error:'TRUSTED_GITHUB_RUNNER_ONLY'})}
        const data=await body(req);
        const link=String(data.url||'').replace(/\/$/,'');
        if(!safeUrl.test(link))return json(res,400,{ok:false,error:'INVALID_NATIVE_HTTPS_URL'});
        const info={url:link,status:'online',runId:String(identity.run_id||''),
          registeredAt:new Date().toISOString(),expiresAt:Date.now()+19*60*1000,
          transport:'original-scrcpy-novnc',engine:'original-android-11-docker'};
        await save(info);
        return json(res,201,{ok:true,status:info.status,expiresAt:info.expiresAt});
      }
      if(req.method==='POST'&&route==='/lab-api/android-native/ci/finish'){
        let identity;
        try{identity=await verifyCI(req)}catch{return json(res,403,{ok:false,error:'TRUSTED_GITHUB_RUNNER_ONLY'})}
        const current=await read();
        if(current&&current.runId===String(identity.run_id||'')){
          current.status='stopped';current.finishedAt=new Date().toISOString();await save(current);
        }
        return json(res,200,{ok:true});
      }
      if(req.method==='GET'&&route==='/lab-api/android-native/status'){
        const current=await read();
        const online=await live(current);
        return json(res,200,{ok:true,online,transport:'original-scrcpy-novnc',
          engine:'original-android-11-docker',
          ...(!online&&valid(current)?{error:'host_unreachable'}:{}),
          ...(online?{url:current.url,runId:current.runId,expiresAt:current.expiresAt}:{})});
      }
      if(req.method==='GET'&&route==='/lab-api/android-native/open'){
        const current=await read();
        if(!(await live(current)))return json(res,503,{ok:false,error:'ORIGINAL_ANDROID_NOT_RUNNING',
          message:'원본 Android 11 + scrcpy/noVNC 서버가 실행되지 않았습니다.'});
        res.writeHead(302,{location:current.url+'/', 'cache-control':'no-store'});
        return res.end();
      }
      if(req.method==='GET'&&route==='/lab-api/android-native/view'){
        const current=await read();
        if(!(await live(current)))return json(res,503,{ok:false,
          error:'ORIGINAL_ANDROID_NOT_RUNNING',
          message:'실제 Android 호스트 또는 noVNC 터널이 실행 중이지 않습니다.'});
        res.writeHead(302,{location:current.url+'/stream/1/phone.html',
          'cache-control':'no-store'});
        return res.end();
      }
      if(req.method==='GET'&&route==='/lab-api/android-native/ci/stop-requested'){
        let identity;
        try{identity=await verifyCI(req)}catch{return json(res,403,{ok:false,error:'TRUSTED_GITHUB_RUNNER_ONLY'})}
        const file=path.join(root,'apk-manager','interactive-request.json');
        let cur=null;try{cur=JSON.parse(await fs.readFile(file,'utf8'))}catch{}
        // Do not stop a new native runner because an old test completed.
        // A stop must belong to this precise GitHub Actions run.
        return json(res,200,{ok:true,stop:!!cur&&cur.status==='stopping'&&
          cur.claimRunId===String(identity.run_id||'')});
      }
      return json(res,404,{ok:false,error:'UNKNOWN_ORIGINAL_ANDROID_ENDPOINT'});
    }catch(e){
      console.error('ANDROID_ORIGINAL_NATIVE_HOST',String(e.message||e).slice(0,130));
      return json(res,500,{ok:false,error:'ORIGINAL_NATIVE_HOST_ERROR'});
    }
  }
  return {http};
}
