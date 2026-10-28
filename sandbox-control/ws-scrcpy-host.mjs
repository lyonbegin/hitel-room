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
const SCHEDULE_WORKFLOW='hitel-ws-scrcpy-queue.yml';
const JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const TTL=600_000;
const DISPATCH_TOKEN=process.env.HITEL_GITHUB_WORKFLOW_TOKEN||'';
let host=null;
let queuedAt=0;
let claimedAt=0;
// Actual runner events only, never estimated boot percentages.
const STAGES=new Set(['queued','claimed','kvm','sdk','emulator','booted','scrcpy','tunnel','ready','testing','stopping','stopped','failed']);
let progress={stage:'idle',message:'실행 요청 대기',updatedAt:null,startedAt:null,runId:null,history:[],error:null};
function updateProgress(stage,message='',extra={}){
 if(!STAGES.has(stage))return false;
 const now=Date.now();
 const value=String(message||'').replace(/[\\r\\n]/g,' ').slice(0,220);
 const changed=stage!==progress.stage;
 if(changed)progress.history=[...progress.history,{stage,time:new Date(now).toISOString(),message:value}].slice(-18);
 progress.stage=stage;progress.message=value||stage;progress.updatedAt=new Date(now).toISOString();
 if(!progress.startedAt)progress.startedAt=now;
 if(extra.runId)progress.runId=extra.runId;
 if(stage==='failed')progress.error=value||'RUNNER_FAILED';
 else if(stage==='queued')progress.error=null;
 return true;
}
function publicProgress(){
 const now=Date.now();
 if(host&&now>=host.deadline&&!['failed','stopped'].includes(progress.stage)){
  updateProgress('stopped','Android 사용 가능 시간이 만료되어 실행이 종료되었습니다.');
 }
 // A scheduled worker can be delayed, and a build may fail before sending a stage update.
 if(progress.stage==='queued' && queuedAt && now-queuedAt>=480000){
  queuedAt=0;updateProgress('failed','예약 실행 확인 제한(8분)을 초과했습니다. 다시 실행을 요청해 주십시오.');
 }
 if(!live()&&claimedAt&&now-claimedAt>=600000){
  claimedAt=0;updateProgress('failed','Android 실행 확인 제한(10분)을 초과했습니다. 실행 로그를 확인해 주십시오.');
 }
 return {
  stage:progress.stage,message:progress.message,updatedAt:progress.updatedAt,
  startedAt:progress.startedAt?new Date(progress.startedAt).toISOString():null,
  elapsedSeconds:progress.startedAt?Math.floor((now-progress.startedAt)/1000):0,
  runId:progress.runId,runUrl:progress.runId?'https://github.com/'+REPO+'/actions/runs/'+progress.runId:null,
  history:progress.history,error:progress.error,
  pollingSeconds:4,
  queued:progress.stage==='queued',receivedFromRunner:progress.history.some(x=>x.stage==='claimed'||x.stage==='kvm')
 };
}
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
 const interactive=payload.ref==='refs/heads/'+BRANCH && payload.event_name==='workflow_dispatch' &&
   payload.workflow_ref===REPO+'/.github/workflows/'+WORKFLOW+'@refs/heads/'+BRANCH;
 const scheduled=payload.ref==='refs/heads/main' && ['schedule','push'].includes(payload.event_name) &&
   payload.workflow_ref===REPO+'/.github/workflows/'+SCHEDULE_WORKFLOW+'@refs/heads/main';
 return payload.repository===REPO && (interactive||scheduled);
}
function canStop(req){
 return req.headers.origin===ORIGIN && 
  /^application\/json(?:;|$)/.test(req.headers['content-type']||'');
}
export async function wsScrcpyRoute(req,res,path){
 if(req.method==='GET'&&path==='/ws-scrcpy/status'){
  const current=publicProgress();
  if(!live())return json(res,200,{ok:true,online:false,engine:'ws-scrcpy',
    launchAvailable:true,progress:current,
    launchState:claimedAt&&Date.now()-claimedAt<600000?'booting':queuedAt&&Date.now()-queuedAt<480000?'queued':current.stage==='failed'?'failed':'idle',
    reason:current.error|| (host?'expired':'no-running-android11')});
  if(Date.now()-host.lastProbe>5000){
   host.lastProbe=Date.now();
   host.reachable=await isValid(host.url);
  }
  return json(res,200,{ok:true,online:host.reachable,engine:'ws-scrcpy',url:host.reachable?host.url:null,
    remainingSeconds:Math.max(0,Math.ceil((host.deadline-Date.now())/1000)),vnc:false,
    launchAvailable:false,launchState:host.stop?'stopping':'ready',progress:publicProgress()});
 }
 if(path==='/ws-scrcpy/start'&&req.method==='POST'){
  if(!canStop(req))return json(res,403,{ok:false,error:'INVALID_ORIGIN'});
  if(live()||(claimedAt&&Date.now()-claimedAt<600000)||(queuedAt&&Date.now()-queuedAt<480000))return json(res,409,{ok:false,error:'SESSION_ALREADY_ACTIVE_OR_QUEUED'});
  queuedAt=Date.now();
  claimedAt=0;
  progress={stage:'idle',message:'',updatedAt:null,startedAt:null,runId:null,history:[],error:null};
  updateProgress('queued','GitHub 예약 실행기의 작업 수락을 기다리는 중입니다. 예약 실행은 약 5분 간격이며 지연될 수 있습니다.');
  if(!DISPATCH_TOKEN)return json(res,202,{ok:true,launchState:'queued',requestedAt:queuedAt,mode:'scheduled-kvm-poll',message:'GitHub KVM scheduled worker will collect this request'});
  try{
   const r=await fetch('https://api.github.com/repos/'+REPO+'/actions/workflows/'+WORKFLOW+'/dispatches',{
    method:'POST',headers:{
     authorization:'Bearer '+DISPATCH_TOKEN,accept:'application/vnd.github+json',
     'content-type':'application/json','x-github-api-version':'2022-11-28',
     'user-agent':'hitel-ws-scrcpy-railway'
    },
    body:JSON.stringify({ref:BRANCH}),signal:AbortSignal.timeout(12000)
   });
   if(r.status!==204){
    const body=await r.text();queuedAt=0;
    updateProgress('failed','GitHub 워크플로 실행 요청이 거절되었습니다 (HTTP '+r.status+').');
    console.error('WS_SCRCPY_DISPATCH_FAILURE',r.status,body.slice(0,250));
    return json(res,502,{ok:false,error:'GITHUB_DISPATCH_FAILED',status:r.status});
   }
   return json(res,202,{ok:true,launchState:'queued',requestedAt:queuedAt,
     message:'GitHub KVM start accepted, not yet Android booted'});
  }catch(e){queuedAt=0;updateProgress('failed','GitHub 실행 서버에 연결할 수 없습니다.');console.error('WS_SCRCPY_DISPATCH_EXCEPTION',String(e));
   return json(res,502,{ok:false,error:'GITHUB_DISPATCH_NETWORK_ERROR'});
  }
 }
 if(path==='/ws-scrcpy/claim'&&req.method==='POST'){
  try{if(!await oidc(req))return json(res,403,{ok:false,error:'GITHUB_IDENTITY_REJECTED'});}
  catch{return json(res,403,{ok:false,error:'GITHUB_IDENTITY_INVALID'});}
  if(live()||(claimedAt&&Date.now()-claimedAt<600000)||!queuedAt||Date.now()-queuedAt>=480000)return json(res,200,{ok:true,claim:false});
  queuedAt=0;
  claimedAt=Date.now();
  const runId=/^[0-9]{1,20}$/.test(String(req.headers['x-github-run-id']||''))?String(req.headers['x-github-run-id']):null;
  updateProgress('claimed','GitHub 실행기가 요청을 수락했습니다.',{runId});
  return json(res,200,{ok:true,claim:true,runId});
 }
 if(path==='/ws-scrcpy/progress'&&req.method==='POST'){
  try{if(!await oidc(req))return json(res,403,{ok:false,error:'GITHUB_IDENTITY_REJECTED'});}
  catch{return json(res,403,{ok:false,error:'GITHUB_IDENTITY_INVALID'});}
  let body='';for await(const chunk of req){body+=chunk;if(body.length>1200)return json(res,413,{ok:false})}
  let data;try{data=JSON.parse(body)}catch{return json(res,400,{ok:false,error:'INVALID_JSON'})}
  const stage=String(data.stage||''),message=String(data.message||'');
  if(!STAGES.has(stage))return json(res,400,{ok:false,error:'UNKNOWN_STAGE'});
  const runId=String(req.headers['x-github-run-id']||'');
  if(!/^[0-9]{1,20}$/.test(runId))return json(res,400,{ok:false,error:'RUN_ID_REQUIRED'});
  // A late, previous runner must never overwrite a new session or a cancelled queue.
  if(progress.runId&&progress.runId!==runId)return json(res,409,{ok:false,error:'ANOTHER_RUN_IN_PROGRESS'});
  if(['stopped','failed'].includes(progress.stage))return json(res,409,{ok:false,error:'SESSION_ALREADY_TERMINATED'});
  if(!live()&&!queuedAt&&!claimedAt){
   if(progress.stage!=='idle')return json(res,409,{ok:false,error:'SESSION_NOT_REQUESTED'});
   // Explicit push smoke tests can register a real runner without a browser start.
   const incoming=await oidc(req);
   if(!incoming)return json(res,403,{ok:false,error:'IDENTITY_INVALID'});
  }
  updateProgress(stage,message,{runId});
  return json(res,200,{ok:true,stage:progress.stage,updatedAt:progress.updatedAt});
 }
 if(path==='/ws-scrcpy/register'&&req.method==='POST'){
  try{if(!await oidc(req))return json(res,403,{ok:false,error:'GITHUB_IDENTITY_REJECTED'});}
  catch{return json(res,403,{ok:false,error:'GITHUB_IDENTITY_INVALID'});}
  let payload='';for await(const p of req){payload+=p;if(payload.length>800)return json(res,413,{ok:false})}
  let data;try{data=JSON.parse(payload)}catch{return json(res,400,{ok:false})}
  const url=String(data.url||'').replace(/\/$/,'');
  if(!approved(url)||!(await isValid(url)))return json(res,400,{ok:false,error:'INVALID_WS_SCRCPY_REAL_HOST'});
  if(live())return json(res,409,{ok:false,error:'ANOTHER_ANDROID11_RUNNING'});
  if(progress.stage==='stopped'||progress.stage==='failed')return json(res,409,{ok:false,error:'SESSION_CANCELLED'});
  const registerRunId=String(req.headers['x-github-run-id']||'');
  if(progress.runId&&registerRunId&&progress.runId!==registerRunId)return json(res,409,{ok:false,error:'RUN_MISMATCH'});
  queuedAt=0;
  claimedAt=0;
  host={url,deadline:Date.now()+TTL,lastProbe:Date.now(),reachable:true,stop:false,
    ticket:randomBytes(20).toString('hex')};
  updateProgress('ready','Android 11 영상 주소가 발급되었으며 실제 화면 연결이 준비되었습니다.',{runId:/^[0-9]{1,20}$/.test(registerRunId)?registerRunId:null});
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
  if(!live()){
   const hadRequest=Boolean(queuedAt||claimedAt);
   queuedAt=0;claimedAt=0;
   if(hadRequest)updateProgress('stopped','사용자 요청으로 Android 실행 대기를 취소했습니다.');
   return json(res,200,{ok:true,alreadyStopped:!hadRequest,cancelled:hadRequest});
  }
  host.stop=true;
  updateProgress('stopping','Android 종료를 요청했습니다. GitHub 실행기의 정리를 확인하는 중입니다.');
  return json(res,200,{ok:true,status:'stopping'});
 }
 if(req.method==='POST'&&path==='/ws-scrcpy/finish'){
  if(!live()||!equal(req.headers['x-runner-ticket'],host.ticket))
   return json(res,403,{ok:false,error:'RUNNER_TICKET_REQUIRED'});
  host=null;claimedAt=0;queuedAt=0;
  if(progress.stage!=='failed')updateProgress('stopped','Android 11 실행기가 종료되었습니다.');
  return json(res,200,{ok:true,status:'deleted'});
 }
 return json(res,404,{ok:false,error:'UNKNOWN_WS_SCRCPY_PATH'});
}
