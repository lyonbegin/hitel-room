import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CommunicationSDK, CommunicationCallSession, createCommunicationSession, describeRoute, type CommunicationEvent, type CommunicationAction } from '../communication-sdk';
import { openVideoCoreCamera, type VideoCoreCameraSession } from '../lib/videoCore';
import './DeviceLab.css';
import './DeviceLab.extra.css';
import {OriginalAndroidEmbed} from './OriginalAndroidEmbed';
import {AndroidSessionControls} from './AndroidSessionControls';

type Side = 'android' | 'ios';
type LabAction = 'home' | 'sdk' | 'call' | 'ai' | 'capabilities' | 'media' | 'refresh' | 'back';
type AgentState = { online: boolean; lastSeen?: string; app?: string; bridge?: string; sdk?: string; note?: string; capture?: boolean; screenMode?: string; runId?: string; ciPass?: boolean|null };
type StatusResult = { devices?: Partial<Record<Side, AgentState>>; ci?: Partial<Record<Side,{runId:string;updatedAt:string;passed:boolean;log:string;url:string}>>; mode?: string };
type LabNotice = { side: Side; message: string; time: string };
const SIDES: Side[] = ['android','ios'];
const LABELS: Record<Side,string> = {android:'Android Emulator',ios:'iPhone Simulator'};
const shortcuts: { id:LabAction; label:string; icon:string }[] = [
  {id:'home',label:'홈',icon:'⌂'},{id:'sdk',label:'SDK 기능',icon:'▦'},
  {id:'call',label:'전화',icon:'☎'},{id:'ai',label:'AI 상담',icon:'✦'},
  {id:'capabilities',label:'브리지 검사',icon:'◉'},{id:'media',label:'카메라 검사',icon:'▣'},
  {id:'refresh',label:'새로고침',icon:'↻'},{id:'back',label:'뒤로',icon:'←'}
];
const now = () => new Date().toLocaleTimeString('ko-KR',{hour12:false});
const labPath = (side:Side) => '/sdk-lab/device?side=' + side;

function MiniIcon({side}:{side:Side}){
  return <span className={'dl-platform-icon dl-'+side}>{side==='android'?'▣':'●'}</span>;
}

/** Runs inside a normal browser preview OR the real Android/iPhone WebView.
 * Browser fallback is ALWAYS identified and never presented as a native Bridge.
 */
