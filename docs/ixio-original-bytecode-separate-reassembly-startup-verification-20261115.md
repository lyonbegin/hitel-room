# IXIO 2개 앱 개별 무손실 재조립 및 Android 14 실행 검증 (2026-11-15)

## 현재 목표 및 원칙
1. 익시오 메인 `com.lguplus.aicallagent`와 녹음 앱 `com.lguplus.callrecorder`를 합치지 않습니다.
2. AppSealing으로 감싸진 기존 APK의 프로그램 코드를 **실행 중 복원한 DEX**를 기준으로 재조립합니다.
3. 원본 DEX 메서드 `code_item`과 나머지 바이너리 구간을 분리·재조립하되, DEX 전체 바이너리 SHA-256을 원본과 동일하게 유지합니다.
4. 기존 APK의 리소스 및 네이티브 라이브러리 바이트도 원본 그대로 유지합니다.
5. GitHub Actions 성공과 **앱 프로세스 실행 성공은 별개**입니다.

## 확정된 바이너리 입력
- 입력 Release: https://github.com/lyonbegin/hitel-room/releases/tag/ixio-input-20261115 (`mmsimage.zip`)
- 복원 DEX Release: https://github.com/lyonbegin/hitel-room/releases/tag/ixio-runtime-dex-20261115
- 재조립 브랜치: `experiment/ixio-runtime-lab-20261115`
- `tools/ixio/ixio_dex_exact_reassemble.py` 는 DEX 메서드 코드와 비코드 영역을 분리한 뒤 바이너리를 무손실 재조립합니다.
- `tools/ixio/ixio_repack_separate.py` 는 각각의 앱에 복원 DEX(메인 4 / 녹음 1)를 원본 바이트 그대로 추가하고 Manifest의 Application을 원본 앱 클래스로 바꿉니다.
- `tools/ixio/ixio-test-separate-repack.sh` 는 각 APK를 서명하고 Android 14에서 별도 실행합니다.

## 수행 결과 / 증거

| 작업 | 기록 | 검증된 결과 |
|---|---|---|
| DEX 메서드 158,670개 코드 영역 분리·재조립 | https://github.com/lyonbegin/hitel-room/actions/runs/43707483111 | DEX 5개 전체 바이트 원본 일치. 개별 서명 APK 생성/보관 |
| 재조립본 2개 앱 새 에뮬레이터 설치 | https://github.com/lyonbegin/hitel-room/actions/runs/43708163246 | 메인 base+split 3개 설치 성공, 녹음 앱 설치 성공. 둘 다 8초 후 프로세스 종료 |
| 동일 실행의 예외 정밀 추출 | https://github.com/lyonbegin/hitel-room/actions/runs/43708783280 | 둘 다 `FirebaseInitProvider.onCreate`에서 `StringResourceValueReader` NullPointerException |
| Firebase Provider만 **진단용** 제외 | https://github.com/lyonbegin/hitel-room/actions/runs/43712844014 | 두 앱 모두 재설치 성공. 메인 `IXIApplication.onCreate()`까지 진입하지만 `FirebaseCrashlytics.getInstance()`에서 Firebase 미초기화 예외. 녹음 앱 8초 후 실행 상태가 아니며 원인 미확정 |
| 리소스 검사 | https://github.com/lyonbegin/hitel-room/actions/runs/43713401644 | 두 앱에 `google_app_id`, `google_api_key`, `gcm_defaultSenderId` 리소스 이름 존재. 실제 값의 적합성은 별도 |
| **손대지 않은 원본** 2개 앱 동일 Android 14 실행 비교 | https://github.com/lyonbegin/hitel-room/actions/runs/43713674323 | 두 앱 모두 Firebase 초기화 성공. `AppSealingApplication`이 원본 앱 `attachBaseContext` 호출한 다음 Firebase 초기화/원본 onCreate 호출한 로그. AppSealing 보호가 `50011` 오류로 실행을 방해 |
| Manifest 초기화 연결 검사 | https://github.com/lyonbegin/hitel-room/actions/runs/43714021334 | 두 재조립본의 AppComponentFactory는 `androidx.core.app.CoreComponentFactory`. AppSealingAlertDialog/IPService 컴포넌트가 Manifest에 남아 있는 것 확인 |

## 재조립본 메인 앱의 다음 장애 (실제 Java 스택)
```
RuntimeException: Unable to create application com.lguplus.aicallagent.IXIApplication
  Caused by: IllegalStateException: Default FirebaseApp is not initialized
  at com.google.firebase.FirebaseApp.getInstance(...)
  at com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance(...)
  at com.lguplus.aicallagent.IXIApplication.setCrashlyticsLoggingDisabled(IXIApplication.kt:268)
  at com.lguplus.aicallagent.IXIApplication.onCreate(IXIApplication.kt:118)
```

위 스택은 **Firebase Provider 제외 변형의 것**입니다. 원본 Provider를 유지한 재조립본에서는 Provider 초기화 과정의 NullPointerException이 먼저 발생합니다.

## 결론
- **완료:** 복원 DEX 5개 원본 바이트 유지 재조립, 서명 및 두 APK 각각 설치 성공.
- **미완료:** 두 앱 각자 정상 시작·실행 유지. 특히 Firebase 초기화용 Context/생명주기 경로와 녹음 앱의 종료 원인.
- AppSealing의 특정 보호 해제 오류나 U+ 로그인 실패를 Firebase 원인과 혼동해서는 안 됩니다.
- 원본에서는 AppSealing Application이 원본 Application과 Context 구성을 매개하므로, 재조립본이 단순히 AndroidManifest에서 `AppSealingApplication`을 원본 클래스로 바꾸는 것만으로는 생명주기가 같지 않습니다. **이 중간 초기화 동작이 실제로 차이를 일으켰는지는 인과관계 추가 검증 필요**합니다.
- Firebase 리소스 이름은 존재하므로 `google_app_id`가 파일에서 아예 삭제되어 문제가 발생했다고 단정하지 않습니다.

## 다음 순서
1. 복원 DEX는 변경하지 않은 채 원본 Application의 실제 `attachBaseContext`, `onCreate`, 리소스 접근과 AppSealing 매개 초기화 순서를 호출 그래프와 런타임 로그로 비교하십시오.
2. Firebase Provider에서 읽는 Context/Resources 객체와 StringResourceValueReader 초기화 입력이 무엇인지 확인하고, **정상 초기화 경로**를 보존할 방안을 시험하십시오. 단순 Provider 삭제는 정식 해결이 아닙니다.
3. 통화녹음 앱은 정상 종료인지 치명적 오류인지 패키지 PID/프로세스 수명 및 대상 프로세스에 한정한 Fatal log를 각각 검사하십시오.
4. 각 앱별 `INSTALL`, `PROCESS_ALIVE`, `APPLICATION_ONCREATE`, `FIREBASE_READY`를 별도 판정하고 정상화 전에는 완료로 보고하지 마십시오.
5. 두 앱이 각각 원본과 동일하게 실행된 후에만, 후속 단계에서 두 APK의 단일 앱 통합 가능성을 검사하십시오.
