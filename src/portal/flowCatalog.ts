export type LinkMode = 'P' | 'P_PLUS' | 'N' | 'W';
export type FlowStep = 'select' | 'ringing' | 'connecting' | 'active';
export interface FlowScenario {
  id: number;
  from: LinkMode;
  to: LinkMode;
  title: string;
  callerAction: string;
  receiverAction: string;
  mediaRoute: string;
  prerequisite: string;
  ai: string;
  caveat?: string;
}
export const modeLabels: Record<LinkMode,string> = {
  P:'일반전화', P_PLUS:'일반전화 + HITEL 앱', N:'HITEL 앱 인터넷통화', W:'HITEL 모바일 웹',
};
export const modeShort: Record<LinkMode,string> = {
  P:'P', P_PLUS:'P+', N:'N', W:'W',
};
export const order: LinkMode[] = ['P','P_PLUS','N','W'];

export const scenarios: FlowScenario[] = [
  {id:1,from:'P',to:'P',title:'일반전화 ↔ 일반전화',callerAction:'일반전화 앱에서 번호를 누릅니다. HITEL 화면은 없습니다.',receiverAction:'기존 전화가 울립니다. HITEL 수신화면은 없습니다.',mediaRoute:'통신사 PSTN 직접 통화',prerequisite:'HITEL이 음성경로에 참여하지 않는 기본 통화',ai:'양측 HITEL 개인 AI 없음',caveat:'별도 사업자 게이트웨이가 실제 통화에 참여하지 않는 한 HITEL Interaction은 생성되지 않습니다.'},
  {id:2,from:'P',to:'P_PLUS',title:'일반전화 고객 → 앱 설치 수신자',callerAction:'기존 일반전화로 010에 발신합니다.',receiverAction:'기본 전화 앱에서 통화를 받고 HITEL 도우미 화면을 엽니다.',mediaRoute:'PSTN 직접 + 수신자 데이터 사이드카',prerequisite:'수신자 HITEL 계정/앱. 기존 음성은 계속 통신사 경로',ai:'수신자 비공개 AI 패널',caveat:'앱 설치만으로 양쪽 이동통신 음성이 자동 인식되지는 않습니다.'},
  {id:3,from:'P',to:'N',title:'일반전화 고객 → HITEL 앱 수신',callerAction:'기존 번호/배정 번호로 일반전화를 겁니다.',receiverAction:'HITEL 앱에서 푸시 수신 → 앱 통화를 받습니다.',mediaRoute:'PSTN → DID/착신전환 → 전화 게이트웨이 → 앱 인터넷 음성',prerequisite:'유효한 DID/착신전환 또는 공개 수신번호, 앱 수신 가능',ai:'앱 수신자 비공개 AI',caveat:'010 회원 인증만으로 PSTN→앱 착신이 자동으로 되지는 않습니다.'},
  {id:4,from:'P',to:'W',title:'일반전화 고객 → 모바일 웹 수신',callerAction:'공개 번호에 일반전화로 발신합니다.',receiverAction:'온라인 브라우저의 수신 배너에서 연결합니다.',mediaRoute:'PSTN → DID → 전화 게이트웨이 → 브라우저 WebRTC',prerequisite:'DID·게이트웨이·브라우저 온라인/마이크 허가',ai:'웹 수신자 비공개 AI',caveat:'브라우저가 닫혀 있으면 착신 대체 정책이 필요합니다.'},
  {id:5,from:'P_PLUS',to:'P',title:'앱 설치 발신자 → 일반전화',callerAction:'HITEL에서 번호 검색 후 기본 전화 앱을 열고 AI 도우미를 사용합니다.',receiverAction:'기존 일반전화로 받습니다.',mediaRoute:'통신사 PSTN 직접 + 발신자 데이터 사이드카',prerequisite:'발신자 네이티브 앱/기본 다이얼러',ai:'발신자 개인 AI 패널',caveat:'통역 TTS를 상대방에게 송출할 기능은 실제 기기 능력에 따라 활성화합니다.'},
  {id:6,from:'P_PLUS',to:'P_PLUS',title:'양쪽 모두 기존 전화 + HITEL 앱',callerAction:'기존 010 전화로 발신하고 HITEL AI를 엽니다.',receiverAction:'기존 전화로 수신하고 자신의 HITEL AI를 엽니다.',mediaRoute:'PSTN 직접 + 양측 독립 데이터 사이드카',prerequisite:'양측 등록·인증된 앱; 대화 데이터 페어링 동의',ai:'발신·수신 각각 다른 비공개 AI',caveat:'전화번호 표시만으로 양쪽 계정의 개인 자료를 연결하지 않습니다.'},
  {id:7,from:'P_PLUS',to:'N',title:'기존 전화+앱 → 앱 인터넷통화 수신',callerAction:'기존 번호로 발신하면서 도우미를 엽니다.',receiverAction:'HITEL 앱에서 푸시 수신·응답합니다.',mediaRoute:'PSTN → 전화 게이트웨이 → 앱 VoIP',prerequisite:'수신용 DID/착신 연결과 게이트웨이',ai:'발신자·수신자 각자 비공개 AI',caveat:'발신자의 기존 PSTN 원음 접근은 기기 지원과 별개입니다.'},
  {id:8,from:'P_PLUS',to:'W',title:'기존 전화+앱 → 모바일 웹 수신',callerAction:'기존 전화로 발신하고 별도 HITEL 도우미를 엽니다.',receiverAction:'온라인 웹에서 일반전화 착신을 받습니다.',mediaRoute:'PSTN → 게이트웨이 → 웹 WebRTC',prerequisite:'DID/착신·브라우저 온라인',ai:'발신자·웹 수신자 각각 AI',caveat:'브라우저가 오프라인이면 통화 연결 완료로 표시하지 않습니다.'},
  {id:9,from:'N',to:'P',title:'HITEL 앱 인터넷전화 → 일반전화',callerAction:'앱 통합 발신기에서 번호를 선택하여 인터넷통화를 요청합니다.',receiverAction:'기존 일반전화 수신',mediaRoute:'앱 인터넷 음성 → PSTN 전화 게이트웨이',prerequisite:'PSTN 아웃바운드 게이트웨이·발신 정책·번호 라우팅',ai:'앱 발신자의 개인 AI',caveat:'120 같은 단축번호는 게이트웨이 라우팅 지원을 확인합니다.'},
  {id:10,from:'N',to:'P_PLUS',title:'HITEL 앱 인터넷전화 → 전화+앱',callerAction:'앱에서 기존 일반전화번호로 발신합니다.',receiverAction:'기존 일반전화로 받으면서 HITEL 도우미를 엽니다.',mediaRoute:'앱 VoIP → PSTN 게이트웨이 → 수신자 일반전화',prerequisite:'PSTN 발신 게이트웨이와 수신자 사이드카',ai:'양측 각자 비공개 AI',caveat:'수신자 일반통화 오디오는 자동으로 하이텔 웹에 들어오지 않습니다.'},
  {id:11,from:'N',to:'N',title:'HITEL 앱 ↔ HITEL 앱',callerAction:'HITEL 사용자에게 음성/영상 요청을 보냅니다.',receiverAction:'앱 푸시 수신 후 인터넷통화에 참여합니다.',mediaRoute:'기존 Fly WebRTC, 양측 앱 화면은 공통 Vite UI',prerequisite:'양측 앱 로그인·수신 알림·미디어 승인',ai:'양측 각각 비공개 AI + 필요한 공용 데이터',caveat:'영상통화는 사용자가 선택할 때만 카메라를 활성화합니다.'},
  {id:12,from:'N',to:'W',title:'HITEL 앱 → 모바일 웹',callerAction:'상대방 ID·초대 링크로 앱에서 호출합니다.',receiverAction:'브라우저에서 초대·수신을 승인합니다.',mediaRoute:'기존 Fly WebRTC, 앱↔브라우저',prerequisite:'브라우저 활성 세션 또는 만료시간 있는 초대링크',ai:'앱 사용자·웹 사용자 각각 비공개 AI',caveat:'웹 수신자가 접속하지 않으면 실제 연결 상태가 아닙니다.'},
  {id:13,from:'W',to:'P',title:'모바일 웹 → 일반전화',callerAction:'브라우저에서 일반번호 입력 후 HITEL 인터넷통화로 연결합니다.',receiverAction:'기존 일반전화 수신',mediaRoute:'브라우저 WebRTC → PSTN 전화 게이트웨이',prerequisite:'브라우저 마이크 허가·전화 게이트웨이·과금 정책',ai:'웹 발신자 비공개 AI',caveat:'브라우저의 tel: 링크만 여는 것은 WebRTC→PSTN 연결이 아닙니다.'},
  {id:14,from:'W',to:'P_PLUS',title:'모바일 웹 → 일반전화+앱',callerAction:'웹에서 기존 일반전화번호로 연결합니다.',receiverAction:'기본 전화로 수신하면서 HITEL 개인 AI를 엽니다.',mediaRoute:'브라우저 WebRTC → 게이트웨이 → 일반전화',prerequisite:'게이트웨이와 수신자 데이터 사이드카',ai:'웹 발신자·앱 수신자 각각 비공개 AI',caveat:'수신자 일반전화의 원격 오디오 접근 기능은 별도입니다.'},
  {id:15,from:'W',to:'N',title:'모바일 웹 → HITEL 앱',callerAction:'브라우저에서 사용자 ID·대화 초대 링크로 호출합니다.',receiverAction:'HITEL 앱에서 푸시 수신·응답',mediaRoute:'기존 Fly WebRTC, 브라우저↔앱',prerequisite:'상대 앱 온라인/푸시 수신, 웹 미디어 허용',ai:'양측 각자의 개인 AI',caveat:'수신자는 인터넷통화이며 기존 이동통신 전화와 구분됩니다.'},
  {id:16,from:'W',to:'W',title:'모바일 웹 ↔ 모바일 웹',callerAction:'웹에서 사용자·초대 링크 선택 후 연결합니다.',receiverAction:'웹 브라우저에서 수신·참여 승인',mediaRoute:'기존 Fly WebRTC, 브라우저↔브라우저',prerequisite:'양측 브라우저 세션·미디어 허용',ai:'양측 비공개 AI, 각자의 지식패널',caveat:'링크로 대화를 시작하지만 전통적인 방 생성 UI는 선택사항입니다.'},
];
export const getScenario=(from:LinkMode,to:LinkMode):FlowScenario => {
  const match=scenarios.find(s=>s.from===from&&s.to===to);
  if(!match) throw new Error('Missing scenario for '+from+'→'+to);
  return match;
};
export function supportedUi(mode:LinkMode):string {
  switch(mode) {
    case 'P': return 'HITEL 화면 없음 (일반전화만 사용)';
    case 'P_PLUS': return '기본 전화 화면 + HITEL 개인 AI 사이드카';
    case 'N': return 'HITEL 네이티브 앱에 포함된 Vite 통화 화면';
    case 'W': return 'Chrome/Safari에 표시되는 Vite 통화 화면';
  }
}
