import {randomBytes,timingSafeEqual} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
const ORIGIN=process.env.HITEL_WEB_ORIGIN||'https://hitel-communication-web-production.up.railway.app';
const REPO='lyonbegin/hitel-room',WORKFLOW='hitel-android11-live.yml';
const REF='feature/railway-android-sandbox-10min-20261025';
const DISPATCH_TOKEN=process.env.HITEL_GITHUB_WORKFLOW_TOKEN||'';
const TTL=600000;
const wss=new WebSocketServer({noServer:true,maxPayload:8*1024*1024});
let active=null,lastEnd=null,lastReason=null,dispatching=false;
const equal=(a,b)=>{
 const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
 return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);
};
const ownerCookie=req=>/(?:^|;\s*)hitel_kvm_owner=([^;]+)/.exec(req.headers.cookie||'')?.[1]||'';
const isOwner=req=>Boolean(active&&equal(ownerCookie(req),active.owner));
const fromPage=req=>req.headers.origin===ORIGIN&&/^application\/json(?:;|$)/.test(req.headers['content-type']||'');
const send=(res,code,obj,extra={})=>{
 res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra});
 res.end(JSON.stringify(obj));
};
const close=ws=>{if(ws&&ws.readyState===WebSocket.OPEN)try{ws.close()}catch{}};
function end(reason){
 const s=active;if(!s)return;
 active=null;
 for(const ws of [s.runner,s.viewer,s.stream])close(ws);
 lastEnd=new Date().toISOString();lastReason=reason;
 console.log('HITEL_KVM_SESSION_ENDED',s.id,reason);
}
function stop(reason){
 if(!active)return;
 active.status='stopping';active.stopReason=reason;
 if(active.runner?.readyState===WebSocket.OPEN)active.runner.send(JSON.stringify({type:'stop',reason}));
}
function status(req){
 const mine=isOwner(req),s=active;
 return {ok:true,available:Boolean(DISPATCH_TOKEN),host:'github-actions-kvm',
   status:s?(mine?s.status:'occupied'):(lastEnd?'deleted':'idle'),
   reason:DISPATCH_TOKEN?null:'KVM_DISPATCH_NOT_CONFIGURED',
   sessionId:mine?s.id:null,
   viewerUrl:mine&&s.status==='running'?'/lab-kvm/novnc/phone.html?sid='+s.id:null,
   remainingSeconds:mine?Math.max(0,Math.ceil((s.deadline-Date.now())/1000)):0,
   lastDestroyedAt:lastEnd,lastReason};
}
async function githubDispatch(s){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch('https://api.github.com/repos/'+REPO+'/actions/workflows/'+WORKFLOW+'/dispatches',{
   method:'POST',headers:{accept:'application/vnd.github+json',authorization:'Bearer '+DISPATCH_TOKEN,
   'x-github-api-version':'2022-11-28','content-type':'application/json'},
   body:JSON.stringify({ref:REF,inputs:{
     session_id:s.id,runner_token:s.runnerTicket,expires_at:String(s.deadline)
   }}),signal:controller.signal});
  if(r.status!==204)throw Error('GITHUB_DISPATCH_HTTP_'+r.status);
 }finally{clearTimeout(timer)}
}
async function route(req,res){
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/kvm/health'&&req.method==='GET')
   return send(res,200,{ok:true,service:'hitel-kvm-control'});
 if(path==='/kvm/status'&&req.method==='GET')return send(res,200,status(req));
 if(path==='/kvm/start'&&req.method==='POST'){
   if(!fromPage(req))return send(res,403,{ok:false,error:'SITE_ORIGIN_REQUIRED'});
   if(!DISPATCH_TOKEN)return send(res,503,{ok:false,error:'KVM_DISPATCH_NOT_CONFIGURED'});
   if(dispatching||active)return send(res,409,{ok:false,error:'SESSION_ALREADY_ACTIVE'});
   dispatching=true;
   const s={
    id:randomBytes(16).toString('hex'),owner:randomBytes(24).toString('hex'),
    runnerTicket:randomBytes(32).toString('hex'),
    status:'starting',deadline:Date.now()+TTL,runner:null,viewer:null,stream:null,stopReason:null
   };
   active=s;
   try{
    await githubDispatch(s);
    return send(res,202,status({headers:{cookie:'hitel_kvm_owner='+s.owner}}),
     {'set-cookie':'hitel_kvm_owner='+s.owner+'; Path=/lab-kvm/; HttpOnly; Secure; SameSite=Strict; Max-Age=600'});
   }catch(error){
    end('dispatch-failed');
    return send(res,503,{ok:false,error:String(error.message||error)});
   }finally{dispatching=false}
 }
 if(path==='/kvm/stop'&&req.method==='POST'){
   if(!fromPage(req))return send(res,403,{ok:false,error:'SITE_ORIGIN_REQUIRED'});
   if(!isOwner(req))return send(res,403,{ok:false,error:'SESSION_NOT_OWNED'});
   stop('manual-stop');
   return send(res,202,status(req));
 }
 return send(res,404,{ok:false,error:'NOT_FOUND'});
}
function upgrade(req,socket,head){
 const url=new URL(req.url,'http://localhost'),path=url.pathname,s=active;
 if(!s||Date.now()>=s.deadline||!equal(url.searchParams.get('sid'),s.id)){socket.destroy();return}
 const runner=path==='/kvm/runner'||path==='/kvm/stream';
 if(runner&&!equal(url.searchParams.get('ticket'),s.runnerTicket)){socket.destroy();return}
 if(!runner&&(path!=='/kvm/viewer'||req.headers.origin!==ORIGIN||!isOwner(req))){socket.destroy();return}
 wss.handleUpgrade(req,socket,head,ws=>{
  if(path==='/kvm/runner'){
   close(s.runner);s.runner=ws;
   ws.on('message',(raw,binary)=>{
    if(binary||active!==s)return;
    let m;try{m=JSON.parse(String(raw))}catch{return}
    if(m.type==='ready'){
     if(s.stopReason){ws.send(JSON.stringify({type:'stop',reason:s.stopReason}));return}
     s.status='running';s.runId=String(m.runId||'').slice(0,30);
     if(s.viewer?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'viewer.open'}));
     console.log('HITEL_KVM_RUNNER_READY',s.id,s.runId);
    }
    if(m.type==='done')end(String(m.reason||'runner-exited').slice(0,100));
   });
   ws.on('close',()=>{if(active===s&&s.runner===ws){s.runner=null;if(s.status!=='starting')end('runner-disconnected')}});
   return;
  }
  if(path==='/kvm/viewer'){
   close(s.viewer);close(s.stream);s.viewer=ws;s.stream=null;
   ws.on('message',(payload,binary)=>{
    if(binary&&s.stream?.readyState===WebSocket.OPEN)s.stream.send(payload,{binary:true});
   });
   ws.on('close',()=>{
    if(s.viewer===ws){
     s.viewer=null;close(s.stream);s.stream=null;
     if(s.runner?.readyState===WebSocket.OPEN)s.runner.send(JSON.stringify({type:'viewer.close'}));
    }
   });
   if(s.runner?.readyState===WebSocket.OPEN&&s.status==='running')s.runner.send(JSON.stringify({type:'viewer.open'}));
   return;
  }
  if(path==='/kvm/stream'){
   if(!s.viewer||s.viewer.readyState!==WebSocket.OPEN){close(ws);return}
   close(s.stream);s.stream=ws;
   ws.on('message',(payload,binary)=>{
    if(binary&&s.viewer?.readyState===WebSocket.OPEN)s.viewer.send(payload,{binary:true});
   });
   ws.on('close',()=>{if(s.stream===ws){s.stream=null;close(s.viewer)}});
   return;
  }
  close(ws);
 });
}
setInterval(()=>{
 if(!active)return;
 if(Date.now()>=active.deadline){
  if(active.status!=='stopping')stop('ten-minute-expiry');
  if(Date.now()>active.deadline+25000)end('time-limit-reached');
 }
},1000).unref();
export const kvm={route,upgrade};
