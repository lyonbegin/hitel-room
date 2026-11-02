// Real Railway-only public-room integration smoke test; creates and deletes its own room.
// Credentials are obtained through the existing HITEL authenticated login gateway.
// Does not modify the Fly.io application or log bearer tokens.
import assert from 'node:assert/strict';

const ORIGIN=process.env.HITEL_ROOM_TEST_ORIGIN || 'https://hitel-web-preview-production.up.railway.app';
const id='railway-public-'+Date.now();
async function json(path,{method='GET',token,body}={}){
 const response=await fetch(ORIGIN+path,{
  method,signal:AbortSignal.timeout(16000),headers:{
   ...(body?{'Content-Type':'application/json'}:{}),
   ...(token?{Authorization:'Bearer '+token}:{})
  },...(body?{body:JSON.stringify(body)}:{})
 });
 const value=await response.json().catch(()=>({error:'invalid JSON'}));
 if(!response.ok)throw Error(path+' returned HTTP '+response.status+': '+JSON.stringify(value).slice(0,400));
 return value;
}
async function login(user,role){
 const response=await json('/api/auth/dev-token',{method:'POST',body:{
  userId:user,name:user,platformRole:role
 }});
 assert.equal(typeof response.accessToken,'string');
 return response.accessToken;
}
function wsConnect(path,ticket){
 return new Promise((resolve,reject)=>{
  const w=new WebSocket(ORIGIN.replace('https:','wss:')+path,['hitel-public','ticket.'+ticket]);
  const inbox=[],pending=[];
  const obj={
   w,
   send:(m)=>w.send(JSON.stringify(m)),
   recv:()=>new Promise((r,fail)=>{
    if(inbox.length)return r(inbox.shift());
    const to=setTimeout(()=>fail(Error('websocket message timeout')),12000);
    pending.push(v=>{clearTimeout(to);r(v)});
   })
  };
  const timer=setTimeout(()=>reject(Error('websocket connection timed out')),12000);
  w.addEventListener('open',()=>{clearTimeout(timer);resolve(obj)});
  w.addEventListener('error',e=>{clearTimeout(timer);reject(Error('WebSocket signal connection failed'))});
  w.addEventListener('message',e=>{
   const msg=JSON.parse(String(e.data));
   if(pending.length)pending.shift()(msg);else inbox.push(msg);
  });
 });
}
let host,guest,room,a,b;
try{
 host=await login(id+'-host','doctor');
 guest=await login(id+'-guest','user');
 room=await json('/api/public-rooms',{method:'POST',token:host,body:{
   title:'Railway E2E temporary room',maxParticipants:2
 }});
 assert.equal(room.type,'PUBLIC_ROOM');
 assert.equal(room.status,'LIVE');
 assert.equal(room.policy.allowUnlistedParticipants,true);
 assert.equal(room.participants.length,1);
 console.log('Create room with one host: PASS');
 const list=await json('/api/public-rooms',{token:guest});
 assert.ok(Array.isArray(list));
 assert.ok(list.some(r=>r.id===room.id));
 console.log('Shared public room list: PASS');
 const h=await json('/api/public-rooms/'+room.id+'/join',{method:'POST',token:host});
 const g=await json('/api/public-rooms/'+room.id+'/join',{method:'POST',token:guest});
 assert.equal(h.session.id,room.id);assert.equal(g.session.id,room.id);
 a=await wsConnect('/api/public-rooms/'+room.id+'/signal',h.ticket);
 assert.equal((await a.recv()).type,'welcome');
 b=await wsConnect('/api/public-rooms/'+room.id+'/signal',g.ticket);
 const welcome=await b.recv();const joined=await a.recv();
 assert.equal(welcome.type,'welcome');assert.equal(joined.type,'peer-joined');
 assert.equal(joined.peerId,welcome.peerId);
 a.send({type:'signal',to:welcome.peerId,data:{description:{type:'offer',sdp:'v=0'}}});
 const offer=await b.recv();assert.equal(offer.type,'signal');assert.equal(offer.data.description.type,'offer');
 b.send({type:'signal',to:offer.from,data:{description:{type:'answer',sdp:'v=0'}}});
 const answer=await a.recv();assert.equal(answer.data.description.type,'answer');
 console.log('Two real authenticated WSS clients offer/answer relay: PASS');
 const sdkResp=await fetch('https://hitel-communication-web-production.up.railway.app/sdk/communication.esm.js',{signal:AbortSignal.timeout(15000)});
 assert.equal(sdkResp.status,200);
 const sdkText=await sdkResp.text();
 assert.ok(sdkText.includes('createPublicMeshRoomAdapter'));
 console.log('Existing Railway Communication SDK exports: PASS');
}finally{
 if(host&&room?.id){
  try{
   const closed=await json('/api/public-rooms/'+room.id+'/end',{method:'POST',token:host});
   assert.equal(closed.session.status,'ENDED');
   console.log('Host end and cleanup: PASS');
  }catch(e){console.error('Cleanup failure:',e.message);process.exitCode=1}
 }
 a?.w.close();b?.w.close();
}
