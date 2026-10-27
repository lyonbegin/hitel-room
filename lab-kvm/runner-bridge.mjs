// Communication SDK disposable Android 11 native VNC bridge.
// Proxies the binary RFB stream without decoding/re-encoding pixels.
const base='wss://hitel-communication-web-production.up.railway.app/lab-kvm';
const id=process.env.HITEL_SESSION_ID;
const ticket=process.env.HITEL_RUNNER_TICKET;
const deadline=Number(process.env.HITEL_EXPIRES_AT);
const runId=process.env.GITHUB_RUN_ID;
if(!/^[0-9a-f]{32}$/.test(id||'')||!/^[0-9a-f]{64}$/.test(ticket||'')||!Number.isSafeInteger(deadline))
  throw Error('INVALID_RUNNER_CONFIGURATION');
const url=(kind)=>base+'/'+kind+'?sid='+encodeURIComponent(id)+'&ticket='+encodeURIComponent(ticket);
const CLOSE_TIMEOUT=5000;
let local=null,remote=null,control=null,closing=false,streamGeneration=0;
let establishedAt=null;
function shutdownSocket(ws){
 if(!ws||ws.readyState===WebSocket.CLOSED)return;
 try{if(ws.readyState===WebSocket.CONNECTING){ws.close();return} ws.close(1000,'stream reset')}catch{}
}
function cancelViewer(){
 streamGeneration++;
 shutdownSocket(local);shutdownSocket(remote);
 local=null;remote=null;
}
function describeClose(kind,ev){
 console.log('HITEL_RFB_SOCKET_CLOSED',kind,'code='+ev.code,'reason='+String(ev.reason||'').slice(0,100),'clean='+ev.wasClean);
}
function describeError(kind,ev){console.error('HITEL_RFB_SOCKET_ERROR',kind,String(ev?.message||ev?.error?.message||'websocket error').slice(0,120))}
const sendBytes=(ws,data)=>{
 if(ws?.readyState!==WebSocket.OPEN)return false;
 try{
  // Preserve RFB frame type across all hops. Node's native WebSocket sends
  // ArrayBuffer and Uint8Array as binary, not text.
  ws.send(data);return true;
 }catch(err){console.error('HITEL_RFB_FORWARD_ERROR',String(err).slice(0,160));return false}
};
async function finish(reason){
 if(closing)return;
 closing=true;cancelViewer();
 try{if(control?.readyState===WebSocket.OPEN)control.send(JSON.stringify({type:'done',reason}))}catch{}
 await new Promise(resolve=>setTimeout(resolve,250));
 shutdownSocket(control);
 console.log('ANDROID_LIVE_RUNNER_FINISHED',reason);
 process.exit(0);
}
function openViewer(){
 cancelViewer();
 const generation=streamGeneration;
 let pending=[];let pendingBytes=0;
 let downstreamOpened=false;
 const maxPending=4*1024*1024;
 // The server accepts one stream only after the matching browser viewer.
 // Attach the downstream VNC transport only after the stream is established.
 const upstream=new WebSocket(url('stream'));
 remote=upstream;
 upstream.binaryType='arraybuffer';
 upstream.addEventListener('open',()=>{
  if(generation!==streamGeneration)return shutdownSocket(upstream);
  const downstream=new WebSocket('ws://127.0.0.1:6080/websockify',['binary']);
  local=downstream;
  downstream.binaryType='arraybuffer';
  downstream.addEventListener('open',()=>{
   if(generation!==streamGeneration)return shutdownSocket(downstream);
   downstreamOpened=true;
   console.log('HITEL_RFB_LOCAL_VNC_OPEN','protocol='+downstream.protocol);
   // Drain ordered client packets that arrived while the local socket was opening.
   for(const data of pending){if(!sendBytes(downstream,data))break}
   pending=[];pendingBytes=0;
  });
  downstream.addEventListener('message',ev=>{
   if(generation!==streamGeneration)return;
   const data=ev.data;
   if(typeof data==='string'){console.error('HITEL_RFB_UNEXPECTED_TEXT_FROM_LOCAL');return}
   if(!sendBytes(upstream,data))console.error('HITEL_RFB_UPSTREAM_UNAVAILABLE');
  });
  downstream.addEventListener('close',ev=>{
   describeClose('local-vnc',ev);
   if(generation===streamGeneration)shutdownSocket(upstream);
  });
  downstream.addEventListener('error',ev=>describeError('local-vnc',ev));
 });
 upstream.addEventListener('message',ev=>{
  if(generation!==streamGeneration)return;
  const data=ev.data;
  if(typeof data==='string'){console.error('HITEL_RFB_UNEXPECTED_TEXT_FROM_UPSTREAM');return}
  if(downstreamOpened&&local?.readyState===WebSocket.OPEN){sendBytes(local,data);return}
  const size=data.byteLength??data.size??0;
  if(pendingBytes+size>maxPending){
   console.error('HITEL_RFB_PENDING_OVERFLOW',pendingBytes+size);
   return shutdownSocket(upstream);
  }
  pending.push(data);pendingBytes+=size;
 });
 upstream.addEventListener('close',ev=>{
  describeClose('remote-relay',ev);
  if(generation===streamGeneration)shutdownSocket(local);
 });
 upstream.addEventListener('error',ev=>describeError('remote-relay',ev));
}
control=new WebSocket(url('runner'));
control.addEventListener('open',()=>{
 establishedAt=Date.now();
 console.log('ANDROID_LIVE_RUNNER_CONNECTED');
 control.send(JSON.stringify({type:'ready',runId}));
});
control.addEventListener('message',event=>{
 let cmd;try{cmd=JSON.parse(String(event.data))}catch{return}
 if(cmd.type==='stop')return void finish(cmd.reason||'manual-stop');
 if(cmd.type==='viewer.close')return cancelViewer();
 if(cmd.type==='viewer.open')return openViewer();
});
control.addEventListener('close',ev=>{describeClose('control',ev);void finish('control-lost')});
control.addEventListener('error',ev=>{describeError('control',ev);void finish('control-error')});
setInterval(()=>{
 if(Date.now()>=deadline)return void finish('ten-minute-expiry');
 // Do not keep a ghost VM running if control never successfully connected.
 if(!establishedAt&&Date.now()>deadline-45000)return void finish('runner-connect-timeout');
},500).unref();
setTimeout(()=>void finish('runner-hard-stop'),900000).unref();
