# HITEL Expression 2 — 원본 JVM·ARM64 역공학, 분해·재조립, 직접 수정 방법론 및 개발 인계서

**문서 목적:** 다른 개발 채팅에서 이전 대화를 다시 읽지 않고도 2026년 11월 14일까지 검증한 전체 절차를 재현하도록 정확한 소스 경로, 스크립트별 기능, 프로그램 버전, 입력/출력, 실행 기록, 한계와 다음 작업을 보존합니다.

**대상:** bitHuman 공식 Android Expression 2 SDK 0.6.2. Essence 2는 대상이 아닙니다.

## 0. 가장 중요한 개발 방침과 과거 문서의 정정

1. 원본 SDK 기능을 Kotlin, Java, C 또는 C++로 다시 구현하지 않습니다. **원본 JVM classfile 바이트코드와 ARM64 ELF 기계어를 그대로 보존**하고, 필요한 변경만 해당 수준에서 수행합니다.
2. 원본 JVM과 ARM64는 하나의 기계어 파일로 링크되는 것이 아닙니다. **classes.jar + JNI + 원본 .so + AndroidManifest 및 리소스**를 하나의 AAR 패키지로 결합하는 것이 목적입니다.
3. 입력 원본의 SHA-256을 고정하고 각 구성요소를 분리하여 분석한 다음, 새 파일에 다시 조립하고, 원본에 대한 바이트 차이를 검사합니다.
4. **원본 보존형 AAR**과 **JVM 오류 문구만 바뀐 AAR**은 별도로 유지합니다.
5. 기존 docs/expression2_independent_sdk_development_handoff_20261113.md는 그날의 **독립 C++ 구현 계획**을 기록한 역사적 문서입니다. 이후 사용자가 명확히 변경한 원본 보존형 방향과 충돌하므로 **현행 개발 지침으로 사용해서는 안 됩니다**. 기존 sdk/expression2-dropin 및 sdk/expression2-verified-core도 원본 SDK 자체의 재조립물이 아닙니다.
6. SDK 재조립 성공, 공식 예제 앱 빌드 성공, Android 실기기 실행 성공, 합법적 인증 통과, 실제 모델 렌더링 성공은 각기 다른 검증 단계입니다. 현재 마지막 세 항목의 성공은 입증하지 않았습니다.
7. 이 문서에 나온 C++/Java 파일은 **분석 프로그램의 구현 언어**이지 원본 SDK를 소스 언어로 다시 만든 코드가 아닙니다.

## 1. 고정된 저장소와 입력 원본

- 저장소: https://github.com/lyonbegin/hitel-room
- 브랜치: **feature/bithuman-expression2-imx-sdk-audit-20261112**
- 공식 SDK 의존성: **ai.bithuman:expression2-android:0.6.2**
- 공식 Maven 입력: https://maven.bithuman.ai/ai/bithuman/expression2-android/0.6.2/expression2-android-0.6.2.aar
- 공식 AAR: **3,130,324B**, SHA256 **067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584**
- AAR 내부 ARM64 SO: **jni/arm64-v8a/libexpr2jni.so**, **1,188,304B**, SHA256 **ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c**
- AAR 내부 JVM JAR: **classes.jar**, **277,910B**, SHA256 **e3c2a4bbf4a0e7f8e610c061f4d26317a97f16949d805b03ea73444d0a3ff751**
- AAR 내부 추론 런타임: **jni/arm64-v8a/libLiteRt.so**, **5,508,376B**, SHA256 **97355a36cb8ac7628cf407773291e98da79f3ef184cc43cb0e57dedf5f0c0637**
- 원본 ABI: **Android ARM64 / AArch64 ELF64 Little Endian**.
- AAR ZIP 항목: **12개** (파일 10개, 디렉터리 2개). JAR 내부 ZIP 항목: **97개**, 비디렉터리 파일 93개, JVM 클래스 92개.
- AAR의 AndroidManifest, R.txt, ProGuard, LiteRT 라이선스/고지문도 원본 바이트로 보존합니다. 별도 IMX 모델은 AAR에 포함된 항목과 혼동하지 않습니다.

## 2. 전체 처리 구조

~~~text
공식 Maven AAR 0.6.2 / SHA 검증
   ├─ classes.jar
   │    ├─ ASM ClassReader / ClassNode → 92개 클래스 / 1,040개 메서드
   │    ├─ javap -p -c -s -l → 원본 92개 클래스 바이트코드 전수 조회
   │    ├─ 클래스별 원본 바이트 분리 → 다시 classes.jar 구성
   │    └─ (별도 수정 버전) SelfHostMeter$Companion.class 문자열 2곳 교체
   ├─ libexpr2jni.so
   │    ├─ .eh_frame/FDE 2,629개 범위 색인
   │    ├─ Ghidra / Capstone / DDisasm-GTIRB / Dyninst / LIEF
   │    ├─ 원본 ELF 헤더·섹션·함수 경계·갭 2,660개 조각으로 분리
   │    └─ 원본 조각만으로 새 빈 파일에 SO 재조립 → SHA 완전 동일
   ├─ 28 JVM native 선언 ↔ 28 ARM64 JNI export 정적 대응
   ├─ libLiteRt.so / AndroidManifest.xml / ProGuard / META-INF
   └─ 새 AAR로 재패키징
         ├─ 모든 원본 항목 내용 대조
         └─ bitHuman 공식 expression2-hello 예제 앱에 SDK 의존성만 교체
                └─ Gradle APK 빌드 / DEX 새 문구 / ARM64 SO 포함 확인
