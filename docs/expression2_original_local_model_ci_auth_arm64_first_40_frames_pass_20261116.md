# Expression 2 0.6.2 — 원본 JVM·ARM64 + 로컬 모델 + CI 자체 인증 서버 + 실제 첫 40프레임 성공

**검증 날짜:** 2026-11-16 KST  
**저장소:** lyonbegin/hitel-room  
**브랜치:** feature/bithuman-expression2-imx-sdk-audit-20261112  
**실제 실행:** https://github.com/lyonbegin/hitel-room/actions/runs/43764220375  
**증거 ZIP:** https://github.com/lyonbegin/hitel-room/actions/runs/43764220375/artifacts/14181334171

## 확인된 결과 (원본 SDK만)

- 원본 AAR: `ai.bithuman:expression2-android:0.6.2`의 이미 검증된 **2,660조각 재조립본**. 재조립 AAR SHA-256 `2529f8f0a064b4c8e8a1bb6f5fdd4627143ba4e09e05bd506bee1540e68e1527`.
- 임시 서버 주소 교체는 원본 `SelfHostMeter$Companion.apiBase$expression2_release()Ljava/lang/String;` **JVM 메서드 하나만**: 바이트코드 204바이트 -> 4바이트 `13 04 44 b0`, 상수풀 2개 항목 추가. 다른 JVM 메서드 본문 변경 **0개**.
- 원본 ARM64 `libexpr2jni.so`, 원본 `libLiteRt.so`, 원본 모델 추론 구현은 **0바이트 변경**.
- 변경한 AAR SHA-256: `06e327f9ab0ae7d75dde3d6b017ed9528dd75dd84eff38ba5437ccfc23073441`. 정확한 AAR 멤버 비교 및 클래스 단일 메서드 복원(roundtrip) 테스트 PASS.
- 모델 준비: GitHub Actions 캐시에 있는 원본 공개 Wise Pup 모델에서 추출한 `combined_litert.tflite` (158,524,428 bytes, SHA-256 `f809722b65e933aacf2c577725e45aaba576fae84b4d17658d67d6d018a512ba`)와 `canon.bin` (299,520 bytes, SHA-256 `cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5`).
- Android 테스트 앱 내부 `filesDir/models` 경로에 원본 모델 두 파일을 ADB+run-as로 배치한 뒤 원본 `Expression2Model.combined(File, File)` 호출 성공.
- 실행마다 신규 생성한 **테스트 전용 토큰**을 원본 `Expression2Credential.set`과 Actions 내부 자체 HTTP 테스트 서버의 검증값으로 동일하게 설정. Android 에뮬레이터의 `adb reverse tcp:18762 tcp:18762` 사용. 이 토큰은 실제 운영용 인증서가 아니며 발급 기능의 실서비스 검증이 아니다.
- 서버에 도착한 원본 요청 경로: `POST /v1/auth/validate` (JSON `{"product":"expression-2"}`; `agent_code` 필드는 nullable), `POST /v1/meter/beats`. 실제 요청 필드 자료형이 ZIP의 `original-http-field-types.jsonl`에 보존됨.
- 원본 Android `Expression2Avatar.create()` **PASS**, 생성시간 **1,477ms**, CPU 라우팅: `enc=CPU tok14=CPU step=CPU dec=CPU`.
- 원본 `feed()`, `flushTail()`, `pull()`로 **실제 40프레임 생성 PASS**, 첫 PNG `official-first-frame.png`는 **416x720**이며 유효한 시각적 이미지이다. 메인 로그: `SDK_OFFICIAL_FIRST_FRAME_PASS`, `SDK_OFFICIAL_RENDER_RESULT frames=40 firstFrameFile=true`, `SDK_OFFICIAL_RENDER_PASS`.
- 실행환경: Android 14/API 34 x86_64 Google APIs 에뮬레이터 + ARM64 NativeBridge. 첫 영상 프레임까지 `create()` 이후 약 9분 40초가 경과했으므로 **실시간 FPS나 실제 ARM64 단말 성능은 증명되지 않는다**. 40개 프레임이 서로 다른지 여부는 별도 진행되는 프레임별 PNG 해시 검증 대상.

## 반드시 구별할 사항

이 검증은 **원본 SDK의 실제 원본 JNI/모델 사용을 통한 로컬 모델 영상 출력**이며, 과거 `sdk/expression2-dropin` 독립 SDK 성과가 아니다. 원본의 다른 인증·세션·렌더링 함수를 임의로 작성하지 않았다. 단, **테스트용 자체 HTTP 서버**는 아직 임시 Actions 내부 서비스이고 운영용 HTTPS 인증 서버가 아니다. 보안·장기 세션·장애처리·모바일 네트워크 테스트가 별도로 필요하다.

## 실패 기록 및 해결

1. 본래 원본 SDK `create()`는 인증 토큰 누락 시 거절 — 인증과 모델 준비를 분리.
2. 시험 서버가 원본 `validateBody(agentCode=null)`에서 생략되는 `agent_code`를 필수로 강제하여 422 반환 — 서버 입력 계약 수정.
3. Android 파일 배치 경로와 시험 앱 읽기 경로 불일치로 `SDK_MODEL_MISSING` — CI 시험 앱의 `filesDir/models`와 run-as 파일 배치 일치시켜 해결.

## 후속 검증

- 실제 원본 프레임 `1/2/10/20/40` PNG 별도 저장과 픽셀/해시 차이, 프레임 소요시간 로깅:
  https://github.com/lyonbegin/hitel-room/actions/runs/43766352111 (별도 실행 결과 확인 필요)
- **원본 ARM64 실기기**에서 CPU/NPU 성능과 자연스러운 시간 순서 스트리밍 검증.
- 자체 **지속 운영 HTTPS** 인증 서버를 원본 요청/응답 형식과 세션 라이프사이클에 맞춰 구현·실기기 검증.

## 원본 유지 규칙

변경 허용 범위는 **원본 JVM의 서버 주소 라우팅 메서드 하나**와 그 메서드에 필요한 상수풀 두 항목뿐이다. 원본 JNI/ARM64, LiteRT, 모델, `createEngine/Native.create/feed/pull` 함수는 수정하지 않는다. 새 기능은 모두 테스트 앱/서버/워크플로에만 추가한다.
