# 익시오 메인 APK vs 통화녹음 APK: 독립적 원본 코드 분석
검증일: 2026-11-16 (KST). 두 앱의 실제 복원 DEX에 대해 독립 실행으로 분석. **정적 코드와 실기기 실행은 엄격히 구분한다.**

## 분석 대상 및 분리
- MAIN: `com.lguplus.aicallagent` (XAPK 01.33.01)
- RECORDER: `com.lguplus.callrecorder` (APK 02.02.00)
- 개별 분석: [GitHub Actions #43770409971](https://github.com/lyonbegin/hitel-room/actions/runs/43770409971), 분리된 matrix 잡 `Analyze main STT/audio implementation` / `Analyze recorder STT/audio implementation`.
- 캡처 자체는 두 APK가 동일 에뮬레이터에 설치될 수 있으나, **각 잡에서 하나의 앱만 실행·검사**하도록 `IXIO_TARGET_GROUP`으로 제한했다. 이 실험 자체는 **한 앱을 삭제하고 다른 앱을 통화 시연한 시험이 아니다.**

## 메인 앱: STT 엔진 존재 (정적 확인)
- `data/call/ai/SpeechToTextRepositoryImpl.java`: `initialize`, `createSpeechSdk`, `loadModels`, `recognize`, `getRxSpeechRecognitionResultFlow`, `getTxSpeechRecognitionResultFlow`.
- `com/lguplus/ixispeech_ktn/speechSDK.java`: `loadSTT`, `SpeechInference`, VAD 등 온디바이스 음성 처리 구성.
- `incall/call/service/CallScriptManager.java`: PCM 저장소(`PcmAudioRepository`)와 `SpeechToTextRepository`를 동시에 참조.
- `incall/call/data/AidlPollingSource.java`: AIDL `getRecordedDataRx(int[])`, `getRecordedDataTx(int[])`를 별도 RX/TX flow에서 호출.
- `incall/call/data/RecordRepository.java`: `registerRecordCallback`, `startRecordCallback` 및 RX/TX 콜백 수신 경로.
- `incall/call/data/LocalAudioRecordSource.java`: 메인 자체 `AudioRecord`, RX/TX flow `read(..., 0, 512)`; `getMinBufferSize(16000,16,2)`.
- `incall/call/di/PcmAudioSourceModule.java`: `bindAidlCallbackSource`, `bindAidlPollingSource`, `bindLocalAudioRecordSource`.
- `incall/call/domain/usecase/PcmAudioSourceFactory.java`: 실제 소스 선택 책임. 우선순위·조건은 메서드 본문/단말 환경 확인 대상.
- `incall/call/service/CallRecordingService.java`: 메인 앱 내부에도 별도 파일 녹음 `MediaRecorder`가 존재.
- 결론: **메인 앱은 자체 STT를 구현**한다. 그러나 일반 셀룰러 통화 시 별도 RECORDER 앱 없이 다운링크 PCM 확보가 가능한지는 정적 코드 존재만으로 입증할 수 없다.

## 통화녹음 앱: 통화 RX/TX 캡처 및 제공 (독립 실행 검증 완료)
- `CallRecordingService.java` 및 `InCallService.java`: `new AudioRecord(2,16000,16,2,BUFFER_SIZE)`, `new AudioRecord(3,16000,16,2,BUFFER_SIZE)`.
- `data/repository/RecordCallbackRepositoryImpl.java`: `new AudioRecord(2,16000,16,2,512)`, `new AudioRecord(3,16000,16,2,512)`; `sendTxData(int[])`, `sendRxData(int[])`.
- `getRecordedDataTx(int[])` / `getRecordedDataRx(int[])` Binder 인터페이스도 존재.
- `domain/GetMediaRecorderUseCase.java`: 저장용 녹음 `new MediaRecorder(context)`, `setAudioSource(4)`.
- 통화녹음 APK의 이번 복원 Java 코드에서 `speechSDK` 및 `SpeechToTextRepositoryImpl` 정의는 검출되지 않았다.
- `InCallService.java`의 Binder 등록·시작 경로에 `isCallerAllowed()` 호출자 검사가 있다.
- 숫자 설명: 2=`VOICE_UPLINK`, 3=`VOICE_DOWNLINK`, 4=`VOICE_CALL`. 16000Hz, CHANNEL_IN_MONO=16, PCM_16BIT=2. Android 공식 문서에 따라 세 전화 통화 소스는 특별 권한 `CAPTURE_AUDIO_OUTPUT`가 필요하며 일반 3자 앱에는 제공되지 않는다.

## 분리해야 할 세 가지 기능
1. **파일 녹음**: `MediaRecorder`로 저장하는 경로; 실시간 STT 엔진 호출에 파일 완료가 반드시 필요한 것은 아니다.
2. **실시간 PCM 전달**: Recorder의 `AudioRecord` 및 Binder/콜백을 메인이 소비하는 AIDL 경로.
3. **메인 자체 PCM 수집**: `LocalAudioRecordSource`의 `AudioRecord` 경로. 이것이 *실제 전화망 다운링크에서 유효한지*는 소스 선택 조건과 권한, 실제 단말 검증 필요.

## 검증 한계 및 다음 함수
- 메인 `PcmAudioSourceFactory.create`가 어느 조건에서 AIDL callback / polling / local을 선택하는지.
- 메인 로컬 `AudioRecord` 생성자의 audioSource 정수.
- `CallScriptManager.processAudioRecording`이 RX/TX를 `SpeechToTextRepositoryImpl.recognize`에 공급하는 정확한 바이트코드 호출.
- 실제 실기기에서 `CAPTURE_AUDIO_OUTPUT` 수여 여부, 서명·Binder 호출자 검증.
- 일반 앱 HITEL14에 동일 기능을 포팅할 수 있다는 결론은 **아직 아님**.

분리된 실험 코드: `tools/ixio/ixio_split_app_roles_probe.py`, `tools/ixio/ixio_runtime_payload_audit.sh`.
