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


## 2026-11-23 추가 정밀검증: 앱을 웹과 구분하는 실제 코드

원본 버전 `4.3.11(2)`, SHA256 `d45ba34990d4f4eaaad126371023bba74be0ca120b4b26e78af2c4a8fa2ba3a5`의 전체 JADX 소스에 대해 별도 패턴 검사를 실시함.
실행: https://github.com/lyonbegin/hitel-room/actions/runs/45101051864
산출물: `app_gate_audit.json`

1. **WebView 쿠키 선설정 확인**
   - `p239z3/e.java:365-413`: `CID=<PREF_CREATED_CID>`, `SERVICETYPECD=4`를 `Domain=.zocbo.com`에 CookieManager로 설정.
   - `com/eduzone/eduzoneviewer/repository/C1010a.java:58-61`: `e()`는 `C1020k.b("PREF_CREATED_CID","")`의 값을 반환. 로그인 Access Token과 별도 저장 항목임.
   - `p239z3/e.java:378-410`: `CID`가 비어 있으면 해당 로딩 분기에서 실패 및 반환.
   - `MainActivity.java:1084`: `eVar.h(strA,true)`로 쿠키 선설정 경로 호출.
   - `p107l3/f.java:120-134`에도 동일한 `CID`, `SERVICETYPECD=4` 설정 코드가 존재.
   - 이는 **앱 측 전처리 장치임이 확정**. 서버가 쿠키를 검사한다는 사실은 서버 응답을 확인하지 못해 별도 미검증.

2. **URL의 앱 식별 파라미터 확인**
   - `A3/x0.java:46-56`: URL에 `os-type=aos`, `device_id`, `app_version=4.3.11(2)`를 조건부 추가.
   - 해당 파라미터가 **무료 기출열람실의 실제 목적지**에도 적용되는지는 이 호출 체인의 동적 증거가 부족하므로 미검증.

3. **SSO 웹 세션 전달 경로 확인**
   - `A3/x0.java:15-19`: `https://m.zocbo.com/sso/setCookie.asp`에 `onetime_token_key=<browserKey>`와 `gourl=<targetUrl>`을 사용.
   - `CommonWebviewActivity`와 `ViewerActivity`에도 동종 호출이 존재.
   - 일반적인 앱 외부 Chrome에는 이 앱 세션 연결이 자동으로 공유되지 않음.

4. **JavaScript 네이티브 브리지 확인**
   - `p239z3/e.java:240-255`: `zocbostudyaos`라는 JavaScriptInterface를 config에 따라 등록.
   - `WebAppInterface.java:123-129`: `goPreviousExam()` 호출.
   - `p239z3/m.java:329-335`: config 플래그에 따라 허용/무시.
   - 일반 Chrome에는 이 Android JavaScript 객체가 기본으로 존재하지 않음.

5. **User-Agent와 헤더에 관한 부정 증거**
   - 해당 APK 전체 JADX Java 소스에서 `setUserAgentString(`, `getUserAgentString(` 호출 **0건** 검색됨. 앱이 맞춤 UA를 사용한다는 증거 없음.
   - `modules/HeaderInterceptor.java:107-117`의 `X-API-KEY`, `authorization`, `app-version`, `os-type` 헤더는 앱 HTTP API 클라이언트에서 설정된 것임. 이것이 웹페이지 자체의 WebView 요청에도 자동 첨부된다고 주장할 수 없음.
   - `search_webview=Y` 문자열은 전체 JADX Java 소스에서 0건 검색됨. 외부 웹 리디렉션에서 목적지에 존재하는 것은 별도로 알려져 있음.

6. **네트워크 접근의 별도 문제**
   - GitHub Actions의 족보닷컴 서버 접속은 DNS 성공 후 TCP 연결 단계에서 타임아웃. 구글 200 정상. HTTP `403`/앱 전용 차단 본문을 받은 결과가 아님. 따라서 **서버가 정확히 무엇을 강제 검사하는지 미확정**.

### 판단
앱과 일반 모바일 브라우저를 구별하는 **실제 클라이언트 측 장치**는 (1) WebView 전용 `CID`·`SERVICETYPECD` 쿠키, (2) 앱 식별 URL 매개변수, (3) `zocbostudyaos` 네이티브 브리지, (4) 일부 SSO 플로우의 일회용 키다. 해당 장치 중 어느 것을 족보닷컴 서버가 필수로 검사하는지는 원본 앱만으로는 확정 불가.
