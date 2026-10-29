// Signed registration and durable desired-state control for a genuine GitHub
// KVM / ws-scrcpy Android 11 runner. The user controls the session with Stop.
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {wsScrcpyHttp,wsScrcpyOnline,wsScrcpyUpgrade as attachWsScrcpyUpgrade} from './ws-scrcpy-relay.mjs';
const ORIGIN='https://hitel-communication-web-production.up.railway.app';
const AUDIENCE='hitel-ws-scrcpy';
const REPO='lyonbegin/hitel-room';
const BRANCH='feature/ws-scrcpy-android11-20261028';
const WORKFLOW='hitel-ws-scrcpy-live.yml';
const JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const STATE_DIR=process.env.RAILWAY_VOLUME_MOUNT_PATH||
 (process.env.RAILWAY_ENVIRONMENT_ID?'/data/hitel-ws-scrcpy':join(process.cwd(),'.local'));
const STATE_FILE=process.env.HITEL_WS_SCRCPY_STATE_FILE||join(STATE_DIR,'ws-scrcpy-session.json');
const dispatchToken=()=>process.env.HITEL_GITHUB_WORKFLOW_TOKEN||'';
let host=null;
let queuedAt=0;
let claimedAt=0;
let desiredRunning=false;
let recoveryInFlight=false;
let lastRecoveryAt=0;
let statePersistenceAvailable=false;
// Actual runner events only, never estimated boot percentages.
const STAGES=new Set(['queued','claimed','kvm','sdk','emulator','booted','scrcpy','tunnel','ready','testing','stopping','stopped','failed']);
let progress={stage:'idle',message:'실행 요청 대기',updatedAt:null,startedAt:null,runId:null,history:[],error:null};
function saveState(){
 try{
  mkdirSync(dirname(STATE_FILE),{recursive:true,mode:0o700});
  const temporary=STATE_FILE+'.tmp';
  writeFileSync(temporary,JSON.stringify({host,queuedAt,claimedAt,desiredRunning,lastRecoveryAt,progress}),{mode:0o600});
  renameSync(temporary,STATE_FILE);
  statePersistenceAvailable=true;
 }catch(error){statePersistenceAvailable=false;console.error('WS_SCRCPY_STATE_SAVE_FAILED',String(error).slice(0,180));}
}
try{
 const saved=JSON.parse(readFileSync(STATE_FILE,'utf8'));
 if(saved&&typeof saved==='object'){
  host=saved.host||null;queuedAt=Number(saved.queuedAt)||0;claimedAt=Number(saved.claimedAt)||0;
  desiredRunning=saved.desiredRunning===true;
  lastRecoveryAt=Number(saved.lastRecoveryAt)||0;
  if(saved.progress&&STAGES.has(saved.progress.stage))progress={...progress,...saved.progress};
 }
}catch{}
if(desiredRunning&&progress.runId){queuedAt=0;claimedAt=0;}
saveState();
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
 saveState();
 return true;
}
function publicProgress(){
 const now=Date.now();
 // Dispatch acceptance is not proof that GitHub assigned a runner.
 if(progress.stage==='queued' && queuedAt && now-queuedAt>=480000){
  queuedAt=0;updateProgress('failed','GitHub 실행기 배정 제한(8분)을 초과했습니다. 다시 실행을 요청해 주십시오.');
 }
 if(!live()&&claimedAt&&now-claimedAt>=480000){
  claimedAt=0;updateProgress('failed','Android 실행기가 8분 안에 준비를 마치지 못했습니다. 자동 복구를 시도합니다.');
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
function live(){return Boolean(host&&wsScrcpyOnline());}
async function dispatchWorkflow(message){
 const token=dispatchToken();
 if(!token)throw Error('GITHUB_WORKFLOW_TOKEN_NOT_CONFIGURED');
 const r=await fetch('https://api.github.com/repos/'+REPO+'/actions/workflows/'+WORKFLOW+'/dispatches',{
  method:'POST',headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json',
   'content-type':'application/json','x-github-api-version':'2022-11-28','user-agent':'hitel-ws-scrcpy-railway'},
  body:JSON.stringify({ref:BRANCH}),signal:AbortSignal.timeout(12000)});
 if(r.status!==204)throw Error('GITHUB_DISPATCH_HTTP_'+r.status);
 queuedAt=Date.now();claimedAt=0;
 progress.runId=null;
 updateProgress('queued',message);
 return queuedAt;
}
async function superviseRunner(){
 if(recoveryInFlight||!desiredRunning||!dispatchToken())return;
 recoveryInFlight=true;
 try{
  if(host&&Date.now()-(host.lastSupervisionProbe||0)>=20000){
   host.lastSupervisionProbe=Date.now();
   host.reachable=wsScrcpyOnline();
   host.failedProbes=host.reachable?0:(Number(host.failedProbes)||0)+1;
   if(host.failedProbes>=3){
    host=null;
    updateProgress('failed','실제 Android 영상 호스트가 응답하지 않아 자동 복구를 시작합니다.');
   }else saveState();
  }
  const runId=progress.runId;
  let runCompleted=false;
  if(runId){
   const r=await fetch('https://api.github.com/repos/'+REPO+'/actions/runs/'+runId,{headers:{
    authorization:'Bearer '+dispatchToken(),accept:'application/vnd.github+json','x-github-api-version':'2022-11-28',
    'user-agent':'hitel-ws-scrcpy-railway'},signal:AbortSignal.timeout(8000)});
   if(r.ok){const run=await r.json();runCompleted=run.status==='completed';}
   else console.error('WS_SCRCPY_RUN_STATUS_HTTP',r.status,runId);
  }
  // Runner milestones can pause while Android images are restored and booted.
  // Do not dispatch a duplicate just because one stage takes longer than 45 seconds.
  if(!live()&&claimedAt&&Date.now()-claimedAt>=480000){
   claimedAt=0;
   updateProgress('failed','Android 실행기가 8분 동안 상태를 갱신하지 않아 자동 복구합니다.');
  }
  if(runCompleted&&claimedAt){claimedAt=0;saveState();}
  const stale=progress.updatedAt?Date.now()-Date.parse(progress.updatedAt)>45000:false;
  const stalled=!host&&!queuedAt&&!claimedAt&&stale&&progress.stage!=='idle';
  if((runCompleted&&!queuedAt&&!claimedAt)||stalled){
   host=null;
   if(Date.now()-lastRecoveryAt>45000){
    lastRecoveryAt=Date.now();saveState();
    await dispatchWorkflow('Android 실행이 중단되어 저장된 이미지를 사용해 자동 복구를 시작합니다.');
   }
  }
 }catch(error){console.error('WS_SCRCPY_AUTO_RECOVERY_FAILED',String(error).slice(0,180));}
 finally{recoveryInFlight=false;}
}
setInterval(()=>void superviseRunner(),20000).unref?.();
async function oidc(req){
 const match=/^Bearer (.+)$/.exec(String(req.headers.authorization||''));
 if(!match)return false;
 const {payload}=await jwtVerify(match[1],JWKS,{issuer:'https://token.actions.githubusercontent.com',
   audience:AUDIENCE,clockTolerance:'10s'});
 const interactive=payload.ref==='refs/heads/'+BRANCH && payload.event_name==='workflow_dispatch' &&
   payload.workflow_ref===REPO+'/.github/workflows/'+WORKFLOW+'@refs/heads/'+BRANCH;
 return payload.repository===REPO && interactive;
}
function canStop(req){
 return req.headers.origin===ORIGIN && 
  /^application\/json(?:;|$)/.test(req.headers['content-type']||'');
}
export async function wsScrcpyRoute(req,res,path){
 if(path==='/ws-scrcpy/proxy'||path.startsWith('/ws-scrcpy/proxy/')){
  if(!['GET','HEAD','POST'].includes(req.method))return json(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  const suffix=path.slice('/ws-scrcpy/proxy'.length)||'/';
  const target=suffix+(new URL(req.url,'http://localhost').search||'');
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>64*1024*1024)return json(res,413,{ok:false,error:'REQUEST_TOO_LARGE'});chunks.push(chunk);}
  try{
   const result=await wsScrcpyHttp(req.method,target,{'content-type':req.headers['content-type']||''},Buffer.concat(chunks));
   res.writeHead(result.status,{...result.headers,'cache-control':'no-store','x-content-type-options':'nosniff'});
   if(req.method==='HEAD')res.end();else res.end(result.body);
  }catch(error){json(res,502,{ok:false,error:String(error.message||error)});}
  return;
 }
 if(path==='/ws-scrcpy/health')return json(res,200,{ok:true,online:live(),engine:'ws-scrcpy',androidVersion:'11',vnc:false});
 if(req.method==='GET'&&path==='/ws-scrcpy/status'){
  const current=publicProgress();
  const dispatchConfigured=Boolean(dispatchToken());
  if(!live())return json(res,200,{ok:true,online:false,engine:'ws-scrcpy',
    // A browser start is only offered when this server can immediately dispatch
    // the workflow. Never present the periodic GitHub queue as a launch path.
    launchAvailable:dispatchConfigured&&statePersistenceAvailable&&!desiredRunning&&!queuedAt&&!claimedAt,
    dispatchConfigured,desiredRunning,statePersisted:statePersistenceAvailable,
    progress:current,
    launchState:claimedAt&&Date.now()-claimedAt<480000?'booting':queuedAt&&Date.now()-queuedAt<480000?'queued':current.stage==='failed'?'failed':desiredRunning?'recovering':'idle',
    reason:current.error|| (host?'expired':'no-running-android11')});
  return json(res,200,{ok:true,online:true,engine:'ws-scrcpy',url:'https://hitel-communication-web-production.up.railway.app/lab-sandbox/ws-scrcpy/proxy/',
    desiredRunning,statePersisted:statePersistenceAvailable,vnc:false,
    launchAvailable:false,launchState:host.stop?'stopping':'ready',progress:publicProgress()});
 }
 if(path==='/ws-scrcpy/start'&&req.method==='POST'){
  if(!canStop(req))return json(res,403,{ok:false,error:'INVALID_ORIGIN'});
  const token=dispatchToken();
  if(!token)return json(res,503,{ok:false,error:'GITHUB_WORKFLOW_DISPATCH_NOT_CONFIGURED',
   message:'Railway에 HITEL_GITHUB_WORKFLOW_TOKEN이 설정되지 않아 즉시 실행할 수 없습니다.'});
  if(!statePersistenceAvailable)return json(res,503,{ok:false,error:'SESSION_STATE_STORAGE_UNAVAILABLE',
   message:'Railway 영구 볼륨에 세션 상태를 저장할 수 없어 안전하게 시작할 수 없습니다.'});
  if(live()||desiredRunning||(claimedAt&&Date.now()-claimedAt<480000)||(queuedAt&&Date.now()-queuedAt<480000))return json(res,409,{ok:false,error:'SESSION_ALREADY_ACTIVE_OR_QUEUED'});
  progress={stage:'idle',message:'',updatedAt:null,startedAt:null,runId:null,history:[],error:null};
  desiredRunning=true;saveState();
  try{
   const requestedAt=await dispatchWorkflow('웹 버튼에서 즉시 실행 요청을 보냈습니다. Android 11이 사용자가 종료할 때까지 유지됩니다.');
   return json(res,202,{ok:true,launchState:'queued',requestedAt,
     message:'GitHub KVM start accepted, not yet Android booted'});
  }catch(e){queuedAt=0;desiredRunning=false;saveState();updateProgress('failed','GitHub 실행 서버에 연결할 수 없습니다.');console.error('WS_SCRCPY_DISPATCH_EXCEPTION',String(e));
   return json(res,502,{ok:false,error:'GITHUB_DISPATCH_NETWORK_ERROR'});
  }
 }
 if(path==='/ws-scrcpy/claim'&&req.method==='POST'){
  try{if(!await oidc(req))return json(res,403,{ok:false,error:'GITHUB_IDENTITY_REJECTED'});}
  catch{return json(res,403,{ok:false,error:'GITHUB_IDENTITY_INVALID'});}
  if(!desiredRunning||live()||(claimedAt&&Date.now()-claimedAt<480000)||!queuedAt||Date.now()-queuedAt>=480000)return json(res,200,{ok:true,claim:false});
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
  if(!live()&&!queuedAt&&!claimedAt&&!desiredRunning){
   if(progress.stage!=='idle')return json(res,409,{ok:false,error:'SESSION_NOT_REQUESTED'});
   // Explicit push smoke tests can register a real runner without a browser start.
   const incoming=await oidc(req);
   if(!incoming)return json(res,403,{ok:false,error:'IDENTITY_INVALID'});
  }
  queuedAt=0;claimedAt=Date.now();
  updateProgress(stage,message,{runId});
  return json(res,200,{ok:true,stage:progress.stage,updatedAt:progress.updatedAt});
 }
 if(path==='/ws-scrcpy/register'&&req.method==='POST'){
  try{if(!await oidc(req))return json(res,403,{ok:false,error:'GITHUB_IDENTITY_REJECTED'});}
  catch{return json(res,403,{ok:false,error:'GITHUB_IDENTITY_INVALID'});}
  let payload='';for await(const p of req){payload+=p;if(payload.length>800)return json(res,413,{ok:false})}
  let data;try{data=JSON.parse(payload)}catch{return json(res,400,{ok:false})}
  if(data.transport!=='railway-websocket')return json(res,400,{ok:false,error:'INVALID_ANDROID_RELAY_TRANSPORT'});
  if(progress.stage==='stopped'||progress.stage==='failed')return json(res,409,{ok:false,error:'SESSION_CANCELLED'});
  const registerRunId=String(req.headers['x-github-run-id']||'');
  if(progress.runId&&registerRunId&&progress.runId!==registerRunId)return json(res,409,{ok:false,error:'RUN_MISMATCH'});
  if(live()&&host.runId!==registerRunId)return json(res,409,{ok:false,error:'ANOTHER_ANDROID11_RUNNING'});
  queuedAt=0;
  claimedAt=Date.now();
  host={transport:'railway-websocket',runId:registerRunId,reachable:false,stop:false,
    ticket:randomBytes(20).toString('hex')};
  saveState();
  updateProgress('tunnel','Android 실행기에서 Railway 역방향 WebSocket 연결을 시작합니다.',{runId:/^[0-9]{1,20}$/.test(registerRunId)?registerRunId:null});
  console.log('HITEL_WS_SCRCPY_RAILWAY_RELAY_REGISTERED',registerRunId);
  return json(res,200,{ok:true,status:'running',ticket:host.ticket});
 }
 if(req.method==='GET'&&path==='/ws-scrcpy/runner-status'){
  if(!host||!equal(req.headers['x-runner-ticket'],host.ticket))
   return json(res,403,{ok:false,error:'RUNNER_TICKET_REQUIRED'});
  return json(res,200,{ok:true,stop:host.stop});
 }
 if(req.method==='POST'&&path==='/ws-scrcpy/stop'){
  if(!canStop(req))return json(res,403,{ok:false,error:'INVALID_ORIGIN'});
  const desiredBeforeStop=desiredRunning;
  desiredRunning=false;
  saveState();
  if(!live()){
   const hadRequest=Boolean(desiredBeforeStop||queuedAt||claimedAt);
   queuedAt=0;claimedAt=0;
   if(hadRequest)updateProgress('stopped','사용자 요청으로 Android 실행 대기를 취소했습니다.');
   return json(res,200,{ok:true,alreadyStopped:!hadRequest,cancelled:hadRequest});
  }
  host.stop=true;
  saveState();
  updateProgress('stopping','Android 종료를 요청했습니다. GitHub 실행기의 정리를 확인하는 중입니다.');
  return json(res,200,{ok:true,status:'stopping'});
 }
 if(req.method==='POST'&&path==='/ws-scrcpy/finish'){
  // The runner may close its WebSocket before its EXIT trap reports completion.
  // The persisted, unguessable ticket authorizes cleanup after transport loss.
  if(!host||!equal(req.headers['x-runner-ticket'],host.ticket))
   return json(res,403,{ok:false,error:'RUNNER_TICKET_REQUIRED'});
  const restart=desiredRunning&&!host.stop&&progress.stage!=='stopping';
  host=null;claimedAt=0;queuedAt=0;
  saveState();
  if(progress.stage!=='failed'){
   if(restart)updateProgress('stopping','Android 실행기 연결이 끝나 저장된 이미지로 복구합니다.');
   else updateProgress('stopped','Android 11 실행기가 종료되었습니다.');
  }
  return json(res,200,{ok:true,status:'deleted'});
 }
 return json(res,404,{ok:false,error:'UNKNOWN_WS_SCRCPY_PATH'});
}
export function wsScrcpyUpgrade(server,origin){
 attachWsScrcpyUpgrade(server,{origin,allowedTicket:value=>Boolean(host&&equal(value,host.ticket))});
}
