# HITEL Expression 2 독립 Android SDK 개발 — 다음 채팅 인수인계서

2026-11-13 기준 / Expression 2만 대상, Essence 2는 보류.

## 0. 결론과 다음 채팅의 목표

**목표는 원본 SDK의 인증·과금 기능을 그대로 재사용하는 것이 아니라, 실제 AI 음성-영상 생성 연산과 스트리밍 처리를 완전히 파악하여 저희 C/C++ 네이티브 Android SDK로 독립 구현하는 것입니다.**

- 원본은 코드 함수만이 아니라 상수·전역 상태·포인터 테이블·링커 재배치·외부 라이브러리·모델 리소스가 한꺼번에 결합된 시스템입니다.
- 원본 바이너리 함수 주소는 JNI 진입점부터 추적하는 방식보다 **.eh_frame_hdr 함수 주소 정렬 색인 → .eh_frame FDE 범위 → 심벌 테이블 및 함수 포인터 테이블** 순서로 복원하는 것이 정확합니다.
- 원본 ELF 분해 → 재조립 → SHA-256/전 바이트 비교는 **PASS**입니다. 다만 이것은 원본 파일의 원위치 재조립이지 자체 컴파일 SO 완성이 아닙니다.
- **이미 검증된 독립 C++ 네이티브 SO가 존재하므로**, 다음 채팅은 이 코어를 기반으로 기능별 통합 구현부터 시작합니다.
- **원본 관리 계층의 인증 거부 이후 실제 AI 엔진이 모두 정상 실행된다는 사실은 미검증**입니다. 인증이나 과금 통제를 무력화하는 수정 없이, 독립적인 모델 실행 경로를 개발합니다.

## 1. 정확한 원본과 저장소

- 저장소: https://github.com/lyonbegin/hitel-room
- 브랜치: feature/bithuman-expression2-imx-sdk-audit-20261112
- 공식 Android SDK: ai.bithuman:expression2-android:0.6.2
- 공식 AAR SHA-256: 067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584
- 원본 ARM64 ELF: jni/arm64-v8a/libexpr2jni.so (1,188,304바이트)
- 원본 ELF SHA-256: ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c
- 공개 Wise Pup IMX SHA-256: d2c70beaa48b73d40681366879599d4940f744b736105c030fe13c6852d626d9
- Android 모델: combined_litert.tflite 158,524,428바이트 + canon.bin 299,520바이트
- Canon SHA-256: cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5
- 영상 프레임: 416 × 720 × 4 = 1,198,080바이트

## 2. 원본 SDK 실행 경계 — 실제 차단 위치

원본 Kotlin/JVM 메서드의 정적 호출 구조는 다음과 같습니다.

    Expression2Avatar.Companion.create(context, model, options)
      -> MeterHost.arm(model)
           -> SelfHostMeter 세션 및 credential 확인
           -> 인증/사용량 관리 계층 거부 가능
      -> createEngine(...)                 [현재 에뮬레이터 시험 미도달]
           -> Native.create(...)          [미도달]
      -> feed(float PCM) -> native feed/pump
      -> pull(Bitmap/ByteBuffer)
           -> noteObserved()
           -> MeterHost.gate(...)
           -> SelfHostMeter.withholds()
           -> native pull()
           -> noteFrames()
      -> close() / meter stop()

### 실제 관찰

- SDK/원본 ARM64 라이브러리 로드: **PASS**.
- 원본 공개 모델 파일 검증 및 Expression2Model.combined(...) 생성: **PASS**.
- Expression2Avatar.create(...) 호출: **거부됨**.
- 예외: ai.bithuman.expression2.Expression2Exception: refusing to serve: no API secret was found.
- 실제 모델 추론·실제 영상 프레임 생성: **도달하지 못함**.
- 근거: https://github.com/lyonbegin/hitel-room/actions/runs/43407580595
- 정적 인증 흐름: https://github.com/lyonbegin/hitel-room/actions/runs/43323736373

