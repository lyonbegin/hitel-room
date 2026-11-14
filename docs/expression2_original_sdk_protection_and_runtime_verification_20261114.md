# Expression 2 원본 SDK: AppSealing 정적 확인, Android APK 설치, JVM 문구 변경의 실제 예외 검증

날짜: 2026-11-14 KST. 원본 SDK: bitHuman Expression 2 Android 0.6.2. **원본 기능을 Kotlin/C++로 재작성하지 않고**, JVM 오류 문자열 상수 두 곳만 교체한 결과를 실제 Android 환경에서 확인합니다.

## 1. 이번에 수정한 도구·실행 워크플로

- **tools/bithuman_deep/test_expression2_reassembled_apks_emulator.sh**: 공식 앱 원본 재조립 APK와 메시지 수정 APK를 모두 Android 14에 설치하여 ABI, native bridge, launch, crash, 스크린샷, logcat을 저장.
- **.github/workflows/expression2-original-reassembled-aar-emulator-smoke.yml**: 이전 에뮬레이터 CI의 `/usr/bin/sh: set: Illegal option -o pipefail` 오류를 고치기 위해 `script: bash tools/bithuman_deep/test_expression2_reassembled_apks_emulator.sh`로 변경. 2개의 실제 APK artifact 다운로드·시험.
- **tools/bithuman_deep/expression2_package_protection_inventory.py**: 공식 AAR, 원본 재조립 APK, JVM 수정 APK의 ZIP 파일·DEX·SO·중첩 classes.jar를 읽기 전용으로 조사, AppSealing 관련 정적 마커와 일반 보안 관련 마커 분리.
- **.github/workflows/expression2-original-package-protection-signature-audit.yml**: 공식 AAR SHA256 검증, 두 APK 포함 정적 보호 지표 기록.
- **tools/bithuman_deep/test_expression2_modified_literal_emulator.sh**: 원본 158MB 공개 모델+canon, 원본 ARM64 native bridge, 실제 `Expression2Avatar.create()`를 호출하여 JVM 수정 문구가 예외 메시지로 출력되는지 시험.
- **.github/workflows/expression2-reassembled-jvm-message-real-runtime-e2e.yml**: 공식 모델 cache 검증, 수정된 AAR 연결, 공식 원본 시험 Activity로 APK 빌드, 에뮬레이터에 모델 배포 및 결과 기록.

이번 변경은 원본 ARM64 ELF·JVM 원본 인증 검사 조건을 수정하지 않습니다.

## 2. 기존 실패 원인 — 잘못된 해석 정정

최초 시험 https://github.com/lyonbegin/hitel-room/actions/runs/43546980797 에서 에뮬레이터는 **부팅 성공**했습니다. 실행이 중단된 직접 원인은 Android SDK/ADB 자체의 불가능 문제가 아니라:

~~~text
/usr/bin/sh: 1: set: Illegal option -o pipefail
~~~

GitHub Actions emulator runner의 inline `script: |`가 `/bin/sh`로 실행되었는데 Bash 전용 `set -o pipefail`을 사용한 것이 원인입니다. 스크립트를 별도 `.sh` 파일로 분리하고 명시적으로 `bash`를 사용하도록 고쳤습니다. 실행 초기의 `Unable to connect to adb daemon` 로그는 실제 부팅 실패의 원인이 아니라, 뒤이어 boot complete가 나타난 일시적 로그였으며 최종 에러와 혼동하면 안 됩니다.

## 3. 정적 AppSealing 지표 검사

성공 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43551886233

| 대상 | AppSealing 직접 관련 식별 문자열/파일 경로 | 일반 보안 문자열 탐지 |
|---|---:|---:|
| 공식 bitHuman Expression2 AAR | 0 | 1 |
| 원본 재조립 SDK 예제 APK | 0 | 2 |
| 문구 수정 SDK 예제 APK | 0 | 2 |

- 원본 AAR 내부 중첩 `classes.jar`의 각 classfile과 기타 JAR 엔트리까지 조사했습니다.
- APK `classes.dex`에서 `xposed`, 원본 `libLiteRt.so`에서 `frida`라는 문자열 부분 일치가 발견됐지만, 이 단어들은 **일반 휴리스틱**이며 앱 보호 SDK가 설치되었음을 의미하지 않습니다.
- **이번 검사 결과는 'AppSealing 벤더 마커가 검출되지 않음'입니다.** 런타임 동적 로딩, 암호화/난독화, 다른 종류의 자체 보호 기능 또는 APK 빌드 후 추가된 보호 처리가 없는 것까지 입증한 것이 아닙니다.
- 해당 정적 검사는 SDK 인증·미터링 거부 함수의 보호/우회 여부를 판단하지 않습니다.
- 증거: https://github.com/lyonbegin/hitel-room/actions/runs/43551886233

## 4. x86_64 + ARM64 native bridge 환경에서 실제 APK 2개 설치·실행

성공 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43551725719  
실제 로그·스크린샷: https://github.com/lyonbegin/hitel-room/actions/runs/43551725719/artifacts/14095934156

환경:
- Android 14 / API 34 Google APIs 에뮬레이터
- `ro.product.cpu.abilist=x86_64,arm64-v8a`
- `ro.dalvik.vm.native.bridge=libndk_translation.so`

