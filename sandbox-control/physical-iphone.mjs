// Physical iPhone ReplayKit broadcast receiver, separate from macOS iOS simulator.
// Only genuine JPEG frames from a paired iOS broadcast extension are forwarded.
import {randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {WebSocket,WebSocketServer} from 'ws';
const origin=process.env.HITEL_WEB_ORIGIN||'https://hitel-communication-web-production.up.railway.app';
const store=process.env.HITEL_PHYSICAL_IOS_STATE_FILE||join(process.env.RAILWAY_VOLUME_MOUNT_PATH||'/data/hitel-ws-scrcpy','physical-iphone.json');
const sessions=new Map();
const wss=new WebSocketServer({noServer:true,maxPayload:900000,perMessageDeflate:false});
const randomToken=()=>randomBytes(32).toString('hex');
const makeCode=()=>String(randomInt(0,100000000)).padStart(8,'0');
// Railway is behind a reverse proxy. The browser must approve every guest
// broadcast before any video bytes are forwarded, so IP is only a discovery
// hint, never the authorization credential.
function sourceIp(req){
 const f=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
 return f||String(req.socket.remoteAddress||'');
}

const eq=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return !!x.length&&x.length===y.length&&timingSafeEqual(x,y)};
const reply=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
function save(){
 try{
  mkdirSync(dirname(store),{recursive:true,mode:0o700});
  const temp=store+'.tmp';
  writeFileSync(temp,JSON.stringify([...sessions.values()].map(s=>({
   token:s.token,key:s.key,code:s.code,expiry:s.expiry,info:s.info
  }))),{mode:0o600});renameSync(temp,store);
 }catch(e){console.error('PHYSICAL_IPHONE_SAVE_FAILED',String(e).slice(0,120))}
}
try{
 const raw=JSON.parse(readFileSync(store,'utf8'));
 if(Array.isArray(raw))for(const x of raw.slice(0,8))
  if(/^[a-f0-9]{64}$/.test(x.token||''))sessions.set(x.token,{...x,device:null,viewers:new Set(),lastFrameAt:null,lastFrameMillis:0});
}catch{}
const getToken=t=>/^[a-f0-9]{64}$/.test(t||'')?[...sessions.values()].find(s=>eq(s.token,t)):null;
function newCode(){
 let pin;do{pin=makeCode()}while([...sessions.values()].some(s=>s.code===pin&&s.expiry>Date.now()));
 return pin;
}
function status(s){
 return {ok:true,online:s.device?.readyState===WebSocket.OPEN,
  paired:Boolean(s.key),pairCode:s.key?null:s.code,
  pairExpiresAt:s.key?null:new Date(s.expiry).toISOString(),
  deviceInfo:s.info||null,lastFrameAt:s.lastFrameAt,
  appPrepared:!!(s.prepared&&s.prepared.expires>Date.now()),
  approvalPending:!!(s.candidate&&s.candidate.readyState===WebSocket.OPEN)};
}
function signal(s){
 const msg=JSON.stringify({type:'status',...status(s)});
 for(const w of s.viewers)if(w.readyState===WebSocket.OPEN)w.send(msg);
}
async function body(req){
 let raw='';for await(const part of req){raw+=part;if(raw.length>2048)throw Error('TOO_LARGE')}
 return JSON.parse(raw||'{}');
}
export async function physicalIphoneRoute(req,res,path){
 if(path==='/physical-iphone/health'&&req.method==='GET')
  return reply(res,200,{ok:true,service:'physical-iphone-replaykit',sessions:sessions.size});
 if(!['/physical-iphone/session','/physical-iphone/status','/physical-iphone/stop','/physical-iphone/prepare','/physical-iphone/approve','/physical-iphone/reject'].includes(path)||req.method!=='POST')
  return reply(res,404,{ok:false,error:'ROUTE_NOT_FOUND'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))
  return reply(res,403,{ok:false,error:'INVALID_CONTENT_TYPE'});
 // Native iPhone has no browser Origin; authenticate its prepare action by
 // the one-time 8-digit pairing code. All viewer actions still check Origin.
 if(path!=='/physical-iphone/prepare'&&req.headers.origin!==origin)
  return reply(res,403,{ok:false,error:'INVALID_ORIGIN'});
 let d;try{d=await body(req)}catch{return reply(res,400,{ok:false,error:'INVALID_BODY'})}
 if(path==='/physical-iphone/prepare'){
  const code=String(d.code||'');
  const s=/^\d{8}$/.test(code)?[...sessions.values()].find(s=>s.code===code&&!s.key&&s.expiry>Date.now()):null;
  if(!s)return reply(res,404,{ok:false,error:'PAIR_CODE_INVALID_OR_EXPIRED'});
  const ip=sourceIp(req);
  const count=[...sessions.values()].filter(t=>t!==s&&t.prepared?.ip===ip&&t.prepared.expires>Date.now()).length;
  if(count>0)return reply(res,409,{ok:false,error:'AMBIGUOUS_PREPARED_DEVICE'});
  s.prepared={ip,expires:Date.now()+180000};
  signal(s);
  return reply(res,200,{ok:true,prepared:true,expiresInSeconds:180});
 }
 if(path==='/physical-iphone/session'){
  let s=getToken(d.viewerToken);
  if(!s){
   if(sessions.size>=8)return reply(res,429,{ok:false,error:'SESSION_LIMIT'});
   s={token:randomToken(),key:null,code:newCode(),expiry:Date.now()+600000,
    info:null,device:null,viewers:new Set(),lastFrameAt:null,lastFrameMillis:0};
   sessions.set(s.token,s);save();
  }else if(!s.key&&s.expiry<Date.now()){
   s.code=newCode();s.expiry=Date.now()+600000;save();
  }
  return reply(res,200,{...status(s),viewerToken:s.token});
 }
 const s=getToken(d.viewerToken);if(!s)return reply(res,404,{ok:false,error:'SESSION_NOT_FOUND'});
 if(path==='/physical-iphone/status')return reply(res,200,status(s));
 if(path==='/physical-iphone/approve'||path==='/physical-iphone/reject'){
  const ws=s.candidate;
  if(!ws||ws.readyState!==WebSocket.OPEN)return reply(res,409,{ok:false,error:'NO_PENDING_BROADCAST'});
  if(path==='/physical-iphone/reject'){
   s.candidate=null;ws.close(1008,'viewer rejected');signal(s);
   return reply(res,200,{ok:true,rejected:true});
  }
  if(s.device?.readyState===WebSocket.OPEN)s.device.close(1012,'replaced');
  s.device=ws;s.candidate=null;
  attachPhoneFrames(ws,s);
  s.key=randomToken();s.code=null;s.expiry=0;s.prepared=null;
  save();
  ws.send(JSON.stringify({type:'paired',deviceKey:s.key}));
  signal(s);
  return reply(res,200,{ok:true,approved:true});
 }
 if(s.candidate?.readyState===WebSocket.OPEN)s.candidate.close(1000,'session ended');
 for(const viewer of s.viewers)viewer.close(1000,'viewer session ended');
 if(s.device?.readyState===WebSocket.OPEN)s.device.close(1000,'session ended');
 sessions.delete(s.token);save();return reply(res,200,{ok:true,stopped:true});
}
function attachPhoneFrames(ws,s){
 ws.on('message',(data,isBinary)=>{
    if(ws!==s.device)return;
    if(isBinary){
     if(data.length<4||data.length>850000||data[0]!==0xff||data[1]!==0xd8)return;
     const now=Date.now();if(now-s.lastFrameMillis<250)return;
     s.lastFrameMillis=now;s.lastFrameAt=new Date(now).toISOString();
     for(const v of s.viewers)if(v.readyState===WebSocket.OPEN&&v.bufferedAmount<1000000)v.send(data,{binary:true});
    }else{
     let msg;try{msg=JSON.parse(String(data))}catch{return}
     if(msg.type==='hello'){
      s.info={name:String(msg.name||'iPhone').slice(0,50),
       ios:String(msg.ios||'').slice(0,15),
       width:Math.max(1,Math.min(4096,Number(msg.width)||1)),
       height:Math.max(1,Math.min(4096,Number(msg.height)||1))};
      save();signal(s);
     }
    }
   });
 ws.on('close',()=>{if(ws===s.device){s.device=null;signal(s)}});
}
export function physicalIphoneUpgrade(req,socket,head){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname!=='/physical-iphone/socket')return false;
 const role=url.searchParams.get('role');
 let s;
 if(role==='viewer'){
  if(req.headers.origin!==origin)return reject();
  s=getToken(url.searchParams.get('viewerToken'));
 }else if(role==='trial'){
  const ip=sourceIp(req),matches=[...sessions.values()].filter(s=>s.prepared?.ip===ip&&s.prepared.expires>Date.now()&&!s.key);
  if(matches.length===1)s=matches[0];
 }else if(role==='device'){
  const key=url.searchParams.get('deviceKey'),pin=url.searchParams.get('code');
  if(key)s=[...sessions.values()].find(s=>s.key&&eq(s.key,key));
  else if(/^\d{8}$/.test(pin||''))s=[...sessions.values()].find(s=>s.code===pin&&!s.key&&s.expiry>Date.now());
 }
 if(!s)return reject();
 function reject(){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return true}
 wss.handleUpgrade(req,socket,head,ws=>{
  if(role==='viewer'){
   if(s.viewers.size>=4){ws.close(1008,'viewer limit');return}
   s.viewers.add(ws);ws.send(JSON.stringify({type:'status',...status(s)}));
   ws.on('close',()=>s.viewers.delete(ws));
  }else if(role==='trial'){
   if(s.candidate?.readyState===WebSocket.OPEN){ws.close(1008,'pending broadcast already connected');return}
   s.candidate=ws;
   ws.send(JSON.stringify({type:'awaitingApproval'}));
   signal(s);
   ws.on('close',()=>{if(s.candidate===ws){s.candidate=null;signal(s)}});
  }else{
   if(s.device?.readyState===WebSocket.OPEN)s.device.close(1012,'reconnected');
   s.device=ws;
   if(!s.key){s.key=randomToken();s.code=null;s.expiry=0;save()}
   ws.send(JSON.stringify({type:'paired',deviceKey:s.key}));
   signal(s);
   attachPhoneFrames(ws,s);
  }
 });
 return true;
}
