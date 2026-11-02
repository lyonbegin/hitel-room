import {useEffect,useRef,useState} from 'react';
import type {Socket} from 'socket.io-client';
import {createRealtimeSocket,emitAck,waitForSocketReady} from './realtime/socket';
import {API_BASE_URL} from './lib/api';
import {openVideoCoreCamera,type CameraMode,type VideoCoreCameraSession} from './lib/videoCore';
import VideoTile from './components/VideoTile';
import type {AuthProfile,ConsultationSession,RemoteTile} from './types';

type RoomSession={isStarted?:()=>boolean;replaceLocalTracks?:(s:MediaStream)=>Promise<void>;
  setCameraEnabled?:(v:boolean)=>Promise<void>;setMicrophoneEnabled?:(v:boolean)=>Promise<void>};
type RoomSdk={
  listPublicRooms:()=>Promise<ConsultationSession[]>;
  createPublicRoom:(p:{title:string;maxParticipants?:number})=>Promise<ConsultationSession>;
  joinPublicRoom:(id:string,s:MediaStream)=>Promise<RoomSession>;
  endPublicRoom:(id:string)=>Promise<ConsultationSession>;
  leaveRoom:()=>Promise<void>;
  dispose:()=>Promise<void>;
};
type Library={
  createHitelPublicRooms:(options:{socket:Socket;accessToken:string;baseUrl?:string})=>unknown;
  createCommunicationSDK:(options:Record<string,unknown>)=>RoomSdk;
  createHitelRoomAdapter:(socket:Socket,onRemote:(t:RemoteTile[])=>void,onStatus:(s:string)=>void)=>unknown;
};
const SDK_BUNDLE='/sdk/communication.esm.js';
const fail=(e:unknown)=>e instanceof Error?e.message:String(e);
const sessionOpen=(s:ConsultationSession)=>s.status!=='ENDED'&&s.status!=='CANCELLED';

