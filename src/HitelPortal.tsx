import { useState } from 'react';
import './portal.css';
type Props={onPhone:()=>void;onFind:()=>void;onChat:()=>void;onAI:()=>void;onBusiness:()=>void;onVideo:()=>void};
const services=[
 {icon:'☎',tag:'PERSONAL',name:'사람과 연결',desc:'친구, 가족, 업무 상대와 연결하고 필요할 때 AI의 도움을 받습니다.',tone:'blue'},
 {icon:'▤',tag:'BUSINESS',name:'기업·상담센터 연결',desc:'기업 대표번호와 고객센터를 찾아 전화하거나 상담으로 연결합니다.',tone:'violet'},
 {icon:'◇',tag:'PUBLIC',name:'공공기관 연결',desc:'행정·복지·민원 분야의 기관을 찾아 소통할 수 있습니다.',tone:'teal'},
 {icon:'▣',tag:'VIDEO',name:'영상 대화방',desc:'기존 WebRTC 영상 통화 기능을 이용하여 사람과 만납니다.',tone:'orange'}
];
const capabilities=[
 {icon:'文',name:'실시간 통역',desc:'서로 다른 언어로 통화하기'},
 {icon:'CC',name:'음성 자막',desc:'상대의 말을 화면으로 보기'},
 {icon:'✧',name:'대화 지원',desc:'통화 중 필요한 도움받기'},
 {icon:'≡',name:'통화 요약',desc:'소통의 핵심을 기록하기'}
];
export default function HitelPortal({onPhone,onFind,onChat,onAI,onBusiness,onVideo}:Props){
 const [search,setSearch]=useState('');
 const choose=(action:()=>void)=>action();
 return <div className="hp-root">
  <div className="hp-alert"><span className="hp-livepoint"/> HITEL 통합 커뮤니케이션 <b>사람과 사람을 연결하는 새로운 방식</b></div>
  <div className="hp-banner">
   <div className="hp-copy"><span className="hp-eyebrow">HITEL · HUMAN CONNECTION PLATFORM</span><h1>사람과 사람 사이,<br/><em>새로운 연결의 시작.</em></h1><p>전화·영상·메시지를 한곳에서 시작하고, 필요한 순간 AI의 도움을 받는 커뮤니케이션 플랫폼입니다.</p><div className="hp-actions"><button className="hp-mainbutton" onClick={onPhone}>☎ &nbsp; 통화 시작하기 <span>→</span></button><button className="hp-outlinebutton" onClick={onFind}>상대방 찾기 ↗</button></div><div className="hp-under">전화 중계 · AI 실시간 보조 · 사람과 기관의 연결</div></div>
   <div className="hp-graphic" aria-label="사람과 사람을 잇는 HITEL 연결 구조"><div className="hp-gridline"/><div className="hp-node hp-node-a"><span>♙</span><small>나</small></div><div className="hp-join hp-join1"/><div className="hp-node hp-node-mid"><span>✦</span><b>HITEL</b><small>AI communication</small></div><div className="hp-join hp-join2"/><div className="hp-node hp-node-b"><span>♙</span><small>상대방</small></div><span className="hp-wave hp-wave1">◌</span><span className="hp-wave hp-wave2">◌</span></div>
  </div>
  <div className="hp-searchbar"><span className="hp-searchicon">⌕</span><input aria-label="연결 상대 검색" placeholder="사람, 회사, 공공기관, 상담센터를 찾아보세요" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')onFind()}}/><button onClick={onFind}>통합 검색 <span>→</span></button></div>
  <div className="hp-heading"><div><span className="hp-overline">EXPLORE HITEL</span><h2>어떤 연결을 시작하시겠습니까?</h2><p>일반 전화부터 기업 상담, 공공기관, 영상 대화까지 한곳에서 시작합니다.</p></div><small>COMMUNICATION SERVICES</small></div>
  <div className="hp-services">{services.map((s,i)=><button className={'hp-service hp-'+s.tone} key={s.name} onClick={()=>choose([onPhone,onBusiness,onFind,onVideo][i])}><div className="hp-service-top"><span className="hp-service-icon">{s.icon}</span><span className="hp-service-tag">{s.tag}</span></div><h3>{s.name}</h3><p>{s.desc}</p><div className="hp-service-bottom">서비스 이용하기 <span>↗</span></div></button>)}</div>
  <div className="hp-lower">
   <section className="hp-panel hp-quick"><div className="hp-panelheading"><div><span className="hp-overline">QUICK ACCESS</span><h2>빠른 연결</h2></div><span>바로 시작하기</span></div><div className="hp-quickrows"><button onClick={onPhone}><span className="hp-qicon">☎</span><div><b>전화 걸기</b><small>번호 입력 및 통화 AI 설정</small></div><span>→</span></button><button onClick={onFind}><span className="hp-qicon">⌕</span><div><b>전화번호·기관 찾기</b><small>연락처 및 대표번호 검색</small></div><span>→</span></button><button onClick={onChat}><span className="hp-qicon">▤</span><div><b>내 대화</b><small>통화·영상·메시지 기록</small></div><span>→</span></button></div></section>
   <section className="hp-panel hp-ai"><div className="hp-panelheading"><div><span className="hp-overline">AI ASSISTANT</span><h2>통화 속 나만의 AI</h2></div><button onClick={onAI}>AI 설정 ↗</button></div><p className="hp-aiintro">기존 통화 경험은 유지하면서, 필요한 보조 기능을 선택할 수 있습니다.</p><div className="hp-aiitems">{capabilities.map(s=><div key={s.name}><span>{s.icon}</span><b>{s.name}</b><small>{s.desc}</small></div>)}</div><div className="hp-ailabel">✦ AI 기능은 실제 통신 엔진 연동 단계에 맞춰 활성화됩니다.</div></section>
  </div>
  <section className="hp-business"><div className="hp-bicon">▦</div><div><strong>기관·기업을 위한 HITEL</strong><p>상담 대표번호, AI 응대, 상담원 연결을 위한 통합 커뮤니케이션 환경</p></div><button onClick={onBusiness}>기관용 서비스 보기 →</button></section>
  <footer className="hp-footer"><b>HITEL</b><span>Connecting people, intelligently.</span><span>화면 구성 시제품 · 통신/AI 기능 단계별 연동</span></footer>
 </div>;
}
