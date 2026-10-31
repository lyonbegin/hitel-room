# HITEL Communication SDK — 실제 iPhone 화면 방송 (ReplayKit)

기존 iPhone 시뮬레이터와 별개로 **실제 아이폰에서 방송한 화면만** 웹의 `/sdk-lab`에 표시합니다. 사용자가 요청한 대로 원격 터치·키보드 제어는 제공하지 않습니다.

## 구현된 소스

- `Sources/HitelNativeApp.swift` — 기존 HITEL iOS 앱의 **화면 공유** 버튼
- `Sources/HitelPhysicalBroadcastSetup.swift` — 실제 iPhone 연결코드 입력 및 시스템 방송 선택기
- `BroadcastUpload/SampleHandler.swift` — 사용자가 시작한 ReplayKit 방송의 비디오 샘플을 540px 이내 JPEG로 압축, WSS 전송
- `BroadcastUpload/Info.plist` — ReplayKit 방송 업로드 확장
- `project.yml` — iOS 호스트 앱 + `HitelScreenBroadcast` 확장
- `../../sandbox-control/physical-iphone.mjs` — Railway에 추가된 iPhone 전용 수신 세션
- `../../src/device-lab/PhysicalIphonePanel.tsx` — 기존 Android 실기기 패널과 나란히 표시

## 실제 iPhone에 설치하기 전 필수 사항

GitHub의 `ios-physical-screen-build.yml`은 **코드 서명이 없는 iOS Simulator 및 실기기용 ARM64 빌드만 검증**합니다. Apple Developer 계정, App ID/프로비저닝 프로파일이 연결되어 있지 않기 때문에 **이 빌드를 실제 아이폰에 설치하는 IPA라고 표현하지 마십시오.**

1. macOS에서 Xcode와 `xcodegen`을 설치합니다.
2. Apple Developer 팀에 아래 ID를 등록합니다.
   - 호스트 앱 `app.hitel.native`
   - 방송 확장 `app.hitel.native.broadcast`
   - App Group `group.app.hitel.native.screen`
3. 두 App ID에 App Groups capability를 활성화하고 같은 그룹을 등록합니다.
4. `mobile/ios`에서 `xcodegen generate --spec project.yml`을 실행합니다.
5. `HitelNative.xcodeproj`를 열어 두 타깃에 서명 Team 및 프로비저닝을 설정합니다.
6. 실제 iPhone을 Xcode에 연결하거나, 서명 완료된 앱을 TestFlight로 배포하여 설치합니다.
7. SDK Lab 웹에서 **실제 iPhone 연결 준비**를 누르고 8자리 PIN을 확인합니다.
8. iPhone의 HITEL 앱에서 **화면 공유** → PIN 저장 → 시스템 방송 버튼 → `HitelScreenBroadcast` → **방송 시작**을 누릅니다.
9. 실제 프레임이 수신될 때만 웹에 아이폰 영상이 나타납니다. 연결 해제는 아이폰의 화면 방송 중지 또는 웹의 세션 종료로 수행합니다.

## GitHub Actions로 실제 아이폰 서명·TestFlight 설치 자동화

`.github/workflows/ios-physical-testflight.yml`를 추가했습니다. 이 워크플로는 **Apple 계정의 배포 권한이 설정된 후에만 활성화**됩니다. 코드 저장소에 인증서나 비밀키를 직접 커밋하지 않습니다.

Apple Developer와 App Store Connect에서 먼저 준비할 항목:

1. 유효한 Apple Developer Program 팀과 실제 기기 앱 ID `app.hitel.native`, 방송 확장 ID `app.hitel.native.broadcast` 등록
2. 두 ID에 App Groups 기능 추가, App Group `group.app.hitel.native.screen`을 두 타깃에 연결
3. App Store Connect에 위 앱의 앱 레코드 생성 및 **인증 API Key(.p8)** 발급 (앱 배포/서명 권한 보유)
4. GitHub 저장소 **Settings → Secrets and variables → Actions → Secrets**에 다음 네 항목 저장:
   - `IOS_TEAM_ID`: 10자리 Apple Team ID
   - `APP_STORE_CONNECT_KEY_ID`: App Store Connect 키 ID
   - `APP_STORE_CONNECT_ISSUER_ID`: App Store Connect Issuer ID
   - `APP_STORE_CONNECT_KEY_P8_BASE64`: 다운로드한 AuthKey_*.p8 파일을 **base64 인코딩한 값** (개인키를 채팅에 올리지 마십시오)
5. GitHub 저장소의 **Actions Variables**에 `HITEL_IOS_SIGNING_ENABLED=true`를 설정하여 서명 워크플로를 활성화합니다.
6. `HITEL real iPhone signed IPA and TestFlight` 워크플로에서 `upload_to_testflight=true`로 실행하면 Apple에 TestFlight 빌드 업로드를 시도합니다. 앱 심사·처리 및 테스터 초대는 별도로 필요할 수 있습니다.

**서명 정보가 없는 현재 상태에서는 해당 워크플로 실행을 건너뜁니다.** 서명된 IPA도, TestFlight 설치 링크도 아직 없으며, 웹페이지에 가짜 QR을 표시하지 않습니다.

별개로 `ios-physical-screen-build.yml`은 서명 없이 **iOS Simulator + 실제 iPhone용 ARM64 빌드**를 실행하고, 번들 내부에서 `NSExtensionPointIdentifier`, `RPBroadcastProcessMode`, 확장 Bundle ID를 검사합니다. 빌드 아티팩트 ZIP은 **설치 가능한 IPA가 아닙니다.**

## 검증 범위

- 컴파일: GitHub macOS 워크플로에서 호스트 앱 및 ReplayKit 확장 모두 빌드
- Railway: 실제 연결 세션 생성 API 및 WSS 영상 데이터 포워딩 프로토콜 테스트
- **미검증:** 실제 iPhone 설치·ReplayKit 화면 공유 동작·아이폰 화면의 웹 표시
- 스트리밍 전용: 터치/텍스트 명령 수신 구현하지 않음

보안상 방송은 iPhone 사용자가 직접 시스템 화면 방송에서 시작해야 하며, 앱이 임의로 자동 시작하지 않습니다.
