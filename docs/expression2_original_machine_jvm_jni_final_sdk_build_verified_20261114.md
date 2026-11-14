# Expression 2 0.6.2 원본 기계어·JVM 바이트코드 SDK 통합 결과

검증일: 2026-11-14 (KST). 대상은 Expression 2 Android SDK 0.6.2이며 Essence 2는 제외합니다.

**목표 및 실제 범위:** 원본 Java/Kotlin 소스를 생성하거나 음성·영상 엔진을 C/C++로 다시 작성하지 않습니다. 원본 JVM classfile과 원본 ARM64 ELF의 함수·데이터·포인터·재배치를 보존하여 실제 파일을 분해·재조립하고 하나의 AAR SDK를 만듭니다. 원본 API Secret 인증·사용량 관리도 원본대로 유지됩니다.

## 1. 최종 산출물과 정확한 실행 링크

- **SDK 파일:** Expression2_0.6.2_original_machine_code_reassembled.aar
- **원본 전체 구성요소 재조립 성공:** https://github.com/lyonbegin/hitel-room/actions/runs/43546065817
- **원본 구성요소 재조립 AAR 다운로드:** https://github.com/lyonbegin/hitel-room/actions/runs/43546065817/artifacts/14094102017
- **JVM·JNI·ELF 전수 검사 산출물:** https://github.com/lyonbegin/hitel-room/actions/runs/43546065817/artifacts/14093789315
- **공식 예제 앱에 재조립 SDK 적용 후 Android 빌드 성공:** https://github.com/lyonbegin/hitel-room/actions/runs/43546359857
- **공식 예제 앱 APK 빌드 기록:** https://github.com/lyonbegin/hitel-room/actions/runs/43546359857/artifacts/14094063035

## 2. 원본 AAR 및 각 구성요소 확인

공식 원본 다운로드: https://maven.bithuman.ai/ai/bithuman/expression2-android/0.6.2/expression2-android-0.6.2.aar

| 대상 | 원본 크기 | SHA-256 |
|---|---:|---|
| AAR | 3,130,324B | 067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584 |
| ARM64 libexpr2jni.so | 1,188,304B | ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c |
| JVM classes.jar | 277,910B | e3c2a4bbf4a0e7f8e610c061f4d26317a97f16949d805b03ea73444d0a3ff751 |
| ARM64 libLiteRt.so | 5,508,376B | 97355a36cb8ac7628cf407773291e98da79f3ef184cc43cb0e57dedf5f0c0637 |
| 새 재조립 AAR | 3,130,135B | 2529f8f0a064b4c8e8a1bb6f5fdd4627143ba4e09e05bd506bee1540e68e1527 |

원본 AAR 내 12개 ZIP 항목(파일 10개, 디렉터리 2개)은 모두 재조립 AAR에서 같은 이름·순서·압축 해제 바이트로 확인되었습니다. AndroidManifest, ProGuard 규칙, LiteRT 라이선스·고지사항 모두 포함합니다. 원본 전체 AAR ZIP 해시는 새 압축 메타데이터 때문에 같지 않지만, **모든 개별 항목의 압축 해제 데이터는 같습니다**.

## 3. ARM64 5개 기계어 분석 도구와 실제 실행 결과

| 도구 | 분석 역할 | 검증된 집계 |
|---|---|---|
| Ghidra Raw P-code | 함수·명령·메모리 LOAD/STORE·호출 | 원본 FDE 2,629개, LOAD 39,397, STORE 25,488 |
| Capstone | AArch64 명령어 디코딩과 직접·간접 호출 | 170,349개 명령어, 직접 CALL 10,865 |
| DDisasm + GTIRB | 코드/데이터 블록·정적 CFG | 코드 블록 45,023개, 데이터 블록 5,583개, CFG 연결 78,375개 |
| Dyninst ParseAPI | 함수·기본 블록·독립 CFG | 원본 FDE 전수 주소 시딩 후 분석 성공 |
| LIEF | ELF 헤더·섹션·심볼·GOT/PLT·재배치 | 전체 재배치 항목 3,787개 |

다섯 도구 전체 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43527023435

Dyninst에 원본 FDE 2,629개 주소 시딩한 후 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43528294735

Capstone과 Ghidra 자동 디코드의 최초 차이 1개는 원본 주소 0x1124C8의 원본 AArch64 B 명령어를 Ghidra 분석 DB가 코드로 지정하지 않은 문제였습니다. DB에서 재분석하여 135/135를 확인했으며 **원본 기계어는 변경하지 않았습니다**. 검증: https://github.com/lyonbegin/hitel-room/actions/runs/43528724561

