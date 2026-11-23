# 삼성 기본 전화 자동 녹음 → PCM → 경량 독립 STT (2026-11-23)

## 범위
- 기본 전화 앱: 삼성 기본 전화 앱 그대로 유지
- LG U+ IXIO 메인, LG U+ 통화녹음 보조 APK: 미사용
- 최초 한 번: Samsung Record Accessibility 명시적 활성화, Recordings/Call SAF 폴더 권한, 전화 상태 권한, 앱의 감시 시작
- 이후: 앱 화면을 열면 이전에 명시적으로 켠 감시 설정을 재개, OFFHOOK 감지 시 삼성 통화 화면의 녹음 시작 버튼 즉시 요청
- 성공 판정: 버튼 클릭 성공이 아니라 M4A 파일 크기 증가 3회
- 오디오: 지속 증가하는 삼성 M4A → AAC-LC 프레임 복원 → 48k→16k Mono PCM16 → signed short/32768.0f → Sherpa OnlineStream
- 종료: IDLE 감지 시 STT flush, 원본 녹음파일 보존, 진단 ZIP 기록

## 소스 재사용 경로
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/CallStateGate.java`
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/SamsungRecordAccessibility.java`
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/SpeakerService.java`
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/SpeakerEngine.java`
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/StreamingAacPcmDecoder.java`
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/DirectPcmKoreanStt.java`

## 신규 변경
- `SpeakerService.onCallConnected()`: `launchSession(true)` 직후 `requestRecordingFromUi(session,0L)`.
- 기존 2.5초 후 무증가 콜백은 보조 재확인 역할로 유지.
- 접근성은 삼성 전화 UI의 녹음 시작 명칭만 검사하며, `녹음 중지` 또는 이미 녹음 중에는 클릭하지 않음.
- 녹음 앱 UI가 응답하더라도 원본 M4A 크기 증가가 없다면 녹음 성공으로 보고하지 않음.
- 통화 종료 및 서비스 중단 시 접근성 요청 취소.
- `MainActivity`는 사용자가 감시 기능을 한 차례 명시적으로 켠 경우에만 다음 화면 진입 시 재가동.

## IXIO STT 분리 상태
이 브랜치의 실제 실행 인식기는 이전 HITEL14에서 사용하던 오픈소스 Sherpa-ONNX 한국어 Zipformer입니다.
원본 IXIO `speechSDK.SpeechInference`, `CombinedSTTKWS`, 원본 모델 추출·독립 실행·라이선스 검증은 **아직 완료되지 않았습니다**.
따라서 이 브랜치를 'IXIO 원본 speechSDK 분리 완료'라고 부르지 않습니다.
원본 IXIO 엔진을 사용하려면 최소 의존성 추출 후 사전 PCM 주입 시험에서 실제 문자 출력이 입증되어야 합니다.

## QA 검증 단계
1. Java 회귀 테스트 `GrowingM4aSelectorTest` 합격
2. ARM64 바이너리/모델 포함/서명/패키지 ID 검사
3. 삼성 실기기 접근성 승인 → 사용자의 감시 시작 → 통화 연결
4. `RECORDING_IMMEDIATE_ACCESSIBILITY_REQUEST`, `RECORD_START_BUTTON_TAPPED_NOT_YET_VERIFIED` 확인
5. `RECORDING_VERIFIED_BY_M4A_GROWTH`, AAC 신규 프레임, `PCM_DIRECT_QUEUED` 확인
6. `DIRECT_PARTIAL` 또는 `DIRECT_FINAL_SEGMENT`의 실제 음성 내용 출력 확인

2번까지는 CI에서 검사 가능하지만 3~6은 갤럭시 실제 통화로 검증해야 하며 지금 성공을 주장하지 않습니다.
