import {useEffect,useState} from 'react';
type ProgressStage='idle'|'queued'|'claimed'|'kvm'|'sdk'|'emulator'|'booted'|'scrcpy'|'tunnel'|'ready'|'testing'|'stopping'|'stopped'|'failed';
type ProgressEvent={stage:ProgressStage;time:string;message:string};
type NativeProgress={stage:ProgressStage;message:string;updatedAt:string|null;startedAt:string|null;elapsedSeconds:number;runId:string|null;runUrl:string|null;error:string|null;history:ProgressEvent[];pollingSeconds?:number;receivedFromRunner?:boolean};
type NativeStatus={ok?:boolean;online?:boolean;url?:string;launchAvailable?:boolean;dispatchConfigured?:boolean;desiredRunning?:boolean;statePersisted?:boolean;launchState?:string;reason?:string;progress?:NativeProgress};
const BOOT_STEPS:{stage:ProgressStage;label:string;detail:string}[]=[
 {stage:'queued',label:'실행 요청 접수',detail:'웹 버튼이 GitHub KVM workflow_dispatch를 즉시 호출'},
 {stage:'claimed',label:'GitHub 실행기 배정',detail:'실행기에서 작업 수락 확인'},
 {stage:'kvm',label:'KVM 가속 확인',detail:'실제 /dev/kvm 가속 장치 점검'},
 {stage:'sdk',label:'영상 서버 준비',detail:'ws-scrcpy 빌드 및 실행 파일 점검'},
 {stage:'emulator',label:'Android 11 부팅 시작',detail:'실제 Android Emulator 실행'},
 {stage:'booted',label:'Android 부팅 완료',detail:'ADB 및 Android 11 운영체제 확인'},
 {stage:'scrcpy',label:'영상 스트림 서버 시작',detail:'ws-scrcpy에서 원본 화면 연결'},
 {stage:'tunnel',label:'웹 연결 경로 준비',detail:'HTTPS 영상 접속 경로 확인'},
 {stage:'ready',label:'실제 기기 화면 연결 가능',detail:'웹에서 화면·터치·키보드 사용 가능'}
];
const BOOT_ORDER=BOOT_STEPS.map(x=>x.stage);
const ACTIVE_STAGES=new Set<ProgressStage>(['queued','claimed','kvm','sdk','emulator','booted','scrcpy','tunnel','testing','stopping']);
function duration(s:number){const n=Math.max(0,Math.floor(s));return Math.floor(n/60)+'분 '+String(n%60).padStart(2,'0')+'초';}
type Viewer={url:string;player:'webcodecs'|'mse';host:string};
const STATUS='/lab-sandbox/ws-scrcpy/status';
const VERIFY_TIMEOUT=5500;
function allowedHost(url:string):boolean{
 try{
  const u=new URL(url);
  return u.origin===window.location.origin && u.protocol==='https:'
   && u.pathname==='/lab-sandbox/ws-scrcpy/proxy/' && !u.search && !u.hash;
 }catch{return false}
}
async function verifyHost(base:string):Promise<boolean>{
 const controller=new AbortController();
 const timer=window.setTimeout(()=>controller.abort(),VERIFY_TIMEOUT);
 try{
  const r=await fetch('/lab-sandbox/ws-scrcpy/health',{cache:'no-store',
   credentials:'same-origin',signal:controller.signal});
  if(!r.ok)return false;
  const value=await r.json() as {online?:boolean;engine?:string;androidVersion?:string;vnc?:boolean};
  return value.online===true&&value.engine==='ws-scrcpy'&&value.androidVersion==='11'&&value.vnc===false;
 }catch{return false}finally{window.clearTimeout(timer)}
}
export function WsScrcpyEmbed(){
 const [viewer,setViewer]=useState<Viewer|null>(null);
 const [state,setState]=useState('실제 Android 11 ws-scrcpy 실행 대기');
 const [launchAvailable,setLaunchAvailable]=useState(false);
 const [starting,setStarting]=useState(false);
 const [stopping,setStopping]=useState(false);
 const [apkStatus,setApkStatus]=useState('');
 const [apkInstalling,setApkInstalling]=useState(false);
 const [nativeStatus,setNativeStatus]=useState<NativeStatus|null>(null);
 const [checkedAt,setCheckedAt]=useState<number|null>(null);
 const [now,setNow]=useState(Date.now());
 const stop=async()=>{
  if(stopping)return;
  setStopping(true);
  try{
   const response=await fetch('/lab-sandbox/ws-scrcpy/stop',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'
   });
   const result=await response.json() as {ok?:boolean;error?:string;alreadyStopped?:boolean;cancelled?:boolean};
   if(!response.ok||!result.ok)throw Error(result.error||'실제 실행 종료 요청 실패');
   setState(result.alreadyStopped?'Android가 이미 종료됨':'Android 실제 종료 요청 접수 · GitHub KVM 정리 대기');
   if(result.alreadyStopped||result.cancelled)setViewer(null);
  }catch(err){setState('Android 종료 요청 실패: '+String(err))}
  finally{setStopping(false)}
 };
 const start=async()=>{
  if(starting||!launchAvailable)return;
  setStarting(true);
  try{
   const response=await fetch('/lab-sandbox/ws-scrcpy/start',{
    method:'POST',headers:{'content-type':'application/json'},
    credentials:'same-origin',body:'{}'
   });
   const data=await response.json() as {ok?:boolean;error?:string};
   if(!response.ok||!data.ok)throw Error(data.error||'실제 KVM 시작 실패');
   setNativeStatus(old=>({...old,online:false,launchState:'queued',progress:{stage:'queued',message:'웹 버튼에서 즉시 실행 요청을 접수했습니다. GitHub 실행기 배정을 기다리고 있습니다.',updatedAt:new Date().toISOString(),startedAt:new Date().toISOString(),elapsedSeconds:0,runId:null,runUrl:null,error:null,history:[{stage:'queued',time:new Date().toISOString(),message:'즉시 실행 요청 접수'}]}}));
   setState('GitHub 실행기 배정 대기 중');
  }catch(e){setState('실제 Android 실행 요청 실패: '+String(e));}
  finally{setStarting(false)}
 };
 const [player,setPlayer]=useState<'webcodecs'|'mse'>('mse');
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[]);
 const installApk=async(event:React.ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file||!viewer)return;
  if(!file.name.toLowerCase().endsWith('.apk')||file.size>60*1024*1024){setApkStatus('APK 파일만 설치할 수 있습니다(최대 60MB).');return;}
  setApkInstalling(true);setApkStatus('실제 Android 11에 APK 설치 및 실행 중…');
  try{
   const response=await fetch('/lab-sandbox/ws-scrcpy/proxy/__hitel_apk_install',{method:'POST',
    headers:{'Content-Type':'application/vnd.android.package-archive'},body:file});
   const result=await response.json() as {ok?:boolean;installed?:boolean;launched?:boolean;packageName?:string;error?:string};
   if(!response.ok||!result.ok||!result.installed||!result.launched)throw Error(result.error||'설치 또는 실행 확인 실패');
   setApkStatus('실제 Android 앱 설치·실행 확인: '+result.packageName);
  }catch(err){setApkStatus('APK 설치 실패: '+String(err))}finally{setApkInstalling(false)}
 };

 useEffect(()=>{
  let mounted=true,checking=false;
  const tick=async()=>{
   if(checking)return;checking=true;
   try{
    const r=await fetch(STATUS,{cache:'no-store',credentials:'same-origin'});
    if(!r.ok)throw Error('native host status HTTP '+r.status);
    const info=await r.json() as NativeStatus;
    if(mounted){setLaunchAvailable(Boolean(info.launchAvailable));setNativeStatus(info);setCheckedAt(Date.now());}
    const base=String(info.url||'');
    if(!info.online||!allowedHost(base)||!(await verifyHost(base))){
     if(mounted){setViewer(null);setState(info.progress?.message || (info.launchState==='queued'?'GitHub 실행기 배정 대기 중':info.launchState==='booting'?'Android 11 준비 진행 중':'실제 Android 11 실행 대기'));}
     return;
    }
    // The Railway same-origin reverse tunnel carries the original H.264 stream.
    const ws=window.location.origin.replace(/^http/,'ws')+'/lab-sandbox/ws-scrcpy/device?action=proxy-adb&udid=emulator-5554&remote=tcp%3A8886';
    const hash=new URLSearchParams({action:'stream',udid:'emulator-5554',
      player,ws,fitToScreen:'1',captureKeyboard:'1'});
    if(mounted){setViewer({url:base+'#!'+hash.toString(),player,host:new URL(base).host});setState('실제 Android 11 영상 연결됨');}
   }catch(err){
    if(mounted){setState('실시간 진행상태 조회 오류: '+String(err));setCheckedAt(null);}
   }finally{checking=false;}
  };
  void tick();const interval=window.setInterval(()=>void tick(),3500);
  return()=>{mounted=false;window.clearInterval(interval);}
 },[player]);
 const progress=nativeStatus?.progress;
 const stage=progress?.stage||'idle';
 const active=ACTIVE_STAGES.has(stage);
 const requested=Boolean(nativeStatus?.desiredRunning);
 const currentIndex=BOOT_ORDER.indexOf(stage);
 const elapsed=progress?.startedAt?Math.floor((now-new Date(progress.startedAt).getTime())/1000):0;
 const lastUpdate=progress?.updatedAt?Math.floor((now-new Date(progress.updatedAt).getTime())/1000):0;
 const age=checkedAt!==null?Math.floor((now-checkedAt)/1000):null;
 const progressView=<section aria-label="Android 11 실시간 실행 진행현황" style={{width:'100%',maxWidth:660,margin:'0 auto',border:'1px solid #d6e3e9',borderRadius:12,background:'#fff',padding:'16px 18px',boxSizing:'border-box',color:'#19394a',textAlign:'left'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
   <strong style={{fontSize:17}}>Android 11 실행 진행현황</strong>
   <span style={{fontSize:12,color:age===null||age>12?'#a15327':'#127359'}} aria-label="실시간 상태 조회">{age===null?'● 연결 확인 중':age>12?'● 상태 갱신 지연':'● '+(progress?.receivedFromRunner?'GitHub 실행 기록 수신 중':'Railway 대기 상태 조회 중')+' · 3.5초마다 조회'}</span>
  </div>
  <p style={{fontSize:13,lineHeight:1.55,margin:'9px 0 8px'}}>{progress?.message||state}</p>
  <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:12,color:'#55707d'}}>
    <span>요청 후 경과: <strong>{duration(elapsed)}</strong></span>
    {progress?.updatedAt&&<span>마지막 실행 단계 갱신: {duration(lastUpdate)} 전</span>}
    {requested&&<span><strong>종료 버튼을 누를 때까지 실행 유지 · 오류 시 자동 재시작</strong></span>}
  </div>
  {stage==='queued'&&<p style={{color:'#8a5d1e',background:'#fff8ec',borderRadius:6,padding:'8px 10px',fontSize:12}}>웹 버튼에서 즉시 실행 요청을 전송했습니다. GitHub가 실제 실행기를 배정하기 전까지 Android 부팅은 시작되지 않습니다.</p>}
  {stage==='failed'&&<p role="alert" style={{color:'#a12e33',background:'#fff1f1',padding:'10px',borderRadius:7,fontSize:13}}>{requested?'실행기에 문제가 생겨 자동 복구를 시도하고 있습니다. '+(progress?.error||''):progress?.error||'실행에 실패했습니다. 다시 실행할 수 있습니다.'}</p>}
  {stage==='stopped'&&<p style={{fontSize:13,color:'#5e7082'}}>실행이 종료되었거나 사용자가 실행 대기를 취소했습니다.</p>}
  <ol style={{listStyle:'none',padding:0,margin:'14px 0 0',display:'grid',gap:5}}>
   {BOOT_STEPS.map((step,i)=>{
     const done=stage==='ready'||stage==='testing'?true:currentIndex>i;
     const here=currentIndex===i;
     const event=progress?.history?.find(e=>e.stage===step.stage);
     return <li key={step.stage} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'7px 8px',borderRadius:6,background:here?'#e9f5fa':'transparent',opacity:!done&&!here?0.65:1}}>
      <span aria-hidden="true" style={{fontSize:15,minWidth:20,color:done?'#087651':here?'#12607c':'#9baeb8'}}>{done?'✓':here?'◉':'○'}</span>
      <span style={{flex:1}}><strong style={{fontSize:13}}>{step.label}</strong><span style={{display:'block',fontSize:11,color:'#5c7885',marginTop:2}}>{step.detail}</span></span>
      {event&&<time style={{fontSize:11,color:'#667b85'}}>{new Date(event.time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time>}
     </li>;
   })}
  </ol>
  {progress?.runUrl&&<p style={{fontSize:12,margin:'12px 0 0'}}>GitHub 실행 번호: <a href={progress.runUrl} target="_blank" rel="noopener noreferrer" style={{color:'#136487'}}>#{progress.runId} 실행 로그 확인</a></p>}
  {progress?.updatedAt&&lastUpdate>90&&active&&<p style={{fontSize:12,color:'#9b641b'}}>마지막 실행 단계 갱신 후 90초 이상 경과했습니다. 해당 단계가 오래 걸리거나 실행기에 문제가 있을 수 있습니다. 오류 또는 시간 초과가 확인되면 자동으로 표시됩니다.</p>}
 </section>;
 if(!viewer)return <div style={{minHeight:590,display:'flex',alignItems:'center',justifyContent:'flex-start',padding:'26px 14px',flexDirection:'column',gap:14,background:'#f7fafb'}}>
  {progressView}
  <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
   <button type="button" onClick={()=>void start()} disabled={!launchAvailable||starting||requested||active}
     style={{padding:'11px 18px',border:'1px solid #8daeb7',borderRadius:8,background:launchAvailable&&!requested&&!active?'#115e72':'#d9e2e5',color:launchAvailable&&!requested&&!active?'#fff':'#435d65',cursor:!launchAvailable||starting||requested||active?'not-allowed':'pointer'}}>
     {starting?'Android 시작 요청 중…':requested?'Android 세션 유지 중':'▶ Android 11 실제 실행'}
   </button>
   {requested&&<button type="button" onClick={()=>void stop()} disabled={stopping} style={{padding:'11px 18px',border:'1px solid #b5c0c6',borderRadius:8,background:'#fff',color:'#425966'}}>{stopping?'Android 종료 요청 중…':'Android 종료'}</button>}
  </div>
  {!launchAvailable&&<small style={{color:'#6a7f88'}}>{nativeStatus?.dispatchConfigured===false
    ?'Railway 서비스에 HITEL_GITHUB_WORKFLOW_TOKEN을 등록해야 웹 버튼 즉시 실행을 사용할 수 있습니다.'
    :nativeStatus?.statePersisted===false
      ?'Railway 세션 영구 저장소를 쓸 수 없어 실행을 시작하지 않았습니다.'
    :'실행 API 확인 후 시작 버튼이 활성화됩니다.'}</small>}
  <small style={{textAlign:'center',color:'#677e8a'}}>저장된 화면을 표시하지 않습니다. 실제 Android 11이 준비되면 여기서 자동으로 전환됩니다.</small>
 </div>;
 return <div style={{display:'flex',height:'100%',minHeight:570,flexDirection:'column'}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
   padding:'8px 12px',fontSize:12,color:'#174f61',background:'#edf9fa'}}>
   <span style={{display:'flex',gap:8,alignItems:'center'}}>
    <strong>● Android 11 · ws-scrcpy H.264</strong>
    <label style={{display:'flex',gap:4,alignItems:'center'}}>디코더
      <select aria-label="Android 영상 디코더 선택" value={player}
        onChange={e=>setPlayer(e.target.value as 'webcodecs'|'mse')}
        style={{padding:'3px 5px',borderRadius:5}}>
        <option value="webcodecs">WebCodecs</option>
        <option value="mse">MSE (호환 모드)</option>
      </select>
    </label>
   </span>
   <span style={{display:'flex',alignItems:'center',gap:10}}>
    <label style={{cursor:apkInstalling?'wait':'pointer',background:'#fff',padding:'5px 8px',border:'1px solid #97aeb8',borderRadius:6}}>
      {apkInstalling?'APK 설치 중…':'APK 설치·실행'}
      <input aria-label="Android APK 파일 설치" type="file" accept=".apk,application/vnd.android.package-archive" disabled={apkInstalling} onChange={e=>void installApk(e)} style={{display:'none'}}/>
    </label>
    <a href={viewer.url} target="_blank" rel="noopener noreferrer">실제 화면 새 창 ↗</a>
    <button type="button" onClick={()=>void stop()} disabled={stopping}
      style={{padding:'4px 9px',border:'1px solid #97aeb8',borderRadius:6,background:'white'}}>
      {stopping?'Android 종료 요청 중…':'Android 종료'}
    </button>
   </span>
  </div>
  <details style={{padding:'6px 12px',borderBottom:'1px solid #d9e6ec'}}><summary style={{cursor:'pointer',fontSize:12}}>실행 단계 및 GitHub 진행 로그</summary>{progressView}</details>
  {apkStatus&&<div role="status" style={{padding:'5px 12px',fontSize:12,color:'#174f61'}}>{apkStatus}</div>}
  <iframe key={viewer.url} title="GitHub KVM 원본 Android 11 ws-scrcpy H264 터치 화면"
   src={viewer.url} allow="clipboard-read; clipboard-write" referrerPolicy="no-referrer"
   style={{width:'100%',flex:1,minHeight:530,border:0}}/>
 </div>;
}
