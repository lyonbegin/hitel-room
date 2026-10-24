import {useEffect,useState,type MouseEvent} from 'react';

type Command='tap'|'back'|'home'|'scroll'|'playstore'|'type';
export function EmulatorRemoteScreen({token,deviceId,online,onNotice,compact=false}:{
  token:string;deviceId:string;online:boolean;onNotice:(message:string)=>void;compact?:boolean
}){
  const [source,setSource]=useState('');
  const [search,setSearch]=useState('kakao');
  const [frameState,setFrameState]=useState('호스트의 전체 화면 캡처를 기다리는 중');
  useEffect(()=>{
    if(!token.trim())return;
    let stopped=false,oldUrl='';
    async function getFrame(){
      try{
        const response=await fetch('/lab-api/apk/frame/'+encodeURIComponent(deviceId),{
          cache:'no-store',headers:{authorization:'Bearer '+token.trim()}
        });
        if(!response.ok)throw Error('캡처 없음');
        const blob=await response.blob();
        if(stopped)return;
        const url=URL.createObjectURL(blob);
        setSource(url);
        setFrameState('실제 Android 에뮬레이터 전체 화면 · '+new Date().toLocaleTimeString('ko-KR'));
        if(oldUrl)URL.revokeObjectURL(oldUrl);
        oldUrl=url;
      }catch{if(!stopped)setFrameState('에뮬레이터 화면 미수신')}
    }
    void getFrame();
    const timer=window.setInterval(()=>void getFrame(),3500);
    return ()=>{stopped=true;window.clearInterval(timer);if(oldUrl)URL.revokeObjectURL(oldUrl)};
  },[token,deviceId]);
  async function control(action:Command,args:Record<string,unknown>={}){
    if(!online)return onNotice('실제 Android 호스트가 오프라인입니다. 터치 명령은 전송하지 않습니다.');
    try{
      const res=await fetch('/lab-api/apk/control',{
        method:'POST',headers:{authorization:'Bearer '+token.trim(),'content-type':'application/json'},
        body:JSON.stringify({deviceId,action,...args})
      });
      const result=await res.json();
      if(!res.ok||!result.ok)throw Error(result.error||'Control failed');
      onNotice('실제 에뮬레이터 '+action+' 명령 전송 · '+result.job?.id);
    }catch(e){onNotice('화면 조작 실패: '+String(e))}
  }
  function tap(event:MouseEvent<HTMLImageElement>){
    if(!online)return;
    const image=event.currentTarget,rect=image.getBoundingClientRect();
    // CSS object-fit:contain may letterbox tall Android screens. Translate
    // mouse positions through the ACTUAL image content rectangle.
    const nativeRatio=image.naturalWidth/image.naturalHeight;
    const boxRatio=rect.width/rect.height;
    const drawnWidth=boxRatio>nativeRatio?rect.height*nativeRatio:rect.width;
    const drawnHeight=boxRatio>nativeRatio?rect.height:rect.width/nativeRatio;
    const offsetX=(rect.width-drawnWidth)/2,offsetY=(rect.height-drawnHeight)/2;
    const x=Math.floor((event.clientX-rect.left-offsetX)/drawnWidth*image.naturalWidth);
    const y=Math.floor((event.clientY-rect.top-offsetY)/drawnHeight*image.naturalHeight);
    if(x<0||y<0||x>=image.naturalWidth||y>=image.naturalHeight)return;
    void control('tap',{x,y});
  }
  return <div className={compact?'apk-remote-inline':'apk-panel'}>
    {!compact&&<><h3>Android 전체 화면 직접 조작</h3>
    <p className="apk-caption">HITEL의 웹 미리보기가 아닌 실제 에뮬레이터 전체 화면입니다. 화면에서 Play Store 아이콘을 클릭해 앱을 설치할 수 있습니다.</p></>}
    {!compact&&<p className={'apk-host '+(online?'online':'offline')}>
      {online?'● Android 원격 터치 연결':'○ 에뮬레이터 종료 · 이전 캡처는 클릭할 수 없습니다'}
    </p>}
    <div className="apk-remote-screen">
      {source?<img src={source} alt="실제 Android 홈 화면 및 실행 중인 앱" onClick={tap}
        style={{cursor:online?'crosshair':'default'}} draggable={false}/>:
        <div className="apk-remote-placeholder">
          <strong>실제 Android 화면 연결 대기</strong>
          <p>{token.trim()?'일회용 Android 실행을 시작하면 실제 홈 화면이 이곳에 나타납니다.':'아래 APK 관리자에서 인증 토큰을 입력하세요.'}</p>
          <a href="https://github.com/lyonbegin/hitel-room/actions/workflows/android-interactive-session.yml"
            target="_blank" rel="noreferrer">Android 테스트 시작 · Run workflow ↗</a>
        </div>}
    </div>
    <div className="apk-remote-buttons">
      <button type="button" disabled={!online} onClick={()=>void control('playstore')}>Play Store</button>
      <button type="button" disabled={!online} onClick={()=>void control('back')}>뒤로</button>
      <button type="button" disabled={!online} onClick={()=>void control('home')}>홈</button>
      <button type="button" disabled={!online} onClick={()=>void control('scroll',{direction:'down'})}>스크롤 ↓</button>
      <button type="button" disabled={!online} onClick={()=>void control('scroll',{direction:'up'})}>스크롤 ↑</button>
    </div>
    <form className="apk-remote-search" onSubmit={event=>{event.preventDefault();void control('type',{text:search})}}>
      <input aria-label="Android 앱 검색어 입력" value={search} maxLength={70}
        placeholder="앱 검색어 (영문)" onChange={event=>setSearch(event.target.value)}/>
      <button type="submit" disabled={!online||!/^[A-Za-z0-9 ._-]{1,70}$/.test(search)}>입력</button>
    </form>
    <p className="apk-caption" role="status">{online?'실제 Android · 터치 조작 가능': '세션 오프라인 · '+frameState}</p>
  </div>;
}
