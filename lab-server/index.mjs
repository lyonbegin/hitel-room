import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const PORT = Number(process.env.PORT || 8080);
const STORE = process.env.LAB_DATA_DIR || '/tmp/hitel-device-lab';
const ORIGIN = process.env.LAB_ALLOWED_ORIGIN || 'https://hitel-communication-web-production.up.railway.app';
const SIDES = new Set(['android', 'ios']);
const tickets = new Map();
const connections = new Map();
const windows = new Map();
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
  if(payload.repository!=='lyonbegin/hitel-room' ||
     payload.ref!=='refs/heads/feature/communication-sdk' ||
     !String(payload.workflow_ref||'').includes('/.github/workflows/mobile-emulator.yml@')){
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
    capture:!!report,runId:report?.runId||null,ciPass:report?.passed??null};
}
function notifyDevices(){
  for(const [side,ws] of connections){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'ack',side,time:Date.now()}))}
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/', 'http://localhost');
  const route=url.pathname;
  try {
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
        const png=await fs.readFile(path.join(STORE,side+'.png'));
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
      return json(res,201,{ok:true,ticket,controller,expiresInSeconds:1800,side});
    }
    if(req.method==='POST'&&route==='/lab-api/ci/session'){
      const payload=await verifyOIDC(req);
      const body=await readBody(req,2048);
      if(!SIDES.has(body.side))return error(res,400,'Invalid device');
      cleanExpired();
      const ticket=ticketString();
      tickets.set(ticket,{controller:null,side:body.side,expires:Date.now()+15*60_000,runId:String(payload.run_id||'')});
      return json(res,201,{ok:true,ticket,expiresInSeconds:900});
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
      await saveReport(body.side,info,png);
      return json(res,201,{ok:true,side:body.side,runId});
    }
    if(req.method==='POST'&&route==='/lab-api/command'){
      const controller=(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1];
      const body=await readBody(req,2048);
      cleanExpired();
      const ticket=[...tickets.values()].find(v=>v.controller&&v.controller===controller&&v.expires>Date.now()&&(v.side===body.device||v.side==='both'));
      if(!ticket)return error(res,401,'Pairing control token required');
      if(!SIDES.has(body.device)||!['home','back','reload','ping','launch'].includes(body.action))
        return error(res,400,'Invalid device/action');
      const ws=connections.get(body.device);
      if(!ws||ws.readyState!==WebSocket.OPEN)return error(res,409,'Real native device is offline');
      ws.send(JSON.stringify({type:'command',action:body.action,requestId:ticketString()}));
      return json(res,202,{ok:true,status:'sent-to-native-app'});
    }
    return error(res,404,'Not found');
  }catch(err){
    console.error('DEVICE_LAB_ERROR',err.message);
    if(!res.headersSent)error(res,/OIDC|Untrusted workflow|signature|JWT|audience/.test(err.message)?401:400,err.message);
  }
});
const wss=new WebSocketServer({noServer:true,maxPayload:128*1024});
server.on('upgrade',(req,socket,head)=>{
  try{
    const url=new URL(req.url||'/', 'http://localhost');
    if(url.pathname!=='/lab-api/ws'||url.searchParams.get('role')!=='device')throw Error('Invalid WebSocket path');
    const ticket=url.searchParams.get('ticket'),side=url.searchParams.get('side');
    cleanExpired();
    const paired=tickets.get(ticket);
    if(!paired||!SIDES.has(side)||(paired.side!==side&&paired.side!=='both'))throw Error('Unpaired device');
    wss.handleUpgrade(req,socket,head,ws=>{
      ws.labSide=side;connections.get(side)?.close(4001,'Replaced by new connection');
      connections.set(side,ws);
      ws.send(JSON.stringify({type:'connected',side,authenticated:true,at:Date.now()}));
      notifyDevices();
      wss.emit('connection',ws,req);
    });
  }catch{socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');socket.destroy()}
});
wss.on('connection',ws=>{
  const side=ws.labSide;
  ws.on('message',raw=>{
    try{
      const message=JSON.parse(String(raw));
      if(message.type==='event'||message.type==='hello'){
        console.log('LAB_NATIVE',side,String(message.name||message.type).slice(0,80),String(message.value||'').slice(0,100));
      }
    }catch{/* invalid telemetry ignored */}
  });
  ws.on('close',()=>{if(connections.get(side)===ws)connections.delete(side)});
});
server.listen(PORT,'0.0.0.0',()=>console.log('HITEL_DEVICE_LAB_RELAY_READY',PORT));
