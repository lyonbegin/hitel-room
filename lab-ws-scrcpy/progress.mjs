// Report only completed, real GitHub Actions runner milestones to Railway.
// All messages are authenticated using GitHub OIDC; never place credentials in UI.
const [stage,...words]=process.argv.slice(2);
if(!stage)throw Error('stage required');
const message=words.join(' ').slice(0,220);
const tokenURL=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const tokenSecret=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if(!tokenURL||!tokenSecret)throw Error('GITHUB_ACTIONS_OIDC_NOT_AVAILABLE');
const reply=await fetch(tokenURL+(tokenURL.includes('?')?'&':'?')+'audience=hitel-ws-scrcpy',{
 headers:{authorization:'Bearer '+tokenSecret},signal:AbortSignal.timeout(15000)});
if(!reply.ok)throw Error('GITHUB_OIDC_STATUS_'+reply.status);
const jwt=(await reply.json()).value;
const endpoint='https://hitel-communication-web-production.up.railway.app/lab-sandbox/ws-scrcpy/progress';
const response=await fetch(endpoint,{method:'POST',headers:{
 authorization:'Bearer '+jwt,'x-github-run-id':process.env.GITHUB_RUN_ID||'',
 'content-type':'application/json'
},body:JSON.stringify({stage,message}),signal:AbortSignal.timeout(15000)});
const body=await response.text();
if(!response.ok)throw Error('PROGRESS_HTTP_'+response.status+' '+body.slice(0,220));
console.log('HITEL_ANDROID_PROGRESS',stage,message);
