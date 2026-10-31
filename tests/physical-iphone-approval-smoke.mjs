// Isolated protocol-only check: uses a 4-byte JPEG envelope and never
// claims that a physical iPhone was connected.
import WebSocket from 'ws';
const host='https://hitel-communication-web-production.up.railway.app';
const base=host+'/lab-sandbox/physical-iphone';
const check=(x,msg)=>{if(!x)throw Error('IPHONE_APPROVAL_SMOKE_FAILED: '+msg)};
const request=async(path,data,native=false)=>{
 const headers={'content-type':'application/json'};
 if(!native)headers.origin=host;
 const res=await fetch(base+path,{method:'POST',headers,body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
 const json=await res.json();
 if(!res.ok)throw Error('API '+path+' '+res.status+JSON.stringify(json));
 return json;
};
const open=(url,opts={})=>new Promise((resolve,reject)=>{
 const ws=new WebSocket(url,opts),timeout=setTimeout(()=>reject(Error('WS_TIMEOUT '+url)),14000);
 ws.once('open',()=>{clearTimeout(timeout);resolve(ws)});ws.once('error',e=>{clearTimeout(timeout);reject(e)});
});
const waitFor=(ws,predicate,timeoutMs=12000)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.removeListener('message',handler);reject(Error('WS_MESSAGE_TIMEOUT'))},timeoutMs);
 function handler(data,binary){if(!predicate(data,binary))return;clearTimeout(timer);ws.removeListener('message',handler);resolve(data)}
 ws.on('message',handler);
});
let token,viewer,trial;
try{
 const session=await request('/session',{});
 token=session.viewerToken;
 check(/^\d{8}$/.test(session.pairCode),'8-digit pin created');
 const setup=await request('/prepare',{code:session.pairCode},true);
 check(setup.prepared===true,'PIN registered without browser origin');
 const wss=base.replace(/^https/,'wss')+'/socket';
 viewer=await open(wss+'?role=viewer&viewerToken='+token,{headers:{origin:host}});
 trial=await open(wss+'?role=trial');
 const pending=await request('/status',{viewerToken:token});
 check(pending.approvalPending===true,'trial requires viewer authorization');
 check(pending.online===false,'no screen frames before approval');
 const pairedPromise=waitFor(trial,(data,binary)=>!binary&&String(data).includes('"type":"paired"'));
 const approved=await request('/approve',{viewerToken:token});
 check(approved.approved===true,'browser approved pending broadcast');
 const paired=JSON.parse(String(await pairedPromise));
 check(/^[a-f0-9]{64}$/.test(paired.deviceKey),'device key granted after approval');
 const framePromise=waitFor(viewer,(data,binary)=>binary);
 trial.send(JSON.stringify({type:'hello',name:'TEST_ONLY',ios:'18.7',width:390,height:844}));
 trial.send(Buffer.from([255,216,255,217]));
 const frame=Buffer.from(await framePromise);
 check(frame.length===4&&frame[0]===255,'frame forwarded after approval');
 const state=await request('/status',{viewerToken:token});
 check(state.online===true&&state.paired===true,'approved device online');
 console.log('IPHONE18_SYSTEM_PICKER_PROTOCOL_APPROVAL_PASS',{prepared:true,approval:true,frameBytes:4,realPhone:false});
}finally{
 if(token)try{await request('/stop',{viewerToken:token})}catch(e){console.error(String(e))}
 viewer?.close();trial?.close();
}
