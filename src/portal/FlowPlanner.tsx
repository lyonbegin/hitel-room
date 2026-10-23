import { useState } from 'react';
import { getScenario, modeLabels, order, scenarios, supportedUi, type FlowStep, type LinkMode } from './flowCatalog';
import './FlowPlanner.css';

const phases:FlowStep[]=['select','ringing','connecting','active'];
const stepLabels: Record<FlowStep,string>={
  select:'상대 찾기',ringing:'발신·수신',connecting:'미디어 연결',active:'통화 중 AI',
};
function PersonView({role,mode,step,aiLabel}:{role:'caller'|'receiver',mode:LinkMode,step:FlowStep,aiLabel:string}){
  const isPlain=mode==='P';
  const isPstn=mode==='P_PLUS';
  return <div className="fx-person">
    <div className="fx-person-title"><span className="fx-avatar">{role==='caller'?'↗':'↙'}</span><div><b>{role==='caller'?'발신자':'수신자'}</b><small>{modeLabels[mode]}</small></div></div>
    <div className="fx-phone">
      <div className="fx-phone-top"><span>HITEL</span><span>{isPlain?'일반 전화':isPstn?'전화 + 도우미':'인터넷 통화'}</span></div>
      {isPlain ? <div className="fx-plain"><span className="fx-symbol">☎</span><b>기존 전화 사용</b><small>하이텔 화면 없음</small></div> :
      <div className="fx-phone-body">
        <b>{step==='select'?'상대방 찾기':step==='ringing'?(role==='caller'?'통화 요청':'수신 알림'):step==='connecting'?'통신 연결 확인':'대화 진행 중'}</b>
        {isPstn?<div className="fx-visual">기존 일반전화 음성<br/><strong>HITEL 개인 AI 패널</strong></div>:<div className="fx-visual fx-web">음성 · 영상 연결 영역<br/><strong>{mode==='N'?'앱 WebView':'모바일 브라우저'}</strong></div>}
        <div className="fx-chat"><span>대화 자막 / 번역</span><span>자료 · 메모 · 검색</span></div>
        <div className="fx-private">🔒 {aiLabel}</div>
      </div>}
    </div>
    <div className="fx-ui">{supportedUi(mode)}</div>
  </div>;
}