~~~

**원본 AAR 전체 ZIP SHA가 재압축 때문에 달라지는 것과, 내부 개별 클래스·SO·리소스가 동일한 것은 별도 판단**해야 합니다.

## 3. 네이티브 5개 도구별 사용 목적과 검증 수치

| 도구 | 실제 사용한 기능 | 확인된 수치 | 주의 |
|---|---|---|---|
| **Ghidra 12.2** | 원본 ARM64 기계어의 FDE 함수·Raw P-code LOAD/STORE/CALL/CALLIND·정적 참조 | FDE 2,629, P-code 564,007, LOAD 39,397, STORE 25,488, CALL 10,865, CALLIND 1,304 | 정적 명령 개수이지 런타임 메모리 소유권 입증 아님 |
| **Capstone 5.0.6** | ARM64 명령어 디코딩, 명령 피연산자·레지스터·분기/직접 호출 검사 | 170,349 명령어, 681,396바이트 디코드, 직접 호출 10,865, 간접 1,304 | FDE 범위만 0 미해석 바이트 |
| **DDisasm/GTIRB** | 독립 코드·데이터 블록 및 CFG·심볼 분류 | CodeBlock 45,023, DataBlock 5,583, CFG edge 78,375, 심볼 22,207 | 블록 수는 함수 수 아님; GTIRB rewriter로 새 ELF 동일성은 미검증 |
| **Dyninst ParseAPI** | FDE 시딩 및 함수/기본 블록/호출 그래프의 독립 분석 | FDE 시드 2,629, 전체 발견 시작점 3,083, 일치 2,629, 추가 454, CFG edge 346,097, call edge 54,147 | 원본 FDE 주소를 직접 시딩했으므로 2,629개 독립 자동발견이라 표현 금지 |
| **LIEF** | ELF 섹션/세그먼트·동적 심볼·GOT/PLT·재배치 | 재배치 3,787: ABS64 1,774 / RELATIVE 1,396 / JUMP_SLOT 457 / GLOB_DAT 160 | 예전의 필터된 3,170개와 집계 범위 다름 |

Ghidra 이미지 베이스는 원본 ELF VA보다 **0x100000** 큽니다. 예: 원본 ELF **0xA7FBC**는 Ghidra **0x1A7FBC**입니다. 주소 교차 비교 때 이 차이를 반드시 보정하십시오.

**함수 시작 주소 교차 검증:** 원본 FDE 2,629개 모두 DDisasm CodeBlock 시작점에 대응했습니다. Dyninst 기본 자동 탐색은 FDE 1,731개와 일치했으나, 원본 FDE 2,629개를 시딩한 후에는 2,629개 모두 대응했습니다. Capstone/Ghidra 직접·간접 CALL 개수도 함수별 일치했습니다.

**남았던 명령어 차이:** 원본 ELF **0x1124C8**의 바이트 **0C 00 00 14**는 ARM64 분기 **B +0x30**이었습니다. Capstone은 인식했으나 Ghidra 자동 분석은 미정의로 남겼습니다. Ghidra 분석 DB에서만 명령어로 지정하여 해당 FDE의 **135/135**를 인식했습니다. 원본 SO는 수정하지 않았습니다.

**실제 실행:**
- 5도구 모두 CI PASS: https://github.com/lyonbegin/hitel-room/actions/runs/43527023435
- FDE 시딩 후 5도구 교차 CI PASS: https://github.com/lyonbegin/hitel-room/actions/runs/43528294735
- 원본 2,629개 함수 교차표: https://github.com/lyonbegin/hitel-room/actions/runs/43528294735/artifacts/14086905896
- Ghidra 명령어 누락 해소: https://github.com/lyonbegin/hitel-room/actions/runs/43528724561

## 4. ARM64 다섯 분석 프로그램 — 정확한 소스 파일과 출력

