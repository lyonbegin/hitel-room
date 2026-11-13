# Expression 2 원본 SDK ↔ HITEL 재조립 SDK 함수·상태·메모리 비교 명세
기준일 2026-11-14. Expression 2 전용. 원본 Android 앱 `bithuman-product/bithuman-examples/android/expression2-hello`의 Java/Kotlin/UI/WAV는 수정하지 않는다.

## 0. 결론: 현재 무엇이 실제로 증명되었는가
- 원본 기준: `ai.bithuman:expression2-android:0.6.2`, AAR SHA256 `067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584`, ARM64 `libexpr2jni.so` SHA256 `ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c`.
- 원본 공식 GitHub example은 Gradle 기본 버전 `0.6.1`이다. 원본 함수/기계어 직접실행 기준은 `0.6.2`이므로, 정확한 차분 비교에서는 두 진영에 적용할 공개 API/ABI의 버전을 먼저 고정해야 한다. 같은 GitHub 샘플의 소스/리소스는 동일하게 둔다.
- 원본 0.6.2의 ARM64 함수 직접실행은 오라클의 통제 조건에서 검증했다: https://github.com/lyonbegin/hitel-room/actions/runs/43362645770 (JSON 원본 artifact 14008438657). 원본 전체 AI 렌더링은 통과한 적 없다.
- 독립 C++ 전처리 `FUN_001a9794` 대응, Canon 이력 `FUN_001a7db0` 대응은 원본 바이트·Float32 출력 기준 일치. 이 두 함수에 대한 제한적 PASS와 나머지 전체 SDK의 미검증을 분리한다.
- 현재 독립 drop-in SDK는 원본 GitHub 앱 빌드·설치·기동 PASS, 13.87초 WAV 모델 로딩 PASS, 전체 프레임 생성 FAIL. 진단 실행 https://github.com/lyonbegin/hitel-room/actions/runs/43512156880 은 첫 윈도 `enc` 약26.9초, 14회 `step` 약156초, `dec16` 최초 호출 후 4분 제한 내 출력 없음. 첫 구조 불일치는 `dec16`보다 이른 PCM/스케줄러 경계에서 확인된다.

## 1. 기본 원칙: 두 실행 모두 같은 원본 앱과 동일한 입력
원본 앱 소스, `speech.wav` 원본 SHA256, Agent `A23WJF0199`, IMX SHA256, 동일 모델 그래프, 16kHz Float32 PCM 조각 분할, OS/API/ABI, 모델 런타임 버전, cold/warm 캐시 조건을 하나의 manifest로 기록한다. 모델 파일은 `197741350`바이트, SHA256 `d2c70beaa48b73d40681366879599d4940f744b736105c030fe13c6852d626d9`; `canon.bin`은 `299520`바이트.

원본 공식 `Expression2Avatar.create()`는 검증 당시 유효한 bitHuman API Secret 없이는 JVM 관리 계층에서 거부되었다. 인증 우회·과금 우회는 사용하지 않는다. 따라서 현재 증거가 지원하는 비교는 **원본 ARM64 실제 함수 오라클(추론 차단 통제 조건 포함)** 대 저희 함수의 같은 통제 조건 비교다. 원본의 실제 inference/영상 실행을 재현하는 데에는 적법하게 인증된 기준 실행이 별도로 필요하고, 그 자료가 없으면 원본 대비 full-render 동등성은 NOT VERIFIED로 표시한다. 현재 독립 SDK의 로컬 테스트 표식은 원본 인증 성공 증거가 아니다.

