# HITEL iPhone 일반전화 실시간 음성 확보 조사 보고
기준일: 2026-11-03. 조사 범위: iOS 18.1~27, 공개 Apple API, 실기기 측정 보고서 및 GitHub 실제 소스.
**이 문서는 조사자료이며 실제 기본 전화의 원격 음성 수집 성공을 뜻하지 않는다.**
기존 영상통화/Communication SDK/Railway 코드는 수정하지 않았다.

## 결론
1. iPhone Phone 앱의 일반전화 녹음·전사 자체는 지원되나 녹음본은 메모에 저장되며, 별도 앱이 통화 중 생성 중인 녹음 파일을 접근할 수 있는 문서화된 방법은 확인되지 않았다.
2. Apple DTS 엔지니어는 Phone/다른 앱이 소유한 실시간 통화 오디오를 제3자 앱에 제공하는 공개 API가 없음을 명시했다.
3. **우선 실험 후보 A:** 사용자 승인을 받은 ReplayKit Broadcast Upload Extension의 .audioApp. iOS 26.6 실제 앱 오디오(Spotify, Instagram)를 수집한 측정 기록이 존재하지만 Phone 통화 원격 음성 실증은 없다.
4. **후보 B:** iOS 27+ ScreenCaptureKit을 활용한 단일 iOS 네이티브 앱 내 SCStream 출력(.audio). Apple은 full-display/other-app capture, audio, background screen-capture modes를 문서화한다. Phone의 보호된 통화 오디오 포함 여부는 미검증이다.
5. iOS 18.2+ AVAudioApplication microphone injection은 **앱의 합성 음성 송신**용이다. 반대 방향 RX 캡처가 아니다.
6. STT는 확보된 PCM의 후처리이며, iOS26 SpeechAnalyzer/SpeechTranscriber나 오프라인 FluidAudio 사용 가능. **PCM 획득 여부가 첫 관문**이다.

## Apple 공식 근거
- 전화 녹음 저장 및 내보내기: https://support.apple.com/ko-kr/guide/iphone/iph57c6590e9/27/ios/27
- 통화 상대 음성 직접 접근 불가 — Apple DTS, 2026-08: https://developer.apple.com/forums/thread/841340
- 다른 앱의 통화 인터셉트 — Apple DTS, 2026-06: https://developer.apple.com/forums/thread/835552
- 타 앱 통화 중 직접 녹음 AudioSession priority: https://developer.apple.com/documentation/avfaudio/avaudiosession/setactive(_:options:)
- iOS27 ScreenCaptureKit 샘플: https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-on-ios
- ScreenCaptureKit 개요 및 공유 picker: https://developer.apple.com/documentation/screencapturekit
- SCStreamConfiguration.capturesAudio: https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/capturesaudio
- ReplayKit framework: https://developer.apple.com/documentation/replaykit
- 합성 음성 통화 추가 Apple 샘플: https://developer.apple.com/documentation/avfaudio/adding-synthesized-speech-to-calls
- CallKit observer 제공 필드: https://developer.apple.com/documentation/callkit/cxcallobserver
- LiveCommunicationKit default dialer는 EU 승인 요구 및 PSTN 호 연결 담당, 음성 소유 아님: https://developer.apple.com/documentation/LiveCommunicationKit/preparing-your-app-to-be-the-default-dialer-app
- Apple SpeechAnalyzer: https://developer.apple.com/documentation/speech/speechanalyzer
- iOS 기능(한국어 녹음/전사/실시간 자막): https://www.apple.com/kr/ios/feature-availability/
- iOS Live Captions 화면 기록 허용 조건: https://support.apple.com/en-gb/guide/iphone/iphe0990f7bb/27/ios/27
- 앱 샌드박스 외부 파일 접근 제한: https://developer.apple.com/documentation/foundation/using-the-file-system-effectively

