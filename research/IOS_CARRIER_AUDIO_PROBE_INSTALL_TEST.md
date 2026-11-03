# HITEL iPhone 실기기 일반전화 오디오 시험 앱 — 설치 및 검증 지침

별도 네이티브 SwiftUI 앱이며 기존 영상통화/Communication SDK/Railway에 어떠한 변경도 하지 않습니다. **빌드 성공은 통화 상대방 음성 수집 성공이 아닙니다.**

## 소스 구성
- 앱: mobile/ios/CarrierAudioProbe/
- 방송 확장: mobile/ios/CarrierAudioProbeBroadcast/
- XcodeGen: mobile/ios/project.carrier-audio-probe.yml
- 앱 ID: app.hitel.carrieraudioprobe
- 확장 ID: app.hitel.carrieraudioprobe.broadcast
- App Group: group.app.hitel.carrieraudioprobe

## Windows Sideloadly + 무료 Apple ID 설치 — 기존 성공 방식

가장 먼저 **HITEL-Phone-Audio-Real-Device-PROBE-FREE-SIDELOADLY-UNSIGNED.ipa**를 선택하십시오.
이 버전은 App Group entitlement가 없으므로 무료 Apple ID 서명에 유리하고, ReplayKit 확장 → 앱 간 결과 전달을 iOS **로컬 알림 payload + WAV 첨부파일**로 대체하는 시험판입니다. 알림 전달 및 첨부파일 전달이 iPhone에서 실제 동작하는지는 별도로 확인해야 합니다.

1. Windows의 Sideloadly를 실행하고, 이전에 정상 사용하셨던 방식대로 iPhone을 USB로 연결·신뢰합니다.
2. FREE-SIDELOADLY-UNSIGNED.ipa를 선택하고 Apple ID를 입력합니다.
3. **Use automatic bundle ID**를 해제하여 원래 bundle ID를 유지하고, **Remove Extensions/Remove Plug-ins**를 끄십시오. 방송 확장 **1개가 반드시 포함**되어야 합니다. 설치 로그의 Dropping 0 of 1 plug-ins 등을 확인하십시오.
4. Start를 눌러 앱과 방송 확장을 서명·설치합니다. 무료 Apple ID는 설치 가능한 앱 수 및 7일 제한이 있습니다.
5. iPhone에서 개발자 모드(필요 시)와 개인 개발자 프로필 신뢰를 확인합니다.
6. 앱을 열고 **측정 결과를 받기 위한 로컬 알림 허용**을 누릅니다.
7. **5초 원음 샘플 저장** 스위치를 명시적으로 켜야 시스템 방송 버튼이 표시됩니다. FREE 판은 방송 시작 30초 후 audioApp 5초를 내부에 저장하려고 시도합니다. 상대방에게 녹음 고지·동의받으십시오.
8. 방송 버튼 → HITEL Audio Probe Broadcast 선택 → 시작. 기존 영상통화 앱과는 별개입니다.
9. 실제 전화 종료 후 앱으로 돌아와 **로컬 알림 결과**를 회수하고 JSONL과 WAV를 내보냅니다.
10. 데이터가 0건이면 알림 허용 여부, 방송 확장 유지 여부, 통화 중 방송 중단 여부를 구분하여 검사하십시오.

유의: 로컬 알림 방식은 현재 코드·ARM64 빌드를 검증한 **실기기 시험 경로**이며, 무료 서명된 iPhone에서 알림 공유와 WAV 첨부파일 수신은 아직 직접 검증되지 않았습니다. 알림 전달이 실패하면 원본 App Group 버전과 별도 서명 요건을 이용해야 합니다.

## 정식 Apple Developer / Xcode 서명(App Group 기능 전체 사용)
GitHub Actions에서 생성한 UNSIGNED IPA는 그대로 iPhone에 설치할 수 없습니다. Sideloadly의 Apple ID 재서명 또는 Xcode/Apple Developer 서명이 필요합니다. Apple 서명 및 Provisioning이 필요합니다.

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
