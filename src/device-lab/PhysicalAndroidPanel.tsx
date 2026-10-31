import {useCallback,useEffect,useRef,useState} from 'react';
import apkInstallQr from './hitel-screen-apk-qr.svg';

type DeviceInfo={name:string;android:string;width:number;height:number};
type PhysicalStatus={ok?:boolean;online?:boolean;paired?:boolean;pairCode?:string|null;pairExpiresAt?:string|null;deviceInfo?:DeviceInfo|null;lastFrameAt?:string|null;viewerToken?:string;error?:string};
const KEY='hitel-physical-android-viewer-v1';
const ROOT='/lab-sandbox/physical';
export default function PhysicalAndroidPanel(){
 const [token,setToken]=useState(()=>{try{return localStorage.getItem(KEY)||''}catch{return ''}});
 const [status,setStatus]=useState<PhysicalStatus|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [image,setImage]=useState('');
 const [frames,setFrames]=useState(0);
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
 return <div style={{width:'100%',minHeight:590,display:'flex',flexDirection:'column',gap:9,padding:12,boxSizing:'border-box',background:'#f4f8fa',color:'#16394a'}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
   <b>삼성 갤럭시 노트9 · 실제 휴대전화 화면</b>
   <span style={{fontSize:12,color:connected?'#087651':'#6a7787'}}>{connected?'● 실제 화면 수신 중':status?.online?'● 휴대전화 연결 · 화면 대기':'● 실제 휴대전화 연결 대기'}</span>
  </div>
  <section aria-label="실제 갤럭시 노트9 HITEL Screen 앱 QR 설치" style={{background:'#fff',padding:'16px 12px',borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',gap:9,textAlign:'center'}}>
   <strong style={{fontSize:15,color:'#173e50'}}>노트9 앱 설치용 QR코드</strong>
   <span style={{fontSize:12,color:'#536b77'}}>갤럭시 노트9 카메라로 아래 QR코드를 스캔해 주십시오.</span>
   <img src={apkInstallQr} alt="HITEL Screen APK 직접 다운로드 주소가 담긴 QR코드" width={228} height={228}
    style={{display:'block',width:'min(100%, 228px)',height:'auto',aspectRatio:'1',background:'#fff',imageRendering:'pixelated'}}/>
   <span style={{fontSize:12,color:'#3c5a68',fontWeight:600}}>카메라 → QR 인식 → APK 다운로드 → 설치</span>
   <span style={{fontSize:11,color:'#738997'}}>다운로드 파일: HITEL-Screen-Note9.apk · GitHub 공식 저장소</span>
  </section>
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
  <div style={{flex:1,minHeight:340,display:'grid',placeItems:'center',border:'1px solid #d6e3e9',borderRadius:10,overflow:'hidden',background:'#18232a'}}>
   {connected?<img src={image} alt="연결된 실제 Android 휴대전화 화면" style={{height:'100%',maxHeight:680,maxWidth:'100%',objectFit:'contain'}}/>:
    <div style={{color:'#deeaee',textAlign:'center',padding:20,fontSize:14}}>실제 휴대전화 화면을 기다리고 있습니다.
     <p style={{fontSize:12,color:'#92a9b6'}}>저장된 이미지나 에뮬레이터 화면으로 대체하지 않습니다.</p>
    </div>}
  </div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
   <span style={{fontSize:11,color:'#667c88'}}>{status?.deviceInfo?status.deviceInfo.name+' · Android '+status.deviceInfo.android+' · '+status.deviceInfo.width+'×'+status.deviceInfo.height+' · ':''}수신 프레임 {frames}개</span>
   {token&&<button disabled={loading} onClick={()=>void stop()} style={{padding:'7px 12px',borderRadius:7,border:'1px solid #adc1c9',background:'white'}}>실제 휴대전화 연결 종료</button>}
  </div>
  {error&&<p role="alert" style={{color:'#a32532',fontSize:12}}>{error}</p>}
  <small style={{color:'#728793'}}>원격 조작은 아직 제공하지 않습니다. 현재 단계는 실제 기기의 화면 수신 확인입니다.</small>
 </div>;
}
