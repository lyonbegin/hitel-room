# Essence 2 Android SDK 0.10.3 — 원본 역공학 1차 성공 및 다음 채팅 개발 인계서

날짜: 2026-11-15. 이 문서는 bitHuman Essence 2만을 대상으로 합니다. Expression 2의 함수 수/바이트/명령어/모델 구조를 그대로 전용하지 않습니다.

## 0. 반드시 지킬 기준

- 공식 SDK 원본: ai.bithuman:essence2-android:0.10.3, Android minSdk29, arm64-v8a.
- **원본 Kotlin·Java·C++ 기능을 다시 구현하지 않습니다.** 원본 AAR 내부의 JVM classfile과 ARM64 ELF 기계어를 보존하고, 필요한 코드/문자열을 원본 바이트 수준에서만 제한적으로 수정한 뒤 SDK를 다시 조립합니다.
- 원본 AAR, 수정 없는 재조립 AAR, JVM 문구 수정 AAR은 서로 다른 산출물이며 SHA-256으로 구별합니다.
- AAR/JAR ZIP 전체 해시와 내부 파일을 압축 해제한 뒤의 바이트 동일성은 반드시 구별합니다.
- 인증과 과금 시스템은 무력화하지 않습니다. 원본 인증 거부 조건은 그대로 유지합니다.
- FDE 숫자는 ELF 언와인드 주소 범위이고 고급언어 원본 함수의 총수를 뜻하지 않습니다.
- SDK 빌드, 앱 설치, 네이티브 라이브러리 로드, 실제 음성→영상 프레임 생성은 각각 별도의 검증 항목입니다.

## 1. 저장소, 브랜치, 공식 AAR 해시

- GitHub: https://github.com/lyonbegin/hitel-room
- Essence 전용 브랜치: feature/bithuman-essence2-original-binary-audit-20261115
- 공식 AAR: https://maven.bithuman.ai/ai/bithuman/essence2-android/0.10.3/essence2-android-0.10.3.aar
- 원본 AAR: 10,988,512바이트; SHA256 = 49bdeafc6a29675058851c5f7336dacaa0518d5af5bc6130eece96af73513e67
- 원본 classes.jar SHA256 = cdfad434c4cd693385f338bd94d4e531c64baaa835ac3a00630b700aeb499254
- AAR ZIP 항목 20개, JVM JAR 항목 116개, .class 110개.

원본 ELF 별 기록:

| 원본 ARM64 ELF | bytes | SHA256 | .eh_frame FDE | 분리 조각 |
|---|---:|---|---:|---:|
| libe2u_jni.so | 2,512,344 | d5a89d011efc2610b39223c5482db420742c577a4696c381a6ade1bf7119e591 | 2,499 | 2,534 |
| lible_jni.so | 3,958,328 | cad8e6a49c8019c25855e1dae7a745b60cbacd19198a84e682b8a6dbfbbf6ea5 | 8,656 | 8,701 |
| libonnxruntime.so | 20,667,168 | 1dac3ab19fa75f99827b52eb99f792b204160b0ed09762a9df8ad81cf74aea93 | 35,149 | 35,217 |
| libc++_shared.so | 1,253,544 | b17919df195f29b0a238468c04171b93cedcdffbe0d30cdc634327cf7f7889bc | 2,397 | 2,436 |
| **합계** | | | **48,701** | **48,888** |

libe2u_jni.so는 새 E2U 엔진 JNI이며, lible_jni.so는 기존 Essence 엔진 JNI입니다. ONNX Runtime과 C++ shared library도 반드시 보존해야 합니다.

## 2. 원본 바이트만으로 ELF·JVM·AAR을 분해/재조립한 방법

프로그램: tools/bithuman_deep/essence2_original_sdk_inventory_reassembly.py

1. 공식 원본 AAR 다운로드, 전체 SHA-256, ZIP CRC, ZIP 항목 이름 및 오프셋 확인.
2. classes.jar의 JVM .class 110개와 기타 모든 JAR 항목을 각각 원본 바이트 파일로 분해.
3. 네 ELF의 .eh_frame FDE 시작점·길이 및 섹션/프로그램 헤더·패딩·GOT/PLT·재배치 저장 영역의 파일 경계를 모두 확보.
4. 모든 원본 ELF 바이트를 겹치지 않는 48,888개 조각 파일로 분류, 조각별 시작/끝/해시를 별도 TSV 기록.
5. 원본 SO 복사로 초기화하지 않은 빈 출력 파일을 열고 ZIP 안에 저장한 조각을 원래 ELF 파일 오프셋 순서로만 읽어 새로운 SO 네 개 생성.
6. 네 SO 각각 원본과 전체 바이트 비교 + SHA 완전 동일 확인.
7. JVM .class 원본을 새 classes.jar에 넣고 JAR 내부 모든 엔트리 압축 해제 데이터 동일 확인.
8. 네 SO·새 JAR·원본 Manifest/ProGuard/리소스/라이선스 등 AAR 구성 항목 20개를 새 AAR로 합침.
9. 원본 비-JVM AAR 항목 전체 데이터와 JVM JAR 내부 파일 전체를 대조. 불일치 0건.

