import WebSocket from 'ws';
const base='https://hitel-communication-web-production.up.railway.app';
const root='/lab-sandbox/playground';
const must=(yes,msg)=>{if(!yes)throw Error('NATIVE_JOIN_TEST_FAILED '+msg)};
async function api(path,body,origin=true){
 const r=await fetch(base+root+path,{method:'POST',
  headers:{'content-type':'application/json',...(origin?{origin:base}:{})},
  body:JSON.stringify(body),signal:AbortSignal.timeout(12_000)});
 const data=await r.json();if(!r.ok)throw Error(path+' '+r.status+' '+JSON.stringify(data));return data;
}
function connect(s,side,native){
 return new Promise((resolve,reject)=>{
  const url=base.replace('https','wss')+root+'/socket?id='+s.id+'&side='+side+'&secret='+s.secret;
  const ws=new WebSocket(url,{headers:native?{}:{origin:base}});
  const timer=setTimeout(()=>reject(Error('WS timeout '+side)),8000);
  ws.once('open',()=>{clearTimeout(timer);resolve(ws)});
  ws.once('error',reject);
 });
}
function receive(ws,match){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.off('message',handle);reject(Error('SIGNAL_TIMEOUT'))},8500);
  function handle(bytes){try{const data=JSON.parse(String(bytes));if(match(data)){clearTimeout(timer);ws.off('message',handle);resolve(data)}}catch{}}
  ws.on('message',handle);
 });
}
async function cmd(ws,type,payload){
 const requestId=Math.random().toString(36);
 const pending=receive(ws,x=>x.type==='ack'&&x.requestId===requestId);
 ws.send(JSON.stringify({type,requestId,payload}));
 const ack=await pending;must(ack.ok,type+':'+ack.reason);
}
for(const routeId of [3,7,9,10,11,12,15]){
 const s=await api('/session',{routeId});
 let a,b;
 try{
  const codeA=s.nativeCodes?.A,codeB=s.nativeCodes?.B;
  if(s.route.from==='N')must(/^\d{8}$/.test(codeA),'native A code');
  if(s.route.to==='N')must(/^\d{8}$/.test(codeB),'native B code');
  const nA=codeA?await api('/native-join',{code:codeA},false):null;
  const nB=codeB?await api('/native-join',{code:codeB},false):null;
  if(nA)must(nA.side==='A'&&nA.route.id===routeId,'native A role');
  if(nB)must(nB.side==='B'&&nB.route.id===routeId,'native B role');
  a=await connect({id:s.id,secret:nA?.secret||s.secret},'A',!!nA);
  b=await connect({id:s.id,secret:nB?.secret||s.secret},'B',!!nB);
  const ringing=receive(b,x=>x.type==='event'&&x.event?.type==='call.ringing');
  await cmd(a,'call.invite');await ringing;
  const accepted=receive(a,x=>x.type==='event'&&x.event?.type==='call.accept');
  await cmd(b,'call.accept');await accepted;
  if([11,12,15].includes(routeId)){
   const forwarded=receive(b,x=>x.type==='rtc.offer');
   await cmd(a,'rtc.offer',{type:'offer',sdp:'v=0'});
   must((await forwarded).from==='A','offer to native/web');
   const answer=receive(a,x=>x.type==='rtc.answer');
   await cmd(b,'rtc.answer',{type:'answer',sdp:'v=0'});
   await answer;
  }
  await cmd(a,'call.end');
  console.log('NATIVE_JOIN_SCENARIO_'+routeId+'_PASS',{route:s.route,nativeA:!!nA,nativeB:!!nB});
 }finally{a?.close();b?.close();await api('/end',{id:s.id,secret:s.secret}).catch(()=>{})}
}
console.log('NATIVE_PLAYGROUND_7_OF_7_SIGNALING_PASS real iPhone AV media and CallKit require hardware verification');