export function DeviceLabPhone() {
  const side: Side = new URLSearchParams(window.location.search).get('side') === 'ios' ? 'ios':'android';
  const sdk = useMemo(()=>CommunicationSDK.create(),[]);
  const [route,setRoute]=useState<LabAction>(()=>{const screen=new URLSearchParams(window.location.search).get('screen');return (['home','sdk','ai','call','media'].includes(screen||'')?screen:'home') as LabAction;});
  const [platform,setPlatform]=useState(sdk.platform);
  const [bridge,setBridge]=useState('검사 전');
  const [camera,setCamera]=useState('사용 안 함');
  const [lines,setLines]=useState<string[]>([]);
  const [text,setText]=useState('안녕하세요. Communication SDK 테스트입니다.');
  const [phone,setPhone]=useState('120');
  const cameraEl=useRef<HTMLVideoElement>(null);
  const mediaRef=useRef<MediaStream|null>(null);
  const videoCoreRef=useRef<VideoCoreCameraSession|null>(null);
  const [callToken,setCallToken]=useState(()=>new URLSearchParams(window.location.search).get('callToken')||'');
  const [callState,setCallState]=useState('연결 전');
  const [callId,setCallId]=useState('');
  const [calleeLink,setCalleeLink]=useState('');
  const callRef=useRef<CommunicationCallSession|null>(null);

  const push=useCallback((line:string)=>{
    setLines(v=>[now()+'  '+line,...v].slice(0,12));
    try {
      if (window.parent!==window)
        window.parent.postMessage({source:'hitel-device-lab',side,line,time:now()},window.location.origin);
    } catch { /* frame messaging is optional */ }
  },[side]);
  useEffect(()=>{
    if(!callToken.trim()){setCallState('연결 전');return}
    const session=new CommunicationCallSession(sdk,callToken.trim());
    callRef.current=session;
    const off=session.on(event=>{
      setCallState(event.state);
      push('COMM '+event.type+' #'+event.sequence+' '+event.state);
    });
    const onConn=session.signaling.onConnection(online=>push(online?'COMM 웹 소켓 연결':'COMM 웹 소켓 재접속 대기'));
    void session.connect().then(()=>{
      setCallId(session.callId);
      setCallState(session.state);
      push('COMM 인증된 세션 '+session.callId+' / scenario '+session.signaling.scenarioId);
    }).catch(e=>push('COMM 연결 오류 '+String(e)));
    return ()=>{off();onConn();if(callRef.current===session)callRef.current=null;void session.dispose()};
  },[callToken,sdk,push]);
  async function issueCall(){
    try{
      const pair=await createCommunicationSession('N','N');
      setCalleeLink(window.location.origin+'/sdk-lab/device?side=ios&screen=call&callToken='+encodeURIComponent(pair.calleeToken));
      setCallToken(pair.callerToken);
      setRoute('call');
      push('COMM N→N 세션 생성 '+pair.callId);
    }catch(e){push('COMM 세션 생성 오류 '+String(e))}
  }
  async function callAction(action:CommunicationAction){
    const session=callRef.current;
    if(!session){push('COMM 유효한 참가자 토큰을 연결하십시오');return}
    try{
      await session.signaling.action(action);
      push('COMM 실제 서버 ACK '+action);
    }catch(e){push('COMM 요청 거절 '+action+': '+String(e))}
  }
  async function testVideoCore(){
    try{
      const camera=await openVideoCoreCamera('original');
      videoCoreRef.current?.stop();
      mediaRef.current?.getTracks().forEach(t=>t.stop());
      videoCoreRef.current=camera;
      mediaRef.current=camera.stream;
      setCamera('VideoCore SDK 카메라 연결됨');
      if(cameraEl.current){cameraEl.current.srcObject=camera.stream;void cameraEl.current.play().catch(()=>{})}
      push('VIDEO_CORE_CONNECTED '+camera.stream.getTracks().map(t=>t.kind).join(','));
    }catch(e){push('VIDEO_CORE_ERROR '+String(e))}
  }
  const check=useCallback(async()=>{
    setBridge('검사 중');
    try{
      const cap=await sdk.getCapabilities();
      setPlatform(cap.platform);
      const genuine=cap.native.nativeBridge && cap.platform===side;
      setBridge(genuine?'Native Bridge 정상':cap.platform==='browser'?'브라우저 미리보기':'플랫폼 불일치');
      push('getCapabilities: '+JSON.stringify({platform:cap.platform,nativeBridge:cap.native.nativeBridge,rtc:cap.native.webrtcWebview}));
    }catch(e){setBridge('브리지 응답 실패');push('ERROR '+String(e))}
  },[sdk,side,push]);
  const testMedia=useCallback(async()=>{
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
      mediaRef.current?.getTracks().forEach(t=>t.stop());
      mediaRef.current=stream;
      setCamera('마이크·카메라 열림');
      push('getUserMedia OK '+stream.getTracks().map(t=>t.kind).join(','));
      if(cameraEl.current){cameraEl.current.srcObject=stream;void cameraEl.current.play().catch(()=>{})}
    }catch(e){setCamera('사용 불가');push('getUserMedia ERROR '+String(e))}
  },[push]);
  const navigate=useCallback((next:LabAction)=>{
    if(next==='refresh'){window.location.reload();return}
    if(next==='capabilities'){void check();return}
    if(next==='media'){setRoute('media');void testMedia();return}
    if(next==='back'){setRoute('home');return}
    setRoute(next);
  },[check,testMedia]);
  useEffect(()=>{
    const off=sdk.on((event:CommunicationEvent)=>push(event.type+': '+JSON.stringify(event.detail??{}).slice(0,130)));
    void check();
    const receive=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin || event.data?.source!=='hitel-device-lab-control')return;
      if(event.data.side!==side && event.data.side!=='both')return;
      if(shortcuts.some(c=>c.id===event.data.action))navigate(event.data.action as LabAction);
    };
    window.addEventListener('message',receive);
    return ()=>{window.removeEventListener('message',receive);off();videoCoreRef.current?.stop();mediaRef.current?.getTracks().forEach(t=>t.stop());void sdk.dispose()};
  },[sdk,side,push,check,navigate]);
  async function speak(){
    try{await sdk.speakLocally(text);push('로컬 TTS 요청 성공')}catch(e){push('TTS ERROR '+String(e))}
  }
  async function openDialer(){
    try{await sdk.openSystemDialer(phone);push('기본 전화 앱 호출 요청 성공')}catch(e){push('Dialer ERROR '+String(e))}
  }
  async function ai(){
    push('AI Counselor SDK 실제 응답 요청');
    try{
      const res=await sdk.respondWithAI(text);
      push('AI 응답: '+JSON.stringify(res).slice(0,170));
    }catch(e){push('AI ERROR '+String(e))}
  }
  return <div className={'dl-device-ui dl-os-'+side}>
    <div className="dl-device-status"><span>{now().slice(0,5)}</span><span>▂▃▅ ▰</span></div>
    <header className="dl-device-bar">
      <span className="dl-device-brand">◉ HITEL</span>
      <span>COMMUNICATION SDK</span>
      <span className="dl-device-bar-dot">•••</span>
    </header>
    <div className="dl-device-body">
      <div className="dl-device-kicker">SDK DEVICE LAB · {side.toUpperCase()}</div>
      <h1>{route==='home'?'스마트 통신의 시작':route==='sdk'?'SDK 기능 검증':route==='ai'?'AI 상담사 테스트':route==='call'?'전화 연결 테스트':'미디어 권한 검사'}</h1>
      <p className="dl-device-desc">네이티브 앱 ↔ WebView ↔ Communication SDK ↔ AI / WebRTC</p>
      <div className={'dl-device-bridge '+(bridge==='Native Bridge 정상'?'dl-good':'dl-preview')}>
        <span>●</span><div><b>{bridge}</b><small>검출: {platform} · 앱 기대값: {side}</small></div>
      </div>
      {route==='home'&&<>
        <div className="dl-device-quick">
          <button onClick={()=>navigate('call')}><span>☎</span>전화</button>
          <button onClick={()=>navigate('sdk')}><span>▦</span>SDK</button>
          <button onClick={()=>navigate('ai')}><span>✦</span>AI</button>
          <button onClick={()=>navigate('media')}><span>▣</span>영상</button>
        </div>
        <div className="dl-device-panel"><b>Communication SDK</b><p>이 화면은 실제 앱의 WebView에서도 동일하게 실행됩니다. 아래 진단 기능은 SDK API를 직접 호출합니다.</p>
          <p>별도 로그인이나 코드 입력 없이 웹에서 SDK 기능을 바로 검사합니다. 실제 네이티브 기능은 원본 Android 화면에서 테스트합니다.</p>
          <button className="dl-device-primary" onClick={()=>void check()}>Native Bridge 연결 검사 →</button>
        </div>
        <div className="dl-device-16"><strong>16가지 연결 시나리오</strong><span>P / P+ / N / W</span><small>W → N: #{describeRoute('W','N').id} · WebRTC 후보</small></div>
      </>}
      {route==='sdk'&&<div className="dl-device-panel">
        <b>SDK 런타임</b><p>Communication SDK v{sdk.version}</p>
        <p>실제 운영 AI Counselor ESM과 기존 HITEL RoomAdapter가 연결되는 SDK입니다.</p>
        <button onClick={()=>void check()}>getCapabilities()</button>
        <button onClick={()=>navigate('media')}>getUserMedia()</button>
        <button onClick={()=>{setRoute('ai')}}>AI Counselor SDK →</button>
      </div>}
      {route==='call'&&<div className="dl-device-panel"><b>실제 Communication 통화 신호</b>
        <p>기존 통화 제어 화면과 별도로 서버의 실제 발신·수락·종료 이벤트를 테스트합니다.</p>
        <button onClick={()=>void issueCall()}>N→N 통화 테스트 생성</button>
        <small>통화 세션은 위 버튼으로 자동 생성됩니다. 참가자 인증 정보를 직접 입력하실 필요가 없습니다.</small>
        <small>서버 상태: {callState} · 세션: {callId||'대기'}</small>
        {calleeLink&&<input readOnly value={calleeLink} aria-label="수신자 접속 링크"/>}
        <div className="dl-device-quick">
          <button onClick={()=>void callAction('call.invite')}>발신 요청</button>
          <button onClick={()=>void callAction('call.ringing')}>수신 알림</button>
          <button onClick={()=>void callAction('call.accept')}>수락</button>
          <button onClick={()=>void callAction('call.reject')}>거절</button>
          <button onClick={()=>void callAction('call.end')}>통화 종료</button>
        </div>
        <b>기본 전화 앱 열기</b><p>통신사 전화 음성에 접근하지 않습니다.</p>
        <input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" aria-label="전화번호"/>
        <button className="dl-device-primary" onClick={()=>void openDialer()}>call.openDialer 실행</button>
      </div>}
      {route==='ai'&&<div className="dl-device-panel"><b>개인 AI 상담 테스트</b>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={3} aria-label="AI 입력"/>
        <button onClick={()=>void speak()}>로컬 음성 재생</button>
        <button className="dl-device-primary" onClick={()=>void ai()}>AI 응답 요청</button>
      </div>}
      {route==='media'&&<div className="dl-device-panel"><b>카메라·마이크</b><p>{camera}</p>
        <video ref={cameraEl} className="dl-device-video" muted autoPlay playsInline/>
        <button className="dl-device-primary" onClick={()=>void testMedia()}>권한 요청 · 영상 열기</button>
        <button onClick={()=>void testVideoCore()}>실제 VideoCore SDK 카메라 열기</button>
        <button onClick={()=>{videoCoreRef.current?.stop();videoCoreRef.current=null;mediaRef.current?.getTracks().forEach(t=>t.stop());mediaRef.current=null;setCamera('종료됨');if(cameraEl.current)cameraEl.current.srcObject=null}}>카메라 중지</button>
      </div>}
      <div className="dl-device-log"><b>SDK 실행 로그</b>{lines.length?lines.slice(0,4).map((line,i)=><span key={i}>{line}</span>):<span>명령 실행 대기</span>}</div>
    </div>
    <footer className="dl-device-bottom">
      <button onClick={()=>navigate('home')}>⌂<small>홈</small></button><button onClick={()=>navigate('call')}>☎<small>전화</small></button>
      <button onClick={()=>navigate('sdk')}>▦<small>SDK</small></button><button onClick={()=>navigate('ai')}>✦<small>AI</small></button>
    </footer>
    <div className="dl-device-home-indicator"/>
  </div>;
}

