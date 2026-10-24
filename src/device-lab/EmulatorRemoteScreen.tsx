import {useEffect,useState,type MouseEvent} from 'react';

type Command='tap'|'back'|'home'|'scroll';
export function EmulatorRemoteScreen({token,deviceId,online,onNotice}:{
  token:string;deviceId:string;online:boolean;onNotice:(message:string)=>void
}){
  const [source,setSource]=useState('');
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
  return <div className="apk-panel">
    <h3>5 · Android 전체 화면 실시간 보기·조작</h3>
    <p className="apk-caption">HITEL WebView 화면이 아닌 에뮬레이터 OS 전체 화면입니다. 연결 중에는 화면을 클릭해 실제 터치할 수 있습니다.</p>
    <p className={'apk-host '+(online?'online':'offline')}>
      {online?'● 실제 Android 화면 제어 가능':'○ 호스트 오프라인 · 마지막 캡처만 조회 가능'}
    </p>
    <div className="apk-remote-screen">
      {source?<img src={source} alt="실제 Android 에뮬레이터 전체 화면" onClick={tap}
        style={{cursor:online?'crosshair':'default'}}/>:
        <p>저장된 전체 화면이 없습니다. Android 에뮬레이터에서 설치 에이전트를 실행하면 나타납니다.</p>}
    </div>
    <div className="apk-remote-buttons">
      <button type="button" disabled={!online} onClick={()=>void control('back')}>뒤로</button>
      <button type="button" disabled={!online} onClick={()=>void control('home')}>홈</button>
      <button type="button" disabled={!online} onClick={()=>void control('scroll',{direction:'down'})}>아래로 스크롤</button>
      <button type="button" disabled={!online} onClick={()=>void control('scroll',{direction:'up'})}>위로 스크롤</button>
    </div>
    <p className="apk-caption" role="status">{frameState}</p>
  </div>;
}
