import {useCallback, useEffect, useState} from 'react';
import {AndroidSessionControls} from './AndroidSessionControls';

type NativeStatus={
  ok?:boolean; online?:boolean; url?:string;
  transport?:string; error?:string;
};

/**
 * The actual upstream Android Emulator Platform dashboard is served by the
 * temporary KVM host. The HITEL URL remains usable when the host has stopped.
 * Never substitute the noVNC phone-only page for the vendor's management UI.
 */
export function OriginalAndroidManager(){
  const [native,setNative]=useState<NativeStatus|null>(null);
  const [notice,setNotice]=useState('');
  const [checking,setChecking]=useState(true);
  const refresh=useCallback(async()=>{
    try{
      const response=await fetch('/lab-api/android-native/status',{cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const info=await response.json() as NativeStatus;
      setNative(info);
    }catch{
      setNative({ok:false,online:false,error:'relay_unavailable'});
    }finally{setChecking(false)}
  },[]);
  useEffect(()=>{
    void refresh();
    const timer=window.setInterval(()=>void refresh(),4000);
    return ()=>window.clearInterval(timer);
  },[refresh]);

  const url=native?.url||'';
  const online=Boolean(native?.online&&native.transport==='original-scrcpy-novnc'&&
    /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url));

  return <div style={{minHeight:'100vh',background:'#f1f5f8',color:'#173b4a',padding:'16px clamp(8px, 2vw, 26px)',boxSizing:'border-box'}}>
    <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:14}}>
      <div>
        <strong style={{fontSize:20}}>Android Emulator Platform · 원본 관리 화면</strong>
        <p style={{fontSize:12,margin:'6px 0',color:'#68808b'}}>
          원본 Android 11 / Docker / scrcpy / noVNC
        </p>
      </div>
      <a href="/sdk-lab" style={{fontSize:13,color:'#136487',fontWeight:700}}>HITEL SDK Lab ↗</a>
    </header>

    {online?<section style={{background:'#fff',borderRadius:12,border:'1px solid #d7e3e9',overflow:'hidden'}}>
      <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'#e9f5f5',fontSize:13}}>
        <strong>● 원본 Android 관리 서버 연결됨</strong>
        <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
          <a href="/lab-api/android-native/open" target="_blank" rel="noopener noreferrer">원본 관리 콘솔 새 창 ↗</a>
          <a href="/sdk-lab">실제 Android 화면 / 조작 ↗</a>
        </div>
      </div>
      <iframe key={url} title="원본 Android Emulator Platform 관리 UI"
        src={url+'/'}
        style={{height:'min(82vh,1000px)',minHeight:640,width:'100%',border:0,display:'block'}}/>
    </section>:<section style={{background:'#fff',border:'1px solid #d7e3e9',borderRadius:12,maxWidth:760,margin:'30px auto',padding:'clamp(18px,4vw,32px)'}}>
      <h2 style={{fontSize:20,marginTop:0}}>
        {checking?'원본 Android 호스트 확인 중':'원본 Android 실행 대기'}
      </h2>
      <p style={{fontSize:14,lineHeight:1.7,color:'#536e7c'}}>
        {native?.error==='relay_unavailable'
          ?'기기 중계 서버에 접속할 수 없습니다.'
          :native?.error==='host_unreachable'
          ?'실제 Android 실행 호스트 또는 임시 화면 연결이 끊겼습니다.'
          :'현재 원본 Android 실행기가 종료되어 있습니다.'}
        {' '}실제 호스트가 시작되면 이 주소에서 원본 Emulator Platform 관리 화면을 표시합니다.
      </p>
      <AndroidSessionControls onNotice={setNotice}/>
      {notice&&<p role="status" style={{fontSize:13,color:'#136487'}}>{notice}</p>}
      <button type="button" onClick={()=>void refresh()} style={{
        marginTop:12,padding:'9px 16px',borderRadius:8,cursor:'pointer',
        border:'1px solid #bcced8',background:'#f7fafc',color:'#173b4a'
      }}>연결 상태 새로고침</button>
      <p style={{fontSize:12,color:'#71838c',marginTop:14}}>
        저장된 캡처나 가짜 Android 화면은 표시하지 않습니다. 실제 세션이 종료되더라도 이 HITEL 주소는 유지됩니다.
      </p>
    </section>}
  </div>;
}
