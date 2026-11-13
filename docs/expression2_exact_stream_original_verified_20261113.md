# Expression 2 원본 스트리밍 함수 실제 코드 추적·검증 보고

검증일: 2026-11-13
범위: Expression 2만. Essence 2 미착수. 새로운 렌더링/스트리밍 알고리즘 작성 없음.

## 원본 증거

- 대상: unmodified Maven AAR ai.bithuman:expression2-android:0.6.2
- 원본 AAR SHA256: 067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584
- JVM 전체 클래스 검증: 92개, 실패 0. https://github.com/lyonbegin/hitel-room/actions/runs/43328017533/artifacts/13994215608
- ARM64 네이티브 함수 실제 명령어 추적: JNI 28개, 함수 1,035개, 명령어 65,933개, 실패 0. https://github.com/lyonbegin/hitel-room/actions/runs/43328017533/artifacts/13992718722
- 원본 함수 스트리밍 검증: JVM 13개 메서드, 네이티브 JNI 8개, 함수 호출 관계 9개, 실제 명령어 해시 검사 모두 통과. https://github.com/lyonbegin/hitel-room/actions/runs/43333795273

## 원본 Kotlin/JVM 함수에서 확인된 사실

- Expression2Avatar.feed(float[],offset,count): 입력 인덱스를 검사, ArraysKt.copyOfRange로 새 FloatArray를 만들고 enqueue. feed가 직접 JNI를 호출하지 않는다.
- Expression2Avatar.pending: ArrayBlockingQueue 크기 1024. 이 값은 프레임 수가 아니라 큐에 수용하는 작업 수이다.
- enqueue: startWorker()를 호출하고 inFlight를 증가시킨 다음 ArrayBlockingQueue.put을 수행. 작업 등록은 큐 용량에 의한 역압이 적용된다.
- startWorker: expression2-render라는 이름, daemon=true, priority=5인 스레드를 시작.
- runWorker: 발화 중에는 큐를 최대 5ms 기다리는 poll 경로를 사용. 발화 중이 아닐 때 take() 사용. 작업이 없는 발화 중 간격에서는 pumpQuietly() 호출.
- runWorker 작업 종류: FloatArray → Native.feed; Long → Native.endSegment; 정수 0 → Native.beginSegment; 정수 1 → Native.reset(true); 정수 2 → Native.reset(false).
- drainPending: inFlight가 0이 될 때까지 doneCond.await. beginSegment / flushTail은 엔큐 후 해당 처리 완료를 기다린다.
- pumpQuietly: aliveLock readLock 및 engineLock을 잡은 뒤 Native.pump(handle) 호출. 오류는 AtomicReference에 기록.
- pull(ByteBuffer): meter.noteObserved / MeterHost.gate / meter.withholds 확인 이후 Native.pullToBuffer. 성공 시 stamp()로 프레임 정보를 생성하고 사용량을 기록.
- frame stamp(long[4] meta): frame index=meta[0]. 이미 기록한 lastIndex 이상에서 인덱스가 다시 시작하면 ptsBaseFrames로 시간축 연속성을 맞춤. presentationTimeUs=(ptsBaseFrames+index)*1,000,000/20. audioSample=meta[2]; isSpeech=(meta[3]!=0). 원본 FPS 타임스탬프 간격 50,000us.

## 원본 ARM64 함수 연결 (Ghidra 주소)

- Java_ai_bithuman_expression2_Native_feed @ 001724d8 → FUN_001a7fbc @ 001a7fbc.
- FUN_001a7fbc → FUN_001a80dc @ 001a80dc.
- Java_ai_bithuman_expression2_Native_pump @ 00172bf8 → FUN_001a8404 @ 001a8404.
- FUN_001a8404 → FUN_001a80dc.
- FUN_001a80dc → FUN_001a8500 @ 001a8500 (음성 특징/움직임 추론 경로).
- Java_ai_bithuman_expression2_Native_pumpForPull @ 00172d1c → FUN_001aa594 @ 001aa594.
- Java_ai_bithuman_expression2_Native_beginSegment @ 001724d0 → FUN_001a7cfc @ 001a7cfc.
- Java_ai_bithuman_expression2_Native_endSegment @ 00172acc → FUN_001a8230 @ 001a8230.
- Java_ai_bithuman_expression2_Native_reset @ 00172e68 → FUN_001a779c @ 001a779c.

이 연결은 원본 함수 주소와 함수 기계어 SHA-256, 실제 직접 호출 관계가 일치하는지 자동 확인했다. 동적 디스패치는 별도로 추적해야 한다.

## 원본 음성 버퍼 조건

FUN_001a80dc의 복원된 실행 분기를 원본 명령어 근거와 함께 확인했다.

- 입력 시작 후 index==0에서 조건 0x6400=25,600샘플 (16kHz/1.6초).
- index==1 조건 44,000샘플 (16kHz/2.75초).
- index>=2 조건 index×0x6400+0x47e0, 즉 index×25,600+18,400샘플.
- 별도의 발화 종료 파라미터가 들어오면 다른 분기를 사용. 발화 종료/무음 패딩 정확한 동작은 네이티브 함수의 분기와 실제 실행 결과를 추가 대조해야 한다.

여기서 25,600샘플은 음성 입력 단계의 조건이지, 첫 영상이 반드시 1.6초 후 출력된다는 실측 결과가 아니다.

## 현재 미완료

- JNI 하위 함수의 간접 호출 및 동적 백엔드 콜백까지 완전 추적.
- 발화 경계, 무음 패딩, 중첩 입력 창, 53프레임 구조에서 실제 생성 스케줄러의 원본 대비 수치 동등성 검증.
- 큐가 가득 찰 때, 도중 reset/flush/close 시 예외 및 메모리 상태의 동작 비교.
- 첫 프레임 지연시간, 연속 feed→pull 시각·프레임 정확도, 20fps 실시간 성능 실측.
- 결과가 원본 SDK와 동일한 기능적 호환 SDK 개발과 통합 테스트.

**중요:** 기존 별도 Kotlin/Python 테스트 엔진의 53프레임 결과는 원본 SDK 함수의 대체 구현으로 취급하지 않는다. 원본 함수 본문·실제 기계어 명령과 JVM 코드를 우선 사용하고, 실제 출력의 동일성이 검증되기 전에는 임의의 로직을 덧붙이지 않는다.

## 재현

- tools/bithuman_deep/ghidra/Expression2ExactAudit.java
- tools/bithuman_deep/expression2_original_jvm_inventory.sh
- tools/bithuman_deep/verify_expression2_original_stream.py
- .github/workflows/expression2-original-stream-proof.yml
