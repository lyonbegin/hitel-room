# IXIO 원본 PCM 입력 → speechSDK 호출 경로 역공학 (2026-11-23)

## 대상 및 원본 증거

- 메인 APK: \`IXIO_Main_OriginalFGSPrestartQA_20261122.apk\`, SHA-256 \`d8876b1396c5cc94d2f44b646d75b4dc1688ef8b04c71109941f598944afdb9b\`
- 별도 녹음 APK: \`IXIO_Recorder_Companion_OriginalFlowTrace_20261122.apk\`, SHA-256 \`25463e9553299371ad0ca37f558c0c232593ff6daf7659c61f27fee3777295e8\`
- 두 파일 모두 기능 계측된 QA 빌드이므로, 원본 로직 분석에 사용한 실행 경로와 사용자 실기기의 패키지 배포 상태를 구분해야 한다.
- 실제 DEX 디스어셈블러: \`baksmali 3.0.10\`, SHA-256 \`37ae4a41a8886e15c20b8362fa4250f96bbdb55e1a608199ad8b5dff068b588f\`
- 원본 PCM 함수 호출 전수 스캔: [Actions 45145148065](https://github.com/lyonbegin/hitel-room/actions/runs/45145148065)
- Kotlin Flow와 STT 함수 호출 관계 재조회: [Actions 45145788986](https://github.com/lyonbegin/hitel-room/actions/runs/45145788986)
- 실제 인자·정규화·권한·상수 검사: [Actions 45146100580](https://github.com/lyonbegin/hitel-room/actions/runs/45146100580)
- 소스 분석 스크립트: \`tools/ixio/reverse_original_pcm_callers_20261123.py\`, \`tools/ixio/probe_original_pcm_bridge_20261123.py\`
- 기존 제품 기준 \`stt/main\`에는 이 연구를 반영하지 않았다.

## 원본 메인 앱: 파일 대신 32ms PCM 버퍼를 직접 공급

메인 \`classes18.dex\`의 아래 클래스를 원본 스말리에서 직접 확인했다.

- \`com.lguplus.aicallagent.incall.call.data.LocalAudioRecordSource\`
- \`LocalAudioRecordSource$uplinkFlow$1.invokeSuspend\`
- \`LocalAudioRecordSource$downlinkFlow$1.invokeSuspend\`
- \`com.lguplus.aicallagent.dip.domain.call.repository.PcmAudioRepository\`
- \`com.lguplus.aicallagent.incall.call.service.CallScriptManager\`
- \`CallScriptManager$readAndRecognizeDownLinkAudio$2.invokeSuspend\`
- \`com.lguplus.aicallagent.data.call.ai.SpeechToTextRepositoryImpl\`

### AudioRecord 설정 — 원본 initAudioRecords() 위치

\`AudioRecord.getMinBufferSize(16000, 0x10, 2)\` 이후 원본 생성자 \`AudioRecord(IIIII)\` 인자:
- **업링크** audioSource = \`2\` = \`MediaRecorder.AudioSource.VOICE_UPLINK\`
- **다운링크** audioSource = \`3\` = \`MediaRecorder.AudioSource.VOICE_DOWNLINK\`
- sample rate = \`0x3e80\` = **16000 Hz**
- channel config = \`0x10\` = \`CHANNEL_IN_MONO\`
- encoding = \`2\` = \`ENCODING_PCM_16BIT\`
- buffer size = \`AudioRecord.getMinBufferSize(16000, CHANNEL_IN_MONO, ENCODING_PCM_16BIT)\`
- 실제 코드는 업링크/다운링크 \`AudioRecord.startRecording()\`을 각각 호출

### 매 프레임 전달 — 원본 downlinkFlow/uplinkFlow 위치

\`AudioRecord.read(shortBuffer, 0, 512)\`를 반복한다. 성공 반환 이후
- 재사용 \`short[512]\` 배열에서 음성 샘플을 읽고
- \`float[512]\` 배열의 각 원소를 \`shortSample / 32768.0f\`로 채운 다음
- \`kotlinx.coroutines.channels.ProducerScope.send(floatBuffer, Continuation)\`로 내보낸다.

즉, **512 샘플 / 16 kHz = 32ms** 단위의 PCM 입력이다. 이 경로에는 **M4A, mdat, AAC 디코딩, MediaCodec, FIR 리샘플링이 없다.**

## 원본 앱 STT 소비자 호출 관계

1. \`PcmAudioRepository.getDownlinkFlow(): Flow\`
2. \`CallScriptManager$readAndRecognizeDownLinkAudio$2.invokeSuspend\`가 \`Flow.collect(FlowCollector,...)\`를 등록
3. \`CallScriptManager.recognizeDownLinkAudio(float[], Continuation)\`
4. \`SpeechToTextRepository.recognize(float[], boolean, int, boolean, String, Boolean, Continuation)\`
5. 실제 구현체 \`SpeechToTextRepositoryImpl.recognize(...)\`
6. \`speechSDK.SpeechInference(float[], int, boolean): kotlin.Triple\` (\`classes16.dex\`의 원본 SDK)

원본 바이트코드에서 \`getDownlinkFlow\`, \`Flow.collect\`, \`SpeechToTextRepository.recognize([F...)\` 및 \`speechSDK.SpeechInference([FIZ)\` 호출을 모두 확인했다.

\`CallScriptManager\` 내부의 \`accumulateSamples(false, 512)\` 호출도 확인했다. 이는 독립적으로 디코더를 다시 실행하는 코드가 아니라, 원본의 프레임 누적·관리 동작이다.

## 별도 통화녹음 APK와의 차이

별도 녹음 APK \`classes6.dex\`에서도 다음의 PCM 생산자를 확인했다.

- \`CallRecordingService$processAudioRecording$downProducerJob$1.invokeSuspend\`
- \`CallRecordingService$processAudioRecording$upProducerJob$1.invokeSuspend\`
- \`InCallService$processAudioRecording$downProducerJob$1.invokeSuspend\`
- \`InCallService$processAudioRecording$upProducerJob$1.invokeSuspend\`
- \`RecordCallbackRepositoryImpl$startRecordingJob$1.invokeSuspend\`

각각 \`AudioRecord.read(short[],int,int)\` 사용을 확인했다. **이는 녹음 APK에도 직접 PCM 수집 경로가 있다는 증거이나, 녹음 서비스의 출력이 반드시 메인 앱의 STT 입력으로 곧장 전달된다는 증거는 아니다.** 메인 앱의 \`LocalAudioRecordSource\`와 두 경로를 혼동하지 않는다.

## 왜 기존 HITEL V10/V11에서는 M4A 복원기를 자체 구현했는가

기존 standalone APK 빌드는 IXIO \`classes6.dex\`, \`classes9.dex\`, \`classes16.dex\`에서 원본 SDK와 JNI를 가져온다. **PCM 원본 구현과 CallScriptManager가 포함된 \`classes18.dex\`는 SDK JAR 구성에서 누락**돼 있었다.

따라서 기존 standalone은 **M4A 증가 파일 → AAC follower → MediaCodec → 직접 FIR 16kHz PCM → IXIO SDK**를 새로 구현했다. 원본 앱은 별도로 **AudioRecord → 16kHz PCM → short/32768 → Flow → CallScriptManager → speechSDK** 경로를 갖고 있다. 이 차이가 이번 역공학의 핵심 발견이다.

## Android 권한 제약 — 가장 중요한 미검증 항목

원본 메인과 녹음 APK의 manifest에는 모두 \`android.permission.RECORD_AUDIO\`, \`android.permission.CAPTURE_AUDIO_OUTPUT\`, \`android.permission.MODIFY_PHONE_STATE\`가 선언되어 있다(원본 APK의 \`aapt dump permissions\` 실제 결과).

하지만 **manifest에 적었다는 사실만으로 보호 권한이 부여된 것은 아니다.** Android 공식 API 설명에서 \`VOICE_UPLINK\`와 \`VOICE_DOWNLINK\`의 캡처는 \`CAPTURE_AUDIO_OUTPUT\` 권한이 필요하며, 일반 서드파티 앱에는 허용되지 않는다고 명시한다.

- [Android MediaRecorder.AudioSource 공식 설명](https://developer.android.com/reference/android/media/MediaRecorder.AudioSource)
- [Android CAPTURE_AUDIO_OUTPUT 공식 권한 정의](https://developer.android.com/reference/android/Manifest.permission)

사용자 Galaxy에서 **원래 설치된 IXIO 메인/녹음기 각각의 실제 \`CAPTURE_AUDIO_OUTPUT\` grant 상태와 해당 AudioRecord 인스턴스가 초기화·녹음에 성공했는지** 아직 확인하지 않았다. 원본 DEX를 재포장하는 것만으로 권한을 승계한다고 주장할 수 없다.

## 분리할 PCM 모듈 경계 및 다음 실험

- **최소 분리 대상**: \`LocalAudioRecordSource\` + 두 \`Flow\` 코루틴 클래스 + 인터페이스 \`PcmAudioRepository\`. 필요 의존성/오디오 효과 및 오류 처리 클래스는 추가 분석한다.
- **재사용 입력 계약**: \`Flow<float[512]>\`, 16kHz mono, 32ms 주기. IXIO 기존 \`speechSDK.SpeechInference(float[],int,boolean)\`에 붙이는 것은 짧은 어댑터로 가능하다.
- 원본 \`CallScriptManager\` 전체는 다른 통화 서비스와 강하게 결합돼 있으므로 대규모 클래스를 그대로 통째로 옮기는 것보다 원본의 음성 Flow 입력 계약만 보존하여 분리해야 한다.
- 첫 시험은 **실기기에서 원본과 독립 APK의 권한과 실제 32ms PCM 발생 여부 비교**다. 원본 권한이 없거나 정식 방식으로 재부여할 수 없다면 **독립 앱의 보호된 다운링크 직접 캡처는 같은 코드 복사만으로 성립하지 않는다.**
- 이미 정상 인식된 \`stt/main\` V10/V11은 유지하고 이 연구 결과를 실험용 분리 모듈로만 적용한다.
