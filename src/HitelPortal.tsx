import { useMemo, useState } from 'react';
import './portal.css';

type TargetType = '전화' | '대화방' | '기관';
type Item = {
  id: string;
  type: TargetType;
  title: string;
  description: string;
  category: string;
  number?: string;
  tags: string[];
  example?: boolean;
};
type Props = {
  onPhone: (number?: string) => void;
  onFind: () => void;
  onChat: () => void;
  onAI: () => void;
  onBusiness: () => void;
  onVideo: () => void;
};
const targets: Item[] = [
  { id:'health', type:'기관', title:'국민건강보험공단', category:'건강·복지', number:'1577-1000', description:'건강보험 관련 문의 및 민원 안내',tags:['건강보험','공공기관','상담전화'] },
  { id:'gov', type:'기관', title:'정부민원안내 110', category:'행정·민원', number:'110', description:'정부 민원 안내 및 관련 기관 연결',tags:['공공기관','행정','대표번호'] },
  { id:'welfare', type:'기관', title:'보건복지상담센터 129', category:'건강·복지', number:'129', description:'보건·복지 제도 및 서비스 상담',tags:['복지','공공기관','상담전화'] },
  { id:'talk', type:'대화방', title:'자유 대화방', category:'친구·모임', description:'여러 사람이 함께 음성 또는 영상으로 이야기하는 공간',tags:['자유대화','모임'],example:true },
  { id:'language', type:'대화방', title:'외국어 회화방', category:'교육·학습',description:'외국어 회화와 언어 교류를 위한 주제형 대화방',tags:['외국어','통역'],example:true },
  { id:'topic', type:'대화방', title:'주제 토론방', category:'문화·취미',description:'관심사가 같은 사람들이 의견을 나누는 대화방',tags:['토론','취미'],example:true },
];
const categories=[
  {icon:'☎',name:'전체 전화',query:'전화'}, {icon:'♧',name:'행정·민원',query:'행정·민원'},
  {icon:'♡',name:'건강·복지',query:'건강·복지'}, {icon:'▦',name:'기업·상담',query:'기업·상담'},
  {icon:'♙',name:'친구·모임',query:'친구·모임'}, {icon:'▤',name:'교육·학습',query:'교육·학습'},
  {icon:'☷',name:'문화·취미',query:'문화·취미'}, {icon:'⌘',name:'전체 분야',query:'전체'}
];
const menu=['전체','전화','대화방','기관','사람'] as const;
type Menu=(typeof menu)[number];
const popular=['공공기관 상담','자유 대화방','통역 통화','보건복지','외국어 회화'];
const typeText=(x:Item)=>x.type==='대화방'?'대화방':x.number?'대표전화':'연결 정보';

