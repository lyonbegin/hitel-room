import crypto from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

/**
 * Ephemeral capability-based signaling lab. Each call has distinct caller and
 * callee secrets; this does NOT replace production identity verification.
 * Communication SDK uses this to validate event/call-state contracts end-to-end.
 */
export function createCommunicationService({ringTimeoutMs=45_000, callTtlMs=3_600_000}={}) {
  const sessions=new Map(), rate=new Map();
  const wss=new WebSocketServer({noServer:true,maxPayload:16_384});
  const allowed=new Set(['call.invite','call.ringing','call.accept','call.reject','call.cancel',
    'call.connecting','call.active','call.end','call.failed','call.networkInterrupted','call.recovered',
    'call.mediaChanged','ai.result']);
  const kinds=['P','P+','N','W'];
  const secret=()=>crypto.randomBytes(32).toString('base64url');
  const send=(ws,msg)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg))};
  const reply=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))};
  const bearer=req=>(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1];
  const body=req=>new Promise((resolve,reject)=>{
    let total=0,parts=[];
    req.on('data',chunk=>{total+=chunk.length;if(total>16_384){reject(Error('Request too large'));req.destroy()}else parts.push(chunk)});
    req.on('end',()=>{try{const parsed=JSON.parse(Buffer.concat(parts).toString());if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();resolve(parsed)}catch{reject(Error('Invalid JSON'))}});
    req.on('error',reject);
  });
  function authorize(token) {
    if(!token)return null;
    for(const call of sessions.values()){
      if(call.expires<=Date.now())continue;
      if(call.caller.token===token)return {call,participant:call.caller};
      if(call.callee.token===token)return {call,participant:call.callee};
    }
    return null;
  }
  function publicSnapshot(call,participant,since=0){
    return {ok:true,callId:call.id,scenarioId:call.scenarioId,from:call.from,to:call.to,
      role:participant.role,state:call.state,sequence:call.sequence,
      expiresAt:new Date(call.expires).toISOString(),
      participants:{caller:{online:call.caller.sockets.size>0},callee:{online:call.callee.sockets.size>0}},
      events:call.events.filter(e=>e.sequence>since)};
  }
  function publish(call,from,type,payload={}) {
    const event={type,eventId:secret(),callId:call.id,scenarioId:call.scenarioId,
      sequence:++call.sequence,from:from||'server',state:call.state,
      timestamp:new Date().toISOString(),payload};
    call.events.push(event);
    if(call.events.length>200)call.events.shift();
    for(const participant of [call.caller,call.callee])
      for(const ws of participant.sockets)send(ws,{type:'comm.event',event});
    return event;
  }
  function transition(call,participant,action,payload={}) {
    if(!allowed.has(action))throw Error('Unsupported action');
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||JSON.stringify(payload).length>4000)throw Error('Invalid event payload');
    const state=call.state,role=participant.role;
    const terminal=['ended','rejected','cancelled','missed','failed'].includes(state);
    if(terminal)throw Error('Call is already terminal');
    if(action==='ai.result'||action==='call.mediaChanged'){
      if(state!=='active')throw Error('Active call required');
      return publish(call,role,action,payload);
    }
    if(action==='call.networkInterrupted'||action==='call.recovered'){
      if(state!=='active'&&state!=='connecting')throw Error('Connected call required');
      return publish(call,role,action,payload);
    }
    const transitions={
      'call.invite':{role:'caller',from:['idle'],to:'inviting'},
      'call.ringing':{role:'callee',from:['inviting'],to:'ringing'},
      'call.accept':{role:'callee',from:['inviting','ringing'],to:'accepted'},
      'call.reject':{role:'callee',from:['inviting','ringing'],to:'rejected'},
      'call.cancel':{role:'caller',from:['inviting','ringing'],to:'cancelled'},
      'call.connecting':{role:null,from:['accepted'],to:'connecting'},
      'call.active':{role:null,from:['connecting'],to:'active'},
      'call.end':{role:null,from:['accepted','connecting','active'],to:'ended'},
      'call.failed':{role:null,from:['inviting','ringing','accepted','connecting','active'],to:'failed'}
    };
    const t=transitions[action];
    if(!t||(t.role&&t.role!==role)||!t.from.includes(state))throw Error('Invalid role or call-state transition');
    call.state=t.to;
    const event=publish(call,role,action,payload);
    if(['ended','rejected','cancelled','failed'].includes(call.state))clearTimeout(call.ringTimer);
    if(action==='call.invite') {
      call.ringTimer=setTimeout(()=>{
        if(call.state==='inviting'||call.state==='ringing'){
          call.state='missed';publish(call,'server','call.missed',{reason:'ring_timeout'});
        }
      },ringTimeoutMs);
      call.ringTimer.unref?.();
    }
    return event;
  }
  const prune=setInterval(()=>{
    const now=Date.now();
    for(const [id,call] of sessions)if(call.expires<=now){
      clearTimeout(call.ringTimer);
      for(const p of [call.caller,call.callee])for(const ws of p.sockets)ws.close(4000,'Call expired');
      sessions.delete(id);
    }
    for(const [ip,r] of rate)if(now-r.since>120_000)rate.delete(ip);
  },30_000);
  prune.unref?.();
  async function http(req,res,route) {
    if(route==='/comm-api/health'&&req.method==='GET')return reply(res,200,{ok:true,service:'communication-signaling',version:1});
    if(route==='/comm-api/session'&&req.method==='POST'){
      const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0];
      const slot=rate.get(ip)||{since:Date.now(),count:0};
      if(Date.now()-slot.since>60_000){slot.since=Date.now();slot.count=0}
      rate.set(ip,slot);if(++slot.count>20)return reply(res,429,{ok:false,error:'Rate limit exceeded'});
      if(sessions.size>1000)return reply(res,503,{ok:false,error:'Signaling lab capacity exceeded'});
      const data=await body(req),from=kinds.indexOf(data.from),to=kinds.indexOf(data.to);
      if(from<0||to<0)return reply(res,400,{ok:false,error:'Invalid communication endpoints'});
      const id=crypto.randomUUID();
      const call={id,scenarioId:from*4+to+1,from:data.from,to:data.to,state:'idle',sequence:0,
        expires:Date.now()+callTtlMs,events:[],caller:{role:'caller',token:secret(),sockets:new Set(),ack:0},
        callee:{role:'callee',token:secret(),sockets:new Set(),ack:0},ringTimer:null};
      sessions.set(id,call);
      return reply(res,201,{ok:true,callId:id,scenarioId:call.scenarioId,
        callerToken:call.caller.token,calleeToken:call.callee.token,expiresInSeconds:Math.floor(callTtlMs/1000)});
    }
    const auth=authorize(bearer(req));
    if(!auth)return reply(res,401,{ok:false,error:'Valid participant token required'});
    const {call,participant}=auth;
    if(route==='/comm-api/session/'+call.id&&req.method==='GET'){
      const since=Math.max(0,Number(new URL(req.url,'http://localhost').searchParams.get('since'))||0);
      return reply(res,200,publicSnapshot(call,participant,since));
    }
    if(route==='/comm-api/action'&&req.method==='POST'){
      const data=await body(req);
      try{
        const event=transition(call,participant,data.action,data.payload||{});
        return reply(res,200,{ok:true,event,state:call.state});
      }catch(e){return reply(res,409,{ok:false,error:String(e.message),state:call.state})}
    }
    return reply(res,404,{ok:false,error:'Unknown communication endpoint'});
  }
  function upgrade(req,socket,head){
    const uri=new URL(req.url,'http://localhost');
    const token=uri.searchParams.get('token');
    const auth=authorize(token);
    if(!auth){socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');socket.destroy();return}
    const {call,participant}=auth;
    wss.handleUpgrade(req,socket,head,ws=>{
      participant.sockets.add(ws);
      const since=Math.max(0,Number(uri.searchParams.get('since'))||participant.ack||0);
      send(ws,{type:'comm.snapshot',...publicSnapshot(call,participant,since)});
      publish(call,'server','comm.presence',{role:participant.role,online:true});
      ws.on('message',raw=>{
        let message;
        try{message=JSON.parse(String(raw));}catch{return send(ws,{type:'comm.error',error:'Invalid JSON'})}
        if(message.type==='comm.ack'){
          const n=Number(message.sequence);
          if(Number.isSafeInteger(n)&&n>=0&&n<=call.sequence)participant.ack=Math.max(participant.ack,n);
          return;
        }
        if(message.type==='comm.ping')return send(ws,{type:'comm.pong',time:Date.now()});
        if(message.type==='call.action'){
          try{const event=transition(call,participant,message.action,message.payload||{});send(ws,{type:'comm.actionAck',requestId:message.requestId||null,eventId:event.eventId,sequence:event.sequence,state:call.state})}
          catch(e){send(ws,{type:'comm.error',requestId:message.requestId||null,error:String(e.message),state:call.state})}
          return;
        }
        send(ws,{type:'comm.error',error:'Unsupported WS message type'});
      });
      ws.on('close',()=>{
        participant.sockets.delete(ws);
        if(!participant.sockets.size)publish(call,'server','comm.presence',{role:participant.role,online:false});
      });
    });
  }
  return {http,upgrade,close(){
    clearInterval(prune);
    for(const call of sessions.values()){clearTimeout(call.ringTimer);
      for(const p of [call.caller,call.callee])for(const ws of p.sockets)ws.close();}
    wss.close();
  }};
}
