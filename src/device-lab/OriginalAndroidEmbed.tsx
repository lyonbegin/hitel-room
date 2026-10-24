import {useEffect,useState} from 'react';

type NativeStatus={ok?:boolean;online?:boolean;url?:string;engine?:string;transport?:string};

/** Embeds the UNMODIFIED upstream dashboard served by its own native host.
 * No fake OS, PNG polling, synthetic input or replacement Android API.
 */
export function OriginalAndroidEmbed(){
  const [url,setUrl]=useState('');
  useEffect(()=>{
    let active=true;
    const check=async()=>{
      try{
        const response=await fetch('/lab-api/android-native/status',{cache:'no-store'});
        if(!response.ok)return;
        const data=await response.json() as NativeStatus;
        if(active)setUrl(data.online&&data.transport==='original-scrcpy-novnc'
          &&data.url?.startsWith('https://')?data.url:'');
      }catch{if(active)setUrl('')}
    };
    void check();
    const interval=window.setInterval(()=>void check(),3000);
    return ()=>{active=false;window.clearInterval(interval)};
  },[]);
  if(!url)return <div style={{display:'grid',placeContent:'center',height:'100%',minHeight:480,
    padding:24,textAlign:'center',color:'#73848c',gap:10}}>
    <strong style={{color:'#193f51'}}>Android 원본 엔진 연결 대기</strong>
    <span>Android 실행 후 원본 Docker·scrcpy·noVNC 서버가 시작되면 이 영역에 원본 관리 화면이 표시됩니다.</span>
    <span>스크린샷을 재생하거나 가짜 Android 화면을 표시하지 않습니다.</span>
  </div>;
  return <div style={{height:'100%',minHeight:570,display:'flex',flexDirection:'column',width:'100%'}}>
    <div style={{padding:'8px 12px',display:'flex',justifyContent:'space-between',
      alignItems:'center',fontSize:12,background:'#edf7fb',color:'#185777'}}>
      <span>● 원본 Android 11 · scrcpy / noVNC 실시간 연결</span>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{fontWeight:750}}>
        원본 전체 화면 열기 ↗
      </a>
    </div>
    <iframe key={url} src={url} title="원본 Android Emulator Platform 실시간 관리 UI"
      allow="clipboard-read; clipboard-write" style={{width:'100%',flex:1,minHeight:530,border:0}}/>
  </div>;
}
