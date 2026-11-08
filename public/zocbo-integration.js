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
 finals:'https://m.zocbo.com/event/pre-test2026d/',
 diagnostic:'https://m.zocbo.com/Freetrial/learningtest.asp',
 revision:'https://m.zocbo.com/guide/revision/default_M.asp',
 memberBenefits:'https://m.zocbo.com/Freetrial/main_s.asp',
};
const ROADMAP={bankHome:{title:'문제은행',route:'app',label:'족보닷컴 원본 모바일 홈'},
 bankSearch:{title:'문제 검색',route:'middle',label:'단원별 학습 · 시험자료 검색'},
 bankResults:{title:'실제 공개자료 검색 결과',route:'finals',label:'2026 기말고사 무료자료'},
 bankPaper:{title:'시험자료 상세',route:'finals',label:'실제 공개자료 상세'},
 bankOfficial:{title:'족보닷컴 원본 화면',route:'app',label:'실제 모바일 WebView'},
 bankLogin:{title:'족보닷컴 로그인',route:'login',label:'공식 계정 로그인'},
 bankSchool:{title:'학교별 시험 자료',route:'middleExpected',label:'학교별 맞춤학습'},
 bankFree:{title:'기출 무료열람실',route:'freeReading',label:'공식 학교별 기출 뷰어'},
 bankDownload:{title:'다운로드·이용 내역',route:'finals',label:'실제 자료 원본 사이트'},
 bankDiagnostic:{title:'성적 진단평가',route:'diagnostic',label:'공식 진단평가'},
 bankCategory:{title:'문제 유형별 학습',route:'middle',label:'공식 학습 유형 선택'}
};
for(const [id,meta] of Object.entries(ROADMAP)){
 window.YPT_GRAPH[id]={title:meta.title,evidence:[],officialUrl:PATHS[meta.route],actions:[{text:'문제은행 홈',go:'bankHome'},{text:'실제 자료 검색',go:'bankSearch'},{text:'공식 로그인',go:'bankLogin'}]};
}
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
function stateOf(s){return s.zocbo||(s.zocbo={grade:'중2',query:'',subject:'전체',paperId:null,viewUrl:PATHS.app,sourceKey:'app'});}
function isOfficial(url){try{const x=new URL(url);return x.protocol==='https:'&&(x.hostname==='m.zocbo.com'||x.hostname==='sign.zocbo.com'||x.hostname==='zocbo.com');}catch{return false}}
function pageUrl(s,fallback='app'){
 const z=stateOf(s),raw=z.viewUrl;
 return raw&&isOfficial(raw)?raw:PATHS[fallback];
}
function link(url,label,cl='zb-link',same=false){if(!isOfficial(url))return '';
 return `<a class="${cl}" href="${esc(url)}" target="${same?'_self':'_blank'}" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;}
function switcher(){return `<div class="zb-shortcuts"><button data-go="bankHome">문제은행 홈</button><button data-go="bankSearch">자료 검색</button><button data-go="bankSchool">학교별</button><button data-go="bankFree">무료 열람</button><button data-go="bankDownload">다운로드</button></div>`;}
function subtitle(s){const z=stateOf(s);return `<div class="zb-subtitle">원본 족보닷컴 4.3.11(2) WebView 경로 · 실제 공식 자료와 연결</div>`;}
function segment(s){const z=stateOf(s);return `<div class="zb-grades">${['전체','중1','중2','중3','고1','고2'].map(g=>`<button type="button" data-action="zbGrade" data-value="${g}" class="${z.grade===g?'on':''}">${g}</button>`).join('')}</div>`}
function catalog(s){
 const z=stateOf(s),list=window.ZOCBO_CATALOG||[];
 let q=z.query.trim().toLocaleLowerCase('ko-KR');
 return list.filter(x=>((z.grade==='전체')||x.grade===z.grade)&&(!q||[x.title,x.grade,x.subject,x.siteid].join(' ').toLocaleLowerCase('ko-KR').includes(q)));
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
 ${link(z.grade.startsWith('고')?PATHS.high:PATHS.middle,'실제 족보닷컴 검색 열기','zb-primary-link',true)}</div>`;}
