# v23: 2개 Zipformer + 공통 PCM 화자 식별 — 검증 결과 (2026-11-11)

## 보존 및 빌드
- 기존 성공 버전: v22, 두 개의 독립 SherpaOnnxOnlineRecognizer / OnlineStream, 4s window + 1s overlap, modified_beam_search.
- 이번 실험: v23 별도 패키지 `app.hitel.koreanzipformer.stream23`.
- v22 소스와 APK는 변경하지 않음.
- v23 빌드 정확한 소스 커밋: `844b39eae7a091520d5a415fdda93f9198f2ee67`.
- ARM64 빌드 통과: https://github.com/lyonbegin/hitel-room/actions/runs/43033878177
- 직접 다운로드: https://github.com/lyonbegin/hitel-room/releases/download/v23-dual-zipformer-speaker-id-20261111/Galaxy-Korean-Zipformer-174M-DualSpeaker-v23-ARM64.apk

## 실제 실행 검증: Android 15 x86_64
- 비공개 원본 삼성 M4A (16.725초, mono AAC 48kHz), nominal 300ms growing-file.
- 배포 소스 일치 E2E: https://github.com/lyonbegin/webrtc/actions/runs/43035675561 (SUCCESS)
- 26/26 기능검사 통과, PCM 전체 전달/최종 자막 확정 통과.
- Zipformer worker 0 decode 36회, worker 1 decode 28회.
- 원본 4초/3초 stride 분할 6개 window 완료.
- CAMPPlus speaker embedding 12개 시간 구간 생성; label A=5, B=1, UNKNOWN=6.
- 본인 목소리를 등록하지 않은 경우 A/B를 SELF/OTHER로 단정하지 않는 검사 통과.
- 별도 비공개 성능 분석: https://github.com/lyonbegin/webrtc/actions/runs/43037679183
  - native concurrent decode overlap=10.072초
  - 최초 파일 증가→최초 UI 자막=1.998초
  - 최초 파일 증가→마지막 PCM 쓰기=29.371초
  - native decode P95=827.33ms, PCM pipe write P95=1.678ms
- 주의: 서로 다른 GitHub runner의 부하가 다르므로 기존 v22보다 반드시 빠르다고 일반화할 수 없음.

## 동일인/타인 식별 공개 음성 벤치마크
- 프로젝트에 포함된 테스트 코드: `native/speaker_id_threshold_test.cc`.
- 실행: https://github.com/lyonbegin/hitel-room/actions/runs/43038243170 (SUCCESS)
- 원본 프로젝트 샘플: https://github.com/csukuangfj/sr-data ; 공개 녹음, 사용자 통화와 무관.
- 사용 모델: `3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx` (공식 28MB 파일)
- 동일인 Fangjun (enrollment vs test): cosine=0.8153 → SELF (threshold>=0.66)
- 동일인 Leijun: cosine=0.6664 → SELF (threshold>=0.66)
- 서로 다른 Fangjun/Leijun: cosine=0.3274 → OTHER (threshold<=0.43)
- Fangjun/Liudehua: 0.0258, Leijun/Liudehua: 0.3417
- 위 결과는 소규모 순수 음성 샘플에서의 모델 식별 동작 확인이며, 한국어 실제 통화의 오인식률 또는 화자 정확도를 입증하지 않음.

## 필수 구조 및 오작동 방지
1. 본문 STT는 반드시 Zipformer worker 0/1의 별도 인식 스트림을 유지. **worker 0/1은 화자 A/B를 의미하지 않음.**
2. 화자 식별은 **한 개의 정렬된 16kHz PCM 시간축**에서 별도의 CAMPPlus 1-thread sidecar로 처리.
3. sidecar 작업 큐가 과부하되면 speaker job만 누락; STT 오디오는 누락 금지.
4. 2.4초 임베딩 window, 1.2초 hop. 4초 ASR window의 텍스트를 시간상 결합하여 잠정 speaker 라벨을 표시. **단어 단위 정밀 정렬은 아직 구현되지 않음.**
5. 사용자 음성 5초 등록은 통화 전에 권한 동의를 받아 로컬 마이크로만 녹음. 통화 중 별도 마이크 녹음은 실시하지 않음. 무음 프로파일은 저장 금지.
6. speaker model이 누락되거나 실패해도 두 Zipformer의 기존 자막은 유지.
7. 미등록이면 A/B/UNKNOWN만 사용. 등록되더라도 SELF/OTHER 판별 임계값 불확실 영역은 UNKNOWN으로 표시. 혼합 구간 임의 삭제/발신자 변조 금지.
8. 화자 모델만으로 동시에 겹친 두 음성 신호를 물리적으로 분리할 수 없음. 겹침이 잦으면 별도 speech separation 모델과 정확도 테스트 필요.

## 미검증
- Galaxy ARM64 실기기의 사용자 본인 voice enrollment → SELF/OTHER 정확도.
- 실제 동시 발화, 반향, 스피커폰, Bluetooth 통화의 화자 혼동률.
- 사용자별 threshold calibration 및 환경별 degradation.
- 실제 통화의 발신/수신 분리 AudioSource API; 기존 삼성 M4A 원본은 1 트랙 mono이므로 TX/RX 구분 정보가 존재하지 않음.
- 자막 화자표시가 단어 단위로 정확히 붙는 것과 영구 식별 성능은 **미검증**.

## 판정
- **코드 통합/기능/2개 STT 보존: 검증 통과.**
- **화자 A/B 임베딩 생성: 검증 통과.**
- **본인/상대방의 실전화 정확도: 검증 미완료.**
