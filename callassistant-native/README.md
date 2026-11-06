# HITEL 통화 오디오 독립 구현 — 삼성 / Android 두 방식 선택 (v0.2.0)

**별도 브랜치:** `feature/samsung-callassistant-native-20261106`  
**APK:** `app.hitel.callnative` (기존 삼성 및 HITEL APK와 패키지 충돌 없음)

## 두 방식 모두 구현하고 직접 선택

### 버튼 ① 삼성 Call Assistant 방식

원본 `15.1.00.73`의 실제 정적 역공학 보고서를 기준으로 별도 백엔드 `SamsungAudioPath.java` 작성.

- 삼성 `AudioManager.setParameters("l_call_translation_mode=on/off")` 호출
- 삼성 `l_voice_tx_control_mode=0/1` (정상/음소거) 제어 및 종료 시 기본값 복원
- 삼성 `AudioAttributes.Builder.semAddAudioTag("VOICE_TX")`를 적용한 `AudioTrack` 생성
- 선택한 버튼으로 **800Hz PCM 실데이터 생성 후** 해당 AudioTrack에 쓰기
- 삼성 API 누락/제조사 불일치/권한 거부/통화 미연결 시 실패 표시
- 시스템 명령 송신 성공과 상대방에게 실제 음성이 들렸음을 엄격히 구별

### 버튼 ② Android Shizuku 로컬 통화 PCM 방식

**전혀 별도 백엔드** `ShellAudioService.java`, `ShizukuAudioBridge.java`. 내부 추가 선택:

- **AOSP 경로:** `AudioManager.getCallDownlinkExtractionAudioRecord` 및 `getCallUplinkInjectionAudioTrack` (Android 13 이상).
- **Direct 경로:** `AudioRecord(VOICE_DOWNLINK)` 및 `AudioTrack` 출력 기기를 `TYPE_TELEPHONY`로 지정.
- Shizuku `UserService`가 별도 shell 프로세스에서 코드 실행. 일반 앱은 Binder IPC와 로컬 양방향 Unix socket으로 **PCM 프레임(16kHz, mono, PCM16)**을 송수신.
- 실제 PCM capture read와 write 호출, 수신 프레임/피크 카운터, 주입 신호 800Hz 별도 테스트.
- 두 방식 모두 통화 서버, SIP, PBX, 전화번호 리다이렉션을 사용하지 않음.
- 실패 시 삼성 방식으로 자동 전환하지 않으며, 삼성 실패 시 Android 경로로 자동 전환하지 않음.

## 사용 순서

1. APK 설치 후 **삼성 방식** 또는 **Android 방식**을 선택합니다.
2. 삼성 방식: 지원하는 삼성 갤럭시에서 실제 SIM 통화를 연결한 뒤 시작 및 PCM 주입을 개별 시험합니다.
3. Android 방식: Shizuku 앱을 설치·실행하고 로컬 권한 승인을 완료합니다. Android 하위 모드(AOSP/Direct)를 선택하고 실제 SIM 통화 중 시작합니다.
4. **중단 및 복원** 버튼으로 오디오 객체를 종료합니다. 삼성 방식은 원래 송신 모드 0으로 복원 요청합니다.
5. UI에 표시된 내부 PCM write 프레임 수는 **상대방 수신 성공의 증거가 아니므로** 반드시 다른 실제 휴대전화에서 청취 검증을 해야 합니다.

## 검사 결과와 미검증 기능

- [x] 두 방식 **각각 별도 실제 코드 경로** 및 UI 선택 버튼
- [x] Android PCM 입력/출력 API를 실제로 호출하는 UserService 구현
- [x] 삼성 AudioManager 파라미터/VOICE_TX 태그 실제 호출 코드
- [x] 사용자 선택 외 자동 변경 없음, 로컬 IPC, PCM test tone
- [x] Java 소스 컴파일, APK 패키지 검사, APK 서명 검사(해당 빌드 완료 시)
- [ ] 실기기에서 삼성 전용 권한 획득/오디오 HAL 반영
- [ ] 실기기에서 Shizuku UserService 및 PCM 캡처와 송신 정상 작동
- [ ] 상대방 휴대전화에서 실제 800Hz 음성 수신 확인
- [ ] 실통화 음성 → 자막(STT), 번역, 송신 TTS까지 전체 통합

**중요:** 루팅하지 않은 일반 APK가 삼성 시스템 권한을 얻는 것이 아니며, Shizuku도 제조사·OS별로 시스템 오디오 접근이 거부될 수 있습니다. 로그와 실제 상대방 청취가 확인되지 않은 경로를 '정상 작동'으로 표시하지 않습니다.

## 소스 구조

| 파일 | 역할 |
|---|---|
| `AudioPathActivity.java` | 삼성 / Android 개별 선택, Android AOSP / Direct 하위 선택, 시험 버튼 및 로그 |
| `SamsungAudioPath.java` | 삼성 DEX 분석 기반 통화 오디오 컨트롤 + VOICE_TX PCM |
| `ShizukuAudioBridge.java` | UI에서 shell UserService 바인딩, 로컬 PCM 수신과 주입 |
| `ShellAudioService.java` | shell 권한 하 Android AudioRecord / AudioTrack, 실제 실시간 PCM 처리 |
| `MainActivity.java` · `CallActivity.java` | 기본 전화 앱 및 통화 UI |

## APK 빌드

Android SDK 35, Java 17, Gradle 8.9, AGP 8.7.3.

```sh
gradle -p callassistant-native :app:assembleDebug
```

GitHub Actions `.github/workflows/build-callassistant-native.yml`는 해당 브랜치 push 시 APK를 빌드하고 서명을 검증하여 `HITEL-CallAssistant-Native-APK`를 업로드합니다.

기존 삼성 시스템 앱을 삭제하거나 교체하지 마십시오.
