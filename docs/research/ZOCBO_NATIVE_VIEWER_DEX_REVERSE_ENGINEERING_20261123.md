# 족보닷컴 4.3.11(2) — Android 네이티브 시험지 뷰어 DEX 역공학 (2026-11-23)

## 범위 및 원본 검증
- 분석 대상은 웹페이지 JavaScript가 아니라 `com.eduzone.eduzoneviewer` Android 앱의 원본 DEX입니다.
- 공개 원본 XAPK 46,163,867 bytes, SHA-256 `d45ba34990d4f4eaaad126371023bba74be0ca120b4b26e78af2c4a8fa2ba3a5`.
- 원본 SHA 검증 및 JADX 역컴파일 성공: [Actions 45137335237](https://github.com/lyonbegin/hitel-room/actions/runs/45137335237), [증거 ZIP](https://github.com/lyonbegin/hitel-room/actions/runs/45137335237/artifacts/14800412320).
- 기준 파일 `evidence/zocbo-viewer-callgraph/native_viewer_trace.txt`, `viewmodel_network_trace.txt`, `evidence/zocbo-original-dex/focused_navigation.txt` (Actions artifact의 파일명).

## 네이티브 호출 관계 — 소스로 확인
1. `A3/L.java:120~140`: `Intent(packageContext, ViewerActivity.class)`를 생성하고 `EXTRA_PDF_EX_PAPR_NO`, `EXTRA_PDF_FILE_TYPE`, `EXTRA_PDF_SHORT_URL`, `EXTRA_PDF_PRIMARY_KEY` 등을 넣습니다.
2. `ViewerActivity.java:1706~1745`: 각 Intent extra를 읽어서 ViewModel `p229y3/Y0`에 보관합니다. 특히 `EXTRA_PDF_EX_PAPR_NO → f29565k`, `EXTRA_PDF_FILE_TYPE → f29567l`, `EXTRA_PDF_SHORT_URL → f29569m`, `EXTRA_PDF_PRIMARY_KEY → f29571n`을 확인했습니다.
3. `ViewerActivity.java:1800`: `new p079i3/Q0(this,null)` 코루틴을 실행합니다.
4. `p079i3/I0.java:79~87`: 플래그가 참인 경우 `requestTicketData`라는 작업명으로 `new p229y3/T0(y0Y,null)`를 실행합니다.
5. `p229y3/T0.java:40~61`: `Integer.parseInt(y9.f29565k)`로 문서 번호를 수치화한 뒤 `C2002w` 객체를 생성, `settingRepository` 계열 메서드에 전달하고 서버 응답의 `getHasTicket()`을 `f29525L0`에 게시합니다. 이용권 확인 경로이지 PDF 주소 생성 자체는 아닙니다.
6. `p193u3/s.java:42~50`: `PdfData(pdfInfo,exPaprNo,type,subjectCode)` 데이터 클래스이며 `pdfInfo`는 `p203v3/P`입니다.
7. `p203v3/P.java`: `pdf_path`, `qst_list`와 개별 문제의 `qst_path`, `qst_img_path`, `qst_viewer_path`, 정답·해설 이미지 필드, `ticket_yn`, `response_code` 등이 역직렬화됩니다.
8. `p079i3/z0.java:527~529, 643~647`: `P.getPdfPath()`를 확인하고 `Y0.v(pdfPath,false)` 또는 `Y0.v(pdfPath,true)`로 전달합니다. PDF 경로가 비었고 개별 문제 리스트만 있으면 이미지 기반 문제 보기 경로와 구분합니다.
9. `p079i3/P0.java:43~53`: `ViewerActivity`의 ViewModel에서 `getFilesDir()`를 사용하여 PDF 엔진 초기화를 준비합니다. 해당 클래스는 `com.shockwave.pdfium.PdfiumCore`를 참조하므로 네이티브 PDF 렌더링 경로가 존재합니다.

## 핵심 결론
- `expapr_no`는 네이티브 뷰어에 들어가는 **문서 식별자**입니다. 이것이 그대로 최종 PDF 다운로드 URL이라는 증거는 없습니다.
- PDF 경로는 별도로 받아 `P.getPdfPath()`로 추출합니다. 개별 문제 이미지 경로도 별도 필드로 전달됩니다.
- 이용권 조회 `getHasTicket()`는 PDF 경로 추출과 다른 코드 경로입니다. 이것만으로 열람 횟수 차감이 쿠키에서 수행되는지 서버에서 수행되는지는 결정할 수 없습니다.
- 앱 DEX의 `examViewer.asp` 리터럴과 실기기 WebView 로그의 `encText`, `q_path`는 네이티브 PDF 경로와 동일시하면 안 됩니다. 앱 정적 검색에서 `encText` 및 `q_path` 리터럴은 확인되지 않았습니다.

## 아직 미확정 (입증해야 함)
1. `p229y3/Y0.v(pdfPath, ...)` 내부의 다운로드·파일 캐시·PdfiumCore 렌더링 함수 연결.
2. `p193u3/s`의 `pdfInfo` (`P`)를 반환하는 정확한 Retrofit/Repository 인터페이스·HTTP 요청 경로와 파라미터.
3. 실제 열람 차감 및 이용권 적용의 서버측 조건: Android 정적분석만으로 단정 불가.

## 추가 역공학 준비 (현재 실행 여부 분리)
- 브랜치 `research/zocbo-viewer-callgraph-20261123`에 `scripts/zocbo_original_dex/trace_native_viewer_data.py` 신규 작성.
- `.github/workflows/zocbo-viewer-native-callgraph.yml`을 수정하여 동일 원본 SHA 검증 후 `Y0.java`, `S` 등과 PDF 로딩 콜사이트를 더 추출하도록 구성.
- 스크립트·워크플로 커밋 `2cd6d053eb4c0f54ea63cf7eea69fc2eba462b64`, `45d225fa273ad6f4d6c96f5bff0f876da685be84`.
- **새 심화 추출 작업의 성공 실행 로그는 아직 확인되지 않았으므로, 실행 완료라고 주장하지 않습니다.**
