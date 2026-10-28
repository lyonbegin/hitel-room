// Ephemeral signed registration of a genuine Github KVM / ws-scrcpy Android11.
// No always-on Android VM, X11 screen capture, VNC or WebSocket video relay.
// The web runtime only stores a 10-minute URL to the genuine host.
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
const ORIGIN='https://hitel-communication-web-production.up.railway.app';
const AUDIENCE='hitel-ws-scrcpy';
const REPO='lyonbegin/hitel-room';
const BRANCH='feature/ws-scrcpy-android11-20261028';
const WORKFLOW='hitel-ws-scrcpy-live.yml';
const JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const TTL=600_000;
let host=null;
const json=(res,code,obj)=>{
 res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
 res.end(JSON.stringify(obj));
};
const equal=(a,b)=>{
 const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
 return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);
};
function approved(hostUrl){
 try{
  const u=new URL(hostUrl);
  return u.protocol==='https:' && /^[a-z0-9-]+\.trycloudflare\.com$/.test(u.hostname)
   && (u.pathname==='/'||u.pathname==='')&&!u.search&&!u.hash;
 }catch{return false}
}
async function isValid(hostUrl){
 try{
  const response=await fetch(hostUrl+'/__hitel_ws_scrcpy',{signal:AbortSignal.timeout(5000)});
  if(!response.ok)return false;
  const j=await response.json();
  return j.ok===true && j.engine==='ws-scrcpy'&&j.androidVersion==='11'&&j.vnc===false;
 }catch{return false}
}
function live(){return host&&Date.now()<host.deadline;}
async function oidc(req){
 const match=/^Bearer (.+)$/.exec(String(req.headers.authorization||''));
 if(!match)return false;
 const {payload}=await jwtVerify(match[1],JWKS,{issuer:'https://token.actions.githubusercontent.com',
   audience:AUDIENCE,clockTolerance:'10s'});
 return payload.repository===REPO&&payload.ref==='refs/heads/'+BRANCH&&
   payload.event_name==='push'&&
   payload.workflow_ref===REPO+'/.github/workflows/'+WORKFLOW+'@refs/heads/'+BRANCH;
}
function canStop(req){
 return req.headers.origin===ORIGIN && 
  /^application\/json(?:;|$)/.test(req.headers['content-type']||'');
}
export async function wsScrcpyRoute(req,res,path){
 if(req.method==='GET'&&path==='/ws-scrcpy/status'){
  if(!live())return json(res,200,{ok:true,online:false,engine:'ws-scrcpy',
    reason:host?'expired':'no-running-android11'});
  if(Date.now()-host.lastProbe>5000){
   host.lastProbe=Date.now();
   host.reachable=await isValid(host.url);
  }
  return json(res,200,{ok:true,online:host.reachable,engine:'ws-scrcpy',url:host.reachable?host.url:null,
    remainingSeconds:Math.max(0,Math.ceil((host.deadline-Date.now())/1000)),vnc:false});
 }
 if(path==='/ws-scrcpy/register'&&req.method==='POST'){
  try{if(!await oidc(req))return json(res,403,{ok:false,error:'GITHUB_IDENTITY_REJECTED'});}
  catch{return json(res,403,{ok:false,error:'GITHUB_IDENTITY_INVALID'});}
  let payload='';for await(const p of req){payload+=p;if(payload.length>800)return json(res,413,{ok:false})}
  let data;try{data=JSON.parse(payload)}catch{return json(res,400,{ok:false})}
  const url=String(data.url||'').replace(/\/$/,'');
  if(!approved(url)||!(await isValid(url)))return json(res,400,{ok:false,error:'INVALID_WS_SCRCPY_REAL_HOST'});
  if(live())return json(res,409,{ok:false,error:'ANOTHER_ANDROID11_RUNNING'});
  host={url,deadline:Date.now()+TTL,lastProbe:Date.now(),reachable:true,stop:false,
    ticket:randomBytes(20).toString('hex')};
  console.log('HITEL_WS_SCRCPY_KVM_REGISTERED',url);
  return json(res,200,{ok:true,status:'running',ticket:host.ticket,deadline:host.deadline});
 }
 if(req.method==='GET'&&path==='/ws-scrcpy/runner-status'){
  if(!live()||!equal(req.headers['x-runner-ticket'],host.ticket))
   return json(res,403,{ok:false,error:'RUNNER_TICKET_REQUIRED'});
  return json(res,200,{ok:true,stop:host.stop,remainingSeconds:Math.ceil((host.deadline-Date.now())/1000)});
 }
 if(req.method==='POST'&&path==='/ws-scrcpy/stop'){
  if(!canStop(req))return json(res,403,{ok:false,error:'INVALID_ORIGIN'});
  if(!live())return json(res,200,{ok:true,alreadyStopped:true});
  host.stop=true;
  return json(res,200,{ok:true,status:'stopping'});
 }
 if(req.method==='POST'&&path==='/ws-scrcpy/finish'){
  if(!live()||!equal(req.headers['x-runner-ticket'],host.ticket))
   return json(res,403,{ok:false,error:'RUNNER_TICKET_REQUIRED'});
  host=null;return json(res,200,{ok:true,status:'deleted'});
 }
 return json(res,404,{ok:false,error:'UNKNOWN_WS_SCRCPY_PATH'});
}