export default function HitelPortal({onPhone,onFind,onChat,onAI,onBusiness,onVideo}:Props){
  const [keyword,setKeyword]=useState('');
  const [searching,setSearching]=useState(false);
  const [menuValue,setMenuValue]=useState<Menu>('전체');
  const [selectedCategory,setSelectedCategory]=useState('전체');
  const [dial,setDial]=useState('');
  const [notice,setNotice]=useState('');
  const isFiltering=searching || menuValue!=='전체'||selectedCategory!=='전체';
  const matches=useMemo(()=>{
    const q=keyword.trim().toLocaleLowerCase('ko-KR');
    return targets.filter(item=>{
      const byTerm=!q||[item.title,item.description,item.category,item.number||'',...item.tags].join(' ').toLocaleLowerCase('ko-KR').includes(q);
      const byMenu=menuValue==='전체'||(menuValue==='전화'?Boolean(item.number):menuValue==='사람'?false:item.type===menuValue);
      const byCategory=selectedCategory==='전체'||(selectedCategory==='전화'?Boolean(item.number):item.category===selectedCategory);
      return byTerm&&byMenu&&byCategory;
    });
  },[keyword,menuValue,selectedCategory]);
  const search=(term?:string)=>{if(term!==undefined)setKeyword(term);setSearching(true);setSelectedCategory('전체');};
  const reset=()=>{setKeyword('');setSearching(false);setMenuValue('전체');setSelectedCategory('전체');setNotice('');};
  const chooseCategory=(value:string)=>{setSearching(false);setKeyword('');setSelectedCategory(value);setMenuValue('전체');};
  const chooseMenu=(value:Menu)=>{setSearching(false);setKeyword('');setSelectedCategory('전체');setMenuValue(value);};
  const open=(item:Item)=>{if(item.number)onPhone(item.number);else onVideo();};
  const dialNow=()=>{if(!dial.trim()){setNotice('전화번호를 입력해 주십시오.');return;}onPhone(dial.trim());};
  return <div className="hp-home">
   <header className="hp-topline"><div className="hp-container hp-topinside"><span>HITEL 커뮤니케이션 포털</span><div><button onClick={onChat}>내 대화</button><button onClick={onAI}>내 AI</button><button onClick={onBusiness}>기업·기관용</button><span className="hp-proto">서비스 UI 시제품</span></div></div></header>
   <div className="hp-container">
    <section className="hp-searchhead">
     <button className="hp-brand" onClick={reset} aria-label="하이텔 홈"><span className="hp-brandicon">H</span><span>HITEL<small>COMMUNICATION PORTAL</small></span></button>
     <form className="hp-searchform" onSubmit={e=>{e.preventDefault();search();}}><input aria-label="통합 검색" placeholder="전화번호, 기관, 사람, 대화방을 검색하십시오" value={keyword} onChange={e=>setKeyword(e.target.value)}/>{keyword&&<button type="button" className="hp-clear" aria-label="검색어 지우기" onClick={()=>{setKeyword('');setSearching(false);}}>×</button>}<button className="hp-searchsubmit" type="submit"><span>⌕</span> 검색</button></form>
     <button className="hp-create" onClick={onVideo}><span>＋</span> 대화방 만들기</button>
    </section>
    <nav className="hp-nav" aria-label="포털 서비스 분류">
     {menu.map(n=><button key={n} className={menuValue===n?'hp-navselected':''} onClick={()=>chooseMenu(n)}>{n==='전체'?'통합':n==='기관'?'기관·상담':n==='사람'?'사람 찾기':n==='전화'?'전화번호':n}</button>)}
     <span className="hp-navspacer"/>
     <button onClick={()=>onPhone()}>전화 걸기 ↗</button><button onClick={onVideo}>영상방 ↗</button><button onClick={onAI}>AI 통화 설정 ↗</button>
    </nav>
    {!isFiltering&&<><div className="hp-keywords"><b>바로 찾기</b>{popular.map(s=><button key={s} onClick={()=>search(s)}>{s} <span>↗</span></button>)}</div>
     <section className="hp-directory"><div className="hp-minititle"><strong>분야별 연결 찾기</strong><small>전화번호 · 공개 대화방 · 상담 연결</small></div><div className="hp-categories">{categories.map(c=><button key={c.name} onClick={()=>chooseCategory(c.query)}><span>{c.icon}</span><b>{c.name}</b></button>)}</div></section></>}
    <div className="hp-columns">
     <div className="hp-maincol">
      {isFiltering&&<section className="hp-resultshead"><div><small>HITEL CONNECT SEARCH</small><h2>{keyword.trim()?'“'+keyword+'” 검색 결과':menuValue!=='전체'?menuValue+' 연결 목록':selectedCategory+' 연결 목록'}</h2><p>웹페이지 대신 전화와 대화방으로 연결하는 검색 결과입니다.</p></div><button onClick={reset}>전체 메인으로 →</button></section>}
      <section className="hp-section">
       <div className="hp-titleline"><div><span className="hp-titlebar"/><h2>{isFiltering?'연결 대상': '바로 연결할 수 있는 전화·기관'}</h2></div>{!isFiltering&&<button onClick={()=>chooseMenu('기관')}>기관·상담 전체 보기 →</button>}</div>
       {(isFiltering?matches:targets.filter(x=>Boolean(x.number))).length?
        <div className="hp-list">{(isFiltering?matches:targets.filter(x=>Boolean(x.number))).map(item=>
         <article className="hp-listitem" key={item.id}>
          <div className={'hp-itemicon '+(item.type==='대화방'?'room':'phone')}>{item.type==='대화방'?'▣':'☎'}</div>
          <div className="hp-itemcopy"><div className="hp-itemmeta"><span>{item.category}</span><span>·</span><span>{typeText(item)}</span>{item.example&&<span className="hp-example">구성 예시</span>}</div><h3>{item.title}</h3><p>{item.description}</p><div className="hp-itemtags">{item.tags.slice(0,3).map(t=><span key={t}>#{t}</span>)}</div></div>
          <div className="hp-itemaction">{item.number&&<strong>{item.number}</strong>}<button onClick={()=>open(item)}>{item.number?'전화 걸기':'대화방으로'} <span>→</span></button></div>
         </article>)}</div>
        :<div className="hp-empty"><strong>표시할 연결 대상이 없습니다.</strong><p>현재 검색은 등록된 예시 데이터만 조회합니다. 공개방 및 사람 검색은 서버 색인 연동 후 제공됩니다.</p><button onClick={reset}>전체 목록 보기</button></div>}
       <div className="hp-datanote">대표번호는 예시 디렉터리이며, 방 목록은 UI 구성 예시입니다. 공개방 검색·실시간 참여자 수와 실제 전화 발신은 아직 연결되지 않았습니다.</div>
      </section>
      {!isFiltering&&<section className="hp-section">
       <div className="hp-titleline"><div><span className="hp-titlebar"/><h2>대화방 찾아보기</h2><small>같은 관심사를 가진 사람들과 연결되는 공간</small></div><button onClick={()=>chooseMenu('대화방')}>대화방 전체 보기 →</button></div>
       <div className="hp-roomlist">{targets.filter(x=>x.type==='대화방').map((r,i)=><button className="hp-roomcard" key={r.id} onClick={onVideo}><div className={'hp-roomvisual visual-'+i}><span>{['☏','文','☷'][i]}</span><small>대화방 유형 예시</small></div><strong>{r.title}</strong><small>{r.description}</small><span className="hp-roomlink">기존 영상방 기능 열기 ↗</span></button>)}</div>
       <p className="hp-demoline">현재 기존 영상 서버는 초대 기반 대화방을 지원합니다. 공개 목록과 자유 입장은 추가 구현 대상입니다.</p>
      </section>}
      {!isFiltering&&<section className="hp-section hp-connectintro"><h2>검색의 목적지가 웹페이지가 아닌, 사람과의 연결입니다.</h2><p>HITEL은 전화번호·개인·기업·공공기관·실시간 대화방을 하나의 검색 및 탐색 체계로 묶는 포털입니다. 원하는 대상을 찾은 다음 전화하거나 대화방에 입장하는 것이 기본 동선입니다.</p><div><span>통합 검색</span><b>→</b><span>연결 대상 선택</span><b>→</b><span>전화 또는 룸 입장</span></div></section>}
     </div>
     <aside className="hp-aside">
      <section className="hp-widget"><div className="hp-widgettitle"><h3>빠른 전화 연결</h3><span>☎</span></div><p>번호를 입력하면 기존 전화 설정 화면으로 이동합니다.</p><form className="hp-dialrow" onSubmit={e=>{e.preventDefault();dialNow();}}><input aria-label="전화번호 입력" value={dial} onChange={e=>setDial(e.target.value.replace(/[^0-9+*#-]/g,''))} placeholder="전화번호"/><button type="submit">전화 →</button></form>{notice&&<small className="hp-notice" role="alert">{notice}</small>}</section>
      <section className="hp-widget"><div className="hp-widgettitle"><h3>나의 HITEL</h3><span>◉</span></div><div className="hp-quicklinks"><button onClick={onChat}><span>▤</span>내 대화·통화 기록 <b>›</b></button><button onClick={onAI}><span>✦</span>AI 통화 설정 <b>›</b></button><button onClick={onVideo}><span>▣</span>내 영상 대화방 <b>›</b></button><button onClick={()=>onPhone()}><span>☎</span>전화 걸기 <b>›</b></button></div></section>
      <section className="hp-widget"><div className="hp-widgettitle"><h3>HITEL 연결 서비스</h3><span>⌘</span></div><p>전화·영상·AI 보조가 모두 같은 포털의 연결 기능입니다.</p><div className="hp-widgetactions"><button onClick={onVideo}>영상 대화방</button><button onClick={onBusiness}>상담센터</button><button onClick={onAI}>통역·자막</button><button onClick={onFind}>전화번호 검색</button></div></section>
      <section className="hp-widget hp-guide"><h3>현재 개발 상태</h3><p><b>연결됨</b> 기존 WebRTC 초대 기반 영상방</p><p><b>UI 구현</b> 포털 검색·목록·전화 설정</p><p><b>추가 연동</b> 공개방 색인·전화 게이트웨이·AI 통화</p></section>
     </aside>
    </div>
    <footer className="hp-bottom"><strong>HITEL</strong><span>Communication Portal</span><span>포털 UI 시제품 · 실시간 데이터 연동 준비 중</span></footer>
   </div>
  </div>;
}
