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

## 추가 검증: PDF 다운로드 및 파일 형식 검사

원본 SHA 검증·JADX 추출·Y0 구현 확보가 완료된 [Actions 45140348098](https://github.com/lyonbegin/hitel-room/actions/runs/45140348098) 기준입니다.

- `p229y3/Y0.java:461~475`: `Y0.g(Y0,String,Q0)`에서 `new Request.Builder().url(str).build()`, `OkHttpClient` 생성, connect/read/write 각 30초 타임아웃, `callNewCall.enqueue(...)`를 실행합니다.
- `p229y3/Y0.java:478~495`: `Y0.h(Y0, File)`에서 로컬 파일의 첫 1,024 bytes를 읽고 `"%PDF-"` PDF 시그니처를 검사합니다.
- `p229y3/Y0.java:620~626`: `m()`은 ViewModel의 `f29508D` (`pdfFilePath`)를 반환합니다.
- `p229y3/Y0.java:675~679`: `u(pageIndex,fitSize,...)`에서 `loadBitmapFromPDF` 렌더링 코루틴을 실행합니다.
- `p229y3/Y0.java:682~690`: `v(String url, boolean)`는 `new p229y3/R0(url,z9,this,null)`를 생성하고 `loadPageType`으로 실행합니다.
- 이들은 동일 `Y0` 클래스의 실제 코드입니다. 단, `R0` 내부에서 어떤 경로로 `Y0.g`와 `Y0.h`를 순서대로 호출하는지는 아직 확인이 필요합니다.

## 아직 미확정 (입증해야 함)
1. `Y0.v`가 실행하는 `p229y3/R0`의 코루틴 내부에서 `Y0.g`의 다운로드 결과가 캐시 파일과 PdfiumCore에 연결되는 정확한 함수 체인.
2. `p193u3/s`의 `pdfInfo` (`P`)를 반환하는 정확한 Retrofit/Repository 인터페이스·HTTP 요청 경로와 파라미터.
3. 실제 열람 차감 및 이용권 적용의 서버측 조건: Android 정적분석만으로 단정 불가.

## 추가 역공학 준비 (현재 실행 여부 분리)
- 브랜치 `research/zocbo-viewer-callgraph-20261123`에 `scripts/zocbo_original_dex/trace_native_viewer_data.py` 신규 작성.
- `.github/workflows/zocbo-viewer-native-callgraph.yml`을 수정하여 동일 원본 SHA 검증 후 `Y0.java`, `S` 등과 PDF 로딩 콜사이트를 더 추출하도록 구성.
- 스크립트·워크플로 커밋 `2cd6d053eb4c0f54ea63cf7eea69fc2eba462b64`, `45d225fa273ad6f4d6c96f5bff0f876da685be84`.
- 위 심화 추출 1차 실행 [Actions 45140348098](https://github.com/lyonbegin/hitel-room/actions/runs/45140348098)은 성공했습니다. R0 및 PDF API의 추가 추적은 별도 실행 단계입니다.


## 2026-11-23 후속 정밀검증: 서버 API와 네이티브 PDF 로더 연결 완료

원본 SHA-256 검증을 다시 통과한 [Actions 45140997725](https://github.com/lyonbegin/hitel-room/actions/runs/45140997725), [원본 DEX 후속 증거 ZIP](https://github.com/lyonbegin/hitel-room/actions/runs/45140997725/artifacts/14802635389)의 `pdf_loader_deep_trace.txt` 기준입니다.

### A. PDF 파일 경로 요청: 원본 Retrofit 인터페이스

- `p040e3/b.java:98~99`: `@POST("app.api.asp?cmd=VIEWER_FILE_PATH")` / `Object a(@Body C1994n, Continuation<? super P>)`
- `p203v3/C1994n.java:19~39,55~69`: 요청 JSON 항목 `expapr_no` (int), `file_type` (string; 기본 `Q`), `short_url` (string; 기본 공백), `pk` (string; 기본 공백), `qr` (boolean; 기본 false), `device` (string). 요청 객체의 실제 호출자와 서버 응답은 별도 동적 검증 필요.
- `p040e3/b.java:166~167`: 별도 이용권 API `@POST("member.api.asp?cmd=PAY_TICKET_INFO")` / 요청 `C2002w`, 응답 `X`; `p229y3/T0.java:40~61`는 문서 번호로 `getHasTicket()`을 확인.
- `p040e3/b.java:80~81`: 별도 정답 권한 API `@POST("app.api.asp?cmd=ANSWER_VIEW_CHECK")`. 이를 PDF 경로 API와 혼동하면 안 됨.

### B. PDF 다운로드부터 렌더링까지 — 실제 구현

1. `p079i3/z0.java:527,643~647`에서 `P.getPdfPath()` 문자열을 `Y0.v(pdfPath,...)`에 전달.
2. `p229y3/Y0.java:682~690` `v(url,flag)`는 `new R0(url,flag,this,null)`를 `loadPageType` 코루틴으로 시작.
3. `p229y3/R0.java:95~106`: `new Q0(url,null,y10)`를 백그라운드 작업으로 실행.
4. `p229y3/Q0.java:47~64`: `Y0.g(y9,str,this)` 다운로드 작업을 수행해 `java.io.File`을 돌려주고 `IOException`이면 `PDFDownloadFailException` 발생.
5. `p229y3/Y0.java:461~475`: `OkHttpClient`로 해당 URL에 GET 요청, 각 30초 시간 제한, 비동기 응답 콜백으로 파일 수신.
6. `p229y3/R0.java:139~159`: 내려받은 `File`이 실제 파일인지 검증하고 `f29508D=File.getPath()`로 저장, `p031d3.d(path,...)` 작업으로 페이지 수 조회.
7. `p229y3/R0.java:137,178`: 페이지 수와 로딩된 파일을 LiveData `f29586u0`에 게시.
8. `p229y3/Y0.java:675~679` `u(page,fitSize,...)`에서 `P0` 코루틴 실행.
9. `p229y3/P0.java:90~116`: `PdfiumCore`와 로컬 PDF 파일 경로를 `p031d3.c(...)`에 전달, 반환한 `Bitmap`을 `f29584t0`에 게시.

보조 검증: `Y0.java:478~495`의 `Y0.h(file)`는 파일의 `%PDF-` 매직 문자열을 확인하는 함수입니다. **해당 함수가 위의 모든 실행에서 반드시 호출된다고 단정할 수는 없습니다.**

**JADX 주의:** `R0.java`에는 `Invalid total page count` 분기 및 초기화되지 않은 변수와 관련된 명백한 역컴파일 제어흐름 오류가 있습니다. 위 결론은 호출·필드 사용에 대해 입증된 것만 채택하며, 오류가 있는 비교식은 실제 로직으로 단정하지 않습니다.

### C. 연결된 원본 구조

```
Intent(EXTRA_PDF_EX_PAPR_NO)
     -> ViewerActivity.onCreate / Y0.f29565k
     -> Retrofit VIEWER_FILE_PATH (ReqPdfPath -> P)
     -> P.getPdfPath()
     -> Y0.v() / R0 / Q0
     -> Y0.g() / OkHttp GET
     -> File / 내부 pdfFilePath
     -> PdfiumCore / p031d3.c / Bitmap

별도: 문서번호 -> PAY_TICKET_INFO -> hasTicket
별도: ANSWER_VIEW_CHECK -> 정답 권한 판단
```

여기서 `Intent -> VIEWER_FILE_PATH`의 구체적인 중간 호출자와 서버의 인증 검사는 별도 검증 대상으로 남습니다. 정적 소스로 허가되지 않은 열람이나 번호만으로의 직접 다운로드가 가능한지는 입증되지 않았습니다.
