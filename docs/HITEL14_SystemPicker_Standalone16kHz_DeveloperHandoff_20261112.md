# HITEL14 시스템 단일 앱 선택 복구 및 독립형 16kHz 녹음 스피커 송출 앱 — 개발 인계 지시서

**작성일:** 2026-11-12  
**리포지토리:** https://github.com/lyonbegin/hitel-room  
**우선순위:** 기존 기능 회귀 방지 > 캡처 가능한 미디어 출력 > 객관적 실기기 검증  
**지시 대상:** HITEL14 출력음 STT 개발 담당자, 독립형 16kHz 녹음 스피커 송출 앱 개발 담당자  
**주의:** 이 문서는 수정 사양·검증 기준입니다. 실제 삼성 통화 중 두 앱 간 캡처 성공을 확정했다는 뜻이 아닙니다.

## 1. 두 앱을 혼동하지 말 것

| 구분 | HITEL14 출력음 STT (수신 앱) | Galaxy 독립형 16kHz 녹음 재생 앱 (송출 앱) |
|---|---|---|
| 역할 | Android 출력음 캡처 → 한국어 STT | 커지는 통화 녹음 M4A → AAC → PCM16 16kHz → AudioTrack |
| Android 패키지 | `app.hitel.callflowlab.v14.systempicker` (V22 작업 브랜치) | `app.hitel.recording.speakeronly` |
| 이 프로젝트에서 바꿀 점 | **Android 원래 시스템 단일 앱 선택을 복원하고 상태만 표시** | 캡처가 허용되는 `USAGE_MEDIA` 출력 + 파일 증가분 처리/로그 검증 |
| 건드리면 안 되는 것 | 원본 마이크 STT, 원본 스피커 STT 처리 모델, 원본 W03 로그, 녹음파일 송출 모듈 재도입 금지 | 원본 M4A 증분 추적기, AAC 디코더·PCM 생성 방식, 별도 STT 모델 추가 금지 |

**원본 송출 앱:**  
https://github.com/lyonbegin/hitel-room/tree/feature/standalone-16khz-recorder-speaker-route-20261112

**수정 송출 앱 브랜치:**  
https://github.com/lyonbegin/hitel-room/tree/fix/standalone-16khz-media-capture-durable-log-20261112

**수정 송출 앱 V2 서명 APK:**  
https://github.com/lyonbegin/hitel-room/releases/download/speaker-16khz-capturable-media-logs-v1.0.1-20261112/Galaxy-Standalone-16kHz-Speaker-Capturable-Media-Logs-V2-ARM64.apk

**HITEL14 시스템 선택 복원 브랜치:**  
https://github.com/lyonbegin/hitel-room/tree/fix/hitel14-restore-system-app-picker-status-v22-20261112

## 2. HITEL14 앱 선택 UX — 최우선 회귀 수정

### 2.1 바꾸지 말아야 하는 Android 시스템 기능

1. 반드시 **Android 기본 MediaProjection 선택창**에서 **‘단일 앱’ / ‘전체 화면’** 옵션을 선택하도록 할 것.
2. 사용자 요구는 시스템 선택 이외의 **두 번째 앱 선택창을 없애는 것**임. `SpeakerTargetPicker` 팝업, 앱 이름 검색, 자체 UID 선택은 제거할 것.
3. 아래와 같이 원래 시스템 선택을 요청할 것.

```java
MediaProjectionManager mgr =
    (MediaProjectionManager)getSystemService(Context.MEDIA_PROJECTION_SERVICE);
startActivityForResult(mgr.createScreenCaptureIntent(), SPEAKER_CONSENT_REQUEST);
```

4. **금지:** `MediaProjectionConfig.createConfigForDefaultDisplay()`는 Android 14 이상에서 *단일 앱 선택을 선택 해제*함. V21 화면에 ‘전체 화면’만 나온 원인이므로 사용하지 말 것.
5. 시스템 선택의 기본 UI·보안 권한 요청은 Android가 결정한다. 선택 앱이 전면에 표시되는 OS 동작을 무리하게 우회하려 하지 말 것.
6. 대상 변경은 **현재 MediaProjection 중지 → 새 시스템 동의창 재요청** 순서로 제공할 것.

### 2.2 ‘현재 선택’ 표시의 기술적 한계