## 2. 실행 추적 순서, 함수 주소·상태·메모리
| 순서 | 원본 함수 또는 계층 | 상태/메모리 스냅샷 | 현재 독립 SDK 대응 | 현재 판정 |
|---|---|---|---|---|
| 01 | JVM `Expression2Avatar.feed(float[],off,len)` | 원본 입력 sha256, FloatArray copy sha256, 1024 작업 큐 길이, inFlight | Kotlin `feed` + `Command.Audio` | 부분 유사, 원본과 전체 상태 동등성 미검증 |
| 02 | worker `runWorker → Native.feed` JNI `0x001724d8` | 작업 타입, enqueue/dequeue, segment 상태, 큐 역압 | `runWorker`에서 Kotlin PCM 누적 | **JNI/native 입력 경로 누락** |
| 03 | `FUN_001a7fbc` `0x001a7fbc` + `FUN_001acf1c` | engine+0x38/0x40/0x48 buffer begin/end/capacity; +0x50 count; +0x58 total; Canon history | Kotlin `pcm:FloatArray(65536)`; 별도 C++ stream-state는 AAR에 링크되어도 이 경로에서 호출되지 않음 | **구조 불일치** |
| 04 | `FUN_001a80dc` `0x001a80dc` | step engine+0x68; frame limit +0x2c; native queued +0xd0; backend outstanding +0x500/+0x560; tail flag +0x31 | `processCompleteWindows` 에서 44000 조건 및 stride 25600만 사용 | **스케줄·backpressure 불일치** |
| 05 | `FUN_001a8500` → `FUN_001a9794` | 44000 PCM 윈도 → 35200 Float32 전처리 텐서; 전후 SHA/크기; 입력 위치/pad/overlap | `Expression2Native.preprocess` (C++), 임의 추출 44000 윈도 | **전처리 함수의 고정 입력은 PASS; 실제 윈도 선택은 미검증** |
| 06 | `FUN_001a7db0` | canon 299520B → history 4792320B, 소유권, 해시 | `Expression2Native.canonHistory` | 해당 고정 입력 기준 bitwise PASS |
| 07 | 인코더 및 토큰 그래프 | `enc`: [1,35200]→[1,55,12,768]; `tok14`: [1,14,16,384]; 원본 토큰 bank 선택, state hash | `Interpreter.runSignature(enc,tok14)` | 원본 전체 동적 Tensor 경계 미검증 |
| 08 | `step` / recurrent history | step input history [1,16,16,90,52], output [1,16,90,52]; frame-step counter/후속 history | 14회 반복 현재 `runWindow()` | 원본 윈도·state progression 대비 미검증 |
| 09 | async decoder/backend | phase + last motion; `dec16/dec8` tensor shape/size, outstanding, queue pressure, buffer birth | `dec16/dec8` 호출, 4분 제한 중 최초 `dec16` 미완료 | **E2E FAIL, 원본 함수 값 동등성 미검증** |
| 10 | `FUN_001a7a04` `0x001a7a04` | backend+0x530..0x538 → engine frame deque ownership transfer, +0xd0 count | Kotlin `LinkedBlockingQueue<Pixels>` | **네이티브 소유권 모델 불일치** |
| 11 | `FUN_001aa40c` `0x001aa40c`, `Native_pullToBuffer` `0x00172e7c` | 1198080B RGBA-ish frame copy, metadata, native allocation free | `bitmap.setPixels(IntArray)`, queue poll | **출력 버퍼·소유권 경로 불일치** |
| 12 | `FUN_001a8230` / `FUN_001a8404` / `FUN_001aa594` | endSegment·tail·pumpForPull·inFlight·프레임 종료 | `flushTail`가 모든 윈도 추론 완료까지 latch 대기 | **종료 동기화/병렬성 불일치** |

위 지점은 실제 증거가 지원하는 정적/함수실행 관찰과 현재 코드 대조이다. 원본 내부 유효 포인터 주소를 원본과 후보 사이에 그대로 비교하는 것은 ASLR/allocator 차이 때문에 금지한다.

