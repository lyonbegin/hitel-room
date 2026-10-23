import { useEffect, useState } from 'react';
import { nativeCall, platform, type NativeCapabilities } from './nativeBridge';
import './portal.css';

type Channel = 'P' | 'P_PLUS' | 'NATIVE_VOIP' | 'WEBRTC';
type Login = {access_token: string; verified_phone: string; user_id: string};
const api = (import.meta.env.VITE_HITEL_PLATFORM_API_URL as string | undefined)?.replace(/\/$/, '');
async function post(path: string, payload: object, accessToken?: string): Promise<Record<string, unknown>> {
  if (!api) throw new Error('FastAPI 서버 주소가 아직 연결되지 않았습니다.');
  const response = await fetch(api + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? {Authorization:'Bearer ' + accessToken} : {}) },
    body: JSON.stringify(payload),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(String(data.detail || 'HTTP ' + response.status));
  return data;
}
const modes: Array<{key:Channel; name:string; description:string}> = [
  {key:'P_PLUS',name:'기존 010 통화 보조',description:'기존 이동통신 통화와 별도의 AI 정보화면'},
  {key:'WEBRTC',name:'모바일 웹 ↔ 모바일 웹',description:'WebRTC 영상·음성 연결'},
  {key:'NATIVE_VOIP',name:'HITEL 앱 통화',description:'앱에서 인터넷 음성·영상통화'},
  {key:'P',name:'일반전화 상대',description:'기존 전화망을 이용하는 상대방'},
];
export default function Portal() {
  const [os, setOs] = useState(platform());
  const [caps, setCaps] = useState<NativeCapabilities | null>(null);
  const [channel, setChannel] = useState<Channel>('P_PLUS');
  const [phone, setPhone] = useState('');
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [speech, setSpeech] = useState('안녕하세요. 하이텔 음성 테스트입니다.');
  const [purpose, setPurpose] = useState('일반 상담');
  const [status, setStatus] = useState('앱 기능을 확인합니다.');
  const [session, setSession] = useState<Login | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('hitel-platform-session') || 'null') as Login|null; } catch { return null; }
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void nativeCall('getCapabilities').then(res => {
      setOs(res.platform || 'browser'); setCaps(res.capabilities || null); setStatus('단말 기능 확인 완료');
    }).catch(e => setStatus('기능 확인: ' + String(e)));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <div className="ht-portal">
    <header className="ht-top"><div><strong>HITEL</strong><small>Intelligent Communication Portal</small></div><a href="/">기존 영상방 ↗</a></header>
    <section className="ht-intro"><span>PERSONAL AI FOR EVERY CONVERSATION</span><h1>모든 대화에<br/>각자의 AI를 연결합니다.</h1><p>앱·웹·일반전화가 서로 다른 방식으로 연결되어도, 대화 참여자는 필요한 AI와 자료를 자신의 화면에서 이용합니다.</p></section>
    <section className="ht-panel"><div className="ht-row"><h2>01 · 연결 방식</h2><span>{os === 'browser' ? '브라우저' : os + ' 앱'}</span></div><div className="ht-modes">
      {modes.map(m => <button key={m.key} type="button" aria-pressed={m.key===channel} className={m.key===channel?'active':''} onClick={()=>setChannel(m.key)}><b>{m.name}</b><small>{m.description}</small></button>)}
    </div><div className="ht-caps"><span>앱 브리지 {caps?.nativeBridge?'● 연결':'○ 없음'}</span><span>로컬 TTS {caps?.localTts?'● 가능':'○ 제한'}</span><span>일반통화 수신 음성 {caps?.readCellularRemoteAudio?'● 가능':'○ 미연동'}</span><span>일반통화 음성 삽입 {caps?.injectCellularAudio?'● 가능':'○ 미연동'}</span></div></section>
    <section className="ht-panel"><h2>02 · 전화번호 본인 인증</h2><p>기존 010 번호를 회원 계정과 연결합니다. 인증문자는 실제 SMS 발송 서비스와 연동됩니다.</p>
      {session?<div className="ht-ok">인증번호: <b>{session.verified_phone}</b><button type="button" onClick={()=>{sessionStorage.removeItem('hitel-platform-session');setSession(null);}}>로그아웃</button></div>:<>
        <div className="ht-form"><input aria-label="본인 휴대전화번호" type="tel" placeholder="010-1234-5678" value={phone} onChange={e=>setPhone(e.target.value)}/><button disabled={busy||!api} onClick={()=>void run(async()=>{await post('/v1/auth/otp/request',{phone});setStatus('인증 문자 발송 요청 완료');})}>인증 요청</button></div>
        <div className="ht-form"><input aria-label="6자리 인증번호" inputMode="numeric" placeholder="6자리 인증번호" value={code} onChange={e=>setCode(e.target.value)}/><button disabled={busy||!api} onClick={()=>void run(async()=>{const result=await post('/v1/auth/otp/verify',{phone,code}) as unknown as Login;setSession(result);sessionStorage.setItem('hitel-platform-session',JSON.stringify(result));setStatus('번호 인증 완료');})}>인증 확인</button></div>
      </>}
      {!api&&<p className="ht-warning">플랫폼 FastAPI의 배포 URL을 연결하면 전화번호 인증을 사용할 수 있습니다.</p>}
    </section>
    <section className="ht-panel"><h2>03 · 스마트폰 네이티브 연결</h2><p>아래 음성 재생은 내 기기 스피커에서만 동작합니다. 전화 상대방에게 보내는 TTS는 별도의 전화 미디어 기능입니다.</p>
      <div className="ht-form"><input aria-label="재생할 문장" value={speech} onChange={e=>setSpeech(e.target.value)}/><button disabled={busy||!caps?.localTts} onClick={()=>void run(async()=>{await nativeCall('tts.speak',{text:speech,language:'ko-KR'});setStatus('내 기기 TTS 재생 요청 완료');})}>음성 재생</button></div>
      <div className="ht-form"><input aria-label="상대방 전화번호" type="tel" placeholder="상대방 번호" value={target} onChange={e=>setTarget(e.target.value)}/><button disabled={busy||!target} onClick={()=>void run(async()=>{await nativeCall('call.openDialer',{phone:target});setStatus('시스템 전화 앱 열기 요청 완료');})}>일반전화 열기</button></div>
    </section>
    <section className="ht-panel"><h2>04 · 대화 세션</h2><p>현재는 대화 메타데이터 생성 단계입니다. 실제 전화망 연결과 AI 오디오 분석은 별도 연결 모듈을 추가합니다.</p>
      <div className="ht-form"><input aria-label="대화 목적" value={purpose} onChange={e=>setPurpose(e.target.value)}/><button disabled={busy||!session||!api} onClick={()=>void run(async()=>{const x=await post('/v1/interactions',{purpose,channel,target:target||null},session?.access_token);setStatus('대화 생성 ' + String(x.id));})}>세션 등록</button></div>
    </section>
    <div className="ht-status" role="status">{status}</div>
  </div>;
}
