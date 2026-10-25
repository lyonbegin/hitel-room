import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const out=path.resolve(process.cwd(),'ux-audit-results');fs.mkdirSync(out,{recursive:true});
const base=process.env.HITEL_URL||'https://hitel-fusion-web-production.up.railway.app/';
const findings=[],journeys=[],screenshots=[],errors=[];
let browser;
const add=(id,severity,scenario,actual,expected)=>findings.push({id,severity,scenario,actual,expected});
const shot=async(p,id)=>{await p.screenshot({path:path.join(out,id+'.png'),fullPage:true,animations:'disabled',timeout:20000});screenshots.push(id+'.png')};
const test=async(name,fn)=>{try{await fn();journeys.push({name,status:'executed'});}catch(err){const msg=String(err.message||err).slice(0,400);journeys.push({name,status:'failed',error:msg});add('TEST-'+journeys.length,'critical',name,msg,'화면 흐름 확인')}};
try{
browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});
page.on('pageerror',e=>errors.push(String(e.message||e)));
await test('390px 모바일 홈',async()=>{await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});await page.getByText('우리 동네 새로운 글',{exact:true}).waitFor({timeout:20000});await shot(page,'01-home-mobile')});
await test('과외 사용자 역할 전환',async()=>{
 await page.locator('.categories button',{hasText:'과외'}).first().click();
 await page.getByRole('button',{name:'선생님 찾기'}).click();
 const before=await page.locator('.posts .post-copy strong').allTextContents();await shot(page,'02-teacher-find');
 await page.getByRole('button',{name:'학생 찾기'}).click();
 const after=await page.locator('.posts .post-copy strong').allTextContents();await shot(page,'03-student-find');
 if(JSON.stringify(before)===JSON.stringify(after))add('UX-01','critical','과외 역할','선생님 찾기/학생 찾기 게시글이 동일함','역할별 검색 대상·게시글·행동 분리');
});
await test('강사의 수업 제안 폼',async()=>{
 await page.getByRole('button',{name:'뒤로'}).click();
 await page.locator('.post',{hasText:'중2 수학 과외 선생님 찾습니다'}).first().click();await shot(page,'04-tutor-request');
 await page.getByRole('button',{name:'수업 제안',exact:true}).click();await shot(page,'05-tutor-proposal');
 if(await page.getByText('학생 학년',{exact:true}).count())add('UX-02','critical','강사 제안','강사가 수업 제안을 누르면 학부모 문의 폼이 나옴','강사 수업·가격·일정 제안 폼');
});
await test('모임 게시글→가입 흐름',async()=>{
 await page.getByRole('button',{name:'홈',exact:true}).click();
 await page.locator('.post',{hasText:'교회 청년부 소그룹 신규 회원'}).first().click();await shot(page,'06-community-post');
 await page.getByRole('button',{name:'모임 보기',exact:true}).click();await shot(page,'07-community-action');
 if(await page.getByText('신청·문의',{exact:true}).count())add('UX-03','critical','모임 가입','모임 보기가 모임 상세 대신 신청·문의 폼으로 감','소속 그룹 상세와 가입 조건·신청 화면');
});
await test('전화번호 입력 발신 흐름',async()=>{
 await page.getByRole('button',{name:'연결',exact:true}).click();
 await page.getByPlaceholder('이름·전화번호·기관').fill('01012345678');await shot(page,'08-phone-number');
 if(!await page.getByRole('button',{name:/전화 걸기|발신|01012345678/}).count())add('UX-04','critical','개인 010 발신','번호를 입력해도 직접 발신 경로 없음','전화번호 입력→지원 판정→발신 또는 대안');
});
await test('빈 게시글 등록',async()=>{
 await page.getByRole('button',{name:'글쓰기'}).click();
 await page.getByRole('button',{name:/서비스 요청/}).click();
 await page.getByRole('button',{name:'등록 미리보기'}).click();await shot(page,'09-empty-post');
 if(await page.getByText('제목 미입력').count())add('UX-05','major','글쓰기','빈 제목·설명으로도 미리보기 가능','필수 필드 및 역할별 입력폼 유효성 검증');
});
await test('검색 결과 없음',async()=>{
 await page.getByRole('button',{name:'찾기',exact:true}).click();
 await page.getByPlaceholder('분야·사람·기관·모임·전화번호').fill('없는키워드xyz123');await shot(page,'10-search-empty');
 if(!await page.locator('.post').count()&&!/검색 결과가 없|결과 없음/.test(await page.locator('.content').innerText()))add('UX-06','major','검색','결과 없음 안내나 대체 행동이 없음','빈 상태 및 추천 검색');
});
await test('191개 화면 목록',async()=>{
 await page.locator('header button[title="전체 메뉴 · 191 화면"]').click();await shot(page,'11-menu-191');
 const n=await page.locator('.linkrow').count();
 if(n!==191)add('UX-07','major','전체 메뉴','목록 행 '+n+'개 표시','191개 항목 표시 점검');
});
for(const v of [{width:768,height:1024,id:'12-tablet'},{width:1440,height:900,id:'13-desktop'}]){
 const pg=await browser.newPage({viewport:{width:v.width,height:v.height},locale:'ko-KR'});
 pg.on('pageerror',e=>errors.push(String(e.message||e)));
 await test(v.id+' 홈',async()=>{await pg.goto(base,{waitUntil:'domcontentloaded',timeout:45000});await pg.getByText('우리 동네 새로운 글',{exact:true}).waitFor({timeout:20000});await shot(pg,v.id);const overflow=await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);if(overflow)add('UX-08','major',v.id,'가로 스크롤 발생','가로 overflow 없음')});
 await pg.close();
}
}catch(err){add('EXECUTION','critical','런너',String(err.message||err).slice(0,500),'테스트 정상 완료')}finally{if(browser)await browser.close()}
errors.forEach(e=>add('JS-ERROR','critical','브라우저 실행 오류',e,'JavaScript 오류 0개'));
const report={createdAt:new Date().toISOString(),target:base,journeys,findings,screenshots,note:'실제 Chromium Playwright DOM·스크린샷 검사. 전화·메시지·결제 실전송 없음'};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const rows=findings.map(f=>'<tr><td>'+f.id+'</td><td>'+f.severity+'</td><td>'+f.scenario+'</td><td>'+f.actual+'</td><td>'+f.expected+'</td></tr>').join('');
const imgs=screenshots.map(s=>'<div><h3>'+s+'</h3><img width="330" src="'+s+'"></div>').join('');
fs.writeFileSync(path.join(out,'index.html'),'<meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>HITEL UX 실화면 검사</title><style>body{font:14px system-ui;margin:auto;max-width:1100px;padding:25px}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:10px;text-align:left}img{border:1px solid #ddd}section{display:flex;gap:15px;overflow-x:auto}</style><h1>HITEL Chromium UX 실화면 검사</h1><p>'+base+'</p><table><tr><th>ID</th><th>심각도</th><th>시나리오</th><th>관찰</th><th>기대</th></tr>'+rows+'</table><section>'+imgs+'</section>');
console.log(JSON.stringify({tested:journeys.length,findings,screenCount:screenshots.length},null,2));