앞선 대화에서는 SelfHostMeter.Companion.arm(...) 및 MeterHost.refused(...)를 구체적인 예외 경로로 지목했습니다. **확정된 실행 관측 지점은 Expression2Avatar.create()의 거부입니다.** throw 명령어의 최종 정확한 JVM 바이트코드 위치는 추후 클래스 전체 javap 명령어와 재대조할 수 있습니다.

**주의:** 이 오류가 Kotlin/JVM 관리 계층에서 발생한다는 점과 실제 AI 엔진이 정상 실행된다는 주장은 별개입니다. 세션 객체·상태/초기화 의존성이 남을 수 있습니다. 독립 엔진은 실제 모델 입출력을 별도 구성하고 시험해야 합니다.

## 3. 원본 ARM64 함수 주소 색인: 2,629개 FDE

기존 오류: JNI export 28개에서 직접 호출만 추적하여 얻은 1,035개 함수를 원본 전체라고 간주했던 분석은 불완전했습니다. 따라서 과거의 '425,324바이트가 누락 함수'라는 설명을 **폐기**합니다.

정정된 원본 바이너리 실측:

| 검증 항목 | 원본 실측 |
|---|---:|
| .eh_frame_hdr 정렬 주소 색인 | 2,629개 |
| .eh_frame 실제 FDE 범위 | 2,629개 |
| 주소 색인-실제 FDE 시작 주소/포인터 대조 | 전수 일치 |
| 함수 심벌 고유 시작 주소 | 1,175개 |
| 심벌에 없는 FDE 시작 주소 | 1,454개 |
| 재배치가 가리키는 코드 포인터 | 1,838개 항목 / 910개 고유 |
| 함수 심벌 또는 FDE로 확인한 실행 영역 | 681,396 / 689,056바이트 |
| 실행 영역 커버리지 | **98.89%** |
| .text 미분류 | **316바이트** |
| .plt 링크 스텁 미분류 | **7,344바이트** |
| 총 미분류 실행 영역 | **7,660바이트** |

FDE 기록 하나가 무조건 원본 고급언어 함수 하나를 의미하는 것은 아닙니다. .plt를 일반 AI 함수로 계산하면 안 됩니다.

- 원본 색인 재조립 검증 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43428318447
- 분석 코드: tools/bithuman_deep/expression2_address_table_recompose.py
- 수정된 정식 보고: docs/expression2_function_index_fde_reassembly_corrected_20261113.md

## 4. 분해·재조립 및 함수 밖의 구성요소

원본 ELF 1,188,304바이트를 32개의 상호 겹치지 않는 파일 조각으로 분해한 뒤 원래 오프셋에 재조립했습니다.

- 재조립 원본과 바이트 차이: **0**.
- SHA-256: **동일**.
- CI: https://github.com/lyonbegin/hitel-room/actions/runs/43424730088
- 코드: tools/bithuman_deep/expression2_elf_reassemble_diff.py

**이 성공은 원본을 그대로 보존하는 파일 레이아웃 재조립의 성공입니다. 원본을 새 C++에서 다시 링크한 SO의 기능 검증은 아닙니다.**

원본 실제 구성:

| 종류 | 대표 영역/파일 | 유의점 |
|---|---|---|
| 기계어 함수 | .text 및 실행 섹션 | 원본 주소, 직접/간접 호출, 상대 분기 |
| 읽기 전용 상수 | .rodata | 함수에서 참조하는 문자열, 테이블, 상수 |
| 재배치 후 상수/포인터 | .data.rel.ro | 함수/가상함수 포인터 등 |
| 쓰기 가능한 상태 | .data, .bss | 초기화, 버퍼, 스레드 및 힙 소유권 |
| ELF 동적 링크 | GOT/PLT, .rela.dyn, .rela.plt | 호출 대상 주소 재배치 |
| 생명주기/예외 | .init_array, .fini_array, .eh_frame 등 | 생성/종료/언와인드 |
| JVM SDK 계층 | classes.jar | worker, 큐, 관리 계층 |
| 별도 런타임 | libLiteRt.so 및 시스템 라이브러리 | 모델 추론 백엔드 |
| 별도 모델/리소스 | IMX 내부 17개 항목 | .so 내장 함수로 오해 금지 |

