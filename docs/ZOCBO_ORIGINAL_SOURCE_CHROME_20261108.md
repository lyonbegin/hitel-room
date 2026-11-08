# 족보닷컴 모바일 원본 화면 DOM 연결 모드 — 2026-11-08

## 실제 접근 주소

- 원본 모바일 구조 직접 보기(중3 영어): https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch&mobile=1&original=1&site=M&grade=3&subject=EG
- 원본 모바일 구조 직접 보기(중2 수학): https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch&mobile=1&original=1&site=M&grade=2&subject=MT
- 원본 모바일 구조 직접 보기(고1 수학): https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch&mobile=1&original=1&site=H&grade=1&subject=MT
- 기존 HITEL 문제은행: https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch

## 구조

`original=1`은 **iframe이나 원본 사이트를 그 안에 띄우는 기능이 아닙니다**. GitHub Actions가 원본 모바일 Chromium으로 수집한 700개 DOM 스냅샷을 각 학년·과목·메뉴별로 불러옵니다.

- 원본 상단 6개 메뉴: 캡처한 실제 `tabLineRound` 원문, `data-mn` 순서 및 `data-step` 표시
- 하위 메뉴: 원본 `#lnb_main_web` 의 실제 `lnb__button` 원문과 메뉴 코드
- 학년/과목/교과서·난이도 필터: 원본 `zbFilter` 버튼 원문과 관측된 공개 선택 항목
- 단원/하위단원/회차: 원본 `#examMain`, `zbAccordion`, `download__button` 및 원본 자료번호
- 원본 상단 헤더와 로고·이용권 버튼/로그인 공식 주소
- 홍보 배너: 원본 `.hijeckingBanner` HTML 및 `banner-learning3Q-public.png` 공식 원본 이미지 경로
- 이용 안내: 원본 DOM의 실제 버튼을 표시. 본문 팝업은 원본 브라우저에서 공개 표시를 확인하지 못하여 공식 원본 페이지로 안내
- 원본 하단 5개 항목: 중등·고등은 HITEL 내부 선택을 전환하며, 나머지는 공식 원본 페이지로 이동

## 브라우저 상호작용

원본 HTML에서 위험한 인라인 이벤트/스크립트를 실행하지 않고, 표면에 있는 버튼 클릭을 HITEL 데이터 라우팅과 공개 AJAX 요청으로 위임합니다. 교과서가 바뀌면 원본에서 실제 관측한 선택 코드 및 URL-encoded POST 형식으로 공식 익명 AJAX를 다시 조회합니다. 원본 검색 결과 자료번호는 화면에 표시합니다.

## 검증 항목

- 원본 DOM 기반 상단 6개/하위 2개/원본 필터 3개, 헤더와 배너, 안내 및 하단 5개
- 중3 영어: 천재(이재영) 80개 공개 자료 번호, 미래엔(최연희) 선택 시 70개 재조회
- 중3 영어 → 실전대비 원본 메뉴 이동 → 단원별 원본 복귀
- 중등 → 고등 전환 시 고1 수학 원본 411건 조회
- 학교별 맞춤학습: 서울→강남구→숙명여자중학교 필터, 원본 서버 조회 26개 구·군/25개 학교
- 모바일 390px/360px, 스크립트 오류와 가로 넘침 0건

GitHub Actions 증거는 `.github/workflows/zocbo-original-source-chrome-e2e.yml` 및 `tools/zocbo/test_original_source_chrome.py`, `tools/zocbo/test_original_school_filters.py`를 참조하십시오.

## 미구현 및 검증 제외

원본과 모든 픽셀이 동일하다는 판정은 하지 않았습니다. 로그인된 회원 기능, 실제 유료 문제 본문/정답/해설, PDF/HWP 다운로드와 동영상 재생, 학교별 시험지 생성은 공개 브라우저 검사만으로 완료되지 않습니다. 원본 안내 팝업을 공개 상태에서 표시하지 못했으므로 안내 버튼은 공식 원본 페이지로 이어지는 대체 동작입니다. 원본 모바일 로고·이용권 배너·하단 아이콘 일부는 원본 공개 리소스 주소를 사용하며, 원본의 동적 변경사항은 추가 동기화가 필요합니다.

## 변경 파일

- `public/zocbo-source-chrome.js`, `.css`: 원본 시각 영역을 섹터에 배치하고 사용자 클릭 위임
- `tools/zocbo/compile_faithful_source_ui.py`: 700개 화면의 원본 상단 메뉴·하위 메뉴·필터·배너·유틸리티·로고 정보 보존
- `public/zocbo-faithful-pages/*.json`: 화면별 원본 DOM 조각
- `server.mjs`와 `public/ypt-rebuild.html`: 원본 비교 모드 JS/CSS 로딩

기존 `?screen=bankSearch`와 별도 `original=1` 주소를 제공하므로 사용자가 새 구조를 이전 화면과 직접 비교할 수 있습니다.
