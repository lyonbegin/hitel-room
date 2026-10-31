// Physical Android handset screen capture transport. Distinct from GitHub KVM.
// Each private viewer session has its own unguessable token and one paired phone.
// This service forwards genuine JPEG frames only; it never synthesizes a phone screen.
import {randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {WebSocketServer,WebSocket} from 'ws';

const ORIGIN=process.env.HITEL_WEB_ORIGIN||'https://hitel-communication-web-production.up.railway.app';
const FILE=process.env.HITEL_PHYSICAL_STATE_FILE||join(process.env.RAILWAY_VOLUME_MOUNT_PATH||'/data/hitel-ws-scrcpy','physical-android.json');
const sessions=new Map();
const wss=new WebSocketServer({noServer:true,maxPayload:750000,perMessageDeflate:false});
const CONTROL_ACTIONS=new Set(['tap','longPress','swipe','text','home','back','recents','notifications']);
const unit=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
function validControl(m){
 if(!m||m.type!=='control'||!CONTROL_ACTIONS.has(m.action)||!Number.isSafeInteger(m.id)||m.id<1)return false;
 if(m.action==='tap'||m.action==='longPress')return unit(m.x)&&unit(m.y);
 if(m.action==='swipe')return unit(m.x)&&unit(m.y)&&unit(m.endX)&&unit(m.endY)&&Number.isFinite(m.duration)&&m.duration>=90&&m.duration<=2000;
 if(m.action==='text')return typeof m.text==='string'&&m.text.length>0&&m.text.length<=4000;
 return true;
}
const hex=()=>randomBytes(32).toString('hex');
const code=()=>String(randomInt(0,100000000)).padStart(8,'0');
const safeEq=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&timingSafeEqual(x,y)};
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data))};
const notify=s=>{const status=JSON.stringify({type:'status',online:Boolean(s.device?.readyState===WebSocket.OPEN),lastFrameAt:s.lastFrameAt,deviceInfo:s.deviceInfo||null,accessibilityEnabled:s.accessibilityEnabled===true});
 for(const w of s.viewers)if(w.readyState===WebSocket.OPEN)w.send(status);
};
function persist(){
 try{
  mkdirSync(dirname(FILE),{recursive:true,mode:0o700});
  const tmp=FILE+'.tmp';
  writeFileSync(tmp,JSON.stringify([...sessions.values()].map(s=>({token:s.token,deviceKey:s.deviceKey,code:s.code,expiry:s.expiry,deviceInfo:s.deviceInfo}))),{mode:0o600});
  renameSync(tmp,FILE);
 }catch(e){console.error('HITEL_PHYSICAL_STATE_PERSIST_FAILED',String(e).slice(0,120))}
}
try{
 const raw=JSON.parse(readFileSync(FILE,'utf8'));
 if(Array.isArray(raw))for(const s of raw.slice(0,8)){
  if(/^[a-f0-9]{64}$/.test(s.token||''))sessions.set(s.token,{...s,device:null,viewers:new Set(),lastFrameAt:null});
 }
}catch{}
function findToken(token){if(!/^[a-f0-9]{64}$/.test(String(token||'')))return null;return [...sessions.values()].find(s=>safeEq(s.token,token))||null;}
function openCode(){
 let p;
 do{p=code()}while([...sessions.values()].some(s=>s.code===p&&s.expiry>Date.now()));
 return p;
}
function status(s){
 return {ok:true,online:Boolean(s.device?.readyState===WebSocket.OPEN),paired:Boolean(s.deviceKey),pairCode:s.deviceKey?null:s.code,
  pairExpiresAt:s.deviceKey?null:new Date(s.expiry).toISOString(),deviceInfo:s.deviceInfo||null,lastFrameAt:s.lastFrameAt,accessibilityEnabled:s.accessibilityEnabled===true};
}
async function body(req){let value='';for await(const chunk of req){value+=chunk;if(value.length>2048)throw Error('BODY_TOO_LARGE')}return JSON.parse(value||'{}')}
function authorizedBrowser(req){return req.headers.origin===ORIGIN&&String(req.headers['content-type']||'').startsWith('application/json')}
export async function physicalRoute(req,res,path){
 if(req.method==='GET'&&path==='/physical/health')return send(res,200,{ok:true,service:'physical-android-screen',sessions:sessions.size});
 if(!['/physical/session','/physical/status','/physical/stop'].includes(path)||req.method!=='POST')return send(res,404,{ok:false,error:'PHYSICAL_ROUTE_NOT_FOUND'});
 if(!authorizedBrowser(req))return send(res,403,{ok:false,error:'INVALID_BROWSER_ORIGIN'});
 let data;try{data=await body(req)}catch{return send(res,400,{ok:false,error:'INVALID_JSON'})}
 if(path==='/physical/session'){
  let s=findToken(data.viewerToken);
  if(!s){
   if(sessions.size>=8)return send(res,429,{ok:false,error:'TOO_MANY_SESSIONS'});
   s={token:hex(),deviceKey:null,code:openCode(),expiry:Date.now()+10*60*1000,deviceInfo:null,device:null,viewers:new Set(),lastFrameAt:null};
   sessions.set(s.token,s);persist();
  }else if(!s.deviceKey&&s.expiry<Date.now()){
   s.code=openCode();s.expiry=Date.now()+10*60*1000;persist();
  }
  return send(res,200,{...status(s),viewerToken:s.token});
 }
 const s=findToken(data.viewerToken);
 if(!s)return send(res,404,{ok:false,error:'SESSION_NOT_FOUND'});
 if(path==='/physical/status')return send(res,200,status(s));
 for(const v of s.viewers)v.close(1000,'session stopped');
 s.viewers.clear();
 if(s.device?.readyState===WebSocket.OPEN){s.device.send(JSON.stringify({type:'stop'}));s.device.close(1000,'user stopped screen sharing')}
 sessions.delete(s.token);persist();
 return send(res,200,{ok:true,stopped:true});
}
export function physicalUpgrade(req,socket,head){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname!=='/physical/socket')return false;
 const role=url.searchParams.get('role');
 const fail=()=>socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
 let session=null;
 if(role==='viewer'){
  if(req.headers.origin!==ORIGIN){fail();return true}
  session=findToken(url.searchParams.get('viewerToken'));
 }else if(role==='device'){
  const key=url.searchParams.get('deviceKey'),pairCode=url.searchParams.get('code');
  if(key)session=[...sessions.values()].find(s=>s.deviceKey&&safeEq(s.deviceKey,key))||null;
  else if(pairCode&&/^\d{8}$/.test(pairCode))session=[...sessions.values()].find(s=>s.code===pairCode&&!s.deviceKey&&s.expiry>Date.now())||null;
 }
 if(!session){fail();return true}
 const s=session;
 wss.handleUpgrade(req,socket,head,ws=>{
  if(role==='viewer'){
   if(s.viewers.size>=4){ws.close(1008,'too many viewers');return}
    s.viewers.add(ws);
   ws.send(JSON.stringify({type:'status',online:Boolean(s.device?.readyState===WebSocket.OPEN),lastFrameAt:s.lastFrameAt,deviceInfo:s.deviceInfo||null,accessibilityEnabled:s.accessibilityEnabled===true}));
   ws.on('message',(data,isBinary)=>{
    if(isBinary||s.device?.readyState!==WebSocket.OPEN||data.length>8000)return;
    let msg;try{msg=JSON.parse(String(data))}catch{return}
    if(!validControl(msg)){ws.send(JSON.stringify({type:'controlAck',id:msg?.id||0,ok:false,error:'INVALID_CONTROL'}));return}
    const now=Date.now();
    if(now-(ws.lastCommandAt||0)<45)return;
    ws.lastCommandAt=now;
    // Pairing authorizes ONLY a small, validated set of accessibility actions.
    s.device.send(JSON.stringify({type:'control',action:msg.action,id:msg.id,x:msg.x,y:msg.y,
     endX:msg.endX,endY:msg.endY,duration:msg.duration,text:msg.text}));
   });
   ws.on('close',()=>s.viewers.delete(ws));
  }else{
   if(s.device&&s.device.readyState===WebSocket.OPEN)s.device.close(1012,'replaced by phone reconnect');
   s.device=ws;
   if(!s.deviceKey){s.deviceKey=hex();s.code=null;s.expiry=0;persist()}
   ws.send(JSON.stringify({type:'paired',deviceKey:s.deviceKey}));
   notify(s);
   ws.on('message',(data,isBinary)=>{
    if(s.device!==ws)return;
    if(isBinary){
     if(data.length<4||data.length>700000||data[0]!==0xff||data[1]!==0xd8)return;
     if(Date.now()-(s.lastFrameMillis||0)<250)return;
     s.lastFrameMillis=Date.now();s.lastFrameAt=new Date().toISOString();
     for(const viewer of s.viewers){
      if(viewer.readyState===WebSocket.OPEN&&viewer.bufferedAmount<1000000)viewer.send(data,{binary:true});
     }
    }else{
     let msg;try{msg=JSON.parse(String(data))}catch{return}
     if(msg.type==='hello'){
      s.accessibilityEnabled=msg.accessibilityEnabled===true;
      s.deviceInfo={name:String(msg.name||'Android').slice(0,60),android:String(msg.android||'').slice(0,20),
       width:Math.max(1,Math.min(4096,Number(msg.width)||1)),height:Math.max(1,Math.min(4096,Number(msg.height)||1))};
      persist();notify(s);
     }else if(msg.type==='controlAck'&&Number.isSafeInteger(msg.id)&&msg.id>0){
      const response={type:'controlAck',id:msg.id,ok:msg.ok===true,
       error:typeof msg.error==='string'?msg.error.slice(0,90):undefined,
       accessibilityEnabled:msg.accessibilityEnabled===true};
      s.accessibilityEnabled=msg.accessibilityEnabled===true;
      for(const viewer of s.viewers)if(viewer.readyState===WebSocket.OPEN)viewer.send(JSON.stringify(response));
     }else if(msg.type==='accessibilityStatus'){
      s.accessibilityEnabled=msg.enabled===true;notify(s);
     }
    }
   });
   ws.on('close',()=>{if(s.device===ws){s.device=null;notify(s)}});
  }
 });
 return true;
}
