# HITEL iPhone 실기기 일반전화 오디오 시험 앱 — 설치 및 검증 지침

별도 네이티브 SwiftUI 앱이며 기존 영상통화/Communication SDK/Railway에 어떠한 변경도 하지 않습니다. **빌드 성공은 통화 상대방 음성 수집 성공이 아닙니다.**

## 소스 구성
- 앱: mobile/ios/CarrierAudioProbe/
- 방송 확장: mobile/ios/CarrierAudioProbeBroadcast/
- XcodeGen: mobile/ios/project.carrier-audio-probe.yml
- 앱 ID: app.hitel.carrieraudioprobe
- 확장 ID: app.hitel.carrieraudioprobe.broadcast
- App Group: group.app.hitel.carrieraudioprobe

## 실제 iPhone 설치 및 서명
GitHub Actions에서 생성한 UNSIGNED IPA는 그대로 iPhone에 설치할 수 없습니다. Apple 서명 및 Provisioning이 필요합니다.

1. macOS Xcode 및 Apple Developer Team을 사용하십시오.
2. Apple Developer에서 위의 앱·확장 Bundle ID 두 개를 등록합니다.
3. App Group group.app.hitel.carrieraudioprobe를 생성하고 두 Bundle ID에 연결합니다. 기존 영상통화 앱의 그룹은 사용하지 않습니다.
4. macOS에서 xcodegen 설치 후 저장소 mobile/ios 안에서 명령어 xcodegen generate --spec project.carrier-audio-probe.yml 을 실행합니다.
5. HitelAudioProbe.xcodeproj를 열고 앱/방송 확장 두 타깃의 Signing & Capabilities에 동일한 Team 및 App Groups 권한을 적용합니다.
6. 실제 iPhone(iOS 17 이상) 대상으로 HitelAudioProbe 스킴을 설치·실행합니다.
7. 무료 Apple Team에서 App Group 서명을 발급할 수 없다면 앱-확장 데이터 공유가 동작하지 않습니다.

## 실제 통화 시험 11단계
1. 통신사 회선이 개통된 iPhone에서 앱을 열고 App Group 저장소 연결됨 상태를 확인합니다.
2. 새 검사 시작, 대조 · 무음 단계를 선택합니다.
3. 원음 파일이 꼭 필요할 때만 5초 원음 저장을 켭니다. 관련 당사자에게 고지·동의받습니다. 방송 시작 후 0/15/30/60초 지연을 선택합니다.
4. 네이티브 ReplayKit 방송 버튼 → HITEL Audio Probe Broadcast → 방송 시작 순으로 선택합니다. 마이크 계측이 필요하면 방송 마이크도 켭니다.
5. 약 5초간 무음을 유지하여 대조군 audioApp/audioMic RMS와 수신 버퍼 수를 확인합니다.
6. 440Hz 양성 대조 시험음을 재생합니다. audioApp RMS 상승을 확인하고, 다른 앱에서 비보호 소리 재생으로 교차검증합니다.
7. 방송을 종료하지 않고 iPhone 기본 전화 앱으로 실제 발신·수신합니다.
8. 상대방에게 동의받은 지정 문장을 읽게 하고, 통화 중 스피커/수화기/블루투스/보류/잠금 상황에서 오디오 방송이 유지되는지 검사합니다.
9. 통화 종료 후 진단 앱으로 돌아와 audioApp과 audioMic의 버퍼·RMS·peak·무음·format/endian·오류를 확인합니다.
10. 원음을 저장했다면 통화 종료 뒤에만 WAV를 재생하고 한국어 온디바이스 STT를 검사합니다.
11. 측정 JSONL을 공유합니다. WAV는 사용자께서 원하시는 경우에만 따로 공유합니다.

## 해석
- 방송 시작 + 비디오 프레임 수신은 오디오 성공 증명이 아닙니다.
- audioApp 버퍼가 있지만 RMS가 0이면 실질적인 오디오를 받지 못했습니다.
- 440Hz 양성 대조만 성공하면 계측 경로는 유효하지만 일반전화는 아직 미검증입니다.
- 일반전화 도중 audioApp RMS가 상승해도 상대방 음성이라는 증거가 부족합니다.
- 동의받은 WAV에서 상대방이 말한 특정 문장이 직접 들리면 원격 음성 수집 가능성의 실질적인 증거입니다.
- 통화 중 방송이 끊기면 iOS ReplayKit의 activePhoneCall 또는 interrupted 등의 오류·제약 가능성을 무음과 구분해 기록합니다.

## 개인정보
- 네트워크 전송, Railway, 화면 영상 기록 기능이 없습니다.
- 화면 버퍼는 개수만 집계합니다. 오디오 통계는 로컬 App Group JSONL에 남습니다.
- 원음은 기본 저장 OFF이며 명시적으로 ON일 때 audioApp 5초가 기기 내부에 남습니다.
- 새 검사 시작 시 기존 WAV·로그를 삭제합니다. 동의·고지 등 적용되는 법적 요건을 지켜야 합니다.

## 코드·빌드 검증
GitHub Actions 워크플로 ios-carrier-audio-probe.yml은 iPhone ARM64 앱 및 ReplayKit 확장 모두 빌드하고, 기존 영상통화·전화·SDK·웹 파일이 변경되지 않았음을 검사합니다.
iOS 27 ScreenCaptureKit은 별도 iOS 27 SDK·기기에서 추가 실험이 필요합니다. 이 앱은 ReplayKit을 실제 계측 엔진으로 사용합니다.

참고:
https://developer.apple.com/documentation/replaykit
https://developer.apple.com/documentation/replaykit/rprecordingerrorcode/activephonecall
https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-on-ios
https://github.com/mgkcloud/ios-audio-capture-findings
