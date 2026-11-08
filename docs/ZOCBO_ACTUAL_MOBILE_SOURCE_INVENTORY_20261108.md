# 족보닷컴 실제 모바일 화면·소스 전수 조사 — UI 재개발 이전 근거

작성 2026-11-08 · 조사 전용 브랜치 audit/zocbo-complete-mobile-source-inventory-20261108

## 왜 기존 코드 구조를 폐기하고 다시 조사했는가

사용자 제출 스크린샷에서 중3 영어가 활성화됐는데 기존 HITEL 네이티브 UI는 공통 하위 메뉴 '수준별 학습 / 수학 MASTER'를 표시했습니다. 기존 public/zocbo-all-menus.js의 subtabs 객체는 과목별 분기 없이 수학 메뉴를 모든 과목에 고정하고 일부 상단 탭 전환 시 중2 수학으로 초기화합니다. 따라서 DOM을 확보하지 않은 UI 재현은 정상 판정할 수 없습니다.

## 원본 브라우저에서 실제 확인한 핵심 차이

- 족보닷컴 원본 모바일 중3 영어 단원별 학습 메뉴에는 **본문 N제(활성) / 수학 MASTER(다른 메뉴)** 가 표시됨. 필터는 중3/영어/천재(이재영), 목록에 80개 회차 버튼.
- 원본 중3 국어는 단원 집중(활성), 수학은 수준별 학습(활성)과 수학 MASTER를 표시. 원본 자체에서도 다른 과목에서 수학 MASTER라는 표기가 나타날 수 있음.
- 원본의 수학 MASTER 하위 메뉴를 영어/국어에서 직접 열면 실제 원본 URL이 수학(MT)으로 바뀌는 경우가 확인됐으므로, 이 탭은 수학 전용 메뉴로 동작하는 것으로 보임. 문구만 고쳐서는 안 됨.
- 원본 중3 영어에서 상단 개념학습/단원별/실전/직전 탭 링크를 직접 클릭했을 때, 기본 링크가 중2 수학으로 이동하는 동작도 관측됨. 이 동작은 현 HITEL 코드의 오류와 구분해서 기록함.
- 고등 3학년 독립 필터를 직접 호출하면 별도 과목 목록이 반환되지 않음. 원본은 일부 고2·3 통합 상태를 사용하며 grade=3 직접 URL은 고1 기본으로 리다이렉션되는 사례가 많음.

## 완료된 1차 원본 브라우저 전체 메뉴 조사

| 원본 학년/사이트 | 원본 API 과목 수 | 실제 원본 화면 상태 | 익명 공개 AJAX 응답 본문 |
|---|---:|---:|---:|
| M1 중1 | 8 | 128 | 235 |
| M2 중2 | 9 | 145 | 267 |
| M3 중3 | 9 | 145 | 262 |
| H1 고1 | 7 | 112 | 203 |
| H2 고2·3 계열 | 6 | 98 | 181 |
| H3 독립 링크 탐색(리다이렉션) | 0 | 72 | 140 |
| **합계** | | **700** | **1,288** |

- 700개 화면 상태에서 서로 다른 최종 원본 URL은 325개.
- 원본 자원 56개 고유 JavaScript·CSS URL/파일을 보존.
- 원본 공개 AJAX 응답은 서버의 Content-Type이 text/html인 경우에도 JSON 본문을 직접 재요청하여 보존. 1,288개 재조회 모두 HTTP200, 오류 0건.
- 위 화면 방문/JSON 정상은 로그인 이후 PDF·HWP·문항·해설·동영상 재생 성공을 의미하지 않음.
- 동적 AJAX 로딩 지연으로 화면상 회차가 일시 0개로 표시된 사례가 있으므로 0개를 확정된 자료 부재로 판정하지 않음.

## 공식 링크·원본 자료를 확보한 위치

- 원본 화면 HTML, 자원 JS·CSS, 화면별 캡처와 요청/응답 주소, 종합 CSV 보관: https://github.com/lyonbegin/hitel-room/tree/archive/zocbo-original-browser-sources-20261108/archive/zocbo-original-sources-20261108
- 700 화면의 상단·하위 메뉴 비교 CSV: https://github.com/lyonbegin/hitel-room/blob/archive/zocbo-original-browser-sources-20261108/archive/zocbo-original-sources-20261108/REPORT/ALL_GRADE_SUBJECT_MENU_STATES.csv
- 원본 화면 브라우저 전체 메뉴 자동 점검: https://github.com/lyonbegin/hitel-room/actions/runs/42458879929
- 원본 메뉴 실제 클릭: https://github.com/lyonbegin/hitel-room/actions/runs/42458855823
- 원본 소스 영구 보관 자동 작업: https://github.com/lyonbegin/hitel-room/actions/runs/42459308206
- 공개 AJAX 원본 1,288건 확인: https://github.com/lyonbegin/hitel-room/actions/runs/42459658403

### 익명 공개 AJAX 학년별 보관 브랜치

- M1: https://github.com/lyonbegin/hitel-room/tree/archive/zocbo-public-ajax-M1-20261108/archive/zocbo-public-ajax-M1
- M2: https://github.com/lyonbegin/hitel-room/tree/archive/zocbo-public-ajax-M2-20261108/archive/zocbo-public-ajax-M2
- M3: https://github.com/lyonbegin/hitel-room/tree/archive/zocbo-public-ajax-M3-20261108/archive/zocbo-public-ajax-M3
- H1: https://github.com/lyonbegin/hitel-room/tree/archive/zocbo-public-ajax-H1-20261108/archive/zocbo-public-ajax-H1
- H2: https://github.com/lyonbegin/hitel-room/tree/archive/zocbo-public-ajax-H2-20261108/archive/zocbo-public-ajax-H2
- H3(리다이렉션 기록): https://github.com/lyonbegin/hitel-room/tree/archive/zocbo-public-ajax-H3-20261108/archive/zocbo-public-ajax-H3

## 다음 UI 개발 전 검증 필수사항

1. 상단 6개 메뉴별로 실제 원본 URI와 원본 선택 상태를 그대로 기록하여 라우팅 계약 작성.
2. 학년/과목/교과서/상세과목/수준 선택에 따라 **원본 DOM이 반환한 하위 메뉴**를 표시하고, 임의 고정 메뉴 폐기.
3. 원본 정보가 없는 값은 미검증으로 표시. 한 조합에서 반환된 자료를 다른 학년·과목에 복사하지 않음.
4. 실제 원본 API 요청·응답과 선택 후 화면 이동을 비교하여 메뉴가 열릴 뿐 아니라 해당 데이터가 바뀌는지 검증.
5. 360/390px 화면에서 원본과 기능·표시 항목 일대일 비교 후에만 완료 판정.
6. 로그인·결제·유료 문서 다운로드는 본 읽기 전용 공개 조사에 포함하지 않음.

이 감사 전용 작업에서는 HITEL의 기존 UI 구현 파일을 수정하지 않았습니다.
