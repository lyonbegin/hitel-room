import {useCallback,useEffect,useRef,useState} from 'react';
import './GenymotionSaasClone.css';

type Page='devices'|'recipes'|'hardware'|'images'|'admin';
type Instance={uuid:string;name?:string;state?:string;status?:string;recipe?:{name?:string};recipe_uuid?:string;owner?:{name?:string};created_at?:string;updated_at?:string};
type Recipe={uuid:string;name:string;description?:string;os_image?:{version?:string;arch?:string};hardware_profile?:{name?:string};source?:string;architecture?:string};
type State={ok:boolean;configured:boolean;status:string;instance?:{uuid:string;name:string;recipeUuid:string;owned:boolean;expiresAt:string}|null};
type Player={ok:boolean;ready:boolean;webrtcAddress?:string;accessToken?:string;state?:string;error?:string};
type Result={ok:boolean;error?:string;recipes?:Recipe[];instances?:Instance[];configured?:boolean};
const base='/lab-api/genymotion';
const originalDocs='https://docs.genymotion.com/usage/saas/basic_steps/';
const playerScript='https://cdn.jsdelivr.net/npm/@genymotion/device-web-player@4.3.1/dist/js/device-renderer.min.js';
const playerStyle='https://cdn.jsdelivr.net/npm/@genymotion/device-web-player@4.3.1/dist/css/device-renderer.min.css';

