import WebSocket from 'ws';
const base='https://hitel-communication-web-production.up.railway.app';
const root='/lab-sandbox/playground';
const must=(x,label)=>{if(!x)throw Error('HITEL_80_FLOW_FAIL '+label)};
const api=async(path,body)=>{
 const res=await fetch(base+root+path,{method:'POST',
  headers:{origin:base,'content-type':'application/json'},
  body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 const json=await res.json();if(!res.ok)throw Error(path+' '+res.status+' '+JSON.stringify(json));return json;
};
function once(ws,fn,timeout=10000){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.off('message',handle);reject(Error('WS_EVENT_TIMEOUT'))},timeout);
  function handle(bytes){
   try{const msg=JSON.parse(String(bytes));if(fn(msg)){clearTimeout(timer);ws.off('message',handle);resolve(msg)}}catch(e){if(e?.message?.includes('HITEL_80_FLOW')){clearTimeout(timer);reject(e)}}
  }ws.on('message',handle);
 });
}
async function join(session,side){
 const u=base.replace('https','wss')+root+'/socket?id='+session.id+'&secret='+session.secret+'&side='+side;
 const ws=new WebSocket(u,{headers:{origin:base}});
 await new Promise((resolve,reject)=>{
  const t=setTimeout(()=>reject(Error('WS_CONNECT_TIMEOUT')),9000);
  ws.once('open',()=>{clearTimeout(t);resolve()});ws.once('error',reject)
 });
 return ws
}
async function command(ws,type,payload=null,expect=true){
 const requestId=Math.random().toString(36).slice(2);
 const ack=once(ws,m=>m.type==='ack'&&m.requestId===requestId);
 ws.send(JSON.stringify({type,requestId,payload}));
 const result=await ack;
 must(result.ok===expect,type+' expected '+expect+' got '+JSON.stringify(result));
 return result
}
const flowNames=['accepted_then_ended','receiver_reject','caller_cancel','receiver_reconnect','invalid_command_blocked'];
let count=0;
for(let routeId=1;routeId<=16;routeId++){
 for(const flow of flowNames){
  const s=await api('/session',{routeId});let A,B;
  try{
   A=await join(s,'A');B=await join(s,'B');
   if(flow==='invalid_command_blocked'){
    await command(B,'call.invite',null,false);
    await command(A,'call.accept',null,false);
    await command(A,'rtc.offer',{type:'offer',sdp:'v=0'},false);
    await command(A,'call.mediaConnected',{connectionState:'connected'},false);
   }else{
    const ringing=once(B,m=>m.type==='event'&&m.event?.type==='call.ringing');
    await command(A,'call.invite');await ringing;
    if(flow==='receiver_reject'){
     await command(B,'call.reject');
     const st=await api('/status',{id:s.id,secret:s.secret});
     must(st.phase==='rejected','reject phase '+routeId);
    }else if(flow==='caller_cancel'){
     await command(A,'call.cancel');
     const st=await api('/status',{id:s.id,secret:s.secret});
     must(st.phase==='ended','cancel phase '+routeId);
    }else{
     if(flow==='receiver_reconnect'){
      B.close(1000,'test reconnect');await new Promise(resolve=>B.once('close',resolve));
      B=await join(s,'B');
      const st=await api('/status',{id:s.id,secret:s.secret});
      must(st.phase==='ringing','reconnect must preserve ringing '+routeId);
      must(st.peers.B,'reconnect must restore receiver '+routeId);
     }
     const accepted=once(A,m=>m.type==='event'&&m.event?.type==='call.accept');
     await command(B,'call.accept');await accepted;
     await command(A,'call.end');
     const st=await api('/status',{id:s.id,secret:s.secret});
     must(st.phase==='ended','end '+routeId);
    }
   }
   count++;
   console.log('HITEL_SC'+String(routeId).padStart(2,'0')+'_'+flow+'_PASS');
  }finally{A?.close();B?.close();await api('/end',{id:s.id,secret:s.secret}).catch(()=>{})}
 }
}
must(count===80,'expected 80 flows');
console.log('HITEL_16_X_5_80_OF_80_SERVER_FLOWS_PASS',JSON.stringify({flows:count,
 checks:['connect','invite','accept','reject','cancel','reconnect','invalid-state','rtc-guard']}));
