# 족보닷컴 iframe 제거 및 DOM/CSS 직접 통합 계획 (2026-11-08)

## 현황 확인
- 사용자 두 스크린샷에서 iframe의 중첩 헤더, 이중 스크롤, 좁아진 자료 본문, 행사 광고가 화면을 가리는 문제가 확인됨.
- 이전 55/55 통과는 링크·JS 스모크테스트이며 실제 자료 열람·로그인 완료·다운로드 성공을 검증한 것이 아님.
- 운영 화면에서 iframe 구현은 public/zocbo-integration.js의 embeddedOfficial()에 있음.
- 별도 분석 브랜치: feature/zocbo-dom-inline-source-audit-20261108, 기존 운영 코드는 변경하지 않음.
- 실제 GitHub Actions 공개 소스 수집: run 42444273566, 8개 모바일 페이지, CSS 파일 11개, 공식 JS 파일 80개, 참조 리소스 URL 474개.

## 원본 DOM과 CSS 기준
1. 2026 기말고사: main#event-content 안의 .promotion__section.is-data 를 콘텐츠 컴포넌트로 변환. 섹션 크기 약 16.7KB, 다운로드 관련 버튼 35개. 전체 페이지 HTML 약 460KB, CSS 6개, JS 42개.
2. 로그인: main > form#form1 및 관련 인증 컨트롤을 분석. 원본 HTML 약 292KB, CSS 4개, JS 36개.
3. 문제 목록: main.content > #examMain, 원본 HTML 약 599KB, CSS 5개, JS 36개. 해당 컨테이너는 정적 HTML이 사실상 비어 있으므로 실제 JS 실행 및 동적 응답 분석이 필수.
4. 무료 기출 뷰어: 공식 주소는 zocbo://viewer 앱 딥링크로 전환되므로, 브라우저 DOM만 붙이면 동일 기능이 제공된다고 판정하면 안 됨.

## 1차 구현 범위
- HITEL 상단 제목·기존 하단 5개 메뉴 유지, iframe 제거 및 단일 세로 스크롤.
- 원본 DOM 중 필요한 선택자와 자식 콘텐츠만 추출. 헤더, 중복 내비게이션, 배너/광고 등은 가져오지 않음.
- 스타일: 공식 CSS를 분석하여 해당 컴포넌트에 필요한 선택자만 재구성. Shadow DOM 또는 엄격한 .zocbo-content 클래스 범위로 격리하고 상대 asset URL 전부 원본 기준으로 정규화. 그대로 전체 reset.css/Bootstrap을 주입하지 않음.
- 화면: 학년/과목/시험범위 선택→실제 공개자료 행→자료 상세→원본 다운로드 흐름에 대해 원본 클래스와 이미지를 연결.
- 원본 코드에서 다운로드 동선 확인:
  pre-test2026d.js의 data-act=sampleDown → common.checkLogin → /_api/member.api.asp 의 ISLOGIN 처리 → 새 단원 선택과 조건 확인 → /ZocboExam/AutoExamPre_p.asp 생성 요청 → /Common/System/Token_hs.asp 상태 확인 → /common/examdownload/SampleDownloadS3.asp의 원본 다운로드.
- 이 요청을 HITEL 도메인에서 단순 복사·재실행하면 기존 족보닷컴 쿠키/인증 상태가 이어지지 않을 수 있음. 권한과 실동작이 확인될 때까지 로그인과 실제 파일 다운로드는 족보닷컴 정식 오리진에서 수행하도록 연결.
- 다운로드 완료 표시는 실제 파일 생성·전송 검증 전에는 사용하지 않음.

## 정확한 검증 기준
- 모바일 360·390px 기준 가로 스크롤 없이 원본 자료 영역이 한 화면 안에 배치될 것.
- HITEL과 족보닷컴 헤더, 하단 메뉴, 스크롤이 중복되지 않을 것.
- 원본 자료의 grade/siteid/subjcode/term과 UI 선택 결과가 일치할 것.
- 메인 메뉴 5개, 검색→상세→다운로드 경로, 뒤로가기 기능, 이미지 및 스타일 충돌 검사.
- 로그인 성공, 족보닷컴 세션, 실제 자료 다운로드는 테스트 계정으로 수동 확인 후에만 완료 처리.
- 우선 화면: 고1 통합과학 상세/다운로드 1건을 픽셀과 행동 모두 비교; 통과 후 35개 자료 및 전체 문제은행으로 확장.

## 근거 링크
- Actions 원본 소스 수집: https://github.com/lyonbegin/hitel-room/actions/runs/42444273566
- 이전 기능 검증: https://github.com/lyonbegin/hitel-room/actions/runs/42442962950
