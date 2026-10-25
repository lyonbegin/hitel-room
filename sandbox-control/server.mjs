import http from 'node:http';
import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {Sandbox} from 'railway';

/**
 * HITEL Android control plane, colocated with the existing HITEL web container.
 * There is NO separate always-on relay and NO GitHub Actions or Cloudflare path.
 * IMPORTANT: expiry is measured from the launch request, not from Android boot.
 *
 * The launch API stays closed until the Railway workspace credential and an
 * Android 11 checkpoint are actually present. We do not simulate a device.
 */
const PORT = Number(process.env.SANDBOX_CONTROL_PORT || 8099);
const TTL_MS = 600_000;
const CHECKPOINT = process.env.HITEL_ANDROID_CHECKPOINT || 'hitel-android11-ready';
const SELF_EXPIRE_URL = process.env.HITEL_SANDBOX_SELF_EXPIRE_URL ||
  'http://hitel-communication-web.railway.internal:8080/lab-sandbox/internal-expire';
const apiToken = process.env.RAILWAY_API_TOKEN || '';
const environmentId = process.env.RAILWAY_ENVIRONMENT_ID || '';
const armed = process.env.HITEL_ANDROID_SANDBOX_ENABLED === '1';
const configured = Boolean(apiToken && environmentId);
const origin = process.env.HITEL_WEB_ORIGIN ||
  'https://hitel-communication-web-production.up.railway.app';

let active = null;
let creating = false;
let latest = {status:'idle', reason:null, lastDestroyedAt:null};
let checkpointCache = {expires:0,ready:false};
let busyCleanup = false;
let lastError = null;