function home(s){return `${subtitle(s)}
 <div class="zb-banner"><img src="/zocbo-assets/app-icon.png" alt="족보닷컴 원본 앱 아이콘" onerror="this.style.display='none'"><div><small>족보닷컴과 연결된 시험 대비</small><h2>문제은행</h2><p>학교·학년·과목 선택부터 자료 열람·다운로드까지</p></div></div>
 <div class="zb-search-launch" data-go="bankSearch" role="button" tabindex="0">⌕ &nbsp;과목·학교별 기출·예상 문제 검색 <span>›</span></div>
 <div class="zb-grid">
 <button data-go="bankSearch"><span>⌕</span><b>문제 검색</b><small>공개자료 35건</small></button>
 <button data-go="bankSchool"><span>♙</span><b>학교별 맞춤</b><small>실제 학교 선택</small></button>
 <button data-go="bankFree"><span>▣</span><b>무료 기출열람</b><small>공식 뷰어</small></button>
 <button data-go="bankDownload"><span>↓</span><b>시험자료 다운로드</b><small>공식 다운로드</small></button>
 </div>
 <div class="zb-section-title"><b>실제 제공 중인 2학기 기말고사 자료</b><button data-go="bankResults">전체 보기 ›</button></div>
 ${results(s,3)}
 <div class="zb-section-title"><b>문제은행 주요 기능</b></div>
 ${[['중등 단원별 문제',PATHS.middle],['고등 단원별 문제',PATHS.high],['중등 학교별 맞춤학습',PATHS.middleExpected],['고등 학교별 맞춤학습',PATHS.highExpected],['성적 진단평가',PATHS.diagnostic],['시험 직전 대비',PATHS.revision]].map(([t,u])=>`<div class="zb-feature-row"><span>▦</span><b>${esc(t)}</b>${link(u,'원본 열기','zb-action-link')}</div>`).join('')}
 <div class="zb-footer-primary">${link(PATHS.login,'족보닷컴 로그인','zb-primary-link',true)}${link(PATHS.app,'원본 앱 화면','zb-link',true)}</div>`;}
function detail(s){const z=stateOf(s),r=(window.ZOCBO_CATALOG||[]).find(x=>x.id===z.paperId);
 if(!r)return `${subtitle(s)}<p>선택된 자료가 없습니다.</p><button class="button-solid" data-go="bankSearch">검색으로 돌아가기</button>`;
 return `${subtitle(s)}<div class="zb-detail-head"><span class="zb-kicker">2026년 2학기 기말고사</span><h3>${esc(r.title)}</h3><p>${esc(r.grade)} · ${esc(r.subject)} · 과목 코드 ${esc(r.subject_cd)}</p></div>
 <div class="zb-detail-card"><div><span>자료 제공</span><b>족보닷컴</b></div><div><span>다운로드 방식</span><b>공식 사이트 계정으로 진행</b></div><div><span>학년</span><b>${esc(r.grade)}</b></div><div><span>원본 처리</span><b>과목별 시험범위 선택 후 다운로드</b></div></div>
 <div class="zb-external-bar"><strong>원본 자료를 바로 확인하세요</strong><p>실제 문제 본문·시험범위 선택·다운로드는 아래 원본 화면에서 진행됩니다. 로그인·이용권이 필요한 경우 공식 사이트에서 처리합니다.</p>
 ${link(r.source,'원본 자료 보기 및 다운로드','zb-primary-link',true)}</div>
 <div class="zb-detail-actions"><button data-action="zbViewOfficial" data-urlkey="finals">원본 화면 미리보기</button><button data-action="zbRemember" data-id="${esc(r.id)}">내 학습자료에 표시</button><button data-go="bankResults">자료 목록</button></div>`;
}
function original(s){const u=pageUrl(s);return `${subtitle(s)}<div class="zb-official-title"><b>족보닷컴 공식 실화면</b><p>웹에서 차단된 임베딩이나 인증 제한이 있으면 아래 전체 화면 열기를 사용하십시오.</p></div><div class="zb-external-links">${link(u,'같은 창에서 공식 화면 열기','zb-primary-link',true)}${link(PATHS.login,'공식 로그인','zb-link',true)}</div><div class="zb-iframe-wrap"><iframe title="족보닷컴 공식 웹페이지" src="${esc(u)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div><p class="zb-meta">브라우저 보안 설정에 따라 다른 도메인의 페이지가 화면 안에 표시되지 않을 수 있습니다. 로그인 정보는 HITEL로 전달되지 않습니다.</p>`}
function officialShortcut(title,explain,u,s){const z=stateOf(s);return `${subtitle(s)}${switcher()}
 <div class="zb-detail-head"><h3>${esc(title)}</h3><p>${esc(explain)}</p></div>
 <div class="zb-external-bar"><strong>실제 족보닷컴 기능을 사용합니다</strong><p>검색 조건 선택·로그인·자료 보기·다운로드는 원본 화면에서 처리합니다.</p>
 ${link(u,'공식 사이트에서 진행','zb-primary-link',true)}</div><div class="zb-detail-actions"><button data-action="zbViewOfficial" data-url="${esc(u)}">원본 페이지 화면 안에서 열기</button>${link(PATHS.login,'로그인','zb-link',true)}</div>
 <div class="zb-feature-row"><span>↗</span><b>원본 모바일 페이지</b><small>${esc(new URL(u).pathname)}</small></div>`}
