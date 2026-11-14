# Expression 2 원본 JVM 오류 문구 직접 수정 및 AAR 재조립

대상: 공식 Android Expression 2 SDK v0.6.2. 원본 기능을 Kotlin·Java·C++로 재작성하지 않습니다. 원본 JVM 바이트코드의 오류 메시지 문자열 상수만 변경하며, 원본 API Secret 인증·사용량 관리 기능은 유지합니다.

## 1. 정확한 수정 내용

- 대상 classfile: ai/bithuman/expression2/SelfHostMeter$Companion.class
- 대상 메서드: SelfHostMeter$Companion.arm$expression2_release 및 오류 메시지 조립 템플릿
- 원래 문구: no API secret was found, so this render cannot be attributed to an account.
- 수정 문구: HITEL_EXPRESSION2_JVM_TEXT_PATCH_OK_20261114: valid API secret is required.

| Constant Pool 항목 | 원본 클래스 파일 데이터 오프셋 | 원본 구조 | 변경 |
|---|---:|---|---|
| CONSTANT_Utf8 #595 | 10261 | 오류 문구 + 공백 + 0x01 (invokedynamic 문자열 템플릿) | 정확히 75바이트의 문구 부분만 변경, 공백·0x01 보존 |
| CONSTANT_Utf8 #760 | 12966 | arm 메서드의 원본 오류 문구 | 정확히 75바이트의 문구만 변경 |

두 문자열 모두 길이 75바이트로 변경하기 때문에 constant pool 번호, classfile 길이, 메서드 Code 영역 및 호출 흐름에는 변동이 없습니다. 실제로 달라진 UTF8 데이터는 각 상수당 73바이트입니다. 전체 92개 JVM 클래스 중 수정된 클래스는 1개입니다.

## 2. 원본 기계어와 JVM 함수 보존 검증

- 원본 재조립 AAR SHA256: 2529f8f0a064b4c8e8a1bb6f5fdd4627143ba4e09e05bd506bee1540e68e1527
- 새 JVM 문구 수정 AAR SHA256: cb9bb0b50966013bb4b1bf6340f5f2d649bb5a379b4a27f735d27460627b4179
- ARM64 libexpr2jni.so SHA256: ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c
- 원본 JVM JAR 항목 97개 중 변경된 파일: 1개.
- 원본 AAR ZIP 항목 12개 중 압축 해제 데이터가 변경된 항목: classes.jar 1개.
- JVM 메서드의 원본 ldc_w #761과 refuse(...) 호출 오프셋은 119, 128 그대로입니다.
- JVM의 조건 분기, StackMap 및 다른 상수는 변경하지 않았으며, 원본 기계어 함수 2,629개 FDE 범위를 포함한 ELF 전체는 바이트 동일합니다.
- javap -p -c 및 javap -p -v로 원본과 수정 classfile을 대조했습니다. 기대한 문자열 부분과 파일 SHA 외의 메서드 명령어·메타데이터는 동일합니다.
- AAR 전체 ZIP SHA가 다른 것은 클래스 파일을 의도적으로 변경하고 새 ZIP으로 묶었기 때문입니다.

## 3. 파일과 재현 방법

1. 기준 SDK AAR을 다운로드하고 기존 원본 무변경 재조립 결과를 확정합니다.
2. ASM/JDK 기반 분석에서 실제 오류 함수와 상수 번호를 찾습니다.
3. 도구 tools/bithuman_deep/expression2_patch_original_jvm_message.py를 이용해 원본 classfile의 두 UTF8 상수를 직접 교체합니다. 예상과 다른 원본에는 수정하지 않도록 상수 번호·값·길이를 엄격히 확인합니다.
4. 원본 JVM 클래스 91개와 기존 native SO를 그대로 넣고 새 JAR/AAR을 생성합니다.
5. 모든 원본 클래스/네이티브 라이브러리를 파일별로 재검증합니다.
6. 공식 Expression 2 예제 앱의 app/src는 그대로 두고 앱의 Gradle SDK 의존성만 교체한 뒤 APK로 빌드합니다.
7. APK 내 새 문구(DEX), 원본 JNI ELF/LiteRT 포함 여부, APK 압축 무결성을 확인합니다.

- 도구: tools/bithuman_deep/expression2_patch_original_jvm_message.py
- CI: .github/workflows/expression2-original-jvm-message-patch-aar-and-apk.yml
- 기준 SDK 재조립 CI: https://github.com/lyonbegin/hitel-room/actions/runs/43546359857

## 4. 완료 수준

원본 바이트코드 상수 두 곳을 교체하고 새 AAR을 조립한 결과는 **실제 완료**되었습니다. 이 변경으로 인증 검사를 우회하지 않으며, 비밀키 없이 원본 영상 렌더링에 성공한다는 뜻도 아닙니다. Android 앱 컴파일은 별도 CI 검증 결과를 확인해야 하고, 실기기에서 오류 메시지가 실제 나타나는지와 영상 렌더링 여부는 별도 동적 시험이 필요합니다.
