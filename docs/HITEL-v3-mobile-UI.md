# HITEL v3.0: AI 지능형 통신 중심 모바일 프론트

- 사용자에게 P/P+/N/W 16개 조합을 나열하지 않고 연락처·번호·기관을 먼저 찾게 합니다.
- 모바일 우선 하단 메뉴: 전화 / 찾기 / 대화 / 내 AI / MY. 1060px 이상에서는 좌측 내비와 AI 우측 컨텍스트 패널로 전환됩니다.
- 통화 경로 미리보기에서 '기존 전화+AI 정보 보조'와 아직 미연동인 PSTN 게이트웨이·WebRTC 수신 경로를 명확히 구분합니다.
- 앱 WebView가 로드하는 /portal을 대체합니다. 기존 개발용 전화 인증 화면은 /portal/legacy, 연결 시나리오 기획은 /portal/flows, 기존 영상방은 /에 보존합니다.
- 직접 연결된 기능: 키패드, 검색, 기능 탭, 브라우저/네이티브 기본 다이얼러 호출, 로컬 TTS, 시연용 그룹 참여·수신채널 저장(localStorage), AI 보조 메모(localStorage).
- 미연동: 실제 PSTN 게이트웨이·번호 조회, 기관 공식번호 인증, 실제 회원·그룹 DB, AI 자동 생성, 음성 인식·번역·상대방 TTS 전달, 그룹 미디어 연결. 이를 연결 완료로 UI에 표시하지 않습니다.
- 웹 기반 화면은 기존 src/portal/nativeBridge.ts의 getCapabilities/tts.speak/call.openDialer를 사용하며 iOS와 Android WebView에서 같은 React 페이지를 열도록 설계됐습니다.
- 중요: 예시 연락처는 실제 전화번호가 아닌 UI 샘플이며, 일반전화는 이용자가 입력한 번호만 기본 다이얼러로 엽니다.
