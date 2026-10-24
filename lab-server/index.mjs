import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createCommunicationService } from './communication.mjs';
import { createApkManager } from './apk-manager.mjs';
import { createAndroidOriginalAdapter } from './android-original-adapter.mjs';

const PORT = Number(process.env.PORT || 8080);
const STORE = process.env.LAB_DATA_DIR || '/tmp/hitel-device-lab';
const ORIGIN = process.env.LAB_ALLOWED_ORIGIN || 'https://hitel-communication-web-production.up.railway.app';
const SIDES = new Set(['android', 'ios']);
const tickets = new Map();
const ticketFile = path.join(STORE,'pairing-tickets.json');
await fs.mkdir(STORE,{recursive:true});
try {
  for(const [key,value] of JSON.parse(await fs.readFile(ticketFile,'utf8'))){
    if(value.expires>Date.now())tickets.set(key,value);
  }
  console.log('LAB_RESTORED_ACTIVE_PAIRS',tickets.size);
}catch{/* first boot: no existing pair file */}
const tokenDir=path.join(STORE,'pairs');
await fs.mkdir(tokenDir,{recursive:true});
const tokenPath=(key)=>path.join(tokenDir,crypto.createHash('sha256').update(key).digest('hex')+'.json');
async function persistPair(key) {
  await fs.writeFile(tokenPath(key),JSON.stringify([key,tickets.get(key)]));
}
async function findPair(key) {
  if(!key)return null;
  const cache=tickets.get(key);
  if(cache&&cache.expires>Date.now())return cache;
  try {
    const [stored,detail]=JSON.parse(await fs.readFile(tokenPath(key),'utf8'));
    if(stored===key&&detail.expires>Date.now()){tickets.set(key,detail);return detail}
  }catch{/* invalid or unknown pairing */}
  return null;
}
async function findController(controller,side){
  const existing=[...tickets.values()].find(v=>v.controller===controller&&v.expires>Date.now()&&(v.side===side||v.side==='both'));
  if(existing)return existing;
  try{
    for(const file of await fs.readdir(tokenDir)){
      if(!file.endsWith('.json'))continue;
      const [key,value]=JSON.parse(await fs.readFile(path.join(tokenDir,file),'utf8'));
      if(value.controller===controller&&value.expires>Date.now()&&(value.side===side||value.side==='both')){
        tickets.set(key,value);return value;
      }
    }
  }catch{/* no known controller */}
  return null;
}
const connections = new Map(); // last active device per platform, for dashboard
const pairedConnections = new Map(); // controller+platform, for isolated commands
const liveFrames = new Map();
const windows = new Map();
const pendingCommands = new Map();
const jwks = createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));

