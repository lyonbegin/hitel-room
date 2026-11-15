# IXIO 01.33.01 / CallRecorder 02.02.00 — 원본 DEX 기반 RX/TX·STT 추적

검증 시점: 2026-11-16 (한국시간).
이 문서는 원본 APK와 실험 산출물로 **확인된 사항**을 문서화한다. 구조적 참조와 실제 통화 중 동작은 구별한다.

## 원본 무결성 및 런타임 DEX

- 메인 XAPK SHA-256 \`4ec4793327930e72589c1d47e552e1e77f97ccf77db71c63c701934f2337a3fc\`.
- 녹음 APK SHA-256 \`3cf822dda33eeef28ec3b85cb5872182371c92d07ed100e3a0fab71fbf1a37d7\`.
- AppSealing 런타임 \`app_payload_lib\`에서 **메인 DEX 4개(익시오 고유 클래스 정의 31,300개)**, **녹음 DEX 1개(녹음 앱 고유 클래스 정의 517개)**를 검증했다. 이는 소스 파일 수가 아니다.
- 정상 DEX 구조와 SHA-1 / Adler-32, 원본 APK DEX 대비 SHA-256 차이를 확인했다. 이것만으로 원래 서버·통신 권한을 복구했다는 뜻은 아니다.
- [런타임 DEX 구조·클래스 검증](https://github.com/lyonbegin/hitel-room/actions/runs/43762988781)
- 녹음 DEX를 JADX 1.5.6 \`simple\` 모드로 변환하자 고급 \`auto\` 모드의 오류 104건이 0건이 되었다. **Java 파일 188개 생성**, 단 세부 동작은 바이트코드 검증 필요.
- [JADX auto vs simple 비교](https://github.com/lyonbegin/hitel-room/actions/runs/43765211668)
- 메인 4 DEX 대상 별도 JADX 작업에서는 **Java 파일 9,249개, 역컴파일 오류 표식 포함 파일 137개**가 생성되었다. 이 수는 전체 원본 코드가 완전 복원되었다는 지표가 아니다.
- [메인/녹음 앱 병행 함수 분석](https://github.com/lyonbegin/hitel-room/actions/runs/43765006137)

## 양방향 PCM의 실존 API (정적 확인)

녹음 앱 복원 코드에서:
- \`CallRecordingService\`, \`InCallService\`는 \`getRecordedDataRx(int[])\`, \`getRecordedDataTx(int[])\`, \`processAudioRecording()\`을 가진다.
- \`IRecordCallback\` AIDL에는 \`sendRxData(int[])\`, \`sendTxData(int[])\`, \`onStarted()\`가 있다.
- \`ICallRecordingAidlInterface\`는 녹음 서비스 제어·녹음 데이터 관련 메서드를 선언한다.
- \`IPcmPlayerAidlInterface\`에는 \`sendAudioData(byte[])\`, \`startPlayer()\`가 있다. 이는 **재생 API**이며 수신음 캡처 API라고 볼 수 없다.
- \`CallRecordingService$processAudioRecording$upProducerJob$1\`, \`...downProducerJob$1\`가 있다.
- \`AudioRecord\` 사용 참조가 있다. 실제 \`audioSource\` 정수/상수는 정적 함수 본문으로 별도 검증한다.

메인 앱의 복원 코드에서:
- \`incall/call/data/AidlPollingSource\`
- \`incall/call/data/LocalAudioRecordSource\`
- \`incall/call/di/PcmAudioSourceModule\`
- \`dip/domain/call/repository/PcmAudioRepository\`
- \`dip/domain/call/repository/DownlinkChunkTimestampAwarePcmAudioRepository\`
- \`data/call/ai/SpeechToTextRepositoryImpl\`
- \`incall/call/domain/usecase/SttDataIntegrationUseCaseImpl\`
- \`com/lguplus/ixispeech_ktn/speechSDK\`, \`IxispeechSDK_renewal_mergeKt\`, \`AudioRecorder\`

위 클래스들의 **존재**는 확인했다. 주입 모듈의 소스 선택 조건, 실제 콜백 데이터 형식, STT 엔진으로 PCM이 전달되는 정확한 함수 경로는 아직 확인 중이다. 메인 통신 앱과 녹음 앱의 바인더 권한이 일반 외부 앱에 제공된다는 의미도 아니다.

## 진행 중인 실증

[Actions #43766514061](https://github.com/lyonbegin/hitel-room/actions/runs/43766514061) 은 원본 JADX 출력을 대상으로 메서드별 API 참조와 실제 \`AudioRecord\` 설정 인자를 수집한다. 분석 코드는 \`tools/ixio/ixio_static_calltrace_probe.py\`이며 재구현 덤퍼가 아니다.

- \`AidlPollingSource\` / \`LocalAudioRecordSource\` / \`PcmAudioSourceModule\` 사이의 호출 관계와 실제 선택 조건
- \`CallRecordingService\` RX/TX 콜백에서 메인 앱 PCM 저장소까지의 정적 참조
- \`SpeechToTextRepositoryImpl\`과 \`speechSDK\`의 동작 연결
- \`MediaRecorder.AudioSource\`, \`AudioRecord.Builder.setAudioSource\`, 샘플레이트/인코딩 설정
- Manifest 및 Binder 서명·권한 검증은 실제 단말에서 별도로 확인해야 한다.

## 완료의 정의

검사 보고서에 **실제 함수 본문을 근거로 한** 입력 소스, PCM 데이터 타입/샘플레이트, RX/TX 식별, AIDL 호출·콜백 방향, STT 입력 함수와 동작 조건, 녹음/통신 권한 범위를 연결해 기록해야 한다. 해당 증거 없이 "일반 안드로이드 앱으로 통화 하향 PCM 직접 캡처 가능"으로 판정하지 않는다.

원본 DEX와 역컴파일 소스는 암호화하여 보존하고 공개 GitHub 산출물에는 구조적 분석 메타데이터만 기록한다.
