// Real ws-scrcpy Android-device discovery check, not an HTTP-only smoke test.
const base='ws://127.0.0.1:8000/?action=goog-device-list';
let finished=false;
const deadline=setTimeout(()=>fail('DEVICE_TRACKER_TIMEOUT'),90000);
function fail(reason){
 if(finished)return;finished=true;clearTimeout(deadline);
 console.error('WS_SCRCPY_DEVICE_PROOF_FAIL',reason);process.exit(22);
}
const ws=new WebSocket(base);
ws.addEventListener('error',e=>fail('WEBSOCKET_ERROR:'+String(e.message||'')));
ws.addEventListener('close',()=>{if(!finished)fail('TRACKER_CLOSED_BEFORE_DEVICE')});
ws.addEventListener('open',()=>console.log('WS_SCRCPY_TRACKER_CONNECTED'));
ws.addEventListener('message',async e=>{
 try{
  let s=e.data;
  if(typeof s!=='string')s=typeof s.text==='function'?await s.text():new TextDecoder().decode(s);
  const m=JSON.parse(s);
  if(!['devicelist','device'].includes(m.type))return;
  const devices=m.type==='devicelist'?(m.data?.list||[]):[m.data?.device];
  for(const d of devices){
   if(d?.udid==='emulator-5554'){
    console.log('WS_SCRCPY_REAL_ANDROID11_FOUND',JSON.stringify({
     udid:d.udid,state:d.state,pid:d.pid,android:d['ro.build.version.release'],
     model:d['ro.product.model']
    }));
    if(d.state==='device'&&Number(d.pid)>0&&d['ro.build.version.release']==='11'){
     finished=true;clearTimeout(deadline);
     ws.close();console.log('WS_SCRCPY_DEVICE_DISCOVERY_AND_SCRCPY_SERVER_PASS');
     process.exit(0);
    }
   }
  }
 }catch(err){console.log('WS_SCRCPY_TRACKER_EVENT_PARSE',String(err).slice(0,140))}
});
