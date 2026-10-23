# Communication SDK Device Lab — 실제 Android/iPhone + Wi-Fi 네트워크

## 실제 서비스

- 통합 UI: https://hitel-communication-web-production.up.railway.app/sdk-lab
- Android 앱이 여는 테스트 페이지: /sdk-lab/device?side=android
- iPhone 앱이 여는 테스트 페이지: /sdk-lab/device?side=ios
- Relay health: https://hitel-device-relay-production.up.railway.app/lab-api/health
- 동일 출처 API: https://hitel-communication-web-production.up.railway.app/lab-api/status
- GitHub: lyonbegin/hitel-room, 브랜치 feature/communication-sdk
- 기존 운영 UI와 Fly WebRTC 서버는 변경하지 않음.

## 위챗/알리 개발 UI와 동일한 이중 화면 구성

좌 Android, 우 iPhone을 동시에 렌더링합니다. 각 iframe은 실제 SDK 웹페이지를 로딩하는 **브라우저 미리보기**입니다. 별도 '실제 에뮬레이터' 모드는 GitHub Actions가 실행한 APK·iPhone Simulator의 실제 화면 캡처를 가져오며, 네이티브 WSS가 살아 있으면 최신 화면을 보여줍니다. 앱이 종료되면 마지막 CI 캡처를 명확하게 표기합니다. 브라우저 iframe을 실제 에뮬레이터로 표시하지 않습니다.

## Native Bridge가 아닌 네트워크 제어

웹 관리 콘솔 -> HTTPS /lab-api/command -> Railway relay -> WSS -> 네이티브 앱에서 OS 명령 실행 -> WSS(result, requestId) -> HTTPS /lab-api/result/:id -> 관리 콘솔.
네이티브 쪽은 Android OkHttp WebSocket, iOS URLSessionWebSocketTask입니다. Native Bridge는 WebView 내부 SDK 호환성의 별도 테스트 경로로 남아 있을 뿐 외부 브라우저 제어에는 사용하지 않습니다.

재사용 가능한 브라우저 네트워크 어댑터: src/communication-sdk/networkAdapter.ts
```ts
import { CommunicationSDK, createCommunicationNetworkBridge } from './communication-sdk';
const client = CommunicationSDK.create({
  nativeBridge: createCommunicationNetworkBridge('android', '<페어링 제어 토큰>')
});
const capabilities = await client.getCapabilities(); // 실제 네트워크 네이티브 응답
await client.speakLocally('안녕하세요');
```
통신사 일반전화 상대방 원음 접근은 제공하지 않습니다.

## 실제 기기 연결

1. 관리 UI에서 Android/iPhone/둘 다 선택 후 'Wi-Fi 기기 페어링 코드 발급'.
2. 실제 앱의 Device Lab 페이지에서 페어링 코드를 입력하고 'Wi-Fi/WebSocket으로 앱 연결'.
3. 네이티브 앱은 페이지 URL의 pair 값만 읽어 네이티브 WSS 채널을 연결합니다. JS->OS 직접 브리지가 이 경로에는 필요 없습니다.
4. 관리 UI의 '실제 에뮬레이터' 모드에서 원격 제어 및 캡처를 확인합니다.
5. 관리 페이지가 발급한 제어 토큰은 발급받은 브라우저에서만 보관하고 운영 서비스 자격증명과 혼용하지 않습니다. 페어링 만료 30분, CI 티켓 만료 15분.
6. 페어링된 일반 사용자의 **라이브 화면은 해당 제어 토큰 소지자만** 볼 수 있습니다. GitHub Actions의 시험용 캡처는 읽기 전용 공개 CI 결과로 제공합니다.

동일 Wi-Fi여야만 하는 것은 아니며 인터넷 WSS로도 같은 방법을 사용합니다.

## GitHub Actions 실기동 및 기록

.github/workflows/mobile-emulator.yml (feature/communication-sdk)
- ubuntu-24.04 / KVM Android Emulator: Gradle APK 빌드 -> 설치 -> SDK Lab WebView -> WSS -> 캡처, Logcat.
- macos-15 / iPhone Simulator: XcodeGen, xcodebuild -> .app 설치 -> SDK Lab WKWebView -> WSS -> 캡처, NSLog.
- 각 job은 GitHub Actions OIDC(issuer token.actions.githubusercontent.com, audience hitel-device-lab)를 받아 Relay에 자체 인증합니다. 인증 확인은 repository, ref, workflow_ref와 RS256 JWKS 서명 검증입니다. 어떤 공용 암호도 코드에 넣지 않습니다.
- CI ticket, controller는 15분 단기 유효, Github Actions 로그에서 마스킹합니다.
- `mobile/tests/lab-ci.py session {android|ios}`: 페어링.
- `mobile/tests/lab-ci.py probe {android|ios}`: 네트워크 getCapabilities 명령, requestId native 응답 확인.
- `mobile/tests/lab-ci.py upload {android|ios}`: 실제 PNG + native 로그 + 통신 검사 결과 업로드.
- Relay /data 는 Railway 500 MB 영속 볼륨; 스크린샷과 CI 요약을 저장합니다.
- /lab-api/status 에서 캡처 여부, runId, 성공 상태 확인, /lab-api/frame/android 와 /lab-api/frame/ios 에서 캡처 원본 확인.
- 중복 빌드에 대해서 GitHub workflow concurrency 취소, 오래된 실행 보고가 최신 캡처를 덮어쓰지 못하게 runId 비교.

## 범위

WebView 앱 런타임, 네이티브 OS 기능의 Wi-Fi/WebSocket 양방향 제어, 개발용 화면/로그 캡처가 범위입니다.
실제 carrier PSTN gateway, cellular 원격 음성 획득, 외부 일반전화 통화 제어는 구현하지 않습니다.
네트워크로 전달된 명령 성공은 네이티브 requestId 응답을 받아야만 성공으로 판정합니다.
GitHub hosted runner는 일시적인 인스턴스이므로 CI 종료 후 실시간 원격 조작이 불가능합니다.
