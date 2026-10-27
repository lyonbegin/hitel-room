import {useEffect,useState} from 'react';
type LiveStatus={status?:string;viewerUrl?:string|null;sessionId?:string|null;reason?:string|null};
export function OriginalAndroidEmbed(){
 const [data,setData]=useState<LiveStatus|null>(null);
 useEffect(()=>{
   let mounted=true;
   const poll=async()=>{
     try{
       const r=await fetch('/lab-kvm/status',{cache:'no-store',credentials:'same-origin'});
       if(!r.ok)throw Error(String(r.status));
       const status=await r.json() as LiveStatus;
       if(mounted)setData(status);
     }catch{if(mounted)setData({status:'unavailable'});}
   };
   void poll();const t=window.setInterval(()=>void poll(),3000);
   return ()=>{mounted=false;window.clearInterval(t)};
 },[]);
 const viewer=data?.status==='running'&&data.sessionId&&
   data.viewerUrl?.startsWith('/lab-kvm/novnc/phone.html?sid=')?data.viewerUrl:null;
 if(!viewer)return <div style={{display:'grid',placeContent:'center',height:'100%',minHeight:460,
   padding:24,textAlign:'center',color:'#73848c',gap:12}}>
   <strong>{data?.status==='starting'?'실제 Android 11 시작 중':'실제 Android 화면 연결 대기'}</strong>
   <span>{data?.reason==='KVM_DISPATCH_NOT_CONFIGURED'?'일회용 KVM 실행 호스트가 아직 웹 실행 API와 연결되지 않았습니다.':
     data?.status==='starting'?'Android 11 및 scrcpy/noVNC를 실행하고 있습니다.':
     data?.status==='occupied'?'다른 브라우저에서 Android 기기를 사용하고 있습니다.':
     'Android 실행 버튼을 누르면 실제 기기 화면이 이곳에 표시됩니다.'}</span>
   <span>정적 이미지 또는 웹 미리보기로 실제 실행을 대체하지 않습니다.</span>
 </div>;
 return <div style={{height:'100%',minHeight:570,width:'100%',display:'flex',flexDirection:'column'}}>
   <div style={{padding:10,display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap',
     background:'#eaf7fb',color:'#185777',fontSize:12}}>
     <strong>● 일회용 KVM 호스트 · 원본 Android 11 · scrcpy/noVNC</strong>
     <a href={viewer} target="_blank" rel="noopener noreferrer">전체 화면 ↗</a>
   </div>
   <iframe key={data.sessionId} title="원본 Android 11 실시간 noVNC 터치 화면" src={viewer}
     allow="clipboard-read; clipboard-write" style={{width:'100%',flex:1,minHeight:540,border:0}}/>
 </div>;
}
