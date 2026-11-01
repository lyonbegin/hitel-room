// Verify the exact user journey in real deployed Chromium:
// open this ONE app's stable URL => auto-created scenario => automatic native
// assignment and independent WSS connection, with NO numeric pairing.
import {chromium} from 'playwright';
import WebSocket from 'ws';
import {randomUUID,randomBytes} from 'node:crypto';
const host='https://hitel-communication-web-production.up.railway.app';
const root='/lab-sandbox/playground';
const id=randomUUID(),key=randomBytes(32).toString('hex');
const assert=(p,msg)=>{if(!p)throw Error('PER_APP_BROWSER_AUTOCONNECT_FAILED '+msg)};
const api=async(path,body,native=false)=>{
 const r=await fetch(host+root+path,{method:'POST',headers:{'content-type':'application/json',...(native?{}:{origin:host})},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error(path+' '+r.status+' '+JSON.stringify(data));return data;
};
const wait=(ws,p)=>new Promise((ok,no)=>{
 const timer=setTimeout(()=>{ws.off('message',listen);no(Error('WS_EVENT_TIMEOUT'))},17000);
 function listen(data){let m;try{m=JSON.parse(String(data))}catch{return}
  if(p(m)){clearTimeout(timer);ws.off('message',listen);ok(m)}}
 ws.on('message',listen);
});
let deviceWs,callWs,browser;
try{
 const registration=await api('/device/register',{id,key},true);
 assert(/\/communication-playground\/app\/[a-f0-9]{64}$/.test(registration.pageUrl),'unique durable URL');
 deviceWs=new WebSocket(host.replace('https','wss')+root+'/device/socket');
 await new Promise((ok,no)=>{deviceWs.once('open',ok);deviceWs.once('error',no)});
 const ready=wait(deviceWs,m=>m.type==='device.ready');
 deviceWs.send(JSON.stringify({type:'device.auth',id,key}));
 await ready;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const assignment=wait(deviceWs,m=>m.type==='device.assign');
 await page.goto(registration.pageUrl,{waitUntil:'domcontentloaded',timeout:35000});
 await page.getByRole('heading',{name:'16가지 통신 실험실'}).waitFor();
 await page.getByText('이 iPhone 기능 앱 전용 관리 페이지').waitFor({timeout:15000});
 const assigned=await assignment;
 assert(assigned.route.id===12&&assigned.side==='A','automatically attached app to N→W A');
 const url=host.replace('https','wss')+root+'/socket?id='+assigned.id+'&side=A&secret='+assigned.secret;
 callWs=new WebSocket(url);
 await new Promise((ok,no)=>{callWs.once('open',ok);callWs.once('error',no)});
 await page.getByText('양쪽 WS 실연결 성공').waitFor({timeout:16000});
 assert(await page.getByText(/JOIN CODE|PAIR CODE|8자리 참가코드/).count()===0,'numeric pairing removed from UI');
 const status=await api('/status',{id:assigned.id,secret:(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('hitel.communication.device-session.'+location.pathname.split('/').at(-1))||'{}'))).secret});
 assert(status.peers.A&&status.peers.B,'both native and web independently connected');
 assert(status.peerKinds.A==='native-protocol'&&status.peerKinds.B==='browser','roles correct');
 const priorSession=assigned.id;
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByText('양쪽 WS 실연결 성공').waitFor({timeout:18000});
 const afterReload=await page.evaluate(()=>{
  const token=location.pathname.split('/').at(-1);
  return JSON.parse(sessionStorage.getItem('hitel.communication.device-session.'+token)||'{}');
 });
 assert(afterReload.id===priorSession,'browser reload must keep original session ID');
 const still=await api('/status',{id:priorSession,secret:afterReload.secret});
 assert(still.peers.A&&still.peers.B&&still.peerKinds.A==='native-protocol',
  'web reload must not evict already connected native device');
 console.log('HITEL_PER_APP_PAGE_RELOAD_SESSION_RETAINED_PASS');
 await page.screenshot({path:'hitel-call-device-url-autoconnect.png',fullPage:true});
 if(errors.length)throw Error('Browser JS errors: '+errors.join('; '));
 console.log('HITEL_CALL_APP_UNIQUE_URL_REAL_BROWSER_AUTOCONNECT_PASS',{automatic:true,noPin:true,actualDeviceSocket:true,scenario:12,realIphoneHardware:false});
}finally{
 callWs?.close();deviceWs?.close();await browser?.close();
 await api('/device/unregister',{id,key},true).catch(()=>{});
}
