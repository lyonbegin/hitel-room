// A single room CREATED by a Web HTTP client must be visible in native Swift.
// Same production Railway origin; no iPhone-specific DB/API and no Fly edits.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const path=process.env.HITEL_E2E_ROOM_FILE;
const origin='https://hitel-room-production-ecce.up.railway.app';
if(!path)throw Error('HITEL_E2E_ROOM_FILE is required');
const id='ios-common-room-'+Date.now();
async function call(p,method='GET',token='',body){
 const response=await fetch(origin+p,{method,signal:AbortSignal.timeout(20000),
  headers:{...(body?{'Content-Type':'application/json'}:{}),
   ...(token?{Authorization:'Bearer '+token}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const data=await response.json();
 assert.ok(response.ok,p+' HTTP '+response.status+': '+JSON.stringify(data));
 return data;
}
if(process.argv[2]==='create'){
 const login=await call('/api/auth/dev-token','POST','',{userId:id+'-host',name:'Web E2E host',platformRole:'doctor'});
 const room=await call('/api/public-rooms','POST',login.accessToken,{title:'Cross-platform same room '+id,maxParticipants:2});
 assert.equal(room.type,'PUBLIC_ROOM');
 fs.writeFileSync(path,JSON.stringify({id:room.id,host:login.accessToken,guest:id+'-ios'}));
 console.log('WEB_CREATED_ROOM_AVAILABLE_TO_NATIVE='+room.id);
}else if(process.argv[2]==='cleanup'){
 if(!fs.existsSync(path))process.exit(0);
 const obj=JSON.parse(fs.readFileSync(path,'utf8'));
 await call('/api/public-rooms/'+encodeURIComponent(obj.id)+'/end','POST',obj.host);
 console.log('SHARED_ROOM_TEST_CLEANUP_PASS');
}else{
 throw Error('Expected create or cleanup');
}
