import HitelPortal from './HitelPortal';
import HitelHome from './HitelHome';

import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, issueDevToken, listMyConsultations, createConsultation, getHealth } from './lib/api';
import { createRealtimeSocket, emitAck, waitForSocketReady } from './realtime/socket';
import { MediasoupSession } from './realtime/MediasoupSession';
import { openVideoCoreCamera, type CameraMode, type VideoCoreCameraSession } from './lib/videoCore';
import { listPublicRooms, publishPublicRoom, enterPublicRoom, type PublicRoom } from './lib/publicRooms';
import VideoTile from './components/VideoTile';
import type { AuthProfile, ConsultationSession, RemoteTile, TelemedicineRole } from './types';
import type { Socket } from 'socket.io-client';

const PROFILE_KEY='hitel-room-profile-v1';
const statusNames: Record<string,string>={SCHEDULED:'개설됨',WAITING:'대기 중',READY:'준비 완료',LIVE:'대화 진행 중',ENDED:'종료',CANCELLED:'취소'};
const errorText=(e:unknown)=>e instanceof Error?e.message:String(e);
function getSaved(): AuthProfile|null { try {const v=sessionStorage.getItem(PROFILE_KEY);return v?JSON.parse(v) as AuthProfile:null;} catch{return null;} }
function Brand(){return <div className="brand"><span className="brand-icon">ㅎ</span><div><strong>하이텔 방</strong><small>사람과 사람이 만나는 공간</small></div></div>;}
function Login({onLogin}:{onLogin:(x:AuthProfile)=>void}){
 const [id,setId]=useState('doctor-1'),[name,setName]=useState('방장'),[role,setRole]=useState<'doctor'|'user'>('doctor'),[status,setStatus]=useState('서버 확인 중'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{getHealth().then(()=>setStatus('기존 영상 서버 연결됨')).catch(()=>setStatus('기존 영상 서버 응답 없음'));},[]);
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const p=await issueDevToken({userId:id.trim(),name:name.trim(),platformRole:role});sessionStorage.setItem(PROFILE_KEY,JSON.stringify(p));onLogin(p);}catch(e){setError(errorText(e))}finally{setBusy(false)}}
 return <main className="auth-layout"><section className="intro"><Brand/><div className="intro-main"><span className="eyebrow">WELCOME TO HITEL ROOM</span><h1>이야기가 모이고,<br/><em>사람이 연결됩니다.</em></h1><p>서로 이야기하고, 공개 방을 만들거나 목록에서 선택하여 얼굴을 보며 대화하세요. 기존 WebRTC 서버로 연결되는 독립 커뮤니티 클라이언트입니다.</p><div className="intro-tags"><span>1:1 영상 대화</span><span>그룹 영상방</span><span>실시간 음성</span></div></div><div className="intro-foot">HITEL ROOM · WEBRTC CLIENT</div></section><section className="auth-panel"><div className="auth-card"><span className="kicker">대화 시작하기</span><h2>내 이름으로 입장</h2><p className="muted">개발용 로그인입니다. 로그인 후 공개 대화방 목록이 표시됩니다.</p><p className="server-status">● {status}</p><form onSubmit={login}><label>사용자 ID<input required value={id} onChange={e=>setId(e.target.value)} placeholder="doctor-1"/></label><label>표시 이름<input required value={name} onChange={e=>setName(e.target.value)} placeholder="이름"/></label><label>접속 유형<select value={role} onChange={e=>setRole(e.target.value as 'doctor'|'user')}><option value="doctor">방 개설 사용자</option><option value="user">방 목록 입장 사용자</option></select></label>{error&&<p className="error">{error}</p>}<button className="primary" type="submit" disabled={busy}>{busy?'인증 중…':'대화방 입장하기 →'}</button></form><p className="auth-note">공개방의 실제 입장은 기존 WebRTC 서버가 허용하는 경우에만 가능합니다.</p></div></section></main>;
}
function Room({profile, initial, onClose}:{profile:AuthProfile,initial:ConsultationSession,onClose:()=>void}){
 const [session,setSession]=useState(initial),[connection,setConnection]=useState('연결 중'),[stream,setStream]=useState<MediaStream>(),[remote,setRemote]=useState<RemoteTile[]>([]),[ready,setReady]=useState(false),[live,setLive]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[mic,setMic]=useState(true),[camera,setCamera]=useState(true),[cameraMode,setCameraMode]=useState<CameraMode>('original'),[trackingFps,setTrackingFps]=useState<number|null>(null);
 const socket=useRef<Socket|null>(null),engine=useRef<MediasoupSession|null>(null),streamRef=useRef<MediaStream|null>(null),cameraSdkRef=useRef<VideoCoreCameraSession|null>(null);
 const rtcJoining=useRef(false);
 const leaving=useRef(false);
 function releaseCamera(){
  cameraSdkRef.current?.stop();cameraSdkRef.current=null;
  streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
  setStream(undefined);setRemote([]);setReady(false);setLive(false);setTrackingFps(null);
 }
 const isHost=session.hostUserIds.includes(profile.userId);
 useEffect(()=>{let dead=false,joinedOnce=false,rejoinNeeded=false,rejoining=false;
 const sock=createRealtimeSocket(API_BASE_URL,profile.token);socket.current=sock;
 const started=(p:{session:ConsultationSession})=>{
  if(p.session.id!==initial.id||dead||leaving.current)return;
  setSession(p.session);
  setConnection('대화 시작됨 — 영상 연결 중');
  if(streamRef.current)void joinRtc(streamRef.current);
 };
 const ended=(p:{session:ConsultationSession})=>{
  if(p.session.id!==initial.id||dead)return;
  setSession(p.session);
  const existing=engine.current;engine.current=null;
  void existing?.dispose(false);
  releaseCamera();
  setConnection('대화가 종료되었습니다.');
 };
 const recover=async()=>{
  if(dead||!joinedOnce||!rejoinNeeded||rejoining||leaving.current)return;
  rejoining=true;rejoinNeeded=false;
  try {
   const x=await emitAck<{session:ConsultationSession}>(sock,'session:join',{sessionId:initial.id});
   if(dead)return;
   setSession(x.session);
   setReady(Boolean(x.session.participants.find(p=>p.userId===profile.userId)?.ready));
   const previous=engine.current;engine.current=null;
   await previous?.dispose(false);
   setLive(false);
   if(x.session.status==='ENDED'||x.session.status==='CANCELLED'){
    releaseCamera();setConnection('대화 종료됨');return;
   }
   if(x.session.status==='LIVE'&&streamRef.current){
    const restored=await joinRtc(streamRef.current);
    if(!restored)throw new Error('방 재참가 후 영상 연결을 복원하지 못했습니다.');
   }
   setConnection('실시간 연결 복원됨');
  }catch(e){if(!dead){setError('재연결 실패: '+errorText(e));rejoinNeeded=true;}}
  finally{rejoining=false;}
 };
 sock.on('session:started',started);
 sock.on('session:ended',ended);
 sock.on('disconnect',()=>{rejoinNeeded=joinedOnce;setConnection('연결 재시도 중');});
 sock.on('connection:ready',()=>{void recover();});
 sock.on('connect_error',()=>setConnection('실시간 서버 연결 실패'));
 (async()=>{try{
  await waitForSocketReady(sock);
  if(dead)return;
  const x=await emitAck<{session:ConsultationSession}>(sock,'session:join',{sessionId:initial.id});
  if(!dead){
   joinedOnce=true;setSession(x.session);
   setReady(Boolean(x.session.participants.find(p=>p.userId===profile.userId)?.ready));
   setConnection('서버에 연결됨');
   if(x.session.status==='LIVE'&&streamRef.current)void joinRtc(streamRef.current);
  }
 }catch(e){if(!dead)setError(errorText(e));}})();
 return ()=>{dead=true;const previous=engine.current;engine.current=null;
  void previous?.dispose(false);
  cameraSdkRef.current?.stop();cameraSdkRef.current=null;
  streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
  sock.disconnect();socket.current=null;
 };
 },[initial.id,initial.mediaNodePublicUrl,profile.token,profile.userId]);

 async function devices(){
 if(engine.current?.isStarted())return;
 setBusy(true);setError('');
 try{
  cameraSdkRef.current?.stop();cameraSdkRef.current=null;
  const sdkCamera=await openVideoCoreCamera(cameraMode);
  cameraSdkRef.current=sdkCamera;
  streamRef.current=sdkCamera.stream;
  setStream(sdkCamera.stream);setMic(true);setCamera(true);
  if(session.status==='LIVE')await joinRtc(sdkCamera.stream);
  else if(socket.current?.connected){
   if(!ready){
    const updated=await emitAck<{session:ConsultationSession}>(socket.current,'session:ready',{sessionId:session.id,ready:true});
    setSession(updated.session);setReady(true);
   }
   if(isHost){
    const started=await emitAck<{session:ConsultationSession}>(socket.current,'session:start',{sessionId:session.id});
    setSession(started.session);
    await joinRtc(sdkCamera.stream);
   }
  }
 }catch(e){setError(errorText(e));}finally{setBusy(false);}
}
async function changeVideoMode(next:CameraMode){
 if(next===cameraMode)return;
 if(!cameraSdkRef.current){setCameraMode(next);return;}
 setBusy(true);setError('');
 try{
  const newStream=await cameraSdkRef.current.setMode(next);
  newStream.getAudioTracks().forEach(t=>t.enabled=mic);
  newStream.getVideoTracks().forEach(t=>t.enabled=camera);
  if(engine.current?.isStarted())await engine.current.replaceLocalTracks(newStream);
  streamRef.current=newStream;setStream(newStream);setCameraMode(next);
 }catch(e){setError(errorText(e))}finally{setBusy(false);}
}
useEffect(()=>{
 if(cameraMode!=='mask'||!stream){setTrackingFps(null);return;}
 const update=()=>setTrackingFps(cameraSdkRef.current?.getTrackingStatus()?.fps??null);
 update();const timer=window.setInterval(update,500);
 return ()=>window.clearInterval(timer);
},[cameraMode,stream]);
 async function joinRtc(s=streamRef.current??stream):Promise<boolean>{
 if(!s||!socket.current?.connected||leaving.current||rtcJoining.current||engine.current?.isStarted())return false;
 rtcJoining.current=true;setBusy(true);setError('');
 const current=new MediasoupSession(socket.current,initial.id,setRemote,setConnection);engine.current=current;
 try{
  await current.start(s,false);
  if(engine.current===current&&!leaving.current){setLive(true);return true;}
  await current.dispose(false);
  return false;
 }catch(e){
  if(engine.current===current)engine.current=null;
  await current.dispose(socket.current?.connected??false).catch(()=>undefined);
  setLive(false);setError('영상 연결 실패: '+errorText(e));
  return false;
 }finally{rtcJoining.current=false;setBusy(false);}
}
 async function markReady(){if(!stream||!socket.current)return;setBusy(true);setError('');try{const x=await emitAck<{session:ConsultationSession}>(socket.current,'session:ready',{sessionId:session.id,ready:true});setSession(x.session);setReady(true);}catch(e){setError(errorText(e))}finally{setBusy(false)}}
 async function start(){if(!stream||!socket.current)return;setBusy(true);setError('');try{if(!ready){const x=await emitAck<{session:ConsultationSession}>(socket.current,'session:ready',{sessionId:session.id,ready:true});setSession(x.session);setReady(true);}const x=await emitAck<{session:ConsultationSession}>(socket.current,'session:start',{sessionId:session.id});setSession(x.session);await joinRtc(stream);}catch(e){setError(errorText(e));}finally{setBusy(false)}}
 async function exit(){
  if(leaving.current)return;
  leaving.current=true;const current=engine.current;engine.current=null;
  await current?.dispose(socket.current?.connected??false).catch(()=>undefined);
  if(socket.current?.connected)await emitAck(socket.current,'session:leave',{sessionId:session.id},4000).catch(()=>undefined);
  releaseCamera();onClose();
 }
 async function end(){if(!socket.current||!window.confirm('모든 참가자의 대화를 종료하시겠습니까?'))return;setBusy(true);try{const x=await emitAck<{session:ConsultationSession}>(socket.current,'session:end',{sessionId:session.id});
 setSession(x.session);const current=engine.current;engine.current=null;
 await current?.dispose(false);releaseCamera();}catch(e){setError(errorText(e))}finally{setBusy(false);}}
 async function toggleMic(){const x=!mic;setMic(x);stream?.getAudioTracks().forEach(t=>t.enabled=x);try{await engine.current?.setMicrophoneEnabled(x)}catch(e){setError(errorText(e));}}
 async function toggleCamera(){const x=!camera;setCamera(x);stream?.getVideoTracks().forEach(t=>t.enabled=x);try{await engine.current?.setCameraEnabled(x)}catch(e){setError(errorText(e));}}
 return <main className="room-layout"><header className="page-top"><Brand/><button className="outline" onClick={()=>void exit()}>← 목록으로</button></header><section className="room-head"><div><span className="kicker">영상 대화방</span><h1>{session.title||'대화방'}</h1><p>참여자 {session.participants.length}명 · {statusNames[session.status]||session.status} · {connection}</p></div><div className="room-participants">{session.participants.map(p=><span key={p.userId} title={p.userId}>{p.displayName||p.userId}</span>)}</div></section>{error&&<p className="error wide">{error}</p>}<section className="video-grid"><VideoTile stream={stream} label={profile.name+' (나)'} muted local/>{remote.map(t=><VideoTile key={t.key} stream={t.stream} label={session.participants.find(p=>p.userId===t.userId)?.displayName||t.userId} screen={t.source==='screen'}/>)}{!stream&&<div className="video-empty"><div>◎</div><h3>카메라를 준비해주세요</h3><p>버튼을 누르기 전에는 카메라나 마이크를 켜지 않습니다.</p></div>}</section><section className="controls"><button className={cameraMode==='mask'?'primary narrow':'outline'} disabled={busy} onClick={()=>void changeVideoMode('mask')}>🎭 가면 영상</button><button className={cameraMode==='original'?'primary narrow':'outline'} disabled={busy} onClick={()=>void changeVideoMode('original')}>📷 원본 영상</button><button className="outline" disabled={busy||live||session.status==='ENDED'||session.status==='CANCELLED'} onClick={()=>void devices()}>{stream?'카메라 다시 준비':'카메라·마이크 준비 (자동 준비 완료)'}</button><button className="outline" disabled={!stream||busy||ready||session.status==='ENDED'||session.status==='LIVE'} onClick={()=>void markReady()}>{ready?'✓ 준비 완료':'준비 완료'}</button>{isHost?<button className="primary narrow" disabled={!stream||busy||live||session.status==='LIVE'||session.status==='ENDED'||session.status==='CANCELLED'} onClick={()=>void start()}>{busy?'진행 중…':'대화 시작'}</button>:<button className="primary narrow" disabled={!stream||busy||session.status!=='LIVE'||live} onClick={()=>void joinRtc()}>영상 연결</button>}<button className="outline" disabled={!stream} onClick={()=>void toggleMic()}>{mic?'🎙 마이크 끄기':'마이크 켜기'}</button><button className="outline" disabled={!stream} onClick={()=>void toggleCamera()}>{camera?'📷 카메라 끄기':'카메라 켜기'}</button>{isHost&&<button className="danger" disabled={busy} onClick={()=>void end()}>방 종료</button>}</section><p className="hint">선택된 영상 모드: {cameraMode==='mask'?'🎭 가면':'📷 원본'}{trackingFps!==null&&cameraMode==='mask'?' · 얼굴 추적 '+trackingFps.toFixed(1)+' FPS':''} · <a href="/sdk-playground.html" target="_blank" rel="noopener noreferrer">VideoCore SDK 플레이그라운드 열기 ↗</a></p><p className="hint">참여자는 다른 브라우저에서 자기 사용자 ID로 로그인해 초대된 방을 열 수 있습니다. 서버가 지원하는 세션에만 연결합니다.</p></main>;
}
function Lobby({profile,onLogout,onOpen}:{profile:AuthProfile,onLogout:()=>void,onOpen:(s:ConsultationSession)=>void}){
 const [rooms,setRooms]=useState<PublicRoom[]>([]);
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[joining,setJoining]=useState<string|null>(null);
 const [error,setError]=useState(''),[open,setOpen]=useState(false);
 const [title,setTitle]=useState('새 영상 대화방'),[maxPeople,setMaxPeople]=useState(8);
 const active=rooms.filter(r=>r.status==='OPEN');
 async function refresh(showLoader=false){
  if(showLoader)setLoading(true);
  try {setRooms(await listPublicRooms());setError('');}
  catch(e){setError(errorText(e));}
  finally{if(showLoader)setLoading(false);}
 }
 useEffect(()=>{
  let active=true;
  void listPublicRooms().then(data=>{if(active)setRooms(data);}).catch(e=>{if(active)setError(errorText(e));});
  const timer=window.setInterval(()=>{void listPublicRooms().then(data=>{if(active)setRooms(data);}).catch(()=>undefined);},4000);
  return ()=>{active=false;window.clearInterval(timer);};
 },[]);
 async function create(e:React.FormEvent){
  e.preventDefault();if(saving)return;
  setSaving(true);setError('');
  try{
   const name=title.trim();
   if(!name)throw new Error('방 이름을 입력해 주십시오.');
   const size=Math.max(2,Math.min(50,maxPeople));
   const s=await createConsultation(profile.token,{
     title:name,
     participants:[{userId:profile.userId,displayName:profile.name,role:'DOCTOR'}],
     maxParticipants:size,
     policy:{allowUnlistedParticipants:true,waitingRoom:false,requireHostStart:false,maxParticipants:size}
   });
   if(s.policy?.allowUnlistedParticipants!==true){
    throw new Error('방은 생성되었지만 기존 WebRTC 서버가 초대 없는 공개 입장을 허용하지 않아 목록에는 게시하지 않았습니다. 서버 공개방 정책 수정이 필요합니다.');
   }
   await publishPublicRoom(profile.token,s,profile.userId);
   setOpen(false);await refresh();onOpen(s);
  }catch(e){setError(errorText(e));}
  finally{setSaving(false);}
 }
 async function joinPublic(room:PublicRoom){
  if(joining)return;
  setJoining(room.id);setError('');
  try{
   const s=await enterPublicRoom(profile.token,room.id);
   onOpen(s);
  }catch(e){setError(errorText(e));}
  finally{setJoining(null);}
 }
 return <main className="lobby">
   <header className="page-top"><Brand/><div className="user-area"><span>{profile.name} <small>@{profile.userId}</small></span><button className="outline" onClick={onLogout}>로그아웃</button></div></header>
   <div className="page-body">
    <div className="hero-banner">
     <div>
      <span className="eyebrow">HITEL · OPEN WEBRTC ROOMS</span>
      <h1>영상 대화방</h1>
      <p>방을 개설하면 누구나 목록에서 찾아 입장합니다. 상대방 ID 초대는 사용하지 않습니다.</p>
      <div className="hero-actions"><button className="light-button" onClick={()=>setOpen(true)}>＋ 공개 대화방 만들기</button>
      <button className="subtle-button" onClick={()=>void refresh(true)}>↻ 방 목록 새로고침</button></div>
     </div>
    </div>
    <div className="section-head"><div><span className="kicker">PUBLIC WEBRTC ROOMS</span><h2>입장 가능한 대화방 <strong>{active.length}</strong></h2></div><span className="small-note">4초 간격 자동 갱신 · 초대 ID 불필요</span></div>
    {error&&<p className="error wide" role="alert">{error}</p>}
    {loading?<p className="empty">공개 대화방을 조회하는 중입니다…</p>:
     active.length?<div className="room-cards">
      {active.map(room=><button key={room.id} type="button" className="room-card" disabled={joining!==null} onClick={()=>void joinPublic(room)}>
       <div className="room-card-top"><span className="room-icon">◎</span><span className="status">공개방</span></div>
       <h3>{room.title}</h3><p>정원 {room.maxParticipants}명 · 방장 {room.hostUserId}</p>
       <div className="room-card-bottom"><span>{new Date(room.createdAt*1000).toLocaleString('ko-KR')}</span><span>{joining===room.id?'입장 중…':'바로 입장 →'}</span></div>
      </button>)}
     </div>:<div className="empty"><div className="empty-art">☏</div><h3>현재 공개된 영상방이 없습니다.</h3><p>새 대화방을 개설하시면 모든 사용자의 목록에 나타납니다.</p></div>}
    <div className="notice">공개 입장은 기존 WebRTC 서버의 참가자 인증 및 방 정책을 따릅니다. 서버가 공개 참가를 지원하지 않을 경우 오류를 명확하게 표시합니다.</div>
   </div>
   {open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(false)}>
    <form className="modal" onMouseDown={e=>e.stopPropagation()} onSubmit={e=>void create(e)}>
     <div className="modal-top"><div><span className="kicker">NEW PUBLIC ROOM</span><h2>공개 대화방 만들기</h2></div><button type="button" className="close" onClick={()=>setOpen(false)}>×</button></div>
     <label>대화방 이름<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label>
     <label>최대 입장 인원<input type="number" min={2} max={50} required value={maxPeople} onChange={e=>setMaxPeople(Number(e.target.value))}/></label>
     <p className="muted-text">상대방 ID를 입력하지 않습니다. 생성되면 공개 방 목록에 나타납니다.</p>
     <button className="primary" type="submit" disabled={saving}>{saving?'대화방 개설 중…':'대화방 만들고 입장 →'}</button>
    </form>
   </div>}
 </main>;
}

