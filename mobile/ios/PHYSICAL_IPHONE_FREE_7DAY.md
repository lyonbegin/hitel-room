# HITEL 실제 iPhone — 무료 Apple ID 7일 테스트 (Windows / macOS)

이 문서는 **Apple Developer Program 유료 가입 없이** 실제 iPhone으로 HITEL ReplayKit 전체 화면을 방송하여 [SDK Lab](https://hitel-communication-web-production.up.railway.app/sdk-lab)에서 수신하기 위한 설치 안내입니다.

## Apple 공식 무료 개발 한계

- Apple Personal Team: 앱 프로비저닝 **7일 만료**, 아이폰당 최대 **3개 앱**, 7일 주기로 최대 10개 앱 ID, 최대 3대 기기
- **TestFlight는 무료 계정으로 이용 불가**
- 보안 우회·탈옥·무단 서명은 하지 않습니다.
- 유료 Apple 계정의 App Groups 기능은 **`project.free.yml`에서 제거**했습니다.

## A. Windows에서 Sideloadly로 설치 (권장)

1. GitHub에서 최신 **[HITEL-iPhone-Free-7day-unsigned.ipa](https://github.com/lyonbegin/hitel-room/releases/download/hitel-iphone-free-7day-unsigned/HITEL-iPhone-Free-7day-unsigned.ipa)** 다운로드
2. Windows PC에 [Sideloadly 공식 프로그램](https://sideloadly.io/) 설치. 공식 안내에 따라 Apple의 웹 배포판 iTunes/iCloud 드라이버 사용
3. iPhone을 PC와 USB 케이블로 연결하고 **이 컴퓨터를 신뢰** 승인
4. Sideloadly 창에 내려받은 **서명되지 않은 IPA**를 끌어다 놓고, 본인의 **무료 Apple ID**로 로그인하여 서명·설치
5. **중요: 앱 확장을 삭제하거나 Remove App Extensions/PlugIns를 선택하지 말 것.** `HitelScreenBroadcast.appex` 및 `HitelBroadcastSetup.appex` **두 개 모두** 앱에 남아 있어야 합니다. 무료 Apple ID에서 이 구성의 실기기 설치 가능 여부는 실제 설치로 확인해야 합니다.
6. iPhone의 **설정 → 일반 → VPN 및 기기 관리**에서 서명한 개발자 신뢰 승인(필요 시). **설정 → 개인정보 보호 및 보안 → 개발자 모드**도 활성화(필요 시)
7. iPhone에서 HITEL 앱 실행. 웹 SDK Lab에서 **실제 iPhone 연결 준비**를 누른 후 8자리 PIN 확인
8. 업데이트한 iPhone HITEL 앱에서 **화면 공유 → 화면 방송 연결 시작**을 누릅니다. 기존의 **'연결코드 저장'** 방식은 폐지했습니다.
9. Apple ReplayKit의 **HITEL 방송 설정 화면**에서 PC의 SDK Lab에 표시된 **8자리 연결코드를 직접 입력**하고 **연결하고 화면 방송 시작**을 누릅니다. 이 화면은 별도 `HitelBroadcastSetup` 확장이므로 Apple이 `setupInfo`를 방송 업로드 확장으로 직접 전달합니다. **클립보드 접근권한과 App Group은 필요하지 않습니다.**
10. SDK Lab에서 실제 iPhone 영상이 수신되는지 확인합니다. 방송 중에는 아이폰 상단에 화면 공유 표시가 나타납니다.
11. 7일 만료 전후로 같은 Apple ID, 같은 IPA 및 동일 Bundle ID로 재서명·업데이트

> **테스트 상태:** IPA의 macOS 빌드 및 확장 포함 여부까지는 자동 검증 가능하지만, 무료 Apple ID 서명, Sideloadly의 확장 보존, iOS ReplayKit의 실제 방송 시작, 클립보드 허용 팝업은 **실제 기기에 설치하여 검증해야 합니다.** 아직 성공으로 보고하지 마십시오.

### 오류 대응

- "HitelScreenBroadcast가 안 나옴": 설치 툴에서 앱 확장이 삭제되지 않았는지 확인
- "앱이 7일 후 실행되지 않음": 같은 Apple ID로 재서명·재설치
- "연결코드가 유효하지 않음": 웹에서 새로운 8자리 코드 발급 후 **HITEL 방송 설정 확장 화면에서 직접 입력**하십시오. 기존 앱 버전은 업데이트하셔야 합니다.
- "이 앱을 신뢰할 수 없음": 설정 → 일반 → VPN 및 기기 관리에서 서명 개발자 신뢰
- "앱이 설치되지 않음": 무료 프로파일 앱 3개/앱 ID 10개 제한 및 iOS 개발자 모드 점검

## B. macOS Xcode 개인 팀 설치

1. Xcode에 무료 Apple ID 등록 (Personal Team)
2. `cd mobile/ios && xcodegen generate --spec project.free.yml`
3. Xcode에서 `HitelNative.xcodeproj`를 열고 실제 아이폰을 연결
4. 호스트 `HitelNative`, 확장 `HitelScreenBroadcast`, `HitelBroadcastSetup` 모두 **Signing & Capabilities → Automatically manage signing** 및 **동일 Personal Team** 선택
5. 기기에 이미 사용 중인 Bundle ID와 충돌 시 세 Bundle ID를 함께 변경하십시오. 업로드 확장은 `app bundle id + .broadcast`, 설정 확장은 `app bundle id + .broadcastsetup` 형식으로 유지하고 `HitelPhysicalBroadcastSetup.swift`의 preferredExtension도 변경하십시오.
6. Xcode Run으로 iPhone에 설치 후 위 PIN 및 방송 권한 절차 진행

**서명 개인키·Apple ID 비밀번호를 GitHub, Railway, 채팅 또는 공개 파일로 제출하지 마십시오.** 사용자 컴퓨터에서만 서명됩니다.

## 소스와 자동 테스트

- iOS 무료 프로파일 프로젝트: `mobile/ios/project.free.yml` (App Groups 없음)
- PIN 전달: `BroadcastSetup/HitelBroadcastSetupController.swift`(별도 ReplayKit 설정 확장)에서 8자리 입력 후 Apple `setupInfo`를 사용하여 `BroadcastUpload/SampleHandler.swift`로 직접 전달, 클립보드 불필요
- ReplayKit 설정 확장: `HitelBroadcastSetup.appex`를 업로드 확장(`HitelScreenBroadcast.appex`)과 함께 유지해야 합니다.
- 실제 기기용 서명 없는 IPA: `.github/workflows/ios-free-unsigned-ipa.yml`
- GitHub Release: `hitel-iphone-free-7day-unsigned` 태그 (빌드 성공 시만 게시)
- 서버 수신: `sandbox-control/physical-iphone.mjs` 및 `src/device-lab/PhysicalIphonePanel.tsx`
