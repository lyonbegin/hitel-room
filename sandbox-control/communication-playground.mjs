// HITEL Communication Playground: an isolated, honest 16-route signaling lab.
// Two genuine browser WebSocket clients can exercise call events; browser
// WebRTC is enabled only for N/W combinations and is never represented as
// validated native N media or a carrier/PSTN telephone connection.
import {randomBytes, randomInt, randomUUID, timingSafeEqual} from 'node:crypto';
import {WebSocket,WebSocketServer} from 'ws';
const WEB_ORIGIN=process.env.HITEL_WEB_ORIGIN||'https://hitel-communication-web-production.up.railway.app';
const LIFE=120*60_000;
const nativeAttempts=new Map();
function pin(){let code;do{code=String(randomInt(0,100000000)).padStart(8,'0')}
  while([...sessions.values()].some(s=>s.nativeCodes?.A===code||s.nativeCodes?.B===code));return code}
const sessions=new Map();
const wsServer=new WebSocketServer({noServer:true,maxPayload:40_000,perMessageDeflate:false});
const TYPES=['P','P+','N','W'];
const routes=Array.from({length:16},(_,i)=>({id:i+1,from:TYPES[Math.floor(i/4)],to:TYPES[i%4]}));
const now=()=>new Date().toISOString();
const safeEq=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&timingSafeEqual(x,y)};
const json=(res,code,data)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data))};
const capability=(r)=>({signaling:true,browserWebRTC:['N','W'].includes(r.from)&&['N','W'].includes(r.to),
  nativeIOS:false,pstnGateway:false,aiRuntime:false,mode:'PLAYGROUND_BROWSER_PEERS'});
function expire(){
 const time=Date.now();for(const [id,s] of sessions){if(s.expires<=time){
  for(const w of Object.values(s.peers))if(w?.readyState===WebSocket.OPEN)w.close(1001,'Playground session expired');sessions.delete(id)
 }}
}
function broadcast(s,msg){
 for(const w of Object.values(s.peers))if(w?.readyState===WebSocket.OPEN)w.send(JSON.stringify(msg));
}
function sessionState(s){return {ok:true,id:s.id,route:s.route,phase:s.phase,callId:s.callId,
  peers:{A:s.peers.A?.readyState===WebSocket.OPEN,B:s.peers.B?.readyState===WebSocket.OPEN},
  expiresAt:new Date(s.expires).toISOString(),capabilities:capability(s.route),sequence:s.seq};}
