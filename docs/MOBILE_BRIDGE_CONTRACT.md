# HITEL Android / iOS ↔ Communication SDK 공통 Bridge 계약

대상 저장소: lyonbegin/hitel-room
SDK 브랜치: feature/communication-sdk
네이티브 브랜치: feature/mobile-native

## 1. 실제 구현 위치
- Android: mobile/android/app/src/main/java/app/hitel/nativebridge/MainActivity.kt
- iOS: mobile/ios/Sources/HitelNativeApp.swift
- WebView/브라우저 공통 요청 구현: src/portal/nativeBridge.ts
- SDK API: src/communication-sdk/index.ts (SDK 브랜치에서 개발)

## 2. Web → Native 명령
전송 필드: requestId, action 및 명령별 데이터.
- ping
- getCapabilities
- tts.speak {text, language}
- tts.stop
- call.openDialer {phone}

응답 필드: requestId, ok, platform, 선택적으로 capabilities/error.
JS 요청 시간초과: 8초.
Android WebMessageListener의 HitelNative 객체, iOS WKScriptMessageHandler의 hitelNative 객체를 사용합니다. 인가된 HTTPS 호스트의 메인 프레임만 처리합니다.

## 3. Native → Web 자발적 이벤트
- DOM 이벤트: hitel-native-event
- payload: {type:'app.ready', platform:'android'|'ios'}
- 실행 시점: 앱의 신뢰된 HITEL 웹 화면 로딩 완료 후

`app.ready`는 앱 초기화 알림이지 일반 통화 수신·통화 상태 이벤트가 아닙니다.
SDK가 이 이벤트를 수신하기 전에 웹 스크립트가 초기화될 가능성이 있으므로, 최초 시작 시 `getCapabilities`로 현재 상태를 재조회해야 합니다.

## 4. 기존 보존 및 제한
- 일반전화 다이얼러 시작은 지원하나, 상대방의 통신사 통화 음성 획득·주입 기능은 제공하지 않습니다.
- Android 및 iOS의 nativeBridge, localTts, openSystemDialer, webrtcWebview 값은 실제 구현 기준으로 응답합니다.
- readCellularRemoteAudio=false; injectCellularAudio=false.
- SDK의 개인 AI 상담 응답은 별도 동의나 전송 절차 없이 통화 상대에게 공유하지 않습니다.
- WebRTC는 기존 Fly 서버와 HITEL mediasoup 세션을 사용하며 새 전화망 서버는 구축하지 않습니다.
- 양 브랜치의 Android/iOS Bridge 코드 변경은 동일하게 유지해야 합니다.

## 5. 검증 방법
feature/mobile-native 의 .github/workflows/mobile-emulator.yml:
- Android: APK 빌드, 에뮬레이터 구동, 원격 WebView, 기존 Bridge ping / capabilities 로그, 스크린샷.
- iOS: XcodeGen, 시뮬레이터 빌드 및 구동, Bridge ping / capabilities 로그, 스크린샷.

새 이벤트는 코드에 추가되었으나, CI 스크린샷 및 실제 단말에서 JS 측 이벤트 수신까지 검증한 것으로 표시하지 않습니다.
