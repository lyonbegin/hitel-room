/**
 * Trigger the ORIGINAL Android KVM runner through GitHub's Actions API.
 * This is an actual server-to-server workflow_dispatch (204), not a
 * Railway queue record and not GitHub Actions' unreliable cron event.
 * The token stays on the Railway server and is never accepted in browser UI.
 */
export async function dispatchGithubAndroidRun({
  token=process.env.HITEL_GITHUB_DISPATCH_TOKEN||'',
  fetchImpl=fetch,
  repo='lyonbegin/hitel-room',
  workflow='android-web-session-runner.yml',
  ref='main',
  timeoutMs=12000
}={}){
  if(!token.trim())return {ok:false,error:'GITHUB_DISPATCH_NOT_CONFIGURED',status:503};
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const endpoint='https://api.github.com/repos/'+repo+
      '/actions/workflows/'+encodeURIComponent(workflow)+'/dispatches';
    const response=await fetchImpl(endpoint,{
      method:'POST',
      headers:{
        accept:'application/vnd.github+json',
        authorization:'Bearer '+token,
        'x-github-api-version':'2022-11-28',
        'content-type':'application/json'
      },
      body:JSON.stringify({ref}),
      signal:controller.signal
    });
    if(response.status===200||response.status===204){
      let runId=null,runUrl=null;
      if(response.status===200){
        try{
          const body=await response.json();
          runId=Number.isSafeInteger(body?.workflow_run_id)?body.workflow_run_id:null;
          const url=String(body?.html_url||'');
          if(/^https:\/\/github\.com\/lyonbegin\/hitel-room\/actions\/runs\/[0-9]+$/.test(url))
            runUrl=url;
        }catch{ /* Older GitHub API versions return an empty body. */ }
      }
      return {ok:true,status:response.status,method:'workflow_dispatch',workflow,ref,runId,runUrl};
    }
    // Do not expose GitHub response bodies or credentials to browsers.
    return {ok:false,status:response.status,
      error:response.status===401||response.status===403?
        'GITHUB_DISPATCH_PERMISSION_DENIED':response.status===404?
        'GITHUB_WORKFLOW_NOT_FOUND':response.status===429?
        'GITHUB_DISPATCH_RATE_LIMIT':'GITHUB_DISPATCH_HTTP_'+response.status};
  }catch(error){
    return {ok:false,status:503,error:error?.name==='AbortError'?
      'GITHUB_DISPATCH_TIMEOUT':'GITHUB_DISPATCH_NETWORK_ERROR'};
  }finally{clearTimeout(timeout)}
}