- **시스템 MediaProjection 동의 결과에는 선택 앱의 패키지명/UID/앱 이름이 공개 API로 반환되지 않는다.**
- 따라서 임의로 특정 앱 이름을 ‘현재 선택됨’으로 표시하지 말 것.
- 표시 가능한 상태 예: `미선택`, `Android 시스템 선택창 대기`, `동의 완료 · 앱 이름 확인 불가`, `출력음 캡처 실행 중`, `종료됨 · 새로 선택 가능`, `캡처 실패`.
- 사용자가 ‘단일 앱’을 택했는지 ‘전체 화면’을 택했는지도 일반 MediaProjection 동의 Intent에서 확실하게 판별할 수 없는 경우가 있으므로 **추측 금지**.
- 시스템의 단일 앱 **화면 공유 선택이 오디오 캡처를 자동으로 해당 UID만 필터링한다고 가정하지 말 것**. 두 음성 재생 앱을 동시에 실행하여 실제 캡처 범위를 시험할 것. `AudioPlaybackCaptureConfiguration.addMatchingUid`는 UID를 정확히 확보했을 때만 사용 가능하며, 시스템 동의창에서 그 UID를 제공하지 않는다.
- 화면에서 선택 상태만 보여주고 싶다는 사용자 요구와, OS가 앱명을 제공하지 않는 API 한계를 사실대로 구분하여 구현·보고할 것.

### 2.3 적용·수정 파일

- `flow-lab/v17_restore_native_app_picker_v22.py`: 이전 V20 위에 적용되는 시스템 선택 복원 패치
- `flow-lab/v16_capture_stt_durable_log.py`: 기존 출력음 STT 및 로그 저장 기능 유지
- `flow-lab/SpeakerPlaybackCaptureService.java`: 사용자 승인 토큰으로 캡처 서비스 시작, 별도 앱명 추정 금지
- `flow-lab/SpeakerPlaybackStt.java`: `AudioPlaybackCaptureConfiguration` 기반 원래 STT 유지, 마이크 STT와 분리
- 재구성된 `AndroidProject/app/src/main/java/app/hitel/samsungprobe/W03ConsoleActivity.java`에서 **시스템 동의창·현재 승인 상태·다시 선택 버튼**을 확인할 것.

## 3. 독립형 16kHz 스피커 송출 앱 — 실제 수정해야 할 부분

### 3.1 현재 원본의 결함

원본 브랜치의 `speaker-standalone/app/src/main/java/app/hitel/speakeronly/PcmSpeakerMonitor.java`는 `AudioAttributes.USAGE_VOICE_COMMUNICATION`으로 `AudioTrack`을 생성한다.

Android의 일반 `AudioPlaybackCaptureConfiguration`은 `USAGE_MEDIA`, `USAGE_GAME`, `USAGE_UNKNOWN` 유형만 허용한다. 따라서 소리가 물리 스피커에서 들려도, 출력음 STT 앱의 일반 Playback Capture에는 들어오지 않을 수 있다.

### 3.2 반드시 적용할 수정

```java
AudioAttributes.Builder attributes = new AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_MEDIA)
    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH);
if (Build.VERSION.SDK_INT >= 29) {
    attributes.setAllowedCapturePolicy(AudioAttributes.ALLOW_CAPTURE_BY_ALL);
}
AudioTrack track = new AudioTrack(
    attributes.build(), format, bufferBytes, AudioTrack.MODE_STREAM, 0);
```

- 매니페스트 `<application android:allowAudioPlaybackCapture="true" ... />`를 명시할 것.
- **현재 빌드 `targetSdk=28`**이므로 매니페스트 명시적 허용이 특히 중요함.
- 출력 `AudioTrack`을 재생 도중 속성만 바꾸지 말고 **새 속성으로 다시 생성**할 것.
- 사용자가 선택한 출력 장치(`setPreferredDevice`)와 실제 장치(`getRoutedDevice`)를 구별하고 둘을 로그로 남길 것.
- 미디어 볼륨, 음소거 상태, `AudioManager.getMode()`, PCM RMS, `AudioTrack.getPlaybackHeadPosition()`, 쓰기·실재생 위치를 측정할 것.
- **녹음파일이 증가할 때만 읽는 기존 파일 팔로워, AAC 디코더, PCM 변환 및 AudioTrack 스트리밍 기능은 유지**할 것.
- 기본 전화앱의 통화 음성이 보호된 정책으로 제한되어도 **독립 앱이 직접 생성한 `USAGE_MEDIA` 오디오가 캡처 가능한지** 별도 테스트할 것. 스피커폰이 통화 자체의 보호를 해제한다는 주장은 금지.

