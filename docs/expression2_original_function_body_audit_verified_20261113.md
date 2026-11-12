# Expression 2 원본 함수 본문 중심 역공학 — 2026-11-13 검증 보고

## 범위

Expression 2 SDK 0.6.2 하나만 분석합니다. Essence 2는 Expression 2 검증이 완료될 때까지 이번 개발에서 제외합니다. 자체 추정 파이프라인이나 기능을 작성하는 것이 아니라, 실제 배포된 SDK의 JVM 바이트코드 및 ARM64 기계어 함수의 내용을 분석하는 프로젝트입니다.

검증에 사용한 원본: ai.bithuman:expression2-android:0.6.2
원본 AAR SHA-256: 067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584

## 직접 확인한 실행 결과

GitHub Actions: https://github.com/lyonbegin/hitel-room/actions/runs/43328017533

| 대상 | 실제 검사 결과 |
|---|---|
| 전체 JVM 클래스 | ai.bithuman 패키지 92개, javap 명령어 추출 92개 성공 / 실패 0개 |
| ARM64 JNI 진입점 | 28개 |
| JNI의 정적 직접 호출 경로에서 발견한 함수 | 1,035개 |
| Ghidra 디컴파일 | 1,035개 성공 / 실패 0개 |
| 원본 ARM64 명령어 | 65,933개, 바이트·주소 기록 |
| 최장 호출 깊이 | 11단계 |
| 정적 직접 호출 추적 후 큐 | 0개 |

- JVM 메서드 바이트코드 전체: https://github.com/lyonbegin/hitel-room/actions/runs/43328017533/artifacts/13994215608
- ARM64 함수별 실제 명령어·디컴파일·함수 호출 목록: https://github.com/lyonbegin/hitel-room/actions/runs/43328017533/artifacts/13992718722

## 기존 분석보다 정확히 개선된 내용

이전 NativeFlow 분석은 65개 함수만 확인하고 호출 단계 2까지만 추적했으며, 여러 함수에서는 키워드가 포함된 일부 코드 행만 남겼습니다. 이 제한 때문에 전체 함수 흐름을 이해했다고 볼 수 없었습니다.

새 Expression2ExactAudit는 JNI 진입점 28개로 시작하여 발견된 직접 호출 대상들을 실제 주소를 기준으로 방문했습니다. 각 함수의 다음 항목을 별도 파일로 기록합니다.

1. 실제 함수 주소·이름·호출 깊이·JNI 출발점
2. 기계어의 정확한 명령어 바이트·명령 주소·어셈블리 표시
3. 함수별 SHA-256, 명령어/바이트 수
4. 직접 호출 대상의 함수 주소와 이름
5. Ghidra가 전체 함수에서 재구성한 C 유사 의사코드
6. 디컴파일 성공/실패 및 남은 미방문 함수 수

JVM에서는 classes.jar의 ai.bithuman 클래스 전체 92개에 javap -p -c -s -l을 실행했습니다. 기존처럼 Credential·Metering·Avatar 관련 줄만 발췌하지 않았습니다.

## 원본 함수 사용 원칙

- 원본을 정확하게 대표하는 것은 배포된 .so/.jar 안의 기계어와 JVM 바이트코드입니다. 따라서 원본을 그대로 실행하는 시험은 바이너리 자체를 변형 없이 사용합니다.
- Ghidra가 만든 C 유사 의사코드는 원본 개발자가 작성한 C++ 소스의 문자 그대로의 복사본이 아닙니다. 타입·변수명·구조체·최적화 이전 표현이 소실될 수 있습니다.
- 기존 자체 Python/Kotlin의 enc→tok14→step→dec 코드는 별도의 역설계 실험이며 원본 SDK 함수 본문이 아닙니다. 앞으로 이를 원본 함수의 대용으로 인정하지 않습니다.
- 재구현이 필요하면 각 기능의 JVM 진입점→JNI 함수→실제 내부 함수의 바이트코드/기계어 근거를 확인하고 동일 입출력·상태·오류를 검증해야 합니다.
- feed, pump, pull, flushTail, reset, idle, 프레임 큐, 음성 창 겹침, GPU/NPU 선택, 상태 초기화, 타임스탬프 동기화 등은 함수 본문 수준의 대조 없이 완성 판정하지 않습니다.
- 직접 호출 폐포에 포함되지 않은 간접/가상 함수 호출, 동적 로딩된 외부 라이브러리, SDK 전체의 아직 미확인 함수는 별도 분석이 필요합니다.
- 변경된 인증 결과를 사실로 꾸미거나 실험 데이터를 추측해서 통과 처리하지 않습니다.
- Essence 2 분석은 Expression 2 독립 SDK 검증 이후 수행합니다.

## 분석 스크립트 및 재현 방법

- Kotlin/JVM 원본 바이트코드 목록: tools/bithuman_deep/expression2_original_jvm_inventory.sh
- ARM64 원본 명령어와 디컴파일 분석: tools/bithuman_deep/ghidra/Expression2ExactAudit.java
- 실행 워크플로: .github/workflows/expression2-original-function-bodies.yml

## 검증 판정

Expression 2의 원본 SDK 바이너리에 대해 92개 JVM 클래스와 1,035개 ARM64 직접 호출 경로 함수, 65,933개 명령어의 세부 분석 자료 확보는 검증 완료입니다.

그러나 원래 Kotlin/C++ 소스 프로젝트 전체의 복구나 원본 SDK와 동등한 스트리밍 구현·기능 결과 검증은 미완료입니다. 단순히 디컴파일에 성공했다는 이유로 원본 기능을 자체 SDK로 구현했다고 판정하지 않습니다.