| 프로그램(저장소의 실제 경로) | 입력 → 수행 → 출력 |
|---|---|
| **tools/bithuman_deep/expression2_fde_structure_export.py** | 원본 ELF → 2,629개 FDE 주소·길이와 재배치 관계 → original-function-ranges.tsv |
| **tools/bithuman_deep/ghidra/Expression2FdePcodeMemory.java** | 원본 SO → FDE별 Raw P-code LOAD/STORE/CALLIND → pcode-summary.json, pcode-fde-coverage.tsv |
| **tools/bithuman_deep/ghidra/Expression2ExactAudit.java** | 원본 기계어 명령·함수 본문·해시 증거 추출; Ghidra 의사코드는 실제 원본 C++ 텍스트가 아님 |
| **tools/bithuman_deep/ghidra/Expression2InstructionGapAudit.java** | Ghidra 미정의 0x1124C8 명령 판별·분석DB에서 재분류; 135/135 로그 |
| **tools/bithuman_deep/five_tool_lief_capstone.py** | pyelftools/FDE + LIEF/Capstone → lief-elf-structure.json, capstone-fde-instructions.tsv, capstone-direct-call-edges.tsv |
| **tools/bithuman_deep/five_tool_gtirb.py** | DDisasm 생성 GTIRB 읽기 → ddisasm-gtirb-code-blocks.tsv, data-blocks.tsv, cfg-edges.tsv, summary.json |
| **tools/bithuman_deep/five_tool_dyninst.cpp** | Dyninst ParseAPI로 SO를 원본 FDE 주소 시딩 후 파싱 → dyninst-function-blocks.tsv, dyninst-cfg-edges.tsv, dyninst-summary.json |
| **tools/bithuman_deep/five_tool_cross_compare.py** | 모든 도구 출력 주소를 통일 → original-function-five-tool-crosswalk.tsv, RESULT.json, SUMMARY.md |

**빌드·실행 환경:** Python 3.12, pyelftools 0.32, Capstone 5.0.6, LIEF, GTIRB, Ghidra 12.2, DDisasm Docker 이미지 grammatech/ddisasm:latest, Dyninst upstream 소스 컴파일. Ubuntu 24.04에는 libdyninst-dev 패키지가 없어 upstream Dyninst를 직접 빌드했고, 실제 빌드 commit은 CI upstream-commit.txt에 있습니다. Dyninst 분석기의 C++ 소스는 **원본 SDK를 C++로 재작성한 소스가 아닙니다.**

다른 유용한 보조 파일:
- **tools/bithuman_deep/expression2_address_table_recompose.py**: ELF 함수 심볼/FDE/재배치 주소 관계 조사. 기존 원본 복사형 roundtrip만으로 독립 코드 재조립을 증명했다고 해석 금지.
- **tools/bithuman_deep/expression2_elf_reassemble_diff.py**: 과거 ELF 파일 레이아웃 분리·SHA 비교, 부분 함수 디코딩 비교.
- **tools/bithuman_deep/expression2_elf_data_inventory.py**: .rodata/.data/.bss/GOT/PLT/리소스 인벤토리.
- **tools/bithuman_deep/ghidra/NativeFlow.java**: 과거 원본 네이티브 호출 흐름 보조.
- **tools/bithuman_deep/expression2_reassemble_structure_and_diff.py**: 과거 독립 HITEL Kotlin/C++ 후보와 구조 비교한 파일; **지금 원본 보존형 SDK의 기준이 아님**.

## 5. JVM 바이트코드 원본 전수 분석 방법

**사용한 실제 도구는 ASM 9.7.1과 JDK 17 javap입니다.** 이전 답변에서 제안된 SootUp은 이번 전수 실행 PASS 근거에 포함되지 않습니다.

1. 공식 원본 AAR을 SHA-256으로 검증하고 classes.jar를 추출합니다.
2. **tools/bithuman_deep/Expression2OriginalJvmAsmAudit.java** 실행. ASM ClassReader로 클래스를 원본 그대로 읽고 ClassNode/MethodNode의 필드·메서드·명령어·상수·분기·호출을 순회합니다.
3. **tools/bithuman_deep/expression2_original_jvm_inventory.sh** 실행. 원본 클래스 92개 모두에 javap -p -c -s -l을 호출하여 바이트코드 명령어를 덤프합니다.
4. 결과: **92 classes / 1,040 methods / 4,263 메서드 호출 / invokedynamic 272 / native 선언 28 / JVM 분기 지점 2,210 / 예외 구역 397 / System.loadLibrary 호출 2**.
5. 생성된 **jvm-classes.tsv, jvm-methods.tsv, jvm-calls.tsv, jvm-string-references.tsv, jvm-native-methods.tsv, jvm-asm-summary.json, javap-class-coverage.tsv**를 보존합니다.
6. 재조립할 때 JVM 코드를 소스언어로 바꾸지 않고, 원본 클래스 92개의 파일 바이트를 개별 항목으로 저장한 뒤 새 classes.jar로 묶습니다. JAR의 비디렉터리 파일 93개 모두 **압축 해제 데이터 0차이**입니다.
7. 인증/사용량 관리의 정적 함수 분석 보조 도구는 **tools/bithuman_deep/audit_android_auth.py**이며 이전 실행 https://github.com/lyonbegin/hitel-room/actions/runs/43323736373 에 근거가 있습니다.

## 6. 인증 거부 오류의 정확한 원본 함수

실행에서 확인된 원문: **refusing to serve: no API secret was found, so this render cannot be attributed to an account.**

