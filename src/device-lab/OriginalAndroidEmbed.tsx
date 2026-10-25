import {useEffect,useState} from 'react';

type Status={status?:string;viewerUrl?:string|null;remainingSeconds?:number;reason?:string|null};
export function OriginalAndroidEmbed(){
 const [data,setData]=useState<Status|null>(null);
 useEffect(()=>{
   let mounted=true;
   const poll=async()=>{
     try{
       const r=await fetch('/lab-sandbox/status',{cache:'no-store'});
       if(!r.ok)throw Error(String(r.status));
       const v=await r.json() as Status;
       if(mounted)setData(v);
     }catch{if(mounted)setData({status:'unavailable'});}
   };
   void poll();
   const interval=setInterval(()=>void poll(),3000);
   return ()=>{mounted=false;clearInterval(interval)};
 },[]);
 const viewer=data?.status==='running'&&data?.viewerUrl?.startsWith('https://')
   &&data.viewerUrl.includes('.up.railway.app/')?data.viewerUrl:null;
 if(!viewer)return <div style={{
   display:'grid',placeContent:'center',height:'100%',minHeight:460,
   padding:24,textAlign:'center',color:'#73848c',gap:12}}>
   <strong>실제 Railway Android 화면 연결 대기</strong>
   <span>{data?.status==='connecting'?'Android 화면 응답을 확인하고 있습니다.'
     :data?.reason==='ANDROID_CHECKPOINT_NOT_PREPARED'
       ?'Android 11 체크포인트가 준비되지 않았습니다.'
       :'Android 실행 버튼으로 VM을 시작하면 실시간 noVNC 화면을 표시합니다.'}</span>
   <span>정적 미리보기나 캡처 이미지로 대신하지 않습니다.</span>
 </div>;
 return <div style={{height:'100%',minHeight:570,width:'100%',display:'flex',flexDirection:'column'}}>
   <div style={{padding:10,display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap',
     background:'#eaf7fb',color:'#185777',fontSize:12}}>
     <strong>● Railway Sandbox · 실제 Android 11 / scrcpy/noVNC</strong>
     <a href={viewer} target="_blank" rel="noopener noreferrer">전체 화면 ↗</a>
   </div>
   <iframe title="Railway Sandbox 실제 Android 11 실시간 noVNC" src={viewer}
     allow="clipboard-read; clipboard-write" style={{width:'100%',flex:1,minHeight:540,border:0}}/>
 </div>;
}