export default function FlowPlanner(){
  const [from,setFrom]=useState<LinkMode>('P_PLUS');
  const [to,setTo]=useState<LinkMode>('P');
  const [step,setStep]=useState<FlowStep>('select');
  const selected=getScenario(from,to);
  const stepIndex=phases.indexOf(step);
  function choose(a:LinkMode,b:LinkMode){setFrom(a);setTo(b);setStep('select');}
  const hasAIFrom=from!=='P',hasAITo=to!=='P';
  return <main className="fx-root">
    <header className="fx-header"><div><strong>HITEL</strong><span>16 CONNECTION FLOWS · FRONTEND BLUEPRINT</span></div><a href="/portal">기존 포털 ↗</a></header>
    <div className="fx-hero"><span>FRONTEND PRODUCT SPECIFICATION</span><h1>16개 연결 방식,<br/>하나의 대화 화면.</h1><p>발신과 수신 형태를 선택하면 각자의 화면, 실제 미디어 경로, 개인 AI의 표시 위치를 확인할 수 있습니다.</p><div className="fx-notice">기획 시뮬레이션 — 실제 전화·WebRTC 연결이나 문자 발송은 하지 않습니다.</div></div>
    <section className="fx-section">
      <div className="fx-section-heading"><h2>01 · 발신자 × 수신자</h2><span>4 × 4 = 16가지</span></div>
      <div className="fx-matrix-scroll"><table className="fx-matrix"><thead><tr><th>발신 ↓ / 수신 →</th>{order.map(mode=><th key={mode}>{modeLabels[mode]}<small>{mode}</small></th>)}</tr></thead><tbody>{order.map(a=><tr key={a}><th>{modeLabels[a]}<small>{a}</small></th>{order.map(b=>{const s=getScenario(a,b);return <td key={a+'-'+b}><button type="button" className={from===a&&to===b?'fx-picked':''} aria-pressed={from===a&&to===b} onClick={()=>choose(a,b)}><b>{String(s.id).padStart(2,'0')}</b><small>{s.title}</small></button></td>})}</tr>)}</tbody></table></div>
    </section>
    <section className="fx-section">
      <div className="fx-section-heading"><div><output className="fx-tag" key={selected.id} aria-live="polite" data-testid="selected-scenario-number">SCENARIO {String(selected.id).padStart(2,'0')}</output><h2>{selected.title}</h2></div><span>{selected.from} → {selected.to}</span></div>
      <div className="fx-tabs">{phases.map((p,i)=><button type="button" aria-pressed={step===p} className={step===p?'fx-tab-current':''} key={p} onClick={()=>setStep(p)}><span>{i+1}</span>{stepLabels[p]}</button>)}</div>
      <div className="fx-screen-grid"><PersonView role="caller" mode={from} step={step} aiLabel={hasAIFrom?'발신자에게만 보이는 AI':'AI 없음'}/><PersonView role="receiver" mode={to} step={step} aiLabel={hasAITo?'수신자에게만 보이는 AI':'AI 없음'}/></div>
      <div className="fx-nav"><button type="button" onClick={()=>setStep(phases[Math.max(0,stepIndex-1)])} disabled={stepIndex===0}>← 이전 화면</button><button type="button" onClick={()=>setStep(phases[Math.min(phases.length-1,stepIndex+1)])} disabled={stepIndex===phases.length-1}>다음 화면 →</button></div>
    </section>
    <section className="fx-section">
      <div className="fx-section-heading"><h2>02 · 실제 연결과 UI 동선</h2></div>
      <div className="fx-details">
        <div><span>발신자 화면·행동</span><p>{selected.callerAction}</p></div>
        <div><span>수신자 화면·행동</span><p>{selected.receiverAction}</p></div>
        <div><span>실제 음성 전달 경로</span><p>{selected.mediaRoute}</p></div>
        <div><span>연결을 위한 조건</span><p>{selected.prerequisite}</p></div>
        <div><span>개인 AI 제공</span><p>{selected.ai}</p></div>
        <div><span>기술 조건</span><p>{selected.caveat||'각 참가자의 통화 미디어 접근 권한에 따라 기능을 제공합니다.'}</p></div>
      </div>
    </section>
    <section className="fx-section">
      <div className="fx-section-heading"><h2>03 · 16개 통화를 위한 공통 화면</h2></div>
      <div className="fx-workspace">
        <div className="fx-workspace-head"><strong>통화 상대방 · 참가자 상태</strong><small>일반전화 / WebRTC / 영상 / AI 참가자</small></div>
        <div className="fx-workspace-main"><div className="fx-workspace-timeline"><span>실제 미디어 경로에 맞춰 표시</span><h3>통화 및 실시간 대화</h3><p>영상 타일 또는 전화 아이콘 · 발언 기록 · 검수된 번역문 · 수어 입력</p><div className="fx-workspace-controls">🎙 오디오 제어　📷 영상　⌨ 문자 입력　☎ 통화 종료</div></div><div className="fx-workspace-ai"><span>🔒 상대방에게 보이지 않음</span><h3>나만의 AI</h3><p>실시간 자막 · 통역 · 업종별 지식 · 메모 · 다음 질문</p><div className="fx-speech"><b>내게 읽어주기</b><b>상대에게 전달하기*</b></div><small>* 실제 음성 송신 경로가 연결되었을 때만 활성</small></div></div>
      </div>
    </section>
    <footer className="fx-footer"><a href="https://github.com/lyonbegin/hitel-room/blob/feature/mobile-native/docs/frontend-16-scenarios.md" target="_blank" rel="noopener noreferrer">전체 UX·라우팅 기획서 ↗</a><span>설계 화면 · 실제 서비스 통화 아님</span></footer>
  </main>;
}
