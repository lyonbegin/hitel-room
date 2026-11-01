import {registry,posts,services,groups} from './catalog.js';
export const VERSION='shared-ui-20261101-r2';
export const channels=['일반전화','전화 + 개인 AI','HITEL 앱','HITEL 웹'];
export const domainNames=['개인·가족','교육·전문상담','기업·채용','공공·기관','돌봄·공동체'];
export const workflows={
need:['과목·목적','희망 조건','예산'],offer:['전문 분야','제공 조건','이용료'],recruit:['모집 역할','참여 조건','보수·비용'],sell:['가격','물품·공간 상태','거래 방식'],community:['가입 조건','공개 범위','활동 주기'],program:['진행 내용','정원','회차·비용'],inquiry:['문의 목적','확인할 내용','희망 답변 방식']};
export const roles=['개인','요청자','제공자','담당자','운영자'];
export const sharedViews={search:'찾기·목록',entities:'사람·기관·모임',entity:'대상 상세',activities:'활동 목록',activity:'활동 상세',create:'작성·수정',connect:'연결 준비',incoming:'수신·부재중',waiting:'참여 준비·대기',call:'대화·통화',messages:'대화 목록',chat:'대화방',materials:'자료·개인 AI',schedules:'일정·예약 목록',schedule:'일정 상세',booking:'일정 요청·변경',records:'기록·후속 작업',record:'기록 상세',tasks:'할 일',task:'작업 상세',workspace:'운영 관리',members:'구성원·소속',permissions:'역할·권한',profile:'내 정보',settings:'환경설정',notifications:'알림',catalog:'전체 화면',coverage:'80개 상황 검토',compare:'변경 전후 비교',commerce:'거래·결제',reviews:'후기',support:'도움말',devices:'장치·재연결',map:'지도·지역',notice:'게시판',error:'오류·예외'};
const branch=(view,tab)=>({view,tab});
export function routeFor(r){
const n=Number(r.id.split('-').at(-1)); const p=r.prefix;
if(p==='APP')return [branch('welcome'),branch('onboarding'),branch('profile','identity'),branch('devices','permissions'),branch('home'),branch('services'),branch('map','region'),branch('notifications'),branch('share')][n-1];
if(p==='HOME')return [branch('home'),branch('services'),branch('activities'),branch('activity'),branch('activities'),branch('create','photo'),branch('create'),branch('error','feed')][n-1];
if(p==='SEARCH')return n===10?branch('search','filter'):n===12?branch('search','empty'):branch('search',r.title);
if(p==='SVC')return branch('service',r.title);
if(p==='ITEM')return [branch('activities'),branch('search','filter'),branch('activity'),branch('create','sell'),branch('assistant','listing'),branch('edit'),branch('activity','status'),branch('commerce'),branch('saved'),branch('reviews')][n-1];
if(p==='LIFE')return [branch('notice'),branch('notice','popular'),branch('notice','questions'),branch('notice','detail'),branch('create','community'),branch('notice','lost'),branch('members','apt'),branch('entity')][n-1];
if(p==='MAP')return [branch('map'),branch('map','filter'),branch('map','list'),branch('entities'),branch('entity'),branch('reviews'),branch('subscription'),branch('booking'),branch('rewards'),branch('create','need'),branch('quote'),branch('quotes')][n-1];
if(p==='JOBS')return [branch('activities'),branch('activity'),branch('search','filter'),branch('create','inquiry'),branch('create','recruit'),branch('workspace','participants'),branch('records')][n-1];
if(p==='REALTY')return [branch('map'),branch('search','filter'),branch('activity'),branch('booking'),branch('create','sell'),branch('reviews')][n-1];
if(p==='CAR')return [branch('activities'),branch('search','filter'),branch('activity'),branch('create','sell')][n-1];
if(p==='GROUP')return [branch('entities'),branch('entity'),branch('create','community'),branch('members'),branch('schedules'),branch('chat'),branch('reviews')][n-1];
if(p==='CAFE')return [branch('entities'),branch('notice'),branch('members'),branch('notice','detail')][n-1];
if(p==='CHAT')return [branch('messages'),branch('chat'),branch('activity'),branch('settings','conversation'),branch('commerce'),branch('connect'),branch('call','voice'),branch('call','video'),branch('call','group'),branch('materials','ai'),branch('records')][n-1];
if(p==='MY')return [branch('profile'),branch('workspace','commerce'),branch('saved'),branch('workspace','activities'),branch('workspace','participants'),branch('schedules'),branch('members'),branch('map','region'),branch('settings','ai'),branch('commerce'),branch('settings','notifications'),branch('support'),branch('support','search')][n-1];
if(p==='BIZ')return [branch('entityEdit'),branch('entityEdit'),branch('workspace'),branch('workspace','reservations'),branch('promotion'),branch('permissions')][n-1];
if(p==='COMMON')return [branch('share'),branch('confirm'),branch('error','network'),branch('error','permission'),branch('settings','accessibility')][n-1];
if(p==='NEW-MAKE')return n===1?branch('create'):n===8?branch('assistant'):n===9?branch('draft'):branch('create',['','offer','need','recruit','sell','community','program'][n-1]);
if(p==='NEW-REL')return n===1?branch('entities'):n===9?branch('members'):n===10?branch('notice','questions'):branch('entity',r.title);
if(p==='NEW-COM')return [branch('connect'),branch('connect','capabilities'),branch('incoming'),branch('waiting'),branch('call','group'),branch('materials'),branch('materials','ai'),branch('devices'),branch('records')][n-1];
if(p==='NEW-ACT')return [branch('activity','room'),branch('booking'),branch('waiting'),branch('activity','delivery'),branch('activity','work'),branch('booking'),branch('attendance'),branch('entity','credentials')][n-1];
if(p==='NEW-ORG')return [branch('entities'),branch('entity'),branch('activity','request'),branch('booking')][n-1];
if(p==='NEW-MY')return [branch('workspace'),branch('schedules'),branch('members'),branch('workspace','services'),branch('records'),branch('permissions')][n-1];
throw new Error('Unmapped '+r.id);
}
export const pageMap=registry.map(r=>({...r,...routeFor(r)}));
export function capability(from,to){
const outside=from===0&&to===0;const sidecarOnly=from<2&&to<2&&!outside; const phone=from<2||to<2;
return {outside,sidecarOnly,phone,web:from===3||to===3,route:`${['P','P+','N','W'][from]} → ${['P','P+','N','W'][to]}`,canVideo:!phone,canSharedAudio:!outside&&!sidecarOnly,needsGateway:phone&&!outside&&!sidecarOnly,
label:outside?'HITEL 비참여 일반전화':sidecarOnly?'기본전화 + 개인 보조':phone?'전화망 중계 필요':'앱·웹 인터넷 통화'};
}
export function materialsFor(materials,actor){return materials.filter(m=>m.visibility!=='개인'||m.owner===actor);}
export function recordForSession(session,context){if(capability(session.from,session.to).outside)return null;return {id:'r-'+Date.now(),activityId:context.id,title:context.title,kind:'연결 시연',status:'시연 종료',at:new Date().toISOString(),note:'실제 통신·녹음·자동 요약은 생성되지 않았습니다.',actor:session.actor};}
export function saveBooking(values,previous){if(!values.date||!values.time)throw Error('날짜와 시간을 입력해 주세요.');return {...previous,...values,status:previous?'변경 확인 대기':'확인 대기',updated:new Date().toISOString()};}
export const comparisons=[
['전체 화면','191개 항목 대부분이 동일한 탐색 목업으로 이동','모든 기존 ID를 검색·상세·작성·통신·일정·관리 화면과 상태에 연결'],
['페이지 재사용','분야와 화면 이름 중심의 진입','대상·활동·역할·상태를 공유하는 화면 구성'],
['활동 상세','제목·설명·연락 버튼','참여자·요청번호·자료·일정·처리 상태·관련 대화 연결'],
['작성·수정','분야·제목·내용','목적별 필드·역할·연락 방법·공개 범위·임의 추가 항목·미리보기·저장'],
['연결 준비','음성·영상·메시지와 고지','16개 경로에 맞는 지원 기능·번호·ARS·동의·대안 표시'],
['착신·대기','카탈로그 항목','수신·거절·부재중·콜백·참여 확인을 공유 상태로 처리'],
['개인 AI·자료','범용 목업','개인/참여자 자료, 소유자·역할별 접근·자료 등록·AI 범위 표시'],
['일정·예약','희망 방식·시간 입력','날짜·시간·참여자·장소·반복·요청·수락·변경·취소 및 목록'],
['메시지·기록','새로고침 시 사라지는 시연','브라우저에 메시지·메모·후속 작업·변경 이력 저장'],
['운영·권한','관리 메뉴에서 목업 이동','역할 전환·소속·구성원·지원/요청·업무 상태·자료 공개 범위'],
['80개 상황','별도 보고서의 문장','80개 각각에서 공유 화면·개선 요구를 확인하고 해당 맥락으로 열기'],
['외부 연동','통신·결제 미연결','실제 미연결 상태 유지 표시, 시연 결과와 실제 완료 구분']
];
const domainActivity=['family','t2','j1','o1','s2'];
export function scenarioActivity(row){return domainActivity[Number(row.id.split('-D')[1])-1];}
export function scenarioPages(row){const d=Number(row.id.split('-D')[1]),n=Number(row.id.slice(3,5));return n===1?['entity','record']:['activity','connect',n===2||n===5||n===6?'materials':'incoming','call',d===2||d===5||d===1?'booking':d===3?'workspace':'tasks','records','permissions'];}
export function initialState(){
const entities=[{id:'person',name:'김지현',type:'사람',role:'제공자',detail:'활동과 연락을 함께 관리합니다.',phone:'010-0000-1001',verified:false,relation:'연락처'}, {id:'parent',name:'가족 연락처',type:'사람',role:'참여자',detail:'가족 일정과 연락 메모',phone:'010-0000-1002',verified:false,relation:'가족'}, {id:'company',name:'함께하는 교육팀',type:'기관',role:'담당자',detail:'채용·프로그램·협업 문의',phone:'1588-0000',verified:false,department:'운영팀',hours:'평일 09:00–18:00'}, {id:'org',name:'지역 상담 창구',type:'기관',role:'담당자',detail:'행정·복지·평생학습 문의',phone:'02-000-0000',verified:false,department:'주민 상담',hours:'평일 09:00–18:00'},...groups.map(g=>({id:g[0],name:g[1],type:'모임',role:'운영자',detail:g[2],verified:false}))];
const activities=posts.map((p,i)=>({...p,type:p.kind.includes('모집')?'recruit':p.kind.includes('요청')||p.kind==='개발 의뢰'?'need':p.service==='모임·커뮤니티'?'community':p.service==='공공기관·기업'?'inquiry':'offer',entityId:p.id==='o1'?'org':p.service==='일자리·채용'?'company':p.service==='모임·커뮤니티'?'church':'person',status:'진행 중',owner:'제공자',requestNo:'HT-2026-'+String(1001+i),participants:[{name:'나',role:'요청자'},{name:'담당자',role:'제공자'}],fields:{'희망 조건':p.meta,'비용':p.price},created:'2026-11-01T09:00:00+09:00'}));
activities.unshift({id:'family',title:'함께 확인할 가족 일정',service:'개인·가족',kind:'일정 협의',type:'inquiry',entityId:'parent',status:'확인 대기',owner:'개인',requestNo:'HT-2026-1000',detail:'서로의 일정과 전달할 내용을 함께 확인합니다.',meta:'가족 · 시간 협의',price:'',participants:[{name:'나',role:'개인'},{name:'가족',role:'참여자'}],fields:{'확인할 내용':'일정과 전달 사항'}});
const extras=[
['item','물품·거래','사용하던 책상 나눔','sell',{'가격':'나눔','물품·공간 상태':'사용감 있음','거래 방식':'직접 전달'}],
['space','공간·부동산','함께 쓸 작업 공간 안내','sell',{'가격':'조건 협의','면적':'안내 확인','방문 조건':'예약 후 방문'}],
['car','중고차·차량','차량 상태·방문 확인 요청','sell',{'가격':'조건 확인','차량 정보':'상세 확인','방문 조건':'일정 협의'}],
['exam','시험·학습','자격시험 준비 스터디','community',{'가입 조건':'함께 공부하실 분','활동 주기':'주 1회'}],
['health','의료·건강','건강 프로그램 안내 문의','inquiry',{'문의 목적':'프로그램 참여 조건','희망 답변 방식':'대화'}],
['beauty','뷰티·미용','예약 가능한 시간 문의','need',{'희망 조건':'시간 협의','예산':'안내 확인'}],
['legal','법률·세무','전문가 상담 일정 문의','inquiry',{'문의 목적':'상담 조건 확인','희망 답변 방식':'예약 상담'}],
['design','디자인·콘텐츠','소개 자료 디자인 의뢰','need',{'희망 조건':'자료 1종','예산':'협의'}],
['move','운송·이사','이동·운송 일정 요청','need',{'희망 조건':'출발·도착 조건 협의','예산':'견적 확인'}],
['travel','숙박·여행','지역 여행 모임 일정','program',{'진행 내용':'일정 함께 정하기','정원':'참여자 확인'}],
['event','공연·행사','작은 공연 참가자 모집','recruit',{'모집 역할':'참가자','참여 조건':'일정 확인'}],
['marketing','마케팅·광고','지역 소식 홍보 협업','need',{'희망 조건':'진행 범위 협의','예산':'협의'}],
['program','프로그램·예약','주말 프로그램 참여 신청','program',{'진행 내용':'함께하는 프로그램','정원':'10명'}],
['phone','전화·영상','온라인 대화 모임','community',{'활동 주기':'일정 협의','가입 조건':'참여 요청'}],
['map','지도·업체','지역 업체 이용 문의','inquiry',{'문의 목적':'제공 조건 확인','희망 답변 방식':'대화'}]
];
for(const [id,service,title,type,fields] of extras)activities.push({id,title,service,type,kind:'활동 예시',entityId:type==='community'?'church':'person',status:'요청',owner:'개인',requestNo:'HT-2026-'+id,detail:'예시 활동입니다. 조건을 확인하고 대화·일정·자료를 공유할 수 있습니다.',meta:'조건 확인 · 일정 협의',fields,participants:[{name:'나',role:'개인'},{name:'활동 상대',role:'참여자'}],created:'2026-11-01T09:00:00+09:00'});
return {version:VERSION,actor:'개인',region:'역삼동',activities,entities,messages:[],schedules:[{id:'b1',activityId:'t2',title:'영어 수업 일정 협의',date:'2026-11-05',time:'19:00',duration:'60',mode:'온라인',status:'확인 대기',repeat:'반복 없음',person:'요청자·제공자',note:'시간을 확인해 주세요.'}],materials:[{id:'m1',activityId:'t2',title:'문의 전 확인할 내용',body:'수업 목적, 가능한 시간, 필요한 자료를 확인합니다.',visibility:'참여자',owner:'개인'},{id:'m2',activityId:'t2',title:'나만의 질문 메모',body:'조건과 일정에 대해 질문하기',visibility:'개인',owner:'개인'}],records:[],tasks:[],members:[{id:'u1',name:'나',role:'개인',status:'참여 중'},{id:'u2',name:'활동 담당자',role:'담당자',status:'초대 대기'}],notes:[],comments:[],saved:[],settings:{large:false,dark:false,notifications:true,captions:false,translation:false,summary:false},notifications:[],extras:{}};
}
