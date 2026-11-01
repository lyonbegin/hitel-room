// Regression guard: the old eight-digit native pairing mechanism is gone.
// Native iPhone apps now register independently and receive side-scoped
// WebSocket credentials through their own persistent device URL.
const base='https://hitel-communication-web-production.up.railway.app';
const root='/lab-sandbox/playground';
const must=(yes,msg)=>{if(!yes)throw Error('LEGACY_PIN_REMOVAL_FAILED '+msg)};
async function request(path,body,origin=true){
 const response=await fetch(base+root+path,{method:'POST',
  headers:{'content-type':'application/json',...(origin?{origin:base}:{})},
  body:JSON.stringify(body),signal:AbortSignal.timeout(12_000)});
 let data;
 try { data=await response.json() } catch { data=null }
 return {status:response.status,data};
}
const obsolete=await request('/native-join',{code:'12345678'},false);
must(obsolete.status===404,'The obsolete 8-digit PIN join endpoint remains active');
let checked=0;
for(let routeId=1;routeId<=16;routeId++){
 const result=await request('/session',{routeId});
 must(result.status===201,'Cannot create route '+routeId);
 const s=result.data;
 try{
  for(const name of ['nativeCode','nativeCodes','nativeSecret','nativeSecrets']){
   must(!Object.hasOwn(s,name),'Leaked legacy pairing field '+name+' on route '+routeId);
  }
  const status=await request('/status',{id:s.id,secret:s.secret});
  must(status.status===200,'Cannot inspect route '+routeId);
  must(!Object.hasOwn(status.data,'nativeCodes'),'Status leaks legacy PIN on route '+routeId);
  checked++;
 } finally {
  await request('/end',{id:s.id,secret:s.secret}).catch(()=>{});
 }
}
console.log('HITEL_NO_LEGACY_NUMERIC_PAIRING_16_OF_16_PASS',checked);
console.log('Native iPhone signaling is separately verified in communication-device-url-all-16.mjs');