- ELF 섹션 **28개**, 재배치 **3,787개**, 이 중 .data.rel.ro 대상 **3,120개**.
- 정적 섹션 분류 자체는 함수별 모든 데이터 참조와 힙 객체 구조를 복원한 것은 아닙니다.
- 원본 ELF/모델 리소스 감사: https://github.com/lyonbegin/hitel-room/actions/runs/43416563947
- 도구: tools/bithuman_deep/expression2_elf_data_inventory.py

## 5. 원본 ARM64 실측 및 독립 SDK 현 상태

### 원본 함수 직접 호출에서 검증된 부분

| 원본 함수 | 실제 통과한 검사 |
|---|---|
| FUN_001acf1c | PCM 버퍼 추가 11 사례 |
| FUN_001a7fbc | PCM 누적 및 Canon 상태 기존 6 + 추가 9 사례 |
| FUN_001a80dc | 추론 전 스케줄러 분기 12 사례 |
| FUN_001a8230 | 발화 종료 경계 11 사례 |
| FUN_001aa40c / FUN_001a84cc | 프레임 큐 출력·카운트 4 사례 |
| FUN_001a7a04 → FUN_001aa40c | 합성 테스트 프레임 1개/2개 이관·추출 2 사례 |

- 원본 직접 실행 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43362645770
- 분석 기록: docs/expression2_actual_arm64_stream_state_and_frame_transfer_verified_20261113.md
- 위 프레임은 **모델이 만들어낸 영상이 아니라 시험용 합성 프레임**입니다.

### 독립 C++ SO에서 원본과 비트 단위 일치한 부분

이미 소스 기반 독립 libexpression2_verified_core.so가 있습니다.

1. FUN_001a9794 대응 **음성 전처리**: 44,000 Float32 입력 → 35,200 Float32 출력; 5종 입력에서 원본과 **0바이트 차이**.
2. FUN_001a7db0 대응 **Canon 이력 초기화**: 299,520바이트 입력 → 4,792,320바이트 출력; 원본과 **0바이트 차이**.

- 소스: sdk/expression2-verified-core/src/expression2_verified_core.cpp
- 헤더: sdk/expression2-verified-core/include/expression2_verified_core.h
- 에뮬레이터 재현 워크플로: .github/workflows/expression2-vendor-free-verified-core.yml
- 실행/검증: https://github.com/lyonbegin/hitel-room/actions/runs/43356046681
- 6개 기준 벡터, 총 5,496,320 출력 바이트가 원본과 일치했습니다.
- 원본 libexpr2jni.so, 원본 AAR, libLiteRt.so를 넣지 않고 빌드한 독립 네이티브 코어 테스트이며 **전체 SDK가 아닙니다**.

## 6. 다음 채팅에서 실제 개발할 순서

**더 이상 원본 함수 목록을 1,035개만 기준으로 반복 추적하지 마십시오.** 2,629개 FDE 함수 범위 색인을 전체 함수 위치의 주축으로 삼아야 합니다.

