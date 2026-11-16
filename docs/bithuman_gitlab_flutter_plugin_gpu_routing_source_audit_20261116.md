# bitHuman Flutter 플러그인 2.6.40 — 전체 GitLab 소스 / Android GPU 선택 구조 검증

검증일: 2026-11-16 (KST)
원본: https://gitlab.com/bithuman/sdk/homebrew-bithuman
태그: `flutter-plugin-v2.6.40`
원본 Git 커밋: `9417e7c2d44dd4437bf1129cbc3f54921e1d7234`
GitHub Actions 실제 소스 복제·전체 검색: https://github.com/lyonbegin/hitel-room/actions/runs/43797248031
검증 범위: 원본 저장소 추적 파일 298개 / 디코드 가능한 297개 전체 검색; 플러그인 서브트리 236개 항목 소스 아카이브 확보.
분석 산출물: `original-bithuman-gitlab-flutter-2-6-40-full-plugin-and-gpu-audit` 아티팩트에 `all-repository-gpu-search.json`, `all-repository-gpu-search.md`, `summary.json`, `original-bitHuman-flutter-plugin-v2.6.40.tar.gz` 포함.

## 판정

**Flutter 플러그인 자체는 갤럭시 GPU/HTP 장치를 식별하고 Expression 2 인퍼런스 백엔드를 바꾸는 로직을 구현하지 않습니다.** Android SDK 생성 시 가속기 옵션을 생략하고 원본 SDK의 자동 동작에 맡깁니다. 플러그인 소스 전체 검색에서 `Expression2Options`, `Routing.GPU_DECODER`, `Routing.HTP_DECODER`, `QNN_OPTIONS_ADRENO_FP32`, `Build.SOC_MODEL`, `QnnDevice_getPlatformInfo`, `libQnnGpu.so` 참조는 각각 **0건**입니다.

- `packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:493-536`: Expression 2 모델 스토어 fetch → 인증 설정 → `Expression2Avatar.create(context, model)` (522행, 옵션 없이 실행) → `avatar.accelerator` / `avatar.acceleratorNote` 출력(534행).
- `packages/flutter-plugin/android/build.gradle:122`: 해당 태그의 원본 Expression 2 SDK 의존성은 **0.6.1**. 현재 HITEL 시험 APK의 원본 SDK 0.6.2와 다르므로 하위 엔진의 설정을 혼용하지 않습니다.
- `packages/flutter-plugin/android/build.gradle:26-30,242-247`: Qualcomm QNN delegate/runtime 2.49.0이 SDK Maven 종속성으로 전이됨. 소비자 앱의 `packaging { jniLibs { useLegacyPackaging = true } }` 요구. 패키징을 잘못하면 delegate 바이너리가 설치 APK에 들어 있어도 nativeLibraryDir에서 접근할 수 없으며 CPU 폴백.
- `packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:125-149`: `Expression2Engine` 어댑터는 `feed`, `flushTail`, `pull`, `stats`를 원본 SDK로 전달하며 가속기 선택은 하지 않음.
- `packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:419-429`: Flutter `SurfaceProducer` 사용, Impeller/Vulkan·GLES 렌더 오버헤드 개선. 이는 화면 표시 GPU 경로이지 Expression 2 모델의 QNN GPU 추론 설정이 아님.

## 플러그인에 실제 존재하는 동적 GPU 가능 여부 판정: Essence 2의 화면 출력 전용

- `packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:215-227`: `Essence2Engine`는 `runCatching { avatar.useHardwareBuffers(HW_SLOTS) }`로 하드웨어 버퍼 경로를 시험. 성공하면 GPU HardwareBuffer 무복사 경로, 실패하면 CPU 복사 출력 및 경고 로그.
- `packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:145-170`: 무복사 경로이면 `surface.lockHardwareCanvas()`, 아니면 `surface.lockCanvas(null)`로 표시.
- `packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:581-594`: 개발 디버그 속성 `debug.bh.e2.copy=1`로 Essence 2 복사 경로 강제 가능. GPU **추론** 선택 스위치는 아님.
- `packages/flutter-plugin/CHANGELOG.md:799-813`: Galaxy S25+ 원본 측정에서 Essence 2 무복사 HardwareBuffer 표시 경로 사용 시 CPU 복사 감소, GPU 사용률 상승; 프레임 표시 경로의 계측이며 Expression 2 QNN Adreno 성공을 의미하지 않음.
- `packages/flutter-plugin/CHANGELOG.md:510-533`: Galaxy Z Fold5 / Flip5에서 Essence 2 영상 품질·스레드 스케줄링과 Expression 2 오디오 시작 지연을 측정한 실제 기록. GPU 백엔드 자동 선택 코드는 아님.
- `packages/flutter-plugin/ARCHITECTURE.md:45-69`: 문서의 `GPU` tier는 주로 bitHuman **클라우드 CUDA** 경로를 의미하므로 Android Adreno GPU와 혼동 금지.

