import {useCallback,useEffect,useState} from 'react';
import './ApkInstaller.css';

type Apk={id:string;filename:string;size:number;sha256:string};
type Job={id:string;deviceId:string;filename:string;status:string;packageName?:string;error?:string};
export type TestHost={deviceId:string;online:boolean;kind:string;lastSeen:string};
type Result={ok:boolean;error?:string;files?:Apk[];jobs?:Job[];hosts?:TestHost[];file?:Apk;job?:Job};

/** Simple disposable-device lab: the runner opens a temporary browser session.
 * There is intentionally no admin password field. */
export function DisposableAndroidInstaller({online,setHosts,onNotice}:{
  online:boolean;
  setHosts:(hosts:TestHost[])=>void;
  onNotice:(message:string)=>void;
}){
  const deviceId='ci-playstore';
  const [files,setFiles]=useState<Apk[]>([]);
  const [jobs,setJobs]=useState<Job[]>([]);
  const [selected,setSelected]=useState<File|null>(null);
  const [working,setWorking]=useState(false);
  const [launch,setLaunch]=useState(true);
  const [packageName,setPackageName]=useState('com.kakao.taxi');
  const [message,setMessage]=useState('테스트를 시작하면 앱을 설치하고 조작할 수 있습니다.');
  const request=useCallback(async(path:string,body?:BodyInit,headers:Record<string,string>={})=>{
    const response=await fetch('/lab-api/apk/'+path,{
      method:body===undefined?'GET':'POST',body,headers,
      credentials:'same-origin',cache:'no-store'
    });
    const data=await response.json() as Result;
    if(!response.ok||!data.ok)throw Error(data.error||'HTTP '+response.status);
    return data;
  },[]);
  const refresh=useCallback(async()=>{
    try{
      const hosts=await request('hosts');
      setHosts(hosts.hosts||[]);
      const [filesResult,jobsResult]=await Promise.all([request('files'),request('jobs')]);
      setFiles(filesResult.files||[]);
      setJobs(jobsResult.jobs||[]);
    }catch{
      setHosts([]);
    }
  },[request,setHosts]);
  useEffect(()=>{
    void refresh();
    const timer=window.setInterval(()=>void refresh(),4500);
    return ()=>window.clearInterval(timer);
  },[refresh]);
  async function doWork(operation:()=>Promise<string>){
    setWorking(true);
    try{const msg=await operation();setMessage(msg);onNotice(msg);await refresh()}
    catch(e){setMessage('작업 실패: '+String(e))}
    finally{setWorking(false)}
  }
  async function upload(){
    if(!selected)return;
    if(selected.size>80*1024*1024){setMessage('APK는 80MB 이하로 선택하세요.');return}
    await doWork(async()=>{
      const result=await request('upload',selected,{
        'Content-Type':'application/vnd.android.package-archive',
        'X-APK-Filename':encodeURIComponent(selected.name)
      });
      setSelected(null);
      return '업로드 완료: '+(result.file?.filename||selected.name);
    });
  }
  async function install(apk:Apk){
    await doWork(async()=>{
      const result=await request('jobs',JSON.stringify({
        apkId:apk.id,deviceId,launchAfterInstall:launch
      }),{'Content-Type':'application/json'});
      return 'Android 설치 작업 등록: '+(result.job?.id||'');
    });
  }
  async function openStore(operation:'store'|'verify'){
    await doWork(async()=>{
      await request('store',JSON.stringify({deviceId,packageName,operation}),
        {'Content-Type':'application/json'});
      return operation==='store'?'실제 Android Play Store에서 앱 페이지를 열었습니다.':
        'Android 앱 설치 확인 요청을 전송했습니다.';
    });
  }
  return <section className="apk-manager" aria-label="일회용 Android 앱 설치">
    <header className="apk-head"><div>
      <span>ANDROID TEST LAB</span>
      <h2>외부 Android 앱 설치 및 테스트</h2>
      <p>APK 업로드 → Android 설치 → 실제 화면 조작 → 종료 시 기기 초기화</p>
    </div></header>
    <div className="apk-layout">
      <div className="apk-panel">
        <h3>APK 파일 업로드</h3>
        <input type="file" accept=".apk,application/vnd.android.package-archive"
          aria-label="Android APK 파일" onChange={e=>setSelected(e.target.files?.[0]||null)}/>
        <p className="apk-caption">선택한 APK를 일회용 Android에 설치합니다.</p>
        <button type="button" disabled={!online||!selected||working}
          onClick={()=>void upload()}>APK 업로드</button>
      </div>
      <div className="apk-panel">
        <h3>실제 Android 세션</h3>
        <p className={'apk-host '+(online?'online':'offline')}>
          {online?'● Android 실행 중 · 터치 가능':'○ Android 종료 또는 시작 대기'}
        </p>
        <label className="apk-check"><input type="checkbox" checked={launch}
          onChange={e=>setLaunch(e.target.checked)}/>설치 후 앱 자동 실행</label>
        <a href="https://github.com/lyonbegin/hitel-room/actions/workflows/android-interactive-session.yml"
          target="_blank" rel="noreferrer">일회용 Android 실행 · Run workflow ↗</a>
        <p className="apk-caption">테스트가 종료되면 설치된 앱과 데이터가 초기화됩니다.</p>
      </div>
    </div>
    <p className="apk-notice" role="status">{message}</p>
    <div className="apk-panel"><h3>업로드된 앱</h3>
      {files.length===0?<p className="apk-caption">아직 업로드한 APK가 없습니다.</p>:
      <div className="apk-table-wrap"><table><thead><tr><th>APK</th><th>크기</th><th>설치</th></tr></thead>
        <tbody>{files.map(f=><tr key={f.id}><td>{f.filename}</td>
          <td>{(f.size/1048576).toFixed(1)}MB</td><td><button type="button"
          disabled={!online||working} onClick={()=>void install(f)}>Android에 설치</button></td>
        </tr>)}</tbody></table></div>}
    </div>
    <div className="apk-panel">
      <h3>Google Play에서 앱 설치</h3>
      <label>앱 패키지명<input value={packageName}
        onChange={e=>setPackageName(e.target.value)}/></label>
      <div className="apk-remote-buttons">
        <button type="button" disabled={!online||working} onClick={()=>void openStore('store')}>Play Store에서 열기</button>
        <button type="button" disabled={!online||working} onClick={()=>void openStore('verify')}>실제 설치 확인</button>
      </div>
    </div>
    <div className="apk-panel"><h3>설치·조작 결과</h3>
      {jobs.length===0?<p className="apk-caption">아직 실행한 작업이 없습니다.</p>:
        <div className="apk-table-wrap"><table><thead><tr>
          <th>작업</th><th>상태</th><th>결과</th>
        </tr></thead><tbody>{jobs.slice(0,20).map(job=><tr key={job.id}>
          <td>{job.filename}</td><td>{job.status}</td>
          <td>{job.packageName||job.error||''}</td>
        </tr>)}</tbody></table></div>}
    </div>
  </section>;
}
