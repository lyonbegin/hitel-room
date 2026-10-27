// GitHub-hosted ephemeral Android VM claims the one queued browser session.
// GitHub's signed OIDC identity is verified by the Railway control plane.
// No personal GitHub API token or user-facing authentication input.
const reqUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const reqToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if(!reqUrl||!reqToken)throw Error('GITHUB_OIDC_NOT_AVAILABLE');
const u=new URL(reqUrl);u.searchParams.set('audience','hitel-kvm-live');
const r=await fetch(u,{headers:{Authorization:'Bearer '+reqToken},signal:AbortSignal.timeout(15000)});
if(!r.ok)throw Error('GITHUB_OIDC_REQUEST_HTTP_'+r.status);
const {value:oidc}=await r.json();
if(typeof oidc!=='string')throw Error('GITHUB_OIDC_EMPTY');
const api='https://hitel-communication-web-production.up.railway.app/lab-kvm/claim';
const claim=await fetch(api,{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({oidc}),signal:AbortSignal.timeout(15000)});
if(!claim.ok){
 const response=await claim.json().catch(()=>({error:'RESPONSE_NOT_JSON'}));
 throw Error('HITEL_KVM_CLAIM_HTTP_'+claim.status+'_'+String(response.error).slice(0,120));
}
const x=await claim.json();
if(!/^[0-9a-f]{32}$/.test(x.sessionId)||!/^[0-9a-f]{64}$/.test(x.runnerTicket)||
  !Number.isSafeInteger(x.expiresAt))throw Error('INVALID_CONTROL_PLANE_CLAIM_RESULT');
process.stdout.write('export HITEL_SESSION_ID='+x.sessionId+'\n'+
  'export HITEL_RUNNER_TICKET='+x.runnerTicket+'\n'+
  'export HITEL_EXPIRES_AT='+x.expiresAt+'\n');
