import {WsScrcpyEmbed} from './WsScrcpyEmbed';

/** Browser entry at /android-original/. Only live H264 frames from the actual
 * disposable GitHub KVM Android 11 are permitted, never simulated snapshots. */
export function OriginalAndroidManager(){
 return <main style={{minHeight:'100vh',background:'#f1f5f8',color:'#173b4a',
   padding:'12px clamp(8px,2vw,26px)',boxSizing:'border-box'}}>
   <header style={{display:'flex',justifyContent:'space-between',gap:12,
    flexWrap:'wrap',marginBottom:14,alignItems:'center'}}>
     <div>
       <strong style={{fontSize:20}}>HITEL · Android 11 실시간 기기</strong>
       <p style={{fontSize:12,color:'#68808b',margin:'6px 0'}}>
         GitHub KVM · ws-scrcpy H.264 / WebCodecs · 브라우저 터치/키보드 · 최대 10분
       </p>
     </div>
     <a href="/sdk-lab" style={{color:'#136487',fontWeight:650}}>Communication SDK Lab ↗</a>
   </header>
   <section aria-label="실제 Android 11 원격 화면 및 실행 제어"
    style={{background:'#fff',border:'1px solid #d7e3e9',borderRadius:12,
     overflow:'hidden',minHeight:'min(80vh,820px)'}}>
     <WsScrcpyEmbed/>
   </section>
   <p style={{fontSize:12,color:'#68808b',marginTop:10,lineHeight:1.5}}>
     실제 Android 11 에뮬레이터가 시작되면 원본 화면이 표시됩니다.
     화면 전송은 VNC가 아닌 ws-scrcpy 영상입니다.
     실행 종료 시 GitHub KVM 호스트와 영상 전송 프로세스가 정리됩니다.
   </p>
 </main>;
}
