# HITEL14 완료 M4A 한국어 STT — 원본 코드 적용·외부 검토용 추적 보고서

작성일: 2026-11-09
사용자 원칙: 임의로 STT 알고리즘을 작성하지 않고 공식 sherpa-onnx 완료 파일 전사 예제를 적용. 기존 한국어 Zipformer 유지. 재설치 금지 지시 및 전화·마이크 흐름 보존.

## 실제 적용 원본 A — sherpa-onnx 공식 파일 전사 예제
- 저장소: https://github.com/k2-fsa/sherpa-onnx
- 버전 고정: `v1.12.26`
- 경로: `java-api-examples/StreamingDecodeFileTransducer.java`
- 원본 파일 SHA (Git blob): `75365728ffe75fff0c77335d3c22515c84ae42dc`
- 브라우저: https://github.com/k2-fsa/sherpa-onnx/blob/v1.12.26/java-api-examples/StreamingDecodeFileTransducer.java
- 이 브랜치에 **원문 그대로** 보관: `flow-lab/upstream/sherpa-onnx-v1.12.26/StreamingDecodeFileTransducer.java`
- 핵심 처리 순서: `createStream()` → `acceptWaveform(file PCM, sample rate)` → **0.8초의 tailPaddings** → `while (recognizer.isReady(stream)) recognizer.decode(stream)` → `recognizer.getResult(stream).getText()` → 스트림/인식기 해제.
- **적용되지 않은 원본 부분**: WAV 전용 `WaveReader`, 원본 예제의 중국어·영어 bilingual Zipformer 모델 파일 경로, command-line `System.out.printf` (Android 앱에는 해당 없음).
- **별도 구현하지 않은 처리**: 100ms 분할 후 반복 리셋, `isEndpoint()`, `reset()`, `inputFinished()`, 여러 번 재인식, 사용자 정의 음성인식 결과 합성·필터·선택 로직.
- Android sherpa 1.12.26 Kotlin JNI API 특성상 예제의 Java Builder와 달리 `OnlineModelConfig`·`OnlineRecognizerConfig` setter 호출로 작성. 이는 어댑터/구성 차이이며 원문 1:1 전체 파일을 APK에 직접 컴파일한 것은 **아님**.

## 실제 적용 원본 B — M4A 디코딩
- 저장소: https://github.com/Majkey25/transcriber-android
- 경로: `app/src/main/java/cz/majkey/prepis/AudioTranscriber.kt`
- 앱에 포함된 소스: `flow-lab/TranscriberM4aDecoder.kt` 및 `flow-lab/TranscriberLocalAudioBudget.kt`.
- `decodeAudio()`, `decodeTrack()`, `PcmChunker` 구현은 원본과 동일한 텍스트로 포함하며, Android `ContentResolver` 파일 입력 및 Kotlin→Java 콜백을 연결하기 위한 **래퍼**는 새로 작성.
- **원본 Transcriber의 STT 인식기(Whisper/OfflineRecognizer)는 사용하지 않음.** 디코더만 차용.

## 기존 HITEL14에서 유지한 것
- 모델: `sherpa-onnx-streaming-zipformer-korean-2024-06-16` INT8.
- 파일: `encoder-epoch-99-avg-1.int8.onnx`, `decoder-epoch-99-avg-1.onnx`, `joiner-epoch-99-avg-1.int8.onnx`, `tokens.txt`.
- 동일 앱 내 모델 저장 경로 `sherpa-ko-v1`.
- 기존 독립 마이크 STT: `KoreanSherpaStt.java` — 처리 순서를 수정하지 않음.
- 삼성 기본 전화 연결/녹음 UI 및 종료 (통화 종료와 분리): `SamsungRecordingFlow.java`, `CallAccessibilityService.java`.
- 녹음 파일 전체 목록/선택 후 파일 전사: 기존 `Recordings/Call` 선택 UI 유지.

## 통합을 위해 작성된 코드 및 정확한 역할 — 숨김없이 기재
- `flow-lab/SamsungCompletedM4aTranscriber.java`: **새로 작성한 최소 Android 어댑터**. 파일 선택 결과와 `TranscriberM4aDecoder`의 PCM을 공식 `StreamingDecodeFileTransducer` 호출 순서에 전달하고 진행상태를 표시.
- `flow-lab/v14_completed_recording_asr_integration.py`: 기존 HITEL14 빌드 시 어댑터 파일을 포함하는 기존 패치.
- `flow-lab/TranscriberM4aDecoder.kt`: 상기 오픈소스 원본 함수 + 앱의 최소 입력 콜백 래퍼.
- GitHub Actions workflow: 빌드/서명/패키지명·모델·파일선택 UI 정적 검사. **GitHub Actions 성공은 실제 휴대전화 전사 성공을 증명하지 않음.**

## 실제 검증 상태 표기 기준
- 원본 코드와 적용 코드의 호출 순서 비교, 소스 SHA: 검증 가능.
- Android APK 컴파일·서명·패키지: GitHub Actions 실행 로그로 검증.
- 사용자 제공 M4A의 디코딩(형식과 PCM 신호 존재): ffprobe/ffmpeg 로 별도 검증. 이는 Android `MediaCodec` 결과가 동일함을 증명하지 않음.
- 한국어 전사 성공(실기기): 사용자 로그로 확인되기 전까지 **미검증**. 이미 단문 `근데`를 출력한 이전 앱의 동작과, 다른 파일에서 공백 실패한 동작을 구분.
- 두 실제 통화녹음 파일에 공식 예제의 sherpa JNI가 정확히 어떤 텍스트를 반환하는지: **지금은 아직 독립 재현 미완료**.
- 길고 다수의 파일에서 한 stream의 메모리 사용 및 휴대전화 통화 동시성: **미검증**.

## 원본 적용의 경계 — 외부 검토자에게
이 APK는 공식 sherpa CLI 예제 전체를 문자 단위 복사하여 컴파일한 제품이 아닙니다. 공식 예제는 WAV 파일과 데스크톱 CLI를 대상으로 작성되어 있으므로 삼성 M4A, Android JNI·UI 및 한국어 모델 연결은 변환이 필수입니다. 다만 **음성 인식 순서(PCM 입력 → 0.8초 무음 → isReady/decode → getResult)를 수정하지 않고 그대로 적용**하였고, 파일 디코딩은 검증된 Transcriber Kotlin 메서드를 차용하였습니다.

## 다운로드 파일과 식별 정보
- GitHub 저장소: `lyonbegin/hitel-room`
- 브랜치: `feature/hitel14-official-sherpa-file-transducer-20261109`
- 소스 적용 파일: `flow-lab/SamsungCompletedM4aTranscriber.java`
- 빌드 결과 SHA-256 / APK 패키지명 / Actions run ID: 빌드 성공 확인 후 별도 보고.
