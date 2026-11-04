# HITEL iPhone XR (iOS 18.7) 통화 연결 실기기 검증

## 독립 테스트 앱

- Bundle ID: `app.hitel.callconnectprobe`
- 대상: iPhone XR / iOS 18.7 (최소 지원 iOS 17)
- 핵심: `CXCallObserver`로 수신·발신·연결·보류·종료 관찰
- Shortcuts App Intent: `HITEL 통화 연결 여부 확인` (Boolean)
- Shortcuts App Intent: `HITEL 통화 연결 대기 (최대 15초)` (Boolean)
- 별도 버튼: 영어 합성음 `Start Recording` (음성 명령 제스처 대조 실험)
- 권한: 특별 entitlement 없음. 앱·시스템 전화·WebRTC 서버 수정 없음
- 화면 및 로그: 통화 상태, 앱 백그라운드 전환, 단축어 조회 이벤트 로컬 기록

## 무료 Apple ID / Sideloadly 설치

Release에서 `HITEL-Call-Connected-VoiceControl-Probe-iOS18-UNSIGNED.ipa`를 다운로드하십시오.
Windows + Sideloadly에서 해당 IPA를 선택하여 본인 Apple ID로 **서명한 다음** 설치하십시오.
unsigned IPA를 바로 iPhone에 설치할 수 없습니다. 설치 시 iPhone의 개발자 모드/앱 신뢰가 필요할 수 있습니다.
이 빌드는 App Groups, MediaDevice, ReplayKit 등 특수 권한이 없습니다.

## 권장 테스트

1. 앱을 실행하여 `현재 통화 없음` 상태인지 확인합니다.
2. 단축어 앱에서 `HITEL 통화 연결 여부 확인`을 검색하여 BOOL을 반환하는지 확인합니다.
3. 단축어 `HITEL 통화 연결 대기 (최대 15초)`를 실행해 두고, 실제 전화 연결 전과 연결 후 결과를 비교합니다.
4. 접근성 음성 명령에 영어 `Start Recording`을 등록하고, 통화 없는 상황에서 앱의 시험음 버튼으로 인식을 확인합니다.
5. 단축어 개인 자동화에서 `전화` 앱 `열릴 때`를 선택하고, 대기 Intent의 결과가 true이면 시스템 `텍스트 말하기`에 `Start Recording`을 연결하여 시험합니다.
6. 사용자 지정 제스처는 실제 통화 녹음 버튼 위치를 사용자가 직접 설정해야 합니다. 실기기에서 버튼을 눌렀는지, 메모 앱에 녹음 파일이 생성되었는지 반드시 확인해야 합니다.

## 주의

- CallKit의 `hasConnected`는 실제 연결 여부를 반환하지만, 일반 앱이 잠금/백그라운드에서 계속 실행되도록 보장하지 않습니다.
- CallKit은 **통신사/PSTN과 일부 VoIP 통화를 구분하지 못합니다.**
- 15초 App Intent도 단축어의 실행 시간·중단 규칙 영향을 받으며 성공 보장되지 않습니다.
- 앱은 **통화 녹음 파일을 생성하지 않습니다.** 시스템 UI를 직접 터치할 권한도 없습니다.
- `Start Recording`을 같은 기기에서 재생해도 통화 중 음성 명령이 인식할지는 미검증입니다.
- 통화 녹음은 관련 당사자에게 고지하고 적용 법령에 맞게 시험하십시오.
- 본 소스는 독립된 브랜치이며 HITEL 영상/전화/SDK/Railway 배포를 변경하지 않습니다.

공식 API:
- https://developer.apple.com/documentation/callkit/cxcallobserver
- https://developer.apple.com/documentation/callkit/cxcall/hasconnected
- https://developer.apple.com/documentation/appintents/creating-your-first-app-intent
