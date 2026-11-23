# 삼성 기본 전화 → IXIO 원본 speechSDK 독립형 STT (2026-11-23)

## 실행 구조
1. 기본 전화 앱은 삼성 전화 그대로 사용
2. `CallStateGate`가 `OFFHOOK`를 감지
3. `SamsungRecordAccessibility`가 삼성 통화 중 UI에서 녹음 시작을 즉시 시도 (접근성은 사용자 명시 허용)
4. `Recordings/Call`에 생성·증가하는 M4A 파일을 SAF로 감시, 3회 증가 확인
5. 원래 `StreamingAacPcmDecoder`: 새 AAC 프레임만 → 16kHz PCM16
6. `DirectPcmKoreanStt`(기존 클래스 이름 유지, 구현 전면 교체) → `DexClassLoader`로 원본 `com.lguplus.ixispeech_ktn.speechSDK` 로딩
7. 원본 `speechSDK.loadSTT(...)` → `speechSDK.SpeechInference(float[], int, boolean)` → Kotlin Triple → 실시간 자막

## IXIO 원본 코드 및 JNI 출처
원본 GitHub Actions run 43799320393 / artifact `IXIO_Main_NoAppSealing_Single_APK`
- 원본 IXIO `classes16.dex`: `speechSDK` 클래스. 기존 HITEL14 래퍼로 다시 작성한 것이 아님.
- 원본 IXIO `classes6.dex`: `CombinedSTTKWS`, `OnlineStream`, JNI 래퍼 클래스
- 원본 IXIO `lib/arm64-v8a/libsherpa-onnx-jni.so` 및 `libonnxruntime.so`
- 원본 IXIO `assets/stt/bpe.vocab`
- 두 DEX를 설치 가능한 별도 APK의 `assets/ixio/ixio-original-sdk.jar`로 넣고 앱 전용 readonly code cache에 배치
- HITEL14 공개 `com.github.k2-fsa:sherpa-onnx` 의존성 및 2024-06-16 공개 Zipformer 모델 다운로드 제거. **대체/폴백 없음**.

## IXIO 원본 모델
- IXIO 원본 `STT.zip`에서 `encoder.ort`, `decoder.ort`, `joiner.ort`, `tokens.txt`가 필요.
- 모델은 빌드 APK에 들어 있지 않으며 최초 1회 앱의 **IXIO 원본 STT.zip 가져오기**로 로컬 설치.
- `bpe.vocab`은 원본 IXIO APK에서 자동 제공.
- 원본 모델 없이 실행하면 공개 Sherpa 모델로 대체하지 않고 오류를 출력.
- 모델 압축파일 형식/내용이 불일치하면 Import 단계에서 누락 파일을 명시함.

## APK 빌드 검증
- 브랜치: `feature/standalone-auto-call-a11y-stt-20261123`
- Workflow: `.github/workflows/build-standalone-auto-call-a11y-stt-20261123.yml`
- 확인된 성공 실행: https://github.com/lyonbegin/hitel-room/actions/runs/45104540078
- 검증된 artifact: `IXIO-Original-SpeechSDK-AutoCall-ARM64-20261123`
- APK: `HITEL_IXIO_OriginalSpeechSDK_AutoCall_ARM64.apk`
- APK size: 18,520,032 bytes; SHA-256: `5895e46198216fd77d5769d3324d366abeec5d720a426247449495646b52f143`
- ZIP 내용 직접 확인: 원본 DEX 2개, JNI 2개, bpe.vocab 포함; 공개 HITEL14 Zipformer 모델 없음.
- Gradle assembleDebug, 서명 검증, 패키지 ID, 원본 리소스 존재 체크 PASS.

## 검증되지 않은 항목
- 실기기에서 원본 IXIO 모델 import 및 `speechSDK.loadSTT` 네이티브 초기화 성공
- 삼성 실전화 통화 중 녹음 버튼 접근성 클릭 성공, 실시간 PCM 전송 및 인식 텍스트
- 장시간 통화 안정성, 배터리·메모리 사용량, IXIO 모델 사용권/재배포 적합성

**주의**: GitHub Actions에서 APK 생성은 검증했지만 실기기 STT 성공은 아직 증명되지 않음. 실험용 APK만 Actions artifact로 제공하며 별도 공개 Release는 자동 게시하지 않음.