성공 결과:
- 원본 보존형 재조립 AAR: Essence2_0.10.3_original_JVM_ARM64_reassembled.aar
- SHA256: 00657a151cb697a546447152a4213df205cd0c455044c86f88e3bbb226cf7f3e
- CI: https://github.com/lyonbegin/hitel-room/actions/runs/43712181851
- 전수 보고: essence2-original-sdk-audit.json, essence2-aar-members.tsv, essence2-jvm-classfiles.tsv, 네 SO의 .fde.tsv 및 .pieces.tsv

**한계:** 원본 주소 위치에서 바이트를 무손실 복원했습니다. 임의 새 주소로 재링크·추론 엔진 기능 변경·독립 렌더링 동등성까지 증명한 것은 아닙니다.

## 3. 원본 JVM ASM 9.7.1 + JDK javap 분석

프로그램: tools/bithuman_deep/Essence2OriginalJvmAsmAudit.java

- 110 클래스, 1,255 메서드.
- 원본 바이트코드 메서드 호출 지점 4,910, invokedynamic 335.
- native 메서드 선언 62, JVM branch site 2,609, try/catch region 470.
- System.loadLibrary 호출 4개.
- ClassReader, ClassNode, MethodNode로 원본 코드, 필드/상속, 디스크립터, 분기, 예외, 문자열 상수, method invocation을 인벤토리화.
- javap -p -c -s -l로 실제 원본 110클래스 전부 디스어셈블.
- 출력: jvm-classes.tsv, jvm-methods.tsv, jvm-calls.tsv, jvm-string-references.tsv, jvm-native-methods.tsv, jvm-asm-summary.json.

JNI 연결 프로그램: tools/bithuman_deep/essence2_jvm_jni_crosswalk.py
- 원본 JVM native 선언 62.
- libe2u_jni.so의 정적 Java_ 내보내기 10 + lible_jni.so의 정적 내보내기 52 = 62.
- 정적 이름/메서드 매칭 62/62, 미해결 0.
- 동적 RegisterNatives, 힙·스레드 수명 및 렌더링 성공까지 증명한 것은 아님.

CI: https://github.com/lyonbegin/hitel-room/actions/runs/43712542106

## 4. 다섯 원본 ARM64 독립 분석 도구

- Ghidra 12.2: tools/bithuman_deep/ghidra/Essence2FdePcodeMemory.java — 원본 P-code LOAD/STORE/CALL/CALLIND, FDE 주소별 실행 경로.
- Capstone 5.0.6: tools/bithuman_deep/essence2_five_tool_lief_capstone.py — 실제 기계어 전체 명령·레지스터·분기 디코딩.
- LIEF: 같은 Python 프로그램 — ELF 세그먼트·동적 심볼·재배치·GOT/PLT.
- DDisasm + GTIRB: DDisasm Docker와 tools/bithuman_deep/five_tool_gtirb.py — 코드/데이터 블록, 심볼·CFG.
- Dyninst ParseAPI: tools/bithuman_deep/essence2_five_tool_dyninst.cpp — 원본 FDE 시딩 후 함수/기본 블록/CFG.
- 교차표: tools/bithuman_deep/essence2_five_tool_cross_compare.py

| 분석 결과 | E2U 엔진 | 기존 Essence 엔진 |
|---|---:|---:|
| FDE | 2,499 | 8,656 |
| Capstone 명령 | 483,590 | 569,346 |
| Capstone 미해석 바이트 | 0 | 0 |
| LIEF 재배치 | 3,826 | 8,440 |
| Ghidra FDE P-code 분석 | 2,499/2,499 | 8,656/8,656 |
| Ghidra LOAD / STORE | 107,498 / 61,649 | 124,679 / 80,397 |
| Dyninst FDE 시작점 매칭 | 2,499/2,499 | 8,656/8,656 |
| Dyninst 시딩 후 함수 시작점 합계 | 2,959 | 11,101 |
| DDisasm CodeBlock 원본 FDE 시작점 매칭 | 2,499/2,499 | 8,656/8,656 |
| DDisasm CodeBlock 수 | 89,012 | 134,908 |

