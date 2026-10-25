
import { useEffect, useRef, useState } from 'react';
import Portal from './portal/Portal';
import CommunicationPortal from './communication/CommunicationPortal';
import DeviceLab, { DeviceLabPhone } from './device-lab/DeviceLab';
import {OriginalAndroidManager} from './device-lab/OriginalAndroidManager';
import FlowPlanner from './portal/FlowPlanner';
import { API_BASE_URL, issueDevToken, listMyConsultations, createConsultation, getHealth } from './lib/api';
import { createRealtimeSocket, emitAck, waitForSocketReady } from './realtime/socket';
import { CommunicationSDK, type RoomSession } from './communication-sdk';
import { createHitelRoomAdapter } from './communication-sdk/hitelRoomAdapter';
import { openVideoCoreCamera, type CameraMode, type VideoCoreCameraSession } from './lib/videoCore';
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
 return <main className="auth-layout"><section className="intro"><Brand/><div className="intro-main"><span className="eyebrow">WELCOME TO HITEL ROOM</span><h1>이야기가 모이고,<br/><em>사람이 연결됩니다.</em></h1><p>서로 이야기하고, 초대하고, 얼굴을 보며 대화하세요. 기존 WebRTC 서버로 연결되는 독립 커뮤니티 클라이언트입니다.</p><div className="intro-tags"><span>1:1 영상 대화</span><span>그룹 영상방</span><span>실시간 음성</span></div></div><div className="intro-foot">HITEL ROOM · WEBRTC CLIENT</div></section><section className="auth-panel"><div className="auth-card"><span className="kicker">대화 시작하기</span><h2>내 이름으로 입장</h2><p className="muted">현재 개발용 로그인입니다. 대화방 생성은 방장 권한으로 가능합니다.</p><p className="server-status">● {status}</p><form onSubmit={login}><label>사용자 ID<input required value={id} onChange={e=>setId(e.target.value)} placeholder="doctor-1"/></label><label>표시 이름<input required value={name} onChange={e=>setName(e.target.value)} placeholder="이름"/></label><label>접속 유형<select value={role} onChange={e=>setRole(e.target.value as 'doctor'|'user')}><option value="doctor">방장 (대화방 개설)</option><option value="user">초대 참여자</option></select></label>{error&&<p className="error">{error}</p>}<button className="primary" type="submit" disabled={busy}>{busy?'인증 중…':'대화방 입장하기 →'}</button></form><p className="auth-note">이 버전은 기존 서버의 초대 기반 영상방을 지원합니다. 공개 문자채팅 기능은 서버에 아직 없습니다.</p></div></section></main>;
}
function Room({profile, initial, onClose}:{profile:AuthProfile,initial:ConsultationSession,onClose:()=>void}){
 const [session,setSession]=useState(initial),[connection,setConnection]=useState('연결 중'),[stream,setStream]=useState<MediaStream>(),[remote,setRemote]=useState<RemoteTile[]>([]),[ready,setReady]=useState(false),[live,setLive]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[mic,setMic]=useState(true),[camera,setCamera]=useState(true),[cameraMode,setCameraMode]=useState<CameraMode>('mask'),[trackingFps,setTrackingFps]=useState<number|null>(null);
 const socket=useRef<Socket|null>(null),engine=useRef<RoomSession|null>(null),communicationRef=useRef<CommunicationSDK|null>(null),streamRef=useRef<MediaStream|null>(null),cameraSdkRef=useRef<VideoCoreCameraSession|null>(null);
 const isHost=session.hostUserIds.includes(profile.userId);
 useEffect(()=>{let dead=false;const sock=createRealtimeSocket(API_BASE_URL,profile.token);socket.current=sock;communicationRef.current=CommunicationSDK.create();
 const started=(p:{session:ConsultationSession})=>{if(p.session.id===initial.id&&!dead){setSession(p.session);setConnection('대화 시작됨 — 영상 연결 버튼을 눌러주세요');}};
 const ended=(p:{session:ConsultationSession})=>{if(p.session.id===initial.id&&!dead){setSession(p.session);void communicationRef.current?.leaveRoom();engine.current=null;setLive(false);}};
 sock.on('session:started',started);sock.on('session:ended',ended);
 sock.on('disconnect',()=>setConnection('연결 재시도 중'));sock.on('connect_error',()=>setConnection('실시간 서버 연결 실패'));
 (async()=>{try{await waitForSocketReady(sock);const x=await emitAck<{session:ConsultationSession}>(sock,'session:join',{sessionId:initial.id});if(!dead){setSession(x.session);setReady(Boolean(x.session.participants.find(p=>p.userId===profile.userId)?.ready));setConnection('서버에 연결됨');}}catch(e){if(!dead)setError(errorText(e));}})();
 return ()=>{dead=true;void communicationRef.current?.dispose();communicationRef.current=null;engine.current=null;cameraSdkRef.current?.stop();cameraSdkRef.current=null;streamRef.current?.getTracks().forEach(t=>t.stop());sock.disconnect();socket.current=null;};
 },[initial.id,initial.mediaNodePublicUrl,profile.token,profile.userId]);
 async function devices(){
 if(engine.current?.isStarted?.())return;
 setBusy(true);setError('');
 try{
  cameraSdkRef.current?.stop();cameraSdkRef.current=null;
  const sdkCamera=await openVideoCoreCamera(cameraMode);
  cameraSdkRef.current=sdkCamera;
  streamRef.current=sdkCamera.stream;
  setStream(sdkCamera.stream);setMic(true);setCamera(true);
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
  if(engine.current?.isStarted?.())await engine.current.replaceLocalTracks?.(newStream);
  streamRef.current=newStream;setStream(newStream);setCameraMode(next);
 }catch(e){setError(errorText(e))}finally{setBusy(false);}
}
useEffect(()=>{
 if(cameraMode!=='mask'||!stream){setTrackingFps(null);return;}
 const update=()=>setTrackingFps(cameraSdkRef.current?.getTrackingStatus()?.fps??null);
 update();const timer=window.setInterval(update,500);
 return ()=>window.clearInterval(timer);
},[cameraMode,stream]);
 async function joinRtc(s=stream){if(!s||!socket.current||engine.current?.isStarted?.())return;setBusy(true);setError('');try{const sdk=communicationRef.current;if(!sdk)throw new Error('Communication SDK is not initialized');const adapter=createHitelRoomAdapter(socket.current,setRemote,setConnection);const room=await sdk.joinRoom(session.id,s,adapter);engine.current=room;setLive(true);}catch(e){engine.current=null;setError(errorText(e));}finally{setBusy(false)}}
 async function markReady(){if(!stream||!socket.current)return;setBusy(true);setError('');try{const x=await emitAck<{session:ConsultationSession}>(socket.current,'session:ready',{sessionId:session.id,ready:true});setSession(x.session);setReady(true);}catch(e){setError(errorText(e))}finally{setBusy(false)}}
 async function start(){if(!stream||!socket.current)return;setBusy(true);setError('');try{if(!ready){const x=await emitAck<{session:ConsultationSession}>(socket.current,'session:ready',{sessionId:session.id,ready:true});setSession(x.session);setReady(true);}const x=await emitAck<{session:ConsultationSession}>(socket.current,'session:start',{sessionId:session.id});setSession(x.session);await joinRtc(stream);}catch(e){setError(errorText(e));}finally{setBusy(false)}}
 async function exit(){if(socket.current?.connected){await emitAck(socket.current,'session:leave',{sessionId:session.id},4000).catch(()=>undefined);}await communicationRef.current?.leaveRoom();engine.current=null;cameraSdkRef.current?.stop();cameraSdkRef.current=null;streamRef.current?.getTracks().forEach(t=>t.stop());onClose();}
 async function end(){if(!socket.current||!window.confirm('모든 참가자의 대화를 종료하시겠습니까?'))return;setBusy(true);try{const x=await emitAck<{session:ConsultationSession}>(socket.current,'session:end',{sessionId:session.id});setSession(x.session);await communicationRef.current?.leaveRoom();engine.current=null;setLive(false);}catch(e){setError(errorText(e))}finally{setBusy(false);}}
 async function toggleMic(){const x=!mic;setMic(x);stream?.getAudioTracks().forEach(t=>t.enabled=x);try{await engine.current?.setMicrophoneEnabled?.(x)}catch(e){setError(errorText(e));}}
 async function toggleCamera(){const x=!camera;setCamera(x);stream?.getVideoTracks().forEach(t=>t.enabled=x);try{await engine.current?.setCameraEnabled?.(x)}catch(e){setError(errorText(e));}}
 return <main className="room-layout"><header className="page-top"><Brand/><button className="outline" onClick={()=>void exit()}>← 목록으로</button></header><section className="room-head"><div><span className="kicker">영상 대화방</span><h1>{session.title||'대화방'}</h1><p>참여자 {session.participants.length}명 · {statusNames[session.status]||session.status} · {connection}</p></div><div className="room-participants">{session.participants.map(p=><span key={p.userId} title={p.userId}>{p.displayName||p.userId}</span>)}</div></section>{error&&<p className="error wide">{error}</p>}<section className="video-grid"><VideoTile stream={stream} label={profile.name+' (나)'} muted local/>{remote.map(t=><VideoTile key={t.key} stream={t.stream} label={session.participants.find(p=>p.userId===t.userId)?.displayName||t.userId} screen={t.source==='screen'}/>)}{!stream&&<div className="video-empty"><div>◎</div><h3>카메라를 준비해주세요</h3><p>버튼을 누르기 전에는 카메라나 마이크를 켜지 않습니다.</p></div>}</section><section className="controls"><button className={cameraMode==='mask'?'primary narrow':'outline'} disabled={busy} onClick={()=>void changeVideoMode('mask')}>🎭 가면 영상</button><button className={cameraMode==='original'?'primary narrow':'outline'} disabled={busy} onClick={()=>void changeVideoMode('original')}>📷 원본 영상</button><button className="outline" disabled={busy||live} onClick={()=>void devices()}>{stream?'카메라 다시 준비':'카메라·마이크 준비'}</button><button className="outline" disabled={!stream||busy||ready} onClick={()=>void markReady()}>{ready?'✓ 준비 완료':'준비 완료'}</button>{isHost?<button className="primary narrow" disabled={!stream||busy||session.status==='ENDED'} onClick={()=>void start()}>{busy?'진행 중…':'대화 시작'}</button>:<button className="primary narrow" disabled={!stream||!ready||busy||session.status!=='LIVE'||live} onClick={()=>void joinRtc()}>영상 연결</button>}<button className="outline" disabled={!stream} onClick={()=>void toggleMic()}>{mic?'🎙 마이크 끄기':'마이크 켜기'}</button><button className="outline" disabled={!stream} onClick={()=>void toggleCamera()}>{camera?'📷 카메라 끄기':'카메라 켜기'}</button>{isHost&&<button className="danger" disabled={busy} onClick={()=>void end()}>방 종료</button>}</section><p className="hint">선택된 영상 모드: {cameraMode==='mask'?'🎭 가면':'📷 원본'}{trackingFps!==null&&cameraMode==='mask'?' · 얼굴 추적 '+trackingFps.toFixed(1)+' FPS':''} · <a href="/sdk-playground.html" target="_blank" rel="noopener noreferrer">VideoCore SDK 플레이그라운드 열기 ↗</a></p><p className="hint">참여자는 다른 브라우저에서 자기 사용자 ID로 로그인해 초대된 방을 열 수 있습니다. 서버가 지원하는 세션에만 연결합니다.</p></main>;
}
function Lobby({profile,onLogout,onOpen}:{profile:AuthProfile,onLogout:()=>void,onOpen:(s:ConsultationSession)=>void}){
 const [sessions,setSessions]=useState<ConsultationSession[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false),[title,setTitle]=useState('우리들의 이야기'),[ids,setIds]=useState('patient-1'),[kind,setKind]=useState<'group'|'one'>('group'),[saving,setSaving]=useState(false);
 async function refresh(){setLoading(true);setError('');try{setSessions(await listMyConsultations(profile.token));}catch(e){setError(errorText(e))}finally{setLoading(false)}}
 useEffect(()=>{void refresh();},[profile.token]);
 async function create(e:React.FormEvent){e.preventDefault();setSaving(true);setError('');try{const people=Array.from(new Set(ids.split(/[\s,]+/).map(v=>v.trim()).filter(v=>v&&v!==profile.userId)));if(kind==='one'&&people.length!==1)throw new Error('1:1 방은 상대방 ID를 한 개 입력해야 합니다.');if(!people.length)throw new Error('초대할 상대방 ID를 입력하십시오.');const participants:Array<{userId:string;displayName?:string;role:TelemedicineRole}>=[{userId:profile.userId,displayName:profile.name,role:'DOCTOR'},...people.map(id=>({userId:id,displayName:id,role:'PATIENT' as TelemedicineRole}))];const s=await createConsultation(profile.token,{title:title.trim()||'새 대화방',participants,maxParticipants:Math.max(4,participants.length)});setOpen(false);await refresh();onOpen(s);}catch(e){setError(errorText(e))}finally{setSaving(false)}}
 const active=sessions.filter(s=>s.status!=='ENDED'&&s.status!=='CANCELLED');
 return <main className="lobby"><header className="page-top"><Brand/><div className="user-area"><span>{profile.name} <small>@{profile.userId}</small></span><button className="outline" onClick={onLogout}>로그아웃</button></div></header><div className="page-body"><div className="hero-banner"><div><span className="eyebrow">YOUR CONVERSATION SPACE</span><h1>오늘은 어떤 이야기를<br/>나눠볼까요?</h1><p>친구와 단둘이, 여럿이 함께. 초대할 사람의 ID로 영상 대화방을 만들어 보세요.</p><div className="hero-actions"><button className="light-button" disabled={profile.platformRole!=='doctor'} onClick={()=>{setKind('group');setOpen(true)}}>＋ 새 대화방 만들기</button><button className="subtle-button" onClick={()=>void refresh()}>↻ 새로고침</button></div>{profile.platformRole!=='doctor'&&<p className="muted-text">현재 서버에서 방 개설은 방장 계정만 가능합니다.</p>}</div><div className="hero-decoration">ㅎ<span>ROOM</span></div></div><div className="section-head"><div><span className="kicker">MY ROOMS</span><h2>내가 참여하는 방 <strong>{active.length}</strong></h2></div><span className="small-note">초대 기반 영상·음성</span></div>{error&&<p className="error wide">{error}</p>}{loading?<p className="empty">방 목록을 불러오는 중입니다…</p>:active.length?<div className="room-cards">{active.map(s=><button className="room-card" onClick={()=>onOpen(s)} key={s.id}><div className="room-card-top"><span className="room-icon">{s.policy.topology==='ONE_TO_ONE'?'◉':'◎'}</span><span className="status">{statusNames[s.status]||s.status}</span></div><h3>{s.title||'대화방'}</h3><p>{s.participants.map(p=>p.displayName||p.userId).join(' · ')}</p><div className="room-card-bottom"><span>👥 {s.participants.length}명</span><span>입장하기 →</span></div></button>)}</div>:<div className="empty"><div className="empty-art">☏</div><h3>아직 참여 중인 방이 없습니다.</h3><p>방장이 새로운 방을 만들고 참여자의 사용자 ID를 초대하면 이곳에 표시됩니다.</p></div>}<div className="notice"><strong>현재 제공</strong> 기존 서버의 초대 기반 1:1·다자간 영상 및 음성 연결 <span>·</span> <strong>추후 서버 지원 필요</strong> 공개방, 자유 입장, 실시간 문자 채팅, 결제</div></div>{open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(false)}><form className="modal" onMouseDown={e=>e.stopPropagation()} onSubmit={e=>void create(e)}><div className="modal-top"><div><span className="kicker">NEW ROOM</span><h2>대화방 만들기</h2></div><button type="button" className="close" onClick={()=>setOpen(false)}>×</button></div><div className="tabs"><button className={kind==='group'?'chosen':''} type="button" onClick={()=>setKind('group')}>다자간 방</button><button className={kind==='one'?'chosen':''} type="button" onClick={()=>setKind('one')}>1:1 방</button></div><label>대화방 이름<input required value={title} onChange={e=>setTitle(e.target.value)} /></label><label>초대할 사람의 사용자 ID<input required value={ids} onChange={e=>setIds(e.target.value)} placeholder={kind==='one'?'patient-1':'patient-1, patient-2'}/><small>여러 명은 쉼표로 구분해 입력하십시오. 상대도 자신의 ID로 로그인해야 합니다.</small></label><button className="primary" type="submit" disabled={saving}>{saving?'생성 중…':'대화방 생성하고 입장 →'}</button></form></div>}</main>;
}
function LegacyApp(){const [profile,setProfile]=useState<AuthProfile|null>(getSaved),[session,setSession]=useState<ConsultationSession|null>(null);function logout(){sessionStorage.removeItem(PROFILE_KEY);setSession(null);setProfile(null)}return !profile?<Login onLogin={setProfile}/>:session?<Room key={session.id} profile={profile} initial={session} onClose={()=>setSession(null)}/>:<Lobby profile={profile} onLogout={logout} onOpen={setSession}/>;}

export default function App(){return window.location.pathname.startsWith('/android-original')?<OriginalAndroidManager/>:window.location.pathname.startsWith('/sdk-lab/device')?<DeviceLabPhone/>:window.location.pathname.startsWith('/sdk-lab')?<DeviceLab/>:window.location.pathname.startsWith('/portal/flows')?<FlowPlanner/>:window.location.pathname.startsWith('/portal/legacy')?<Portal/>:window.location.pathname.startsWith('/portal')?<CommunicationPortal/>:<LegacyApp/>;}
