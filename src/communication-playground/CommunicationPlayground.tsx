import {useEffect,useRef,useState} from 'react';
import './CommunicationPlayground.css';

type Kind='P'|'P+'|'N'|'W';
type Side='A'|'B';
type Phase='idle'|'ringing'|'accepted'|'rejected'|'media'|'ended';
type Route={id:number;from:Kind;to:Kind};
type CallEvent={type:string;by:Side;at:string;seq:number;callId:string|null;route?:Route;description?:string;connectionState?:string;note?:string;callState?:string};
type PlaySession={ok:boolean;id:string;secret:string;route:Route;phase:Phase;callId:string|null;peers:{A:boolean;B:boolean};peerKinds?:Record<Side,string|null>;
 capabilities:{signaling:boolean;browserWebRTC:boolean;nativeIOS:boolean;pstnGateway:boolean;aiRuntime:boolean};expiresAt:string;sequence:number;nativeCode?:string|null;nativeSide?:Side|null;nativeCodes?:{A:string|null;B:string|null}};
type Signal={type:string;from?:Side;payload?:{type?:string;sdp?:string;candidate?:string|null;sdpMid?:string|null;sdpMLineIndex?:number|null};state?:PlaySession;event?:CallEvent;events?:CallEvent[];peers?:{A:boolean;B:boolean};peerKinds?:Record<Side,string|null>;ok?:boolean;reason?:string;phase?:Phase;requestId?:string;callId?:string};
type Line={id:number;at:string;side:string;kind:string;text:string;tone:'ok'|'error'|'info'|'warn'};
const KINDS:Kind[]=['P','P+','N','W'];
const ROUTES:Route[]=KINDS.flatMap((from,i)=>KINDS.map((to,j)=>({id:i*4+j+1,from,to})));
const ROOT='/lab-sandbox/playground';
const KINDS_LABEL:Record<Kind,string>={P:'일반전화', 'P+':'통신사 + 개인 AI',N:'네이티브 앱',W:'웹브라우저'};
const routeRtc=(r:Route)=>['N','W'].includes(r.from)&&['N','W'].includes(r.to);
const routePstn=(r:Route)=>r.from==='P'||r.to==='P'||r.from==='P+'||r.to==='P+';
const time=(v:string)=>new Date(v).toLocaleTimeString('ko-KR',{hour12:false});
const label=(r:Route)=>r.from+' → '+r.to;
const taskMap:Record<Kind,string>={
 P:'통신사 번호 발신·수신은 연동되지 않았습니다. WebSocket 제어 신호만 시험합니다.',
 'P+':'통신사 오디오 접근 및 실제 AI 기능은 미연동입니다. 제어 흐름·상태만 시험합니다.',
 N:'독립 브라우저가 N 역할을 대신합니다. 실제 iPhone CallKit·네이티브 미디어 연결 성공을 뜻하지 않습니다.',
 W:'독립 웹 클라이언트입니다. 양측 W인 경우 브라우저 WebRTC로 실 미디어를 검증합니다.'
};
const checklist=[
 {id:'ws',title:'양측 WebSocket 연결',description:'서버의 독립 두 연결이 열려야 합니다.'},
 {id:'invite',title:'발신 요청·수신 벨',description:'서버가 실제로 ringing 이벤트를 양측에 전달합니다.'},
 {id:'accept',title:'수락·종료 명령',description:'상태 전이와 서버 ACK를 확인합니다.'},
 {id:'rtc',title:'실제 WebRTC 미디어',description:'N/W 조합에서 브라우저간 미디어 전송을 시험합니다.'},
 {id:'native',title:'N 네이티브 직접 WebSocket 참가',description:'네이티브 전용 참가코드·WS 연결. 실제 미디어는 별도 확인'},
 {id:'pstn',title:'실제 일반전화망 연동',description:'P/P+ 통신사 연결 장치·권한 검증 필요'},
 {id:'ai',title:'실시간 AI 음성·자막',description:'AI 런타임 인증·실제 미디어 입력 연동 필요'},
];
const textErr=(e:unknown)=>e instanceof Error?e.message:String(e);
let lastLogId=0;
export default function CommunicationPlayground(){
 const devicePageToken=window.location.pathname.match(/^\/communication-playground\/app\/([a-f0-9]{64})\/?$/)?.[1]||null;
 const [selected,setSelected]=useState(devicePageToken?12:16);
 const [deviceStatus,setDeviceStatus]=useState<{id:string;online:boolean;lastSeen:string|null}|null>(null);
 const [otherDeviceUrl,setOtherDeviceUrl]=useState('');
 const [autoAttachError,setAutoAttachError]=useState('');
 const assignment=useRef<string>('');
 const [sess,setSess]=useState<PlaySession|null>(null);
 const [conn,setConn]=useState<Record<Side,boolean>>({A:false,B:false});
 const [peerKinds,setPeerKinds]=useState<Record<Side,string|null>>({A:null,B:null});
 const [phase,setPhase]=useState<Phase>('idle');
 const [logs,setLogs]=useState<Line[]>([]);
 const [remoteStatus,setRemoteStatus]=useState<Record<Side,string>>({A:'연결 전',B:'연결 전'});
 const [localReady,setLocalReady]=useState<Record<Side,boolean>>({A:false,B:false});
 const [rtcReady,setRtcReady]=useState<Record<Side,boolean>>({A:false,B:false});
 const [reportedIce,setReportedIce]=useState<Record<Side,boolean>>({A:false,B:false});
 const [micOn,setMicOn]=useState<Record<Side,boolean>>({A:true,B:true});
 const [camOn,setCamOn]=useState<Record<Side,boolean>>({A:true,B:true});
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [audit,setAudit]=useState<{running:boolean;passed:number;failed:number;done:number;details:string[]}>({running:false,passed:0,failed:0,done:0,details:[]});
 const [scenarioFilter,setScenarioFilter]=useState<'all'|'rtc'|'gateway'>('all');
 const [testNotes,setTestNotes]=useState<Record<number,string>>({});
 const [consultNotes,setConsultNotes]=useState<Record<Side,string>>({A:'',B:''});
 const [observedCalls,setObservedCalls]=useState<Record<Side,string>>({A:'미수신',B:'미수신'});
 const sockets=useRef<Record<Side,WebSocket|null>>({A:null,B:null});
 const pcs=useRef<Record<Side,RTCPeerConnection|null>>({A:null,B:null});
 const pendingIce=useRef<Record<Side,RTCIceCandidateInit[]>>({A:[],B:[]});
 const streams=useRef<Record<Side,MediaStream|null>>({A:null,B:null});
 const seen=useRef(new Set<number>());
 const localA=useRef<HTMLVideoElement|null>(null),localB=useRef<HTMLVideoElement|null>(null);
 const remoteA=useRef<HTMLVideoElement|null>(null),remoteB=useRef<HTMLVideoElement|null>(null);
 const current=ROUTES[selected-1];
 const liveRtc=routeRtc(current);
 const hasPstn=routePstn(current);
 const log=(side:string,kind:string,value:string,tone:Line['tone']='info')=>{
  setLogs(rows=>[{id:++lastLogId,at:new Date().toISOString(),side,kind,text:value,tone},...rows].slice(0,200));
 };
 const pushNotes=(scenario:number,note:string)=>setTestNotes(old=>({...old,[scenario]:note}));
 const send=(side:Side,type:string,payload?:object)=>{
  const ws=sockets.current[side];if(!ws||ws.readyState!==WebSocket.OPEN){log(side,'ERROR','WebSocket 연결 후 실행할 수 있습니다.','error');return false}
  ws.send(JSON.stringify({type,payload,requestId:crypto.randomUUID()}));log(side,'TX',type,'info');return true;
 };
 const stopMedia=()=>{
  pendingIce.current={A:[],B:[]};
  (['A','B'] as Side[]).forEach(side=>{
   pcs.current[side]?.close();pcs.current[side]=null;
   streams.current[side]?.getTracks().forEach(t=>t.stop());streams.current[side]=null;
   const local=side==='A'?localA.current:localB.current,remote=side==='A'?remoteA.current:remoteB.current;
   if(local)local.srcObject=null;if(remote)remote.srcObject=null;
  });setLocalReady({A:false,B:false});setRtcReady({A:false,B:false});setReportedIce({A:false,B:false});
  setRemoteStatus({A:'미디어 준비 전',B:'미디어 준비 전'});
 };
 const disconnect=()=>{
  (['A','B'] as Side[]).forEach(side=>{sockets.current[side]?.close();sockets.current[side]=null});
  setConn({A:false,B:false});setPeerKinds({A:null,B:null});setObservedCalls({A:'미수신',B:'미수신'});stopMedia();
 };
 const api=async(path:string,body:object)=>{
  const res=await fetch(ROOT+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const json=await res.json() as Record<string,unknown>;
  if(!res.ok||json.ok!==true)throw Error(String(json.error||'서버 응답 오류'));
  return json;
 };
 const verifyAllSignalRoutes=async()=>{
  if(audit.running)return;
  setAudit({running:true,passed:0,failed:0,done:0,details:[]});
  const waitFor=(ws:WebSocket,condition:(msg:Signal)=>boolean,limit=9000)=>new Promise<Signal>((resolve,reject)=>{
   const timer=window.setTimeout(()=>{ws.removeEventListener('message',onMessage);reject(Error('WS_EVENT_TIMEOUT'))},limit);
   const onMessage=(event:MessageEvent)=>{
    try{const msg=JSON.parse(String(event.data)) as Signal;
     if(condition(msg)){clearTimeout(timer);ws.removeEventListener('message',onMessage);resolve(msg)}
    }catch{}
   };
   ws.addEventListener('message',onMessage);
  });
  const open=async(s:PlaySession,side:Side)=>{
   const url=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+ROOT+'/socket?id='+encodeURIComponent(s.id)+
    '&side='+side+'&secret='+encodeURIComponent(s.secret);
   const ws=new WebSocket(url);
   await new Promise<void>((resolve,reject)=>{
    const tm=window.setTimeout(()=>reject(Error('WS_OPEN_TIMEOUT')),10000);
    ws.addEventListener('open',()=>{clearTimeout(tm);resolve()},{once:true});
    ws.addEventListener('error',()=>{clearTimeout(tm);reject(Error('WS_CONNECTION_REJECTED'))},{once:true});
   });
   return ws;
  };
  const command=async(ws:WebSocket,type:string)=>{
   const requestId=crypto.randomUUID();
   const pending=waitFor(ws,x=>x.type==='ack'&&x.requestId===requestId);
   ws.send(JSON.stringify({type,requestId}));
   const ack=await pending;
   if(!ack.ok)throw Error(type+': '+ack.reason);
  };
  let passed=0,failed=0;const details:string[]=[];
  for(const route of ROUTES){
   let session:PlaySession|null=null,A:WebSocket|null=null,B:WebSocket|null=null;
   try{
    session=await api('/session',{routeId:route.id}) as unknown as PlaySession;
    A=await open(session,'A');B=await open(session,'B');
    const ringing=waitFor(B,x=>x.type==='event'&&x.event?.type==='call.ringing');
    await command(A,'call.invite');await ringing;
    const accepted=waitFor(A,x=>x.type==='event'&&x.event?.type==='call.accept');
    await command(B,'call.accept');await accepted;
    await command(A,'call.end');
    const state=await api('/status',{id:session.id,secret:session.secret}) as unknown as PlaySession;
    if(state.phase!=='ended')throw Error('NOT_ENDED');
    passed++;details.push('SC'+String(route.id).padStart(2,'0')+' '+label(route)+' · 제어 신호 통과');
   }catch(e){failed++;details.push('SC'+String(route.id).padStart(2,'0')+' '+label(route)+' · 실패: '+textErr(e))}
   finally{
    A?.close();B?.close();
    if(session)void api('/end',{id:session.id,secret:session.secret}).catch(()=>undefined);
   }
   setAudit({running:true,passed,failed,done:passed+failed,details:[...details]});
  }
  setAudit({running:false,passed,failed,done:passed+failed,details:[...details]});
 };
 useEffect(()=>{
  let cancelled=false;
  const raw=sessionStorage.getItem(devicePageToken?'hitel.communication.device-session.'+devicePageToken:'hitel.communication.playground.v1');
  if(!raw)return;
  try{
   const saved=JSON.parse(raw) as {id:string;secret:string};
   if(!saved.id||!saved.secret)throw Error('Invalid saved session');
   void fetch(ROOT+'/status',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(saved)}).then(r=>{
     if(!r.ok)throw Error('SESSION_EXPIRED');
     return r.json() as Promise<PlaySession&{events?:CallEvent[]}>
   }).then(state=>{
     if(cancelled)return;
     setSess({...state,secret:saved.secret});
     setSelected(state.route.id);setPhase(state.phase);
     for(const event of state.events||[])seen.current.add(event.seq);
     const nativeA=state.events?.some(e=>e.by==='A'&&e.type==='call.mediaConnected')||false;
     const nativeB=state.events?.some(e=>e.by==='B'&&e.type==='call.mediaConnected')||false;
     setReportedIce({A:nativeA,B:nativeB});
     log('RESTORE','SESSION','새로고침 후 기존 세션을 복구했습니다. 앱의 고유 주소로 자동 연결합니다.','ok');
   }).catch(()=>{
     if(!cancelled)sessionStorage.removeItem(devicePageToken?'hitel.communication.device-session.'+devicePageToken:'hitel.communication.playground.v1');
   });
  }catch{sessionStorage.removeItem(devicePageToken?'hitel.communication.device-session.'+devicePageToken:'hitel.communication.playground.v1')}
  return()=>{cancelled=true}
 },[]);
 const create=async(routeId:number)=>{
  setBusy(true);setNotice('');disconnect();setSess(null);setPhase('idle');setLogs([]);seen.current.clear();
  if(sess){void api('/end',{id:sess.id,secret:sess.secret}).catch(()=>undefined)}
  const storageKey=devicePageToken?'hitel.communication.device-session.'+devicePageToken:'hitel.communication.playground.v1';
  sessionStorage.removeItem(storageKey);
  assignment.current='';
  try{
   const state=await api('/session',{routeId}) as unknown as PlaySession;
   sessionStorage.setItem(storageKey,JSON.stringify({id:state.id,secret:state.secret}));
   setSess(state);log('SERVER','SESSION','서버에 실제 테스트 세션을 생성했습니다. '+label(state.route),'ok');
   if(routePstn(state.route))log('LIMIT','PSTN','P/P+의 실제 통신사 연결은 지원하지 않습니다. 신호 시험만 가능합니다.','warn');
   else if(state.route.from==='N'||state.route.to==='N')log('NATIVE','JOIN','iPhone의 고유 웹 주소로 자동 연결합니다.','info');
   if(devicePageToken)await autoConnect(state);
  }catch(e){setNotice('세션 생성 실패: '+textErr(e));log('SERVER','ERROR',textErr(e),'error')}
  finally{setBusy(false)}
 };
 const autoConnect=async(state:PlaySession)=>{
  const primarySide:Side=['N','P+'].includes(state.route.from)?'A':'B';
  const endpoint=primarySide==='A'?state.route.from:state.route.to;
  if(!['N','P+'].includes(endpoint))return;
  const assignKey=state.id+'-'+primarySide;
  if(assignment.current!==assignKey){
   try{
    const result=await api('/device/attach',{pageToken:devicePageToken,sessionId:state.id,sessionSecret:state.secret,side:primarySide}) as {ok:boolean;assigned:boolean};
    if(result.assigned){assignment.current=assignKey;setAutoAttachError('');log('DEVICE','AUTO','iPhone 앱에 '+primarySide+' 역할 자동 연결 요청','ok')}
   }catch(e){setAutoAttachError(textErr(e));log('DEVICE','OFFLINE','아이폰이 현재 오프라인이거나 연결 대기 중: '+textErr(e),'warn')}
  }
  const opposite:Side=primarySide==='A'?'B':'A';
  if((opposite==='A'?state.route.from:state.route.to)==='W')connect(opposite,state);
 };
 const select=(id:number)=>{setSelected(id);void create(id)};
 useEffect(()=>{
  if(!devicePageToken)return;
  let live=true;
  const check=async()=>{
   try{
    const status=await api('/device/status',{pageToken:devicePageToken}) as {ok:boolean;device:{id:string;online:boolean;lastSeen:string|null}};
    if(!live)return;
    setDeviceStatus(status.device);
    if(status.device.online&&sess)await autoConnect(sess);
   }catch(e){if(live)setAutoAttachError(textErr(e))}
  };
  void check();
  const interval=window.setInterval(()=>void check(),2500);
  return()=>{live=false;window.clearInterval(interval)}
 },[devicePageToken,sess?.id]);
 useEffect(()=>{
  if(!devicePageToken)return;
  if(sess)return;
  void create(12);
 },[devicePageToken]);

 const acceptState=(event:CallEvent)=>{
  if(!seen.current.has(event.seq)){
   seen.current.add(event.seq);
   log(event.by,'EVENT','#'+event.seq+' '+event.type+(event.note?' · '+event.note:''),'ok');
  }
  if(event.type==='carrier.status'&&event.callState)setObservedCalls(o=>({...o,[event.by]:event.callState||'unknown'}));
  if(event.type==='call.ringing')setPhase('ringing');
  if(event.type==='call.accept')setPhase('accepted');
  if(event.type==='call.reject')setPhase('rejected');
  if(event.type==='call.end'||event.type==='call.cancel'){setPhase('ended');stopMedia()}
  if(event.type==='rtc.answer')setPhase('media');
  if(event.type==='call.mediaConnected'&&event.connectionState==='connected')
   setReportedIce(old=>({...old,[event.by]:true}));
 };
 const makePeer=(side:Side)=>{
  const old=pcs.current[side];if(old)return old;
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  pcs.current[side]=pc;
  pc.onicecandidate=e=>{
   if(e.candidate)send(side,'rtc.ice',e.candidate.toJSON());
  };
  pc.ontrack=e=>{
   const video=side==='A'?remoteA.current:remoteB.current;
   if(video){video.srcObject=e.streams[0]||new MediaStream([e.track]);void video.play().catch(()=>undefined)}
   log(side,'MEDIA','원격 '+e.track.kind+' 트랙 수신','ok');
  };
  pc.onconnectionstatechange=()=>{
   setRemoteStatus(o=>({...o,[side]:pc.connectionState}));
   if(pc.connectionState==='connected'){
    setRtcReady(o=>({...o,[side]:true}));log(side,'WEBRTC','실제 피어 연결 성공','ok');
    send(side,'call.mediaConnected',{connectionState:pc.connectionState});
   }else if(['failed','disconnected','closed'].includes(pc.connectionState)){setRtcReady(o=>({...o,[side]:false}))}
  };
  const stream=streams.current[side];if(stream)for(const track of stream.getTracks())pc.addTrack(track,stream);
  // A data channel guarantees an actual ICE/DTLS peer transport test even if
  // a browser declines camera access. It does not imply audio/video permission.
  if(side==='A'){
   const channel=pc.createDataChannel('hitel-playground');
   channel.onopen=()=>{channel.send('HITEL_PEER_CONNECTED');log('A','DATA','WebRTC 데이터채널 연결됨','ok')};
  }
  pc.ondatachannel=e=>{e.channel.onmessage=event=>log(side,'DATA',String(event.data).slice(0,80),'ok')};
  return pc;
 };
 const onMessage=async(side:Side,msg:Signal)=>{
  if(msg.type==='hello'){
   if(msg.state?.peerKinds)setPeerKinds(msg.state.peerKinds);
   log(side,'WS','WebSocket 연결 승인 · 독립 웹 클라이언트','ok');return
  }
  if(msg.type==='presence'){if(msg.peers)setConn(msg.peers);if(msg.peerKinds)setPeerKinds(msg.peerKinds);return}
  if(msg.type==='ack'){if(!msg.ok)log(side,'ACK','거부: '+msg.reason,'error');else log(side,'ACK',msg.phase||'OK','ok');return}
  if(msg.type==='event'&&msg.event){acceptState(msg.event);return}
  try{
   if(msg.type==='rtc.offer'&&side==='B'&&msg.payload?.sdp){
    const pc=makePeer('B');
    await pc.setRemoteDescription({type:'offer',sdp:msg.payload.sdp});
    for(const candidate of pendingIce.current.B.splice(0))await pc.addIceCandidate(candidate);
    const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
    send('B','rtc.answer',{type:answer.type,sdp:answer.sdp});return;
   }
   if(msg.type==='rtc.answer'&&side==='A'&&msg.payload?.sdp){
    const pc=pcs.current.A;if(!pc)throw Error('발신자 PeerConnection이 없습니다.');
    await pc.setRemoteDescription({type:'answer',sdp:msg.payload.sdp});
    for(const candidate of pendingIce.current.A.splice(0))await pc.addIceCandidate(candidate);
    return;
   }
   if(msg.type==='rtc.ice'&&msg.payload){
    const pc=pcs.current[side];
    const candidate=msg.payload as RTCIceCandidateInit;
    if(pc?.remoteDescription)await pc.addIceCandidate(new RTCIceCandidate(candidate));
    else pendingIce.current[side].push(candidate);
   }
  }catch(e){log(side,'WEBRTC ERROR',textErr(e),'error')}
 };
 const connect=(side:Side,state:PlaySession|null=sess)=>{
  if(!state)return;
  if((side==='A'&&state.route.from==='N')||(side==='B'&&state.route.to==='N')){
   log(side,'NATIVE','N 플레이어는 실제 iPhone 앱의 참가코드를 이용해 직접 WSS 연결합니다.','warn');
   return;
  }
  const previous=sockets.current[side];
  if(previous&&previous.readyState<=WebSocket.OPEN)return;
  const proto=location.protocol==='https:'?'wss:':'ws:';
  const url=proto+'//'+location.host+ROOT+'/socket?id='+encodeURIComponent(state.id)+'&side='+side+'&secret='+encodeURIComponent(state.secret);
  const ws=new WebSocket(url);sockets.current[side]=ws;
  ws.onopen=()=>{setConn(o=>({...o,[side]:true}));log(side,'WS','실제 서버 WebSocket 연결 성공','ok')};
  ws.onmessage=e=>{try{void onMessage(side,JSON.parse(String(e.data)) as Signal)}catch{log(side,'ERROR','서버 메시지 파싱 실패','error')}};
  ws.onerror=()=>log(side,'WS','WebSocket 연결 오류','error');
  ws.onclose=e=>{if(sockets.current[side]!==ws)return;setConn(o=>({...o,[side]:false}));log(side,'WS','연결 종료: '+e.code,'warn')};
 };
 const prepare=async(side:Side)=>{
  if(!liveRtc)return;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('HTTPS 또는 카메라/마이크 지원 브라우저가 필요합니다.');
   const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
   streams.current[side]?.getTracks().forEach(t=>t.stop());streams.current[side]=stream;
   const video=side==='A'?localA.current:localB.current;
   if(video){video.srcObject=stream;void video.play().catch(()=>undefined)}
   setLocalReady(o=>({...o,[side]:true}));log(side,'MEDIA','실제 카메라·마이크 권한 및 트랙 확보','ok');
  }catch(e){log(side,'MEDIA',textErr(e),'error')}
 };
 const beginRtc=async()=>{
  if(!liveRtc||phase!=='accepted'||!localReady.A||(current.to==='W'&&!localReady.B)){
   log('RTC','BLOCKED','수락 후 브라우저 참가자 카메라·마이크를 준비해 주십시오.','warn');return
  }
  if(current.from==='N'){log('RTC','BLOCKED','N 발신자는 아이폰에서 WebRTC Offer를 시작합니다.','warn');return}
  try{
   if(current.to==='W')makePeer('B');
   const a=makePeer('A');const offer=await a.createOffer();
   await a.setLocalDescription(offer);
   send('A','rtc.offer',{type:offer.type,sdp:offer.sdp});log('RTC','OFFER','실제 WebRTC Offer 전송','ok');
  }catch(e){log('RTC','ERROR',textErr(e),'error')}
 };
 const toggleMedia=(side:Side,kind:'audio'|'video')=>{
  const stream=streams.current[side];if(!stream)return;
  if(kind==='audio'){const next=!micOn[side];stream.getAudioTracks().forEach(t=>t.enabled=next);setMicOn(o=>({...o,[side]:next}));log(side,'AUDIO',next?'마이크 켬':'마이크 끔')}
  else{const next=!camOn[side];stream.getVideoTracks().forEach(t=>t.enabled=next);setCamOn(o=>({...o,[side]:next}));log(side,'VIDEO',next?'카메라 켬':'카메라 끔')}
 };
 useEffect(()=>{return()=>{(['A','B'] as Side[]).forEach(side=>{
  sockets.current[side]?.close();pcs.current[side]?.close();streams.current[side]?.getTracks().forEach(t=>t.stop());
 })}},[]);
 const verifiedNativeSignaling=((current.from==='N'&&conn.A&&peerKinds.A==='native-protocol')||
   (current.to==='N'&&conn.B&&peerKinds.B==='native-protocol'));
 const mediaFrom=(side:Side)=>side==='A'
   ?(current.from==='N'?reportedIce.A:rtcReady.A)
   :(current.to==='N'?reportedIce.B:rtcReady.B);
 const rtcOk=liveRtc&&mediaFrom('A')&&mediaFrom('B');
 const statusChecks=[
  {id:'ws',ok:conn.A&&conn.B,desc:conn.A&&conn.B?'양쪽 WS 실연결 성공':'양측 연결 필요'},
  {id:'invite',ok:seen.current.size>0&&logs.some(l=>l.text.includes('call.ringing')),desc:phase!=='idle'?'발신 이벤트 전달 확인':'아직 발신 전'},
  {id:'accept',ok:logs.some(l=>l.text.includes('call.accept')),desc:phase==='accepted'||phase==='media'||phase==='ended'?'서버 ACK / 수락 확인':'수락 대기'},
  {id:'rtc',ok:rtcOk,desc:!liveRtc?'인터넷 피어 통화 조합이 아님':rtcOk
   ?'양측 ICE 연결 확인 · 실제 음성/영상 품질은 별도 실기기 확인'
   :'상대·본인 모두 ICE connected 이벤트가 확인돼야 성공'},
  {id:'native',ok:verifiedNativeSignaling,desc:verifiedNativeSignaling?'네이티브 전용 인증으로 WebSocket 참가 확인 · 실제 iPhone 미디어 별도 검증':current.from==='N'||current.to==='N'?'네이티브 N 참가 대기':'해당 없음'},
  {id:'pstn',ok:false,desc:hasPstn?'외부 전화망 게이트웨이 미연동':'해당 없음'},
  {id:'ai',ok:false,desc:'실제 AI 런타임 미연동 (진단용 상태만)'},
 ];
 const passed=statusChecks.filter(x=>x.ok).length;
 const filtered=ROUTES.filter(r=>scenarioFilter==='all'||(scenarioFilter==='rtc'?routeRtc(r):routePstn(r)));
 const actor=(side:Side)=>{
  const k=side==='A'?current.from:current.to;
  const isWeb=k==='W',native=k==='N';
  const nativeOnline=Boolean((native||k==='P+')&&conn[side]&&peerKinds[side]==='native-protocol');
  return <section className="hcp-actor" aria-label={side==='A'?'발신자 플레이어':'수신자 플레이어'}>
   <header><div className="hcp-avatar">{side==='A'?'↗':'↙'}</div><div><small>{side==='A'?'PLAYER A · 발신자':'PLAYER B · 수신자'}</small><h3>{k} <span>{KINDS_LABEL[k]}</span></h3></div><span className={'hcp-status '+(conn[side]?'on':'off')}>{conn[side]?'WS 연결':'WS 미연결'}</span></header>
   <div className="hcp-screen">
    <div className="hcp-video-grid">
     <div><video ref={side==='A'?localA:localB} autoPlay muted playsInline/><span>로컬 실기기 미디어</span></div>
     <div><video ref={side==='A'?remoteA:remoteB} autoPlay playsInline/><span>상대 미디어</span></div>
    </div>
    <div className="hcp-screen-caption">{native?nativeOnline?'네이티브 iPhone N 직접 WebSocket 참가':'N 플레이어 대기 · iPhone의 8자리 코드 필요':isWeb?'W 실제 브라우저':k==='P+'?nativeOnline?'iPhone P+ 개인 보조 앱 참가 · 통신사 음성 별도':'P+ 웹 보조 · iPhone 앱 직접 참가 선택 가능': 'P 통신사 미연동'}</div>
    <div className="hcp-chip-line"><span>통화: {phase}</span><span>미디어: {remoteStatus[side]}</span></div>
   </div>
   <div className="hcp-actions">
    <button onClick={()=>connect(side)} disabled={!sess||conn[side]||native}> {native?'iPhone N 코드 사용':'WebSocket 연결'}</button>
    {side==='A'?<button className="primary" onClick={()=>send('A','call.invite')} disabled={native||!conn.A||!conn.B||!['idle','ended','rejected'].includes(phase)}>발신</button>:
     <><button className="primary" onClick={()=>send('B','call.accept')} disabled={native||!conn.B||phase!=='ringing'}>수락</button><button onClick={()=>send('B','call.reject')} disabled={native||!conn.B||phase!=='ringing'}>거절</button></>}
    <button onClick={()=>send(side,'call.end')} disabled={native||!conn[side]||!['ringing','accepted','media'].includes(phase)}>종료</button>
   </div>
   <div className="hcp-actions secondary">
    <button onClick={()=>void prepare(side)} disabled={native||!liveRtc||!conn[side]||localReady[side]}>{localReady[side]?'✓ 카메라·마이크 준비됨':'카메라·마이크 허용'}</button>
    <button onClick={()=>toggleMedia(side,'audio')} disabled={!localReady[side]}>{micOn[side]?'마이크 끄기':'마이크 켜기'}</button>
    <button onClick={()=>toggleMedia(side,'video')} disabled={!localReady[side]}>{camOn[side]?'영상 끄기':'영상 켜기'}</button>
   </div>
   {k==='P+'&&<div style={{padding:'0 13px 12px',display:'flex',flexDirection:'column',gap:7}}>
     <div style={{fontSize:11,padding:8,background:'#f0f5fa',borderRadius:6}}>
      iPhone CallKit 통화 상태: <strong>{observedCalls[side]}</strong> · 통신사 또는 VoIP 출처 구분 불가
     </div>
     <label style={{fontSize:11,fontWeight:700}}>P+ 개인 상담 메모 · 통화 음성 자동 수집 없음</label>
     <textarea rows={2} value={consultNotes[side]} placeholder="전화 상대 음성이 아닌 직접 입력한 내용을 상대 테스트 플레이어와 공유합니다."
      onChange={e=>setConsultNotes(old=>({...old,[side]:e.target.value}))}
      style={{width:'100%',resize:'vertical',padding:9,border:'1px solid #d8e0ee',borderRadius:7}}/>
     <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      <button disabled={!conn[side]||!consultNotes[side].trim()} onClick={()=>send(side,'lab.note',{note:consultNotes[side].slice(0,250)})}>상담 메모 전송</button>
      <button disabled={!consultNotes[side].trim()} onClick={()=>{
       if(!('speechSynthesis' in window)){log(side,'TTS','브라우저 TTS 미지원','warn');return}
       const speech=new SpeechSynthesisUtterance(consultNotes[side].slice(0,300));
       speech.lang='ko-KR';speechSynthesis.cancel();speechSynthesis.speak(speech);
       log(side,'TTS','로컬 스피커 안내만 출력 · 통신사 통화 삽입 아님','info');
      }}>로컬 TTS</button>
     </div>
    </div>}
   <p className="hcp-actor-note">{taskMap[k]}</p>
  </section>;
 };
 return <main className="hcp-root">
  <header className="hcp-top">
   <div className="hcp-brand"><span>ㅎ</span><div><strong>HITEL</strong><small>DEVELOPERS / COMMUNICATION SDK</small></div></div>
   <nav><a href="/sdk-lab">Device Lab</a><a href="/portal">HITEL Portal</a><a href="/" >HITEL Room</a></nav>
  </header>
  <div className="hcp-heading"><div><span className="hcp-eyebrow">COMMUNICATION PLAYGROUND / 16 ENDPOINT COMBINATIONS</span><h1>16가지 통신 실험실</h1><p>발신자와 수신자를 나란히 조작하며 실제 WebSocket 메시지, 브라우저 WebRTC 미디어, 상태 전이를 시험합니다.</p></div><div className="hcp-heading-stats"><strong>16<span> / 16</span></strong><small>경로 선택 가능 · 실전화/AI 별도 검증</small></div></div>
  <section style={{maxWidth:1600,margin:'0 auto 16px',padding:'0 40px'}}>
   <div style={{background:'#fff',border:'1px solid #dbe5f2',borderRadius:12,padding:16,display:'flex',flexWrap:'wrap',alignItems:'center',gap:14}}>
    <div style={{flex:'1 1 260px'}}>
     <strong>16개 조합 · 실제 서버 WebSocket 일괄 검증</strong>
     <p style={{fontSize:12,color:'#71809a',margin:'4px 0 0'}}>각 경로마다 양측 독립 WS 접속·벨·수락·종료를 검사합니다. 통신사 전화망, 실제 아이폰 영상·음성, AI 응답을 검사한 결과는 아닙니다.</p>
    </div>
    <span role="status" style={{fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{audit.running?'진행 '+audit.done+'/16':audit.done?'완료 '+audit.passed+'/16 통과, '+audit.failed+' 실패':'아직 실행하지 않음'}</span>
    <button type="button" className="primary" disabled={audit.running} onClick={()=>void verifyAllSignalRoutes()}>{audit.running?'서버 검증 진행 중':'16개 WS 일괄 검증 실행'}</button>
   </div>
   {audit.details.length>0&&<details style={{background:'#fff',marginTop:5,borderRadius:8,padding:'10px 15px'}}>
    <summary style={{cursor:'pointer',fontSize:12,fontWeight:700}}>조합별 검증 결과 {audit.passed} 통과 / {audit.failed} 실패</summary>
    <div style={{marginTop:8,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:6}}>
     {audit.details.map((line,i)=><span key={i} style={{fontSize:11,color:line.includes('실패')?'#ac293f':'#286848'}}>{line}</span>)}
    </div>
   </details>}
  </section>
  <div className="hcp-layout">
   <aside className="hcp-sidebar">
    <div className="hcp-aside-head"><h2>통신 경로</h2><span>4 × 4 MATRIX</span></div>
    <div className="hcp-matrix"><span className="hcp-matrix-spacer">발신↓ 수신→</span>{KINDS.map(k=><b key={k}>{k}</b>)}{KINDS.map(k=><div className="hcp-matrix-row" key={k}><strong>{k}</strong>{ROUTES.filter(r=>r.from===k).map(r=><button key={r.id} title={label(r)} className={r.id===selected?'active':''} onClick={()=>select(r.id)}>{String(r.id).padStart(2,'0')}</button>)}</div>)}</div>
    <div className="hcp-filters">{(['all','rtc','gateway'] as const).map(x=><button key={x} className={scenarioFilter===x?'selected':''} onClick={()=>setScenarioFilter(x)}>{x==='all'?'전체 16':x==='rtc'?'N/W 통신':'전화망 혼합'}</button>)}</div>
    <div className="hcp-route-list">{filtered.map(r=><button key={r.id} className={selected===r.id?'current':''} onClick={()=>select(r.id)}><span>{String(r.id).padStart(2,'0')}</span><strong>{label(r)}</strong><small>{routeRtc(r)?'WebRTC 검증 대상':r.from==='P'&&r.to==='P'?'HITEL 비참여':'전화망 별도 필요'}</small></button>)}</div>
    <p className="hcp-sidebar-note">앱마다 고유 웹 주소로 연결합니다. 통신사 P/P+의 실제 전화망·AI 연결은 별도로 검증합니다.</p>
   </aside>
   <div className="hcp-main">
    <section className="hcp-scenario-head">
     <div><small>SCENARIO {String(current.id).padStart(2,'0')} / 16</small><h2>{label(current)} <span>{KINDS_LABEL[current.from]} → {KINDS_LABEL[current.to]}</span></h2>
      <p>{liveRtc?'양측 브라우저 독립 WS + 실제 브라우저 WebRTC 시험. N은 네이티브 대역으로만 표시합니다.':'양측 독립 WebSocket 신호 시험. 실제 통신사 전화망 연결은 수행하지 않습니다.'}</p></div>
     <div className="hcp-scenario-controls"><button onClick={()=>void create(selected)} disabled={busy}>{busy?'생성 중…':'새 테스트 세션'}</button><button className="primary" onClick={()=>{connect('A');connect('B')}} disabled={!sess||conn.A&&conn.B}>양측 WS 연결</button></div>
    </section>
    {notice&&<div role="alert" className="hcp-error">{notice}</div>}
    {devicePageToken&&<div style={{background:'#edf6ff',border:'1px solid #b6d4ee',borderRadius:12,padding:'14px 18px',margin:'12px 0',display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
     <div style={{flex:'1 1 250px'}}>
      <strong>이 iPhone 기능 앱 전용 관리 페이지</strong>
      <p style={{fontSize:12,margin:'5px 0',color:'#416887'}}>8자리 코드 없이 앱의 고유 주소만으로 자동 연결합니다. 기존 화면 스트리밍 앱과 별도입니다.</p>
      <span role="status" style={{fontSize:12,color:deviceStatus?.online?'#167447':'#ae6232'}}>
       {deviceStatus?.online?'● iPhone 기능 앱 온라인 · 자동 연결됨':'● 앱 실행 대기 · iPhone에서 HITEL Call 앱을 여십시오.'}
      </span>
      {autoAttachError&&<p style={{fontSize:11,color:'#aa653a'}}>연결 상태: {autoAttachError}</p>}
     </div>
     <span style={{fontSize:11,color:'#687991'}}>이 주소는 앱 제어 권한이 있으므로 다른 사람에게 공개하지 마십시오.</span>
    </div>}
    {devicePageToken&&current.from==='N'&&current.to==='N'&&<div style={{padding:12,background:'#fff',border:'1px solid #dbe5ee',borderRadius:10,margin:'10px 0'}}>
      <strong>두 번째 iPhone 기능 앱 자동 연결</strong>
      <p style={{fontSize:11,color:'#64748b'}}>두 번째 아이폰의 고유 웹 주소를 한 번 입력하면 B 역할로 연결됩니다. 숫자코드는 필요하지 않습니다.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
       <input style={{flex:'1 1 310px',padding:8,border:'1px solid #d2dce8',borderRadius:7}} placeholder="두 번째 앱의 고유 웹 주소" value={otherDeviceUrl} onChange={e=>setOtherDeviceUrl(e.target.value)}/>
       <button onClick={async()=>{
        try{
         const other=new URL(otherDeviceUrl),token=other.pathname.match(/\/communication-playground\/app\/([a-f0-9]{64})$/)?.[1];
         if(other.origin!==location.origin||!token||!sess)throw Error('올바른 HITEL 앱 고유 주소가 아닙니다.');
         await api('/device/attach',{pageToken:token,sessionId:sess.id,sessionSecret:sess.secret,side:'B'});
         log('DEVICE','AUTO','두 번째 실제 iPhone B 역할 연결 요청','ok');
        }catch(e){setAutoAttachError(textErr(e))}
       }}>두 번째 iPhone 연결</button>
      </div>
    </div>}
    <div className="hcp-safety"><span className={'hcp-mark '+(sess?'good':'idle')}>{sess?'서버 세션 있음':'테스트 세션 없음'}</span>
      <span>라우팅: {liveRtc?'브라우저 RTC 후보':'통화 신호 시험'}</span><span>네이티브 통신: {verifiedNativeSignaling?'N 프로토콜 연결':'참가 대기/해당 없음'}</span><span>전화망: 미연동</span><span>AI: 미연동</span>
    </div>
    <div className="hcp-players">{actor('A')}<div className="hcp-between"><span>⇄</span><small>실제 WS<br/>서버</small></div>{actor('B')}</div>
    <section className="hcp-rtc-cta"><div><strong>실제 브라우저 WebRTC 연결</strong><p>W↔W는 양측 브라우저를 준비하십시오. W→N은 W 발신자가 Offer를 보내고 실제 아이폰이 Answer를 보냅니다. N→W는 아이폰이 수락 후 Offer를 전송하므로 W 수신자는 먼저 카메라·마이크를 준비해 주십시오.</p></div><button className="primary" onClick={()=>void beginRtc()} disabled={!liveRtc||current.from==='N'||phase!=='accepted'||!localReady.A||(current.to==='W'&&!localReady.B)}>WebRTC 연결 실행</button></section>
    <section className="hcp-panels">
     <div className="hcp-panel"><div className="hcp-panel-head"><h3>기능별 실시간 검증</h3><strong>{passed} / 7</strong></div>
      <div className="hcp-checks">{checklist.map(item=>{const c=statusChecks.find(x=>x.id===item.id)!;return <div key={item.id}><span className={'hcp-light '+(c.ok?'ok':item.id==='native'||item.id==='pstn'||item.id==='ai'?'unavailable':'pending')}>{c.ok?'✓':'—'}</span><div><strong>{item.title}</strong><p>{c.desc}</p></div></div>})}</div>
      <div className="hcp-notes"><label htmlFor="hcp-note">시나리오별 발견 문제 / 수정 사항</label><textarea id="hcp-note" rows={3} placeholder="오류나 재현 조건을 기록하십시오." value={testNotes[selected]||''} onChange={e=>pushNotes(selected,e.target.value)}/><button onClick={()=>{const text=['HITEL PLAYGROUND · SC'+String(selected).padStart(2,'0')+' · '+label(current),'통화 상태: '+phase,'검증 결과: '+passed+'/7','메모: '+(testNotes[selected]||'없음'),...logs.slice(0,50).map(l=>l.at+' ['+l.side+'] '+l.kind+' '+l.text)].join('\n');void navigator.clipboard.writeText(text).then(()=>log('LAB','EXPORT','테스트 기록을 클립보드에 복사','ok')).catch(e=>log('LAB','ERROR',textErr(e),'error'))}}>검증 로그·메모 복사</button></div>
     </div>
     <div className="hcp-panel"><div className="hcp-panel-head"><h3>실시간 이벤트 로그</h3><button onClick={()=>setLogs([])}>로그 비우기</button></div><div className="hcp-log" aria-live="polite">{logs.length?logs.map(l=><div key={l.id} className={'hcp-log-entry '+l.tone}><time>{time(l.at)}</time><span>{l.side}</span><b>{l.kind}</b><p>{l.text}</p></div>):<div className="hcp-log-empty">테스트 세션을 생성하고 양측 WebSocket 연결을 시작하십시오. 발생하는 이벤트만 기록됩니다.</div>}</div></div>
    </section>
    <footer className="hcp-footer">HITEL Communication SDK · Browser WebSocket/WebRTC Playground · 실제 네이티브 N / 통신사 PSTN / AI 통합은 별도 단계에서 연동 및 검증</footer>
   </div>
  </div>
 </main>;
}