다섯 도구 실행, 교차표 생성 전부 성공: https://github.com/lyonbegin/hitel-room/actions/runs/43713144110

### 4.1 Ghidra 미분류 원본 명령어 교정

- 최초 Ghidra 자동 분석과 Capstone 디코딩 비교에서 E2U FDE 12개, 기존 엔진 FDE 16개에서 미분류 구간이 남았음.
- tools/bithuman_deep/ghidra/Essence2OriginalFdeGapAudit.java로 28 FDE에서 4바이트 누락 슬롯 정확히 15+153=168개 조사. 모두 Ghidra UNDEFINED 상태였음(원본 SO 코드 변경 아님).
- Ghidra DB 전용 재인식 도구: tools/bithuman_deep/ghidra/Essence2OriginalGapRecover.java
- 재인식 후 **E2U 원본 해당 FDE 14,878/14,878 4바이트 슬롯 인식**, **기존 엔진 23,201/23,201** 슬롯 인식. 누락 0.
- Ghidra 분석 DB에서만 분류 복구; 원본 ARM64 바이트·ELF 전체 변경 0.
- 최초 분류 감사 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43714262977
- 모든 누락 슬롯 복구 성공 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43714730264

**주의:** 수동 시드·재분석이 필요했던 Ghidra 인식 오류를 숨기지 않습니다. 전 바이트 재분류 PASS와 모든 간접 호출/네이티브 함수 의미 복원은 다른 개념입니다.

## 5. 원본 JVM 문자열 바이트만 바꾼 수정 SDK

프로그램: tools/bithuman_deep/essence2_original_jvm_text_patch.py

- 정확한 JVM classfile: ai/bithuman/elevate/BithumanCodes.class
- Constant Pool UTF8 index #173, 원본 클래스파일 문자열 페이로드 오프셋 2549.
- 원래 문구: "no API secret was found, so this render cannot be attributed to an account" (74바이트)
- 새 문구: "HITEL_ESSENCE2_JVM_TEXT_PATCH_OK_20261115: a valid API secret is required." (74바이트)
- **클래스 파일 1개만 수정**, 원본 JVM 명령어/분기/스택맵/인증 경로 수정 0.
- 네 원본 SO 4개 전부 0바이트 변경. 기타 AAR 파일 무변경.
- 클래스 상수풀 인덱스와 메서드 주소 유지. javap 원본/수정 비교 PASS.
- 수정 AAR: Essence2_0.10.3_JVM_text_only_reassembled.aar
- SHA256: 22356d6deed692268d73d365b2a4ca019b250cad60169a1e04e35f068db570d1
- 수정된 SDK를 공식 bitHuman essence2-hello 앱에 적용한 APK 빌드 성공, DEX 새 문자열 포함 확인.
- CI: https://github.com/lyonbegin/hitel-room/actions/runs/43713490280

## 6. 진짜 Android 실행 검증

프로그램:
- experiments/bithuman-essence2-jvm-direct-patch-test/MessageProbeActivity.kt
- tools/bithuman_deep/test_essence2_direct_jvm_patch_android.sh
- 워크플로: .github/workflows/essence2-original-jvm-patch-real-android-runtime.yml

실제 Android ART 실행 로그:
  ESSENCE2_METERING_CODE=metering_no_credential
  ESSENCE2_METERING_REFUSES=true
  ESSENCE2_METERING_MESSAGE=HITEL_ESSENCE2_JVM_TEXT_PATCH_OK_20261115: a valid API secret is required.
  ESSENCE2_JVM_PATCHED_CONSTANT_REAL_ART_RUNTIME_PASS
  ESSENCE2_ORIGINAL_NATIVE_LOAD_PASS=le_jni
  ESSENCE2_ORIGINAL_NATIVE_LOAD_PASS=e2u_jni
  ESSENCE2_PROBE_END

- 수정된 원본 JVM 클래스에서 메서드를 실제 호출했고 새 문구가 반환됨.
- 원본 refuses=true, 원본 인증 검증 및 사용량 관리 유지.
- 기존 Essence JNI, E2U JNI 원본 SO 둘 다 실제 Android native bridge 로드 성공.
- 실제 모델 다운로드와 feed/pull 영상 프레임 생성은 시험하지 않았음.
- 성공 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43713893056

