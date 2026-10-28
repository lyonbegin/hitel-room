// Called only by the scheduled GitHub Actions KVM workflow.
// GitHub OIDC proves repo + workflow identity; no browser secret or PAT required.
const api='https://hitel-communication-web-production.up.railway.app/lab-sandbox/ws-scrcpy/claim';
const url=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const bearer=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if(!url||!bearer)throw new Error('GITHUB_ACTIONS_OIDC_NOT_AVAILABLE');
const tokenReply=await fetch(url+(url.includes('?')?'&':'?')+'audience=hitel-ws-scrcpy',{
 headers:{authorization:'Bearer '+bearer},signal:AbortSignal.timeout(20000)});
if(!tokenReply.ok)throw new Error('OIDC_TOKEN_HTTP_'+tokenReply.status);
const jwt=(await tokenReply.json()).value;
const response=await fetch(api,{method:'POST',headers:{
 authorization:'Bearer '+jwt,'content-type':'application/json',
 'x-github-run-id':process.env.GITHUB_RUN_ID||''
},body:'{}',signal:AbortSignal.timeout(20000)});
if(!response.ok)throw new Error('CLAIM_HTTP_'+response.status);
const data=await response.json();
if(!data.ok)throw new Error('CLAIM_UNEXPECTED_RESPONSE');
const claimed=data.claim===true;
console.log(claimed?'ANDROID_KVM_QUEUE_CLAIMED':'ANDROID_KVM_QUEUE_EMPTY');
if(process.env.GITHUB_OUTPUT){
 const {appendFileSync}=await import('node:fs');
 appendFileSync(process.env.GITHUB_OUTPUT,'claimed='+claimed+'\n');
}