## GitHub 소스/자료 확인
| 우선순위 | 프로젝트 | 실제 확인한 자료 | 판단 |
|---|---|---|---|
| A | https://github.com/mgkcloud/ios-audio-capture-findings | README; results/README.md; results/gate1-crossapp-PASS.jsonl; results/gate2-mic-concurrency-PASS.jsonl; scripts/verify_audioapp_decode.swift | iOS26.6 실제 타 앱 오디오 비무음 RMS 확인. **Phone 미검증**. 저장소에 라이선스 파일 없음: 소스 복사 대신 방법 참고. |
| A | https://github.com/twilio/video-quickstart-ios | ReplayKitExample/BroadcastExtension/SampleHandler.swift, ExampleReplayKitAudioCapturer.m, README | .audioApp/.audioMic 분기 및 CoreAudio 샘플 파싱 선행 구현. 기본 통화 오디오 가능성 증명 아님. MIT. |
| A | https://github.com/livekit/client-sdk-swift | Sources/LiveKit/Track/Capturers/IOSScreenCapturer.swift, ScreenCapturer.swift, Docs/ios-screen-sharing.md | iOS27 SCContentSharingPicker+SCStream 네이티브 구현과 background 제한 참고. WebRTC SDK 통째로 전화 앱에 넣지 않음. Apache-2.0. |
| A | https://github.com/arraypress/swift-speech-transcriber | Sources/SpeechTranscriber/Streaming.swift | PCM AsyncStream->SpeechAnalyzer->실시간 잠정/확정 전사. iOS26+. MIT. |
| B | https://github.com/simplememofast/ios26-speechanalyzer-live-mic | Sources/SpeechSession.swift, README | iOS26 SpeechAnalyzer, SwiftUI 마이크 입력/PCM 변환 예시. 일반전화 RX 불가. MIT. |
| B | https://github.com/cntrump/AddSynthesizedSpeechToCalls | AddSynthesizedSpeechToCalls/CallAudio.swift, ContentView.swift | Apple 공식 샘플 미러: 통화 음성 송신만, RX는 아님. LICENSE.txt Apple sample. |
| B | https://github.com/FluidInference/FluidAudio | README | 완전 온디바이스 STT/VAD/화자 분리. 음성 수집 자체 제공하지 않음. Apache-2.0. |
| C | https://github.com/siprix/SampleSwiftUI | README | SIP VoIP 자체 통화 녹음 가능. 일반 이동통신 Phone 통화 유지 조건과 불일치. |
| 제외 | https://github.com/kalyan0510/Wiz-Call-Recorder | README | 2016 UI/visualizer 위주. 통신사 통화 양방향 PCM 캡처 증명 없음. |
| 제외 | https://github.com/xiaohuilam/ios-mute-calling-recorder | README | sandbox escape 실험. 일반 앱 구현 방식 아니고 안전·유지보수상 부적절. |

## 실제 검증 계획 — 설치 전 기기 검증이 반드시 필요한 사항
- **가설 1: ReplayKit .audioApp가 Phone 통화 원격 수신 오디오를 포함하는가?** 전화 전용 앱에 독립 Broadcast Upload Extension을 붙이고 사용자 승인을 받아 audioApp/mic의 버퍼 수, RMS/peak, sample format/endian, 통화 시작 전/후, Phone foreground, 잠금 시 상태를 별도로 기록. Spotify/일반 동영상 재생을 양성 대조군으로, 무음을 음성 대조군으로 사용.
- **가설 2: ScreenCaptureKit iOS27+에서 Phone 원격 음성을 .audio로 받는가?** 네이티브 SCContentSharingPicker/SCStream(.audio)를 설정하고, 실제 일반전화 전/중/후에 audio buffer RMS 및 오디오 포맷을 비교. background 'screen-capture' mode, permission, interruption, protected audio 제외 여부 기록.
- **가설 3: 음성으로 판정되는 PCM을 온디바이스 실시간 STT에 투입 가능한가?** 후보 1/2가 통과하는 경우에만 SpeechAnalyzer 또는 동일 API 기반 Streaming.swift를 연결. 원격 사용자 제공 문장에 대하여 수신 음성/자막 일치율과 지연 시간 측정.
- 녹음 파일/Notes 경로는 합법적 파일 공유 또는 문서 선택으로 **통화 후** 가져오기만 검증한다. 통화 중 Notes 앱 내부 파일 직접 읽기 시도는 하지 않는다.
- **합격 기준:** 별도 하드웨어, 통화망 대체, 웹서비스 없이 iPhone 기본 Phone 앱으로 대화 중 사용자 승인 하 원격 음성 비무음 PCM이 실제 획득되고 원격 발화와 자막 일치. UI 빌드 성공/샘플 버퍼 개수만으로 합격 처리하지 않는다.
- 사용자가 요구한 영상 앱/SDK/Railway는 건드리지 않고 전화 전용 브랜치에서 별도 실험 앱만 개발한다.

## 아직 확인되지 않은 것
- Phone 통화 오디오가 ReplayKit audioApp에 포함되는지 — **측정 없음**.
- Phone 통화 오디오가 iOS27 ScreenCaptureKit의 출력에 포함되는지 — **측정 없음**.
- 통화 중 시스템 Call Recording의 메모 앱 저장 데이터를 다른 앱이 실시간 읽을 수 있는지 — **허가된 경로 확인 없음**.
- iPhone 실기기의 iOS 버전과 OS 기능/언어/지역 지원 구성 — **실기기 확인 없음**.

이 문서는 조사 종료 시점에서의 검증 가능한 근거만 기록함.