- 원본 관측: https://github.com/lyonbegin/hitel-room/actions/runs/43407580595
- 위치는 ARM64 FDE 2,629개 안이 아닌, **JVM classes.jar** 내부입니다.
- 클래스: **ai/bithuman/expression2/SelfHostMeter$Companion.class**
- 메서드: **SelfHostMeter$Companion.arm$expression2_release(...)**
- **119: ldc_w #761**에서 문자열을 읽고, **128: invokespecial refuse(...)**로 거부 흐름을 전달합니다. 거부 예외는 MeterHost.refused/Expression2Exception 경로입니다.
- 상위 호출: Expression2Avatar.create → MeterHost.arm → SelfHostMeter 관련 세션/credential 검사 → 실패 시 예외. 당시 createEngine/Native.create 및 실제 모델 영상 생성은 **도달하지 못했습니다**.

**오류 문구 수정은 인증 상태를 바꾸지 않습니다.** 이용 계정·API Secret이 없으면 원본 거부 동작은 그대로입니다.

## 7. JNI — JVM과 ARM64의 정확한 정적 연결 분석

**tools/bithuman_deep/expression2_original_aar_repack_audit.py**가 ASM 원본 결과의 28 native 선언을 가져와 **readelf -W --dyn-syms** 결과의 28개 Java_... export 이름과 매칭합니다.

- JVM native 선언 **28**, 원본 ARM64 정적 JNI export **28**, 이름 매칭 **28/28**, 정적 미해결 **0**.
- 보고서: **jni-original-jvm-to-arm64-exports.tsv, jni-linkage-summary.json**.
- 이 수치는 이름·정적 심볼 대응을 입증합니다. RegisterNatives/실행 중 객체 생명주기/힙 소유권/동적 콜백 모두의 성공을 입증하는 것이 아닙니다.
- 관련 JSON에서 JNI_OnLoad_symbol_present는 false입니다.

## 8. 원본 ELF 기계어 2,660조각의 실제 분해·재조립 방법

**실제 소스: tools/bithuman_deep/expression2_original_native_fde_piece_assembly.py**

1. 원본 SO SHA와 ELF64 AArch64 리틀엔디언 확인.
2. ELF 헤더, 프로그램/섹션 헤더, 섹션 파일 오프셋 경계를 수집.
3. .eh_frame의 2,629 FDE 원본 VA/길이를 실제 실행 섹션 file offset으로 매핑.
4. FDE 시작/끝, 헤더·섹션 경계, 코드·데이터·패딩·갭을 하나의 오프셋 공간에 통합.
5. 상호 겹치지 않는 **2,660개 파일 바이트 구간**을 각각 독립 ZIP 조각으로 저장하고, 각 조각의 offset/length/SHA/구조 라벨 색인을 생성.
6. 원본 전체 SO를 복사해서 초기화하지 않고, **완전히 새로 연 빈 파일**에 저장된 조각만 순서대로 이어 씁니다.
7. 재구성 전체 **1,188,304바이트**, 원본과 **다른 바이트 0**, SHA **ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c**를 검증합니다.
8. 산출 데이터: **native-original-fde-split-reassembly.json, original-2629-fde-function-machine-hashes.tsv, original-elf-machine-component-index.tsv**.

**이 결과는 원본 오프셋의 무손실 복원입니다.** 기계어 각 함수를 임의의 새로운 주소로 옮겨 독립 링크했다거나 모든 동적 포인터/메모리 소유권이 해석됐다는 뜻이 아닙니다.

## 9. JVM 클래스·ARM64 ELF를 최종 AAR로 재조립한 방법

**실제 소스: tools/bithuman_deep/expression2_original_aar_repack_audit.py**

1. classes.jar의 원본 classfile 92개와 각 JAR 파일 항목을 분리.
2. 개별 바이트를 묶어 **새 classes.jar** 구성: 총 JAR ZIP 항목 97개(비디렉터리 93개) 데이터 불일치 0.
3. 8장의 조각 아카이브에서 만든 **새 ELF**만 AAR에 넣음. 원본 ELF 전체 바이트/SHA 확인.
4. 원본 **libLiteRt.so, AndroidManifest.xml, ProGuard, R.txt, AAR 메타데이터, 고지문**을 각각 동일 바이트로 복사.
5. 전체 12개 AAR ZIP 항목을 원래 순서대로 재조립.
6. 원본 AAR과 새로운 AAR의 12개 ZIP 항목 이름·압축 해제 데이터 모두 같음을 증명. AAR ZIP 전체 SHA는 재압축 때문에 **같지 않음**.
7. JNI 28/28 정적 연결, ZIP 무결성 검사를 통과한 원본 보존형 AAR 생성.

**결과: Expression2_0.6.2_original_machine_code_reassembled.aar**