function LegacyApp(){const [profile,setProfile]=useState<AuthProfile|null>(getSaved),[session,setSession]=useState<ConsultationSession|null>(null);function logout(){sessionStorage.removeItem(PROFILE_KEY);setSession(null);setProfile(null)}return !profile?<Login onLogin={setProfile}/>:session?<Room key={session.id} profile={profile} initial={session} onClose={()=>setSession(null)}/>:<Lobby profile={profile} onLogout={logout} onOpen={setSession}/>;}

type PortalSection = '전화' | '찾기' | '대화' | '내 AI' | 'MY' | '기관용';
export default function App(){
 const [view,setView]=useState<'portal'|'service'|'legacy'>('portal');
 const [section,setSection]=useState<PortalSection>('전화');
 const [phoneNumber,setPhoneNumber]=useState('');
 const openSection=(tab:PortalSection,number='')=>{setSection(tab);setPhoneNumber(number);setView('service');};
 const back=()=>setView('portal');
 // Direct entry to the ORIGINAL authenticated WebRTC room with VideoCore mask controls.
 // This bypasses the portal screen only; it does NOT bypass server authentication.
 if(['/webrtc-room','/webrtc-test','/room'].includes(window.location.pathname.replace(/\/$/, ''))) return <LegacyApp/>;
 if(view==='legacy') return <div><button style={{position:'fixed',right:14,bottom:14,zIndex:200,background:'#4264e9',color:'white',padding:'12px 17px',border:'none',borderRadius:12,boxShadow:'0 8px 25px #0003'}} onClick={back}>← HITEL 포털로</button><LegacyApp/></div>;
 if(view==='service') return <HitelHome key={section+phoneNumber} onLegacy={()=>setView('legacy')} onPortal={back} initialTab={section} initialNumber={phoneNumber}/>;
 return <HitelPortal onPhone={(number)=>openSection('전화',number)} onFind={()=>openSection('찾기')} onChat={()=>openSection('대화')} onAI={()=>openSection('내 AI')} onBusiness={()=>openSection('기관용')} onVideo={()=>setView('legacy')}/>;
}
