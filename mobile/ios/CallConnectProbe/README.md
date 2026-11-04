# iPhone XR / iOS 18.7 — 기본 음성 명령 격자 자동 터치 실험

## 핵심 변경
사용자 지정 Voice Control 제스처 등록은 필요하지 않습니다. Apple 기본 영어 명령
1. `Show Grid`
2. `One` (왼쪽 위 구역 확대)
3. `Tap Four` (기본 격자 4번 터치, 앱의 숨겨진 '위치 조정'에서 1~9 선택 가능)
순서대로 WAV 파일을 생성하고 iPhone Documents/VoiceGridCommands에 저장합니다.
앱에서 이 파일들을 1.6초 간격으로 시험 재생합니다.

CallKit의 connected 감지 시 **HITEL 연결되면 격자 명령 실행** App Intent가 세 음성을 재생하도록 변경했습니다.
자동 실행은 사용자 개인 단축어 자동화(전화 앱 열릴 때)를 최초 한 번 등록해야 합니다.
음성 명령은 iOS 설정에서 최초 한 번 사용자가 켜야 합니다. iOS에는 제3자 앱이 이 설정을 강제로 등록하는 공인 API가 없습니다.

## 확인된 것 / 확인되지 않은 것
- 컴파일 및 IPA 서명 없는 패키징 성공은 실제 iPhone의 음성 인식 성공을 뜻하지 않습니다.
- iOS Voice Control의 기본 Show Grid / 숫자 영역 선택 / Tap 번호는 Apple 공식 기능입니다.
- 녹음 버튼의 정확한 격자 번호는 기기 화면·iOS 설정에 따라 달라집니다. 'Tap Four'는 보장된 정답이 아닙니다.
- 통화 중 스피커 재생이 Voice Control 마이크에 인식되는지, 단축어 백그라운드 제한,
  Apple 전화 앱이 실제로 녹음 시작하는지 모두 실기기 검증이 필요합니다.
- CallKit에는 일부 VoIP 통화가 포함되며, 통신사 통화만 확실히 구분하지 못합니다.
- 실제 통화 녹음은 통화 당사자의 동의를 받은 뒤 시험하십시오.

## 설치
Release의 `HITEL-Call-Connected-VoiceControl-Probe-iOS18-UNSIGNED.ipa`를
Windows Sideloadly 등으로 본인 Apple ID 서명 후 iPhone XR에 설치하십시오.
기존 HITEL SDK·통화 앱·Railway에는 변경이 없습니다.

공식 문서: https://support.apple.com/guide/iphone/use-voice-control-iph2c21a3c88/ios