## 원본 Expression 2 SDK 0.6.2 바이너리 교차검증

원본 AAR: GitHub Actions 43546359857, 아티팩트 `expression2-original-bytecode-and-arm64-reassembled-aar`; 본 분석 시 원본 `classes.jar`를 별도 추출, JDK `javap -p -c -constants`로 실제 클래스파일 검사.

- `ai.bithuman.expression2.Expression2Options`: 필드 `accelerator`, `routing`, `qnnOptions`; 상수 `QNN_OPTIONS_ADRENO_FP32 = "backend_type:gpu;gpu_precision:0"`, `DEFAULT_QNN_OPTIONS = "backend_type:htp;htp_precision:1;htp_performance_mode:6"`.
- `ai.bithuman.expression2.Routing`: `GPU_DECODER`, `HTP_DECODER`, `MIXED`, `ALL_CPU` 모두 실제 존재. GPU_DECODER/HTP_DECODER의 디코더 슬롯 모두 내부 장치 enum `Device.NPU`이므로 `accelerator=NPU` 출력만으로 실제 QNN GPU/HTP를 구별할 수 없음. `qnnOptions`와 생성 결과 동시 기록 필요.
- `Expression2Options.resolveRouting()`: `routing`을 명시하면 그대로 반환; 그렇지 않으면 `Accelerator.AUTO → Routing.MIXED`, `NPU → HTP_DECODER`, `CPU → ALL_CPU`.
- `Expression2Avatar$Companion.createEngine()`: `qnnDelegatePath()`는 `context.applicationInfo.nativeLibraryDir/libQnnTFLiteDelegate.so` 실제 파일 여부만 검사. QNN로 `build()` 시도, `Expression2Exception`이고 `Accelerator.AUTO`면 `ALL_CPU`로 다시 `build()`. **HTP 실패 후 Adreno GPU 경로를 순서대로 다시 시도하는 분기는 없음.**
- `Expression2Avatar$Companion.create(context, model)`: 3항 `create`의 기본 `Expression2Options()`를 사용하므로 Flutter 플러그인의 호출은 디폴트값.
- 현 사용자 실기기 로그 `routing=(CPU,CPU,CPU,CPU)` / `graph rejected`는 HTP 시도 후 CPU 폴백. GPU 미지원 판정 아님.

## 다음 개발의 근거 기반 설계

1. 같은 원본 SDK 0.6.2와 원본 모델로 `GPU_DECODER + QNN_OPTIONS_ADRENO_FP32`을 **명시적으로 지정**하는 생성 시험을 먼저 실시. 이것이 가장 직접적인 장치별 실제 지원 판정.
2. 결과가 CPU 폴백이면 `accelerator`, `routing`, `acceleratorNote`, 요청한 `qnnOptions`, 실제 QNN native backend 로드 로그를 동시에 기록. 벤치마크 성공 여부는 구별.
3. NPU 기본 경로 `MIXED/HTP`와 CPU 경로를 각각 시험; 각 경로마다 생성 시간·첫 프레임·지속 처리량·오류 원문 기록.
4. 성능을 비교하려면 동일 PCM 입력, 동일 모델 및 기기 온도에서 2회차 이후 캐시 효과도 따로 구분; 성공하고 빠른 경로를 프로파일별로 저장. 단순 `Build.SOC_MODEL` 일치만으로 지원을 판정하지 않음.
5. Android 빌드에 `useLegacyPackaging=true`를 명시하고 QNN GPU/HTP 바이너리의 설치 후 실제 nativeLibraryDir 존재를 점검.
6. Essence 2의 HardwareBuffer 무복사 출력 테스트는 별개 축으로 유지; 이를 Expression 2 GPU AI 추론 성공으로 보고하지 않음.

**검증 범위 구분:** 실제 GitLab 소스 전체 정적 검색 + 원본 SDK 0.6.2 JVM 바이트코드 교차 검증 완료. 사용자 Z 폴드에서 QNN Adreno 실제 생성 및 GPU 추론 FPS 시험은 아직 하지 않았음.
