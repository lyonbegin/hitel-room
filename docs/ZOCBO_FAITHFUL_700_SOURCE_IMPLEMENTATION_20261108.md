# HITEL 족보닷컴 원본 700개 화면 소스 기반 재구현 — 2026-11-08

## 목표 및 기존 오류

기존 public/zocbo-all-menus.js는 학년·과목별 차이를 무시하고 수학용 하위 메뉴를 고정했습니다. 그 결과 화면에서 중3 영어를 선택했는데 '수준별 학습'이 활성화되는 등 실제 모바일 원본과 불일치했습니다. 이 구현은 해당 하드코딩 UI를 로딩하지 않고, 원본 브라우저를 수집한 700건의 메뉴·필터·목록 데이터로 동일 화면 영역을 구성합니다.

## 직접 조작할 수 있는 배포 화면

- 일반 HITEL 화면: https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch
- 모바일 전체 화면: https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch&mobile=1
- 중3 영어 원본 대응 사례: https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch&mobile=1&site=M&grade=3&subject=EG
- 중3 국어: https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch&mobile=1&site=M&grade=3&subject=KR
- 중2 수학: https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch&mobile=1&site=M&grade=2&subject=MT
- 고1 수학: https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch&mobile=1&site=H&grade=1&subject=MT

## 데이터 수집 출처와 구조

- 저장소 원본 소스 브랜치: archive/zocbo-original-browser-sources-20261108
- 6개 학년/사이트 세션의 Chromium 원본 700개 DOM 상태, 서로 다른 원본 URL 325개, 원본 JavaScript/CSS 56개 자원, 원본 공개 AJAX 본문 1,288개.
- 실제 교과서/난이도 선택지와 선택 코드: archive/zocbo-public-filters-M1/M2/M3/H1/H2-20261108
- tools/zocbo/compile_faithful_source_ui.py 는 700개 원본 문서의 #examMain 등의 렌더된 DOM 및 원본 메뉴/필터를 소스별로 보존합니다. public/zocbo-faithful-index.json에는 학년·과목·상단 메뉴·하위 메뉴별 소스 연결을 기록, public/zocbo-faithful-pages/*.json에 스크립트/onclick을 제거한 실제 원본 화면을 저장합니다.
- tools/zocbo/extract_mobile_css.py 는 원본 /cloudfront/css/mo/default.css에서 실제 사용한 모바일 메뉴·단원·다운로드·바텀시트 CSS 선언을 추출하여 #phone .zb-faithful 범위로 격리합니다.
- public/zocbo-faithful-ui.js/.css 가 단일 HITEL 네이티브 화면에 원본 구조를 표시합니다. iframe은 사용하지 않습니다.
- server.mjs의 GET /api/zocbo/faithful-index, /api/zocbo/faithful-page, /api/zocbo/public-case-catalog, /api/zocbo/public-filtered, /api/zocbo/public-school-options는 원본 공개 자료와 확인된 필터 요청만 사용합니다.

## 원본과의 메뉴·공개자료 비교 검증

| 구분 | 원본 활성 하위 메뉴 | 필터 | 공개 자료 버튼 |
|---|---|---|---:|
| 중1 과학 | 수준별 학습 | 중1 / 과학 / 공통 / 기본 | 181 |
| 중2 수학 | 수준별 학습 | 중2 / 수학 / 공통 / 기본 | 383 |
| 중3 영어 | 본문 N제 | 중3 / 영어 / 천재(이재영) | 80 |
| 중3 국어 | 단원 집중 | 중3 / 국어 / 미래엔(신유식) / 중단원 학습 | 150 |
| 고1 공통수학 | 수준별 학습 | 고1 / 공통수학 / 공통 / 기본 | 411 |
| 고2·3 영어 | 본문 N제 | 고2·3 / 영어 / 영어Ⅰ / 능률(오선영) | 50 |

중3 영어 원본 자료번호 15065610 클릭 및 정보 표시, 단원 펼침, 천재(이재영)→미래엔(최연희) 교과서 변경 시 원본 AJAX 조회 80→70건 확인.

- 로컬 코드 실제 브라우저: https://github.com/lyonbegin/hitel-room/actions/runs/42463041490
- 배포 Railway 실제 브라우저: https://github.com/lyonbegin/hitel-room/actions/runs/42463735311
- 여섯 학년/과목 및 6개 상단 메뉴·반응형 화면: https://github.com/lyonbegin/hitel-room/actions/runs/42463314600
- 하단 '문제은행' 클릭 회귀검사: https://github.com/lyonbegin/hitel-room/actions/runs/42463812468

## 원본과 동일하지 않거나 미검증인 범위

- 확인된 것은 공개 모바일 화면의 정보 구조·소스 DOM·CSS 일부·메뉴·학년·과목·선택지·자료번호·공개 AJAX 조회입니다. 광고 배너, 사이트 로그인/전체 회원 메타데이터, 유료 콘텐츠 화면까지 픽셀 단위 1:1 전체 사이트 일치는 입증하지 못했습니다.
- 원본 유료 PDF·HWP 다운로드, 문제 본문·정답·해설, 영상 재생, 결제 및 로그인 상태는 복제·검증하지 않았습니다. 자료번호 정보창이 자료를 실제 열람했다고 주장하지 않습니다.
- 원본의 학교별 시험 범위·자료 생성 API는 비로그인 조회가 제한되어 있으며, 학교 지역·학교 선택은 실제 공개 API로 연동하지만 생성 결과는 완료로 판정하지 않습니다.
- 고3 직접 URL은 원본에서 고2·3 통합 또는 고1으로 이동하는 경우가 있으므로 H3 별도 학년 콘텐츠가 모두 확보됐다고 주장하지 않습니다.
- 수집된 700개 원본 화면 중 비동기 목록이 캡처되기 전에 완료된 화면은 기록된 원본 공개 AJAX 요청으로 검색 결과를 보완합니다. 소스가 없는 경우 임의 항목으로 대체하지 않습니다.
- 700개 모든 메뉴 상태의 모든 컨트롤을 사용자가 직접 클릭해 검증한 것은 아니며, 위의 6개 대표 학년·과목과 주요 메뉴 및 필터 조작 중심으로 브라우저 검증했습니다.

## 개발/수정 내역

- 새 브랜치: feature/zocbo-faithful-all-sources-20261108
- 이전 하드코딩 UI의 스크립트 로드를 제거하고 원본 소스 기반 UI로 교체
- 원본 익명 AJAX 요청 양식/교과서 코드 검증 후 조회, 이력 없는 코드 임의 호출 금지
- 원본 CSS는 HITEL 섹터 내부로 격리, 사용자의 다른 HITEL 기능·색상은 유지
- 실제 네트워크/브라우저 검증 완료 후 Railway 서비스의 소스 브랜치를 교체
- TinyFish는 사용하지 않음.