### 3.3 이미 적용된 수정 위치와 상태

| 파일 | 수정 브랜치에서의 내용 | 검증 수준 |
|---|---|---|
| `PcmSpeakerMonitor.java` | `USAGE_MEDIA`, `ALLOW_CAPTURE_BY_ALL`, 실제 PCM RMS·라우팅·볼륨 로그 | 소스 확인, ARM64 APK 빌드 성공 |
| `AndroidManifest.xml` | `allowAudioPlaybackCapture=true` | APK 빌드 시 검사 |
| `app/build.gradle.kts` | `targetSdk=28`, 버전 1.0.1 | 소스 확인 |
| `TraceJournal.java` | MediaStore Downloads 직접 ZIP 저장 | 소스 구현, 실제 기기 저장은 미검증 |
| `SpeakerService.java` | 정상 종료·오류 시 자동 ZIP 저장 시도 | 소스 구현, 실제 기기 저장은 미검증 |
| `MainActivity.java` | 수동 ZIP 다운로드 버튼/최근 저장 경로 표시 | 소스 구현 |
| `ci/emulator_smoke_v2.py` | x86_64 에뮬레이터 증가 M4A 시험 시나리오 | 현 단계 테스트 미완료 |

**실제 빌드 성공:** https://github.com/lyonbegin/hitel-room/actions/runs/43186413952  
**에뮬레이터 E2E 실패 (오디오 단계 이전 시험 환경 문제):** https://github.com/lyonbegin/hitel-room/actions/runs/43187174601  
**중요:** ‘빌드 성공’을 ‘다른 앱에서 실제 출력음이 캡처됨’으로 표기하지 말 것.

## 4. 필수 시험 순서 (최종 합격 조건)

| 시험 ID | 조건 | 확인해야 하는 증거 |
|---|---|---|
| T01 | HITEL14 실행 → 출력음 STT 시작 | **Android 시스템**의 ‘단일 앱/전체 화면’ 선택창 둘 다 표시 |
| T02 | ‘단일 앱’ 선택 → 유튜브에서 음성 재생 | PCM RMS 양수, STT partial/final 실제 산출 |
| T03 | 캡처 중지 → 다시 시작 | OS 선택창이 재표시되고, 새 승인 세션이 정상 시작 |
| T04 | 독립형 16kHz 앱에서 실제로 커지는 M4A 선택 | `APPENDED_NEW_SOURCE_BYTES` / AAC 디코드 / `PCM_PLAYBACK_WRITE` / `PLAYBACK_PROGRESS` |
| T05 | 독립형 앱을 `USAGE_MEDIA`로 재생 → HITEL14가 해당 앱 선택 | HITEL14의 실시간 PCM RMS 양수 및 STT partial/final. **정확한 원문과의 대조** |
| T06 | YouTube와 독립형 앱을 동시에 재생 | Android 시스템 ‘단일 앱’ 선택이 실제 **오디오 범위를 어떻게 제한하는지** 별도 기록. 지정하지 않은 앱 유입 시 절대로 단일 앱 캡처 성공이라 하지 말 것 |
| T07 | 삼성 기본 전화앱에서 통화 중 스피커폰 사용 | 전화 통화음 자체와 독립 앱의 미디어 PCM을 **서로 다른 신호**로 분리해 측정 |
| T08 | 독립형 앱 중지·예외 종료 | `Downloads/Galaxy-16kHz-AudioRoute-*.zip` 실제 존재, JSONL·native 로그 포함 |
| T09 | HITEL14 종료 | `Downloads/HITEL14_SPEAKER_STT_LOG_*.zip` 실제 존재, 실패 원인·RMS 확인 |
| T10 | 에뮬레이터 설치/실행 | ARM64 실기기 APK와 x86_64 에뮬레이터 APK 구분. 설치·실행·오디오 루프 결과로 판정 |

