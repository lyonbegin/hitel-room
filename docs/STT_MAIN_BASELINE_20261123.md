# HITEL STT Main — 독립형 기준선 (2026-11-23)

## 기준 브랜치 및 범위

- GitHub 저장소: `lyonbegin/hitel-room`
- STT 전용 기준 브랜치: **`stt/main`**
- 핵심 Android 소스: `speaker-standalone/`
- 기준 커밋: `09bfd672c62f53abdb12d80a4c09123903cfd247` (V11 APK 빌드 성공 커밋)
- 이 브랜치는 기존 저장소의 기본 `main`을 대체하지 않습니다.
- STT 개발에서 가장 최근에 **실기기 성공으로 확인된 엔진 기준선은 V10**입니다. V11은 그 코드에서 **진단 자막 파일 중복 저장 및 설명문만 수정**한 빌드이며, V11 자체의 별도 실기기 STT 재검증은 아직 없습니다.

## 보존해야 할 실제 실행 경로

삼성 기본 전화앱 통화 → (접근성 사용 허용 시) 삼성 녹음 시작 보조 → 삼성 통화녹음 M4A의 파일 크기 증가 감지 → 파일 델타 AAC 회수 → Android MediaCodec AAC 디코딩 → 48kHz→16kHz 모노 PCM16 FIR 변환 → IXIO 원본 `speechSDK.SpeechInference(float[],int,boolean)` → 중간/확정 한국어 자막 → 로컬 진단 ZIP.

**주의:** 현행 구현은 통화 오디오를 시스템에서 직접 PCM으로 가져오는 것이 아니라, **삼성 기본 전화앱이 이미 생성하는 M4A를 따라가서 PCM으로 복원**합니다. 통화 중 보호된 오디오 직접 캡처가 검증된 것은 아닙니다.

### 핵심 파일

- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/DirectPcmKoreanStt.java`: IXIO 원본 SDK 로딩, **프로세스당 단일 DexClassLoader**, PCM 큐 및 inference, endpoint
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/SpeakerEngine.java`: M4A 감지·AAC→PCM·전체 저장 파일 처리, 길이 검증
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/StreamingAacPcmDecoder.java`: MediaCodec 및 16kHz PCM 변환
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/SamsungRecordAccessibility.java`: 통화 녹음 시작 보조
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/CallStateGate.java`: 통화 시작/종료 감지
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/IxioModelImporter.java`: 사용자가 직접 지정하는 IXIO 원본 모델 ZIP
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/TraceJournal.java`: 진단 데이터와 최종 자막 파일
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/MainActivity.java`: 파일 전체 재생, 자동 감시, 자막 UI

## 실제 검증 증거와 한계

1. **Galaxy SM-F936N / Android 15 / V10:** 2026-11-23 17:18~17:19 사용자 기기 진단 ZIP에서 약 58.36초의 PCM이 IXIO SDK로 전달됐으며, `SpeechInference` 호출 299회, 확정 구간 5개, 실제 한국어 자막 확인. 과거 JNI 중복 로딩 오류 재현되지 않음. 최종 입력 큐 0개.
2. **에뮬레이터:** Android 15 x86_64의 ARM64 native bridge `libndk_translation.so`에서 V10 앱 설치·실행·IXIO DEX/JNI 로딩 성공. [Actions 45136624191](https://github.com/lyonbegin/hitel-room/actions/runs/45136624191).
3. **V11:** 진단 ZIP의 `transcript_final.txt`가 누적 자막을 매 구간마다 append하는 오류를 replace 방식으로 수정. [Actions 45138382623](https://github.com/lyonbegin/hitel-room/actions/runs/45138382623) 빌드·게시 성공. **V11 자체 실기기 재검증 전**.
4. 모델 ZIP과 통화녹음은 사용자가 별도 보관·임포트합니다. **원본 모델을 공개 저장소에 올리거나 APK에 무단 내장하지 않습니다.**

### 게시된 APK (기준 기록)

- V10 (실기기 STT 성공 확인): [HITEL_IXIO_FullM4A_SingleLoader_V10_20261123.apk](https://github.com/lyonbegin/hitel-room/releases/download/ixio-v10-full-m4a-single-loader-20261123/HITEL_IXIO_FullM4A_SingleLoader_V10_20261123.apk)
- V11 (진단 저장 버그만 수정; 빌드 성공): [HITEL_IXIO_FullM4A_Transcript_V11_20261123.apk](https://github.com/lyonbegin/hitel-room/releases/download/ixio-v11-full-m4a-transcript-20261123/HITEL_IXIO_FullM4A_Transcript_V11_20261123.apk)
- V11 SHA-256: `8c815545c9fdfdb8ff7493965e8607d7748f469c7ead34df683ef3b76724a003`

## 다음 연구 주제: 실제 지연을 줄이는 PCM 스트리밍

지연 분석 시 아래 시간을 구분합니다.

1. 상대 발화가 시작된 실제 시간(독립적인 동기화 측정 없이는 기존 로그로 확정 불가)
2. 삼성 M4A 파일에 해당 오디오가 기록되어 읽을 수 있게 된 시간
3. AAC 패킷 회수·MediaCodec 디코딩·16kHz PCM enqueue 시각
4. 원본 IXIO `SpeechInference` 호출 시작·종료 및 `getFirst()` 중간 텍스트 갱신 시각
5. Broadcast 수신·MainActivity UI 텍스트 변경 및 실제 프레임 표시 시각

직전 실기기 진단에서 첫 PCM 투입까지 약 3.61초, 최대 기록된 단일 추론 약 80ms였습니다. 중간 자막 이후 endpoint 최종 확정까지 긴 구간이 있었지만, **endpoint 확정 대기시간과 실제 화면 표시 지연을 동일하게 취급하지 않습니다.**

우선순위: 현재 정상 동작하는 원본 STT를 보존하면서 **발화→최초 화면 표시 간 지연의 실측**과 **M4A 파일에 접근할 수 있는 가장 빠른 시점**을 확인합니다. 보호된 통화 오디오 직접 PCM 접근 가능 여부는 플랫폼/권한 제약을 따로 검증해야 합니다.

### 브랜치 관리 규칙

- `stt/main`: 검증된 STT 기준선 보존; 운영상 기준 브랜치
- `feature/stt-*`, `fix/stt-*`: 실험 및 수정
- 실기기 녹음/자막 성공 증거가 없는 실험은 기준 브랜치에 성공으로 보고하지 않습니다.
- 저장소 기본 `main`, 기존 HITEL14 및 다른 프로젝트 소스를 STT 실험 때문에 변경하지 않습니다.
