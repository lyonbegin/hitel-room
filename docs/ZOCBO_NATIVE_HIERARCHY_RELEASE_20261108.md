# 족보닷컴 모바일 실제 문제은행 재구축 — 2026-11-08

## 목표와 기존 오류
이전 HITEL은 시험지 제목 411·383건을 나열하고 모든 자료 버튼을 일반 원본 목록 주소에 연결했습니다. 원본 모바일 페이지에서 실제 실행되는 대단원→소단원→세부단원→회차 계층과 시험지의 개별 식별자 반영이 빠져 있었습니다. 이번 변경에서는 화면 텍스트뿐 아니라 원본 서버 데이터의 계층과 조작 기능을 구현했습니다.

## 실제 구현
- `server.mjs`: 익명 모바일 AJAX의 `getMenuByFilterAjax.asp`, `getMenuByExamPartAjax.asp`, `getMenuByExamSearchAjax.asp`를 사용한 읽기 전용 메타데이터 API. `ROOT_PART_CD`, `SUB_PART_CD`, `DETAIL_PART_CD`, `EXPAPR_NO`, `EXAM_EPISODE`, 원본 단원명과 과목명을 별도로 전달.
- `public/zocbo-live-bank.js`: 원본 실제 학년·과목 필터, 단원별 카드 및 펼치기, 세부단원 회차 버튼, 시험지 ID 정보창, 자료번호 복사, 전체 시험지와 제목 검색. 최초 화면의 대단원은 원본과 같이 접힌 상태.
- `public/zocbo-live-bank.css`: 기존 HITEL 영역 내 모바일 단일 스크롤. 원본 인터페이스의 중립색·카드 계층을 반영하고 중복 헤더·iframe 미사용.
- `tools/zocbo/live_api_smoke.py`: 원본 서버 데이터와 360px·390px 모바일 브라우저에서 대단원→소단원→회차 선택 및 선택한 원본 `EXPAPR_NO` 표시의 동일성을 검사.
- 기존 공개 행사 원본 DOM의 35개 자료 버튼과 책갈피 기능 유지.

## 실제 데이터·테스트 기록
- 고1 공통수학: 원본 시험지 411건, 단원 원본 응답 37행.
- 중2 수학: 원본 시험지 383건, 단원 원본 응답 32행.
- 고1 첫 대단원명 원본 `1. 다항식` 사용. 첫 대단원 45건의 회차 데이터가 DOM에 연결됨.
- 360px, 390px: 가로 넘침 0, iframe 0, JavaScript 오류 0.
- 사용자 조작: 대단원·소단원 펼치기, 회차 선택→원본 시험지 번호 표시, 검색, 전체 목록 표시.
- GitHub Actions 코드 검증: https://github.com/lyonbegin/hitel-room/actions/runs/42453082842
- 검증 대상 별도 Railway 서비스: https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch

## 미구현·미검증 (완료로 표기 금지)
- 원본의 로그인/이용권 서버 세션을 HITEL 내부로 이전하지 않았음.
- 원본 시험지 본문·정답·해설·PDF 파일 자체를 추출하거나 다운로드하지 않았음.
- 회차 버튼은 실제 자료의 메타데이터 정보창을 열며, 원본 자료 권한 확인·다운로드는 공식 도메인에서 진행함. 특정 원본 자료가 자동 선택되는 딥링크도 검증되지 않아 제공하지 않음.
- 원본의 모든 교과서·난이도 세부 필터 기능과 전체 페이지 픽셀 동일성은 아직 완료되지 않았음.
- 한 화면에 나타나는 단원 목록에 한해 원본의 계층을 구현한 것이며 원본 서비스 전체를 복제했다는 의미가 아님.

## 원칙
추가 외부 유료 브라우저 도구(TinyFish) 미사용. 배포와 동작 검증은 GitHub Actions + Playwright + Railway에서 수행. 별도 브랜치/서비스이므로 기존 운영 환경은 수정하지 않음.
