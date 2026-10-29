import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const workflow = 'ios-live-simulator.yml';
const githubRef = 'main';
const STORE = process.env.HITEL_IOS_STATE_FILE || '/data/hitel-ws-scrcpy/ios-live-state.json';
const origin = process.env.HITEL_WEB_ORIGIN || 'https://hitel-communication-web-production.up.railway.app';
const jwks = createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const jwts = new Map();
const viewers = new Set();
const wss = new WebSocketServer({noServer:true,maxPayload:2_000_000});
let runner = null;
let frame = null;
let lastFrameAt = 0;
let pending = null;
let state = {phase:'idle',runId:null,updatedAt:null,stopped:true,detail:null,lastDispatchAt:0,lastLiveAt:0,retiredRunIds:[]};
try {
  const saved=JSON.parse(await fs.readFile(STORE,'utf8'));
  if (saved?.phase && typeof saved.stopped==='boolean')
    state={...state,...saved,phase:saved.stopped?'idle':'reconnecting'};
} catch {}
function send(res,code,data) {
  res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(data));
}
async function persist() {
  try {
    await fs.mkdir(STORE.slice(0,STORE.lastIndexOf('/')),{recursive:true});
    await fs.writeFile(STORE,JSON.stringify(state),{mode:0o600});
  } catch(e) { console.error('IOS_STATE_PERSIST_FAILED',String(e)); }
}
function notify() {
  const payload=JSON.stringify({type:'status',...publicStatus()});
  for(const client of viewers) if(client.readyState===WebSocket.OPEN)client.send(payload);
}
function setState(next) {
  state={...state,...next,updatedAt:new Date().toISOString()};
  void persist();notify();
}
function publicStatus() {
  const connected=runner?.readyState===WebSocket.OPEN;
  const fresh=connected && Date.now()-lastFrameAt<6000;
  return {ok:true,phase:connected?(fresh?'streaming':state.phase):state.stopped?'idle':state.phase==='streaming'?'reconnecting':state.phase,
    online:Boolean(connected),videoLive:Boolean(fresh),lastFrameAt:fresh?new Date(lastFrameAt).toISOString():null,
    runId:state.runId,updatedAt:state.updatedAt,stopped:state.stopped,detail:state.detail,
    capabilities:{touch:connected,swipe:connected,text:connected,appInstall:connected},
    screen:{width:402,height:874,device:'iPhone 16 Pro'}};
}
function allowBrowser(req) {
  return req.headers.origin===origin && req.headers['content-type']?.startsWith('application/json');
}
async function body(req) {
  let buffer='',len=0;
  for await(const piece of req) {
    len+=piece.length;if(len>8_192)throw Error('PAYLOAD_TOO_LARGE');
    buffer+=piece.toString('utf8');
  }
  return JSON.parse(buffer||'{}');
}
async function verifyRunner(req) {
  const token=(String(req.headers.authorization||'').match(/^Bearer (.+)$/)||[])[1];
  if(!token)throw Error('OIDC_REQUIRED');
  const {payload}=await jwtVerify(token,jwks,{
    issuer:'https://token.actions.githubusercontent.com',
    audience:'hitel-ios-live',
    algorithms:['RS256']
  });
  if(payload.repository!=='lyonbegin/hitel-room' ||
     payload.ref!=='refs/heads/main' ||
     !String(payload.workflow_ref||'').includes('/.github/workflows/'+workflow+'@refs/heads/main'))
    throw Error('UNTRUSTED_RUNNER');
  return payload;
}
async function dispatch() {
  const token=process.env.HITEL_GITHUB_WORKFLOW_TOKEN;
  if(!token)throw Error('GITHUB_WORKFLOW_TOKEN_UNAVAILABLE');
  const resp=await fetch('https://api.github.com/repos/lyonbegin/hitel-room/actions/workflows/'+workflow+'/dispatches',{
    method:'POST',
    headers:{accept:'application/vnd.github+json',authorization:'Bearer '+token,
      'content-type':'application/json','x-github-api-version':'2022-11-28',
      'user-agent':'hitel-ios-device-lab'},
    body:JSON.stringify({ref:githubRef})
  });
  if(resp.status!==204)throw Error('GITHUB_DISPATCH_HTTP_'+resp.status);
}
async function handle(req,res,path) {
  if(req.method==='GET'&&path==='/ios/status') return send(res,200,publicStatus());
  if(req.method==='POST'&&path==='/ios/start') {
    if(!allowBrowser(req))return send(res,403,{ok:false,error:'INVALID_ORIGIN'});
    if(!state.stopped && ['queued','booting','ready','streaming','reconnecting'].includes(state.phase))
      return send(res,200,publicStatus());
    setState({phase:'queued',stopped:false,runId:null,lastDispatchAt:Date.now(),lastLiveAt:0,retiredRunIds:[],detail:'GitHub macOS 실행기 요청'});
    try {await dispatch();return send(res,202,publicStatus());}
    catch(e) {setState({phase:'failed',stopped:true,detail:String(e.message||e)});return send(res,503,{ok:false,error:String(e.message||e)});}
  }
  if(req.method==='POST'&&path==='/ios/stop') {
    if(!allowBrowser(req))return send(res,403,{ok:false,error:'INVALID_ORIGIN'});
    setState({phase:'stopping',stopped:true,detail:'사용자 종료 요청'});
    if(runner?.readyState===WebSocket.OPEN)runner.send(JSON.stringify({type:'stop'}));
    else setState({phase:'idle'});
    return send(res,200,publicStatus());
  }
  if(req.method==='POST'&&path==='/ios/runner-ticket') {
    let identity;
    try{identity=await verifyRunner(req);}
    catch(e){return send(res,403,{ok:false,error:'UNTRUSTED_RUNNER'});}
    if(state.stopped)return send(res,409,{ok:false,error:'SESSION_STOPPED'});
    const runId=String(identity.run_id||'');
    if(state.retiredRunIds?.includes(runId))return send(res,409,{ok:false,error:'RETIRED_RUN'});
    if(state.runId && state.runId!==runId)return send(res,409,{ok:false,error:'OTHER_RUN_ACTIVE'});
    const ticket=crypto.randomBytes(32).toString('hex');
    jwts.set(ticket,{runId,until:Date.now()+90_000});
    setState({phase:'booting',runId,detail:'iPhone Simulator 준비'});
    return send(res,201,{ok:true,ticket,runId});
  }
  return send(res,404,{ok:false,error:'IOS_ROUTE_NOT_FOUND'});
}
function upgrade(req,socket,head) {
  const url=new URL(req.url||'/','http://localhost');
  if(url.pathname!=='/ios/socket')return false;
  const role=url.searchParams.get('role');
  if(role==='viewer' && req.headers.origin!==origin) {socket.destroy();return true;}
  if(role==='runner') {
    const ticket=url.searchParams.get('ticket');
    const allowed=jwts.get(ticket);
    if(!allowed || allowed.until<Date.now() || state.stopped || state.runId!==allowed.runId) {
      socket.destroy();return true;
    }
    jwts.delete(ticket);
  } else if(role!=='viewer'){socket.destroy();return true;}
  wss.handleUpgrade(req,socket,head,ws=>{
    if(role==='runner') {
      if(runner?.readyState===WebSocket.OPEN)runner.close(4001,'Replaced by same-run runner');
      runner=ws;
      setState({phase:'ready',detail:'원본 iPhone 시뮬레이터 영상 연결 대기'});
      ws.on('message',(data,binary)=>{
        if(runner!==ws)return;
        if(binary) {
          if(data.length<100||data.length>1_500_000||data[0]!==0xff||data[1]!==0xd8)return;
          frame=Buffer.from(data);
          lastFrameAt=Date.now();
          if(state.phase!=='streaming')setState({phase:'streaming',lastLiveAt:Date.now(),detail:'원본 iPhone 실시간 영상'});
          for(const v of viewers)if(v.readyState===WebSocket.OPEN&&v.bufferedAmount<2_000_000)v.send(frame,{binary:true});
        } else {
          let msg;try{msg=JSON.parse(String(data));}catch{return;}
          if(msg.type==='status'&&typeof msg.phase==='string')setState({phase:msg.phase,detail:String(msg.detail||'').slice(0,200)});
          if(msg.type==='result') {
            const data=JSON.stringify({type:'result',id:msg.id,ok:msg.ok===true,
              message:String(msg.message||'').slice(0,300)});
            for(const v of viewers)if(v.readyState===WebSocket.OPEN)v.send(data);
          }
        }
      });
      ws.on('close',()=>{
        if(runner===ws){runner=null;frame=null;lastFrameAt=0;
          setState({phase:state.stopped?'idle':'reconnecting',detail:state.stopped?'종료됨':'macOS 실행기 재연결 대기'});}
      });
    } else {
      viewers.add(ws);
      ws.send(JSON.stringify({type:'status',...publicStatus()}));
      if(frame&&Date.now()-lastFrameAt<6000)ws.send(frame,{binary:true});
      ws.on('message',(raw,binary)=>{
        if(binary||raw.length>2048||!runner||runner.readyState!==WebSocket.OPEN||state.stopped)return;
        let cmd;try{cmd=JSON.parse(String(raw));}catch{return;}
        if(cmd.type!=='command'||!['home','rotate','install','launch','tap','swipe','text','safari'].includes(cmd.action))return;
        const data=cmd.data||{};
        if(typeof data!=='object'||Array.isArray(data))return;
        const values=['x','y','x2','y2'];
        if(values.some(k=>data[k]!==undefined&&(!Number.isFinite(data[k])||data[k]<0||data[k]>900)))return;
        if(data.text!==undefined&&(typeof data.text!=='string'||data.text.length>300))return;
        runner.send(JSON.stringify({type:'command',id:String(cmd.id||'').slice(0,64),action:cmd.action,data}));
      });
      ws.on('close',()=>viewers.delete(ws));
    }
    notify();
  });
  return true;
}
let repairing=false;
// GitHub hosted macOS jobs expire. Replace ONLY a previously working, user-started
// session after a disconnected run; a boot failure never causes a billing loop.
setInterval(async()=>{
  if(repairing||state.stopped||runner?.readyState===WebSocket.OPEN||!state.lastLiveAt)return;
  if(Date.now()-Date.parse(state.updatedAt||0)<75_000)return;
  if(Date.now()-Number(state.lastDispatchAt||0)<5*60*60*1000)return;
  repairing=true;
  const previous=state.runId;
  setState({phase:'queued',runId:null,lastDispatchAt:Date.now(),
    retiredRunIds:[...(state.retiredRunIds||[]),...(previous?[previous]:[])].slice(-20),
    detail:'GitHub 실행 시간 종료 · 새 macOS 실행기로 복구'});
  try{await dispatch();}
  catch(e){setState({phase:'reconnecting',detail:'자동 복구 요청 실패: '+String(e.message||e).slice(0,110)});}
  finally{repairing=false;}
},60_000).unref();
export function createIosLive() {return {handle,upgrade,publicStatus};}