**T05·T06·T07은 실제 기기/두 앱 동시 실행 검증이 끝날 때까지 ‘미검증’으로 표시**할 것. ‘오디오 버퍼 write 성공’은 실청취나 타 앱 캡처 성공이 아니다.

## 5. 필수 진단 로그와 실패 원인 판정

1. **FILE_NO_GROWTH / 0 bytes:** Samsung 녹음 파일이 외부 앱에 증가분을 노출하지 않는지, 실제 DocumentProvider 크기 지연인지 구별.
2. **AAC_DECODE_FAILED:** 완성되지 않은 M4A `mdat` 내 AAC 프레임 경계, 실제 샘플레이트/채널, FFmpeg 로그를 확인.
3. **PCM_RMS=0:** 실제 PCM이 무음인지, 잘못된 오디오 사용 유형인지, 재생 소스 자체가 없는지 확인.
4. **PLAYBACK_HEAD_MOVING + 캡처 RMS=0:** 출력 유형/매니페스트/오디오 정책/캡처 대상/같은 사용자 프로필인지 확인. 앱명 추정 금지.
5. **STT_MODEL_NOT_READY:** 다운로드·모델 캐시·STT 엔진 상태를 별도로 보고. 독립형 앱에는 STT 엔진이 없음.
6. **ZIP_EXPORT_FAILED:** MediaStore 다운로드 URI, 저장 시점, 실패 예외를 화면에 표시하고 로그 손실 없이 재시도 가능하게 구성.
7. **IN_CALL_ONLY_FAILURE:** 통화 모드에서 재생 라우팅이 변경되는지, 미디어 음량이 무음인지, 통화 보호 정책인지 구별.

## 6. 절대 변경하지 말 항목

- Android 시스템 ‘단일 앱’ 선택을 강제로 끄거나 앱 내부의 두 번째 앱 선택 UI로 대체하지 말 것.
- 시스템에서 선택한 대상 앱의 이름을 공개 API로 받지 못하는데 임의 패키지명을 표시하지 말 것.
- `KoreanSherpaStt.java`와 원본 마이크 STT를 수정하지 말 것.
- 독립형 앱의 원본 M4A 증분 감시·AAC 디코딩을 ‘저장 완료 후 재생’으로 바꾸지 말 것.
- 독립형 앱에 불필요한 STT 모델을 넣지 말 것.
- 물리 스피커 출력, `AudioTrack.write` 완료, `MediaProjection` 캡처, STT 인식 성공을 하나의 ‘성공’으로 묶지 말 것.
- 예전 APK를 덮어쓴 것으로 주장하지 말고 패키지명·버전·SHA256을 기록할 것.

## 7. 개발자가 제출할 최종 결과물

1. 두 브랜치별 **소스 수정 커밋 SHA / 파일별 diff**.
2. **ARM64 실기기용 서명 APK**와 SHA256.
3. 설치·실행·버튼 동작·시스템 ‘단일 앱’ 동의창 실제 스크린샷.
4. **T01–T10** 시험의 PASS/FAIL/UNVERIFIED 표. 실패 시 원본 ZIP 첨부.
5. 동일 음성 파일을 대상으로 독립형 출력 PCM과 HITEL14 STT 캡처 PCM의 입력 여부를 비교한 결과.
6. **삼성 통화 중 성공 여부는 실제 Galaxy 기기 로그로 입증**할 것. 에뮬레이터 결과만으로 통화 중 성공을 선언하지 말 것.

## 8. 기술 근거

- Android MediaProjection: https://developer.android.com/media/grow/media-projection
- Android app screen sharing: https://developer.android.com/about/versions/14/features/app-screen-sharing
- Android Playback Capture: https://developer.android.com/media/platform/av-capture
- Android AudioPlaybackCaptureConfiguration: https://developer.android.com/reference/android/media/AudioPlaybackCaptureConfiguration

---

**핵심 지시:** HITEL14는 Android 원래 시스템 선택만 사용하고 상태를 정직하게 표시한다. 독립형 16kHz 앱은 실제 증가하는 녹음파일을 `USAGE_MEDIA`로 출력하되, 다른 앱에서 캡처된다는 사실을 **두 앱 실기기 시험 로그로 증명할 때만** 완료 판정한다.