## 4. 원본 ARM64 ELF 함수 단위 분해·재조립 방법

도구: tools/bithuman_deep/expression2_original_native_fde_piece_assembly.py

1. 원본 ELF SHA-256을 대조합니다.
2. 원본 ELF의 .eh_frame FDE 범위 2,629개를 읽고 실행 섹션에서 원본 파일 오프셋을 찾습니다.
3. 함수의 시작·끝, ELF 파일 헤더, 프로그램·섹션 헤더, 섹션 경계, 갭을 함께 반영해 **2,660개의 상호 겹치지 않는 파일 바이트 범위**로 분해합니다.
4. 각 조각의 원본 바이트·오프셋·함수 소유자·SHA-256을 각각 저장합니다. 2,629개 FDE 함수별 명령어 바이트 SHA-256도 별도 TSV로 출력합니다.
5. 완전히 빈 ELF 파일을 열고, **원본 파일 전체를 미리 복사하지 않고**, 저장한 2,660개의 조각만 순서대로 불러와 원래 오프셋에 씁니다.
6. 전체 1,188,304바이트, 원본 함수 바이트 해시, 최종 ELF SHA-256을 검증합니다.

**실제 결과: 원본 ARM64 ELF 대비 전체 차이 0바이트, SHA-256 완전 동일.**

검증 파일: native-original-fde-split-reassembly.json, original-2629-fde-function-machine-hashes.tsv, original-elf-machine-component-index.tsv.

이 결과는 **원본 주소에서 코드·데이터를 무손실 재조립했다는 증거**이지, 기계어를 새로운 주소로 독립 재링크하거나 인증 없는 렌더링을 성공시켰다는 증거는 아닙니다.

## 5. JVM 92개 클래스의 바이트코드 전수 분석

도구: tools/bithuman_deep/Expression2OriginalJvmAsmAudit.java, tools/bithuman_deep/expression2_original_jvm_inventory.sh

- ASM 9.7.1의 ClassReader/ClassNode를 이용하여 원본 classfile을 변환 없이 읽습니다.
- 원본 92개 JVM 클래스, 1,040개 메서드, 메서드 호출 4,263건, invokedynamic 272건, native 선언 28개를 확인했습니다.
- 각 클래스의 상속·인터페이스·필드·메서드·JVM 명령·분기·예외 구역·문자열 상수·호출 대상을 TSV로 추출했습니다.
- javap으로 전체 92개 클래스의 실제 원본 바이트코드를 별도로 읽었습니다.
- 원본 JVM 클래스 파일 각각을 보존해 재조립한 JAR에서, 원본 JAR의 93개 비디렉터리 항목을 대조했습니다. **JAR 항목 데이터 차이 0건**.
- 원본 JAR와 새 JAR의 ZIP 전체 해시는 동일하지 않습니다. 원본 JVM 명령어가 달라진 것은 아닙니다.

파일: jvm-asm-summary.json, jvm-classes.tsv, jvm-methods.tsv, jvm-calls.tsv, jvm-string-references.tsv, jvm-native-methods.tsv, javap-class-coverage.tsv.

## 6. JNI 원본 연결 검증 및 하나의 AAR SDK로 조립

도구: tools/bithuman_deep/expression2_original_aar_repack_audit.py

1. JVM native 선언 28개와 ARM64 원본 ELF의 동적 JNI 내보내기 28개를 읽습니다.
2. JNI 정적 심볼 이름으로 대응시켜 **28 / 28 일치, 정적 미해결 0**을 확인했습니다.
3. 원본 클래스를 개별 분해 후 다시 만든 JVM JAR, 원본 2,660조각으로 재조립한 ARM64 ELF를 사용합니다.
4. 원본 libLiteRt.so, Manifest, ProGuard, 리소스, 라이선스 등 나머지 항목을 함께 넣습니다.
5. 원본 AAR의 12개 항목을 순서대로 별도의 새 AAR ZIP으로 조립합니다.
6. 원본 각 항목의 압축 해제 데이터, JAR 모든 classfile 바이트, ARM64 ELF SHA-256, JNI 매핑을 확인합니다.

28/28 JNI 정적 심볼 일치는 **이름과 내보내기 주소의 정적 대응**입니다. JNI 실제 실행·스레드 메모리 소유권 전체를 입증하는 지표는 아닙니다.

## 7. 최종 공식 앱 적용 검사

