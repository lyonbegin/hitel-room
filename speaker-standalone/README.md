# 삼성 통화녹음 16kHz PCM 스피커 전용 앱

이 독립 Android 프로젝트에는 Sherpa-ONNX, STT, 자막, VAD, ONNX 모델 및 인식기 실행이 없습니다.

## 오디오 경로

1. 녹음 M4A 파일 또는 새 녹음이 생성되는 폴더를 Android SAF로 선택
2. 같은 파일에서 약 250ms마다 *새로 추가된 바이트만* 읽어 앱 내부 파일에 이어쓰기
3. 기존에 검증한 `aac_mdat_follow.c`로 AAC 프레임 경계 복구
4. Android `MediaCodec` 한 개로 AAC 48kHz 모노 디코딩
5. 기존 FIR로 16,000Hz PCM16 모노 리샘플링
6. 첫 PCM이 들어오는 시점에 `AudioTrack`을 만들고 스피커에 재생

## HITEL14 등 다른 앱에서 이 앱의 출력음을 선택해 인식할 때

- 기존 버전은 `AudioTrack`에 `USAGE_VOICE_COMMUNICATION`을 사용하여 **다른 앱의 Android 출력음 캡처 대상에서 제외**되었습니다.
- V2에서는 `USAGE_MEDIA`와 `ALLOW_CAPTURE_BY_ALL`을 명시하고 AndroidManifest의 `allowAudioPlaybackCapture=true`를 설정합니다. `targetSdk=28`이므로 매니페스트 허용이 필수입니다.
- 먼저 **이 앱에서 녹음 파일의 증가분 읽기와 16kHz PCM 재생을 시작**하신 다음, 출력음 STT 앱의 단일 앱 선택에서 `통화 녹음 실시간 스피커`를 선택하십시오. 앱을 선택하는 것만으로 녹음파일이나 소리가 생성되지는 않습니다.
- `PCM_PLAYBACK_WRITE` 로그의 `pcmRms`와 `playedAudioMs`를 확인해 실제 PCM이 출력 중인지 확인하십시오. 삼성 전화 통화 중에는 Android 통화 오디오 정책에 따라 물리 스피커 출력이나 제3자 캡처가 별도로 제한될 수 있습니다.

## 진단 로그 저장

- 매 세션 시작 시 `files/diagnostics/run-.../events.jsonl` 등으로 진단 이벤트가 저장됩니다.
- Android 10 이상에서는 **세션 종료·오류 시 Download 폴더에 ZIP 자동 저장**, 재생 도중에도 **'진단 ZIP 즉시 다운로드 저장' 버튼**으로 직접 내보낼 수 있습니다.
- Android 8/9에서는 기존 SAF 위치 선택 저장 버튼을 사용합니다.
- 자동 저장 성공 시 앱 상태에 `Download/Galaxy-16kHz-AudioRoute-...zip` 경로가 표시됩니다.

## 출력 선택

실제 연결된 내장 스피커, 수화부, 블루투스 A2DP/SCO/LE, 유선 및 USB-C 장치를
`AudioManager.getDevices(GET_DEVICES_OUTPUTS)`로 조회합니다.
`AudioTrack.setPreferredDevice()`로 경로를 요청하고
`AudioTrack.getRoutedDevice()`로 **실제 출력**을 확인합니다.

Android의 통화 오디오 정책이 출력을 제한하면 앱이 그 정책을 강제로 우회할 수 없습니다.
변경 요청과 실제 장치가 다를 경우 로그에 남습니다. 전화 앱의 오디오 경로는 수정하지 않습니다.

## 구현 범위

- 모델 파일, 인식기 라이브러리 및 FFmpegKit AAR 자체는 APK에 포함되지 않습니다.
- 필수 AAC 패킷 복구 네이티브 실행 파일, FFmpeg libavcodec/libavutil/libswresample,
  Android MediaCodec만 사용합니다.
- 전화 녹음 원본 파일은 수정하지 않고 종료 시 내부 복사본을 삭제합니다.
- 진단 ZIP에는 PCM 전체나 녹음 파일 원본을 포함하지 않습니다.
- 삼성 표준 AAC 48kHz 단일 채널 growing-mdat 녹음으로 검증합니다.
- 다른 코덱 / 녹음 포맷은 별도 디코더 확장이 필요합니다.