- SHA256: **2529f8f0a064b4c8e8a1bb6f5fdd4627143ba4e09e05bd506bee1540e68e1527**
- 소스·CI: **.github/workflows/expression2-original-jvm-arm64-aar-assembly.yml**
- 검증 실행: https://github.com/lyonbegin/hitel-room/actions/runs/43546065817
- AAR 증거: https://github.com/lyonbegin/hitel-room/actions/runs/43546065817/artifacts/14094102017
- JVM/ELF/JNI 검증 데이터: https://github.com/lyonbegin/hitel-room/actions/runs/43546065817/artifacts/14093789315

## 10. 원본 JVM 문자열 상수 두 곳의 직접 수정

**소스: tools/bithuman_deep/expression2_patch_original_jvm_message.py**

대상 파일은 **SelfHostMeter$Companion.class 한 개**, 메서드 구현을 다시 쓰거나 인증 조건을 수정하지 않았습니다.

- 이전: **no API secret was found, so this render cannot be attributed to an account.**
- 새 문구: **HITEL_EXPRESSION2_JVM_TEXT_PATCH_OK_20261114: valid API secret is required.**
- 두 문구 모두 UTF8 **75바이트**로 맞춤.
- Constant Pool **#595**, 원본 파일 UTF8 payload offset **10261**, invokedynamic 문자열 연결 레시피. 원본 문구 75바이트만 수정, 뒤 공백과 바이트 0x01 자리표시자 그대로 보존.
- Constant Pool **#760**, 원본 파일 UTF8 payload offset **12966**, 직접 오류 문자열. 원본 문구 75바이트만 수정. 메서드의 **ldc_w #761**은 이 문자열을 참조하는 String 상수.
- 실제 달라진 바이트: 각 상수의 문자열 payload 73바이트. 원본 classfile 전체를 비교해 정확히 두 영역 외에는 바이트 변경이 없음.
- **수정된 클래스 1/92, 문자열 2개, 다른 JVM 명령어 0 변경, ARM64 ELF 0바이트 변경**.
- 클래스 길이·상수풀 인덱스·JVM 분기·StackMap·메서드 오프셋·refuse 호출 모두 유지.
- 새로운 JAR의 파일 항목 97개 중 1개 classfile만 변경, AAR 항목 12개 중 classes.jar만 변경.
- javap 원본/수정 비교 PASS; APK 안의 DEX에서 새 문구 확인 PASS.
- **인증 상태·사용량 관리·실제 거부 조건은 변경하지 않았습니다**.

**최종 수정 AAR: Expression2_0.6.2_JVM_all_error_text_patch_20261114.aar**

- SHA256: **cb9bb0b50966013bb4b1bf6340f5f2d649bb5a379b4a27f735d27460627b4179**
- 공식 예제 앱 APK: **expression2-original-jvm-text-patch.apk**
- APK SHA256: **64561c62e7f701575932129c30f6b06348d18a40feb0f774e43b7585bac2806f**
- 실행: https://github.com/lyonbegin/hitel-room/actions/runs/43547753808
- 수정 AAR: https://github.com/lyonbegin/hitel-room/actions/runs/43547753808/artifacts/14095056196
- 수정 APK: https://github.com/lyonbegin/hitel-room/actions/runs/43547753808/artifacts/14094916037
- diff 검증: https://github.com/lyonbegin/hitel-room/actions/runs/43547753808/artifacts/14094244834

## 11. 공식 Android 예제 앱 빌드 검증

공식 샘플: https://github.com/bithuman-product/bithuman-examples/tree/main/android/expression2-hello

1. bitHuman 예제 저장소 원본 clone, commit SHA 기록.
2. 예제 **app/src 파일 해시 목록**을 변경 전 저장.
3. 예제 앱 Kotlin 소스·리소스 변경 금지. 기존 SDK 의존성 하나만 재조립 AAR 파일 참조로 교체.
4. Gradle **:app:assembleDebug**로 APK 실제 빌드.
5. app/src 변경 전/후 해시 목록이 동일함을 비교.
6. APK 안에 **lib/arm64-v8a/libexpr2jni.so**, **lib/arm64-v8a/libLiteRt.so** 포함 확인.
7. 문구 수정 버전에서는 DEX 내부에 **HITEL_EXPRESSION2_JVM_TEXT_PATCH_OK_20261114**가 존재함을 확인.

- 무수정 재조립 AAR 공식 예제 앱 빌드 PASS: https://github.com/lyonbegin/hitel-room/actions/runs/43546359857
- 문구 수정 AAR 공식 예제 앱 빌드/DEX PASS: https://github.com/lyonbegin/hitel-room/actions/runs/43547753808
- 별도 에뮬레이터 설치/런처 시험: https://github.com/lyonbegin/hitel-room/actions/runs/43546980797 **ADB 연결 문제로 실패**, 실기기 실행/모델 추론 성공 근거가 아님.
- 유효 API Secret으로 정상 렌더링 시험: **수행하지 않음**.

## 12. 실제 작성한 GitHub Actions 워크플로 색인

