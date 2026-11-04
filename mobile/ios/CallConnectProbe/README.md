# iPhone XR · iOS 18.7 · 바로가기 버튼 제공

기존 HITEL VoiceGrid 테스트 앱에서 설정 화면을 찾아 들어가는 과정을 제거하고, iOS URL 스킴을 사용해 관련 화면을 바로 여는 버튼을 추가했습니다.

## 두 개의 큰 버튼

**① 음성 명령 설정 화면 바로 열기**: 첫 번째 시도는 prefs:root=ACCESSIBILITY&path=CommandAndControlTitle 입니다. iOS가 거부하면 App-prefs 대체 링크, 손쉬운 사용 설정, 설정 앱 순서로 시도합니다.

**② 단축어 새 자동화 화면 바로 열기**: 첫 번째 시도는 shortcuts://create-automation 입니다. 거부하면 shortcuts://automations, shortcuts:// 순서로 시도합니다.

두 경로 모두 해당 세부 화면에 직접 접근하는 것은 Apple이 공개적으로 보장하는 API가 아닙니다. iOS의 URL open 성공은 해당 앱 실행 성공만 뜻할 수 있으며, 특정 화면 표시가 성공했음을 증명하지 않습니다. 앱은 요청 URL과 실패/수락을 로컬 로그에 기록합니다. 본인의 iPhone XR에서 실제 도착 화면을 확인해야 합니다.

앱이 음성 명령을 강제로 켜거나 단축어 개인 자동화를 대신 생성·승인하는 것은 불가합니다. 사용자는 iOS 설정에서 최초 한 번 켜고 단축어 자동화에 HITEL 연결되면 격자 명령 실행 동작을 추가해야 합니다.

## 자동 처리

Apple 내장 음성 명령 Show Grid, One, Tap N을 영어 WAV 파일로 자동 생성·저장하고 CallKit 연결 감지 후 단축어의 HITEL 동작을 통해 재생하도록 시험합니다. 별도 사용자 지정 접근성 제스처는 필요하지 않습니다. Tap 4 기본값은 실제 화면에서 미확인입니다.

## 아직 실기기 검증되지 않은 항목

- iPhone XR iOS 18.7에서 비공식 세부 화면 URL이 정확하게 도착하는지
- 잠금상태·전화 앱 전면에서 자동화가 지속 실행되는지
- 실제 통화 중 자기 스피커 음성이 Voice Control에 인식되는지
- 음성 명령이 Apple 기본 전화 앱의 녹음 버튼을 실제로 누르는지
- Apple 메모 앱에 통화 녹음이 생성되는지

## 다운로드 및 설치

GitHub Release에서 HITEL-iPhoneXR-VoiceGrid-Direct-Setup-UNSIGNED.ipa를 받아 Windows Sideloadly 등의 방법으로 본인의 Apple ID에 서명하여 iPhone XR에 설치합니다. 기존 HITEL SDK 및 Railway 앱은 수정하지 않습니다.

참조: https://support.apple.com/en-asia/guide/shortcuts/apda283236d7/ios
https://developer.apple.com/documentation/uikit/uiapplication/opensettingsurlstring
https://github.com/FifiTheBulldog/ios-settings-urls
