import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Genymotion SaaS backend adapter. SaaS credentials remain on Railway.
// The frontend only receives a short-lived, instance-scoped player credential.
export function createGenymotionSaasManager({root, apiToken=process.env.GENYMOTION_API_TOKEN || '', fetcher=fetch}={}) {
  if(!root) throw Error('GENYMOTION_STORAGE_ROOT_REQUIRED');
  const stateFile=path.join(root,'genymotion-session.json');
  const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const origin='https://hitel-communication-web-production.up.railway.app';
  let lock=Promise.resolve();
  const serial=(fn)=>{const next=lock.then(fn,fn);lock=next.catch(()=>{});return next;};
  const answer=(res,status,data)=>{
    res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(data));
  };
  const now=()=>Date.now();
  const cookie=(req)=>String(req.headers.cookie||'').split(';').map(s=>s.trim())
    .find(s=>s.startsWith('gm_sdk_owner='))?.slice('gm_sdk_owner='.length)||'';
  const same=(a,b)=>!!a&&!!b&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
  async function readState(){try{return JSON.parse(await fs.readFile(stateFile,'utf8'))}catch{return null}}
  async function saveState(value){
    await fs.mkdir(root,{recursive:true,mode:0o700});
    const file=stateFile+'.'+crypto.randomBytes(4).toString('hex')+'.tmp';
    await fs.writeFile(file,JSON.stringify(value),{mode:0o600});
    await fs.rename(file,stateFile);
  }
  async function readBody(req){let length=0,parts=[];for await(const b of req){length+=b.length;if(length>8192)throw Error('BODY_TOO_LARGE');parts.push(b)}
    return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');
  }
  async function saas(method,endpoint,body){
    if(!apiToken)throw Error('GENYMOTION_ACCOUNT_NOT_CONNECTED');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25000);
    try {
      const result=await fetcher('https://api.geny.io/cloud'+endpoint,{
        method,signal:controller.signal,
        headers:{'x-api-token':apiToken,'accept':'application/json','content-type':'application/json'},
        ...(body===undefined?{}:{body:JSON.stringify(body)})
      });
      const raw=await result.text();
      let data;try{data=raw?JSON.parse(raw):{}}catch{data={message:raw.slice(0,200)}}
      if(!result.ok)throw Error('GENYMOTION_HTTP_'+result.status+':'+String(data.message||data.code||'API_ERROR').slice(0,160));
      return data;
    }finally{clearTimeout(timer)}
  }
  // Enforce the one-shot device lifetime even when the browser is closed.
  async function expire(s){
    if(s?.uuid && now()>=s.expiresAt && s.status!=='stopped'){
      try{await saas('POST','/v1/instances/'+encodeURIComponent(s.uuid)+'/stop-disposable',{})}
      catch(e){console.error('GENYMOTION_EXPIRE_STOP_WARNING',String(e.message).slice(0,180))}
      s.status='stopped';s.stoppedAt=new Date().toISOString();
      await saveState(s);
    }
    return s;
  }
  async function handle(req,res,url){
    const route=url.pathname;
    const method=req.method||'GET';
    try{
      if(method==='GET'&&route==='/lab-api/genymotion/status'){
        const s=await serial(()=>readState().then(expire));
        return answer(res,200,{ok:true,configured:!!apiToken,provider:'Genymotion SaaS',
          status:!apiToken?'account-not-connected':!s||s.status==='stopped'?'idle':s.status,
          instance:s?.uuid&&s.status!=='stopped'?{uuid:s.uuid,name:s.name,recipeUuid:s.recipeUuid,
            startedAt:s.startedAt,expiresAt:new Date(s.expiresAt).toISOString(),
            owned:same(s.owner,cookie(req))}:null});
      }
      if(method==='GET'&&route==='/lab-api/genymotion/recipes'){
        if(!apiToken)return answer(res,200,{ok:true,configured:false,recipes:[],note:'GENYMOTION_ACCOUNT_NOT_CONNECTED'});
        const data=await saas('GET','/v3/recipes/?source=all&page_size=100');
        const list=Array.isArray(data)?data:Array.isArray(data.results)?data.results:Array.isArray(data.recipes)?data.recipes:Array.isArray(data.data)?data.data:[];
        return answer(res,200,{ok:true,configured:true,recipes:list});
      }
      if(method==='GET'&&route==='/lab-api/genymotion/instances'){
        if(!apiToken)return answer(res,200,{ok:true,configured:false,instances:[]});
        const data=await saas('GET','/v2/instances?page_size=100');
        const list=Array.isArray(data)?data:Array.isArray(data.results)?data.results:Array.isArray(data.instances)?data.instances:Array.isArray(data.data)?data.data:[];
        return answer(res,200,{ok:true,configured:true,instances:list});
      }
      if(method==='POST'&&route==='/lab-api/genymotion/start'){
        if(!apiToken)return answer(res,503,{ok:false,error:'GENYMOTION_ACCOUNT_NOT_CONNECTED'});
        if(req.headers.origin!==origin)return answer(res,403,{ok:false,error:'WEB_ORIGIN_REQUIRED'});
        const body=await readBody(req);
        const recipeUuid=String(body.recipeUuid||'');
        if(!uuidPattern.test(recipeUuid))return answer(res,400,{ok:false,error:'VALID_RECIPE_REQUIRED'});
        return await serial(async()=>{
          const existing=await expire(await readState());
          if(existing?.uuid&&existing.status!=='stopped')
            return answer(res,409,{ok:false,error:'ANDROID_SESSION_ALREADY_ACTIVE'});
          const owner=crypto.randomBytes(32).toString('base64url');
          const name='HITEL-SDK-LAB-'+now();
          const start=await saas('POST','/v1/recipes/'+recipeUuid+'/start-disposable',{
            instance_name:name,rename_on_conflict:true,timeouts:{global:13,inactivity:13}
          });
          const uuid=String(start.uuid||start.instance?.uuid||'');
          if(!uuidPattern.test(uuid))return answer(res,502,{ok:false,error:'GENYMOTION_INSTANCE_UUID_MISSING'});
          const s={uuid,recipeUuid,name,owner,status:'starting',
            startedAt:new Date().toISOString(),expiresAt:now()+13*60_000};
          await saveState(s);
          res.setHeader('set-cookie','gm_sdk_owner='+owner+
            '; HttpOnly; Secure; SameSite=Strict; Path=/lab-api/genymotion; Max-Age=900');
          return answer(res,201,{ok:true,status:'starting',instance:{uuid,name}});
        });
      }
      if(method==='POST'&&route==='/lab-api/genymotion/stop'){
        if(req.headers.origin!==origin)return answer(res,403,{ok:false,error:'WEB_ORIGIN_REQUIRED'});
        return await serial(async()=>{
          const s=await readState();
          if(!s?.uuid||s.status==='stopped')return answer(res,200,{ok:true,status:'idle'});
          if(!same(s.owner,cookie(req)))return answer(res,403,{ok:false,error:'NOT_YOUR_SESSION'});
          await saas('POST','/v1/instances/'+encodeURIComponent(s.uuid)+'/stop-disposable',{});
          s.status='stopped';s.stoppedAt=new Date().toISOString();
          await saveState(s);
          return answer(res,200,{ok:true,status:'stopped'});
        });
      }
      if(method==='GET'&&route==='/lab-api/genymotion/player'){
        const s=await serial(()=>readState().then(expire));
        if(!s?.uuid||s.status==='stopped'||!same(s.owner,cookie(req)))
          return answer(res,403,{ok:false,error:'NO_AUTHORIZED_ANDROID_SESSION'});
        const info=await saas('GET','/v1/instances/'+encodeURIComponent(s.uuid));
        const instance=info.instance||info;
        const state=String(instance.state||instance.status||'').toUpperCase();
        if(state!=='ONLINE'&&state!=='RUNNING')return answer(res,202,{ok:true,ready:false,state:state||'STARTING'});
        const access=await saas('POST','/v1/instances/access-token',{instance_uuid:s.uuid});
        const address=instance.webrtcAddress||instance.webrtc_address||instance.webrtc_url||
          instance.connection?.webrtcAddress||instance.network?.webrtcAddress;
        if(!address||!access.access_token)return answer(res,502,{ok:false,error:'GENYMOTION_PLAYER_INFORMATION_MISSING'});
        return answer(res,200,{ok:true,ready:true,uuid:s.uuid,webrtcAddress:address,
          accessToken:access.access_token,expiresAt:new Date(s.expiresAt).toISOString()});
      }
      return answer(res,404,{ok:false,error:'UNKNOWN_GENYMOTION_ENDPOINT'});
    }catch(e){
      const message=String(e.message||e).slice(0,220);
      console.error('GENYMOTION_ADAPTER_ERROR',route,message);
      return answer(res,message==='GENYMOTION_ACCOUNT_NOT_CONNECTED'?503:502,{ok:false,error:message});
    }
  }
  return {http:handle};
}