| 목적 | 워크플로 경로 | 확인할 기록 |
|---|---|---|
| ARM64 5도구 원본 교차분석 | .github/workflows/expression2-five-tools-original-machine-code-audit.yml | Actions 43528294735 |
| Ghidra 미정의 4바이트 재분석 | .github/workflows/expression2-original-4byte-instruction-gap.yml | Actions 43528724561 |
| 원본 FDE/P-code 세부 조사 | .github/workflows/expression2-original-fde-pcode-reconstruction.yml | Actions 43518753947 |
| JVM 원본 전체 클래스·네이티브 명령 본문 | .github/workflows/expression2-original-function-bodies.yml | 해당 워크플로 로그 |
| JVM+ARM64+JNI 원본 AAR 재조립 및 공식 앱 빌드 | .github/workflows/expression2-original-jvm-arm64-aar-assembly.yml | Actions 43546359857 |
| JVM 오류 문구 두 상수 수정·AAR/APK | .github/workflows/expression2-original-jvm-message-patch-aar-and-apk.yml | Actions 43547753808 |
| 재조립 APK 에뮬레이터 설치 시험 | .github/workflows/expression2-original-reassembled-aar-emulator-smoke.yml | Actions 43546980797 (FAIL: ADB) |
| 원본 SDK API Secret 거부 관측 | .github/workflows/expression2-official-sdk-emulator.yml | Actions 43407580595 |
| 원본 인증 함수 JVM 추적 | .github/workflows/bithuman-android-auth-audit.yml | Actions 43323736373 |

## 13. 다음 채팅에서 실행할 정확한 순서

1. 본 문서를 읽고 GitHub 작업 브랜치의 현재 커밋과 모든 CI 실행 결과를 확인합니다.
2. **5도구 분석** workflow 실행 → 각 작업의 개별 PASS, FDE 2,629, 원본 SO SHA, CFG/간접 호출 미해결 목록을 검증.
3. **원본 JVM/ARM64 AAR** workflow 실행 → 92클래스/1,040메서드/28 native, SO 2,660조각/2,629 FDE, JNI 28/28, AAR 12항목 내용 차이 0을 검증.
4. **오류 문구 2곳 수정** workflow 실행 → 수정 영역 외 클래스·SO 바이트 변경 0, 기존 인증/거부 메서드 코드 동일을 검증.
5. 공식 앱 APK를 재빌드하여 DEX 수정 문구, 원본 SO/LiteRT 포함 여부, 원본 앱 소스 SHA 동일을 검증.
6. 변경하려는 **다른 함수가 지정되면** JVM/ARM64 소속·원본 주소와 호출 그래프·입출력·관련 메모리·재배치를 먼저 조사합니다.
7. 변경 영역을 명시적으로 제한한 뒤 JVM classfile 또는 ARM64 기계어 부분만 수정합니다. 수정하지 않은 모든 코드/데이터는 원본 바이트를 그대로 보존합니다.
8. **AAR 재조립 → 정적 SHA/변경 범위 검사 → APK 빌드 → ARM64 실제 단말 시험 → 모델 프레임/로그 검증** 순으로 보고합니다.
9. 미해결 indirect call/스레드·힙 소유권/모델 입출력/정상 계정 인증은 해결 전까지 NOT VERIFIED로 표시합니다.

### 핵심 재현 커맨드

~~~bash
# GitHub 브랜치 체크아웃 및 Python/pyelftools 0.32 준비 후
python3 tools/bithuman_deep/expression2_original_native_fde_piece_assembly.py \
  --elf /tmp/expression2/original.so \
  --out /tmp/expression2/native-reports \
  --temp /tmp/expression2/native-parts

python3 tools/bithuman_deep/five_tool_lief_capstone.py \
  --elf /tmp/expression2/original.so \
  --out /tmp/expression2/five-tool-lief-capstone

# 원본 보존 AAR을 생성해 둔 후, JVM 문자열만 수정하는 경우
python3 tools/bithuman_deep/expression2_patch_original_jvm_message.py \
  --source-aar /tmp/expression2/Expression2_0.6.2_original_machine_code_reassembled.aar \
  --output-aar /tmp/expression2/Expression2_0.6.2_JVM_all_error_text_patch_20261114.aar \
  --report /tmp/expression2/patch-verification.json \
  --temp /tmp/expression2/patch-working
~~~

명령은 각각 지정된 실제 파일과 고정된 원본 해시가 있을 때만 실행됩니다. 모든 의존성 설치·원본 다운로드·AAR 및 APK 빌드를 포함한 완전한 실행 순서는 **해당 GitHub Actions YAML 파일**에 있으므로 그것을 우선 기준으로 삼으십시오.

## 14. 흔한 실패와 이번에 확인한 교정 방법

