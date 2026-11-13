# Expression 2 — 원본 함수 직접 대조 및 독립 SDK 함수 검증 보고 (2026-11-13)

## 범위

Expression 2만 개발했습니다. Essence 2와 신규 IMX 생성 작업은 진행하지 않았습니다. 원본 기능은 실제 배포된 SDK 0.6.2의 ARM64 기계어 함수와 동일 입력에 대한 출력값을 기준으로 검증했습니다.

## 1. 원본 함수 FUN_001a9794: 음성 전처리

- 원본 함수 주소: 0x001a9794, 수정하지 않은 libexpr2jni.so에서 실제 실행
- 입력: 16kHz Float32 PCM 44,000개 (176,000바이트)
- 출력: Float32 35,200개 (140,800바이트)
- 동일 입력: 무음, 임펄스, 사인파, 고정 난수, 실제 발화 TTS
- 결과: 5종 × 35,200개, 총 176,000개 Float32 값이 원본과 비트 단위로 완전히 일치, 오차 0
- 핵심 재검증 사항: 직전 선택 음성 구간을 이용한 교차 혼합, 0.0052083335f 계수, ARM64 원본과 동일한 분리 곱셈·덧셈 반올림 순서
- 원본·자체 실행 로그: https://github.com/lyonbegin/hitel-room/actions/runs/43348632922
- 비교 데이터: https://github.com/lyonbegin/hitel-room/actions/runs/43348632922/artifacts/14003141760

## 2. 원본 함수 FUN_001a7db0: Canon 이력 초기화

- 원본 함수 주소: 0x001a7db0, 수정하지 않은 libexpr2jni.so에서 실제 실행
- 샘플 모델: Wise Pup Expression 2 공개 IMX
- 실제 canon.bin 299,520바이트, SHA256 cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5
- 출력: 4,792,320바이트, 16 × 16 × 90 × 52 × Float32 이력
- 동일 입력 4종: 실제 Wise Pup Canon, 영값, 고정 패턴, 슬라이스 역순
- 결과: 4종 × 4,792,320바이트, 총 19,169,280바이트가 원본과 완전히 일치
- 검증 로그: https://github.com/lyonbegin/hitel-room/actions/runs/43354589268
- 원본·자체 이력 전체 비교: https://github.com/lyonbegin/hitel-room/actions/runs/43354589268/artifacts/14004959295

## 3. 원본 SDK 없는 독립 Android 네이티브 코어 빌드 및 실행

검증된 두 함수의 코드만 별도 C++ 독립 모듈로 옮겼습니다. Android 시험 APK에는 원본 libexpr2jni.so와 libLiteRt.so, 원본 SDK AAR을 포함하지 않았습니다.

소스:
- sdk/expression2-verified-core/include/expression2_verified_core.h
- sdk/expression2-verified-core/src/expression2_verified_core.cpp
- sdk/expression2-verified-core/test-android/MainActivity.kt
- .github/workflows/expression2-vendor-free-verified-core.yml

검증 방법:
1. 과거 원본 ARM64 함수를 실행해 보관한 5가지 PCM 입력과 35,200개 Float32 출력, 실제 Wise Pup Canon 입력과 이력 출력 배열을 확보
2. 별도로 컴파일한 독립 ARM64 라이브러리만 로딩
3. 동일 입력으로 6종의 결과를 계산하고 원본 기준 파일과 바이트 단위 비교
4. 바이너리 파일 목록 및 ELF 의존성에서 원본 SDK 포함 여부 검사

성공한 실제 Android 14 검증:
https://github.com/lyonbegin/hitel-room/actions/runs/43356046681

### 최종 데이터 비교

| 데이터 | 바이트 수 | 독립 코드와 원본 출력의 일치 |
|---|---:|---|
| PCM 무음 | 140,800 | 140,800 |
| PCM 임펄스 | 140,800 | 140,800 |
| PCM 사인파 | 140,800 | 140,800 |
| PCM 고정 잡음 | 140,800 | 140,800 |
| PCM 발화 TTS | 140,800 | 140,800 |
| Wise Pup Canon 이력 | 4,792,320 | 4,792,320 |
| 합계 | 5,496,320 | 5,496,320 |

**불일치 0바이트.** Android 에뮬레이터에서 독립 라이브러리 로딩·실행·원본 출력 비교까지 확인했습니다.

- 독립 APK: https://github.com/lyonbegin/hitel-room/actions/runs/43356046681/artifacts/14005793553
- 실행 검증 JSON·로그: https://github.com/lyonbegin/hitel-room/actions/runs/43356046681/artifacts/14006032489

## 완료 판정 범위

원본 라이브러리와 정확한 출력 비교를 통과한 함수는 **음성 전처리와 Canon 이력 초기화 두 개**입니다. 전체 bitHuman Expression 2 SDK가 대체되었다는 뜻이 아닙니다.

미완료: 네이티브 입력 누적 및 구간 스케줄링, 발화 제어, 실시간 프레임 큐, JNI feed·pump·pull, 상태 초기화, 오류 반환, 실시간 20fps, 전체 인공지능 영상 추론의 원본 대비 동등성.

## 다음 단계 — 원본 함수별 계속 검증

다음 분석 대상은 실제 원본 FUN_001a7fbc(PCM 누적)와 FUN_001a80dc(음성 입력 스케줄러)입니다. 원본 명령어·실제 입력·출력 또는 상태 데이터를 확보하기 전에는 추측 코드를 완성 판정하지 않습니다.

Ghidra가 복원한 C 형태의 코드는 원본 기계어의 재구성 표현이며, 개발자의 원래 C++ 텍스트와 동일하다고 주장하지 않습니다.
