// Controlled capability probe: temporary TEST room only; clean up with session:end.
// Never log dev JWTs, and never publish this test room into the HITEL directory.
import { io } from 'socket.io-client';
const origin='https://hitel-room-production-ecce.up.railway.app';
const id='hitel-room-public-probe-'+Date.now();
const result={login:null,create:null,publicPolicy:null,guestRead:null,guestSignalingJoin:null,cleanup:null};
let hostToken,guestToken,sessionId;
async function request(path,{token,method='GET',body}={}){
 const response=await fetch(origin+path,{method,headers:{
  ...(token?{Authorization:'Bearer '+token}:{}),
  ...(body?{'Content-Type':'application/json'}:{})
 },...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 let payload={};try{payload=await response.json()}catch{}
 return {status:response.status,body:payload};
}
function ack(socket,event,body,timeout=5000){
 return new Promise((resolve,reject)=>{
  socket.timeout(timeout).emit(event,body,(error,response)=>{
   if(error)reject(error); else resolve(response);
  });
 });
}
async function openSocket(token){
 const socket=io(origin+'/realtime',{
  transports:['websocket'],auth:{token},autoConnect:false,timeout:8000,reconnection:false
 });
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.disconnect();reject(new Error('socket not ready'))},12000);
  const ready=()=>{clearTimeout(timer);resolve()};
  socket.once('connection:ready',ready);
  socket.once('connect_error',error=>{clearTimeout(timer);reject(error)});
  socket.connect();
 });
 return socket;
}
try{
 const host=await request('/api/auth/dev-token',{method:'POST',body:{userId:id,name:'HITEL 자동 공개방 검증',platformRole:'doctor'}});
 result.login=host.status;
 if(host.status!==201 && host.status!==200)throw new Error('test host token rejected');
 hostToken=host.body.accessToken;
 const guest=await request('/api/auth/dev-token',{method:'POST',body:{userId:id+'-guest',name:'검증 참가자',platformRole:'user'}});
 if(guest.status===201||guest.status===200)guestToken=guest.body.accessToken;
 const created=await request('/api/telemedicine/consultations',{method:'POST',token:hostToken,body:{
  title:'자동 공개 입장 검증 임시방',
  participants:[{userId:id,displayName:'검증 방장',role:'DOCTOR'}],
  maxParticipants:3,
  policy:{allowUnlistedParticipants:true,requireHostStart:false,waitingRoom:false,maxParticipants:3}
 }});
 result.create=created.status;
 if(created.status!==201&&created.status!==200){
  result.creationError=String(created.body?.message||created.body?.error||'no body').slice(0,200);
 }else{
  sessionId=created.body.id;
  result.publicPolicy=created.body.policy?.allowUnlistedParticipants??null;
  if(guestToken && sessionId){
   const publicRead=await request('/api/telemedicine/consultations/'+encodeURIComponent(sessionId),{token:guestToken});
   result.guestRead=publicRead.status;
   try{
    const guestSocket=await openSocket(guestToken);
    try{
     const joined=await ack(guestSocket,'session:join',{sessionId},7000);
     result.guestSignalingJoin={ok:joined?.ok===true,errorCode:joined?.error?.code||null};
    }finally{guestSocket.disconnect()}
   }catch(e){result.guestSignalingJoin={ok:false,detail:e.message.slice(0,120)}}
  }
 }
}catch(e){result.probeError=String(e.message).slice(0,230)}
finally{
 if(hostToken&&sessionId){
  try{
   const socket=await openSocket(hostToken);
   try{
    const joined=await ack(socket,'session:join',{sessionId});
    if(joined?.ok) {
     const ended=await ack(socket,'session:end',{sessionId},7000);
     result.cleanup=ended?.ok===true?'ENDED':'FAILED';
    }else result.cleanup='JOIN_DENIED';
   }finally{socket.disconnect()}
  }catch(e){result.cleanup='FAILED:'+e.message.slice(0,100)}
 }
 console.log(JSON.stringify(result,null,2));
}