1. JNI export 28개를 전체 네이티브 함수라고 간주 → 원본 FDE 2,629개 주소 범위부터 조사.
2. 원본 ELF 파일을 통째로 복사해 SHA 동일이라고 주장 → 원본에서 별도 저장한 **2,660개 바이트 조각만으로 새 빈 ELF를 조립**하고 전 바이트 비교.
3. FDE 2,629개를 고급언어 소스 함수 2,629개라고 표현 → FDE 언와인드 범위라는 점 명시.
4. Ghidra 미정의 4바이트를 바이너리 손상이라고 오인 → 원본 0x1124C8 ARM64 분기 명령, Ghidra 분석DB만 보정.
5. Dyninst 자동발견 수를 최종 FDE 범위 수로 보고 → FDE 시드 입력 전/후 구분.
6. CALL 명령어 개수와 CFG 호출 edge 수를 동일 개념으로 비교 → 지표의 측정 단위를 분리.
7. 클래스가 원본과 같아도 ZIP SHA가 다르다는 점을 무시 → **압축 해제 각 항목 데이터**와 전체 ZIP 해시를 분리.
8. 인증 오류는 ARM64에 있으리라고 가정 → JVM SelfHostMeter$Companion의 String 상수였음.
9. 오류 메시지 한 곳만 바꿈 → JVM Constant Pool **#595와 #760 두 곳** 전수 변경.
10. 바이트코드 변경을 인증 거부 우회로 오인 → 문구만 수정하고 거부 검사·상태 변화는 그대로 유지.
11. Gradle APK 빌드를 기기 런타임/영상 모델 성공으로 과장 → 실제 단말에서 별도 입출력 검증.
12. 과거 독립 C++ 재구현 코드를 원본 보존형 SDK 코어로 착각 → **별도 역사적 실험**으로 분리.

## 15. PASS / NOT VERIFIED 판정표

| 검사 | 상태 |
|---|---|
| 원본 AAR/JAR/ELF SHA 고정 | PASS |
| 원본 ARM64 5개 도구 실제 분석 | PASS |
| FDE 2,629개 함수 경계 색인 및 교차 분석 | PASS |
| ARM64 ELF를 2,660 조각으로 분리 후 새 SO로 원본 바이트 동일 재조립 | PASS |
| JVM 클래스 92개·메서드 1,040개 원본 바이트코드 전수 인벤토리 | PASS |
| JVM classfile 92개 및 JAR 93개 파일 엔트리 무변경 재조립 | PASS |
| JVM 28 native ↔ ARM64 28 JNI export 정적 매칭 | PASS |
| 원본 AAR ZIP의 12개 구성요소 데이터 동일성 | PASS |
| 대상 JVM 클래스 1개·문구 상수 #595/#760만 직접 수정 | PASS |
| 수정되지 않은 JVM 메서드 명령·원본 ARM64 ELF 바이트 유지 | PASS |
| 문구 수정 AAR 및 공식 예제 APK 컴파일·DEX 문자열 검증 | PASS |
| 모든 동적 간접 호출/메모리 포인터/스레드 소유권 복원 | NOT VERIFIED |
| ARM64 함수를 완전히 새로운 주소로 재링크 | NOT VERIFIED |
| 수정 AAR의 ARM64 실기기 실행/영상 스트리밍/렌더링 | NOT VERIFIED |
| 유효 API Secret 기반 정상 인증 및 모델 프레임 생성 | NOT VERIFIED |
| 인증·과금 우회 | NOT ATTEMPTED |
| 원본 기능의 Java/C++ 재구현 | NOT ATTEMPTED |

## 16. 추가로 함께 읽을 원본 문서와 데이터

1. **docs/expression2_original_machine_jvm_jni_final_sdk_build_verified_20261114.md** — 기준 원본 JVM+ARM64 SDK 통합 검증.
2. **docs/expression2_original_five_tool_binary_only_reclassification_20261114.md** — 원본 ARM64 5도구별 교차 결과와 미해결 항목.
3. **docs/expression2_original_jvm_message_constant_patch_reassembled_20261114.md** — JVM 문자열 상수 2곳 교체 실험.
4. **docs/bithuman_android_api_auth_bytecode_verified_20261113.md** — 원본 인증·세션/미터링 JVM 정적 분석.
5. **docs/expression2_independent_sdk_development_handoff_20261113.md** — **역사적 기록만 참고; 독립 C++ 재구현 계획은 현행 개발 지침 아님**.

## 17. 다음 채팅에 복사할 시작 지시문

> HITEL Expression 2 원본 SDK 보존형 개발을 계속 진행하십시오.
>
> GitHub lyonbegin/hitel-room 브랜치 feature/bithuman-expression2-imx-sdk-audit-20261112의 **docs/expression2_original_re_methodology_complete_handoff_20261114.md**를 먼저 모두 읽고 그 안에 있는 **정확한 스크립트·CI 실행 기록·원본 해시·PASS/NOT VERIFIED 판정**을 기준으로 작업하십시오. 2026-11-13의 C/C++ 독립 재구현 계획으로 돌아가지 마십시오.
>
> 이미 확인한 기준은 ARM64 FDE 2,629개와 ELF 2,660조각 무손실 재조립, JVM 92클래스/1,040메서드 ASM 전수 분석, JNI 28/28 정적 매칭, AAR 모든 항목 재조립, JVM 오류 문자열 상수 #595/#760 두 곳의 직접 바이트 변경, 수정 AAR·공식 앱 APK 빌드 성공입니다.
>
> 원본 SDK를 소스언어로 변환하지 말고 **원본 JVM classfile과 ARM64 machine code에서 수정이 필요한 명령·데이터만 직접 바꾸십시오**. 변경 전후 클래스/기계어/리소스 해시를 전수 비교하고, JNI 연결과 공식 앱 APK 빌드까지 검증하십시오. 실제 ARM64 기기에서 유효한 이용 권한 하에 엔진 초기화·모델 추론·영상 프레임이 확인되기 전에는 렌더링 완성이라고 주장하지 마십시오. Essence 2는 진행하지 마십시오.

