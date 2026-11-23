# 족보닷컴 4.3.11(2) — \`getPdfPath()\` 원본 DEX 종단간 검증

## 원본·실행 증거
- 앱: \`com.eduzone.eduzoneviewer\` 버전 \`4.3.11(2)\`
- 원본 XAPK SHA-256: \`d45ba34990d4f4eaaad126371023bba74be0ca120b4b26e78af2c4a8fa2ba3a5\`
- 원본 XAPK 해시 재검증 + JADX 원본 DEX 디컴파일 실행 성공: https://github.com/lyonbegin/hitel-room/actions/runs/45141670698
- 해당 실행 증거 ZIP: https://github.com/lyonbegin/hitel-room/actions/runs/45141670698/artifacts/14802102955
- 근거 텍스트: \`evidence/zocbo-viewer-callgraph/pdf_loader_deep_trace.txt\` (Actions artifact 내부).
- 주의: *API 메서드와 데이터 흐름은 원본 DEX에서 정적 증명되었으나, 특정 회원·시험지에 대한 실제 PDF URL 값은 인증된 실시간 응답 캡처 없이 확인하지 못함.*

## 입증된 호출 사슬

1. \`com/eduzone/eduzoneviewer/ui/activities/ViewerActivity.java:1709-1740\`: Android \`Intent\` extra \`EXTRA_PDF_EX_PAPR_NO\`, \`EXTRA_PDF_FILE_TYPE\`, \`EXTRA_PDF_SHORT_URL\`, \`EXTRA_PDF_PRIMARY_KEY\`를 \`p229y3/Y0\` ViewModel에 보관.
2. \`p079i3/Q0.java:191-201\`: 초기화 중 \`requestViewerData\` 태스크로 \`new p229y3/V0(device, null, vm)\` 실행. 디바이스 값은 휴대폰 M, 태블릿 T.
3. \`p229y3/V0.java:53-57\`: \`new p203v3/C1994n(Integer.parseInt(f29565k), f29567l, f29569m, f29571n, f29577q=="Y", device)\` 요청 모델 생성. \`repository.I\`의 networkManager가 \`new com.eduzone.eduzoneviewer.repository.E(repository, req, null)\` 실행.
4. \`com/eduzone/eduzoneviewer/repository/E.java:47-51\`: **\`bVar.a(this.f14291i, this)\`**로 Retrofit API 실제 호출. 이 E는 \`p144p3/E\`가 아닌 **\`com.eduzone.eduzoneviewer.repository.E\`**로 import 확인됨.
5. \`p040e3/b.java:98-99\`: API 선언 **\`@POST("app.api.asp?cmd=VIEWER_FILE_PATH") Object a(@Body C1994n, Continuation<? super P>)\`**. \`repository.I.java:17-22\`에서 API는 \`@Named("DotComAPI")\` 주입. 여기 적힌 경로는 Retrofit baseURL에 상대적이며, 호스트는 이 선언만으로 확정하지 않음.
6. \`p203v3/C1994n.java:19-39\`: Gson JSON 요청 필드 \`device\`, \`expapr_no\`, \`file_type\`, \`pk\`, \`short_url\`, \`qr\`.
7. \`p203v3/P.java:71-73,660-662\`: Gson **\`@SerializedName("pdf_path") private String pdfPath;\`**, **\`getPdfPath(){ return this.pdfPath; }\`**. getter 내부 URL 조합·복호화·추가 HTTP 호출 **없음**.
8. \`p229y3/V0.java:67-80\`: 응답 \`P p9=(P)obj\` 보관: \`y9.f29574o0=p9\`. 이벤트 \`new p193u3.s(p9,...)\` 게시.
9. \`p193u3/s.java:42-50\`: \`pdfInfo\` P를 \`f28186d\`에 그대로 보관. \`p079i3/z0.java:489-498,527-529\`: \`P p10=sVar.f28186d; String pdfPath=p10.getPdfPath(); boolean hasPdf=pdfPath.length()>0;\`. 즉 \`p10\`은 앱이 생성한 새 URL이 아닌 서버 응답 P.
10. \`p079i3/z0.java:643-647\`: 종이 전체 PDF 모드에서 \`viewerActivity.Y().v(pdfPath, false/true)\`. 문제별 이미지 모드는 별도 \`qst_list[].qst_img_path\` 흐름이며, PDF 없는 문서도 처리함.
11. \`p229y3/Y0.java:682-690\`: \`v(url,...)\`이 \`new R0(url,...)\` 실행.
12. \`p229y3/R0.java:97-103,139-160\`: \`Q0(url,...)\` 다운로드 후 로컬 파일 검증·\`Pdfium\` 페이지 수 확인.
13. \`p229y3/Q0.java:47-64\` -> \`p229y3/Y0.java:461-470\`: **\`new okhttp3.Request.Builder().url(str).build()\`** 및 **\`new OkHttpClient.Builder().build().newCall(request).enqueue(...)\`**. 경로는 별도 합성 없이 다운로드 URL로 직접 사용됨. 이 다운로드 클라이언트 생성 코드에는 쿠키 저장소/Authorization 헤더 추가 코드가 보이지 않음. URL 자체의 서명·만료 또는 상위 단계 접근제어는 별개.
14. \`p229y3/Y0.java:478-495\`: 로컬 파일 첫 부분 \`%PDF-\` 매직 검사 코드 확인.

## 확정/미검증 구분

**확정**: (a) 단순 시험지 번호→PDF URL 문자열 규칙 생성이 아니라, \`VIEWER_FILE_PATH\` API에서 응답 \`pdf_path\` 수령, (b) 원본 앱이 이 문자열을 OkHttp 요청 URL에 직접 사용, (c) 처음의 권한 조회/열람 횟수와 실제 PDF 파일 경로 조회는 구분되는 흐름.

**미검증**: (a) 사용자가 선택한 특정 시험지의 실제 \`pdf_path\` 값, (b) \`pdf_path\`가 시간 제한/서명 포함인지, (c) 서비스가 해당 PDF URL GET에서 인증 없이 응답하는지, (d) API Retrofit baseURL의 정확한 호스트·경로 조합, (e) 성공·실패별 서버 응답 샘플 및 계정별 열람 차감 시점. PDF URL은 민감한 접근 권한을 내포할 수 있으므로 원문 공유/저장 시 주의해야 함.

## 후속 동적 계측 지점
- \`repository.E.java:48-50\` API 호출 전: 요청 body의 각 필드의 존재 여부와 비민감 \`expapr_no\`, \`file_type\`, \`device\`를 계측. \`pk\`, 세션·토큰은 마스킹.
- \`p229y3/V0.java:67-74\` API 응답 직후: \`response_code\`, \`pdf_path\` 값의 존재·길이·scheme·host·서명/만료 파라미터 존재 여부를 계측. 전체 URL 값은 일반 로그에 남기지 말 것.
- \`p229y3/Y0.java:461-470\` PDF GET 시: URL host, HTTP 상태, Content-Type, 바이트 수, PDF 매직/로컬 렌더 성공 여부. 사용자의 정상 허용 범위 내 시험지로 재현.
