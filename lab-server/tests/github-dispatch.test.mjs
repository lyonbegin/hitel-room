import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchGithubAndroidRun} from '../github-dispatch.mjs';

test('real GitHub dispatch API request uses credential only on the server, main branch and exact workflow',async()=>{
  let request=null;
  const r=await dispatchGithubAndroidRun({token:'only-on-server',fetchImpl:async(url,init)=>{
    request={url,init};
    return {status:204};
  }});
  assert.equal(r.ok,true);
  assert.equal(r.status,204);
  assert.equal(request.url,'https://api.github.com/repos/lyonbegin/hitel-room/actions/workflows/android-web-session-runner.yml/dispatches');
  assert.equal(request.init.method,'POST');
  assert.equal(request.init.headers.authorization,'Bearer only-on-server');
  assert.deepEqual(JSON.parse(request.init.body),{ref:'main'});
});
test('missing server credential never claims a successful Android launch',async()=>{
  const r=await dispatchGithubAndroidRun({token:''});
  assert.equal(r.ok,false);
  assert.equal(r.error,'GITHUB_DISPATCH_NOT_CONFIGURED');
  assert.equal(r.status,503);
});
test('GitHub permissions errors fail closed without returning upstream secrets',async()=>{
  const r=await dispatchGithubAndroidRun({token:'invalid',fetchImpl:async()=>({status:403})});
  assert.equal(r.ok,false);
  assert.equal(r.error,'GITHUB_DISPATCH_PERMISSION_DENIED');
  assert.equal(r.status,403);
});
test('a missing workflow does not appear queued',async()=>{
  const r=await dispatchGithubAndroidRun({token:'bad',fetchImpl:async()=>({status:404})});
  assert.equal(r.error,'GITHUB_WORKFLOW_NOT_FOUND');
});
test('network errors are not reported as running Android',async()=>{
  const r=await dispatchGithubAndroidRun({token:'present',fetchImpl:async()=>{throw Error('network unavailable')}});
  assert.equal(r.ok,false);
  assert.equal(r.error,'GITHUB_DISPATCH_NETWORK_ERROR');
});