## 3. 비교 데이터 계약: 함수 입출력과 메모리의 '흐름'을 함께 저장
두 진영의 각 함수 경계에서 공통 JSONL 레코드를 만든다:
```json
{
  "fixture": "speech_221904_single_feed",
  "reference": "original_0.6.2",
  "stage": "native_pcm_append",
  "event": "exit",
  "ordinal": 0,
  "original_rva": "0x001a7fbc",
  "thread": "expression2-render",
  "input": {"dtype":"float32","count":221904,"bytes":887616,"sha256":"..."},
  "output": {"dtype":"float32","count":221904,"bytes":887616,"sha256":"..."},
  "memory": {
    "pcm": {"logical_id":"pcm-0","owner":"engine","size_samples":221904,"capacity_samples":256000,"live_bytes":887616,"capacity_bytes":1024000,"resized_from":64000,"content_sha256":"..."},
    "history": {"logical_id":"canon-history-0","owner":"engine","size_bytes":4792320,"sha256":"..."}
  },
  "state": {"segment_open":true,"tail":false,"step_index":0,"native_queued_frames":0},
  "timing": {"elapsed_ms":0.0},
  "proof_kind": "original_native_oracle_inference_blocked"
}
```
위 레코드의 용량은 **221904 샘플을 누적하고 추론 진입을 차단한 통제 조건**을 나타내는 수치 예시다. 원본 실제 라이브 추론에서 프레임 처리와 입력 소비가 진행되는 경우 같은 용량을 당연시하면 안 된다. 표본 시간/해시는 예시이므로 실제 측정값으로만 채운다.

필수 정규화:
- 각 `event`에 `fixture + stage + ordinal + thread role + boundary` 고유키를 부여. 스레드가 다르므로 벽시계 총순서만 비교하지 않고 생산자/소비자 선후관계(happens-before)를 확인.
- 주소: 실제 포인터는 기록하되 비교 키는 `logical_id, owner, allocation/realloc/free, byte_count, element_count, capacity, sha256, consumer`로 비교. ASLR 메모리 주소의 숫자 차이는 PASS/FAIL 항목이 아니다.
- `queue length, inFlight, outstanding, pending tail, step-index, timestamp`를 각 경계에서 캡처하고, 출력 버퍼 소유권 이전 시 이전 보유자의 pointer=null 여부도 기록.
- 버퍼 복사와 view는 구분: `copy_from`, `realloc_from`, `move_ownership_from`, `free`를 구분하고 source가 가진 SHA256를 destination과 연결.
- 추론 그래프는 입출력 *shape + dtype + byte stride + SHA256 + 유효 수치 검증* 모두 필요. 로그에 `dec16 begin`만 있는 것은 완료가 아니다.
- `PASS`는 대응 가능한 원본 실제 실행 증거와 동일 입력/상태/출력일 때만. 원본 정적 디컴파일만 있을 때는 `STRUCTURE_MATCH_STATIC` 또는 `NOT_VERIFIED`; 원본 모델 실행 자료 없이 렌더링 정답 여부는 `NOT_VERIFIED`.

## 4. 실제 입력/메모리 계산과 최초 불일치 탐지
공통 벡터: 0, 8, 25599, 25600, 44000, 69600, 128001, 221904 float PCM. 같은 값 배열을 ① 단일 feed ② 여러 chunk feed로 나누어 양쪽에 완전히 동일하게 주입한다. 항상 함수별 before/after 및 queue progress를 기록한다.

- 원본 오라클(추론 차단)의 `FUN_001a7fbc`: count=25600→capacity 64000, count=69600→capacity 128000, count=128001→capacity 256000 (sample). 출처: 실제 `original_feed_state_report.json`.
- 현 drop-in의 Kotlin `FloatArray(65536)`에 **221904개를 한 번에** 넣으면 `max(65536*2,221904)=221904`까지 확장된다. 원본 오라클 방식의 버퍼와 **capacity/owner/event order가 이미 다르다**.
- Float32 221904 = 887616B. 44000 전처리 입력 = 176000B. 35200 전처리 출력 = 140800B. history = 4792320B. 단일 출력 영상 = 1198080B.
- 후보 `dec16` 출력 텐서 버퍼는 `16 × 3 × 720 × 416 × 4 = 57507840 B`, 입력은 `16 × 36 × 90 × 52 × 4 = 10782720 B`. 숫자만 같아도 tensor contenu·소유권·수명은 별도 비교.
- **최초 불일치 원칙:** upstream 입출력 해시나 메모리/상태에서 처음 달라진 `stage + ordinal`을 고정. 다운스트림 오차가 이전 함수의 잘못된 입력 때문이면 다운스트림 함수를 수정하지 않고 첫 원인 함수를 수정.
- 이후 그 함수의 원본 FDE 주소/호출지/상수·함수 포인터 테이블/전역 데이터/힙 구조 및 원본 JNI 바이트코드를 확인하여 수정. 원본 ELF 파일의 바이트 정확 재조립과 새로운 SDK C++/Kotlin의 기능 동등성은 별도 검증.

