# HITEL iPhone XR (iOS 18.7) — 초보자용 자동 통화 녹음 접근성 실험

## 설치

- GitHub Release의 \`HITEL-Call-Connected-VoiceControl-Probe-iOS18-UNSIGNED.ipa\` 파일을 Windows + Sideloadly로 본인의 Apple ID에 서명하여 설치합니다.
- 지원 기기: iPhone XR / iOS 18.7 (minimum iOS 17).
- 독립 앱 Bundle ID: \`app.hitel.callconnectprobe\`.
- 다른 HITEL 앱·Railway 서버·전화 앱은 변경하지 않습니다.

## 따라하기 UX (5단계)

1. **음성 파일 자동 생성** — 실행 시 Apple TTS로 영어 "Start Recording" 명령을 \`HITEL-Start-Recording.wav\`으로 만듭니다. 재생·파일 공유가 가능하며 iPhone의 Documents 폴더에 저장합니다. iOS 파일 앱의 "나의 iPhone > HITEL 연결 검증"에 표시되도록 문서 공유 Info.plist 플래그를 설정했습니다.
2. **음성 명령 켜기** — 설정 열기 버튼으로 기기의 설정 앱을 엽니다. 화면 자동 열기 경로는 iOS 공식 보장 URL이 없어 실패할 수 있고, 그 경우 "설정 > 손쉬운 사용 > 음성 명령"으로 수동 이동합니다.
3. **사용자 명령 등록** — 원터치 영어 문구 복사, 실제 제스처 생성 위치와 누를 메뉴를 안내합니다. 사설 앱이 Voice Control에 명령을 자동 추가하거나 다른 앱 화면을 자동 누르는 API는 없습니다.
4. **단축어 구성** — 공식 \`shortcuts://\` URL을 열고 전화 앱 열림 자동화를 안내합니다. 추가할 동작은 **"HITEL 연결되면 녹음 명령 재생"** 딱 하나입니다. 이 동작은 CallKit으로 최장 15초간 연결을 기다리고 WAV 파일을 재생하려고 시도합니다. 동작 취소·중단·시간 제한 가능.
5. **시험 및 진단** — 파일 재생, 현재 CallKit 상태, 로그, 음성 명령 인식 및 실제 메모 녹음 파일 여부를 확인합니다.

각 단계는 \`@AppStorage\`로 현재 위치와 사용자가 확인 표시한 설정을 보존합니다. 체크박스는 사용자의 수동 확인이며 iOS 접근성 설정을 자동으로 검사하는 것이 아닙니다.

## 절대 보장하지 않는 것

- CallKit에서 \`hasConnected=true\`는 조회할 수 있으나, iOS의 백그라운드 앱/단축어 실행 보장은 없습니다.
- 같은 iPhone에서 WAV를 재생한 소리가 통화 중 Voice Control로 인식되는지는 실제 iPhone XR에서 확인해야 합니다.
- iOS 전화 앱의 녹음 버튼을 앱이 직접 누르지 않습니다.
- 전화 앱 열림 자동화는 잠금 중 수신 전화 시작 이벤트와 일치하지 않을 수 있습니다.
- CallKit은 일반전화와 다른 앱 VoIP 호출을 확실히 구분하지 않습니다.
- 기본 전화 녹음이 실제 작동하면 iOS의 안내가 재생되며, 결과는 Apple 메모 앱을 직접 확인해야 합니다.

## 빌드 검증

GitHub Actions에서 실제 iPhone arm64 빌드, unsigned IPA, 원본 소스 ZIP, SHA256 작성 및 별도 Release 게시.
실기기 연결, Voice Control 실행, 백그라운드 단축어 실행은 사용자의 기기에서 확인해야 합니다.

## 참고
- https://support.apple.com/ko-kr/111778
- https://developer.apple.com/documentation/avfaudio/avspeechsynthesizer/write(_:tobuffercallback:)
- https://developer.apple.com/documentation/callkit/cxcallobserver
- https://support.apple.com/guide/shortcuts/welcome/ios
