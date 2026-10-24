import {useCallback,useEffect,useState} from 'react';
import './ApkInstaller.css';
import {EmulatorRemoteScreen} from './EmulatorRemoteScreen';

type ApkFile={id:string;filename:string;size:number;sha256:string;createdAt:string};
type InstallJob={id:string;apkId:string;filename:string;deviceId:string;status:'pending'|'installing'|'installed'|'failed'|'completed';createdAt:string;finishedAt?:string;packageName?:string;error?:string;installLog?:string;launchAfterInstall?:boolean};
type Host={deviceId:string;kind:string;online:boolean;lastSeen:string};
type ApiReply={ok:boolean;error?:string;file?:ApkFile;job?:InstallJob;files?:ApkFile[];jobs?:InstallJob[];hosts?:Host[]};

const base='/lab-api/apk/';
export function ApkInstaller(){
  const [token,setToken]=useState('');
  const [selectedFile,setSelectedFile]=useState<File|null>(null);
  const [files,setFiles]=useState<ApkFile[]>([]);
  const [jobs,setJobs]=useState<InstallJob[]>([]);
  const [hosts,setHosts]=useState<Host[]>([]);
  const [device,setDevice]=useState('android-lab-01');
  const [launch,setLaunch]=useState(true);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('관리자 인증 후 APK 파일을 올릴 수 있습니다.');
  const request=useCallback(async(route:string,method='GET',body?:BodyInit,headers:Record<string,string>={})=>{
    if(!token.trim())throw Error('APK 관리 토큰을 입력하세요.');
    const response=await fetch(base+route,{method,body,
      headers:{Authorization:'Bearer '+token.trim(),...headers},cache:'no-store'});
    const result=await response.json() as ApiReply;
    if(!response.ok||!result.ok)throw Error(result.error||'HTTP '+response.status);
    return result;
  },[token]);
  const refresh=useCallback(async()=>{
    if(!token.trim())return;
    try{
      const [a,b,c]=await Promise.all([
        request('files'),request('jobs'),request('hosts')
      ]);
      setFiles(a.files||[]);setJobs(b.jobs||[]);setHosts(c.hosts||[]);
    }catch(e){setNotice('관리 API: '+String(e))}
  },[request,token]);
  useEffect(()=>{
    if(!token.trim())return;
    void refresh();
    const timer=window.setInterval(()=>void refresh(),7000);
    return ()=>window.clearInterval(timer);
  },[refresh,token]);
  async function upload(){
    if(!selectedFile)return setNotice('설치할 APK 파일을 선택하세요.');
    if(selectedFile.size>80*1024*1024)return setNotice('APK 업로드 한도는 80MB입니다.');
    setBusy(true);setNotice('실제 APK를 서버에 업로드하고 무결성 해시를 생성합니다.');
    try{
      const result=await request('upload','POST',selectedFile,{
        'Content-Type':'application/vnd.android.package-archive',
        'X-APK-Filename':encodeURIComponent(selectedFile.name)
      });
      setNotice('업로드 완료: '+result.file?.filename+' / SHA256 '+result.file?.sha256.slice(0,12)+'…');
      setSelectedFile(null);await refresh();
    }catch(e){setNotice('업로드 실패: '+String(e))}
    finally{setBusy(false)}
  }
  async function install(apk:ApkFile){
    setBusy(true);
    try{
      const data=await request('jobs','POST',JSON.stringify({
        apkId:apk.id,deviceId:device,launchAfterInstall:launch
      }),{'Content-Type':'application/json'});
      setNotice('실제 설치 작업 등록: '+(data.job?.id||'')+' → '+device);
      await refresh();
    }catch(e){setNotice('설치 요청 실패: '+String(e))}
    finally{setBusy(false)}
  }
  const hostOnline=hosts.some(h=>h.deviceId===device&&h.online);
  return <section className="apk-manager" aria-label="Android APK 업로드 및 에뮬레이터 설치">
    <header className="apk-head">
      <div><span>ANDROID APP INSTALLATION</span><h2>외부 앱 설치 · 에뮬레이터 관리</h2>
      <p>웹에서 APK 업로드 → Railway 대기열 → 실제 Android ADB 설치 → 패키지 검증 → 앱 실행</p></div>
    </header>
    <div className="apk-layout">
      <div className="apk-panel">
        <h3>1 · 관리자 인증 및 APK 업로드</h3>
        <label>APK 관리 토큰
          <input type="password" autoComplete="off" value={token}
            onChange={e=>setToken(e.target.value)}
            placeholder="Railway 환경변수 LAB_APK_ADMIN_TOKEN 값"/>
        </label>
        <label>APK 파일 선택
          <input type="file" accept=".apk,application/vnd.android.package-archive"
            onChange={e=>setSelectedFile(e.target.files?.[0]||null)}/>
        </label>
        <button type="button" disabled={busy||!selectedFile||!token.trim()}
          onClick={()=>void upload()}>{busy?'작업 중…':'APK 서버에 업로드'}</button>
        <p className="apk-caption">최대 80MB · APK만 허용 · 비공개 보관 · SHA-256 검증. 신뢰할 수 있는 앱만 설치하세요.</p>
      </div>
      <div className="apk-panel">
        <h3>2 · 실제 설치 대상 지정</h3>
        <label>Android 에뮬레이터
          <select value={device} onChange={e=>setDevice(e.target.value)}>
            <option value="android-lab-01">지속형 Android 호스트 · android-lab-01</option>
            <option value="ci-android">GitHub Actions 일회용 Android · ci-android</option>
            {hosts.filter(x=>!['android-lab-01','ci-android'].includes(x.deviceId)).map(h=>
              <option key={h.deviceId} value={h.deviceId}>{h.deviceId}</option>)}
          </select>
        </label>
        <p className={'apk-host '+(hostOnline?'online':'offline')}>
          {hostOnline?'● 설치 호스트 온라인':'○ 설치 호스트 오프라인 · 작업은 대기열에 보관'}
        </p>
        <label className="apk-check">
          <input type="checkbox" checked={launch} onChange={e=>setLaunch(e.target.checked)}/>
          설치 성공 후 해당 앱 자동 실행
        </label>
        <p className="apk-caption">지속형 에뮬레이터를 연결하면 즉시 설치합니다. CI 에뮬레이터는 다음 실행 때만 설치 작업을 가져갑니다.</p>
        <button type="button" onClick={()=>void refresh()} disabled={!token.trim()}>서버·설치 상태 새로고침</button>
      </div>
    </div>
    <p className="apk-notice" role="status">{notice}</p>
    <div className="apk-panel">
      <h3>3 · 업로드한 APK 파일</h3>
      {files.length===0?<p className="apk-caption">업로드된 APK가 없습니다. 관리자 토큰을 입력하고 APK를 선택하세요.</p>:
      <div className="apk-table-wrap"><table><thead><tr>
        <th>APK 파일</th><th>크기</th><th>SHA-256</th><th>에뮬레이터 설치</th>
      </tr></thead><tbody>{files.map(f=><tr key={f.id}>
        <td>{f.filename}</td><td>{(f.size/1024/1024).toFixed(2)}MB</td>
        <td title={f.sha256}><code>{f.sha256.slice(0,12)}…</code></td>
        <td><button type="button" onClick={()=>void install(f)} disabled={busy}>실제 설치 요청</button></td>
      </tr>)}</tbody></table></div>}
    </div>
    <div className="apk-panel">
      <h3>4 · APK 설치 작업 결과</h3>
      {jobs.length===0?<p className="apk-caption">설치 작업이 없습니다.</p>:
      <div className="apk-table-wrap"><table><thead><tr>
        <th>APK</th><th>대상</th><th>상태</th><th>실행 결과</th>
      </tr></thead><tbody>{jobs.slice(0,25).map(j=><tr key={j.id}>
        <td>{j.filename}</td><td>{j.deviceId}</td>
        <td><strong>{({pending:'설치 대기',installing:'ADB 실행 중',installed:'설치 확인',failed:'작업 실패',completed:'조작 완료'} as const)[j.status]}</strong></td>
        <td>{j.packageName||j.error|| (j.status==='pending'?'호스트 연결 대기':'')}</td>
      </tr>)}</tbody></table></div>}
    </div>
    <EmulatorRemoteScreen token={token} deviceId={device} online={hostOnline} onNotice={setNotice}/>
  </section>;
}
