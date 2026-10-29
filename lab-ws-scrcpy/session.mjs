// Reverse WebSocket relay from the ephemeral GitHub KVM runner to the HITEL Railway app.
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/lab-ws-scrcpy/session.mjs');
let WebSocket;
for(const base of [process.cwd(),process.cwd()+'/.cache/hitel-ws-scrcpy/dist']){
 try{WebSocket=require(require.resolve('ws',{paths:[base]}));break}catch{}
}
if(!WebSocket)throw Error('WS_PACKAGE_NOT_FOUND');
const API='https://hitel-communication-web-production.up.railway.app/lab-sandbox/ws-scrcpy';
const SAVE='/tmp/hitel-ws-scrcpy-runner.json';
const action=process.argv[2]||'';
async function oidc(){
 const a=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,b=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
 if(!a||!b)throw Error('GITHUB_OIDC_NOT_AVAILABLE');
 const response=await fetch(a+(a.includes('?')?'&':'?')+'audience=hitel-ws-scrcpy',
  {headers:{authorization:'Bearer '+b},signal:AbortSignal.timeout(16000)});
 if(!response.ok)throw Error('GITHUB_OIDC_HTTP_'+response.status);
 return (await response.json()).value;
}
async function register(){
 const jwt=await oidc();
 const response=await fetch(API+'/register',{method:'POST',headers:{'content-type':'application/json',
  authorization:'Bearer '+jwt,'x-github-run-id':process.env.GITHUB_RUN_ID||''},
  body:JSON.stringify({transport:'railway-websocket'}),signal:AbortSignal.timeout(15000)});
 const reply=await response.json();
 if(!response.ok||!reply.ok||reply.status!=='running')throw Error('RELAY_REGISTER_FAILED '+JSON.stringify(reply));
 writeFileSync(SAVE,JSON.stringify({ticket:reply.ticket,runId:process.env.GITHUB_RUN_ID||''}),{mode:0o600});
 console.log('HITEL_RAILWAY_REVERSE_RELAY_REGISTERED');
}
function load(){return JSON.parse(readFileSync(SAVE,'utf8'))}
async function runnerStatus(){
 const s=load();return fetch(API+'/runner-status',{headers:{'x-runner-ticket':s.ticket},signal:AbortSignal.timeout(12000)});
}
async function relay(){
 const devices=new Map();
 while(true){
  const state=load();
  const ws=new WebSocket(API.replace(/^https:/,'wss:')+'/tunnel',{headers:{'x-runner-ticket':state.ticket},perMessageDeflate:false,maxPayload:90*1024*1024});
  await new Promise(resolve=>{
   let connected=false;
   let statusTimer=null;
   const closeAll=()=>{for(const d of devices.values())d.socket.close();devices.clear();};
   ws.on('open',()=>{
    connected=true;console.log('HITEL_RAILWAY_REVERSE_RELAY_CONNECTED');
    statusTimer=setInterval(async()=>{
     try{const r=await runnerStatus();if(r.ok&&(await r.json()).stop)ws.close(1000,'user stop');}
     catch(error){console.error('HITEL_RELAY_STATUS_RETRY',String(error).slice(0,120));}
    },3000);
   });
   ws.on('message',async(raw,isBinary)=>{
    if(isBinary){
     if(raw.length<38||raw[0]!==1)return;
     const id=raw.toString('ascii',1,37),entry=devices.get(id);if(!entry)return;
     const frame={data:raw.subarray(38),binary:raw[37]===1};
     if(entry.socket.readyState===WebSocket.OPEN)entry.socket.send(frame.data,{binary:frame.binary});else entry.queue.push(frame);
     return;
    }
    let m;try{m=JSON.parse(raw.toString())}catch{return}
    if(m.type==='http-request'){
     try{
      const local=await fetch('http://127.0.0.1:8081'+m.path,{method:m.method,
       headers:m.headers||{},body:['GET','HEAD'].includes(m.method)?undefined:Buffer.from(m.body||'','base64'),
       signal:AbortSignal.timeout(40000)});
      const bytes=Buffer.from(await local.arrayBuffer());
      ws.send(JSON.stringify({type:'http-result',id:m.id,status:local.status,
       headers:Object.fromEntries(['content-type','content-length','content-disposition'].filter(k=>local.headers.has(k)).map(k=>[k,local.headers.get(k)])),body:bytes.toString('base64')}));
     }catch(error){ws.send(JSON.stringify({type:'http-result',id:m.id,status:502,headers:{'content-type':'text/plain'},body:Buffer.from(String(error)).toString('base64')}));}
    }else if(m.type==='ws-open'){
     const entry={socket:new WebSocket('ws://127.0.0.1:8081'+m.path,{perMessageDeflate:false}),queue:[]};devices.set(m.id,entry);
     entry.socket.on('open',()=>{
      if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'ws-opened',id:m.id}));
      for(const frame of entry.queue)entry.socket.send(frame.data,{binary:frame.binary});entry.queue=[];
     });
     entry.socket.on('message',(data,binary)=>{
      const header=Buffer.allocUnsafe(38);header[0]=2;header.write(m.id,1,36,'ascii');header[37]=binary?1:0;
      ws.send(Buffer.concat([header,Buffer.from(data)]),{binary:true});
     });
     entry.socket.on('close',()=>{devices.delete(m.id);if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'ws-close',id:m.id}));});
     entry.socket.on('error',()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'ws-opened',id:m.id,error:'DEVICE_SOCKET_FAILED'}));});
    }else if(m.type==='ws-close'){devices.get(m.id)?.socket.close();devices.delete(m.id);}
   });
   ws.on('close',()=>{if(statusTimer)clearInterval(statusTimer);closeAll();if(connected)console.error('HITEL_RAILWAY_RELAY_DISCONNECTED');resolve();});
   ws.on('error',()=>{if(statusTimer)clearInterval(statusTimer);closeAll();resolve();});
  });
  await new Promise(r=>setTimeout(r,2500));
  try{
   const r=await runnerStatus();
   if(r.status===403){await register();continue;}
   if(!r.ok)continue;
   if((await r.json()).stop)break;
  }catch(error){console.error('HITEL_RAILWAY_RELAY_RETRY',String(error).slice(0,160));}
 }
}
async function finish(){
 let state;try{state=load()}catch{return}
 const response=await fetch(API+'/finish',{method:'POST',headers:{'content-type':'application/json','x-runner-ticket':state.ticket},body:'{}',signal:AbortSignal.timeout(10000)});
 console.log('HITEL_WS_SCRCPY_FINISH',response.status);
}
try{
 if(action==='register')await register();
 else if(action==='relay')await relay();
 else if(action==='check'){
  const response=await runnerStatus();
  if(response.status===403){console.log('continue');}
  else if(!response.ok){console.log('continue');}
  else console.log((await response.json()).stop?'stop':'continue');
 }else if(action==='finish')await finish();
 else throw Error('usage: session.mjs register | relay | check | finish');
}catch(error){console.error('HITEL_WS_SCRCPY_SESSION_ERROR',String(error).slice(0,300));process.exitCode=4}
