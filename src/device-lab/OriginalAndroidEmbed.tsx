import {useEffect,useState} from 'react';
type Status={status?:string;viewerUrl?:string|null;checkpoint?:string;reason?:string|null};
export function OriginalAndroidEmbed(){
 const [data,setData]=useState<Status|null>(null);
 useEffect(()=>{
  let mounted=true;
  const poll=async()=>{
   try{
    const r=await fetch('/lab-sandbox/status',{cache:'no-store'});
    if(!r.ok)throw Error(String(r.status));
    const x=await r.json() as Status;
    if(mounted)setData(x);
   }catch{if(mounted)setData({status:'unavailable'})}
  };
  void poll();const t=window.setInterval(()=>void poll(),3000);
  return()=>{mounted=false;window.clearInterval(t)};
 },[]);
 // The viewer is served by the actual Railway Sandbox, never a GitHub runner.
 const viewer=data?.status==='running'&&data.viewerUrl?.startsWith('https://')?data.viewerUrl:null;
 if(!viewer)return <div style={{display:'grid',placeContent:'center',height:'100%',minHeight:460,
  padding:24,textAlign:'center',color:'#73848c',gap:12}}>
   <strong>{data?.status==='starting'||data?.status==='connecting'?'Railway Android 11 시작 중':'실제 Railway Android 화면 연결 대기'}</strong>
   <span>{data?.reason==='ANDROID_CHECKPOINT_NOT_PREPARED'?'Railway Sandbox의 Android 11 설치는 성공했지만 KVM 없는 부팅 검사에서 제한시간을 초과했습니다. 실제 기기 화면은 아직 제공할 수 없습니다.':
    '실제 Android가 부팅되면 Railway Sandbox의 noVNC 화면이 이곳에 표시됩니다.'}</span>
   <span>GitHub Actions, 정적 이미지, 모의 Android 화면으로 대체하지 않습니다.</span>
  </div>;
 return <div style={{height:'100%',minHeight:570,width:'100%',display:'flex',flexDirection:'column'}}>
  <div style={{padding:10,background:'#eaf7fb',color:'#185777',fontSize:12}}>
   <strong>● Railway Sandbox · 실제 Android 11</strong>
   <a href={viewer} target="_blank" rel="noopener noreferrer" style={{float:'right'}}>새 창 ↗</a>
  </div>
  <iframe title="Railway Sandbox 실제 Android 11 실시간 화면" src={viewer}
   style={{width:'100%',flex:1,minHeight:540,border:0}}/>
 </div>;
}