// HTML browsers are not trusted to enforce time limits. No client-side timer
// grants extra runtime, and request body never controls Sandbox creation args.
function requireBrowserOrigin(req) {
  const sent = req.headers.origin;
  return sent === origin && req.headers['content-type']?.startsWith('application/json');
}
function json(res, code, body){
  res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff'});
  res.end(JSON.stringify(body));
}
function signature(id,expiresAt) {
  return createHmac('sha256',apiToken).update('hitel-android-expire:'+id+':'+expiresAt).digest('hex');
}
function sigMatches(a,b) {
  if (!/^[0-9a-f]{64}$/.test(String(a)))return false;
  return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
async function readyCheckpoint(force=false){
  if(!configured)return false;
  if(!force && checkpointCache.expires>Date.now())return checkpointCache.ready;
  const rows=await Sandbox.checkpoints();
  checkpointCache={ready:rows.some(x=>x.key===CHECKPOINT),expires:Date.now()+30_000};
  return checkpointCache.ready;
}
async function destroy(id,reason){
  if(busyCleanup)return false;
  busyCleanup=true;
  try{
    const sb=await Sandbox.connect(id);
    await sb.destroy();
    if(active?.id===id)active=null;
    latest={status:'deleted',reason,lastDestroyedAt:new Date().toISOString()};
    lastError=null;
    return true;
  }catch(err){
    // If the VM has already disappeared, no further compute can accrue.
    if(err?.name==='SandboxNotFoundError' || /not found|DESTROYED/i.test(String(err))){
      if(active?.id===id)active=null;
      latest={status:'deleted',reason,lastDestroyedAt:new Date().toISOString()};
      return true;
    }
    lastError='SANDBOX_DELETE_FAILED';
    console.error('HITEL_ANDROID_SANDBOX_DESTROY_FAILED',id,err);
    return false;
  }finally{busyCleanup=false;}
}
async function inventory(){
  // Fail closed on a restart. Never start a second billable VM if any sandbox
  // already exists in this environment; importantly, NEVER delete other VMs.
  const all=await Sandbox.list();
  return all.filter(s=>['CREATING','RUNNING','DESTROYING'].includes(s.status));
}
async function start(){
  if(!configured) return {code:503,body:{ok:false,error:'RAILWAY_API_TOKEN_NOT_CONFIGURED'}};
  if(!armed) return {code:503,body:{ok:false,error:'SANDBOX_LAUNCH_NOT_ENABLED'}};
  if(creating||active) return {code:409,body:{ok:false,error:'ANDROID_SESSION_ALREADY_ACTIVE'}};
  creating=true;
  let sandbox=null;
  try{
    if(!await readyCheckpoint(true))
      return {code:412,body:{ok:false,error:'ANDROID_CHECKPOINT_NOT_PREPARED',checkpoint:CHECKPOINT}};
    if((await inventory()).length)
      return {code:409,body:{ok:false,error:'RAILWAY_SANDBOX_ALREADY_RUNNING',message:'한 환경에서 중복 비용 발생을 차단했습니다.'}};
    const expiresAt=Date.now()+TTL_MS;
    // Pro default: 8vCPU/8GB. Explicit 4vCPU/6GB reduces per-test resource use.
    sandbox=await Sandbox.create(CHECKPOINT,{
      networkIsolation:'PRIVATE',domains:[{port:6080}],
      idleTimeoutMinutes:1,resources:{cpu:4,memoryGB:6},
      env:{HITEL_EXPIRES_AT:String(expiresAt)}
    });
    active={id:sandbox.id,expiresAt,startedAt:expiresAt-TTL_MS,status:'starting',
      viewerUrl:null,runId:randomBytes(12).toString('hex')};
    // Second watchdog runs INSIDE the VM, so closing the browser does nothing
    // to the expiry. It sends a narrowly scoped deletion capability, never a
    // Railway API credential; the control server performs Sandbox.destroy().
    const script=String.raw`const deadline=Number(process.env.HITEL_EXPIRES_AT);
const target=process.env.HITEL_SELF_EXPIRE_URL;
const token=process.env.HITEL_SELF_EXPIRE_SIG;
const id=process.env.HITEL_SELF_EXPIRE_ID;
if(!Number.isFinite(deadline)||!target||!token||!id)process.exit(1);
await new Promise(resolve=>setTimeout(resolve,Math.max(0,deadline-Date.now())));
for(let n=0;n<20;n++){
 try{
  const res=await fetch(target,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id,expiresAt:deadline,signature:token}),signal:AbortSignal.timeout(4000)});
  if(res.ok)process.exit(0);
 }catch{}
 await new Promise(r=>setTimeout(r,3000));
}
process.exit(2);
`;
    await sandbox.files.write('/opt/hitel/self-expire.mjs',script);
    const sig=signature(sandbox.id,expiresAt);
    const schedule=await sandbox.exec('sh -c "nohup node /opt/hitel/self-expire.mjs >/tmp/hitel-expire.log 2>&1 </dev/null &"',
      {timeoutSec:10,env:{HITEL_SELF_EXPIRE_URL:SELF_EXPIRE_URL,
        HITEL_SELF_EXPIRE_SIG:sig,HITEL_SELF_EXPIRE_ID:sandbox.id}});
    if(schedule.exitCode!==0)throw Error('SANDBOX_VM_WATCHDOG_NOT_STARTED');
    // Never advertise Google Android 11 as running without actual KVM access.
    const probe=await sandbox.exec('sh -c "test -c /dev/kvm && test -r /dev/kvm && test -w /dev/kvm && test -x /opt/hitel/start-android.sh"',
      {timeoutSec:10});
    if(probe.exitCode!==0)throw Error('KVM_OR_ANDROID_CHECKPOINT_UNAVAILABLE');
    if(Date.now()>=expiresAt)throw Error('ANDROID_START_TIMEOUT');
    const launch=await sandbox.exec(
      'sh -c "nohup /opt/hitel/start-android.sh >/tmp/hitel-android.log 2>&1 </dev/null &"',
      {timeoutSec:15});
    if(launch.exitCode!==0)throw Error('ANDROID_LAUNCH_COMMAND_FAILED');
    const domain=sandbox.domains?.find(d=>d.port===6080)?.domain;
    // A Railway-hosted HTTPS route, not a temporary Cloudflare tunnel.
    active.viewerUrl=domain?'https://'+domain+'/vnc.html?autoconnect=true&resize=scale':null;
    active.status='running';
    return {code:202,body:{ok:true,...publicStatus()}};
  }catch(err){
    console.error('HITEL_ANDROID_SANDBOX_START_FAILED',err);
    lastError=String(err.message||err).slice(0,180);
    if(sandbox)await destroy(sandbox.id,'startup-failure');
    return {code:503,body:{ok:false,error:lastError}};
  }finally{creating=false;}
}
function publicStatus(){
  return {status:active?.status||(creating?'starting':latest.status),
    sandboxId:active?.id||null,
    expiresAt:active?new Date(active.expiresAt).toISOString():null,
    remainingSeconds:active?Math.max(0,Math.ceil((active.expiresAt-Date.now())/1000)):0,
    viewerUrl:active?.viewerUrl||null,checkpoint:CHECKPOINT,
    lastDestroyedAt:latest.lastDestroyedAt,
    lastError};
}
async function handle(req,res){
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&path==='/health')return json(res,200,{ok:true,service:'hitel-web-sandbox-control'});
  if(req.method==='GET'&&path==='/status'){
    if(!configured)return json(res,200,{ok:true,available:false,reason:'RAILWAY_API_TOKEN_NOT_CONFIGURED',...publicStatus()});
    let ready=false,checkError=null;
    try{ready=await readyCheckpoint()}catch(err){checkError=String(err.message||err).slice(0,140);}
    return json(res,200,{ok:true,available:armed&&ready,
      reason:!armed?'SANDBOX_LAUNCH_NOT_ENABLED':checkError?'RAILWAY_API_UNAVAILABLE':
        ready?null:'ANDROID_CHECKPOINT_NOT_PREPARED',
      ...publicStatus()});
  }
  if(req.method==='POST'&&path==='/internal-expire'){
    // VM-internal expiration works even if the web server was redeployed.
    // The capability is bound to one Sandbox ID and one non-extendable expiry.
    let body='';
    for await(const chunk of req){body+=chunk;if(body.length>1024)return json(res,413,{ok:false});}
    let x;try{x=JSON.parse(body)}catch{return json(res,400,{ok:false});}
    const deadline=Number(x.expiresAt),id=String(x.id||'');
    if(!configured||!/^sbx_[a-zA-Z0-9_-]+$/.test(id)||!Number.isSafeInteger(deadline)||
      !sigMatches(x.signature,signature(id,deadline))||Date.now()<deadline)
      return json(res,403,{ok:false});
    const ok=await destroy(id,'vm-expiration');
    return json(res,ok?200:503,{ok});
  }
  if(req.method==='POST'&&(path==='/start'||path==='/stop')){
    // No credential or billing authority is ever passed to browser JS.
    if(!requireBrowserOrigin(req))return json(res,403,{ok:false,error:'INVALID_SITE_ORIGIN'});
    if(path==='/start'){
      const result=await start();return json(res,result.code,result.body);
    }
    if(!active)return json(res,200,{ok:true,status:'idle'});
    const id=active.id;
    active.status='stopping';
    const ok=await destroy(id,'manual-stop');
    return json(res,ok?200:503,{ok,...publicStatus()});
  }
  return json(res,404,{ok:false,error:'NOT_FOUND'});
}
const server=http.createServer((req,res)=>{
  Promise.resolve(handle(req,res)).catch(err=>{
    console.error('HITEL_ANDROID_SANDBOX_API_ERROR',err);
    if(!res.headersSent)json(res,500,{ok:false,error:'SANDBOX_CONTROL_FAILED'});
    else res.end();
  });
});
server.listen(PORT,'0.0.0.0',()=>console.log('HITEL_ANDROID_SANDBOX_CONTROL_READY',PORT));
// In-process watchdog independent of browser tab and user clicks. The VM runs
// its own watchdog and Railway additionally enforces 1 minute of idleness.
setInterval(async()=>{
  if(!active||busyCleanup)return;
  if(Date.now()>=active.expiresAt){await destroy(active.id,'server-deadline');return;}
  try{const sb=await Sandbox.connect(active.id);await sb.heartbeat();}
  catch(err){console.error('HITEL_SANDBOX_HEARTBEAT_FAILED',String(err));}
},15_000).unref();