function categories(s){return `${subtitle(s)}${switcher()}<div class="zb-section-title"><b>원본 문제은행 서비스 메뉴</b></div>${[
 ['중등 개념학습',PATHS.middleConcept],['중등 단원별 문제',PATHS.middle],['고등 개념학습',PATHS.highConcept],['고등 단원별 문제',PATHS.high],['학교별 예상족보 · 중등',PATHS.middleExpected],['학교별 예상족보 · 고등',PATHS.highExpected],['학교별 기출 무료 열람',PATHS.freeReading],['2026 기말고사 무료 자료',PATHS.finals],['성적 진단평가',PATHS.diagnostic],['직전 대비',PATHS.revision]
 ].map(([label,url])=>`<div class="zb-feature-row"><span>▣</span><b>${esc(label)}</b>${link(url,'실제 화면','zb-action-link')}</div>`).join('')}`}
function page(id,s){switch(id){case 'bankHome':return home(s);case 'bankSearch':case 'bankResults':return searched(s);case 'bankPaper':return detail(s);case 'bankOriginal':return original(s);case 'bankSchool':return officialShortcut('학교별 맞춤학습','학교·학년·과목·시험 단원 선택 후 실제 예상족보를 열람합니다.',stateOf(s).grade.startsWith('고')?PATHS.highExpected:PATHS.middleExpected,s);case 'bankFree':return officialShortcut('무료 기출 열람실','족보닷컴 앱 전용 뷰어가 실행될 수 있습니다. 학교 선택 후 기출을 열람합니다.',PATHS.freeReading,s);case 'bankDownload':return officialShortcut('다운로드 · 시험자료','실제 공식 사이트에서 원본 다운로드·다운로드 내역 확인 기능을 사용합니다.',PATHS.finals,s);case 'bankLogin':return officialShortcut('족보닷컴 로그인','원본 로그인 화면에서 로그인하여 회원·이용권 기능을 확인합니다.',PATHS.login,s);case 'bankDiagnostic':return officialShortcut('성적진단평가','학년·과목·출판사 선택 후 공식 서비스에서 응시합니다.',PATHS.diagnostic,s);case 'bankCategory':return categories(s);default:return ''}}
function onAction(act,el,s,go,render,toast){let z=stateOf(s);if(act==='zbGrade'){z.grade=el.dataset.value||'전체';render();return}if(act==='zbReset'){z.query='';render();return}if(act==='zbPick'){z.paperId=el.dataset.id;go('bankPaper');return}if(act==='zbViewOfficial'){let u=el.dataset.urlkey?PATHS[el.dataset.urlkey]:el.dataset.url;if(u&&isOfficial(u)){z.viewUrl=u;go('bankOriginal');return}toast('공식 주소를 확인할 수 없습니다.');return}if(act==='zbRemember'){z.paperId=el.dataset.id;z.saved=z.saved||[];if(!z.saved.includes(z.paperId))z.saved.push(z.paperId);toast('자료 제목을 내 목록에 표시했습니다. 실제 원본 파일을 저장한 것은 아닙니다.');return}}
function onInput(evt,s){const el=evt.target;if(el.dataset.zbInput!=='query')return;stateOf(s).query=el.value;const all=window.ZOCBO_CATALOG||[],z=stateOf(s),q=z.query.toLocaleLowerCase('ko-KR');let count=0;document.querySelectorAll('#phone .zb-paper-card').forEach(div=>{const id=div.querySelector('button[data-id]')?.dataset.id;const row=all.find(r=>r.id===id);const ok=!!row&&(!q||[row.title,row.grade,row.subject].join(' ').toLocaleLowerCase('ko-KR').includes(q));div.hidden=!ok;if(ok)count++});const elCount=document.querySelector('#phone .zb-list-head b');if(elCount)elCount.textContent='공식 공개자료 '+count+'건';}
window.ZOCBOUI={PATHS,ROADMAP,page,onAction,onInput,isOfficial};
})();