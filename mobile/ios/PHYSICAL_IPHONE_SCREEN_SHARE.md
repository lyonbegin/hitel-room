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

GitHub의 `ios-physical-screen-build.yml`은 **코드 서명이 없는 iOS Simulator 빌드만 검증**합니다. Apple Developer 계정, App ID/프로비저닝 프로파일이 연결되어 있지 않기 때문에 **이 빌드를 실제 아이폰에 설치하는 IPA라고 표현하지 마십시오.**

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

## 검증 범위

- 컴파일: GitHub macOS 워크플로에서 호스트 앱 및 ReplayKit 확장 모두 빌드
- Railway: 실제 연결 세션 생성 API 및 WSS 영상 데이터 포워딩 프로토콜 테스트
- **미검증:** 실제 iPhone 설치·ReplayKit 화면 공유 동작·아이폰 화면의 웹 표시
- 스트리밍 전용: 터치/텍스트 명령 수신 구현하지 않음

보안상 방송은 iPhone 사용자가 직접 시스템 화면 방송에서 시작해야 하며, 앱이 임의로 자동 시작하지 않습니다.
