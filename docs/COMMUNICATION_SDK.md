# Communication SDK — HITEL 공통 저장소 개발

## 저장소 및 역할

- 저장소: `lyonbegin/hitel-room` (별도 저장소 생성하지 않음)
- SDK 개발: `feature/communication-sdk` (시작점: `feature/mobile-native`)
- 네이티브 앱 개발: `feature/mobile-native` (Android Kotlin / iOS Swift)
- 기존 웹 화면 및 서비스: 기존 코드 그대로 유지
- 기존 WebRTC 서버: `https://webrtc-new.fly.dev` (서버 수정하지 않음)

앱(Android/iOS) ↔ Native Bridge ↔ Communication SDK → AI Counselor SDK 1.1.0 → VideoCore SDK 1.0.0.

Communication SDK는 VideoCore 구현을 복사하지 않습니다. AI Counselor SDK의 실제 배포 ESM을 런타임에 import하고, AI Counselor SDK가 자체적으로 VideoCore ESM을 import합니다. WebRTC Room의 생성·인증·signaling은 기존 HITEL 앱/서버의 adapter를 호출합니다.

## SDK 주요 API

`src/communication-sdk/index.ts`
- `CommunicationSDK.create(options)` / `createCommunicationSDK(options)`
- `options.nativeBridge`: 다른 앱에서 플랫폼별 Native Bridge를 주입할 수 있는 인터페이스. 생략 시 기존 HITEL `src/portal/nativeBridge.ts`를 그대로 사용
- `getCapabilities()`: Android/iOS/브라우저 기능 판단
- `openSystemDialer(phone)`, `speakLocally(text)`, `stopLocalSpeech()`
- `describeRoute(from, to)`: P/P+/N/W의 16개 상황을 1~16 번호로 식별
- `respondWithAI(text, context)`: 실제 AI Counselor SDK `respond` 호출; 개인 응답 이벤트
- `joinRoom(roomId, stream, roomAdapter)`: 기존 WebRTC 어댑터에 실제 미디어 트랙 전달
- `joinAICounselorRoom(roomId, roomAdapter)`: AI Counselor → VideoCore 경유 카메라/룸 연결
- `leaveRoom()`, `dispose()`, `on(listener)`

`RoomAdapter.join(...)`은 기존 WebRTC 인증/방 참가를 수행하고 `{leave()}`를 반환해야 합니다. 호출 성공이 실제 연결 완료로 보고되는 구조이므로, 기존 서버에 접속하지 않은 테스트용 가짜 adapter를 운영 기능처럼 표시해서는 안 됩니다.

## Android 및 iOS Native Bridge

현재 실제 구현:
- Android: `mobile/android/app/src/main/java/app/hitel/nativebridge/MainActivity.kt`, `window.HitelNative` WebMessageListener.
- iOS: `mobile/ios/Sources/HitelNativeApp.swift`, `window.webkit.messageHandlers.hitelNative` WKScriptMessageHandler.
- 브라우저: `src/portal/nativeBridge.ts`의 capability 기반 브라우저 fallback.
- JS→Native 요청: `{requestId, action, ...}`.
- Native→JS 응답: `{requestId, ok, platform, ...}`; Android reply proxy 또는 iOS `hitel-native-response` 이벤트.
- 요청 timeout: 현재 8초. 지원 action: `ping`, `getCapabilities`, `tts.speak`, `tts.stop`, `call.openDialer`.
- Native→JS 자발적 이벤트: `hitel-native-event`, detail `{type:'app.ready',platform:'android'|'ios'}`.

**현재 Bridge는 전화 앱 열기와 자체 단말 TTS까지만 구현되어 있습니다.** OS 일반전화의 상대방 원음은 읽거나 주입하지 않습니다. `readCellularRemoteAudio=false`, `injectCellularAudio=false` 유지. WebRTC 미디어 사용에도 마이크·카메라 권한과 실제 세션 참여가 필요합니다.

## 단말 간 연결

- N↔N, N↔W, W↔N, W↔W: `roomAdapter`를 통해 기존 WebRTC 서버에 참여. SDK는 세션 수명주기와 오류·참가 이벤트를 전달합니다.
- P/P+가 포함된 경우: 앱 Bridge와 개인 AI 패널은 지원하지만, **외부 일반전화와 WebRTC 연결 자체는 SDK의 범위가 아닙니다.** `describeRoute`는 외부 연결 필요 여부를 알려줍니다.
- P→P: SDK 미실행.
- 각 참여자의 개인 AI 데이터는 기본적으로 외부 참가자에게 전달하지 않습니다.

## 배포 및 테스트

1. SDK 브랜치에서 `npm ci`, `npm run build`, `npx vite build --config vite.communication-sdk.config.ts`.
2. SDK 출력: `dist/sdk/communication.esm.js`. 기존 HITEL 웹 빌드 위에 SDK 번들을 추가하는 방식입니다.
3. Mobile 브랜치에서는 Android Gradle APK, iPhone Xcode Simulator를 **각각** 빌드·테스트합니다.
4. 실제 Android/iOS 단말에서 JS→Native 응답 및 Native→JS `app.ready` 수신 검증 후, 두 브랜치의 변경을 통합합니다.
5. 빌드 파일 생성이나 CI 설정은 실제 단말 통화 성공을 뜻하지 않습니다.

기존 웹 화면이나 HITEL 운영 서비스를 이 작업만으로 교체하거나 자동 배포하지 않습니다.