## 5. 정확한 비교 시험 순서
1. **Reference manifest 고정:** original `0.6.2`, 공개 모델 SHA, 실기기/에뮬레이터 ABI, 동일 WAV, 함수 FDE 및 오라클 입력/출력 증거. 보유한 실제 원본 오라클에서 시작한다. 원본이 인증 단계에서 멈추면 그 이후를 PASS로 꾸미지 않는다.
2. **PCM/Canon 통제 환경:** 원본 JNI/내부 함수 하네스와 현 drop-in SDK의 동일 경계에 같은 입력을 주입. `feed` → PCM allocate/grow/copy → canonical → scheduler precheck의 byte/size/capacity/state/ownership 차분 표를 만든다.
3. **스케줄/async 경계:** 25599/25600/44000/69600 및 tail에서 native frame-limit, outstanding, queue count를 각각 통제하여 이전·이후 이벤트 순서를 대조. 원본에 없는 44000-only 진입, 비동기 pump 누락을 수정.
4. **추론 입력 경계:** 원본 `FUN_001a8500`의 실제 PCM selection/pad → `FUN_001a9794` 출력 해시가 원본 오라클과 일치하는지 우선 확보. 인코더·token bank·step/history 원본 실제 실행 trace를 확보할 수 없는 경우 단계별 원본 동등성을 **미검증** 처리.
5. **Frame ownership/flush 경계:** `FUN_001a7a04` producer → native frame deque → `FUN_001aa40c` consumer 1198080B 이전 및 해제, metadata/pts/queue count 차분. JVM `flushTail`의 worker control completion과 실제 전체 영상 완료를 혼동하지 않는다.
6. **첫 차이만 수정 및 회귀:** 최초 불일치의 원본 데이터/상태/함수 연결을 복원한 뒤 **같은 원본 앱, 같은 SHA input, 같은 기존 벡터**에서 재시험. 통과된 경계가 회귀하면 수정 반려. 실제 E2E는 인증된 original baseline이 없으면 `candidate-only generated frame`으로 기록하며 `original-parity PASS`로 부르지 않는다.

## 6. 근거
- 원본 함수 주소 FDE/ELF: https://github.com/lyonbegin/hitel-room/actions/runs/43428318447
- 원본 함수 실제 통제 실행: https://github.com/lyonbegin/hitel-room/actions/runs/43362645770
- 원본 프레임 소유권: `docs/expression2_actual_arm64_stream_state_and_frame_transfer_verified_20261113.md`
- 원본 JVM/ARM64 입력·상태: `docs/expression2_original_pcm_lifecycle_and_indirect_call_followup_20261113.md`
- 전처리/Canon bitwise 동등성: `docs/expression2_two_original_functions_vendor_free_bitwise_pass_20261113.md`
- 재조립 후보 실제 실행 trace: https://github.com/lyonbegin/hitel-room/actions/runs/43512156880
- 후보 구현: `sdk/expression2-dropin/src/main/java/ai/bithuman/expression2/`, `sdk/expression2-verified-core/`

본 명세는 우회 구현이나 새로운 시연 앱이 아니라, **같은 원본 앱을 사용하면서 원본 증거를 직접 비교하는 기준**이다.