function emit(s,type,by,detail={}){
 s.seq++;const event={type,by,at:now(),seq:s.seq,callId:s.callId,...detail};
 s.events.push(event);if(s.events.length>80)s.events.shift();broadcast(s,{type:'event',event});
 console.log('HITEL_PLAYGROUND_EVENT',JSON.stringify({id:s.id.slice(0,8),route:s.route.id,type,by,seq:s.seq}));
 return event;
}
async function parseBody(req){let raw='';for await(const c of req){raw+=c;if(raw.length>3000)throw Error('PAYLOAD_TOO_LARGE')}return JSON.parse(raw||'{}')}
export async function playgroundRoute(req,res,path){
 expire();
 if(path==='/playground/health'&&req.method==='GET')return json(res,200,{ok:true,service:'hitel-communication-playground',routes:16,activeSessions:sessions.size});
 if(req.method!=='POST'||!['/playground/session','/playground/status','/playground/end','/playground/native-join'].includes(path))return json(res,404,{ok:false,error:'NOT_FOUND'});
 if(!String(req.headers['content-type']||'').startsWith('application/json')||
    (path!=='/playground/native-join'&&req.headers.origin!==WEB_ORIGIN))
  return json(res,403,{ok:false,error:'INVALID_ORIGIN'});
 let data;try{data=await parseBody(req)}catch{return json(res,400,{ok:false,error:'INVALID_JSON'})}
 if(path==='/playground/session'){
  const route=routes.find(r=>r.id===data.routeId);
  if(!route)return json(res,400,{ok:false,error:'INVALID_ROUTE'});
  if(sessions.size>=24)return json(res,429,{ok:false,error:'SESSION_LIMIT'});
  const s={id:randomUUID(),secret:randomBytes(32).toString('hex'),nativeCode:pin(),
   nativeSecret:randomBytes(32).toString('hex'),nativeSide:route.from==='N'?'A':route.to==='N'?'B':null,
   nativeCodes:{A:route.from==='N'?pin():null,
                B:route.to==='N'?pin():null},
   nativeSecrets:{A:randomBytes(32).toString('hex'),B:randomBytes(32).toString('hex')},
   route,expires:Date.now()+LIFE,
   phase:'idle',callId:null,peers:{A:null,B:null},events:[],seq:0,rate:{A:[],B:[]}};
  sessions.set(s.id,s);
  return json(res,201,{...sessionState(s),secret:s.secret,
   nativeCode:s.nativeSide?s.nativeCodes[s.nativeSide]:null,nativeSide:s.nativeSide,nativeCodes:s.nativeCodes});
 }
 if(path==='/playground/native-join'){
  const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown');
  const attempts=(nativeAttempts.get(ip)||[]).filter(t=>Date.now()-t<600_000);
  attempts.push(Date.now());nativeAttempts.set(ip,attempts);
  if(attempts.length>40)return json(res,429,{ok:false,error:'JOIN_RATE_LIMIT'});
  const code=String(data.code||'');
  if(!/^\d{8}$/.test(code))return json(res,404,{ok:false,error:'NATIVE_CODE_NOT_FOUND'});
  const found=[...sessions.values()].flatMap(s=>['A','B'].map(side=>({s,side})))
   .find(x=>x.s.nativeCodes?.[x.side]===code&&x.s.expires>Date.now());
  if(!found)return json(res,404,{ok:false,error:'NATIVE_CODE_NOT_FOUND'});
  const {s,side}=found;
  return json(res,200,{ok:true,id:s.id,secret:s.nativeSecrets[side],side,
   route:s.route,phase:s.phase,expiresAt:new Date(s.expires).toISOString(),mediaEligible:capability(s.route).browserWebRTC});
 }
 const s=sessions.get(String(data.id||''));
 if(!s||!safeEq(s.secret,data.secret))return json(res,404,{ok:false,error:'SESSION_NOT_FOUND'});
 if(path==='/playground/status')return json(res,200,{...sessionState(s),events:s.events.slice(-40)});
 for(const w of Object.values(s.peers))if(w?.readyState===WebSocket.OPEN)w.close(1000,'Ended by browser user');
 sessions.delete(s.id);return json(res,200,{ok:true,ended:true});
}
export function playgroundUpgrade(req,socket,head){
 expire();
 const u=new URL(req.url,'http://localhost');
 if(u.pathname!=='/playground/socket')return false;
 const s=sessions.get(u.searchParams.get('id')||'');
 const side=u.searchParams.get('side');
 const nativeAuth=req.headers.origin===undefined&&!!s?.nativeCodes?.[side]&&
   !!s?.nativeSecrets?.[side]&&safeEq(s.nativeSecrets[side],u.searchParams.get('secret'));
 const browserAuth=req.headers.origin===WEB_ORIGIN&&!!s&&safeEq(s.secret,u.searchParams.get('secret'));
 if(!s||!['A','B'].includes(side)||!(nativeAuth||browserAuth)){
  socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return true;
 }
 const actor=side,other=side==='A'?'B':'A';
 wsServer.handleUpgrade(req,socket,head,ws=>{
  if(s.peers[actor]?.readyState===WebSocket.OPEN)s.peers[actor].close(1000,'Same player reconnected');
  s.peers[actor]=ws;
  ws.send(JSON.stringify({type:'hello',state:sessionState(s),events:s.events.slice(-40)}));
  broadcast(s,{type:'presence',peers:sessionState(s).peers,at:now()});
  ws.on('message',(raw,binary)=>{
   if(binary||ws!==s.peers[actor])return;
   const ts=Date.now(),hits=s.rate[actor].filter(x=>ts-x<10_000);hits.push(ts);s.rate[actor]=hits;
   if(hits.length>120){ws.close(1008,'RATE_LIMIT');return}
   let msg;try{msg=JSON.parse(String(raw))}catch{return}
   if(!msg||typeof msg!=='object')return;
   const type=String(msg.type||''),isCaller=actor==='A';
   const ack=(ok,reason)=>ws.send(JSON.stringify({type:'ack',requestId:typeof msg.requestId==='string'?msg.requestId.slice(0,70):'',
    ok,reason:reason||null,phase:s.phase,callId:s.callId,at:now()}));
   if(type==='call.invite'){
    if(!isCaller||!['idle','ended','rejected'].includes(s.phase)){ack(false,'INVALID_STATE');return}
    if(s.peers.B?.readyState!==WebSocket.OPEN){ack(false,'RECEIVER_NOT_CONNECTED');return}
    s.phase='ringing';s.callId=randomUUID();emit(s,'call.ringing',actor,{route:s.route});ack(true);return;
   }
   if(type==='call.accept'||type==='call.reject'){
    if(isCaller||s.phase!=='ringing'){ack(false,'INVALID_STATE');return}
    s.phase=type==='call.accept'?'accepted':'rejected';emit(s,type,actor);ack(true);return;
   }
   if(type==='call.cancel'||type==='call.end'){
    if(s.phase==='idle'||s.phase==='ended'){ack(false,'INVALID_STATE');return}
    s.phase='ended';emit(s,type,actor);ack(true);return;
   }
   if(type==='rtc.offer'||type==='rtc.answer'||type==='rtc.ice'){
    if(!capability(s.route).browserWebRTC||s.phase!=='accepted'&&s.phase!=='media'){ack(false,'WEBRTC_ROUTE_NOT_READY');return}
    if(!s.peers[other]||s.peers[other].readyState!==WebSocket.OPEN){ack(false,'PEER_OFFLINE');return}
    const payload=msg.payload;
    if(!payload||typeof payload!=='object'||JSON.stringify(payload).length>22000){ack(false,'INVALID_RTC_PAYLOAD');return}
    s.peers[other].send(JSON.stringify({type,from:actor,payload,callId:s.callId,at:now()}));
    if(type==='rtc.answer')s.phase='media';
    emit(s,type,actor,{description:type==='rtc.ice'?'ICE candidate':'SDP exchange'});ack(true);return;
   }
   if(type==='call.mediaConnected'){
    if(!capability(s.route).browserWebRTC||s.phase!=='media'){ack(false,'NO_MEDIA_NEGOTIATION');return}
    emit(s,'call.mediaConnected',actor,{connectionState:String(msg.payload?.connectionState||'').slice(0,50)});ack(true);return;
   }
   if(type==='lab.note'){
    const note=String(msg.note||'').slice(0,250);
    if(!note){ack(false,'EMPTY_NOTE');return}
    emit(s,'lab.note',actor,{note});ack(true);return;
   }
   ack(false,'UNKNOWN_ACTION');
  });
  ws.on('close',()=>{if(s.peers[actor]===ws){s.peers[actor]=null;broadcast(s,{type:'presence',peers:sessionState(s).peers,at:now()})}});
 });
 return true;
}
