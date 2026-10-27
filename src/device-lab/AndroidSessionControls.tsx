import {useCallback,useEffect,useState} from 'react';
import './AndroidSessionControls.css';
type KvmState={ok:boolean;available?:boolean;reason?:string|null;status?:string;
 sessionId?:string|null;remainingSeconds?:number;viewerUrl?:string|null;error?:string;
 lastDestroyedAt?:string|null;lastReason?:string|null};
const messages:Record<string,string>={
 KVM_DISPATCH_NOT_CONFIGURED:'일회용 Android 실행 호스트 호출을 위한 서버 연결이 아직 준비되지 않았습니다.',
 SESSION_ALREADY_ACTIVE:'이미 다른 Android 테스트가 실행 중입니다.',
 SESSION_NOT_OWNED:'현재 브라우저에서 시작한 세션이 아닙니다.',
 KVM_STATUS_UNAVAILABLE:'실행 호스트 상태를 확인할 수 없습니다.'
};
export function AndroidSessionControls({onNotice}:{onNotice:(message:string)=>void}) {
 const [state,setState]=useState<KvmState|null>(null);
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{
   try{
     const r=await fetch('/lab-kvm/status',{cache:'no-store',credentials:'same-origin'});
     if(!r.ok)throw new Error('HTTP '+r.status);
     setState(await r.json() as KvmState);
   }catch{setState({ok:false,available:false,reason:'KVM_STATUS_UNAVAILABLE'});}
 },[]);
 useEffect(()=>{void refresh();const id=window.setInterval(()=>void refresh(),3000);
   return ()=>window.clearInterval(id);},[refresh]);
 async function command(action:'start'|'stop') {
   setBusy(true);
   try{
     const r=await fetch('/lab-kvm/'+action,{method:'POST',credentials:'same-origin',cache:'no-store',
       headers:{'content-type':'application/json'},body:'{}'});
     const result=await r.json() as KvmState;
     if(!r.ok)throw Error(messages[result.error||'']||result.error||'HTTP '+r.status);
     setState(result);
     onNotice(action==='start'?'Android 11 일회용 KVM 호스트 실행 요청이 접수되었습니다. 실제 화면 연결을 확인하고 있습니다.':'Android 기기 종료를 요청했습니다.');
   }catch(err){onNotice((action==='start'?'실행':'종료')+' 오류: '+String(err));}
   finally{setBusy(false);void refresh();}
 }
 const status=state?.status||'idle';
 const active=['starting','running','stopping'].includes(status);
 const seconds=Math.max(0,state?.remainingSeconds||0);
 return <div className="dl-android-session" aria-label="Android 11 일회용 원본 기기 관리">
   <div className="dl-android-session-actions">
     <button type="button" className="dl-android-start" disabled={busy||active||!state?.available||status==='occupied'}
       onClick={()=>void command('start')}>{busy?'처리 중…':'▶ Android 11 실행'}</button>
     <button type="button" className="dl-android-stop" disabled={busy||!active}
       onClick={()=>void command('stop')}>기기 종료</button>
     {status==='running'&&state?.viewerUrl?<a href={state.viewerUrl} target="_blank" rel="noopener noreferrer">실제 Android 화면 ↗</a>:null}
   </div>
   <p className="dl-android-session-status" role="status" aria-live="polite">
     {active?(status==='running'?'실제 Android 11 연결됨':status==='stopping'?'실행 종료 중':'실제 Android 기기 부팅 중')+
       ' · 남은 시간 '+Math.floor(seconds/60)+'분 '+seconds%60+'초'
       :status==='occupied'?'다른 브라우저에서 테스트가 진행 중입니다.'
       :status==='deleted'?'마지막 테스트 종료 완료'
       :messages[state?.reason||'']||'실행 대기'}
   </p>
   <p className="dl-android-session-hint">
     KVM 가속 원본 Android 11 · 실제 scrcpy/noVNC · 1회 최대 10분 · 일회용 실행 호스트 자동 종료
     {state?.lastReason?<span> · 마지막 종료 사유: {state.lastReason}</span>:null}
   </p>
 </div>;
}
