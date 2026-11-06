# HITEL 통화 어시스트 — 별도 네이티브 Android APK (v0.1.0)

## 범위
이 프로젝트는 삼성 Call Assistant APK를 재포장한 앱이 아니라, 2026-11-06 정적 역공학에서 확인된 **기능 구성을 참고한 새로운 독립 Android 앱**입니다.
기존 HITEL WebView/시험 앱 소스와 무관한 `app.hitel.callnative` 패키지입니다.

### 실제 구현된 기능
- Android RoleManager를 통한 기본 전화 앱 설정 요청
- Android Telecom / InCallService의 SIM 발신·수신 및 통화 상태 감지
- 수신 전화 알림, 응답·거절, 종료, 보류·재개, 통화 음소거, 스피커 라우팅
- 전화번호 입력과 DTMF 1 테스트
- 기기 마이크에서 별도 STT(실시간 결과/중간 결과; 기기에 인식 엔진 필요)
- 기기 스피커에서 로컬 TTS(설치된 언어 음성 모델 필요)

### 미구현 / 제한
- 일반 이동통신망 통화 상대방 음성의 직접 캡처 및 실시간 자막
- 통화 원음을 교체하거나 상대방에게 번역 TTS를 전송
- 번역 엔진, 녹음, 전사, 요약
- 삼성 시스템 UID/Audio HAL 권한 재현
- 실제 휴대전화에서 발신·수신 동작 최종 검증

`CAPTURE_AUDIO_OUTPUT`, `CALL_AUDIO_INTERCEPTION`, 삼성 `VOICE_TX` 태그 등은 일반 사용자 설치 APK의 권한으로 얻을 수 없습니다.
인위적인 화면·샘플 데이터로 통역에 성공한 것처럼 표시하지 않습니다.

## 빌드
Android SDK 35, Java 17, Gradle 8.9 이상, AGP 8.7.3이 필요합니다.

```sh
gradle -p callassistant-native :app:assembleDebug
```

파일: `callassistant-native/app/build/outputs/apk/debug/app-debug.apk`.

CI 워크플로: `.github/workflows/build-callassistant-native.yml`. 빌드가 성공할 때만 `HITEL-CallAssistant-Native-APK` 산출물이 생성됩니다.
기존 삼성 원본 앱을 삭제하거나 업데이트하지 마십시오.
