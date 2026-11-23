# 족보닷컴 원본 APK 4.3.11(2): 무료 기출열람실 진입경로 역공학 검증

## 원본 증거
- XAPK 파일 SHA-256: `d45ba34990d4f4eaaad126371023bba74be0ca120b4b26e78af2c4a8fa2ba3a5` (공개 버전 파일 46,163,867바이트와 기존 업로드 파일의 기록이 일치)
- 패키지: `com.eduzone.eduzoneviewer`
- 역공학 실행 성공: https://github.com/lyonbegin/hitel-room/actions/runs/45099650044
- 추출: APK, JADX Java 클래스, `focused_navigation.txt`, `callsites.txt`, `analysis.json` (Actions artifact 참조)

## 네이티브 호출부: 확인
1. `p239z3/e.java` 240~255: `addJavascriptInterface(new WebAppInterface(this.f30308a, new m(hVar,aVar)), "zocbostudyaos")`. `aVar.f30294a`가 참일 때만 등록.
2. `WebAppInterface.java` 123~129: `@JavascriptInterface goPreviousExam()` -> `new p040e3.d(this,6)`을 UI 스레드에 전송.
3. `p040e3/d.java` 58~62: case 6에서 `cVar.q()` 호출.
4. `p239z3/m.java` 329~335: `f30298e`(allowViewerCommand)가 참일 때 하위 `q()`로 전달; 거짓이면 `onGoPreviousExam` 무시.
5. `p239z3/h.java` 506~514: ViewModel `A1.f29300b0.j(Unit)` 이벤트 게시. 해당 이벤트를 최종적으로 소비하는 관찰자의 소스 위치는 특정되지 않음.
6. `A3/L.java` 16~65: `CommonWebviewActivity` Intent 생성, URL은 `EXTRA_WEBVIEW_URL`로 전달.
7. `CommonWebviewActivity.java` 약 5701~5708: `/exam/previousExam.asp`를 URL로 새 Activity 실행하는 코드 확인. 5번 이벤트와 직접 연결되는지 추가 검증 필요.
8. `MainActivity.java` 2069~2100: QR answer 분기에서 사용자 상태 확인 후 `/exam/school/previousExam.asp`를 `L.a(...)`로 실행하거나 `LoginActivity`로 이동. QR 경로임에 주의.
9. `p239z3/k.java` 120~166: `onPageStarted`에서 `/exam/school/previousExam.asp` 경로를 인식하고 window flags 1024을 설정. 1024는 Android `FLAG_FULLSCREEN`이며 스크린샷 방지용 `FLAG_SECURE`(8192)가 **아님**. 따라서 이전 '화면캡처 방지' 설명은 오류였음.

## 웹페이지와 앱 차이
- 일반 웹에는 Android WebView가 주입한 `window.zocbostudyaos`가 기본적으로 없음.
- 앱 내 JS 인터페이스도 config 플래그 `enableJavascriptInterface`와 `allowViewerCommand`가 참이어야 작동.
- 앱 DEX에서 `search_webview=Y` 문자열과 JS 소스는 확보되지 않았음. 해당 URL 파라미터는 외부 URL 리디렉션에서 관찰된 것임.
- GitHub Actions에서 족보닷컴은 HTTP 응답 이전 TCP connection timeout을 보였으므로 서버의 앱 판별·User-Agent 검사를 입증하지 못함.
- 서버 측 HTML/JS, 실제 학교별 문제 데이터 API 호출은 본 APK 정적분석만으로 결정할 수 없음.

## 검증 잔여점
- `A1.f29300b0`의 실제 이벤트 관찰자(앱 내 최종 목적지 코드).
- `CommonWebviewActivity`가 상대 경로와 서버 베이스 URL을 합성하는 구체적 함수.
- 로그인 세션, User-Agent, 요청 헤더 중 무엇을 서버에 전송하는지.
- 실제 기출 열람실 ASP 페이지의 JS가 `zocbostudyaos.goPreviousExam()`을 호출하는지.

판정: 무료 기출열람실에는 Android JavaScript 브리지와 별도 WebView 실행 경로가 존재하지만, 앱 외 브라우저가 막히는 원인이 JS 브리지 부재만인지 서버 접근 정책까지 포함하는지는 아직 결론 불가.
