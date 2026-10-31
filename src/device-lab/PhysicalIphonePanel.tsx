import {useCallback,useEffect,useRef,useState} from 'react';

type DeviceInfo={name:string;ios:string;width:number;height:number};
type PhoneStatus={ok?:boolean;online?:boolean;paired?:boolean;pairCode?:string|null;pairExpiresAt?:string|null;
 deviceInfo?:DeviceInfo|null;lastFrameAt?:string|null;viewerToken?:string;error?:string;appPrepared?:boolean;approvalPending?:boolean};
const root='/lab-sandbox/physical-iphone';
const key='hitel-physical-iphone-viewer-v1';
export default function PhysicalIphonePanel(){
 const [token,setToken]=useState(()=>{try{return localStorage.getItem(key)||''}catch{return ''}});
 const [status,setStatus]=useState<PhoneStatus|null>(null);
 const [image,setImage]=useState('');
 const [frames,setFrames]=useState(0);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const socket=useRef<WebSocket|null>(null);
 const imageURL=useRef('');
 const cleanImage=useCallback((value:string)=>{
  if(imageURL.current)URL.revokeObjectURL(imageURL.current);
  imageURL.current=value;setImage(value);
 },[]);
 const session=useCallback(async(old:string)=>{
  setBusy(true);setError('');
  try{
   const response=await fetch(root+'/session',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({viewerToken:old})});
   const data=await response.json() as PhoneStatus;
   if(!response.ok||!data.ok||!data.viewerToken)throw Error(data.error||'연결정보 생성 실패');
   try{localStorage.setItem(key,data.viewerToken)}catch{}
   setToken(data.viewerToken);setStatus(data);
  }catch(e){setError(String(e))}finally{setBusy(false)}
 },[]);
 useEffect(()=>{if(token)void session(token)},[]);
 useEffect(()=>{
  if(!token)return;
  let disposed=false, timer:number|undefined;
  const connect=()=>{
   if(disposed)return;
   const url=window.location.origin.replace(/^http/,'ws')+root+'/socket?role=viewer&viewerToken='+encodeURIComponent(token);
   const ws=new WebSocket(url);socket.current=ws;ws.binaryType='blob';
   ws.onmessage=event=>{
    if(disposed)return;
    if(typeof event.data==='string'){
     try{const msg=JSON.parse(event.data) as PhoneStatus&{type?:string};
      if(msg.type==='status'){setStatus(old=>({...old,...msg}));if(!msg.online)cleanImage('')}
     }catch{}
    }else if(event.data instanceof Blob){
     const file=event.data.type==='image/jpeg'?event.data:new Blob([event.data],{type:'image/jpeg'});
     cleanImage(URL.createObjectURL(file));setFrames(n=>n+1);
    }
   };
   ws.onclose=()=>{if(disposed)return;setStatus(old=>old?{...old,online:false}:old);
    cleanImage('');timer=window.setTimeout(connect,3000);};
   ws.onerror=()=>ws.close();
  };
  connect();
  return()=>{disposed=true;if(timer!==undefined)clearTimeout(timer);socket.current?.close();cleanImage('')};
 },[token,cleanImage]);
 useEffect(()=>{
  if(!token)return;
  const poll=window.setInterval(async()=>{try{
   const r=await fetch(root+'/status',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({viewerToken:token})});
   if(r.ok){const value=await r.json() as PhoneStatus;setStatus(old=>({...old,...value}))}
  }catch{}},5000);
  return()=>clearInterval(poll);
 },[token]);
 const decide=async(action:'approve'|'reject')=>{
  if(!token)return;
  setBusy(true);setError('');
  try{
   const r=await fetch(root+'/'+action,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({viewerToken:token})});
   const body=await r.json() as {ok?:boolean;error?:string};
   if(!r.ok||!body.ok)throw Error(body.error||'연결 승인 요청 실패');
   setStatus(old=>old?{...old,approvalPending:false}:old);
  }catch(e){setError(String(e))}finally{setBusy(false)}
 };
 const stop=async()=>{
  if(!token)return;setBusy(true);
  try{
   const r=await fetch(root+'/stop',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({viewerToken:token})});
   if(!r.ok)throw Error('연결 종료 실패');
   try{localStorage.removeItem(key)}catch{}
   socket.current?.close();cleanImage('');setToken('');setStatus(null);setFrames(0);
  }catch(e){setError(String(e))}finally{setBusy(false)}
 };
 const online=Boolean(status?.online&&image);
 return <div style={{width:'100%',minWidth:0,display:'flex',flexDirection:'column',gap:11,
  padding:12,boxSizing:'border-box',background:'#f4f8fa',color:'#18384a'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
   <b>실제 iPhone · 화면 스트리밍</b>
   <span style={{fontSize:12,color:online?'#007a53':'#637482'}}>
    {online?'● 실시간 영상 수신 중':status?.online?'● iPhone 방송 연결 · 첫 프레임 대기':'● 실제 iPhone 연결 대기'}
   </span>
  </div>
  <div style={{background:'white',borderRadius:9,padding:12,fontSize:12}}>
   <strong>HITEL iPhone 화면 공유</strong>
   <p style={{margin:'7px 0'}}>실제 아이폰의 HITEL 앱에서 연결코드를 등록하고, ‘화면 방송 시작’을 선택하셔야 합니다.
    화면 전송은 Apple ReplayKit 방송 확장으로만 수행하며 시뮬레이터 영상으로 대체하지 않습니다.</p>
   <div style={{padding:12,border:'1px solid #d2e5ed',borderRadius:8,background:'#f4faff',display:'flex',flexDirection:'column',gap:8}}>
    <strong>무료 Apple ID · 7일 실기기 테스트 설치</strong>
    <span>유료 개발자 계정이나 TestFlight 없이 Windows PC에서 설치할 수 있습니다. 새 버전에는 화면 방송 시 8자리 코드를 직접 입력하는 설정 창이 포함됩니다.</span>
    <a href="https://github.com/lyonbegin/hitel-room/releases/download/hitel-iphone-free-7day-unsigned/HITEL-iPhone-Free-7day-unsigned.ipa"
     target="_blank" rel="noopener noreferrer"
     style={{padding:'10px 12px',background:'#145f77',color:'#fff',borderRadius:7,textDecoration:'none',fontWeight:700,textAlign:'center'}}>
     PC용 HITEL iPhone 무료 테스트 IPA 다운로드
    </a>
    <span style={{color:'#945d1a'}}>이 파일은 서명되지 않았습니다. 아이폰에서 직접 열어 설치할 수 없습니다.</span>
    <span>① Windows의 Sideloadly에 위 IPA를 넣으십시오.</span>
    <span>② 아이폰을 USB로 연결하고 무료 Apple ID로 서명·설치하십시오. Sideloadly의 고급 설정에서 <b>Dropping 0 of 2 plug-ins</b>를 유지하십시오.</span>
    <span>③ 새 HITEL 앱에서 '화면 공유 → 연결코드를 서버에 등록'을 누르십시오. 이어서 Apple <b>시스템 화면 방송 버튼</b>으로 방송을 시작하십시오.</span>
    <span>④ 실제 iPhone 연결 요청이 나타나면 이 웹에서 <b>방송 연결 승인</b>을 누르십시오. 승인 전에는 화면이 전달되지 않습니다.</span>
    <span style={{color:'#805d2d'}}>iOS 18에서 중단되는 구형 방송 설정 화면을 제거했습니다. 새 버전은 앱에서 서버에 8자리 코드를 직접 등록하므로 App Group이나 클립보드가 필요하지 않습니다.</span>
    <span>⑤ 무료 개발 앱은 7일 후 재서명이 필요합니다.</span>
    <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
     <a href="https://sideloadly.io/" target="_blank" rel="noopener noreferrer">Sideloadly 공식 설치 도구</a>
     <a href="https://github.com/lyonbegin/hitel-room/blob/feature/ws-scrcpy-android11-20261028/mobile/ios/PHYSICAL_IPHONE_FREE_7DAY.md"
      target="_blank" rel="noopener noreferrer">Windows·Mac 설치 상세 안내</a>
    </div>
   </div>
   {!token&&<button type="button" disabled={busy} onClick={()=>void session('')}
    style={{padding:'9px 12px',background:'#145f77',color:'#fff',border:0,borderRadius:7}}>실제 iPhone 연결 준비</button>}
   {token&&!status?.paired&&<div style={{textAlign:'center',marginTop:9}}>
    <div>실제 아이폰 앱에 입력할 8자리 연결코드</div>
    <div style={{fontSize:32,fontWeight:800,letterSpacing:5,margin:'10px 0',fontVariantNumeric:'tabular-nums'}}>{status?.pairCode||'발급 중'}</div>
    <div style={{color:'#687d87'}}>연결코드는 10분 동안 유효합니다.</div>
    <button disabled={busy} type="button" onClick={()=>void session(token)} style={{marginTop:9,padding:'6px 10px'}}>코드 갱신</button>
   </div>}
   {token&&status?.appPrepared&&!status?.approvalPending&&!status?.paired&&<p role="status" style={{color:'#0b6660'}}>아이폰의 연결코드가 확인됐습니다. 아이폰에서 시스템 화면 방송을 시작하십시오.</p>}
   {token&&status?.approvalPending&&<div role="region" aria-label="실제 iPhone 화면 방송 연결 승인" style={{background:'#fff7e6',border:'2px solid #d2982c',borderRadius:9,padding:12,display:'flex',flexDirection:'column',gap:9}}>
    <strong>실제 iPhone에서 화면 방송 연결을 요청했습니다.</strong>
    <span>직접 시작하신 화면 방송이 맞을 때만 승인하십시오. 승인 전에는 영상이 전달되지 않습니다.</span>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
     <button type="button" disabled={busy} onClick={()=>void decide('approve')} style={{padding:'10px 14px',border:0,borderRadius:8,background:'#146a52',color:'white',fontWeight:700}}>방송 연결 승인</button>
     <button type="button" disabled={busy} onClick={()=>void decide('reject')} style={{padding:'10px 14px',border:'1px solid #d0a16a',borderRadius:8,background:'white'}}>연결 거절</button>
    </div>
   </div>}
   {token&&status?.paired&&!online&&<p style={{margin:'7px 0 0'}}>기기 연결 정보가 저장되어 있습니다. 실제 아이폰에서 화면 방송을 다시 시작하십시오.</p>}
  </div>
  <div data-testid="physical-iphone-screen" style={{width:'100%',minHeight:online?0:340,display:'flex',alignItems:'center',
   justifyContent:'center',background:'#18232a',borderRadius:10,boxSizing:'border-box',padding:online?'12px 8px':16}}>
   {online?<img data-testid="physical-iphone-frame" draggable={false} src={image}
    alt="실제 iPhone에서 전송한 전체 화면" style={{display:'block',width:'min(100%, 440px)',height:'auto',maxHeight:'none',
     objectFit:'contain',aspectRatio:status?.deviceInfo?.width&&status?.deviceInfo?.height
      ?status.deviceInfo.width+' / '+status.deviceInfo.height:undefined}}/>:
    <div style={{textAlign:'center',color:'#deeaee',fontSize:13}}>
     실제 iPhone 화면을 기다리고 있습니다.
     <p style={{fontSize:11,color:'#92a9b6'}}>실제 기기에서 받은 영상만 표시합니다. 원격 터치·키보드 조작은 제공하지 않습니다.</p>
    </div>}
  </div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:7,flexWrap:'wrap',fontSize:11}}>
   <span>{status?.deviceInfo?status.deviceInfo.name+' · iOS '+status.deviceInfo.ios+' · '+status.deviceInfo.width+'×'+status.deviceInfo.height+' · ':''}
    수신 프레임 {frames}개</span>
   {token&&<button type="button" disabled={busy} onClick={()=>void stop()} style={{padding:'7px 11px'}}>연결 종료</button>}
  </div>
  {error&&<span role="alert" style={{color:'#b32638',fontSize:12}}>{error}</span>}
 </div>;
}
