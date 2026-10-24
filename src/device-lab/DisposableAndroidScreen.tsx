import {useEffect,useRef,useState,type MouseEvent} from 'react';

/** The page receives a short-lived, HttpOnly test cookie when the disposable
 * runner boots. No credential entry, localStorage, or copied secrets. */
export function DisposableAndroidScreen({online,onNotice}:{
  online:boolean;onNotice:(message:string)=>void;
}){
  const deviceId='ci-playstore';
  const [screen,setScreen]=useState<string>('');
  const [updated,setUpdated]=useState('');
  const [term,setTerm]=useState('kakao');
  const urlRef=useRef<string>('');
  useEffect(()=>{
    let disposed=false;
    async function poll(){
      if(!online)return;
      try{
        const response=await fetch('/lab-api/apk/frame/'+deviceId,{
          credentials:'same-origin',cache:'no-store'
        });
        if(!response.ok)return;
        const blob=await response.blob();
        if(disposed)return;
        const url=URL.createObjectURL(blob);
        const prior=urlRef.current;
        urlRef.current=url;
        setScreen(url);
        setUpdated(new Date().toLocaleTimeString('ko-KR'));
        if(prior)URL.revokeObjectURL(prior);
      }catch{/* emulator may be starting */}
    }
    void poll();
    const timer=window.setInterval(()=>void poll(),2600);
    return ()=>{disposed=true;window.clearInterval(timer)};
  },[online]);
  useEffect(()=>()=>{if(urlRef.current)URL.revokeObjectURL(urlRef.current)},[]);
  async function send(action:string,data:Record<string,unknown>={}){
    if(!online){onNotice('Android 테스트 실행 후 조작할 수 있습니다.');return}
    try{
      const response=await fetch('/lab-api/apk/control',{
        method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({deviceId,action,...data})
      });
      const value=await response.json();
      if(!response.ok||!value.ok)throw Error(value.error||String(response.status));
      onNotice(action==='tap'?'Android 화면 터치 전달':'Android 명령 실행 대기: '+action);
    }catch(e){onNotice('조작 오류: '+String(e))}
  }
  function tap(event:MouseEvent<HTMLImageElement>){
    if(!online)return;
    const img=event.currentTarget,rect=img.getBoundingClientRect();
    if(!img.naturalWidth||!img.naturalHeight)return;
    const contentRatio=img.naturalWidth/img.naturalHeight;
    const displayRatio=rect.width/rect.height;
    const displayWidth=displayRatio>contentRatio?rect.height*contentRatio:rect.width;
    const displayHeight=displayRatio>contentRatio?rect.height:rect.width/contentRatio;
    const left=(rect.width-displayWidth)/2,top=(rect.height-displayHeight)/2;
    const x=Math.floor((event.clientX-rect.left-left)/displayWidth*img.naturalWidth);
    const y=Math.floor((event.clientY-rect.top-top)/displayHeight*img.naturalHeight);
    if(x>=0&&y>=0&&x<img.naturalWidth&&y<img.naturalHeight)void send('tap',{x,y});
  }
  return <div className="apk-remote-inline">
    <div className="apk-remote-screen">
      {screen?<img src={screen} alt="실제 Android 홈 화면" onClick={tap}
        style={{cursor:online?'pointer':'default'}} draggable={false}/>:
        <div className="apk-remote-placeholder">
          <strong>Android 홈 화면</strong>
          <p>{online?'실제 Android 화면을 수신하고 있습니다.':'일회용 Android를 실행하면 여기에서 실제 화면을 조작합니다.'}</p>
          <p>관리 화면에서 <strong>Android 실행</strong> 버튼을 누르세요.</p>
        </div>}
    </div>
    <div className="apk-remote-buttons">
      <button disabled={!online} onClick={()=>void send('playstore')}>Play Store</button>
      <button disabled={!online} onClick={()=>void send('back')}>뒤로</button>
      <button disabled={!online} onClick={()=>void send('home')}>홈</button>
      <button disabled={!online} onClick={()=>void send('scroll',{direction:'down'})}>스크롤 ↓</button>
      <button disabled={!online} onClick={()=>void send('scroll',{direction:'up'})}>스크롤 ↑</button>
    </div>
    <form className="apk-remote-search" onSubmit={e=>{e.preventDefault();void send('type',{text:term})}}>
      <input value={term} onChange={e=>setTerm(e.target.value)}
        aria-label="Android 앱 검색어" maxLength={70} placeholder="앱 검색 (영문)"/>
      <button type="submit" disabled={!online||!/^[A-Za-z0-9 ._-]{1,70}$/.test(term)}>입력</button>
    </form>
    <p className="apk-caption">{online?'실제 Android 연결됨 · '+(updated||'화면 대기'):'일회용 Android 실행 대기'}</p>
  </div>;
}
