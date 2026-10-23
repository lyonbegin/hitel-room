import { useState } from 'react';
import './hitel.css';

type Tab = '전화'|'찾기'|'대화'|'내 AI'|'MY'|'기관용';
const tabs: {name:Tab;icon:string;hint:string}[] = [
 {name:'전화',icon:'☎',hint:'AI 통화'}, {name:'찾기',icon:'⌕',hint:'연락처·기관'}, {name:'대화',icon:'▤',hint:'대화 목록'},
 {name:'내 AI',icon:'✦',hint:'개인 AI'}, {name:'MY',icon:'◉',hint:'내 기록'}, {name:'기관용',icon:'▦',hint:'상담 운영'}
];
const keypad=[['1',''],['2','ABC'],['3','DEF'],['4','GHI'],['5','JKL'],['6','MNO'],['7','PQRS'],['8','TUV'],['9','WXYZ'],['*',''],['0','+'],['#','']];
const contacts=[
 {name:'국민건강보험공단',category:'공공기관',number:'1577-1000',detail:'건강보험 민원 및 상담'},
 {name:'정부민원안내',category:'공공기관',number:'110',detail:'정부 민원 통합 안내'},
 {name:'보건복지상담센터',category:'공공기관',number:'129',detail:'보건·복지 상담'}
];
const initialModes=['실시간 통역','통화 자막','AI 대화 도움','통화 요약'];
export default function HitelHome({onLegacy}:{onLegacy:()=>void}){
 const [tab,setTab]=useState<Tab>('전화');
 const [number,setNumber]=useState('');
 const [query,setQuery]=useState('');
 const [enabled,setEnabled]=useState<string[]>(['통화 자막','통화 요약']);
 const [message,setMessage]=useState('');
 const [dialMode,setDialMode]=useState<'일반전화'|'HITEL 통화'>('HITEL 통화');
 const [showMatrix,setShowMatrix]=useState(false);
 const toggle=(name:string)=>setEnabled(v=>v.includes(name)?v.filter(x=>x!==name):[...v,name]);
 const dial=()=>setMessage(number.trim()?'전화번호 '+number+'의 연결은 통신 게이트웨이 연동 후 활성화됩니다. 현재는 통화 UI 미리보기입니다.':'먼저 전화번호를 입력해 주십시오.');
 const result=contacts.filter(c=>(c.name+' '+c.number+' '+c.detail).includes(query));
 return <div className="hc-shell">
  <aside className="hc-side">
   <button className="hc-logo" onClick={()=>setTab('전화')}><span className="hc-logomark">H</span><span><b>HITEL</b><small>AI COMMUNICATION</small></span></button>
   <div className="hc-navlabel">커뮤니케이션</div>
   <nav className="hc-nav">{tabs.map(t=><button key={t.name} className={tab===t.name?'hc-active':''} onClick={()=>{setTab(t.name);setMessage('');}}><span className="hc-icon">{t.icon}</span><span>{t.name}</span><span className="hc-navhint">{t.hint}</span></button>)}</nav>
   <div className="hc-sidebottom"><div className="hc-aiicon">✦</div><strong>AI가 함께하는 통화</strong><p>전화의 시작부터 종료 후 정리까지, HITEL이 연결을 돕습니다.</p><button onClick={()=>setTab('내 AI')}>내 AI 설정 →</button></div>
   <button className="hc-legacy" onClick={onLegacy}>↗ 기존 영상 대화방 열기</button>
  </aside>
  <div className="hc-body">
   <header className="hc-header"><div><span className="hc-crumb">HITEL / {tab}</span></div><div className="hc-headright"><span className="hc-headpill">● UI 미리보기</span><span className="hc-avatar">H</span></div></header>
   <main className="hc-main">
    {tab==='전화'&&<>
     <section className="hc-hero"><div className="hc-herocopy"><span className="hc-herokicker">THE NEW WAY TO CONNECT</span><h1>통화는 그대로.<br/><span>소통은 더 스마트하게.</span></h1><p>상대방이 HITEL을 설치하지 않아도 이용할 수 있도록 설계한 AI 통신 플랫폼입니다. 전화 전·중·후에 AI가 필요한 도움을 제공합니다.</p><div className="hc-herotags"><span>✦ AI 실시간 지원</span><span>◎ 사람 ↔ 사람</span><span>▣ 사람 ↔ 기관</span></div></div><div className="hc-herovis"><div className="hc-orb hc-orb1">☏</div><div className="hc-linkline"/><div className="hc-orb hc-orb2">✦<small>AI</small></div><div className="hc-linkline"/><div className="hc-orb hc-orb3">♙</div><span className="hc-visualcaption">사람 — HITEL AI — 상대방</span></div></section>
     <section className="hc-sectiontitle"><div><span className="hc-overline">MAKE A CALL</span><h2>지금 전화하기</h2><p>번호를 입력하고 필요한 AI 기능을 선택하십시오.</p></div><span className="hc-subtle">01 / PHONE</span></section>
     <div className="hc-callgrid"><section className="hc-panel hc-dial">
      <div className="hc-switchrow"><button className={dialMode==='HITEL 통화'?'on':''} onClick={()=>setDialMode('HITEL 통화')}>HITEL 통화</button><button className={dialMode==='일반전화'?'on':''} onClick={()=>setDialMode('일반전화')}>일반전화</button></div>
      <label className="hc-inputlabel">상대방 전화번호</label><div className="hc-number"><input aria-label="상대방 전화번호" type="tel" placeholder="전화번호를 입력하세요" value={number} onChange={e=>setNumber(e.target.value.replace(/[^0-9+*#-]/g,''))}/><button aria-label="지우기" onClick={()=>setNumber(n=>n.slice(0,-1))}>⌫</button></div>
      <div className="hc-keypad">{keypad.map(([digit,letters])=><button key={digit} onClick={()=>setNumber(n=>n+digit)}><strong>{digit}</strong><small>{letters||'\u00a0'}</small></button>)}</div>
      <button className="hc-callbutton" onClick={dial}><span>☎</span> AI와 함께 전화 걸기 <span>→</span></button>
      <p className="hc-previewnote">통신 게이트웨이 연결 전에는 실제 발신이 이루어지지 않습니다.</p>
     </section><section className="hc-panel hc-assist">
      <div className="hc-paneheading"><div><span className="hc-aistar">✦</span><div><h3>통화 AI 어시스턴트</h3><p>이번 통화에서 사용할 기능</p></div></div><span className="hc-mini-pill">개인 설정</span></div>
      <div className="hc-featurelist">{initialModes.map((name,i)=><button key={name} className="hc-feature" onClick={()=>toggle(name)}><span className="hc-featureicon">{['文','CC','✧','≡'][i]}</span><span className="hc-featuretext"><strong>{name}</strong><small>{['상대방 언어를 내 언어로 전달','상대방 음성을 글자로 표시','통화 중 필요한 정보와 응답 지원','통화 종료 후 핵심 내용 정리'][i]}</small></span><span className={'hc-toggle '+(enabled.includes(name)?'selected':'')}><i/></span></button>)}</div>
      <div className="hc-helper"><span>✦</span><p>선택한 AI 기능은 실제 통신·음성 처리 엔진과 연동될 때 통화에 적용됩니다.</p></div>
      <button className="hc-textlink" onClick={()=>setTab('내 AI')}>AI 상세 설정 관리 →</button>
     </section></div>
     <div className="hc-shortcuts"><button onClick={()=>setTab('찾기')}><span>⌕</span><strong>연락처·기관 찾기</strong><small>전화번호 검색 →</small></button><button onClick={()=>setTab('대화')}><span>▤</span><strong>대화와 통화 기록</strong><small>최근 기록 보기 →</small></button><button onClick={onLegacy}><span>▣</span><strong>기존 영상 대화방</strong><small>WebRTC 연결 →</small></button></div>
     <div className="hc-matrix"><button onClick={()=>setShowMatrix(!showMatrix)}>통신 연결 유형 16가지 <span>{showMatrix?'접기 −':'구조 보기 +'}</span></button>{showMatrix&&<div><p>P: 일반전화 · P+: AI 보조 전화 · N: HITEL 가입자 · W: 웹/기관 연결</p><div className="hc-matrixgrid">{['P','P+','N','W'].flatMap(a=>['P','P+','N','W'].map(b=><span key={a+b}>{a} → {b}</span>))}</div><small>표시는 연결 시나리오 분류이며 현재 실통화 연동 상태를 의미하지 않습니다.</small></div>}</div>
    </>}
    {tab==='찾기'&&<><section className="hc-sectiontitle"><div><span className="hc-overline">FIND & CONNECT</span><h2>사람과 기관 찾기</h2><p>연락처, 대표번호, 공공기관을 찾아 바로 전화 화면으로 이동합니다.</p></div></section><section className="hc-panel hc-directory"><div className="hc-search">⌕ <input placeholder="기관명, 서비스명, 전화번호 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div><h3>기관 대표번호</h3>{result.map(c=><div className="hc-contact" key={c.number}><span className="hc-contacticon">☎</span><div><strong>{c.name}</strong><small>{c.category} · {c.detail}</small></div><b>{c.number}</b><button onClick={()=>{setNumber(c.number);setTab('전화');}}>전화 화면 →</button></div>)}{!result.length&&<p className="hc-empty">검색 결과가 없습니다.</p>}<p className="hc-previewnote">예시 연락처 목록입니다. 실제 기관 통합검색은 데이터 연동 대상입니다.</p></section></>}
    {tab==='대화'&&<><section className="hc-sectiontitle"><div><span className="hc-overline">CONVERSATIONS</span><h2>대화</h2><p>통화·문자·영상이 한곳에 모이는 대화 공간입니다.</p></div></section><div className="hc-twocol"><section className="hc-panel hc-emptybox"><span>▤</span><h3>통화 및 대화 기록</h3><p>전화 게이트웨이와 대화 기록 API가 연동되면 이곳에 실제 기록이 표시됩니다.</p><button className="hc-secondary" onClick={()=>setTab('전화')}>새 통화 시작</button></section><section className="hc-panel hc-emptybox"><span>▣</span><h3>영상 대화</h3><p>기존 WebRTC와 VideoCore 영상 기능으로 이동하실 수 있습니다.</p><button className="hc-secondary" onClick={onLegacy}>기존 영상방 열기 →</button></section></div></>}
    {tab==='내 AI'&&<><section className="hc-sectiontitle"><div><span className="hc-overline">MY AI</span><h2>내 AI 설정</h2><p>통화할 때 나를 도울 AI 기능을 직접 선택하십시오.</p></div></section><section className="hc-panel hc-settings"><div className="hc-paneheading"><div><span className="hc-aistar">✦</span><div><h3>개인 AI 어시스턴트</h3><p>기본 통화 보조 기능 설정</p></div></div></div><div className="hc-featurelist">{initialModes.map((name,i)=><button key={name} className="hc-feature" onClick={()=>toggle(name)}><span className="hc-featureicon">{['文','CC','✧','≡'][i]}</span><span className="hc-featuretext"><strong>{name}</strong><small>{['양방향 언어 지원','실시간 음성 텍스트화','정보 검색과 대화 보조','통화 핵심 내용 정리'][i]}</small></span><span className={'hc-toggle '+(enabled.includes(name)?'selected':'')}><i/></span></button>)}</div><p className="hc-previewnote">설정은 현재 화면에서만 유지되는 시제품 상태입니다. 계정 저장 및 AI 실행 엔진 연결은 후속 개발 항목입니다.</p></section></>}
    {tab==='MY'&&<><section className="hc-sectiontitle"><div><span className="hc-overline">MY HITEL</span><h2>MY</h2><p>내 연락처, 통화 기록 및 AI 요약을 관리하는 공간입니다.</p></div></section><div className="hc-twocol"><section className="hc-panel hc-emptybox"><span>◷</span><h3>최근 통화</h3><p>실제 통화 연결 후 기록이 표시됩니다.</p><button className="hc-secondary" onClick={()=>setTab('전화')}>전화하기</button></section><section className="hc-panel hc-emptybox"><span>✦</span><h3>AI 통화 요약</h3><p>통화 요약 데이터가 여기에 정리됩니다.</p><button className="hc-secondary" onClick={()=>setTab('내 AI')}>AI 설정</button></section></div></>}
    {tab==='기관용'&&<><section className="hc-sectiontitle"><div><span className="hc-overline">BUSINESS COMMUNICATION</span><h2>기관 상담 콘솔</h2><p>대표번호와 상담원 사이에 AI를 연결하는 운영 화면입니다.</p></div></section><div className="hc-twocol"><section className="hc-panel hc-emptybox"><span>☎</span><h3>상담 전화 라우팅</h3><p>1588 대표번호·일반전화·웹 연결의 AI 중계와 상담원 전환을 관리할 예정입니다.</p></section><section className="hc-panel hc-emptybox"><span>▦</span><h3>상담 운영 현황</h3><p>상담 대기, 상담 진행, 통화 요약 및 기록 화면을 준비했습니다.</p></section></div></>}
    {message&&<div className="hc-toast" role="alert"><span>ⓘ</span>{message}<button aria-label="닫기" onClick={()=>setMessage('')}>×</button></div>}
   </main>
  </div>
 </div>;
}
