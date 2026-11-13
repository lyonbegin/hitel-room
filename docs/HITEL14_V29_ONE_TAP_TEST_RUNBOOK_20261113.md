# HITEL14 V29: 원클릭 통화 STT 검증 실행서 (2026-11-13)

## 기준 APK / 변경 금지 항목

- APK: [HITEL14_V29_OneTap_CallPipeline_3STT.apk](../downloads/HITEL14_V29_OneTap_CallPipeline_3STT.apk)
- SHA-256: `bb8d5e7736012f324d711b1dff84dde3ed016224eea8e619425a2e4f0bcf1066`
- applicationId: `app.hitel.callflowlab.v14.systempicker`, versionCode: `37`, ABI: `arm64-v8a`
- 기존 마이크 KoreanSherpaStt, 출력음 SpeakerPlaybackStt, 직접 PCM PcmDirectSherpaSink, PcmSpeakerMonitor, AAC 디코더, CallStateGate, 기존 로그 ZIP/TXT 내보내기 구현 변경 없음.
- **기존 V22와 서명 인증서가 달라 덮어쓰기 설치가 불가능합니다. 기존 앱 삭제 시 앱 데이터/권한이 사라질 수 있습니다. 실기기에서 바로 기존 앱을 삭제하지 마십시오.**

## 사용자가 수행하는 조작

1. 삼성 전화 앱의 통화 자동 녹음이 활성화되어 있는지 확인합니다. 지원 여부/녹음 폴더 위치는 삼성 전화 앱과 기기 설정에 따라 다릅니다. 앱이 자체적으로 전화 통화 음성을 직접 가져오지 않습니다.
2. HITEL14 V29에서 화면 맨 위의 **▶ 테스트 시작 · 기본 전화 앱 자동 열기** 를 한 번 누릅니다.
3. 최초 실행에서만 Android의 녹음 폴더 선택창이 뜨면 실제 삼성 통화녹음 `.m4a` 폴더를 선택하고 권한을 허용합니다. 이어지는 READ_PHONE_STATE, RECORD_AUDIO 요청은 시스템에서 허용합니다.
4. MediaProjection 화면 캡처 동의는 **Android가 해당 세션마다 요구합니다.** 자기 앱이 재생하는 USAGE_MEDIA 오디오를 수집해야 하므로 캡처 범위를 **전체 화면**으로 선택합니다. 앱이 이 동의 과정을 우회해서 자동 허용하지 않습니다.
5. 기본 전화 앱이 열리면 **전화번호를 입력한 뒤 발신**합니다. 통화 중 통화녹음 M4A 생성/크기 증가, PCM 출력, STT는 앱 서비스가 처리하도록 연결되어 있습니다.
6. 통화가 종료되면 IDLE을 감지하여 PCM 워커를 정리합니다. 메인 화면 맨 위 **📁 로그 저장 · 폴더 선택**을 누르고 저장할 폴더를 선택하면 `HITEL14_latest_log.txt`를 쓰기/덮어쓰기하고 재열기·SHA256 검증 결과를 표시합니다.

## 진단 이벤트 / 실패 원인 판별

| 단계 | 이벤트/관찰 지점 | 관찰되지 않을 때 확인할 사항 |
|---|---|---|
| 버튼 클릭 | `ONE_TAP_START_REQUEST` | W03 실제 UI 클릭 진입 여부 |
| 폴더 선택 | `ONE_TAP_WAIT_SAF`, `ONE_TAP_SAF_READY` | 폴더 URI 및 SAF 읽기 권한 |
| 전화 권한 | `ONE_TAP_WAIT_PHONE_PERMISSION`, `ONE_TAP_PHONE_PERMISSION_GRANTED` | READ_PHONE_STATE 승인/거부 |
| 오디오 권한 | `ONE_TAP_WAIT_AUDIO_PERMISSION`, `ONE_TAP_AUDIO_PERMISSION_GRANTED` | RECORD_AUDIO 승인/거부 |
| 화면 캡처 | `ONE_TAP_WAIT_PROJECTION_CONSENT`, 기존 `CAPTURE_SERVICE_START` | 시스템 캡처 승인 여부 / MediaProjection 서비스 |
| 발신 | `ONE_TAP_DIALER_OPENED` | 기본 전화 앱 ACTION_DIAL 실행 |
| 통화 감지 | `PIPELINE_OFFHOOK`, `CALL_OFFHOOK_BEGIN_LIVE_RECORDING_VALIDATION` | 통화 상태 등록/전화 상태 권한 |
| 녹음 파일 발견 | `LIVE_M4A_CONFIRMED_GROWING`, `M4A_SOURCE_READY` | 삼성 자동 녹음, 폴더 URI, M4A 파일 증가 이벤트 |
| 파일 복제 | `APPENDED_NEW_SOURCE_BYTES`, `M4A_MIRROR_READY` | SAF 파일 핸들·seek·파일 읽기 |
| AAC 디코딩 | `AAC_DECODER_CREATED`, `FOLLOW_FRAME_CONSUMED` | AAC follower native process, 파일 포맷 |
| PCM 첫 출력 | `FIRST_16KHZ_PCM_READY`, `PIPELINE_PCM_FIRST` | 16kHz PCM 샘플 수, 원본 AAC 디코더 |
| AudioTrack | `SPEAKER_TRACK_STARTED`, `PLAYBACK_PROGRESS` | USAGE_MEDIA, ALLOW_CAPTURE_BY_ALL, audio route, pcmRms |
| 출력음 STT | `SPEAKER_PARTIAL`, `SPEAKER_FINAL` | 출력음 capture RMS, MediaProjection 세션, Sherpa 상태 |
| 통화 종료 | `PIPELINE_CALL_IDLE`, `SESSION_CLOSED` | IDLE 콜백, 워커 stop, 진단 내보내기 |
| 로그 내보내기 | `MANUAL_LOG_SAVE_VERIFIED` | 선택 폴더 쓰기/읽기 권한 및 재열기 확인 |

주의: `CALL_STATE_OFFHOOK` 자체만으로 녹음 파일이 생성되었다는 뜻은 아닙니다. **실제 녹음 확인은 M4A 파일 크기 증가**, 실제 인식 확인은 **캡처 RMS > 0 및 텍스트 이벤트**를 각각 검증해야 합니다. 기기의 통화 오디오 출력 정책에 따라 미디어 AudioTrack이 통화 중 감쇠·차단될 가능성은 아직 실기기 시험이 필요합니다.

## 검증 상태

- ARM64 앱 빌드, APK 서명 검증, GitHub 파일 게시: 성공.
- Android 15 x86_64 에뮬레이터 설치/화면/기존 AudioTrack PCM/가상 GSM OFFHOOK·IDLE/실제 「테스트 시작」 터치/Android 시스템 SAF 폴더 선택창: 통과 (run [43354431938](https://github.com/lyonbegin/hitel-room/actions/runs/43354431938)).
- SAF 복귀 시 전화 권한이 중복 요청될 수 있는 경로 제거: 수정 후 재빌드 성공. 별도 재검증 진행 경로 [GitHub Actions](https://github.com/lyonbegin/hitel-room/actions).
- **실제 삼성 이동통신 음성, Samsung proprietary M4A 생성, 실제 통화 중 자막:** 아직 검증되지 않음. 에뮬레이터에서 재생한 테스트 음성을 이동통신 상대방 음성으로 표기하면 안 됨.
