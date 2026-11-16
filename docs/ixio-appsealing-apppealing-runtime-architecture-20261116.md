# AppSealing · AppPealing 런타임 구조 조사 — 익시오 메인 앱
2026-11-16. AppSealing 공식 문서, 공개 AppPealing 구현, 공개 Appsealing-Reversal 조사 및 연결된 IXIO 재패키징 소스 검토입니다. 각 항목의 출처와 IXIO 직접 검증 여부를 구분합니다.

## 제조사 확인 사항
- AppSealing은 APK/AAB에 보안 모듈을 삽입하고 일부/전체 DEX를 암호화합니다. 클래스·패키지 선택적 암호화 옵션이 있습니다.
- 최초 실행할 때 DEX를 복호화하며 Android ART 최적화가 실행될 수 있습니다. DEX 문자열 암호화, 덤프 방해 및 네이티브 데이터 암호화는 별도 옵션일 수 있습니다.
- 출처: https://helpcenter.appsealing.com/hc/ko/articles/4408109265177-%EB%B6%80%EB%B6%84-%EC%95%94%ED%98%B8%ED%99%94%EB%8A%94-%EB%AC%B4%EC%97%87%EC%9D%B8%EA%B0%80%EC%9A%94-Selective-encryption-for-Dex
- 출처: https://helpcenter.appsealing.com/hc/en-us/articles/115011128627-Protection-for-Android-APK-AAB

## 런타임 DEX 등록, 메모리 주소 가설
- Android는 파일 기반 DexClassLoader 및 메모리 버퍼 기반 InMemoryDexClassLoader를 지원합니다. ART ClassLoader에 DEX가 연결되는 것과 미리 고정된 원본 함수의 메모리 주소에 하나씩 덮어쓰는 것은 다른 동작입니다.
- 공개 역공학 자료에는 InMemoryDexClassLoader를 사용한 사례와 app_payload_lib에 임시 DEX를 생성하는 사례가 있습니다. AppSealing 버전/설정에 따라 다를 수 있으므로 익시오 버전에서 실제 어느 경로를 쓰는지 반드시 독립 증거가 필요합니다.
- Appsealing-Reversal에 나타나는 XOR된 함수 주소와 간접 호출은 주로 libc signal 등 syscall 포인터 보호 설명이며, 모든 원본 앱 함수 주소를 담은 표가 있다는 증거가 아닙니다.
- 출처: https://developer.android.com/reference/dalvik/system/InMemoryDexClassLoader
- 출처: https://developer.android.com/reference/dalvik/system/DexClassLoader
- 출처: https://github.com/ARandomPerson7/Appsealing-Reversal
- 참고(2차 분석): https://www.awakewiki.org/packers/appsealing/

## AppPealing-new 오픈소스 실제 동작
- MyModule.java: Xposed/LSPosed에서 AppSealingApplication.attachBaseContext 시작 전 native libapppealing을 로딩하고 Java 보호 경고/종료/텔레메트리 관련 경로에 개입합니다.
- apppealing.cpp: Dobby를 이용해 alarm, kill, exit, remove, fopen 함수를 후킹합니다. fopen은 app_payload_lib 접근을 기록합니다. remove는 app_payload_lib 내 생성 파일의 삭제 직전에 apppeal_dump로 이동·보존합니다.
- 공개 AppPealing 코드에는 DEX 복호화 알고리즘 자체, 메서드 주소별 원본 코드 치환, 무보호 설치 APK 자동 재패키징 기능은 없습니다.
- 출처: https://github.com/NPC2000/AppPealing-new/blob/master/app/src/main/java/com/october/apppealing/MyModule.java
- 출처: https://github.com/NPC2000/AppPealing-new/blob/master/app/src/main/cpp/apppealing.cpp

## 기존 익시오 실험의 관측과 문제점
- 익시오 메인에서 원본 APK DEX와 다른 체크섬 정상 DEX 4개, 녹음 앱에서 1개를 실행 중 app_payload_lib에서 확인했습니다. 따라서 적어도 이 파일 기반 중간 단계가 실제 존재합니다.
- 과거 tools/ixio/ixio_repack_separate.py는 기존 원본 APK 파일을 그대로 둔 채 복원 DEX 4개를 classes15.dex~classes18.dex라는 새 이름으로 추가하고 AndroidManifest Application 명칭을 바꿨습니다.
- 이 작업은 원본 암호화 페이로드마다 DEX 대응이 정확한지, 클래스 중복이 있는지, ART 로딩 순서가 일치하는지, 네이티브 .so 및 암호화된 데이터 의존성이 충분한지 검증하지 않았습니다.
- 새 인증서로 서명한 앱의 Android 14 설치는 성공했으나 메인 프로세스는 시작 시 종료되었습니다. FirebaseInitProvider의 NullPointerException이 과거 로그에 기록되었습니다.

## 다음 검증에서 판별할 필수 사항
1. 원본 XAPK base/split APK의 모든 DEX, 보안용/비보안용 네이티브 라이브러리, assets, Manifest 구조를 SHA-256과 함께 열거합니다.
2. 4개 복원 DEX의 각 클래스 정의와 원본 전체 DEX의 클래스 정의를 대조하여 충돌 및 누락을 조사합니다.
3. AppSealingApplication.attachBaseContext부터 복호화 DEX 생성·삭제, ART ClassLoader 등록, 원본 IXIApplication 초기화, ContentProvider 초기화 순서를 같은 프로세스 로그로 재구성합니다.
4. 메모리 주소가 아닌 실제 DEX의 파일 경로·ART 로더 소속·네이티브 링크를 구분하고 원본 앱과 비교합니다.
5. 원본의 보호되지 않은 영역은 바이트 단위 동일하게 보존하고, 보호된 영역에 필요한 실행 결과가 전부 충족되는지 검증합니다. 설치 통과, 프로세스 유지, UI, STT, 바인더 서명/권한 연동은 각각 별도 시험해야 합니다.

## 핵심 결론
선생님이 제시하신 '원형 비보호 영역 보존 + 복호화된 보호 부분을 정확히 되돌림'은 올바른 구조적 복원 목표입니다. 그러나 AppSealing이 항상 고정된 함수별 메모리 주소에 덮어쓰는 방식이라고 확인되지는 않았습니다. 공개 AppPealing은 주로 실행 시 생성된 복호화 파일을 보존하는 도구입니다. 이전 APK는 기능상 완전한 치환을 증명하지 않았습니다.
