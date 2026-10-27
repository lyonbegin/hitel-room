import {useCallback,useEffect,useState} from 'react';
import './AndroidSessionControls.css';

type SandboxState={
  ok:boolean; available?:boolean;reason?:string|null;
  status?:string;expiresAt?:string|null;remainingSeconds?:number;
  viewerUrl?:string|null;checkpoint?:string;sandboxId?:string|null;
  error?:string;lastError?:string|null;
};
const messages:Record<string,string>={
  RAILWAY_API_TOKEN_NOT_CONFIGURED:'Android 실행 환경이 아직 준비되지 않았습니다.',
  ANDROID_CHECKPOINT_NOT_PREPARED:'Android 11 체크포인트가 아직 만들어지지 않았습니다.',
  SANDBOX_LAUNCH_NOT_ENABLED:'Android 실행 환경이 아직 준비되지 않았습니다.',
  RAILWAY_API_UNAVAILABLE:'Railway Sandbox 상태 조회에 실패했습니다.',
  KVM_OR_ANDROID_CHECKPOINT_UNAVAILABLE:'Sandbox에서 KVM 가속 또는 Android 실행 파일을 사용할 수 없습니다.',
  ANDROID_SESSION_ALREADY_ACTIVE:'이미 Android 실행 세션이 있습니다.',
  RAILWAY_SANDBOX_ALREADY_RUNNING:'다른 Railway Sandbox가 실행 중이므로 중복 생성하지 않습니다.'
};
export function AndroidSessionControls({onNotice}:{onNotice:(message:string)=>void}){
  const [data,setData]=useState<SandboxState|null>(null);
  const [busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{
    try{
      const response=await fetch('/lab-sandbox/status',{cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      setData(await response.json() as SandboxState);
    }catch{setData({ok:false,available:false,reason:'RAILWAY_API_UNAVAILABLE'});}
  },[]);
  useEffect(()=>{
    void refresh();
    const t=window.setInterval(()=>void refresh(),3000);
    return ()=>window.clearInterval(t);
  },[refresh]);
  const call=async(action:'start'|'stop')=>{
    setBusy(true);
    try{
      const response=await fetch('/lab-sandbox/'+action,{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'content-type':'application/json'},body:'{}'
      });
      const info=await response.json() as SandboxState;
      if(!response.ok)throw Error(messages[info.error||'']||info.error||'HTTP '+response.status);
      setData(prev=>({...prev,...info}));
      onNotice(action==='start'
        ?'실제 Railway Sandbox 실행 요청 완료. Android 화면 연결을 확인하고 있습니다.'
        :'Railway Sandbox VM 삭제 요청 처리됨. 다음 실행은 원본 체크포인트에서 시작합니다.');
    }catch(e){onNotice((action==='start'?'실행':'삭제')+' 실패: '+String(e));}
    finally{setBusy(false);void refresh();}
  };
  const probeKvm=async()=>{
    setBusy(true);
    try{
      const response=await fetch('/lab-sandbox/probe-kvm',{
        method:'POST',headers:{'content-type':'application/json'},body:'{}',credentials:'same-origin'
      });
      const result=await response.json() as {ok?:boolean;kvm?:boolean;result?:string;error?:string};
      if(!response.ok)throw Error(result.error||'KVM 검사 실패');
      onNotice(result.kvm?'Railway Sandbox KVM 지원 확인 · Android 체크포인트 준비 가능':
        'Railway Sandbox KVM 미지원 · Google Android 에뮬레이터 실행 불가');
    }catch(e){onNotice('KVM 검사 오류: '+String(e));}
    finally{setBusy(false);void refresh();}
  };
  const status=data?.status||'idle';
  const active=['starting','connecting','running','stopping'].includes(status);
  const available=Boolean(data?.available);
  const seconds=Math.max(0,data?.remainingSeconds||0);
  const reason=messages[data?.reason||'']||data?.reason;
  return <div className="dl-android-session" aria-label="Railway Sandbox 실제 Android 실행 및 종료">
    <div className="dl-android-session-actions">
      <button type="button" className="dl-android-start"
        disabled={busy||active||!available} onClick={()=>void call('start')}>
        {busy?'처리 중':'▶ Android 실행 (스냅샷)'}
      </button>
      <button type="button" className="dl-android-stop"
        disabled={busy||!active} onClick={()=>void call('stop')}>VM 삭제</button>
      {data?.reason==='ANDROID_CHECKPOINT_NOT_PREPARED'?
        <button type="button" className="dl-android-stop" disabled={busy}
          onClick={()=>void probeKvm()}>Railway KVM 실제 검사</button>:null}
      {status==='running'&&data?.viewerUrl?
        <a className="dl-android-start" href={data.viewerUrl} target="_blank" rel="noopener noreferrer"
          style={{textDecoration:'none'}}>실제 Android 화면 ↗</a>:null}
    </div>
    <p className="dl-android-session-status" role="status" aria-live="polite">
      {active?'Railway Sandbox: '+status+' · 강제 종료까지 '+Math.floor(seconds/60)+'분 '+seconds%60+'초'
        :status==='deleted'?'테스트 종료 · VM 삭제 완료':reason||'실제 Android 실행 대기'}
    </p>
    <p className="dl-android-session-hint">
      실행 후 최대 600초 · 창을 닫아도 VM 내부 종료 타이머 작동 · Cloudflare 미사용
      {data?.lastError?<span> · 서버 오류: {data.lastError}</span>:null}
    </p>
  </div>;
}
