# 족보닷컴 R17: 원본 캡처 → WebView → JS → SQLite → CSV 실증 결과

검증일: 2026-11-24 (KST)

## 1. 실패 원인 및 재발 방지

- R14는 R13 과거 커밋을 기준으로 만들어 R13 이후 적용된 `regionFilter()` data-order 연동 코드가 누락됨. 실제 사용자가 보고한 '전체 항목을 찾지 못했습니다 / 저장 DB 0건'의 코드 회귀 원인.
- R15 당시 CI가 수집 화면 표시·자동수집 버튼 탭·CSV 저장 대화상자만 검증해 성공 표시. 실제 로그에서는 DB=0, CSV=0, COLLECTOR_PAGE_SAVED=False.
- R15 이후 실제 데이터 개수와 파일 내용이 일치하는 성공 게이트를 도입.
- GitHub CI의 원본 `m.zocbo.com` 요청은 15초 연결 시간 초과. 실제 인증 세션의 서버 수집 성공은 아직 확인되지 않음. **Live server access != offline HTML replay**.

## 2. 보관된 실제 원본 데이터

- 사용자 보관 원본 `붙여넣은 텍스트(1)(9).txt`: `previousExam.asp`에 서버 렌더링된 2022년 고1 한국사 기출 10건. 원본 `data-no`를 그대로 추출해 입력으로 사용.
- 보관 ZIP `Zocbo_Web_Debug_20261123_140024 (2).zip`: 별도 원본 DOM에 2025년 중3 수학 10건을 추가로 확인. R17 WebView 테스트에는 포함되지 않았으므로 R17 10건 시험 성과에 더하지 않음.
- 10건 검증 고유번호 SHA-256 (번호 정렬 후 comma join): `105e63ffe98c84f8c3dc61ee560e16ddaed266115afefec2d96d3b8c91cf7ab5`.
- QA 재현에는 사용자 로그인 토큰, 쿠키, 회원 ID를 포함하지 않음.
- 실제 서버에서 새로 다운로드한 자료가 아니라 과거 사용자 캡처에서 관측한 메타데이터이므로 `source_scope=QA_USER_CAPTURED_HTML_WEBVIEW`로 구별.

## 3. R16 실제 Android SQLite / CSV 합격

GitHub Actions run: https://github.com/lyonbegin/hitel-room/actions/runs/45277424875

- 진짜 Android `ReadingCollectorStore.savePage()`에 실제 번호 10건 저장.
- DB 닫고 새 SQLiteOpenHelper를 통해 쿼리: 10건, 고유번호 10개, checkpoint.page=2.
- Android 앱 `force-stop` 후 재시작: DB=10 유지.
- `ACTION_CREATE_DOCUMENT`에서 실제 CSV 파일 저장.
- `/sdcard/Download` 파일 내용 재독해: 시험번호 집합·학교·제목·출처가 원본과 정확히 일치. 로그 `R16_REAL_EXPORTED_CSV_CONTENT_MATCHES_ORIGINAL_CAPTURE_PASS`.

## 4. R17 운영 JavaScript 추출 경로 합격

GitHub Actions run: https://github.com/lyonbegin/hitel-room/actions/runs/45277779083

- 캡처된 원본 10건을 원본의 `#div_add_school .download`, `[id^=li_freereading][data-no]`, `.text__school`, `.text__subject`, `.class__subject` DOM 구조로 재현.
- 이를 실제 Android `WebView.loadDataWithBaseURL`에 로드하고, 운영 `ReadingOriginalPageCapture.script`를 실행.
- `@JavascriptInterface` 브리지를 거친 응답에서 실제 시험번호 10건 추출.
- **운영 수집 코드**가 `ReadingCollectorStore.savePage`로 즉시 SQLite에 커밋.
- logcat `COLLECTOR_QA_CAPTURED_WEBVIEW_SQLITE_COMMIT page_rows=10 committed=10 db_count=10 origin=PRIOR_USER_HTML`.
- 앱 강제 종료 후 재시작: 10건 유지. Android CSV 내보내기: 10건. 파일 내용의 ID·제목·학교·출처 일치.
- 로그 `R17_REAL_WEBVIEW_JS_TO_SQLITE_RESTART_AND_EXPORTED_CSV_10_PASS live_origin=False`.
- 실행 증거: https://github.com/lyonbegin/hitel-room/actions/runs/45277779083/artifacts/14868712640

## 5. 코드 및 보존 정책

- R17 브랜치: `fix/zocbo-r17-original-webview-parser-proof-20261124`.
- 원본 앱 기본 로그인·뷰어 경로 변경 없음. QA 데이터 주입은 Android 에뮬레이터에서 명시적 Intent extra가 있을 때만 허용.
- 정상 실기기 실행에서는 원본 WebView 렌더링 페이지에 실제 시험번호가 있으면 즉시 SQLite에 저장하며 `source_scope=LIVE_ORIGINAL_WEBVIEW_PAGE1`로 구분.
- 지역 순회는 R15에서 복원한 원본 `ui.js regionFilter()`의 data-order 좌/우 패널 선택을 그대로 사용.
- SQLite 버전 2는 과거 DB의 `exams`, `checkpoints` 테이블을 보존.
- 테스트 APK 서명은 이전 테스트 APK와 다를 수 있으므로 앱 제거·데이터 삭제 금지, 기존 CSV 백업 우선.

## 6. 미완료 항목: 실제 전국 서버 수집

다음 증거가 모두 확보될 때에만 '실제 전국 수집 성공'이라고 보고:
1. 실기기의 로그인된 원본 WebView에서 지역 선택기가 열리고 실제 `areaCandidates >0`.
2. 원본 지역 `전체` 선택과 정상 `previousExam.asp` 반환.
3. `COLLECTOR_LIVE_FIRST_PAGE_SQLITE_COMMIT` 또는 `COLLECTOR_PAGE_SAVED`에 실제 `expapr_no`가 1건 이상 포함됨.
4. `exams` 테이블에서 신규 서버 관측 1건 이상 확인.
5. 페이지별 일시정지·앱 재실행 후 checkpoint 복원, CSV/JSON 완전성 검증.
6. 전국 지역·학년·학기·과목별 전체 범위 완주와 중복/누락 검증.

현재 클라우드 GitHub CI에서 원본 사이트가 연결되지 않아 이 부분은 미검증이며, **성공하지 않았다고 기록**.