공식 원본 예제: https://github.com/bithuman-product/bithuman-examples/tree/main/android/expression2-hello

- 예제 앱 전체를 Git에서 원본 그대로 받았습니다.
- app/src 안의 Kotlin 소스·리소스를 변경하지 않았고 전/후 SHA 목록을 비교했습니다.
- 앱의 SDK 의존성만 **이 재조립한 AAR 파일**로 교체했습니다.
- Gradle app:assembleDebug 빌드 성공 (1분 20초).
- 최종 APK에 arm64-v8a/libexpr2jni.so와 arm64-v8a/libLiteRt.so가 둘 다 포함됐습니다.
- 실제 모델 렌더링과 기기 실행 시험은 **아직 검증하지 않았습니다**. 공식 API Secret이 없으면 원본의 서비스 거부 상태가 유지될 수 있습니다.

CI: https://github.com/lyonbegin/hitel-room/actions/runs/43546359857

## 8. 후속 바이트코드/기계어 직접 수정 원칙

- JVM 수정 시 특정 클래스·메서드를 ASM 트리로 읽어 필요한 JVM 명령만 직접 편집하고, StackMap 프레임/검증 후 해당 classfile을 재삽입합니다. 수정하지 않은 클래스는 원본 바이트로 유지합니다.
- ARM64 수정 시 대상 FDE 주소, 명령어 경계, 상대 분기 및 ELF 재배치를 먼저 확정합니다. 변경 부분만 기계어로 수정하고, 코드·데이터의 다른 범위는 원본을 보존합니다.
- 변경 전 원본과 완전 동일한 **기준 AAR**을 유지하고, 변경 후에는 의도한 변경만 발생했는지 클래스별·함수별 SHA 대조를 실시합니다.
- JNI API, ABI, 동적 의존성, 모델 포맷과 JNI 객체 생명주기 변화는 실제 기기 시험을 추가합니다.
- 아직 어느 기능을 수정할지 구체적으로 지정되지 않았으므로 **현재 산출물은 수정 없는 원본 보존형 재조립 AAR**입니다. 인증·과금 무력화 수정도 하지 않았습니다.

## 9. 무엇이 완료됐고 무엇이 아직 미검증인가

| 검증 항목 | 판정 |
|---|---|
| 공식 원본 해시 고정 | PASS |
| 기계어 분석 도구 5개 실사용 | PASS |
| 원본 ELF 2,629개 FDE 분해 및 2,660개 바이트 조각 재조립 | PASS |
| ARM64 ELF 원본 전체 바이트 일치 | PASS |
| 원본 JVM 92개 클래스/1,040개 메서드 전수 색인 | PASS |
| 원본 JVM 클래스 분해·재조립 항목 데이터 일치 | PASS |
| JVM 28개 native ↔ ARM64 JNI export 28개 정적 대응 | PASS |
| 원본 AAR 구성요소 12개 재조립 및 바이트 비교 | PASS |
| 공식 예제 앱에서 재조립 AAR로 Android APK 컴파일 | PASS |
| 원본 AAR ZIP 전체 SHA-256 동일 | NO — ZIP 재압축 방식 차이 |
| ARM64 바이너리를 새 로드 주소로 재링크한 독립 빌드 | NOT VERIFIED |
| 유효한 키로 실제 영상 생성 및 실시간 스트리밍 | NOT VERIFIED |
| SDK 기능 수정 완료 | NOT REQUESTED YET |

## 10. 파일·워크플로 위치

- 완성 SDK 재조립 워크플로: .github/workflows/expression2-original-jvm-arm64-aar-assembly.yml
- 기계어 분해·재조립: tools/bithuman_deep/expression2_original_native_fde_piece_assembly.py
- ASM JVM 전수 분석: tools/bithuman_deep/Expression2OriginalJvmAsmAudit.java
- javap JVM 전수 분석: tools/bithuman_deep/expression2_original_jvm_inventory.sh
- JVM/JNI/ELF/AAR 합성 검사: tools/bithuman_deep/expression2_original_aar_repack_audit.py
- 5도구 기계어 종합 분석: docs/expression2_original_five_tool_binary_only_reclassification_20261114.md

라이선스와 재배포 권한은 별도 확인이 필요합니다. 원본 SDK의 인증 요구는 그대로 남아 있으며, 본 SDK를 실제 기기에 설치해서 렌더링을 검증할 때에는 공식 이용 권한과 지원되는 ARM64 Android 환경이 필요합니다.
