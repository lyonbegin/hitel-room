import {useEffect,useState} from 'react';
import './AndroidSessionControls.css';

type RunStatus='idle'|'queued'|'starting'|'running'|'stopping'|'completed'|'expired'|'busy';
type StatusReply={ok:boolean;status?:RunStatus;online?:boolean;error?:string};
type NativeReply={ok:boolean;online?:boolean;url?:string;transport?:string};

export function AndroidSessionControls({onNotice}:{
  onNotice:(message:string)=>void
}){
  const [status,setStatus]=useState<RunStatus>('idle');
  const [online,setOnline]=useState(false);
  const [nativeOnline,setNativeOnline]=useState(false);
  const [busy,setBusy]=useState(false);
  const refresh=async()=>{
    try{
      const response=await fetch('/lab-api/apk/ui/status',{
        credentials:'same-origin',cache:'no-store'
      });
      if(!response.ok)return;
      const info=await response.json() as StatusReply;
      setStatus(info.status||'idle');
      setOnline(Boolean(info.online));
      const real=await fetch('/lab-api/android-native/status',{
        credentials:'same-origin',cache:'no-store'
      });
      if(real.ok){
        const native=await real.json() as NativeReply;
        setNativeOnline(Boolean(native.online&&native.transport==='original-scrcpy-novnc'));
      }
    }catch{/* server booting */}
  };
  useEffect(()=>{
    void refresh();
    const interval=window.setInterval(()=>void refresh(),3000);
    return ()=>window.clearInterval(interval);
  },[]);
  const start=async()=>{
    setBusy(true);
    try{
      const response=await fetch('/lab-api/apk/ui/start',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'content-type':'application/json'},body:'{}'
      });
      const info=await response.json() as StatusReply;
      if(!response.ok)throw Error(info.error||'Android 시작 오류');
      setStatus('queued');
      onNotice('Android 실행 요청 등록 · 실행 서버가 요청을 가져오면 실제 화면이 열립니다.');
    }catch(e){onNotice('Android 시작 실패: '+String(e))}
    finally{setBusy(false);void refresh()}
  };
  const stop=async()=>{
    setBusy(true);
    try{
      const response=await fetch('/lab-api/apk/ui/stop',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'content-type':'application/json'},body:'{}'
      });
      const info=await response.json() as StatusReply;
      if(!response.ok)throw Error(info.error||'Android 종료 오류');
      setStatus(info.status||'stopping');
      onNotice('Android 종료 요청 완료 · 테스트가 끝나면 가상 기기는 초기화됩니다.');
    }catch(e){onNotice('Android 종료 실패: '+String(e))}
    finally{setBusy(false);void refresh()}
  };
  const active=['queued','starting','running','stopping'].includes(status)||nativeOnline;
  const readable:Record<RunStatus,string>={
    idle:nativeOnline?'원본 Android · scrcpy/noVNC 실행 중':'실행 대기',
    queued:nativeOnline?'원본 Android · scrcpy/noVNC 실시간 연결됨':'원본 Android 실행 요청 등록됨',
    starting:nativeOnline?'원본 Android · scrcpy/noVNC 실시간 연결됨':'원본 Android·scrcpy 부팅 중',
    running:nativeOnline?'원본 Android · scrcpy/noVNC 실시간 연결됨':'원본 Android 부팅·화면 연결 중',
    stopping:'Android 종료 중',
    completed:'테스트 종료 · 가상 기기 초기화됨',
    expired:'실행 만료 · 다시 시작할 수 있습니다',
    busy:nativeOnline?'원본 Android 이미 실행 중 · 새 세션 필요 없음':'다른 테스트가 진행 중'
  };
  return <div className="dl-android-session" aria-label="일회용 Android 실행 제어">
    <div className="dl-android-session-actions">
      {nativeOnline?
        <a className="dl-android-start" href="/lab-api/android-native/view"
           target="_blank" rel="noopener noreferrer"
           style={{textDecoration:'none',display:'inline-flex',alignItems:'center'}}>
          ▶ 현재 Android 화면 열기 ↗
        </a>:
        <button type="button" className="dl-android-start"
          disabled={busy||active||status==='busy'}
          onClick={()=>void start()}>Android 실행</button>}
      <button type="button" className="dl-android-stop" disabled={busy||!active}
        onClick={()=>void stop()}>Android 종료</button>
    </div>
    <p role="status" aria-live="polite" className={'dl-android-session-status '+(online?'connected':'')}>
      {readable[status]}
    </p>
    <p className="dl-android-session-hint">
      {nativeOnline?<a href="/lab-api/android-native/view" target="_blank" rel="noopener noreferrer">
        기존 세션 그대로 사용 · 실제 Android 홈/앱 설치 화면 ↗</a>:
        '원본 서버가 기동되면 실제 scrcpy/noVNC 화면이 열립니다.'}
    </p>
  </div>;
}
