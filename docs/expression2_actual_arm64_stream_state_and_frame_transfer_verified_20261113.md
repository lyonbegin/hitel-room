# Expression 2 — 실제 원본 ARM64 PCM·발화·프레임 큐 검증 (2026-11-13)

## 검증 범위와 원본 동일성

- 범위: `ai.bithuman:expression2-android:0.6.2`만. Essence 2 미착수.
- 배포 원본 AAR SHA-256: `067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584`.
- 원본 ARM64 바이너리 `libexpr2jni.so`를 변형하지 않고 Android 14 x86_64 Google APIs 에뮬레이터의 ARM64 NativeBridge로 실제 호출.
- JNI export 기준으로 ELF 로드 주소를 산출한 다음, 대상 원본 함수의 RVA와 첫 명령어를 확인하여 실제 원본 엔트리 호출. 전체 함수 기계어 SHA-256 해시 및 호출 관계는 별도 [원본 명령어 인벤토리](https://github.com/lyonbegin/hitel-room/actions/runs/43328017533)와 [원본 21개 함수 확인](https://github.com/lyonbegin/hitel-room/actions/runs/43357896788)에서 검증.
- **원본 Kotlin/C++ 개발 소스가 확보되었다는 뜻이 아니다.** Ghidra 디컴파일은 원본 기계어의 재구성이다.

## 이번에 실제 Android에서 통과한 원본 호출

최종 통합 검증: [Actions #43362645770](https://github.com/lyonbegin/hitel-room/actions/runs/43362645770) — **컴파일 성공, Android 원본 실행 성공**.

원본 입력/출력 JSON, 로그, 바이너리 참고 자료: [실행 증거 Artifact 14008438657](https://github.com/lyonbegin/hitel-room/actions/runs/43362645770/artifacts/14008438657).

| 실제 원본 경로 | 테스트 | 실측 결과 | 이 결과가 증명하지 않는 것 |
|---|---:|---|---|
| `FUN_001acf1c` PCM `std::vector<float>` 삽입 | 11개 | 데이터·용량 대조 전부 통과 | 전체 스레드 동시성 |
| `FUN_001a80dc` 추론 진입 전 대기·임계값 분기 | 12개 | 모두 통과 | 모델 추론 실행 결과 |
| `FUN_001a7fbc` PCM 누적 / Canon 초기화 | 기존 6개 + 추가 9개 | 각각 6/6, 9/9 통과 | 실제 모델·백엔드 초기화 후 경로 |
| `FUN_001a8230` 발화 종료·최종 샘플 경계 | 11개 | 11/11 통과 | 비동기 출력 flush 완료 |
| `FUN_001aa40c`·`FUN_001a84cc` 프레임 dequeue/큐 카운트 | 4개 | 4/4 통과 | 원본 GPU 출력 프레임의 색상 채널 순서 |
| `FUN_001a7a04` → `FUN_001aa40c` 비동기 출력 이관·꺼내기 | 1프레임/2프레임 | **2/2 통과** | 실제 ML 모델이 생성한 영상 |

기존 `FUN_001a9794` 전처리 원본과 독립 모듈의 5종 PCM/35,200 Float32 비교, `FUN_001a7db0` Canon 이력 초기화 비교 역시 [기존 원본 대비 독립 함수 검증](https://github.com/lyonbegin/hitel-room/actions/runs/43356046681)에서 통과하였다. 이 두 독립 함수만 vendor-free 모듈의 수치 동등성 범위이다.

## 원본 PCM 누적 버퍼 관찰치

추가 9개 원본 `FUN_001a7fbc` 실측은 [Actions #43360642203](https://github.com/lyonbegin/hitel-room/actions/runs/43360642203) 및 [원본 상태 Artifact 14007902918](https://github.com/lyonbegin/hitel-room/actions/runs/43360642203/artifacts/14007902918) 참고.

| 입력 누적 샘플 수 | 원본 버퍼 용량(Float32 샘플) | 상태 |
|---:|---:|---|
| 0 | 64,000 | PASS |
| 8 | 64,000 | PASS |
| 25,599 | 64,000 | PASS |
| 25,600 | 64,000 | PASS |
| 44,000 | 64,000 | PASS |
| 69,600 | 128,000 | PASS |
| 128,001 | 256,000 | PASS |

단편화된 다회 입력 역시 원본 Float32 데이터·카운터·발화 상태·Canon 이력과 일치하였다. 이 시험에서 네이티브 엔진의 출력 처리 한도를 0으로 설정하여 추론 실행을 의도적으로 차단했다. 이를 실제 영상 렌더링의 원본 동등성으로 확대 판정하지 않는다.

## 실제 비동기 프레임 버퍼 소유권 확인

원본 코드가 사용하는 중요한 필드/구조:

- 네이티브 출력 큐 mutex: `engine_state + 0x7c`; 출력 큐 count: `engine_state + 0xd0`.
- 프레임 deque의 내부 slot 크기 `0x38`바이트; 할당 블록에 `0x49`개 slot. **이 값은 최대 큐 크기의 증거가 아니다.**
- 원본 비동기 백엔드의 pending frame 영역: `backend + 0x530` 부터 `backend + 0x538`.
- 백엔드 프레임 수집과 메모리 소유권 이전: `FUN_001a7a04`; 원본 프레임 소비: `FUN_001aa40c`.
- 영상 프레임 크기 `0x124800` = 1,198,080바이트 = 416×720×4.
- 소비자는 native queue에서 image pointer 소유권을 분리한 뒤 호출자 버퍼로 프레임을 복사하고 내부 이미지 할당을 해제한다.

[최종 실험 JSON](https://github.com/lyonbegin/hitel-room/actions/runs/43362645770/artifacts/14008438657)의 `original_frame_transfer_report.json` 값:

- `single_frame`: `original_queued = 1`, `exact_popped = 1`, `pass = true`
- `two_frames`: `original_queued = 2`, `exact_popped = 2`, `pass = true`
- 최종: `case_count = 2, passed = 2, failures = 0`.

원본 `FUN_001aa40c` 단독 검증의 `original_frame_pop_report.json`에서는 서로 다른 4개 패턴의 1,198,080바이트 프레임이 모두 정확히 복사되고, 프레임 메타데이터·카운터·버퍼 소유권 해제가 일치했다. 같은 함수의 빈 큐 재호출은 0을 반환했다.

**중요 한계:** 이 영상 데이터는 시험 코드가 만든 프레임이다. 원본 ML 백엔드의 실제 추론 결과가 아니며 GPU/모델 및 실시간 A/V 출력은 검증하지 않았다.

## 함수별 신규 직접 실행 시험 소스

- [PCM 추가·스케줄러 경계](../experiments/bithuman-expression2-oracle/OriginalPcmGuardJNI.cpp)
- [실제 원본 PCM 누적](../experiments/bithuman-expression2-oracle/OriginalFeedAccumulationJNI.cpp)
- [추가 PCM 상태·Canon 이력](../experiments/bithuman-expression2-oracle/OriginalFeedStateJNI.cpp)
- [실제 원본 발화 종료 경계](../experiments/bithuman-expression2-oracle/OriginalEndSegmentGuardJNI.cpp)
- [실제 원본 프레임 꺼내기](../experiments/bithuman-expression2-oracle/OriginalFramePopJNI.cpp)
- [실제 원본 비동기 프레임 이관과 연속 꺼내기](../experiments/bithuman-expression2-oracle/OriginalFrameTransferJNI.cpp)
- [Android 회귀검증 스크립트](../experiments/bithuman-expression2-oracle/test_original_emulator.sh)
- [원본 ARM64 재현/실행 CI](../.github/workflows/expression2-original-dsp-oracle.yml)

## 미완료 및 후속 우선순위

1. 실제 원본의 음성 입력이 `FUN_001a8500` 인코더·모션 생성과 비동기 백엔드로 넘어갈 때의 프레임/토큰/타임스탬프 동등성. 현재 임의 토큰 생성 구현은 원본으로 인정하지 않는다.
2. 원본 JVM `ArrayBlockingQueue(1024)`·worker·`engineLock`과 원본 네이티브 출력 큐/async scheduler의 연속 `feed`→`pump`→`pull` 실제 실행.
3. 발화 종료 후 실제 백엔드 flush, reset/close 경합, 입력 큐 역압, 프레임 큐 동시성 예외 시험.
4. Android ARM64 실제 기기에서 첫 프레임 지연·20fps·오디오 동기화·네이티브 포맷 실측.
5. 자체 독립 SDK의 각 원본 함수 대비 입력·상태·출력·오류를 동일 입력으로 차례로 비교. 완전히 검증되지 않은 구간은 원본 함수 그대로 실행하는 참조 경로와 명확히 분리.

**판정:** 확보한 원본 SDK의 네이티브 PCM 누적, 추론 이전 스케줄러, 발화 경계, 프레임 이관, 프레임 소비의 해당 통제 조건은 실제 원본 ARM64 실행에서 검증되었다. 전체 vendor-free Expression 2 SDK 완료나 원본 인공지능 렌더링·실시간 20fps 동등성은 아직 입증되지 않았다. Essence 2는 미착수이다.
