# Expression 2 원본 SDK 실기기 설치용 테스트 APK 인계서 (2026-11-16)

## 결과 및 APK

- **빌드 성공:** https://github.com/lyonbegin/hitel-room/actions/runs/43770655381
- **APK 아티팩트:** https://github.com/lyonbegin/hitel-room/actions/runs/43770655381/artifacts/14184480907
- **파일명:** `Expression2_Original_ARM64_Real_Device_Test.apk`
- **크기:** 163,071,499 bytes.
- **APK SHA-256:** `a2ebf113b3ae57505010856664d3117804b59925708b1d6846ddf578e82250f7`
- **컴파일/패키징/검증:** PASS, 실제 휴대전화 실행: 미검증.
- **Android:** API 26 이상(Android 8.0+), ARM64-v8a 프로세서 필요.
- **서명:** Android Gradle Debug signing (시험용). 운영 배포 서명 아님.
- **빌드 소스:** `experiments/bithuman-expression2-physical-android/MainActivity.kt`, `LoopbackAuthFixture.kt` 및 `.github/workflows/expression2-original-physical-android-one-apk.yml`.

## 원본 보존

- bitHuman Expression 2 **원본 0.6.2 AAR의 JVM + ARM64** 사용.
- 패치는 원본 JVM `SelfHostMeter$Companion.apiBase$expression2_release()` 한 메서드에 `http://127.0.0.1:18762` 반환 지시만 삽입.
- 원본 `libexpr2jni.so` 및 `libLiteRt.so` 내용/해시 불변, 다른 JVM 메서드도 불변.
- 재구현한 음성/영상 엔진 없음. Android 앱/UI/테스트 서버만 추가됨.

## 인증과 로컬 모델

- Android 앱 내 **loopback-only (127.0.0.1:18762)** 테스트 HTTP 서버를 사용. 외부 Railway/유료 GPU/상시 서버에 의존하지 않음.
- 요청 `POST /v1/auth/validate` 및 `POST /v1/meter/beats`의 시험 전용 200 응답과 401 거절을 제공.
- 앱 내 테스트 토큰 `EXPR2_PHYSICAL_DEVICE_LOCAL_FIXTURE_NOT_VENDOR_SECRET`은 공개 모의 토큰이며 **bitHuman 공식 인증·라이선스가 아님**.
- 원본 Wise Pup 모델의 `combined_litert.tflite`(158,524,428 bytes)와 `canon.bin`(299,520 bytes)을 APK assets에 정확한 SHA로 포함.
- 최초 시험 시작 시 `filesDir/models`로 복사하고 크기·SHA 확인. 재시험에는 로컬 캐시 재사용.
- 모델 파일을 원본 `Expression2Model.combined(File,File)`으로 공급하므로 원격 모델 다운로드 없음.

## 실제 Android에서 사용 방법

1. Android 휴대전화에서 APK 파일을 다운로드한 후 엽니다.
2. Android가 요청하면 해당 파일을 연 앱에 **알 수 없는 앱 설치 허용**을 한 번만 선택합니다. 설치 완료 후 다시 해제할 수 있습니다.
3. `Expression 2 원본 SDK 실기기 시험` 앱 실행.
4. 화면에서 **원본 엔진 시험 시작** 누릅니다. 최초 실행에서 모델 자산을 앱 내부 저장소에 복사하므로, 여유 공간 수백 MB가 필요합니다.
5. 화면의 `SDK_ORIGINAL_CREATE_PASS`, `SDK_ORIGINAL_FIRST_FRAME_PASS`, `SDK_ORIGINAL_RENDER_RESULT`와 `accelerator` / `routing` 항목을 확인합니다.
6. 오류가 있다면 **진단 로그 복사** 버튼을 눌러 로그를 채팅에 공유합니다.

## 성능 해석

- 이전 성공 #43764220375는 GitHub Actions Ubuntu의 x86_64 Android 에뮬레이터에서 원본 ARM64 바이너리를 NativeBridge로 변환 실행해 실제 40프레임을 생성했지만, 고속 처리 성능은 증명하지 못함.
- 실기기에서는 ARM64 native translation 오버헤드가 없지만, CPU/NPU/GPU 가속 가용성은 기기/런타임 구성에 따라 다름.
- 원본 `Expression2Options()` AUTO 기본값을 그대로 적용하고 `avatar.accelerator` 와 `avatar.routing`을 앱에 표시함.
- 실제 제조사 NPU/Adreno 가속은 별도 런타임 의존성이 필요할 수 있고, **현재 APK에서 NPU/GPU 사용을 보장하지 않음**.

## 회귀시험

- 빌드/모델/원본 SO 검증 PASS: https://github.com/lyonbegin/hitel-room/actions/runs/43770655381
- 별도 APK 실설치·Android 앱내 로컬인증 시동 시험: https://github.com/lyonbegin/hitel-room/actions/runs/43771101840 (결과 확인 전에는 PASS 선언 금지).
