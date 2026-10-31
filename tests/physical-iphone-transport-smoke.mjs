// Protocol verification only: fake JPEG header is used as test payload.
// A successful run does NOT establish a real physical iPhone broadcast.
import WebSocket from 'ws';
const host='https://hitel-communication-web-production.up.railway.app';
const base=host+'/lab-sandbox/physical-iphone';
const assert=(v,msg)=>{if(!v)throw Error('IPHONE_SMOKE_ASSERT: '+msg)};
async function post(p,v){
 for(let i=0;i<3;i++){
  try{
   const r=await fetch(base+p,{method:'POST',headers:{origin:host,'content-type':'application/json'},
    body:JSON.stringify(v),signal:AbortSignal.timeout(14000)});
   if((r.status===502||r.status===503)&&i<2){await new Promise(resolve=>setTimeout(resolve,2500));continue}
   let data=await r.json();if(!r.ok)throw Error(p+' HTTP '+r.status+JSON.stringify(data));
   return data;
  }catch(e){if(i===2)throw e;await new Promise(resolve=>setTimeout(resolve,2500))}
 }
}
function open(uri,opts={}){
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(uri,opts),timeout=setTimeout(()=>reject(Error('WS_OPEN_TIMEOUT')),12000);
  ws.once('open',()=>{clearTimeout(timeout);resolve(ws)});ws.once('error',e=>{clearTimeout(timeout);reject(e)});
 });
}
const awaitFrame=ws=>new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(Error('FRAME_NOT_DELIVERED')),12000);
 ws.on('message',(data,isBinary)=>{if(isBinary){clearTimeout(timeout);resolve(data)}});
});
let token,viewer,device;
try{
 const start=await post('/session',{});
 token=start.viewerToken;
 assert(/^[a-f0-9]{64}$/.test(token),'private viewer token');
 assert(/^\d{8}$/.test(start.pairCode),'8-digit pairing code');
 const wss=base.replace(/^https/,'wss')+'/socket';
 viewer=await open(wss+'?role=viewer&viewerToken='+token,{headers:{origin:host}});
 device=await open(wss+'?role=device&code='+start.pairCode);
 const framePromise=awaitFrame(viewer);
 device.send(JSON.stringify({type:'hello',name:'IPHONE_TEST_ONLY',ios:'17.0',width:393,height:852}));
 device.send(Buffer.from([0xff,0xd8,0xff,0xd9]));
 const frame=await framePromise;assert(frame[0]===0xff&&frame[1]===0xd8,'JPEG bytes forwarded');
 const state=await post('/status',{viewerToken:token});
 assert(state.online===true&&state.paired===true,'device online and paired');
 assert(state.deviceInfo.name==='IPHONE_TEST_ONLY','metadata forwarded');
 console.log('PHYSICAL_IPHONE_REPLAYKIT_TRANSPORT_PASS',JSON.stringify({
  paired:true,connected:true,frameBytes:frame.length,realHardware:false
 }));
}finally{
 if(token){try{await post('/stop',{viewerToken:token})}catch(e){console.error(String(e))}}
 viewer?.close();device?.close();
}