| 시험 | 수정 없는 원본 재조립 APK | JVM 문자열 수정 APK |
|---|---|---|
| `adb install -r` | Success | Success |
| `MainActivity` 시작 | `Status: ok` | `Status: ok` |
| 실행 프로세스 PID | 확인 | 확인 |
| 로그에서 치명적 예외 | 미검출 | 미검출 |
| 엔진 생성·원본 모델 영상 출력 | 미검증 | 미검증 |

**주의:** 공식 `expression2-hello` 예제 앱의 UI는 API Secret이 없으면 자체적으로 안내를 표시하고 `create()`를 호출하지 않습니다. 따라서 **이 설치·실행 시험은 원본 SDK의 실제 create 경로를 시험하지 못한 것**입니다. 그래서 아래 별도의 원본 모델 동적 검증을 진행했습니다.

## 5. 실제 Android 실행에서 수정 JVM 오류 문구 출력 확인

성공 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43552151786  
원본 모델·실행 로그 증거: https://github.com/lyonbegin/hitel-room/actions/runs/43552151786/artifacts/14096029644

**입력:** 원본 public Wise Pup IMX에서 추출한 `combined_litert.tflite`(158,524,428B)와 `canon.bin`(299,520B). 캐시 파일 SHA256 자체도 Actions에서 검증하였습니다.

**SDK:** `Expression2_0.6.2_JVM_all_error_text_patch_20261114.aar`; 원본 ARM64 SO의 바이트·SHA 변경 없음; JVM 클래스 92개 중 1개에서 오류 문자열 상수 #595와 #760만 변경.

**실행 경로**:
1. 원본과 동일한 공식 시험 Activity 실행.
2. `System.loadLibrary("expr2jni")` → `SDK_ORIGINAL_NATIVE_LOAD_PASS`.
3. 원본 모델 158MB·canon 검증 → `MODEL_ORIGINAL_FILES_VERIFIED`.
4. 원본 `Expression2Model.combined(...)` 생성 → `SDK_ORIGINAL_MODEL_CONSTRUCT_PASS`.
5. 테스트용 API Secret이 없는 상태를 명시적으로 기록 → `SDK_CREDENTIAL_UNSET_NO_TEST_SECRET`.
6. 실제 `Expression2Avatar.create(...)` 호출 → `SDK_OFFICIAL_CREATE_BEGIN`.
7. 실제 SDK 예외 `Expression2Exception` 발생하며 새로운 JVM 문자열 포함 → `SDK_OFFICIAL_CREATE_REJECTED`.
8. `SDK_PROBE_END`. 전체 검증 항목 11개 모두 true.

실제 핵심 로그:

~~~text
SDK_ORIGINAL_NATIVE_LOAD_PASS libexpr2jni.so
MODEL_ORIGINAL_FILES_VERIFIED sizes=158524428,299520
SDK_ORIGINAL_MODEL_CONSTRUCT_PASS 158524428
SDK_CREDENTIAL_UNSET_NO_TEST_SECRET
SDK_OFFICIAL_CREATE_BEGIN
SDK_OFFICIAL_CREATE_REJECTED ai.bithuman.expression2.Expression2Exception
  refusing to serve: HITEL_EXPRESSION2_JVM_TEXT_PATCH_OK_20261114:
  valid API secret is required.
SDK_PROBE_END
~~~

검증 JSON:
- `native_loaded=true`
- `original_model_verified=true`
- `sdk_create_invoked=true`
- `sdk_refusal_observed=true`
- `patched_literal_observed=true`
- `original_literal_absent=true`
- `all_expected_conditions=true`

**결론:** 원본 ARM64 SO·모델·JVM 바이트코드를 유지한 상태에서 오류 문자열 상수 변경이 Android 실제 실행 경로에서 반영됐습니다. 이는 **원본 바이트코드 수준의 최소 수정 → AAR 재조립 → Android에서 동작 확인**을 입증하는 실험입니다. 인증이 통과했거나 실제 영상이 렌더링되었다는 주장은 아닙니다.

## 6. 다음 개발 작업의 정밀 기준

- 원본 SDK **정적 분석기 다섯 개**는 기존 그대로 유지합니다.
- JVM 클래스는 반드시 **원본 ASM/javap 인벤토리와 patch 전후 classfile byte diff**로 비교합니다.
- ARM64는 **FDE 2,629개/ELF 분리조각 2,660개**와 원본 SO SHA를 기준으로 모든 비변경 명령·데이터 보존을 검사합니다.
- JNI의 정적 28/28 대응과 모델·네이티브 로딩, 실제 create/feed/pull을 **각각 다른 증거 단계**로 구분합니다.
- AppSealing 등 보호 계층은 서명·정적·런타임 검사로 추가 확인할 수 있지만, **현재 원본에 특정 외부 상용 보호 SDK가 있다는 증거는 없습니다**.
- 실제 `create()`가 인증 거부에 의해 중단되는 상황이므로 정상 프레임 추론은 **유효한 공식 이용 자격**과 함께 별도로 시험해야 합니다.
- 원본 인증 기능 무력화/우회는 이 방법론 및 이번 결과에 포함되지 않습니다.

**새 채팅 인계:** 먼저 `docs/expression2_original_re_methodology_complete_handoff_20261114.md`를 읽고, 이어 본 후속 보고서의 로그·워크플로·수정 도구를 보십시오. 기존의 셸 오류를 'SDK 실행 불가능'이라고 되풀이하지 마십시오.
