/* HITEL/Zocbo browser integration. Public document identifiers taken from
 * 2026-11-08 official HTML; original app XAPK SHA-256 verified in separate report.
 * NEVER handles user credentials or download tokens. Auth/file operations happen
 * only on *.zocbo.com. No third-party cookie copying or protected API access.
 */
(function(){
'use strict';
const PATHS={
 app:'https://m.zocbo.com/app/main_v2.asp',
 home:'https://m.zocbo.com/',
 login:'https://m.zocbo.com/Member/login.asp',
 middle:'https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=MT',
 high:'https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000020000200003&siteid=H&subject_cd=MT',
 middleConcept:'https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000010000100001&siteid=M&subject_cd=MT',
 highConcept:'https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000020000100001&siteid=H&subject_cd=MT',
 middleExpected:'https://m.zocbo.com/M/expected.asp',
 highExpected:'https://m.zocbo.com/H/expected.asp',
 freeReading:'https://m.zocbo.com/Freetrial/FreeReading.asp',
 freeReadingWeb:'https://m.zocbo.com/exam/school/previousexam.asp?search_webview=Y',
 finals:'https://m.zocbo.com/event/pre-test2026d/',
 diagnostic:'https://m.zocbo.com/Freetrial/learningtest.asp',
 revision:'https://m.zocbo.com/guide/revision/default_M.asp',
 memberBenefits:'https://m.zocbo.com/Freetrial/main_s.asp',
};
const ROADMAP={bankHome:{title:'문제은행',route:'app',label:'족보닷컴 원본 모바일 홈'},
 bankSearch:{title:'문제 검색',route:'middle',label:'단원별 학습 · 시험자료 검색'},
 bankResults:{title:'실제 공개자료 검색 결과',route:'finals',label:'2026 기말고사 무료자료'},
 bankPaper:{title:'시험자료 상세',route:'finals',label:'실제 공개자료 상세'},
 bankOriginal:{title:'족보닷컴 원본 화면',route:'app',label:'실제 모바일 WebView'},
 bankLogin:{title:'족보닷컴 로그인',route:'login',label:'공식 계정 로그인'},
 bankSchool:{title:'학교별 시험 자료',route:'middleExpected',label:'학교별 맞춤학습'},
 bankFree:{title:'기출 무료열람실',route:'freeReading',label:'공식 학교별 기출 뷰어'},
 bankDownload:{title:'공식 자료 다운로드',route:'finals',label:'실제 자료 원본 사이트'},
 bankSaved:{title:'내 자료 책갈피',route:'finals',label:'브라우저에 저장된 자료 제목'},
 bankDiagnostic:{title:'성적 진단평가',route:'diagnostic',label:'공식 진단평가'},
 bankCategory:{title:'문제 유형별 학습',route:'middle',label:'공식 학습 유형 선택'}
};
for(const [id,meta] of Object.entries(ROADMAP)){
 window.YPT_GRAPH[id]={title:meta.title,evidence:[],officialUrl:PATHS[meta.route],actions:[{text:'문제은행 홈',go:'bankHome'},{text:'실제 자료 검색',go:'bankSearch'},{text:'공식 로그인',go:'bankLogin'}]};
}
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
function stateOf(s){return s.zocbo||(s.zocbo={grade:'전체',query:'',subject:'전체',paperId:null,viewUrl:PATHS.app,sourceKey:'app',saved:readSaved()});}
function readSaved(){try{const data=JSON.parse(localStorage.getItem('hitel.zocbo.saved.v1')||'[]');return Array.isArray(data)?data.filter(id=>typeof id==='string'&&(window.ZOCBO_CATALOG||[]).some(r=>r.id===id)).slice(0,200):[]}catch{return []}}
function writeSaved(saved){try{localStorage.setItem('hitel.zocbo.saved.v1',JSON.stringify(saved))}catch{}}
function subjectListUrl(r){if(!r||!['M','H'].includes(r.siteid)||!/^[A-Z0-9]{2,5}$/.test(r.subject_cd))return PATHS.home;const u=new URL(r.siteid==='H'?PATHS.high:PATHS.middle);u.searchParams.set('subject_cd',r.subject_cd);return u.href}
function chosenOriginalSearch(s){const z=stateOf(s),all=window.ZOCBO_CATALOG||[];if(z.grade==='전체'&&z.subject==='전체')return PATHS.home;const r=all.find(x=>(z.grade==='전체'||x.grade===z.grade)&&(z.subject==='전체'||x.subject===z.subject));return r?subjectListUrl(r):PATHS.home;}
function isOfficial(url){try{const x=new URL(url);return x.protocol==='https:'&&(x.hostname==='m.zocbo.com'||x.hostname==='sign.zocbo.com'||x.hostname==='zocbo.com');}catch{return false}}
function pageUrl(s,fallback='app'){
 const z=stateOf(s),raw=z.viewUrl;
 return raw&&isOfficial(raw)?raw:PATHS[fallback];
}
function link(url,label,cl='zb-link',same=false){if(!isOfficial(url))return '';
 return `<a class="${cl}" href="${esc(url)}" target="${same?'_self':'_blank'}" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;}
function switcher(){return `<div class="zb-shortcuts"><button data-go="bankHome">문제은행 홈</button><button data-go="bankSearch">자료 검색</button><button data-go="bankSchool">학교별</button><button data-go="bankFree">무료 열람</button><button data-go="bankDownload">다운로드</button><button data-go="bankSaved">책갈피</button></div>`;}
function subtitle(s){return '';}
function segment(s){const z=stateOf(s),items=(window.ZOCBO_CATALOG||[]).filter(x=>z.grade==='전체'||x.grade===z.grade),subjects=[...new Set(items.map(x=>x.subject))];return `<div class="zb-grades">${['전체','중1','중2','중3','고1','고2'].map(g=>`<button type="button" data-action="zbGrade" data-value="${g}" class="${z.grade===g?'on':''}">${g}</button>`).join('')}</div><div class="zb-subject-choices" aria-label="과목 선택">${['전체',...subjects].map(sub=>`<button type="button" data-action="zbSubject" data-value="${esc(sub)}" class="${z.subject===sub?'on':''}">${esc(sub)}</button>`).join('')}</div>`}
function catalog(s){
 const z=stateOf(s),list=window.ZOCBO_CATALOG||[];
 let q=z.query.trim().toLocaleLowerCase('ko-KR');
 return list.filter(x=>(z.grade==='전체'||x.grade===z.grade)&&(z.subject==='전체'||x.subject===z.subject)&&(!q||[x.title,x.grade,x.subject,x.siteid].join(' ').toLocaleLowerCase('ko-KR').includes(q)));
}
function results(s,limit=100){const list=catalog(s).slice(0,limit);const total=window.ZOCBO_CATALOG?.length||0;
 return `<div class="zb-list-head"><b>공식 공개자료 ${list.length}건</b><small>확보한 2026 기말고사 목록 ${total}건 중</small></div>
 ${list.length?list.map(r=>`<div class="zb-paper-card" data-z-grade="${esc(r.grade)}">
 <button class="zb-paper-main" data-action="zbPick" data-id="${esc(r.id)}"><span class="zb-paper-icon">▤</span><span class="zb-paper-caption"><b>${esc(r.title)}</b><small>${esc(r.grade)} · ${esc(r.subject)} · 공식 공개 다운로드 목록</small></span><span>›</span></button>
 <div class="zb-paper-actions"><button data-action="zbPick" data-id="${esc(r.id)}">상세 보기</button>${link(r.source,'원본 다운로드 화면','zb-action-link')}</div></div>`).join(''):`<div class="zb-no-results">현재 확보한 공개자료 목록에서 일치하는 항목이 없습니다.<br/>전체 문제 검색은 족보닷컴 공식 검색으로 이동해 주세요.</div>`}`;
}
function searched(s){const z=stateOf(s);return `${subtitle(s)}${switcher()}
 <div class="zb-search"><span aria-hidden="true">⌕</span><input type="search" data-zb-input="query" value="${esc(z.query)}" placeholder="과목·학년·자료 제목 검색" aria-label="실제 공개자료 검색"/><button data-action="zbReset">지우기</button></div>
 ${segment(s)}<p class="zb-meta">족보닷컴 홈페이지에 공개된 자료명만 검색합니다. 원본 전체 학습자료 검색은 아래 공식 화면에서 이어집니다.</p>
 ${results(s)}
 <div class="zb-external-bar"><strong>전체 문제·단원별 학습</strong><p>원본 서비스의 학년·과목·단원 선택을 그대로 사용합니다.</p>
 ${link(chosenOriginalSearch(s),'선택한 과목의 원본 문제 목록 열기','zb-primary-link',false)}${link(chosenOriginalSearch(s),'같은 창에서 열기','zb-link',true)}</div>`;}
function home(s){return `${subtitle(s)}
 <div class="zb-banner"><img src="/zocbo-assets/app-icon.png" alt="족보닷컴 원본 앱 아이콘" onerror="this.style.display='none'"><div><small>족보닷컴과 연결된 시험 대비</small><h2>문제은행</h2><p>학교·학년·과목 선택부터 자료 열람·다운로드까지</p></div></div>
 <div class="zb-search-launch" data-go="bankSearch" role="button" tabindex="0">⌕ &nbsp;과목·학교별 기출·예상 문제 검색 <span>›</span></div>
 <div class="zb-grid">
 <button data-go="bankSearch"><span>⌕</span><b>문제 검색</b><small>공개자료 35건</small></button>
 <button data-go="bankSchool"><span>♙</span><b>학교별 맞춤</b><small>실제 학교 선택</small></button>
 <button data-go="bankFree"><span>▣</span><b>무료 기출열람</b><small>공식 뷰어</small></button>
 <button data-go="bankDownload"><span>↓</span><b>시험자료 다운로드</b><small>공식 다운로드</small></button>
 </div>
 <div class="zb-section-title"><b>2026년 2학기 기말고사 공개자료</b><button data-go="bankResults">전체 보기 ›</button></div>
 ${results(s,3)}
 <div class="zb-section-title"><b>문제은행 주요 기능</b></div>
 ${[['중등 단원별 문제',PATHS.middle],['고등 단원별 문제',PATHS.high],['중등 학교별 맞춤학습',PATHS.middleExpected],['고등 학교별 맞춤학습',PATHS.highExpected],['성적 진단평가',PATHS.diagnostic],['시험 직전 대비',PATHS.revision]].map(([t,u])=>`<div class="zb-feature-row"><span>▦</span><b>${esc(t)}</b>${link(u,'원본 열기','zb-action-link')}</div>`).join('')}
 <div class="zb-footer-primary">${link(PATHS.login,'족보닷컴 로그인 · 새 탭','zb-primary-link',false)}${link(PATHS.app,'원본 앱 화면','zb-link',false)}<button data-go="bankSaved" class="zb-bookmark-button">내 자료 책갈피</button></div>`;}
function detail(s){const z=stateOf(s),r=(window.ZOCBO_CATALOG||[]).find(x=>x.id===z.paperId);
 if(!r)return `${subtitle(s)}<p>선택된 자료가 없습니다.</p><button class="button-solid" data-go="bankSearch">검색으로 돌아가기</button>`;
 return `${subtitle(s)}<div class="zb-detail-head"><span class="zb-kicker">2026년 2학기 기말고사</span><h3>${esc(r.title)}</h3><p>${esc(r.grade)} · ${esc(r.subject)} · 과목 코드 ${esc(r.subject_cd)}</p></div>
 <div class="zb-detail-card"><div><span>자료 제공</span><b>족보닷컴</b></div><div><span>다운로드 방식</span><b>공식 사이트 계정으로 진행</b></div><div><span>학년</span><b>${esc(r.grade)}</b></div><div><span>원본 처리</span><b>과목별 시험범위 선택 후 다운로드</b></div></div>
 <div class="zb-external-bar"><strong>원본 자료를 바로 확인하세요</strong><p>공식 행사 페이지에서 <b>${esc(r.grade)} · ${esc(r.subject)}</b> 행의 다운로드 버튼을 선택하십시오. 각 자료의 개별 파일 주소는 공개되어 있지 않으므로 이 버튼을 자동 실행하거나 다운로드 성공이라고 표시하지 않습니다.</p>
 ${link(r.source,'공식 자료 다운로드 페이지 열기 · 새 탭','zb-primary-link',false)}${link(subjectListUrl(r),'해당 과목 전체 문제 목록','zb-link',false)}${link(r.source,'같은 창에서 원본 열기','zb-link',true)}</div>
 <div class="zb-detail-actions"><button data-action="zbRemember" data-id="${esc(r.id)}">${(z.saved||[]).includes(r.id)?'책갈피 해제':'제목 책갈피에 추가'}</button><button data-go="bankResults">자료 목록</button></div>${embeddedOfficial(r.source,'족보닷컴 공식 자료 보기·다운로드')}`;
}
function embeddedOfficial(url,description='족보닷컴 공식 화면'){
 if(!isOfficial(url))return '<p>확인된 족보닷컴 주소가 아닙니다.</p>';
 // Official mobile site is the primary iframe content, not a link-only placeholder.
 return `<section class="zb-embedded-page" aria-label="${esc(description)}">
   <div class="zb-webview-toolbar">
      <span class="zb-site-origin"><span class="zb-site-lock" aria-hidden="true">▣</span>m.zocbo.com</span>
      <button type="button" data-action="zbReloadWebview" title="새로고침" aria-label="족보닷컴 화면 새로고침">⟳</button>
      ${link(url,'공식 사이트 새 탭으로 열기','zb-open-full',false)}${link(url,'현재 창에서 열기','zb-open-full',true)}
   </div>
   <div class="zb-iframe-wrap"><iframe class="zb-live-iframe" title="${esc(description)}" src="${esc(url)}" loading="eager" referrerpolicy="strict-origin-when-cross-origin" allow="fullscreen"></iframe></div>
   <div class="zb-iframe-fallback" role="note">화면이 비어 있으면 족보닷컴 서버의 외부 iframe 차단 설정일 수 있습니다. 위 '전체 화면 열기'는 동일한 원본 주소를 엽니다.</div>
 </section>`;
}
function savedPage(s){const z=stateOf(s),data=(window.ZOCBO_CATALOG||[]).filter(r=>(z.saved||[]).includes(r.id));return `${switcher()}<div class="zb-section-title"><b>내 자료 책갈피</b></div><p class="zb-meta">자료 제목과 식별자만 이 브라우저에 저장됩니다. 원본 파일·계정 정보는 저장하지 않습니다.</p>${data.length?data.map(r=>`<div class="zb-paper-card"><button class="zb-paper-main" data-action="zbPick" data-id="${esc(r.id)}"><span class="zb-paper-icon">▤</span><span class="zb-paper-caption"><b>${esc(r.title)}</b><small>${esc(r.grade)} · ${esc(r.subject)}</small></span><span>›</span></button></div>`).join(''):`<div class="zb-no-results">저장된 자료가 없습니다. 자료 상세에서 책갈피를 추가할 수 있습니다.</div>`}</div>`}
function original(s){return embeddedOfficial(pageUrl(s),'족보닷컴 원본 모바일 WebView');}
function officialShortcut(title,explain,u,s){const appOnly=u===PATHS.freeReading;const viewer=appOnly?PATHS.freeReadingWeb:u;return `<div class="zb-external-bar"><strong>${esc(title)}</strong><p>${esc(explain)}</p>${appOnly?`<p>앱 전용 링크는 스마트폰에서 족보닷컴 앱 실행 화면으로 이동합니다. 웹에서는 별도의 공식 웹 뷰어 주소를 사용합니다.</p>${link(u,'족보닷컴 앱에서 열기','zb-link',false)}${link(viewer,'공식 웹 뷰어로 열기','zb-primary-link',false)}`:link(viewer,'로그인·자료 열람을 새 탭에서 진행','zb-primary-link',false)}${link(viewer,'같은 창에서 열기','zb-link',true)}</div>${embeddedOfficial(viewer,title)}`;}
function categories(s){return `${subtitle(s)}${switcher()}<div class="zb-section-title"><b>원본 문제은행 서비스 메뉴</b></div>${[
 ['중등 개념학습',PATHS.middleConcept],['중등 단원별 문제',PATHS.middle],['고등 개념학습',PATHS.highConcept],['고등 단원별 문제',PATHS.high],['학교별 예상족보 · 중등',PATHS.middleExpected],['학교별 예상족보 · 고등',PATHS.highExpected],['학교별 기출 무료 열람',PATHS.freeReading],['2026 기말고사 무료 자료',PATHS.finals],['성적 진단평가',PATHS.diagnostic],['직전 대비',PATHS.revision]
 ].map(([label,url])=>`<div class="zb-feature-row"><span>▣</span><b>${esc(label)}</b>${link(url,'실제 화면','zb-action-link')}</div>`).join('')}`}
function page(id,s){switch(id){case 'bankHome':return home(s);case 'bankSearch':case 'bankResults':return searched(s);case 'bankPaper':return detail(s);case 'bankOriginal':return original(s);case 'bankSaved':return savedPage(s);case 'bankSchool':return officialShortcut('학교별 맞춤학습','학교·학년·과목·시험 단원 선택 후 실제 예상족보를 열람합니다.',stateOf(s).grade.startsWith('고')?PATHS.highExpected:PATHS.middleExpected,s);case 'bankFree':return officialShortcut('무료 기출 열람실','족보닷컴 앱 전용 뷰어가 실행될 수 있습니다. 학교 선택 후 기출을 열람합니다.',PATHS.freeReading,s);case 'bankDownload':return officialShortcut('공식 자료 다운로드','원본 행사 페이지에서 학년·과목을 선택한 뒤 로그인 상태와 이용 자격에 따라 다운로드를 진행합니다.',PATHS.finals,s);case 'bankLogin':return officialShortcut('족보닷컴 로그인','원본 로그인 화면에서 로그인하여 회원·이용권 기능을 확인합니다.',PATHS.login,s);case 'bankDiagnostic':return officialShortcut('성적진단평가','학년·과목·출판사 선택 후 공식 서비스에서 응시합니다.',PATHS.diagnostic,s);case 'bankCategory':return categories(s);default:return ''}}
function onAction(act,el,s,go,render,toast){let z=stateOf(s);if(act==='zbGrade'){z.grade=el.dataset.value||'전체';z.subject='전체';render();return}if(act==='zbSubject'){z.subject=el.dataset.value||'전체';render();return}if(act==='zbReset'){z.query='';render();return}if(act==='zbPick'){z.paperId=el.dataset.id;go('bankPaper');return}if(act==='zbViewOfficial'){let u=el.dataset.urlkey?PATHS[el.dataset.urlkey]:el.dataset.url;if(u&&isOfficial(u)){z.viewUrl=u;go('bankOriginal');return}toast('공식 주소를 확인할 수 없습니다.');return}if(act==='zbReloadWebview'){const iframe=document.querySelector('#phone .zb-live-iframe');if(iframe){const src=iframe.getAttribute('src');iframe.setAttribute('src',src);}return}if(act==='zbRemember'){z.paperId=el.dataset.id;z.saved=z.saved||[];if(z.saved.includes(z.paperId)){z.saved=z.saved.filter(id=>id!==z.paperId)}else z.saved.push(z.paperId);writeSaved(z.saved);render();toast('자료 제목 책갈피를 저장했습니다. 실제 파일은 다운로드하지 않았습니다.');return}}
function onInput(evt,s){const el=evt.target;if(el.dataset.zbInput!=='query')return;stateOf(s).query=el.value;const all=window.ZOCBO_CATALOG||[],z=stateOf(s),q=z.query.toLocaleLowerCase('ko-KR');let count=0;document.querySelectorAll('#phone .zb-paper-card').forEach(div=>{const id=div.querySelector('button[data-id]')?.dataset.id;const row=all.find(r=>r.id===id);const ok=!!row&&(!q||[row.title,row.grade,row.subject].join(' ').toLocaleLowerCase('ko-KR').includes(q));div.hidden=!ok;if(ok)count++});const elCount=document.querySelector('#phone .zb-list-head b');if(elCount)elCount.textContent='공식 공개자료 '+count+'건';}
window.ZOCBOUI={PATHS,ROADMAP,page,onAction,onInput,isOfficial,subjectListUrl,chosenOriginalSearch};
})();