1. **기존 독립 SO 회귀검증:** 실제 원본 기준 6개 입력/출력을 Android 에뮬레이터에서 재확인합니다.
2. **PCM 누적·음성 윈도·flush·스케줄러 통합:** 원본 상태 필드와 입력 임계값·출력값 대조 후 자체 C/C++ 객체로 묶습니다.
3. **실제 원본 데이터 연결:** 해당 함수군이 참조하는 .rodata/.data.rel.ro/.data/.bss와 재배치 대상·힙 소유권을 추적합니다. 함수 단위가 아니라 **코드+데이터+상태+리소스** 단위로 구성합니다.
4. **공개 IMX 모델의 실추론 연결:** LiteRT 모델 signature, 텐서 shape/stride, 초기화, encoder/motion/decoder 경로를 확인합니다. FUN_001a8500의 원본 추론 전체는 아직 **미검증**입니다.
5. **실제 얼굴 프레임 출력:** 모델이 실제로 만든 416×720 RGBA 프레임을 저장하고 내용·타임스탬프·큐 소유권을 검증합니다. 합성 프레임 통과를 성공으로 대체하지 않습니다.
6. **실시간 스트리밍:** worker / ArrayBlockingQueue(1024), 음성 공급, pump, pull, flushTail, reset, close를 연결하고 첫 프레임 지연 및 FPS를 측정합니다.
7. **APK/SDK 최종 검증:** Android 14 에뮬레이터에서 설치·동작, 충돌/메모리·출력 증거 확보 이후에만 사용자용 설치물을 전달합니다.

실제 개발의 각 단계는 **코드 변경 → 빌드 → 에뮬레이터 실행 → 로그/출력 파일 확보 → 원본 대조 → PASS/FAIL/NOT VERIFIED 판정**의 순서입니다.

### 주의사항

- Ghidra 의사코드는 원본 개발자가 작성한 C++ 텍스트가 아닙니다.
- 정식 세션 거부가 확인되었다고 해서 그 이후의 AI 엔진이 정상이라고 주장하지 않습니다.
- API Secret/로그인 암호/세션 키 요구나 추가 유료 API 호출을 새로 만들지 않습니다.
- 인증·과금 통제를 우회하는 패치와 공개 모델 기반 자체 엔진 개발을 혼동하지 않습니다.
- 사용자가 설치하기 전 에뮬레이터에서 테스트하고, 미검증 기능은 반드시 미검증이라고 보고합니다.
- **Expression 2가 끝나기 전 Essence 2로 넘어가지 않습니다.**

## 7. 다음 채팅에 복사할 시작 지시문

> **HITEL Expression 2 독립 Android SDK 개발을 이어서 시작하십시오.**
>
> GitHub lyonbegin/hitel-room 브랜치 feature/bithuman-expression2-imx-sdk-audit-20261112에 있는 docs/expression2_independent_sdk_development_handoff_20261113.md 문서를 먼저 읽으십시오. 다시 추상적인 설계만 반복하지 마십시오.
>
> 원본 2,629개 .eh_frame_hdr/FDE 주소 범위를 기준으로 코드와 상수·데이터·상태·리소스 참조를 연결하십시오. 이미 검증한 두 독립 C++ 함수를 보존하고, PCM 입력·누적·윈도·전처리·인코더 입력 경로를 실제 독립 SO로 통합하십시오. 이어서 공개 IMX 모델의 실제 추론과 얼굴 프레임 생성까지 순차 개발하십시오.
>
> 각 변경마다 실제 Android 에뮬레이터 빌드·실행·원본 입력/출력 대조를 수행하고 GitHub 커밋, Actions 링크, PASS/FAIL/NOT VERIFIED 및 실제 로그를 보고하십시오. 원본 인증 계층과 AI 추론 엔진은 구분하되, 인증을 제거하면 추론이 모두 실행된다고 가정하지 마십시오. 실제 모델 영상 출력 전에는 완성 판정이나 사용자 설치 요구를 하지 마십시오. Essence 2는 진행하지 마십시오.

---

**최종 개발 판정 (2026-11-13):** 원본 구조 및 주소 인덱스 분석 완료 / 원본 ELF 재조립 무차이 확인 / 일부 원본 ARM64 함수 실행 확인 / 독립 C++ 2기능 SO 비트 동등성 확인 / **실제 전체 AI 추론·영상 생성·실시간 SDK는 아직 개발·검증 중**.
