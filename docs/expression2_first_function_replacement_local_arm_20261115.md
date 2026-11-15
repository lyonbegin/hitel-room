# Expression 2 독립 SDK 함수 단위 교체 — 1단계: 자체 arm() → 자체 createEngine()

날짜: 2026-11-15. 대상: `sdk/expression2-dropin` — **저희가 소유한 별도 독립 SDK**.

## 작업 목적과 경계

원본 SDK에서 `Expression2Avatar.create()` → `MeterHost.arm(model)` → `createEngine(...)` 순서가 확인됐습니다. 원본 `MeterHost.arm`은 bitHuman의 인증·과금·세션 기능을 수행하고, 공식 SDK에서 API Secret이 없으면 `Expression2Exception`이 발생합니다.

이 작업에서 구현한 것은 원본 `MeterHost.arm` 반환 객체 위조/원본 바이너리 인증 무력화가 아닙니다. **독립 HITEL SDK 자체의 모델 준비·세션 관리 담당 함수**이며, 후속 자체 `createEngine()`으로 연결하는 첫 함수 단위 교체입니다.

## 구현한 첫 함수

- 새 파일: `sdk/expression2-dropin/src/main/java/ai/bithuman/expression2/HitelSessionManager.kt`
- 함수: `HitelSessionManager.arm(model: Expression2Model): HitelSession`
- 모델 입력 검사: 원본 Wise Pup 그래프 `158524428`바이트, `canon.bin` `299520`바이트, 파일 존재, 그래프 시작/끝 오프셋 및 실제 파일 길이.
- 세션 반환: `id`(로컬 UUID), `modelBytes`, `Phase.ARMED` 상태, 종료 및 실패 상태 관리.
- 어떤 API Secret도 읽거나 저장하거나 비트휴먼 서버의 승인 결과라고 표시하지 않습니다.
- `SelfHostMeter`, `MeterHost`, `libexpr2jni.so`는 독립 모듈에 삽입하거나 링크하지 않습니다.

## 실제 연결

`sdk/expression2-dropin/src/main/java/ai/bithuman/expression2/Expression2Avatar.kt`의 자체 `create()`:

1. `val session = HitelSessionManager.arm(model)`
2. 로컬 `createEngine(model, session)`
3. 이 메서드에서 기존 독립 엔진 생성자 `Expression2Avatar(model, session)` 호출
4. 성공 시 `session.markEngineReady()`, 실패 시 `session.abandon()`
5. 완료 후 `close()`에서 세션 CLOSED 전환

### 단계별 Android logcat 표시

| 로그 | 의미 |
|---|---|
| `HITEL_OWN_ARM_BEGIN` | 저희 함수 진입 |
| `HITEL_OWN_ARM_PASS` | 로컬 모델 구조 검증과 자체 세션 생성 성공 |
| `HITEL_OWN_CREATE_ENGINE_BEGIN` | 자체 엔진 객체 생성 시도 |
| `HITEL_OWN_CREATE_ENGINE_PASS` | 독립 엔진 생성 성공 |
| `HITEL_OWN_CREATE_ENGINE_FAIL` | 해당 단계 실패, 예외 스택 포함 |
| `HITEL_OWN_SESSION_CLOSED` | 자체 세션 종료 |

### 검증

- JVM 단위 시험: `sdk/expression2-dropin/src/test/java/ai/bithuman/expression2/HitelSessionManagerTest.kt`.
- 4개 시험: 올바른 모델 구조 arm/상태 전환, canon 길이 오류, 그래프 파일 범위 초과, 중복 ENGINE_READY 전환 거부.
- CI: `.github/workflows/expression2-dropin-original-app-e2e.yml`.
- 원본 bitHuman 공식 앱의 `app/src` 전체는 무변경으로 두고 Gradle 의존성만 독립 `expression2-dropin`으로 교체해 APK 빌드·Android 실행 시험.
- CI 명령: `./gradlew :expression2-dropin:testDebugUnitTest :expression2-dropin:assembleDebug :app:assembleDebug`.

**검증 결과는 Actions 실행 로그가 실제 PASS 된 뒤 확정합니다.** 컴파일/설치/세션 arm/엔진 생성/영상 렌더링은 구분해 보고합니다. 위 로그가 없는 경우 다음 함수의 통과를 주장하지 않습니다.

## 진행 방식

한 번에 원본 SDK 전체를 다시 만들지 않습니다. 이번에 자체 세션 함수가 통과하면 그때부터 기존 독립 렌더러의 `createEngine()` 생성자와 입력·출력 상태를 조사합니다. 후속 `feed()`·`flushTail()`·`pull()`의 입력·결과는 별도 회귀시험과 원본 기준 벡터로 검증합니다.
