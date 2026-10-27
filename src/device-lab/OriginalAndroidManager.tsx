import {useState} from 'react';
import {AndroidSessionControls} from './AndroidSessionControls';
import {OriginalAndroidEmbed} from './OriginalAndroidEmbed';
export function OriginalAndroidManager(){
 const [notice,setNotice]=useState('');
 return <div style={{minHeight:'100vh',background:'#f1f5f8',color:'#173b4a',
   padding:'16px clamp(8px,2vw,26px)',boxSizing:'border-box'}}>
   <header style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:14}}>
     <div>
       <strong style={{fontSize:20}}>HITEL · Android Emulator Platform</strong>
       <p style={{fontSize:12,color:'#68808b',margin:'6px 0'}}>
         KVM 지원 일회용 실행 호스트 · Android 11 · 최대 10분 · 실행 호스트 종료
       </p>
     </div>
     <a href="/sdk-lab" style={{color:'#136487'}}>HITEL SDK Lab ↗</a>
   </header>
   <section style={{background:'#fff',padding:16,border:'1px solid #d7e3e9',borderRadius:12,marginBottom:14}}>
     <AndroidSessionControls onNotice={setNotice}/>
     {notice&&<p role="status" style={{fontSize:13,color:'#136487'}}>{notice}</p>}
   </section>
   <section style={{background:'#fff',border:'1px solid #d7e3e9',borderRadius:12,
     overflow:'hidden',minHeight:620}}>
     <OriginalAndroidEmbed/>
   </section>
 </div>;
}
