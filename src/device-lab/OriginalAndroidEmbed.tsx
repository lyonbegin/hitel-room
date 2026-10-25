import {useEffect,useState} from 'react';
import {AndroidSessionControls} from './AndroidSessionControls';

type NativeStatus={
  ok?:boolean;
  online?:boolean;
  url?:string;
  engine?:string;
  transport?:string;
  runId?:string;
  error?:string;
};

/**
 * Attach DIRECTLY to the original scrcpy/noVNC Android touchscreen.
 * The upstream emulator dashboard creates a NEW session on "Launch" and
 * therefore wrongly shows "All devices busy" after its only slot is
 * already claimed by an existing live session.
 *
 * This viewer reuses that existing native stream. No fake Android frame,
 * no extra reservation, and no modification to the upstream application.
 */
export function OriginalAndroidEmbed(){
  const [status,setStatus]=useState<NativeStatus|null>(null);
  const [checking,setChecking]=useState(true);

  useEffect(()=>{
    let active=true;
    const check=async()=>{
      try{
        const response=await fetch('/lab-api/android-native/status',{cache:'no-store'});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const next=await response.json() as NativeStatus;
        if(active){setStatus(next);setChecking(false);}
      }catch{
        if(active){setStatus({ok:false,online:false,error:'relay_unavailable'});setChecking(false);}
      }
    };
    void check();
    const interval=window.setInterval(()=>void check(),4000);
    return ()=>{active=false;window.clearInterval(interval);};
  },[]);

  const valid=Boolean(status?.online
    &&status.transport==='original-scrcpy-novnc'
    &&status.url?.startsWith('https://')
    &&status.url.endsWith('.trycloudflare.com'));
  const base=valid?status?.url||'':'';
  const viewerUrl=base+'/stream/1/phone.html';

  // Presence is renewed only while this HITEL page is visibly open.
  // Merely polling status must not keep a disposable KVM runner alive.
  useEffect(()=>{
    if(!base)return;
    const ping=()=>{
      if(document.visibilityState==='visible'){
        void fetch('/lab-api/android-native/heartbeat',{
          method:'POST',credentials:'same-origin',cache:'no-store'
        }).catch(()=>{});
      }
    };
    ping();
    const timer=window.setInterval(ping,20000);
    document.addEventListener('visibilitychange',ping);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',ping)};
  },[base]);

  if(!valid)return <div style={{
    display:'grid',placeContent:'center',height:'100%',minHeight:480,
    padding:24,textAlign:'center',color:'#73848c',gap:10}}>
    <strong style={{color:'#193f51'}}>
      {checking?'원본 Android 연결 검사 중':'원본 Android 실시간 화면 연결 대기'}
    </strong>
    <span>{status?.error==='host_unreachable'
      ?'기존 임시 실행 호스트가 응답하지 않습니다. 이전 실행 표시를 사용하지 않습니다.'
      :'Android 실행 버튼으로 실제 기기를 시작하면 이곳에 터치 가능한 원본 화면이 표시됩니다.'}</span>
    <span>원본 scrcpy/noVNC 실제 응답만 표시하며 저장된 캡처나 웹 미리보기로 대신하지 않습니다.</span>
  </div>;

  return <div style={{height:'100%',minHeight:570,display:'flex',
    flexDirection:'column',width:'100%'}}>
    <div style={{
      padding:'8px 12px',display:'flex',gap:9,justifyContent:'space-between',
      alignItems:'center',flexWrap:'wrap',fontSize:12,background:'#edf7fb',
      color:'#185777'}}>
      <strong>● 실제 Android 11 화면 연결됨 · 직접 터치/키보드 조작</strong>
      <span style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <a href="/sdk-lab/android-view" target="_blank" rel="noopener noreferrer"
          style={{fontWeight:750}}>Android 전체 화면 ↗</a>
        <a href="/sdk-lab" target="_blank" rel="noopener noreferrer">
          SDK 관리 화면 ↗
        </a>
      </span>
    </div>
    <iframe key={viewerUrl} src={viewerUrl}
      title="실제 Android 11 scrcpy noVNC 원본 화면"
      allow="clipboard-read; clipboard-write"
      style={{width:'100%',flex:1,minHeight:530,border:0}}/>
  </div>;
}

/** Persistent same-origin page. Never navigate the top-level browser to a
 * short-lived trycloudflare URL; unmount the iframe when the host disappears. */
export function OriginalAndroidFullScreen(){
  const [notice,setNotice]=useState('');
  return <main style={{minHeight:'100vh',background:'#f4f7f9',color:'#193f51',padding:'12px clamp(8px, 2vw, 24px)'}}>
    <header style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:12}}>
      <div><strong>HITEL · 실제 Android 11</strong><div style={{fontSize:12,color:'#687d89'}}>scrcpy/noVNC · 실행 중인 기기만 표시 · 테스트 종료 시 자동 복귀</div></div>
      <a href="/sdk-lab" style={{fontSize:13,fontWeight:700,color:'#126987'}}>SDK 에뮬레이터 관리 ↗</a>
    </header>
    <div style={{background:'#fff',border:'1px solid #dce4e9',borderRadius:12,overflow:'hidden',minHeight:'76vh'}}>
      <OriginalAndroidEmbed/>
    </div>
    <section style={{maxWidth:650,margin:'14px auto',padding:12,background:'#fff',borderRadius:12}}>
      <AndroidSessionControls onNotice={setNotice}/>
      {notice&&<p role="status" style={{fontSize:13}}>{notice}</p>}
      <p style={{fontSize:12,color:'#687d89'}}>기기가 종료되거나 연결이 끊겨도 HITEL 화면은 유지됩니다. 실행 버튼으로 다시 시작할 수 있습니다.</p>
    </section>
  </main>;
}