**현 시점 판정:** 역공학·구성요소 분리·원본 바이트 무손실 재조립·원본 JVM 메시지 최소 수정·통합 AAR/APK 빌드는 실제 확인 완료. 실제 ARM64 기기 정상 세션·모델 영상 출력은 아직 미검증입니다.

---

## 18. 2026-11-14 추가 검증 — AppSealing 정적 검사와 실제 Android 오류 문구 실행

**별도 상세 보고:** [expression2_original_sdk_protection_and_runtime_verification_20261114.md](expression2_original_sdk_protection_and_runtime_verification_20261114.md)

- 원본 AAR과 원본/문구수정 APK의 AppSealing 관련 벤더 문자열·파일 표지 검사: **3개 모두 직접 식별 표지 0건**. 이는 보호 기능 자체의 부재를 의미하지 않습니다. CI [43551886233](https://github.com/lyonbegin/hitel-room/actions/runs/43551886233).
- 이전 에뮬레이터 CI 43546980797 실패의 직접 원인은 **`/usr/bin/sh: set: Illegal option -o pipefail`**입니다. ADB 초기 연결 경고나 원본 ARM64 SDK 손상이 근본 원인이 아닙니다.
- 별도 Bash 스크립트로 복구한 후 Android 14 x86_64 + **`libndk_translation.so`** 환경에 원본 재조립 APK·수정 APK를 각각 설치하고 MainActivity 실행에 **모두 성공**했습니다. CI [43551725719](https://github.com/lyonbegin/hitel-room/actions/runs/43551725719). 공식 샘플 UI의 API Secret 사전 안내 때문에 여기서는 `create()`까지 도달하지 않습니다.
- 수정 JVM 문구의 **실제 SDK 실행 검증**을 위해 공개 원본 모델 파일 158,524,428B와 canon 299,520B를 Android에 설치하고, 원본 ARM64 `libexpr2jni.so` 로드 및 `Expression2Model.combined` 구성 후 실제 `Expression2Avatar.create()`를 호출했습니다.
- **실제 예외 로그에 새 문자열 `HITEL_EXPRESSION2_JVM_TEXT_PATCH_OK_20261114: valid API secret is required.` 출력 PASS**. 원본 문자열은 같은 실행 로그에 나타나지 않았습니다. `RESULT.json`의 11개 검증 항목이 모두 true입니다. CI [43552151786](https://github.com/lyonbegin/hitel-room/actions/runs/43552151786).
- **검증 결론:** **원본 기계어 보존 + JVM 문자열 두 상수 직접 수정 + 재조립 AAR + Android 네이티브 로드 + 원본 모델 객체 생성 + 실제 수정 예외 발생**을 재현했습니다. **유효한 API Secret 인증 성공/실제 프레임 렌더링은 여전히 미검증**입니다.

### 새로 추가한 실행 코드·워크플로

| 실제 파일 | 목적 |
|---|---|
| `tools/bithuman_deep/test_expression2_reassembled_apks_emulator.sh` | Bash 명시 실행, 두 APK 실설치·실행, ABI·native bridge·로그·화면 저장 |
| `tools/bithuman_deep/expression2_package_protection_inventory.py` | 원본 AAR 내부 classes.jar까지 포함해 AppSealing 관련 정적 표지 확인 |
| `tools/bithuman_deep/test_expression2_modified_literal_emulator.sh` | 원본 모델·네이티브 로드 후 수정 JVM 문자열이 실제 예외에 나타나는지 검증 |
| `.github/workflows/expression2-original-reassembled-aar-emulator-smoke.yml` | 기존 에뮬레이터 실행 실패 수정 |
| `.github/workflows/expression2-original-package-protection-signature-audit.yml` | 원본 AAR/두 APK 보호 지표 정적 감사 |
| `.github/workflows/expression2-reassembled-jvm-message-real-runtime-e2e.yml` | 새 SDK의 실기기 유사 Android 실행 및 exception 검증 |

**다음 개발 채팅에서 반드시 이 18장을 포함한 인계서를 기준으로 사용하십시오.** 기존 15장 표의 에뮬레이터 관련 '미검증' 설명 중 **설치/앱 실행 부분은 이제 PASS**, **원본 모델 SDK create() 진입/수정 예외도 PASS**이며 **정상 렌더링은 미검증**입니다.
