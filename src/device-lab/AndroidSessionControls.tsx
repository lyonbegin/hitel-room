import {useCallback,useEffect,useState} from 'react';
import './AndroidSessionControls.css';
type Status={ok?:boolean;available?:boolean;reason?:string|null;status?:string;remainingSeconds?:number;viewerUrl?:string|null;checkpoint?:string;lastError?:string|null;lastDestroyedAt?:string|null};
const errors:Record<string,string>={
 RAILWAY_API_TOKEN_NOT_CONFIGURED:'Railway 서버의 Sandbox API 권한이 설정되지 않았습니다.',
 ANDROID_CHECKPOINT_NOT_PREPARED:'Railway Sandbox 실제 검사: Android 11 설치 성공, KVM 없는 부팅은 190초 안에 완료되지 않았습니다. 실행 가능한 체크포인트가 없어 버튼을 비활성화했습니다.',
 RAILWAY_API_UNAVAILABLE:'Railway Sandbox API에 연결하지 못했습니다.',
 KVM_OR_ANDROID_CHECKPOINT_UNAVAILABLE:'Railway Sandbox에서 Android 11을 부팅하지 못했습니다.',
 RAILWAY_SANDBOX_ALREADY_RUNNING:'다른 Railway Sandbox가 실행 중이므로 추가 생성하지 않습니다.'
};
export function AndroidSessionControls({onNotice}:{onNotice:(message:string)=>void}){
 const [state,setState]=useState<Status|null>(null);
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{
  try{
   const r=await fetch('/lab-sandbox/status',{cache:'no-store',credentials:'same-origin'});
   if(!r.ok)throw Error(String(r.status));
   setState(await r.json() as Status);
  }catch{setState({available:false,reason:'RAILWAY_API_UNAVAILABLE'})}
 },[]);
 useEffect(()=>{void refresh();const t=window.setInterval(()=>void refresh(),3000);return ()=>window.clearInterval(t)},[refresh]);
 async function command(action:'start'|'stop'){
  setBusy(true);
  try{
   const r=await fetch('/lab-sandbox/'+action,{method:'POST',credentials:'same-origin',
    headers:{'content-type':'application/json'},body:'{}'});
   const data=await r.json() as Status&{error?:string};
   if(!r.ok)throw Error(errors[data.error||'']||data.error||'HTTP '+r.status);
   setState(data);
   onNotice(action==='start'?'Railway Sandbox에 실제 Android 11 VM 생성 요청을 전달했습니다.':'Railway Sandbox 삭제 요청이 완료되었습니다.');
  }catch(e){onNotice('Railway Sandbox '+(action==='start'?'실행':'종료')+' 실패: '+String(e));}
  finally{setBusy(false);void refresh();}
 }
 const status=state?.status||'idle';
 const active=['starting','connecting','running','stopping'].includes(status);
 const rem=Math.max(0,state?.remainingSeconds||0);
 return <div className="dl-android-session" aria-label="Railway Sandbox Android 11 실제 기기 관리">
  <div className="dl-android-session-actions">
   <button className="dl-android-start" type="button" disabled={busy||active||!state?.available}
    onClick={()=>void command('start')}>{busy?'처리 중…':'▶ Railway Android 11 실행'}</button>
   <button className="dl-android-stop" type="button" disabled={busy||!active}
    onClick={()=>void command('stop')}>Sandbox 삭제</button>
   {status==='running'&&state?.viewerUrl?<a href={state.viewerUrl} target="_blank" rel="noopener noreferrer">Android 실시간 화면 ↗</a>:null}
  </div>
  <p className="dl-android-session-status" role="status" aria-live="polite">
   {active?(status==='running'?'Railway Android 11 실행 중':status==='stopping'?'Sandbox 삭제 중':'Railway Sandbox 부팅 확인 중')+
   ' · 남은 시간 '+Math.floor(rem/60)+'분 '+rem%60+'초'
   :errors[state?.reason||'']||'Railway Sandbox 실행 대기'}
  </p>
  {state?.lastError?<p role="alert" className="dl-android-session-status">{state.lastError}</p>:null}
  <p className="dl-android-session-hint">Railway Sandbox 전용 · 실행 후 최대 10분 · 종료 시 실제 Sandbox 삭제 · GitHub Actions 실행 없음</p>
 </div>;
}
