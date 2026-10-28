// GitHub Actions OIDC identity, no user-entered token, no permanent relay.
import {readFileSync,writeFileSync} from 'node:fs';
const API='https://hitel-communication-web-production.up.railway.app/lab-sandbox/ws-scrcpy';
const SAVE='/tmp/hitel-ws-scrcpy-runner.json';
const action=process.argv[2]||'';
async function oidc(){
 const a=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
 const b=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
 if(!a||!b)throw Error('GITHUB_OIDC_NOT_AVAILABLE');
 const url=a+(a.includes('?')?'&':'?')+'audience=hitel-ws-scrcpy';
 const response=await fetch(url,{headers:{authorization:'Bearer '+b},signal:AbortSignal.timeout(16000)});
 if(!response.ok)throw Error('GITHUB_OIDC_HTTP_'+response.status);
 return (await response.json()).value;
}
async function register(){
 const host=process.argv[3];
 if(!host)throw Error('WS_SCRCPY_TUNNEL_REQUIRED');
 const jwt=await oidc();
 const response=await fetch(API+'/register',{method:'POST',
  headers:{'content-type':'application/json',authorization:'Bearer '+jwt,
   'x-github-run-id':process.env.GITHUB_RUN_ID||''},
  body:JSON.stringify({url:host}),signal:AbortSignal.timeout(15000)});
 const reply=await response.json();
 if(!response.ok||!reply.ok||reply.status!=='running')throw Error('HOST_REGISTER_FAILED '+JSON.stringify(reply));
 writeFileSync(SAVE,JSON.stringify({ticket:reply.ticket,deadline:reply.deadline}),{mode:0o600});
 console.log('HITEL_WS_SCRCPY_REGISTER_SUCCESS',reply.status,'expires',new Date(reply.deadline).toISOString());
}
async function check(){
 const state=JSON.parse(readFileSync(SAVE,'utf8'));
 const response=await fetch(API+'/runner-status',{headers:{'x-runner-ticket':state.ticket},signal:AbortSignal.timeout(8000)});
 if(!response.ok){console.log('stop');return}
 const data=await response.json();
 console.log(data.stop||data.remainingSeconds<=0?'stop':'continue');
}
async function finish(){
 let state;
 try{state=JSON.parse(readFileSync(SAVE,'utf8'))}catch{return}
 const response=await fetch(API+'/finish',{method:'POST',headers:{
  'content-type':'application/json','x-runner-ticket':state.ticket
 },body:'{}',signal:AbortSignal.timeout(10000)});
 console.log('HITEL_WS_SCRCPY_FINISH',response.status);
}
try{
 if(action==='register')await register();
 else if(action==='check')await check();
 else if(action==='finish')await finish();
 else throw Error('usage: node lab-ws-scrcpy/session.mjs register HOST | check | finish');
}catch(error){console.error('HITEL_WS_SCRCPY_SESSION_ERROR',String(error).slice(0,300));process.exitCode=4}
