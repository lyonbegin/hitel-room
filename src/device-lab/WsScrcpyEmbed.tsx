import {useEffect,useState} from 'react';
type NativeStatus={ok?:boolean;online?:boolean;url?:string;launchAvailable?:boolean;launchState?:string;reason?:string};
type Viewer={url:string;player:'webcodecs'|'mse';host:string};
const STATUS='/lab-sandbox/ws-scrcpy/status';
const VERIFY_TIMEOUT=5500;
function allowedHost(url:string):boolean{
 try{
  const u=new URL(url);
  return u.protocol==='https:' && /^[a-z0-9-]+\.trycloudflare\.com$/.test(u.hostname)
   && (u.pathname==='/'||u.pathname==='') && !u.search && !u.hash;
 }catch{return false}
}
async function verifyHost(base:string):Promise<boolean>{
 const controller=new AbortController();
 const timer=window.setTimeout(()=>controller.abort(),VERIFY_TIMEOUT);
 try{
  const r=await fetch(base+'/__hitel_ws_scrcpy',{cache:'no-store',
   mode:'cors',credentials:'omit',signal:controller.signal});
  if(!r.ok)return false;
  const value=await r.json() as {engine?:string;androidVersion?:string;vnc?:boolean};
  return value.engine==='ws-scrcpy'&&value.androidVersion==='11'&&value.vnc===false;
 }catch{return false}finally{window.clearTimeout(timer)}
}
export function WsScrcpyEmbed(){
 const [viewer,setViewer]=useState<Viewer|null>(null);
 const [state,setState]=useState('실제 Android 11 ws-scrcpy 실행 대기');
 const [launchAvailable,setLaunchAvailable]=useState(false);
 const [starting,setStarting]=useState(false);
 const start=async()=>{
  if(starting||!launchAvailable)return;
  setStarting(true);
  try{
   const response=await fetch('/lab-sandbox/ws-scrcpy/start',{
    method:'POST',headers:{'content-type':'application/json'},
    credentials:'same-origin',body:'{}'
   });
   const data=await response.json() as {ok?:boolean;error?:string};
   if(!response.ok||!data.ok)throw Error(data.error||'실제 KVM 시작 실패');
   setState('GitHub KVM 실행 요청 접수 · 실제 Android 부팅/영상 확인 전');
  }catch(e){setState('실제 Android 실행 요청 실패: '+String(e));}
  finally{setStarting(false)}
 };
 const [player,setPlayer]=useState<'webcodecs'|'mse'>('mse');
 useEffect(()=>{
  let alive=true;
  const test=async()=>{
   const Decoder=(window as unknown as {VideoDecoder?:{isConfigSupported:
      (config:{codec:string;codedWidth:number;codedHeight:number})=>Promise<{supported:boolean}>}}).VideoDecoder;
   if(!Decoder?.isConfigSupported)return;
   try{
    const result=await Decoder.isConfigSupported({codec:'avc1.42E01E',codedWidth:512,codedHeight:1088});
    if(alive&&result.supported)setPlayer('webcodecs');
   }catch{/* MSE remains the verified-compatible fallback */}
  };
  void test();
  return()=>{alive=false};
 },[]);
 useEffect(()=>{
  let mounted=true,checking=false;
  const tick=async()=>{
   if(checking)return;checking=true;
   try{
    const r=await fetch(STATUS,{cache:'no-store',credentials:'same-origin'});
    if(!r.ok)throw Error('native host status HTTP '+r.status);
    const info=await r.json() as NativeStatus;
    if(mounted)setLaunchAvailable(Boolean(info.launchAvailable));
    const base=String(info.url||'').replace(/\/$/,'');
    if(!info.online||!allowedHost(base)||!(await verifyHost(base))){
     if(mounted){setViewer(null);setState(info.launchState==='queued'?'GitHub KVM 요청 접수 · Android 11 기동 중':'실제 ws-scrcpy Android 11 호스트 연결 대기');}
     return;
    }
    const host=new URL(base).host;
    // ws-scrcpy's own adb-proxy WebSocket; this is H.264, NOT VNC.
    const ws='wss://'+host+'/?action=proxy-adb&udid=emulator-5554&remote=tcp%3A8886';
    const hash=new URLSearchParams({action:'stream',udid:'emulator-5554',
      player,ws,fitToScreen:'1',captureKeyboard:'1'});
    if(mounted){setViewer({url:base+'/#!'+hash.toString(),player,host});setState('실제 Android 11 영상 연결됨');}
   }catch{
    if(mounted){setViewer(null);setState('Android 호스트 상태 확인 중');}
   }finally{checking=false;}
  };
  void tick();const interval=window.setInterval(()=>void tick(),3500);
  return()=>{mounted=false;window.clearInterval(interval);}
 },[player]);
 if(!viewer)return <div role="status" style={{minHeight:520,display:'grid',placeContent:'center',
  padding:20,textAlign:'center',gap:10,color:'#577281'}}>
  <strong>{state}</strong>
  <span>GitHub KVM에서 원본 Android 11과 ws-scrcpy가 실제 실행된 경우에만 영상이 표시됩니다.</span>
  <span>VNC·noVNC 또는 저장된 화면으로 대체하지 않습니다.</span>
  <button type="button" onClick={()=>void start()} disabled={!launchAvailable||starting}
    style={{maxWidth:220,margin:'8px auto',padding:10,border:'1px solid #8daeb7',
     borderRadius:8,background:launchAvailable?'#115e72':'#ddd',color:launchAvailable?'white':'#555'}}>
    {starting?'Android 시작 요청 중…':'▶ Android 11 실제 실행'}
  </button>
  {!launchAvailable&&<small>GitHub KVM 실행 API가 연결되면 이 버튼이 활성화됩니다. GitHub 화면으로 이동할 필요는 없습니다.</small>}
 </div>;
 return <div style={{display:'flex',height:'100%',minHeight:570,flexDirection:'column'}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
   padding:'8px 12px',fontSize:12,color:'#174f61',background:'#edf9fa'}}>
   <span style={{display:'flex',gap:8,alignItems:'center'}}>
    <strong>● Android 11 · ws-scrcpy H.264</strong>
    <label style={{display:'flex',gap:4,alignItems:'center'}}>디코더
      <select aria-label="Android 영상 디코더 선택" value={player}
        onChange={e=>setPlayer(e.target.value as 'webcodecs'|'mse')}
        style={{padding:'3px 5px',borderRadius:5}}>
        <option value="webcodecs">WebCodecs</option>
        <option value="mse">MSE (호환 모드)</option>
      </select>
    </label>
   </span>
   <span style={{display:'flex',alignItems:'center',gap:10}}>
    <a href={viewer.url} target="_blank" rel="noopener noreferrer">실제 화면 새 창 ↗</a>
    <button type="button" onClick={()=>{void fetch('/lab-sandbox/ws-scrcpy/stop',{
      method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'
    }).then(()=>{setViewer(null);setState('일회용 Android 종료 요청됨');});}}
      style={{padding:'4px 9px',border:'1px solid #97aeb8',borderRadius:6,background:'white'}}>Android 종료</button>
   </span>
  </div>
  <iframe key={viewer.url} title="GitHub KVM 원본 Android 11 ws-scrcpy H264 터치 화면"
   src={viewer.url} allow="clipboard-read; clipboard-write" referrerPolicy="no-referrer"
   style={{width:'100%',flex:1,minHeight:530,border:0}}/>
 </div>;
}
