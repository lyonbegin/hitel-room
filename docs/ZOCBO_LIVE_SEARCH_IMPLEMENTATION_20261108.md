# 족보닷컴 모바일 동적 문제은행 — 구현 및 검증 근거 (2026-11-08)

## 원본 브라우저에서 직접 확인한 사실
- Playwright Actions Run: https://github.com/lyonbegin/hitel-room/actions/runs/42450246647
- JSON 스키마 검사 Run: https://github.com/lyonbegin/hitel-room/actions/runs/42450452032
- 원본 모바일 주소: https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000020000200003&siteid=H&subject_cd=MT
- 중2 수학 `#examMain` 동적 렌더링: 2개 자식, 화면 텍스트 2,877자.
- 고1 공통수학 `#examMain` 동적 렌더링: 1개 자식, 화면 텍스트 2,957자.
- 모바일 원본은 실제로 `getMenuByFilterAjax.asp`, `getMenuByExamPartAjax.asp`, `getMenuByExamSearchAjax.asp`에 POST를 전송하며 모든 3개에서 HTTP 200/RESULT=true 확인.
- 중2 수학 원본 응답: MENU_BY_EXAM 383건, MENU_BY_PART 32건, 메뉴필터 24건.
- 고1 수학 원본 응답: MENU_BY_EXAM 411건, MENU_BY_PART 37건, 메뉴필터 20건.
- 응답 Content-Type은 `text/html`이지만 실제 본문은 JSON이므로 표면 헤더만 보고 JSON이 아니라고 판정하지 않음.
- JSON 시험지 자료 구조: EXPAPR_NO, EXPAPR_NAME, EXPAPR_LEVEL_CD, ROOT_PART_CD, SUB_PART_CD, DETAIL_PART_CD 등.
- 단원: ROOT_PART_NM, SUB_PART_NM, DETAIL_PART_NM, 각각의 PART_CD.
- 원본 공개 기말고사 페이지의 샘플 다운로드 버튼 35개 확인.

## 이번 브랜치의 실제 구현
- `server.mjs`: 강제 whitelist/입력검증/제한속도가 있는 공개 메타데이터 읽기 전용 `GET /api/zocbo/public-catalog?site=H&grade=1&subject=MT` 엔드포인트.
- `public/zocbo-live-bank.js`: HTTP 응답 실제 시험지 목록/단원 목록, 학년·과목 선택, 제목 검색, 원본 개별 기능 링크.
- `public/zocbo-live-bank.css`: HITEL의 단일 모바일 영역 내 390px/360px 화면 CSS.
- `public/ypt-rebuild.html`: 새로운 검색 컴포넌트 JS/CSS 연결.
- `tools/zocbo/live_api_smoke.py`: 중2/고1 API→390px UI→필터/검색→기존 35건 원본 이벤트 1회 통합 E2E.
- `.github/workflows/zocbo-live-api-qa.yml`: 코드 문법/동적 서버/Playwright 검증 및 증거 ZIP.

## 검증 기준
- 원본 서버의 실제 시험지 제목/단원 구성이 재현되어야 함.
- API 반환값에서 임의 예시자료를 생성하지 않아야 함.
- 원본 소스 수집 완료·페이지 표시·버튼 존재를 실제 파일 조회/다운로드 완료로 보고하지 않아야 함.
- 인증 이후의 시험지 파일 본문 및 실제 다운로드는 대상 서버에 로그인한 후 원본 도메인에서 진행.
- HITEL에서는 비로그인 공개 메타데이터만 조회하며 원본 인증 쿠키, 사용자 비밀번호, 토큰을 전송하지 않음.

## 판정 시점
코드 작성과 동작 검증을 별도 지표로 기록. GH Actions 실제 API/브라우저 시험과 Railway 배포 성공을 확인하기 전까지 전체 완료 판정 금지.