## 7. SDK가 포함된 공식 앱 빌드 및 AppSealing 구분

- 공식 원본 앱: https://github.com/bithuman-product/bithuman-examples/tree/main/android/essence2-hello
- 원본 앱 app/src 전/후 해시 일치, SDK 의존성만 재조립 AAR로 교체하여 실제 APK 빌드 성공.
- 무변경 AAR 공식 앱 빌드: https://github.com/lyonbegin/hitel-room/actions/runs/43712753272
- 변경 AAR 공식 앱 빌드: https://github.com/lyonbegin/hitel-room/actions/runs/43713490280

- 원본 AAR과 두 APK에서 AppSealing 관련 정적 벤더 마커는 모두 0개. 런타임 보호나 다른 메커니즘의 존재 자체를 부정하는 증거 아님.
- 정적 검사 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43714502854

## 8. 정확한 프로그램·Actions 파일 경로

- tools/bithuman_deep/essence2_original_sdk_inventory_reassembly.py
- tools/bithuman_deep/Essence2OriginalJvmAsmAudit.java
- tools/bithuman_deep/essence2_jvm_jni_crosswalk.py
- tools/bithuman_deep/essence2_five_tool_lief_capstone.py
- tools/bithuman_deep/essence2_five_tool_dyninst.cpp
- tools/bithuman_deep/five_tool_gtirb.py
- tools/bithuman_deep/essence2_five_tool_cross_compare.py
- tools/bithuman_deep/ghidra/Essence2FdePcodeMemory.java
- tools/bithuman_deep/ghidra/Essence2OriginalFdeGapAudit.java
- tools/bithuman_deep/ghidra/Essence2OriginalGapRecover.java
- tools/bithuman_deep/essence2_original_jvm_text_patch.py
- tools/bithuman_deep/test_essence2_direct_jvm_patch_android.sh
- experiments/bithuman-essence2-jvm-direct-patch-test/MessageProbeActivity.kt
- tools/bithuman_deep/expression2_package_protection_inventory.py (모델 비종속 읽기 전용 공통 도구)

실행 워크플로:
- .github/workflows/essence2-original-jvm-arm64-aar-reassembly.yml
- .github/workflows/essence2-original-jvm-asm-jni-crosswalk.yml
- .github/workflows/essence2-original-five-tools-both-native-engines.yml
- .github/workflows/essence2-original-ghidra-capstone-gap-classification.yml
- .github/workflows/essence2-original-ghidra-fde-gap-recovery.yml
- .github/workflows/essence2-reassembled-official-example-apk.yml
- .github/workflows/essence2-original-jvm-text-patch-aar-apk.yml
- .github/workflows/essence2-original-jvm-patch-real-android-runtime.yml
- .github/workflows/essence2-original-aar-apk-protection-inventory.yml

## 9. 지금 완료된 것과 다음 개발

**1차 성공:** 원본 JVM·네이티브 전체 분리, 5도구 분석과 명령어 누락 분류 교정, JNI 62/62 정적 매칭, 네 ELF·JAR 원본 바이트 재조립, AAR/공식 APK 제작, JVM 1개 문자열 직접 수정, 실제 Android JVM 실행 및 두 엔진 SO 로드까지 모두 검증.

**아직 미검증:** 1) 유효한 공식 SDK 이용 권한으로 실제 모델을 준비하여 E2U/기존 Essence 엔진 각각 create/feed/pull 성공 및 영상 프레임 생성, 2) 모델 세션 상태/실시간 스트리밍, 3) 임의 기계어 명령 패치와 재배치, 4) 동적 포인터/간접호출 수명 관계 완전한 복원.

### 다음 채팅 시작 지시문

Essence 2 원본 SDK 개발을 계속하십시오. lyonbegin/hitel-room의 feature/bithuman-essence2-original-binary-audit-20261115 브랜치에서 본 문서를 모두 읽은 뒤, 기존 작성된 실제 스크립트·GitHub Actions를 재사용하십시오. Java/C++ 재구현으로 돌아가지 말고 원본 JVM 바이트코드와 ARM64 기계어를 직접 분류·검증·필요 부분만 수정하십시오. 0.10.3 AAR 해시, JVM 110클래스/1,255메서드, JNI 62/62, 원본 SO 4개/48,701 FDE, 48,888 조각 무손실 재조립, Ghidra 미정의 168개 원본 명령어 복원, JVM 문구 교체 및 Android 로드 검증 결과를 기준으로 삼으십시오. 실제 영상 생성이 검증되기 전까지 완료로 표시하지 마십시오.
