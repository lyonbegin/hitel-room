import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './IosLivePanel.css';

type Status={
  ok?:boolean;phase?:string;online?:boolean;videoLive?:boolean;
  detail?:string|null;runId?:string|null;lastFrameAt?:string|null;
  stopped?:boolean;
};
const labels:Record<string,string>={
  idle:'종료됨',queued:'macOS 실행기 배정 대기',booting:'iPhone 16 Pro 부팅·앱 준비',
  ready:'영상 시작 대기',streaming:'실제 iPhone 영상 연결',
  reconnecting:'실행기 재연결 중',stopping:'기기 종료 중',failed:'실행 오류'
};
const API='/lab-sandbox/ios';
type Props={onNotice?:(message:string)=>void;controlsHost:HTMLDivElement|null};
export default function IosLivePanel({onNotice,controlsHost}:Props){
  const [status,setStatus]=useState<Status>({phase:'idle'});
  const [error,setError]=useState('');
  const [image,setImage]=useState('');
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [rotation,setRotation]=useState<'portrait'|'landscape'>('portrait');
  const socket=useRef<WebSocket|null>(null);
  const mediaUrl=useRef('');
  const startPoint=useRef<{x:number;y:number}|null>(null);
  const onNoticeRef=useRef(onNotice);
  onNoticeRef.current=onNotice;
  const refresh=useCallback(async()=>{
    try {
      const response=await fetch(API+'/status',{cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const s=await response.json() as Status;
      setStatus(s);
    }catch(e){setError('iPhone 서버 상태 응답 실패: '+String(e))}
  },[]);
  useEffect(()=>{
    void refresh();const id=window.setInterval(()=>void refresh(),4000);
    return ()=>window.clearInterval(id);
  },[refresh]);
  useEffect(()=>{
    let disposed=false;
    let timer:number|undefined;
    const connect=()=>{
      if(disposed)return;
      const protocol=location.protocol==='https:'?'wss:':'ws:';
      const ws=new WebSocket(protocol+'//'+location.host+API+'/socket?role=viewer');
      ws.binaryType='blob';
      socket.current=ws;
      ws.onmessage=e=>{
        if(e.data instanceof Blob){
          const url=URL.createObjectURL(e.data);
          const prev=mediaUrl.current;
          mediaUrl.current=url;
          setImage(url);
          if(prev)URL.revokeObjectURL(prev);
        }else{
          try {
            const msg=JSON.parse(e.data);
            if(msg.type==='status')setStatus(msg as Status);
            if(msg.type==='result'){
              const result=(msg.ok?'완료: ':'오류: ')+String(msg.message||'');
              if(!msg.ok)setError(result);
              onNoticeRef.current?.(result);
            }
          }catch{/* malformed messages are ignored */}
        }
      };
      ws.onclose=()=>{
        if(socket.current===ws)socket.current=null;
        if(!disposed)timer=window.setTimeout(connect,2000);
      };
      ws.onerror=()=>{ws.close()};
    };
    connect();
    return ()=>{
      disposed=true;if(timer)clearTimeout(timer);
      socket.current?.close();
      if(mediaUrl.current)URL.revokeObjectURL(mediaUrl.current);
    };
  },[]);
  async function post(path:string){
    setError('');setBusy(true);
    try {
      const response=await fetch(API+'/'+path,{method:'POST',credentials:'same-origin',
        headers:{'content-type':'application/json'},body:'{}'});
      const data=await response.json() as Status & {error?:string};
      if(!response.ok||!data.ok)throw new Error(data.error||'HTTP '+response.status);
      setStatus(data);
      onNoticeRef.current?.(path==='start'?'iPhone 실제 실행 요청 접수':'iPhone 종료 요청 접수');
    }catch(e){setError(String(e));}
    finally{setBusy(false)}
  }
  function command(action:string,data:Record<string,string|number>={}){
    setError('');
    const ws=socket.current;
    if(!ws||ws.readyState!==WebSocket.OPEN||!status.online){
      setError('실제 iPhone 호스트가 연결되지 않았습니다.');return;
    }
    ws.send(JSON.stringify({type:'command',action,id:Math.random().toString(36).slice(2),data}));
    onNoticeRef.current?.('iPhone '+action+' 명령 전달');
  }
  function mapPoint(e:React.PointerEvent<HTMLImageElement>){
    const rect=e.currentTarget.getBoundingClientRect();
    const logicalWidth=rotation==='landscape'?874:402;
    const logicalHeight=rotation==='landscape'?402:874;
    const ratio=logicalWidth/logicalHeight;
    const dw=Math.min(rect.width,rect.height*ratio);
    const dh=dw/ratio;
    const left=rect.left+(rect.width-dw)/2;
    const top=rect.top+(rect.height-dh)/2;
    const px=(e.clientX-left)/dw,py=(e.clientY-top)/dh;
    if(px<0||px>1||py<0||py>1)return null;
    return {x:Math.round(px*logicalWidth),y:Math.round(py*logicalHeight)};
  }
  const active=status.online===true && status.videoLive===true;
  return <>
    <div className="ios-live-root">
      <div className="ios-live-video">
      {active&&image?
        <img draggable={false} src={image} alt="iPhone 16 Pro 실제 시뮬레이터 영상"
          onPointerDown={e=>{startPoint.current=mapPoint(e);e.currentTarget.setPointerCapture(e.pointerId)}}
          onPointerUp={e=>{
            const start=startPoint.current;startPoint.current=null;
            const end=mapPoint(e);
            if(!start||!end)return;
            if(Math.hypot(start.x-end.x,start.y-end.y)>18)
              command('swipe',{x:start.x,y:start.y,x2:end.x,y2:end.y});
            else command('tap',start);
          }}
        />:
        <div className="ios-live-wait" role="status">
          <strong>iPhone 16 Pro</strong>
          <span>{labels[status.phase||'idle']||status.phase||'연결 대기'}</span>
          <small>{status.detail||'실제 영상이 도착할 때만 화면을 표시합니다.'}</small>
        </div>}
      </div>
    </div>
    {controlsHost && createPortal(<div className="ios-live-actions">
      <div className="ios-live-state"><b>{labels[status.phase||'idle']||status.phase}</b>
        <span>{status.videoLive?'실시간 영상 수신 중':status.online?'호스트 연결 · 영상 대기':'실행기 미연결'}</span></div>
      <div className="ios-live-buttons">
        <button disabled={busy||status.online||(!status.stopped&&status.phase!=='failed')} onClick={()=>void post('start')}>iPhone 실행</button>
        <button disabled={busy||status.stopped} onClick={()=>void post('stop')}>종료</button>
        <button disabled={!status.online} onClick={()=>command('home')}>홈</button>
        <button disabled={!status.online} onClick={()=>{const angle=rotation==='portrait'?'landscape':'portrait';setRotation(angle);command('rotate',{angle})}}>회전</button>
        <button disabled={!status.online} onClick={()=>command('install')}>HITEL 앱 설치</button>
        <button disabled={!status.online} onClick={()=>command('launch')}>앱 실행</button>
        <button disabled={!status.online} onClick={()=>command('safari')}>Safari 열기</button>
      </div>
      <div className="ios-live-text"><input aria-label="iPhone 입력할 문자" value={text} onChange={e=>setText(e.target.value)}
        placeholder="iPhone에 입력할 문자 (한글 포함)" maxLength={300}/>
        <button disabled={!status.online||!text.trim()} onClick={()=>command('text',{text})}>입력</button></div>
      {error&&<p className="ios-live-error">{error}</p>}
      <small>기기 화면을 클릭하면 터치, 끌면 스와이프가 전달됩니다. Android 연결과 독립적으로 작동합니다.</small>
      {status.runId&&<a href={'https://github.com/lyonbegin/hitel-room/actions/runs/'+encodeURIComponent(status.runId)}
        target="_blank" rel="noreferrer">macOS 실행 기록 #{status.runId}</a>}
    </div>,controlsHost)}
  </>;
}