export default function PublicWebRtcApp({profile,onLogout}:{profile:AuthProfile,onLogout:()=>void}){
 const [list,setList]=useState<ConsultationSession[]>([]);
 const [active,setActive]=useState<ConsultationSession|null>(null);
 const [sdkReady,setSdkReady]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[status,setStatus]=useState('Communication SDK 연결 중');
 const [createOpen,setCreateOpen]=useState(false),[title,setTitle]=useState('새 영상 대화방'),[capacity,setCapacity]=useState(8);
 const [stream,setStream]=useState<MediaStream|null>(null),[remote,setRemote]=useState<RemoteTile[]>([]);
 const [videoMode,setVideoMode]=useState<CameraMode>('original');
 const [mic,setMic]=useState(true),[camera,setCamera]=useState(true);
 const socketRef=useRef<Socket|null>(null),sdkRef=useRef<RoomSdk|null>(null);
 const cameraRef=useRef<VideoCoreCameraSession|null>(null),mediaRef=useRef<RoomSession|null>(null);
 const activeRef=useRef<ConsultationSession|null>(null),enteringRef=useRef(false);
 const [refreshing,setRefreshing]=useState(false);
 const host=active?.hostUserIds.includes(profile.userId)??false;

 function cleanupCamera(){
  cameraRef.current?.stop();cameraRef.current=null;
  setStream(null);setRemote([]);mediaRef.current=null;
  setVideoMode('original');setMic(true);setCamera(true);
 }
 async function refresh(showLoading=false){
  const sdk=sdkRef.current;if(!sdk)return;
  if(showLoading)setRefreshing(true);
  try {
   const rows=await sdk.listPublicRooms();
   setList(rows.filter(sessionOpen));
  }catch(e){setError('공개방 목록 조회 실패: '+fail(e));}
  finally{if(showLoading)setRefreshing(false);}
 }
 async function syncCurrent(){
  const id=activeRef.current?.id,sock=socketRef.current;
  if(!id||!sock?.connected)return;
  try{
   const value=await emitAck<{session:ConsultationSession}>(sock,'session:get-state',{sessionId:id},5000);
   if(value.session.id===id){setActive(value.session);activeRef.current=value.session;}
  }catch(e){setStatus('방 상태 동기화 실패: '+fail(e));}
 }
 useEffect(()=>{
  let disposed=false;
  const sock=createRealtimeSocket(API_BASE_URL,profile.token);socketRef.current=sock;
  let localSdk:RoomSdk|null=null;
  const endHandler=(payload:{session:ConsultationSession})=>{
   if(payload?.session.id!==activeRef.current?.id)return;
   setStatus('방장이 대화방을 종료했습니다.');
   void localSdk?.leaveRoom().catch(()=>undefined);
   cleanupCamera();activeRef.current=null;setActive(null);void refresh();
  };
  const updated=(payload:{sessionId:string})=>{
   if(payload?.sessionId===activeRef.current?.id)void syncCurrent();
   void refresh();
  };
  const disconnect=()=>setStatus('시그널링 연결 끊김 · 네트워크 확인 후 재접속하십시오.');
  sock.on('session:ended',endHandler);
  sock.on('session:participant-joined',updated);
  sock.on('session:participant-left',updated);
  sock.on('session:participant-disconnected',updated);
  sock.on('disconnect',disconnect);
  (async()=>{
   try{
    await waitForSocketReady(sock);
    const module=await import(/* @vite-ignore */ SDK_BUNDLE) as Library;
    if(disposed)return;
    if(typeof module.createCommunicationSDK!=='function'||typeof module.createHitelPublicRooms!=='function'||
       typeof module.createHitelRoomAdapter!=='function')throw new Error('배포된 SDK에서 공개 영상방 API를 찾지 못했습니다.');
    const rooms=module.createHitelPublicRooms({socket:sock,accessToken:profile.token,baseUrl:API_BASE_URL});
    const adapter=module.createHitelRoomAdapter(sock,setRemote,setStatus);
    localSdk=module.createCommunicationSDK({publicRooms:rooms,roomAdapter:adapter});
    sdkRef.current=localSdk;setSdkReady(true);
    setStatus('Communication SDK 연결됨 · 공개방 목록');
    await refresh(true);
   }catch(e){if(!disposed)setError('Communication SDK 초기화 실패: '+fail(e));}
  })();
  const poll=window.setInterval(()=>{if(!disposed&&sdkRef.current)void refresh();},4000);
  return ()=>{
   disposed=true;window.clearInterval(poll);
   sock.off('session:ended',endHandler);sock.off('session:participant-joined',updated);
   sock.off('session:participant-left',updated);sock.off('session:participant-disconnected',updated);
   sock.off('disconnect',disconnect);
   cameraRef.current?.stop();cameraRef.current=null;
   void localSdk?.dispose().catch(()=>undefined);
   sock.disconnect();sdkRef.current=null;socketRef.current=null;activeRef.current=null;
  };
 },[profile.token]);

 async function enter(room:ConsultationSession){
  const sdk=sdkRef.current;if(!sdk||enteringRef.current)return;
  if(!sessionOpen(room))return setError('이미 종료된 방입니다.');
  enteringRef.current=true;setBusy(true);setError('');
  let cam:VideoCoreCameraSession|null=null;
  try{
   setStatus('카메라·마이크 사용 권한 확인 중');
   cam=await openVideoCoreCamera('original');
   setStatus('서버에 자동 입장한 뒤 WebRTC 미디어 연결 중');
   const rtc=await sdk.joinPublicRoom(room.id,cam.stream);
   if(!rtc.isStarted?.())throw new Error('실제 WebRTC 미디어 연결 확인에 실패했습니다.');
   cameraRef.current=cam;mediaRef.current=rtc;
   setStream(cam.stream);setRemote([]);setVideoMode('original');
   activeRef.current=room;setActive(room);
   setStatus('내 영상 송신 연결됨 · 상대방 영상 수신 대기');
   await syncCurrent();
  }catch(e){
   cam?.stop();setStatus('입장 실패');setError('공개방 입장 실패: '+fail(e));
  }finally{setBusy(false);enteringRef.current=false;}
 }

 async function create(e:React.FormEvent){
  e.preventDefault();const sdk=sdkRef.current;if(!sdk||busy)return;
  setBusy(true);setError('');
  try{
   const room=await sdk.createPublicRoom({title:title.trim(),maxParticipants:capacity});
   setCreateOpen(false);
   await refresh(true);
   setBusy(false);
   await enter(room);
  }catch(e){setError('공개방 생성 실패: '+fail(e));setBusy(false);}
 }

 async function leave(){
  if(busy||!activeRef.current)return;
  setBusy(true);setError('');
  try{
   await sdkRef.current?.leaveRoom();
   cleanupCamera();activeRef.current=null;setActive(null);
   setStatus('대화방에서 퇴장했습니다.');await refresh();
  }catch(e){setError('퇴장 실패: '+fail(e))}
  finally{setBusy(false)}
 }

 async function end(){
  const room=activeRef.current,sdk=sdkRef.current;
  if(!room||!sdk||busy||!window.confirm('모든 참가자의 대화방을 종료하시겠습니까?'))return;
  setBusy(true);setError('');
  try{
   await sdk.endPublicRoom(room.id);
   await sdk.leaveRoom().catch(()=>undefined);
   cleanupCamera();activeRef.current=null;setActive(null);
   setStatus('방 종료 완료');await refresh();
  }catch(e){setError('방 종료 실패: '+fail(e))}
  finally{setBusy(false)}
 }

 async function changeMode(next:CameraMode){
  if(next===videoMode||!cameraRef.current||busy)return;
  setBusy(true);setError('');
  try{
   const newStream=await cameraRef.current.setMode(next);
   newStream.getAudioTracks().forEach(t=>t.enabled=mic);
   newStream.getVideoTracks().forEach(t=>t.enabled=camera);
   await mediaRef.current?.replaceLocalTracks?.(newStream);
   setStream(newStream);setVideoMode(next);
  }catch(e){setError('영상 모드 변경 실패: '+fail(e))}
  finally{setBusy(false)}
 }

 async function toggle(kind:'audio'|'video'){
  const rtc=mediaRef.current;if(!rtc)return;
  try{
   if(kind==='audio'){
    await rtc.setMicrophoneEnabled?.(!mic);
    setMic(v=>!v);
   }else{
    await rtc.setCameraEnabled?.(!camera);
    setCamera(v=>!v);
   }
  }catch(e){setError('미디어 설정 실패: '+fail(e))}
 }

 return <main className={active?'room-layout':'lobby'}>
  <header className="page-top">
   <div className="brand"><span className="brand-icon">ㅎ</span><div><strong>하이텔 방</strong><small>Communication SDK · 공개 영상방</small></div></div>
   <div className="user-area"><span>{profile.name} <small>@{profile.userId}</small></span>
    {active?<button className="outline" onClick={()=>void leave()} disabled={busy}>← 방 목록</button>:<button className="outline" onClick={onLogout}>로그아웃</button>}</div>
  </header>
  {error&&<p className="error wide" role="alert">{error}</p>}
  {active?<>
   <section className="room-head"><div><span className="kicker">LIVE · 공개 영상 대화방</span>
    <h1>{active.title||'영상 대화방'}</h1>
    <p>{active.participants.filter(p=>p.presence!=='LEFT').length}명 · {status}</p>
   </div><div className="room-participants">{active.participants.filter(p=>p.presence!=='LEFT').map(p=><span key={p.userId}>{p.displayName||p.userId}</span>)}</div></section>
   <section className="video-grid"><VideoTile stream={stream??undefined} label={profile.name+' (나)'} muted local/>
     {remote.map(t=><VideoTile key={t.key} stream={t.stream} label={active.participants.find(p=>p.userId===t.userId)?.displayName||t.userId} screen={t.source==='screen'}/>)}</section>
   <section className="controls">
    <button className={videoMode==='mask'?'primary narrow':'outline'} onClick={()=>void changeMode('mask')} disabled={busy}>🎭 가면 영상</button>
    <button className={videoMode==='original'?'primary narrow':'outline'} onClick={()=>void changeMode('original')} disabled={busy}>📷 원본 영상</button>
    <button className="outline" onClick={()=>void toggle('audio')} disabled={busy}>{mic?'마이크 끄기':'마이크 켜기'}</button>
    <button className="outline" onClick={()=>void toggle('video')} disabled={busy}>{camera?'카메라 끄기':'카메라 켜기'}</button>
    <button className="outline" onClick={()=>void syncCurrent()} disabled={busy}>참가자 새로고침</button>
    {host&&<button className="danger" onClick={()=>void end()} disabled={busy}>대화방 종료</button>}
   </section>
   <p className="hint">영상 송신 연결과 상대방 영상 수신은 별개의 상태입니다. 가면 영상은 원본 영상 연결 후 전환합니다.</p>
  </>:<div className="page-body">
    <div className="hero-banner"><div><span className="eyebrow">HITEL COMMUNICATION SDK · PUBLIC ROOMS</span>
      <h1>공개 영상 대화방</h1><p>방을 만들면 모든 사용자의 방 목록에 나타나며, 다른 사용자는 목록에서 선택하여 자동 입장합니다. 초대 ID는 필요하지 않습니다.</p>
      <div className="hero-actions">
       <button className="light-button" disabled={!sdkReady||busy} onClick={()=>setCreateOpen(true)}>＋ 공개방 만들기</button>
       <button className="subtle-button" disabled={!sdkReady||refreshing} onClick={()=>void refresh(true)}>↻ 방 목록 새로고침</button>
      </div></div></div>
    <div className="section-head"><div><span className="kicker">PUBLIC WEBRTC ROOMS</span>
      <h2>참여 가능한 방 <strong>{list.length}</strong></h2></div>
      <span className="small-note">{status} · 4초 자동 갱신</span></div>
    {!sdkReady?<p className="empty">배포된 Communication SDK에서 방 목록을 불러오고 있습니다.</p>:
      list.length?<div className="room-cards">{list.map(room=>
       <button className="room-card" key={room.id} disabled={busy}
         onClick={()=>void enter(room)}>
        <div className="room-card-top"><span className="room-icon">◎</span><span className="status">공개방</span></div>
        <h3>{room.title||'공개 영상방'}</h3><p>정원 {room.policy?.maxParticipants??8}명 · 현재 {room.participants.filter(p=>p.presence!=='LEFT').length}명</p>
        <div className="room-card-bottom"><span>방장 {room.hostUserIds.join(', ')}</span><span>바로 입장 →</span></div>
       </button>)}</div>:
       <div className="empty"><div className="empty-art">◎</div><h3>현재 공개된 방이 없습니다.</h3><p>새 영상방을 개설하면 다른 사용자에게 즉시 표시됩니다.</p></div>}
    <p className="hint">영상·음성은 기존 Fly.io mediasoup 서버에 연결되며 Communication SDK가 방 입장을 처리합니다.</p>
   </div>}
  {createOpen&&!active&&<div className="modal-backdrop" onMouseDown={()=>setCreateOpen(false)}>
   <form className="modal" onMouseDown={e=>e.stopPropagation()} onSubmit={e=>void create(e)}>
    <div className="modal-top"><div><span className="kicker">NEW PUBLIC ROOM</span><h2>영상 대화방 만들기</h2></div>
     <button className="close" type="button" onClick={()=>setCreateOpen(false)}>×</button></div>
    <label>방 이름<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>최대 참가 인원<input type="number" min={2} max={32} value={capacity} onChange={e=>setCapacity(Number(e.target.value))}/></label>
    <p className="muted-text">상대방을 지정하지 않습니다. 로그인한 누구나 입장할 수 있습니다.</p>
    <button className="primary" type="submit" disabled={busy}>{busy?'개설 중…':'방을 만들고 입장 →'}</button>
   </form></div>}
 </main>;
}
