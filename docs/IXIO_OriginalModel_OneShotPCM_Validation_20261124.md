# IXIO 원본 모델 사용 및 최초 PCM 정리 검증 기록 (2026-11-24)

## 적용 코드 (원본 `stt/main` 변경 없음)

- 검증 브랜치: `feature/ixio-stable-virtual-call-replay-20261124`
- 최신 M4A 즉시 선택: `SpeakerEngine.waitForRecording` -> `LATEST_M4A_SELECTED_NO_GROWTH_GATE`
- 이전 AAC 건너뛰기 `LIVE_PLAYBACK_CUTOFF`: 제거
- SDK 준비 시 PCM 큐 1회 정리: `PcmReadyLatestGate.trimPreReadyBacklog(queue)`
- 이후 입력: FIFO. 원본 `speechSDK.SpeechInference()`과 AAC 디코더 자체는 그대로

## 공개 Android 15 에뮬레이터에서 **실제로** 확인한 범위

[실행 #45288564537](https://github.com/lyonbegin/hitel-room/actions/runs/45288564537) 전체 성공:
- Android 15 x86_64 + `libndk_translation.so`에서 ARM64 APK 설치 성공
- 앱 화면 실행 성공
- M4A 증가, 최신 파일 즉시 선택, AAC follower 시작, 증가 파일 복사 확인
- 원본 STT 모델 파일이 공개 시험 APK와 에뮬레이터에 **없었으므로** 원본 Android `SpeechInference()`의 자막 출력은 미검증

## 공개 원본 IXIO APK 확인

[실행 #45295217810](https://github.com/lyonbegin/hitel-room/actions/runs/45295217810):
- `IXIO_Main_OriginalFGSPrestartQA_20261122.apk`의 모델 이름과 크기만 검사
- `assets/stt/bpe.vocab` 21,650바이트 존재
- `encoder.ort`, `decoder.ort`, `joiner.ort`, `vad.onnx`, `tokens.txt` 등 완전한 모델 세트 없음
- 모델 바이너리 및 실제 통화음성은 GitHub에 업로드하지 않음

## 로컬 비공개 원본 모델 추론 시험

근거는 **사용자가 제공한** `IXIO_STT_Original_4.0.4.zip`과 `통화 녹음 100_261112_235500.m4a`; 원본 모델 가중치를 x86_64 CPU ONNX Runtime에 적재. 이 시험은 Android IXIO SDK 구동이 아닌 **모델 추론 검증용 독립 CPU 실행**이다.

- 모델 준비 시점을 음성 원본의 3.5초로 **가정**
- 준비 시 PCM 512샘플 큐 109개 -> 오래된 108개(3.456초) 1회 폐기, 최신 1개(32ms) 유지
- 이후 새로 공급한 PCM 328개(167,936샘플)를 FIFO 순서대로 보존
- 원본 모델 encoder 16청크, RNNT 307회 호출, 실제 인식 부분 결과 변경 15회
- 최초 인식 변화: 원본 음성 4.226초 위치 (`떤`); 이어진 부분 인식 `떤 케이티 고객센터입니다`
- CPU 계산 소요는 0.743초(약 10초가 넘는 오디오를 **오프라인 고속 처리**한 수치). **실시간 Android 지연으로 해석할 수 없음**.

## Android 원본 모델 검증 전용 비공개 진입점

`tools/ixio-original-private-emulator-regression.sh`

이 스크립트는 원본 APK, 원본 STT ZIP, 녹음 M4A가 **같은 ADB 실행 환경**에 있을 때 모델을 에뮬레이터 앱 사설 `files/ixio-stt` 폴더에 복사하고, 가상통화 시험을 구동하며 다음의 실제 시점을 수집한다.

1. `IXIO_ORIGINAL_SPEECHSDK_READY`
2. `IXIO_FIRST_READY_LATEST_PCM_SNAPSHOT`
3. `IXIO_SPEECHSDK_TRIPLE_RESULT`

모델과 통화녹음은 공개 GitHub 저장소, GitHub 릴리스, Actions artifact에 포함시키지 않는다. **현재 CI에서는 원본 모델 전달 경로가 없어 이 최종 Android 모델 시험을 실행했다고 주장할 수 없다.**
