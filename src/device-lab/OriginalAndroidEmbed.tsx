import {useEffect,useState} from 'react';

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
        <a href={viewerUrl} target="_blank" rel="noopener noreferrer"
          style={{fontWeight:750}}>Android 전체 화면 ↗</a>
        <a href={base+'/'} target="_blank" rel="noopener noreferrer"
          title="원본 관리자에서는 단일 기기가 이미 사용 중으로 표시될 수 있습니다">
          원본 관리 콘솔 ↗
        </a>
      </span>
    </div>
    <iframe key={viewerUrl} src={viewerUrl}
      title="실제 Android 11 scrcpy noVNC 원본 화면"
      allow="clipboard-read; clipboard-write"
      style={{width:'100%',flex:1,minHeight:530,border:0}}/>
  </div>;
}
