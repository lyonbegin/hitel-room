# IXIO 원본 speechSDK PCM 호환성 독립 앱 — 2026-11-23 실제 검증

## 브랜치 / APK
- 소스 브랜치: `fix/ixio-pcm-sdk-compat-final-20261123`
- 패키지: `app.hitel.recording.ixio.pcmaudit` — 기존 서명이 다른 시험 앱과 함께 설치 가능
- 버전: `9`, `1.0.9-ixio-pcm-contract-endpoint`
- GitHub Actions signed APK artifact: https://github.com/lyonbegin/hitel-room/actions/runs/45120812573/artifacts/14793184538
- APK 이름: `HITEL_IXIO_PCM_Diag9_20261123.apk`, 아티팩트 내부 `SHA256.txt` 첨부
- 기존 HITEL14 공개 Sherpa STT는 사용하지 않음. 원본 IXIO `speechSDK`, `CombinedSTTKWS`, `OnlineStream`, ONNX JNI를 포함
- 개인 원본 `IXIO_STT_Original_4.0.4.zip`과 삼성 녹음 M4A는 공개 GitHub에 업로드하지 않음

## 원본 삼성 M4A 직접 검사(모델 추론 아님)
- 파일: `통화 녹음 100_261123_005259.m4a`
- AAC-LC / mono / 48kHz / 2.495958초 / 41,307 bytes
- FFmpeg 고정 기준 16kHz signed PCM16: 39,936 samples, 79,872 bytes, SHA256 `2b689f7d35fef8cc3f6b5c88b6aaf427ad67bc020ee6a3055b6133cfae968067`
- FFmpeg 기준과 앱의 33-tap FIR 알고리즘 로컬 재현: 5-sample 지연 보정 후 파형 상관 약 0.997
- RMS 약 0.156, PCM16 peak 30,731. 속도/샘플레이트를 임의로 바꿀 근거 없음

## 실제 수정
1. `IxioPcmNormalizer`: 16-bit little endian mono PCM → `short / 32768f` → IXIO `float[]`. AGC, 시간 왜곡, 노이즈 게이트 없음
2. `DirectPcmKoreanStt`: RMS/DC/peak/클리핑/샘플 수/추론시간/SDK Triple(텍스트,KWS,EPD) 계측
3. `DirectPcmKoreanStt`: 파일 끝에 200ms 무음 청크를 최대 2.6초까지 IXIO 원본 `SpeechInference()`에 입력하며 진짜 endpoint 확인(이전 300ms 1회에서 수정)
4. `MainActivity`: 원본 `CombinedSTTKWS.<clinit>`이 자기 ClassLoader로 `libsherpa-onnx-jni.so`를 로드하는 사실을 반영. 별도 ClassLoader에서 중복 `System.loadLibrary()` 호출하지 않음
5. `speaker-standalone/ci/IxioPcmNormalizerTest.java`: 부호, 진폭, 200ms window, 무음 판정, 잘못된 PCM 바이트 검증

## 검증 결과 — 성공
- GitHub Actions APK 빌드, v2 서명 검사, 원본 DEX/JNI 포함 검사, JVM PCM 계약 검사: https://github.com/lyonbegin/hitel-room/actions/runs/45120812573
- 실제 빌드된 *같은* APK를 Android 15 x86_64 + `libndk_translation.so` (ARM64) 에뮬레이터에 설치: https://github.com/lyonbegin/hitel-room/actions/runs/45121102420
- 에뮬레이터 실로그: `PASS_ALL_ORIGINAL_IXIO_CLASSES_AND_METHODS`
- 에뮬레이터 실로그: `PASS_ORIGINAL_IXIO_NATIVE_JNI_LOADED via original CombinedSTTKWS.<clinit>`
- 에뮬레이터: 크래시 로그에서 `FATAL EXCEPTION`, `VerifyError`, `NoClassDefFoundError` 없음
- GitHub Release 자동 게시 **실패**: GitHub Actions token `403 Resource not accessible by integration`; APK 생성이나 에뮬레이터 테스트의 실패와 혼동 금지. Actions artifact는 확인됨

## 아직 검증되지 않은 것 — 최종 STT 성공 주장 금지
- 사용자 제공 `IXIO_STT_Original_4.0.4.zip`을 에뮬레이터에 설치한 뒤 `speechSDK.loadSTT()` 모델 실제 초기화
- 사용자 제공 삼성 M4A를 에뮬레이터에 넣은 뒤 실제 `SpeechInference()` 추론 및 비어있지 않은 한국어 텍스트 생성
- 삼성 실통화 중 실시간 STT 안정성/endpoint
- 위 사항 없이 APK 빌드나 class load만으로 STT 정상이라고 주장하면 안 됨

## 실기기 원클릭 시험
독립 앱 실행 → IXIO 원본 STT ZIP 가져오기 → 삼성 Recordings/Call M4A를 선택 → `삼성 원본 녹음 M4A → IXIO STT 자동 시험` → 진단 ZIP 저장. SDK의 실제 텍스트 또는 실패 함수 로그를 기준으로 판단한다.
