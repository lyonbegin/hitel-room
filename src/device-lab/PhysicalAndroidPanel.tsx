import {useCallback,useEffect,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent,FormEvent as ReactFormEvent} from 'react';
import apkInstallQr from './hitel-screen-apk-qr.svg';

type DeviceInfo={name:string;android:string;width:number;height:number};
type PhysicalStatus={ok?:boolean;online?:boolean;paired?:boolean;pairCode?:string|null;pairExpiresAt?:string|null;deviceInfo?:DeviceInfo|null;lastFrameAt?:string|null;viewerToken?:string;error?:string;accessibilityEnabled?:boolean};
type ControlAction='tap'|'longPress'|'swipe'|'text'|'erase'|'enter'|'home'|'back'|'recents'|'notifications';
const KEY='hitel-physical-android-viewer-v1';
const ROOT='/lab-sandbox/physical';
export default function PhysicalAndroidPanel(){
 const [token,setToken]=useState(()=>{try{return localStorage.getItem(KEY)||''}catch{return ''}});
 const [status,setStatus]=useState<PhysicalStatus|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [image,setImage]=useState('');
 const [frames,setFrames]=useState(0);
 const [inputText,setInputText]=useState('');
 const [controlNotice,setControlNotice]=useState('');
 const commandId=useRef(0);
 const gestureStart=useRef<{id:number;x:number;y:number;at:number}|null>(null);
 const ws=useRef<WebSocket|null>(null);
 const retry=useRef<number|null>(null);
 const imageRef=useRef('');
 const setImageSafe=useCallback((url:string)=>{
  if(imageRef.current)URL.revokeObjectURL(imageRef.current);
  imageRef.current=url;setImage(url);
 },[]);
 const openSession=useCallback(async(previous:string)=>{
  setLoading(true);setError('');
  try{
   const r=await fetch(ROOT+'/session',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({viewerToken:previous})});
   const body=await r.json() as PhysicalStatus;
   if(!r.ok||!body.ok||!body.viewerToken)throw Error(body.error||'연결 세션 생성 실패');
   try{localStorage.setItem(KEY,body.viewerToken)}catch{}
   setToken(body.viewerToken);setStatus(body);
  }catch(e){setError(String(e))}finally{setLoading(false)}
 },[]);
 useEffect(()=>{if(token)void openSession(token)},[]);
 useEffect(()=>{
  if(!token)return;
  let closed=false;
  function connect(){
   if(closed)return;
   const url=window.location.origin.replace(/^http/,'ws')+ROOT+'/socket?role=viewer&viewerToken='+encodeURIComponent(token);
   const socket=new WebSocket(url);ws.current=socket;socket.binaryType='blob';
   socket.onmessage=event=>{
    if(closed)return;
    if(typeof event.data==='string'){
     try{const data=JSON.parse(event.data) as PhysicalStatus & {type?:string};
      if(data.type==='status'){setStatus(old=>({...old,...data}));if(!data.online)setImageSafe('')}
      if(data.type==='controlAck'){
       setStatus(old=>old?{...old,accessibilityEnabled:data.accessibilityEnabled}:old);
       setControlNotice(data.ok?'휴대전화에서 명령 실행 확인':data.error==='ACCESSIBILITY_PERMISSION_REQUIRED'?
        '휴대전화의 HITEL Screen 앱에서 접근성 권한을 켜 주십시오.':
        '휴대전화 명령 실패: '+String(data.error||'알 수 없는 오류'));
      }
     }catch{}
    }else if(event.data instanceof Blob&&event.data.type==='image/jpeg'){
     setImageSafe(URL.createObjectURL(event.data));setFrames(n=>n+1);
    }else if(event.data instanceof Blob){
     setImageSafe(URL.createObjectURL(new Blob([event.data],{type:'image/jpeg'})));setFrames(n=>n+1);
    }
   };
   socket.onclose=()=>{if(closed)return;setStatus(old=>old?{...old,online:false}:old);setImageSafe('');retry.current=window.setTimeout(connect,3000)};
   socket.onerror=()=>socket.close();
  }
  connect();
  return()=>{closed=true;if(retry.current!==null)clearTimeout(retry.current);ws.current?.close();ws.current=null;setImageSafe('')};
 },[token,setImageSafe]);
 useEffect(()=>{
  if(!token)return;
  const timer=window.setInterval(async()=>{try{
   const r=await fetch(ROOT+'/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({viewerToken:token})});
   if(r.ok){const data=await r.json() as PhysicalStatus;setStatus(old=>({...old,...data}));}
  }catch{}},5500);
  return()=>window.clearInterval(timer);
 },[token]);
 const stop=async()=>{
  if(!token)return;setLoading(true);
  try{
   const r=await fetch(ROOT+'/stop',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({viewerToken:token})});
   if(!r.ok)throw Error('서버 종료 요청 실패');
   try{localStorage.removeItem(KEY)}catch{}
   setToken('');setStatus(null);setImageSafe('');setFrames(0);ws.current?.close();
  }catch(e){setError(String(e))}finally{setLoading(false)}
 };
 const connected=Boolean(status?.online&&image);
 const canControl=Boolean(status?.online);
 const sendControl=(action:ControlAction,data:Record<string,unknown>={})=>{
  const socket=ws.current;
  if(!socket||socket.readyState!==WebSocket.OPEN||!status?.online){
   setControlNotice('실제 휴대전화가 연결되지 않았습니다.');return;
  }
  const id=++commandId.current;
  socket.send(JSON.stringify({type:'control',id,action,...data}));
  setControlNotice('휴대전화 응답 대기…');
 };
 const point=(event:ReactPointerEvent<HTMLImageElement>)=>{
  const rect=event.currentTarget.getBoundingClientRect();
  return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width))),
   y:Math.max(0,Math.min(1,(event.clientY-rect.top)/Math.max(1,rect.height)))};
 };
 const pointerDown=(e:ReactPointerEvent<HTMLImageElement>)=>{
  if(!canControl||e.button!==0)return;
  e.preventDefault();
  const p=point(e);
  gestureStart.current={id:e.pointerId,x:p.x,y:p.y,at:Date.now()};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const pointerUp=(e:ReactPointerEvent<HTMLImageElement>)=>{
  const start=gestureStart.current;
  if(!start||start.id!==e.pointerId)return;
  gestureStart.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  e.preventDefault();
  const end=point(e),elapsed=Date.now()-start.at;
  const distance=Math.hypot(end.x-start.x,end.y-start.y);
  if(distance<0.018)sendControl(elapsed>=650?'longPress':'tap',{x:start.x,y:start.y});
  else sendControl('swipe',{x:start.x,y:start.y,endX:end.x,endY:end.y,duration:Math.max(120,Math.min(2000,elapsed))});
 };
 const inputSubmit=(e:ReactFormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  if(inputText.length>0){sendControl('text',{text:inputText});}
 };
 return <div style={{width:'100%',minHeight:590,display:'flex',flexDirection:'column',gap:9,padding:12,boxSizing:'border-box',background:'#f4f8fa',color:'#16394a'}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
   <b>삼성 갤럭시 노트9 · 실제 휴대전화 화면</b>
   <span style={{fontSize:12,color:connected?'#087651':'#6a7787'}}>{connected?'● 실제 화면 수신 중':status?.online?'● 휴대전화 연결 · 화면 대기':'● 실제 휴대전화 연결 대기'}</span>
  </div>
  {!status?.paired&&<section aria-label="실제 갤럭시 노트9 HITEL Screen 앱 QR 설치" style={{background:'#fff',padding:'16px 12px',borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',gap:9,textAlign:'center'}}>
   <strong style={{fontSize:15,color:'#173e50'}}>노트9 앱 설치용 QR코드</strong>
   <span style={{fontSize:12,color:'#536b77'}}>갤럭시 노트9 카메라로 아래 QR코드를 스캔해 주십시오.</span>
   <img src={apkInstallQr} alt="HITEL Screen APK 직접 다운로드 주소가 담긴 QR코드" width={228} height={228}
    style={{display:'block',width:'min(100%, 228px)',height:'auto',aspectRatio:'1',background:'#fff',imageRendering:'pixelated'}}/>
   <span style={{fontSize:12,color:'#3c5a68',fontWeight:600}}>카메라 → QR 인식 → APK 다운로드 → 설치</span>
   <span style={{fontSize:11,color:'#738997'}}>다운로드 파일: HITEL-Screen-Note9.apk · GitHub 공식 저장소</span>
  </section>}
  {!token&&<div style={{padding:12,background:'white',borderRadius:9}}>
   <p style={{fontSize:13}}>실제 휴대전화용 HITEL Screen 앱의 화면 공유 권한을 사용합니다. Android 11 에뮬레이터 화면과 무관합니다.</p>
   <button disabled={loading} onClick={()=>void openSession('')} style={{background:'#12647b',color:'white',border:0,borderRadius:7,padding:'12px 18px',fontWeight:700}}>실제 Android 연결 준비</button>
  </div>}
  {token&&!status?.paired&&<div style={{background:'white',padding:13,borderRadius:9,textAlign:'center'}}>
   <div style={{fontSize:12}}>노트9의 HITEL Screen 앱에 다음 연결코드를 입력하십시오.</div>
   <div style={{fontSize:34,letterSpacing:5,fontWeight:800,fontVariantNumeric:'tabular-nums',margin:'12px 0'}}>{status?.pairCode||'코드 발급 중'}</div>
   <div style={{fontSize:12}}>화면 공유는 휴대전화에서 직접 승인하셔야 시작됩니다. 연결코드는 10분 동안 유효합니다.</div>
   <button disabled={loading} onClick={()=>void openSession(token)} style={{marginTop:10,padding:'6px 11px',borderRadius:6}}>연결코드 갱신</button>
  </div>}
  {token&&status?.paired&&!status.online&&<div style={{background:'white',padding:13,borderRadius:9,fontSize:13}}>휴대전화 연결 정보는 보관되어 있습니다. HITEL Screen 앱을 열어 ‘화면 공유 시작’을 누르면 같은 연결로 다시 수신합니다.</div>}
  <div data-testid="physical-android-screen" style={{
    flex:'0 0 auto',
    width:'100%',
    minHeight:connected?0:340,
    boxSizing:'border-box',
    display:'flex',
    flexDirection:'column',
    alignItems:'center',
    justifyContent:'center',
    padding:connected?'12px 8px':16,
    border:'1px solid #d6e3e9',
    borderRadius:10,
    background:'#18232a'
   }}>
   {connected?<img src={image} alt="연결된 실제 Android 휴대전화 전체 화면 · 클릭하여 원격 터치하거나 끌어서 스와이프"
     data-testid="physical-android-frame"
     onPointerDown={pointerDown}
     onPointerUp={pointerUp}
     onPointerCancel={()=>{gestureStart.current=null}}
     onContextMenu={e=>{e.preventDefault();sendControl('back')}}
     draggable={false}
     style={{
       display:'block',
       width:'min(100%, 440px)',
       height:'auto',
       maxWidth:'100%',
       maxHeight:'none',
       objectFit:'contain',
       touchAction:'none',
       userSelect:'none',
       cursor:canControl?'crosshair':'default',
       aspectRatio:status?.deviceInfo?.width&&status?.deviceInfo?.height
         ?status.deviceInfo.width+' / '+status.deviceInfo.height
         :undefined
     }}/>:
    <div style={{color:'#deeaee',textAlign:'center',padding:20,fontSize:14}}>실제 휴대전화 화면을 기다리고 있습니다.
     <p style={{fontSize:12,color:'#92a9b6'}}>저장된 이미지나 에뮬레이터 화면으로 대체하지 않습니다.</p>
    </div>}
  </div>
  <section aria-label="실제 안드로이드 원격 조작" style={{background:'#fff',padding:12,borderRadius:10,display:'flex',flexDirection:'column',gap:10}}>
   <b style={{fontSize:13}}>노트9 원격 터치 · 키보드</b>
   <span style={{fontSize:12,color:status?.accessibilityEnabled?'#087651':'#965418'}}>
    접근성 권한: {status?.accessibilityEnabled?'사용 가능':'미승인 또는 확인 대기 · 노트9의 HITEL Screen 앱에서 원격 터치 접근성 권한을 승인하십시오.'}
   </span>
   <span style={{fontSize:12,color:'#526875'}}>위의 실제 화면을 누르면 터치, 길게 누르면 롱프레스, 끌면 스와이프가 전달됩니다.</span>
   <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
    {(['home','back','recents','notifications','enter','erase'] as const).map(action=>
     <button key={action} type="button" disabled={!canControl} onClick={()=>sendControl(action)}
      style={{padding:'9px 12px',background:'#f1f7fa',color:'#205468',border:'1px solid #c7dce5',borderRadius:7,cursor:canControl?'pointer':'not-allowed'}}>
      {{home:'⌂ 홈',back:'← 뒤로',recents:'최근 앱',notifications:'알림창',enter:'↵ 엔터',erase:'⌫ 지우기'}[action]}
     </button>)}
   </div>
   <form onSubmit={inputSubmit} style={{display:'flex',gap:7,flexWrap:'wrap'}}>
    <input aria-label="실제 노트9 선택된 입력칸에 넣을 문자" value={inputText}
     onChange={e=>setInputText(e.target.value)} placeholder="휴대전화 입력칸 선택 후 여기에 문자 입력"
     maxLength={4000} style={{flex:'1 1 180px',minWidth:0,padding:'9px 10px',borderRadius:7,border:'1px solid #b7cbd5'}}/>
    <button type="submit" disabled={!canControl||!inputText}
     style={{padding:'9px 13px',background:'#115e72',color:'white',border:0,borderRadius:7}}>문자 입력</button>
   </form>
   {controlNotice&&<span role="status" style={{fontSize:12,color:controlNotice.includes('실패')||controlNotice.includes('권한')?'#a22e2e':'#23556a'}}>{controlNotice}</span>}
  </section>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
   <span style={{fontSize:11,color:'#667c88'}}>{status?.deviceInfo?status.deviceInfo.name+' · Android '+status.deviceInfo.android+' · '+status.deviceInfo.width+'×'+status.deviceInfo.height+' · ':''}수신 프레임 {frames}개</span>
   {token&&<button disabled={loading} onClick={()=>void stop()} style={{padding:'7px 12px',borderRadius:7,border:'1px solid #adc1c9',background:'white'}}>실제 휴대전화 연결 종료</button>}
  </div>
  {error&&<p role="alert" style={{color:'#a32532',fontSize:12}}>{error}</p>}
  <small style={{color:'#728793'}}>원격 조작은 휴대전화에서 접근성 서비스 사용을 명시적으로 허용해야 작동합니다. 화면 공유·접근성 권한은 휴대전화에서 언제든 해제할 수 있습니다.</small>
 </div>;
}
