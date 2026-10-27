const base='wss://hitel-communication-web-production.up.railway.app/lab-kvm';
const id=process.env.HITEL_SESSION_ID;
const ticket=process.env.HITEL_RUNNER_TICKET;
const deadline=Number(process.env.HITEL_EXPIRES_AT);
const runId=process.env.GITHUB_RUN_ID;
if(!/^[0-9a-f]{32}$/.test(id||'')||!/^[0-9a-f]{64}$/.test(ticket||'')||!Number.isSafeInteger(deadline))
  throw Error('INVALID_RUNNER_CONFIGURATION');
let local=null,remote=null,closing=false;
const url=(kind)=>base+'/'+kind+'?sid='+encodeURIComponent(id)+'&ticket='+encodeURIComponent(ticket);
const closeSocket=(ws)=>{if(ws && [WebSocket.OPEN,WebSocket.CONNECTING].includes(ws.readyState))ws.close()};
const cancelViewer=()=>{closeSocket(local);closeSocket(remote);local=null;remote=null};
const control=new WebSocket(url('runner'));
async function finish(reason){
  if(closing)return;
  closing=true;cancelViewer();
  try{if(control.readyState===WebSocket.OPEN)control.send(JSON.stringify({type:'done',reason}))}catch{}
  await new Promise(resolve=>setTimeout(resolve,350));
  closeSocket(control);
  console.log('ANDROID_LIVE_RUNNER_FINISHED',reason);
  process.exit(0);
}
control.addEventListener('open',()=>{
  console.log('ANDROID_LIVE_RUNNER_CONNECTED');
  control.send(JSON.stringify({type:'ready',runId}));
});
control.addEventListener('message',async event=>{
  let command;try{command=JSON.parse(String(event.data))}catch{return}
  if(command.type==='stop')return finish(command.reason||'manual-stop');
  if(command.type==='viewer.close')return cancelViewer();
  if(command.type!=='viewer.open')return;
  cancelViewer();
  // Establish public stream before opening local websockify: no RFB banner loss.
  remote=new WebSocket(url('stream'));
  const thisRemote=remote;
  thisRemote.binaryType='arraybuffer';
  thisRemote.addEventListener('open',()=>{
    if(thisRemote!==remote)return;
    local=new WebSocket('ws://127.0.0.1:6080/websockify');
    const thisLocal=local;
    thisLocal.binaryType='arraybuffer';
    thisLocal.addEventListener('message',async ({data})=>{
      if(remote!==thisRemote||thisRemote.readyState!==WebSocket.OPEN)return;
      thisRemote.send(data instanceof Blob?await data.arrayBuffer():data);
    });
    thisLocal.addEventListener('close',()=>{if(local===thisLocal)closeSocket(thisRemote)});
    thisLocal.addEventListener('error',()=>{if(local===thisLocal)closeSocket(thisRemote)});
  });
  thisRemote.addEventListener('message',async ({data})=>{
    if(thisRemote!==remote||local?.readyState!==WebSocket.OPEN)return;
    local.send(data instanceof Blob?await data.arrayBuffer():data);
  });
  thisRemote.addEventListener('close',()=>{if(remote===thisRemote)closeSocket(local)});
  thisRemote.addEventListener('error',()=>{if(remote===thisRemote)closeSocket(local)});
});
control.addEventListener('close',()=>finish('control-lost'));
control.addEventListener('error',()=>finish('control-error'));
setInterval(()=>{if(Date.now()>=deadline)void finish('ten-minute-expiry')},500).unref();
setTimeout(()=>void finish('runner-hard-stop'),900_000).unref();