function json(res,code,obj){
  res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(obj));
}
function error(res,code,message){json(res,code,{ok:false,error:message})}
function ticketString(){return crypto.randomBytes(24).toString('base64url')}
function cleanExpired(){for(const [k,v] of tickets)if(Date.now()>v.expires)tickets.delete(k)}
function readBody(req,max=5_200_000){
  return new Promise((resolve,reject)=>{
    let length=0,buffers=[];
    req.on('data',chunk=>{length+=chunk.length;if(length>max){reject(new Error('Payload too large'));req.destroy()}else buffers.push(chunk)});
    req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(buffers).toString('utf8')))}catch{reject(new Error('Invalid JSON'))}});
    req.on('error',reject);
  });
}
async function verifyOIDC(req){
  const token=(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1];
  if(!token)throw Error('GitHub Actions OIDC token required');
  const {payload}=await jwtVerify(token,jwks,{
    issuer:'https://token.actions.githubusercontent.com',
    audience:'hitel-device-lab',
    algorithms:['RS256']
  });
  const workflowRef=String(payload.workflow_ref||'');
  const featureRunner=payload.ref==='refs/heads/feature/communication-sdk'&&[
    '/.github/workflows/mobile-emulator.yml@',
    '/.github/workflows/android-interactive-session.yml@'
  ].some(name=>workflowRef.includes(name));
  const scheduledRunner=payload.ref==='refs/heads/main'&&
    workflowRef.includes('/.github/workflows/android-web-session-runner.yml@refs/heads/main');
  if(payload.repository!=='lyonbegin/hitel-room'||(!featureRunner&&!scheduledRunner)){
    throw Error('Untrusted workflow identity');
  }
  return payload;
}
async function loadReport(side){
  try{return JSON.parse(await fs.readFile(path.join(STORE,side+'.json'),'utf8'))}
  catch{return null}
}
async function saveReport(side,info,png){
  await fs.mkdir(STORE,{recursive:true});
  const name=side+'.png',tmp=name+'.'+crypto.randomBytes(4).toString('hex')+'.tmp';
  await fs.writeFile(path.join(STORE,tmp),png);
  await fs.rename(path.join(STORE,tmp),path.join(STORE,name));
  await fs.writeFile(path.join(STORE,side+'.json'),JSON.stringify(info));
}
function deviceState(side,report){
  const current=connections.get(side);
  return {online:!!current&&current.readyState===WebSocket.OPEN,
    lastSeen:report?.updatedAt||null,
    app:report?.app||'HITEL Native',
    bridge:report?.bridge||'GitHub Actions 대기',
    sdk:report?.sdk||null,
    note:current?'에뮬레이터 네트워크 접속 중':report?'마지막 GitHub Actions 스크린샷 저장됨':'연결된 에뮬레이터 없음',
    capture:!!report||!!liveFrames.get(side),screenMode:current&&liveFrames.get(side)?'live':'github-actions',runId:report?.runId||null,ciPass:report?.passed??null};
}
function notifyDevices(){
  for(const ws of pairedConnections.values())if(ws.readyState===WebSocket.OPEN)
    ws.send(JSON.stringify({type:'ack',side:ws.labSide,time:Date.now()}));
}
const communication=createCommunicationService({storageDir:path.join(STORE,'communication-sessions')});
const apkManager=createApkManager({
  root:path.join(STORE,'apk-manager'),
  verifyCI:verifyOIDC,
});
// Compatibility API for the unchanged upstream Android Emulator Platform UI.
const androidOriginal=createAndroidOriginalAdapter({root:path.join(STORE,'apk-manager')});
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/', 'http://localhost');
  const route=url.pathname;
  try {
    if(route.startsWith('/comm-api/'))return await communication.http(req,res,route);
    if(route.startsWith('/lab-api/apk/'))return await apkManager.http(req,res,url);
    if(route.startsWith('/api/emulator/')||route.startsWith('/api/upload/'))
      return await androidOriginal.http(req,res,url);
    if(route==='/healthz'||route==='/lab-api/health'){
      return json(res,200,{ok:true,service:'device-relay'});
    }
    if(req.method==='GET'&&route==='/lab-api/status'){
      const android=await loadReport('android'),ios=await loadReport('ios');
      return json(res,200,{ok:true,mode:'network+github-actions',
        devices:{android:deviceState('android',android),ios:deviceState('ios',ios)},
        ci:{android,ios}});
    }
    if(req.method==='GET'&&route.startsWith('/lab-api/frame/')){
      const side=route.split('/').at(-1);
      if(!SIDES.has(side))return error(res,404,'Invalid device');
      try{
        const current=connections.get(side);
        const controller=(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1];
        const liveAllowed=current?.labOrigin==='ci'||(current?.labController&&controller===current.labController);
        const recent=liveAllowed?liveFrames.get(side):null;
        const png=recent&&Date.now()-recent.time<20_000?recent.png:await fs.readFile(path.join(STORE,side+'.png'));
        res.writeHead(200,{'content-type':'image/png','cache-control':'no-store','content-length':png.length});
        return res.end(png);
      }catch{return error(res,404,'No GitHub Actions capture uploaded')}
    }
    if(req.method==='POST'&&route==='/lab-api/pair'){
      const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0];
      const prev=windows.get(ip)||{since:Date.now(),count:0};
      if(Date.now()-prev.since>60_000){prev.since=Date.now();prev.count=0}
      prev.count++;windows.set(ip,prev);
      if(prev.count>10)return error(res,429,'Pairing rate limit exceeded');
      const body=await readBody(req,2048);
      const side=['android','ios','both'].includes(body.side)?body.side:'both';
      cleanExpired();
      const ticket=ticketString(),controller=ticketString();
      tickets.set(ticket,{controller,side,expires:Date.now()+30*60_000,origin:'dashboard'});
      await persistPair(ticket);
      return json(res,201,{ok:true,ticket,controller,expiresInSeconds:1800,side});
    }
    if(req.method==='POST'&&route==='/lab-api/ci/session'){
      const payload=await verifyOIDC(req);
      const body=await readBody(req,2048);
      if(!SIDES.has(body.side))return error(res,400,'Invalid device');
      cleanExpired();
      const ticket=ticketString(),controller=ticketString();
      tickets.set(ticket,{controller,side:body.side,origin:'ci',expires:Date.now()+15*60_000,runId:String(payload.run_id||'')});
      await persistPair(ticket);
      return json(res,201,{ok:true,ticket,controller,expiresInSeconds:900});
    }
    if(req.method==='POST'&&route==='/lab-api/ci/upload'){
      const payload=await verifyOIDC(req);
      const body=await readBody(req);
      if(!SIDES.has(body.side))return error(res,400,'Invalid device');
      const png=Buffer.from(String(body.png||''),'base64');
      if(png.length<100||png.length>4_000_000||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
        return error(res,400,'Invalid PNG capture');
      const runId=String(payload.run_id||body.runId||'');
      const passed=body.passed===true;
      const info={
        side:body.side,runId,sha:String(payload.sha||body.sha||'').slice(0,40),
        passed,updatedAt:new Date().toISOString(),app:'HITEL Native',
        bridge:passed?'Native Bridge CI 검사 성공':'CI 검사 결과 확인 필요',
        log:String(body.log||'').slice(-12000),
        url:'https://github.com/lyonbegin/hitel-room/actions/runs/'+encodeURIComponent(runId)
      };
      const previous=await loadReport(body.side);
      if(previous?.runId&&Number(previous.runId)>Number(runId))
        return json(res,200,{ok:true,side:body.side,ignoredOlderRun:true,runId:previous.runId});
      await saveReport(body.side,info,png);
      return json(res,201,{ok:true,side:body.side,runId});
    }
    if(req.method==='POST'&&route==='/lab-api/command'){
      const controller=(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1];
      const body=await readBody(req,2048);
      cleanExpired();
      const ticket=await findController(controller,body.device);
      if(!ticket)return error(res,401,'Pairing control token required');
      if(!SIDES.has(body.device)||!['home','back','reload','ping','launch','navigate','getCapabilities','tts.speak','tts.stop','call.openDialer','communication.action',
        'app.accessibility.status','app.accessibility.settings','app.list','app.open',
        'app.screen','app.tap','app.type','app.scroll','app.back','web.open'].includes(body.action))
        return error(res,400,'Invalid device/action');
      const ws=pairedConnections.get(controller+':'+body.device);
      if(!ws||ws.readyState!==WebSocket.OPEN)return error(res,409,'Paired native device is offline');
      const screen=['sdk','ai','call','media'].includes(body.screen)?body.screen:'home';
      const requestId=ticketString();
      pendingCommands.set(requestId,{side:body.device,controller,expires:Date.now()+15_000,result:null});
      ws.send(JSON.stringify({type:'command',action:body.action,screen,data:body.data||{},requestId}));
      return json(res,202,{ok:true,status:'sent-to-native-app',requestId});
    }
    if(req.method==='GET'&&route.startsWith('/lab-api/result/')){
      const controller=(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1];
      const requestId=route.split('/').at(-1);
      const cmd=pendingCommands.get(requestId);
      if(!cmd||cmd.expires<Date.now()||cmd.controller!==controller)return error(res,404,'No authorized pending command');
      if(!cmd.result)return json(res,202,{ok:true,status:'pending'});
      pendingCommands.delete(requestId);
      return json(res,200,cmd.result);
    }
    return error(res,404,'Not found');
  }catch(err){
    console.error('DEVICE_LAB_ERROR',err.message);
    if(!res.headersSent)error(res,/OIDC|Untrusted workflow|signature|JWT|audience/.test(err.message)?401:400,err.message);
  }
});
const wss=new WebSocketServer({noServer:true,maxPayload:4*1024*1024});
server.on('upgrade',async(req,socket,head)=>{
  try{
    const url=new URL(req.url||'/', 'http://localhost');
    if(url.pathname==='/comm-api/ws')return communication.upgrade(req,socket,head);
    if(url.pathname!=='/lab-api/ws'||url.searchParams.get('role')!=='device')throw Error('Invalid WebSocket path');
    const ticket=url.searchParams.get('ticket'),side=url.searchParams.get('side');
    cleanExpired();
    const paired=await findPair(ticket);
    if(!paired||!SIDES.has(side)||(paired.side!==side&&paired.side!=='both'))throw Error('Unpaired device');
    wss.handleUpgrade(req,socket,head,ws=>{
      ws.labSide=side;
      ws.labOrigin=paired.origin||'dashboard';
      ws.labController=paired.controller;
      const key=paired.controller+':'+side;
      pairedConnections.get(key)?.close(4001,'Same paired device reconnected');
      pairedConnections.set(key,ws);
      // A second Android/iOS test runner must not disconnect another
      // authenticated session simply because it uses the same OS.
      connections.set(side,ws);
      ws.send(JSON.stringify({type:'connected',side,authenticated:true,at:Date.now()}));
      notifyDevices();
      wss.emit('connection',ws,req);
    });
  }catch(err){console.error('LAB_WS_AUTH_REJECT',String(err.message),req.url?.split('?')[0]);socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');socket.destroy()}
});
wss.on('connection',ws=>{
  const side=ws.labSide;
  ws.on('message',raw=>{
    try{
      const message=JSON.parse(String(raw));
      if(message.type==='frame'&&typeof message.png==='string'){
        const png=Buffer.from(message.png,'base64');
        if(png.length>100&&png.length<=3_000_000&&png.subarray(0,8).toString('hex')==='89504e470d0a1a0a'){
          liveFrames.set(side,{png,time:Date.now()});
        }
      }
      if(message.type==='result'&&typeof message.requestId==='string'){
        const pending=pendingCommands.get(message.requestId);
        if(pending&&pending.side===side&&pending.expires>Date.now()){
          // Explicitly carry bounded structured native automation output back
          // to the authenticated paired controller; do not log screen text.
          const resultJson=(message.result&&typeof message.result==='object'&&!Array.isArray(message.result))
            ?JSON.stringify(message.result):null;
          pending.result={requestId:message.requestId,platform:side,
            ok:message.ok===true,capabilities:message.capabilities,
            error:message.error,scope:message.scope,
            result:resultJson&&resultJson.length<=32_768?message.result:undefined};
        }
      }
      if(message.type==='event'||message.type==='hello'){
        console.log('LAB_NATIVE',side,String(message.name||message.type).slice(0,80),String(message.value||'').slice(0,100));
      }
    }catch{/* invalid telemetry ignored */}
  });
  ws.on('close',()=>{
    const key=ws.labController+':'+side;
    if(pairedConnections.get(key)===ws)pairedConnections.delete(key);
    if(connections.get(side)===ws){
      const replacement=[...pairedConnections.values()].reverse().find(candidate=>candidate.labSide===side&&candidate.readyState===WebSocket.OPEN);
      if(replacement)connections.set(side,replacement);
      else {connections.delete(side);liveFrames.delete(side)}
    }
  });
});
server.listen(PORT,'0.0.0.0',()=>console.log('HITEL_DEVICE_LAB_RELAY_READY',PORT));