export default function DeviceLab(){
  const [selected,setSelected]=useState<'both'|Side>('both');
  const [view,setView]=useState<'preview'|'remote'>('remote');
  const [nativeAndroidOnline,setNativeAndroidOnline]=useState(false);
  const [deviceSize,setDeviceSize]=useState('390');
  const [frameVersion,setFrameVersion]=useState<Record<Side,number>>({android:0,ios:0});
  const [agent,setAgent]=useState<Partial<Record<Side,AgentState>>>({});
  const [notices,setNotices]=useState<LabNotice[]>([]);
  const [ci,setCi]=useState<StatusResult['ci']>({});
  const firstCapture=useRef(false);
  const [capture,setCapture]=useState<Partial<Record<Side,string>>>({});
  const urls=useRef<Partial<Record<Side,string>>>({});
  const ref=useRef<Partial<Record<Side,HTMLIFrameElement|null>>>({});
  const push=useCallback((side:Side,message:string)=>{
    setNotices(prev=>[{side,message,time:now()},...prev].slice(0,42));
  },[]);
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin||event.data?.source!=='hitel-device-lab')return;
      if(!SIDES.includes(event.data.side))return;
      push(event.data.side,event.data.line);
    };
    window.addEventListener('message',receive);
    return ()=>window.removeEventListener('message',receive);
  },[push]);
  const readStatus=useCallback(async()=>{
    // The original Android viewer belongs to the ephemeral Sandbox, not the
    // removed permanent relay. Only a real viewer URL marks it as online.
    try {
      const response=await fetch('/lab-sandbox/status',{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const sandbox=await response.json() as {status?:string;viewerUrl?:string|null};
      setNativeAndroidOnline(sandbox.status==='running'&&Boolean(sandbox.viewerUrl));
    } catch {setNativeAndroidOnline(false)}
    // Legacy CI snapshot metadata is optional; it never controls live state.
    try {
      const result=await fetch('/lab-api/status',{cache:'no-store'});
      if(!result.ok)return;
      const data=await result.json() as StatusResult;
      setAgent(data.devices||{});
      setCi(data.ci||{});
      if(!firstCapture.current && (data.devices?.android?.capture||data.devices?.ios?.capture)){
        firstCapture.current=true;
        setView('remote');
      }
    } catch { /* Legacy relay is not required for SDK testing */ }
  },[]);
  useEffect(()=>{void readStatus();const timer=window.setInterval(()=>void readStatus(),5000);return ()=>clearInterval(timer)},[readStatus]);
  const loadCapture=useCallback(async(side:Side)=>{
    try{
      const response=await fetch('/lab-api/frame/'+side,{cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const next=URL.createObjectURL(await response.blob());
      const old=urls.current[side];urls.current[side]=next;setCapture(v=>({...v,[side]:next}));
      if(old)URL.revokeObjectURL(old);
    }catch{/* no frame available */ }
  },[]);
  useEffect(()=>{
    if(view!=='remote')return;
    SIDES.forEach(s=>void loadCapture(s));
    const timer=window.setInterval(()=>SIDES.forEach(s=>void loadCapture(s)),3500);
    return ()=>{clearInterval(timer)};
  },[view,loadCapture]);
  useEffect(()=>()=>{Object.values(urls.current).forEach(u=>{if(u)URL.revokeObjectURL(u)})},[]);
  const send=useCallback((action:LabAction)=>{
    const targets=selected==='both'?SIDES:[selected];
    for(const side of targets){
      if(view==='preview'){
        if(action==='refresh')setFrameVersion(v=>({...v,[side]:v[side]+1}));
        else ref.current[side]?.contentWindow?.postMessage({source:'hitel-device-lab-control',side,action},window.location.origin);
        push(side,'SDK 웹 테스트: '+action);
      }else{
        push(side,'실제 기기에서는 원본 Android 화면을 직접 터치해 조작해 주십시오.');
      }
    }
  },[selected,view,push]);
  return <div className="dl-lab">
    <aside className="dl-sidebar">
      <div className="dl-logo">◉ <b>HITEL</b><span>Communication SDK</span></div>
      <div className="dl-nav-label">개발 작업실</div>
      <a className="dl-nav-item active" href="/sdk-lab">▦　이중 단말 검증 <small>01</small></a>
      <a className="dl-nav-item" href="/portal">⌂　HITEL 포털 <small>02</small></a>
      <a className="dl-nav-item" href="/portal/flows">◈　16가지 연결 <small>03</small></a>
      <div className="dl-nav-label">검사 및 관리</div>
      <a className="dl-nav-item" href="/android-original/">▣　Android 원본 에뮬레이터 <small>04</small></a>
      <a className="dl-nav-item" href="https://github.com/lyonbegin/hitel-room/actions" target="_blank" rel="noreferrer">✓　에뮬레이터 CI</a>
      <a className="dl-nav-item" href="https://github.com/lyonbegin/hitel-room/tree/feature/communication-sdk" target="_blank" rel="noreferrer">☷　SDK 소스</a>
      <div className="dl-sidebar-note">Android · iPhone 동시 개발 환경<br/>실제 기기 상태와 브라우저 미리보기를 분리합니다.</div>
    </aside>
    <main className="dl-main">
      <div className="dl-header"><div><span className="dl-breadcrumb">HITEL / DEVELOPERS / DEVICE LAB</span><h1>Communication SDK 에뮬레이터 관리</h1><p>원본 Android 11 · KVM 지원 일회용 호스트 · scrcpy/noVNC 실시간 실행 환경입니다. 원본 앱 관리 화면에서 APK 설치와 기기 조작이 가능하며, 테스트 종료 후 가상기기가 초기화됩니다.</p></div><span className="dl-header-version">SDK v0.1.0 · 개발 환경</span></div>
      <div className="dl-counters">
        <div><small>Android Emulator</small><strong>{nativeAndroidOnline?'원본 Android 실행 중':'원본 Android 실행 대기'}</strong><span>실제 앱 / WebView</span></div>
        <div><small>iPhone Simulator</small><strong>{agent.ios?.online?'호스트 연결':'호스트 미연결'}</strong><span>실제 앱 / WKWebView</span></div>
        <div><small>SDK 웹 화면</small><strong>React H5</strong><span>네이티브 앱에서 로드</span></div>
        <div><small>개발 서버</small><strong>Railway</strong><span>웹 및 테스트 API</span></div>
      </div>
      <div className="dl-layout">
        {SIDES.map(side=><section key={side} className="dl-emulator-card">
          <header className="dl-card-top"><div className="dl-card-heading"><MiniIcon side={side}/><div><b>{LABELS[side]}</b><small>{side==='android'?'Android APK · WebView':'iOS App · WKWebView'}</small></div></div>
          <span className={'dl-pill '+(agent[side]?.online?'live':'waiting')}>{agent[side]?.online?'● 앱 WebSocket 연결':agent[side]?.capture?'● CI 캡처 보관':'● 연결 대기'}</span></header>
          <div className="dl-emulator-toolbar"><select aria-label={LABELS[side]+' 디바이스 크기'} value={deviceSize} onChange={e=>setDeviceSize(e.target.value)}>
            <option value="390">iPhone 14 · 390</option><option value="360">Android · 360</option><option value="430">Large · 430</option></select>
            <div><button title="홈" onClick={()=>{setSelected(side);ref.current[side]?.contentWindow?.postMessage({source:'hitel-device-lab-control',side,action:'home'},window.location.origin)}}>⌂</button>
              <button title="새로고침" onClick={()=>setFrameVersion(v=>({...v,[side]:v[side]+1}))}>↻</button>
              <button title="새 창에서 열기" onClick={()=>window.open(side==='android'?'/android-original/':labPath(side),'_blank','noopener')}>↗</button></div>
          </div>
          <div className="dl-emulator-display">
            <div className={view==='remote'&&side==='android'?'dl-original-native-host':'dl-phone-shell dl-phone-'+side}
              style={{width:view==='remote'&&side==='android'?'min(100%, 920px)':'min(100%, '+deviceSize+'px)',
                ...(view==='remote'&&side==='android'?{height:660,minHeight:660}: {})}}>
              {!(view==='remote'&&side==='android')&&<div className="dl-phone-notch"/>}
              {view==='remote' && side==='android'?(
                <OriginalAndroidEmbed/>
              ):view==='remote'?(
                capture[side]?<img className="dl-remote-screen" src={capture[side]} alt={LABELS[side]+' 실제 앱/시뮬레이터 화면'}/>:
                <div className="dl-capture-empty"><b>실제 에뮬레이터 화면 대기</b><p>GitHub Actions에서 앱 설치 및 화면 캡처 후 표시됩니다.</p></div>
                ):<iframe key={side+frameVersion[side]} ref={el=>{ref.current[side]=el}} title={LABELS[side]+' SDK 웹 미리보기'} src={labPath(side)} allow="camera; microphone"/>}
            </div>
            {view==='remote'&&side==='ios'&&!agent[side]?.online&&<div className="dl-overlay-warning">{capture[side]?'GitHub Actions 마지막 실제 캡처 · 현재 실시간 연결 아님':'실제 에뮬레이터 실행 결과 대기'}</div>}
          </div>
          <footer className="dl-card-footer"><span>{view==='remote'&&side==='android'?'원본 Android · scrcpy/noVNC':deviceSize+' px'} · {view==='remote'&&side==='android'?'실제 원본 에뮬레이터':view==='remote'?(agent[side]?.online?'실제 화면 캡처':'마지막 저장 캡처'):'H5 웹 미리보기'}</span><b>{side==='android'?'Android':'iPhone'}</b><span>Communication SDK</span></footer>
        </section>)}
        <section className="dl-command-column">
          <div className="dl-command-card"><h3>에뮬레이터 제어</h3><p>Android · iPhone을 각각 또는 동시에 조작합니다.</p>
            <div className="dl-switch"><button className={selected==='android'?'selected':''} onClick={()=>setSelected('android')}>Android</button><button className={selected==='ios'?'selected':''} onClick={()=>setSelected('ios')}>iPhone</button><button className={selected==='both'?'selected':''} onClick={()=>setSelected('both')}>둘 다</button></div>
            <div className="dl-mode"><button className={view==='preview'?'selected':''} onClick={()=>setView('preview')}>웹 미리보기</button><button className={view==='remote'?'selected':''} onClick={()=>setView('remote')}>실제 Android 화면</button></div>
            <div className="dl-status-list"><div><span>Android 테스트 연결</span>
              <strong>{nativeAndroidOnline?'원본 scrcpy/noVNC 연결됨':'원본 실행 대기'}</strong>
            </div></div>
            <AndroidSessionControls onNotice={message=>push('android',message)}/>
            <div className="dl-pair">
              <a href="/android-original/" style={{fontSize:12,fontWeight:750,color:'#126987'}}>▣ Android Emulator Platform 원본 관리 화면 열기 ↗</a>
              <small>원본 Android를 실행하면 scrcpy/noVNC 실시간 화면이 직접 열립니다.</small>
            </div>
            {view==='preview'?<div className="dl-command-grid">{shortcuts.map(item=><button key={item.id} onClick={()=>send(item.id)}><span>{item.icon}</span>{item.label}</button>)}</div>:<p className="dl-android-session-hint">실제 Android 화면은 상단의 원본 화면에서 직접 터치하여 조작합니다. 제어용 로그인·인증코드를 요구하지 않습니다.</p>}
            <div className="dl-status-list"><b>연결 상태</b><div><span>Android 원본 에뮬레이터</span><strong>{nativeAndroidOnline?'scrcpy 연결됨':'실행 대기'}</strong></div><div><span>iPhone 호스트</span><strong>{agent.ios?.online?'연결됨':'대기'}</strong></div><div><span>네이티브 Bridge 검사</span><strong>기기 내부에서 검증</strong></div></div>
          </div>
          <div className="dl-command-card"><h3>검증 원칙</h3><p>현재 화면의 실행 상태를 구분합니다.</p><div className="dl-legend"><span className="dl-dot blue"/>웹 미리보기: 브라우저 SDK 작동</div><div className="dl-legend"><span className="dl-dot green"/>실제 에뮬레이터: 원본 scrcpy/noVNC 화면</div><div className="dl-legend"><span className="dl-dot amber"/>네이티브 기능은 Bridge 실응답으로만 판정</div></div>
        </section>
      </div>
      <section className="dl-bottom-log"><div><h3>실시간 명령·SDK 이벤트 로그</h3><button onClick={()=>setNotices([])}>로그 비우기</button></div>
        <div className="dl-logs">{notices.length?notices.slice(0,16).map((line,i)=><div key={i}><span>{line.time}</span><b>{line.side==='android'?'Android':'iPhone'}</b><span>{line.message}</span></div>):<p>양쪽 에뮬레이터에서 SDK 이벤트가 발생하면 이 영역에 표시됩니다.</p>}</div>
        <div className="dl-ci-reports">{SIDES.map(side=><details key={side}><summary>{LABELS[side]} · {ci?.[side]?(ci[side]?.passed?'검증 성공':'검증 결과 확인'):'아직 결과 없음'} {ci?.[side]?.runId&&<span>Run #{ci[side]?.runId}</span>}</summary><pre>{ci?.[side]?.log||'GitHub Actions 실행 및 실제 앱 화면 캡처 대기'}</pre>{ci?.[side]?.url&&<a href={ci[side]?.url} target="_blank" rel="noreferrer">해당 GitHub Actions 실행 열기 ↗</a>}</details>)}</div></section>
    </main>
  </div>;
}