function LivePlayer({access,address}:{access:string;address:string}){
  const host=useRef<HTMLDivElement>(null);
  const renderer=useRef<{VM_communication?:{disconnect:()=>void}}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let alive=true;
    function loadScript():Promise<void>{
      return new Promise((resolve,reject)=>{
        if((window as any).genyDeviceWebPlayer){resolve();return}
        const previous=document.querySelector<HTMLScriptElement>('script[data-genymotion-player]');
        if(previous){previous.addEventListener('load',()=>resolve(),{once:true});previous.addEventListener('error',()=>reject(Error('SDK_SCRIPT_FAILED')),{once:true});return}
        const link=document.createElement('link');link.rel='stylesheet';link.href=playerStyle;link.dataset.genymotionPlayer='css';document.head.appendChild(link);
        const script=document.createElement('script');script.src=playerScript;script.dataset.genymotionPlayer='true';
        script.onload=()=>resolve();script.onerror=()=>reject(Error('SDK_SCRIPT_FAILED'));document.body.appendChild(script);
      });
    }
    void loadScript().then(()=>{
      if(!alive||!host.current)return;
      const factory=(window as any).genyDeviceWebPlayer?.DeviceRendererFactory;
      if(!factory)throw Error('GENYMOTION_RENDERER_FACTORY_NOT_AVAILABLE');
      const api=new factory().setupRenderer(host.current,address,{
        token:access,displayToolbar:true,navbar:true,keyboard:true,mouse:true,touch:true,
        gps:true,battery:true,network:true,rotation:true,fullscreen:true,keyboardMapping:true,
        gappsInstall:true,fileUpload:false,streamResolution:true
      });
      renderer.current=api;
    }).catch(e=>{if(alive)setError(String(e))});
    return ()=>{alive=false;try{renderer.current?.VM_communication?.disconnect()}catch{/* ignore cleanup errors */}renderer.current=null};
  },[access,address]);
  return <div className="gm-live-player">{error?<div className="gm-player-message">{error}</div>:null}<div className="gm-renderer" ref={host}/></div>;
}
async function request(path:string,body?:object){
  const response=await fetch(base+path,{method:body?'POST':'GET',
    credentials:'same-origin',cache:'no-store',
    headers:body?{'content-type':'application/json'}:{},
    ...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||'HTTP '+response.status);
  return data;
}

export default function GenymotionSaasClone(){
  const [page,setPage]=useState<Page>('devices');
  const [state,setState]=useState<State>({ok:true,configured:false,status:'checking'});
  const [recipes,setRecipes]=useState<Recipe[]>([]);
  const [instances,setInstances]=useState<Instance[]>([]);
  const [dialog,setDialog]=useState(false);
  const [chosen,setChosen]=useState('');
  const [query,setQuery]=useState('');
  const [source,setSource]=useState<'official'|'custom'>('official');
  const [player,setPlayer]=useState<Player|null>(null);
  const [showPlayer,setShowPlayer]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(async()=>{
    try{
      const data=await request('/status') as State;setState(data);
      if(data.configured){
        const [r,i]=await Promise.all([request('/recipes') as Promise<Result>,request('/instances') as Promise<Result>]);
        setRecipes(r.recipes||[]);setInstances(i.instances||[]);
      }else{setRecipes([]);setInstances([])}
    }catch(e){setError(String(e))}
  },[]);
  useEffect(()=>{void refresh();const timer=window.setInterval(()=>void request('/status').then((s:State)=>setState(s)).catch(()=>{}),3500);return()=>window.clearInterval(timer)},[refresh]);
  useEffect(()=>{
    if(!showPlayer||!state.instance?.owned||!state.configured){setPlayer(null);return}
    let enabled=true;
    async function connect(){
      try{const data=await request('/player') as Player;if(enabled)setPlayer(data)}
      catch(e){if(enabled)setError(String(e))}
    }
    void connect();const timer=window.setInterval(()=>void connect(),5000);
    return()=>{enabled=false;window.clearInterval(timer)}
  },[showPlayer,state.instance?.uuid,state.instance?.owned,state.configured,revision]);
  const start=async(recipe:string)=>{
    if(!recipe)return;
    setWorking(true);setError('');
    try{await request('/start',{recipeUuid:recipe});setDialog(false);setChosen('');setShowPlayer(true);setRevision(n=>n+1);await refresh()}
    catch(e){setError(String(e))}
    finally{setWorking(false)}
  };
  const stop=async()=>{
    if(!window.confirm('이 Genymotion Android 인스턴스를 종료하고 설치 데이터와 변경 사항을 폐기하시겠습니까?'))return;
    setWorking(true);setError('');
    try{await request('/stop',{});setShowPlayer(false);setPlayer(null);await refresh()}
    catch(e){setError(String(e))}
    finally{setWorking(false)}
  };
  const connected=Boolean(state.configured);
  const active=Boolean(state.instance)&&state.status!=='idle';
  const show=recipes.filter(r=>{
    if(source==='official'&&r.source&&r.source!=='official')return false;
    if(source==='custom'&&r.source==='official')return false;
    return (r.name||'').toLowerCase().includes(query.toLowerCase());
  });
  const nav:(readonly [Page,string,string])[]=[
    ['devices','▣','Virtual devices'],['recipes','▤','Recipes'],
    ['hardware','▱','Hardware profiles'],['images','▧','Images']
  ];
  const chooseRecipe=(id:string)=>{setChosen(id);setDialog(true)};
  return <div className="gm-saas-root">
    <header className="gm-top">
      <div className="gm-menu-brand"><span className="gm-hamburger">☰</span><div className="gm-hex">⬡</div>
        <div>Genymotion<small>SaaS</small></div></div>
      <div className="gm-top-right"><span className="gm-cloud-dot">●</span><span>Genymotion SaaS</span>
        <button title="Refresh" onClick={()=>void refresh()}>↻</button><a href="/sdk-lab" title="Communication SDK 관리 화면">HITEL SDK ↗</a></div>
    </header>
    <div className="gm-body">
      <aside className="gm-sidebar">
        {nav.map(([id,icon,title])=><button key={id} className={page===id?'gm-active':''} onClick={()=>{setPage(id);setError('')}}>
          <span>{icon}</span>{title}</button>)}
        <div className="gm-sidebar-separator"/>
        <a href={originalDocs} target="_blank" rel="noreferrer"><span>▤</span>Documentation ↗</a>
        <a href="https://developer.genymotion.com/saas/" target="_blank" rel="noreferrer"><span>‹›</span>API reference &amp; SDK ↗</a>
        <a href="https://support.genymotion.com/" target="_blank" rel="noreferrer"><span>◉</span>Support ↗</a>
        <button className={page==='admin'?'gm-active':''} onClick={()=>setPage('admin')}><span>⚙</span>Administration</button>
        <div className="gm-sidebar-bottom">Status <span className={connected?'gm-ok':'gm-pending'}>● {connected?'Operational':'Account not connected'}</span></div>
      </aside>
      <main className="gm-content">
        {error&&<div className="gm-error" role="alert">{error}<button onClick={()=>setError('')}>×</button></div>}
        {!connected&&<div className="gm-disconnected">Genymotion SaaS 계정 API 연결 전입니다. 실제 인스턴스·Recipes 목록은 연결 후 표시됩니다. 원본 Android 화면을 가짜로 생성하지 않습니다.</div>}
        {page==='devices'&&<>
          <div className="gm-heading-row"><h2>Virtual devices</h2><div className="gm-heading-actions">
            <button className="gm-icon-button" title="Customize columns">▦</button>
            <button className="gm-icon-button" onClick={()=>void refresh()} title="Refresh">⟳</button>
            <button className="gm-start" disabled={!connected||working||active} onClick={()=>setDialog(true)}>▶ START</button>
          </div></div>
          {showPlayer&&active&&state.instance?.owned?(
            <section className="gm-device-live">
              <aside className="gm-device-menu"><h3>{state.instance.name}</h3>
                <button className="gm-selected">Display VD</button>
                <button onClick={()=>setError('공식 SDK의 Live session 기능은 플레이어 내에서 사용합니다.')}>Live session</button>
                <button disabled={working} onClick={()=>void stop()}>Stop</button>
                <button onClick={()=>setError('일회용 기기의 상태 저장은 사용하지 않습니다. 종료 시 초기화됩니다.')}>Save</button>
                <a href="https://support.genymotion.com/" target="_blank" rel="noreferrer">Support ↗</a>
                <div className="gm-device-status">● {state.status==='starting'?'Starting…':'Operational'}</div>
              </aside>
              <div className="gm-device-main">
                <div className="gm-device-title">{state.instance.name}</div>
                {player?.ready&&player.webrtcAddress&&player.accessToken?
                  <LivePlayer address={player.webrtcAddress} access={player.accessToken}/>:
                  <div className="gm-awaiting"><span className="gm-spin">◌</span>
                    <b>Connecting to Genymotion virtual device</b>
                    <p>{player?.state||'Android 시작 및 WebRTC 연결 대기 중입니다.'}</p></div>}
              </div>
            </section>
          ):<div className="gm-table-scroll"><table className="gm-table"><thead><tr>
            <th>Name</th><th>Status</th><th>UUID</th><th>Recipe</th><th>Owner</th><th>Last update</th><th>Actions</th>
          </tr></thead><tbody>
            {instances.length?instances.map((item,i)=><tr key={item.uuid||i}>
              <td>{item.name||'Android Virtual Device'}</td>
              <td><span className="gm-table-status">● {item.state||item.status||'Unknown'}</span></td>
              <td><code>{item.uuid||''}</code></td><td>{item.recipe?.name||item.recipe_uuid||'—'}</td>
              <td>{item.owner?.name||'—'}</td><td>{item.updated_at||item.created_at||'—'}</td>
              <td>{state.instance?.uuid===item.uuid&&state.instance.owned?
                <><button onClick={()=>{setShowPlayer(true);setRevision(n=>n+1)}}>▶</button><button onClick={()=>void stop()}>■</button></>:'—'}</td>
            </tr>):<tr><td colSpan={7} className="gm-empty">No virtual devices running</td></tr>}
          </tbody></table><div className="gm-pagination">Rows per page: 5　　1–{Math.min(5,instances.length)} of {instances.length}　‹　›</div></div>}
        </>}
        {page==='recipes'&&<>
          <div className="gm-heading-row"><h2>Recipes</h2><button className="gm-icon-button" onClick={()=>void refresh()}>⟳ Refresh</button></div>
          <div className="gm-recipes-header"><select value={source} onChange={e=>setSource(e.target.value as 'official'|'custom')}>
            <option value="official">Official Recipes</option><option value="custom">Custom Recipes</option>
          </select><input placeholder="Search" aria-label="Search Recipes" value={query} onChange={e=>setQuery(e.target.value)}/></div>
          <div className="gm-recipe-grid">{show.map((r,i)=><article className="gm-recipe-card" key={r.uuid||i}>
            <div className="gm-recipe-card-main"><div className="gm-recipe-title">{r.name}<button disabled={working||!connected||active} onClick={()=>chooseRecipe(r.uuid)} aria-label={'Start '+r.name}>▶</button></div>
              <div>▯ {r.hardware_profile?.name||'Genymotion Phone'}</div>
              <div>♟ Android {r.os_image?.version||''}　<span className="gm-recipe-arch">{r.os_image?.arch||r.architecture||'arm64'}</span></div>
              <code>{r.uuid}</code></div>
            <footer>Genymotion <span className="gm-hex-small">⬡</span></footer>
          </article>)}</div>
          {!show.length&&<div className="gm-empty-cards">No recipes available{!connected?' · Connect your Genymotion SaaS account':''}</div>}
        </>}
        {(page==='hardware'||page==='images')&&<div className="gm-general">
          <div className="gm-heading-row"><h2>{page==='hardware'?'Hardware profiles':'Images'}</h2></div>
          <p>Genymotion SaaS의 {page==='hardware'?'Hardware profiles':'Images'} 화면입니다. 공식 SaaS 리소스는 계정 연결 뒤에 이용합니다.</p>
          <a href={originalDocs} target="_blank" rel="noreferrer">Original Genymotion SaaS documentation ↗</a>
        </div>}
        {page==='admin'&&<div className="gm-general"><h2>Administration</h2><h3>Dashboard</h3>
          <div className="gm-admin-boxes"><div><small>Current usage</small><b>{active?'1 active device':'0 active devices'}</b></div>
          <div><small>Next billing overview</small><b>Genymotion account required</b></div></div>
          <p>사용량·결제 정보는 Genymotion 계정에서 제공합니다.</p>
          <a href="https://account.geny.io/signin" target="_blank" rel="noreferrer">Plans &amp; Billing ↗</a></div>}
      </main>
    </div>
    {dialog&&<div className="gm-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDialog(false)}}>
      <div className="gm-dialog" role="dialog" aria-modal="true" aria-label="Start virtual device">
        <header><h3>Start a virtual device</h3><button onClick={()=>setDialog(false)}>×</button></header>
        <p>Select a recipe to launch a disposable Android virtual device.</p>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search recipes" aria-label="Search recipes"/>
        <div className="gm-dialog-list">{show.map(r=><button key={r.uuid} className={chosen===r.uuid?'selected':''} onClick={()=>setChosen(r.uuid)}>
          ▯ {r.name}<small>{r.hardware_profile?.name||'Genymotion Phone'}</small></button>)}
          {!show.length&&<p>No available recipes</p>}</div>
        <footer><button onClick={()=>setDialog(false)}>CANCEL</button><button className="gm-start" disabled={!chosen||working||!connected} onClick={()=>void start(chosen)}>{working?'STARTING…':'START'}</button></footer>
      </div></div>}
  </div>;
}
