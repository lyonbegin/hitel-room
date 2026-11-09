# 한국어 sherpa-onnx FFmpeg 스트리밍 STT (독립 테스트 v2)

- 패키지: `app.hitel.sherpafiletest`, HITEL14와 완전히 별개
- 기존 엔진: sherpa-onnx 1.12.26, 한국어 streaming Zipformer 2024-06-16 INT8
- FFmpeg: `dev.ffmpegkit-maintained:ffmpeg-kit-min:8.1.7`
- Android SAF: 기존 WhisperVault 방식, 파일 직접 선택
- 데이터 경로: Android SAF URI → FFmpegKit `getSafParameterForRead()` → `registerNewFFmpegPipe()` → `-f s16le -ar 16000 -ac 1` → 3,200바이트(0.1초) 단위 PCM 읽기 → `OnlineStream.acceptWaveform` → `OnlineRecognizer.isReady/decode/getResult/isEndpoint/reset`
- 파일 전체 PCM을 메모리에 적재하지 않습니다. 인식 중 문장을 화면에 계속 업데이트합니다.
- 중지 버튼을 사용하면 FFmpeg 세션을 취소하며 확정된 결과를 화면에 남깁니다.
- 모델 파일은 첫 설치 시 **APK에 포함**되어 별도 모델 다운로드가 필요 없습니다.
- TXT 저장: 시스템 파일 저장기를 통해 사용자 선택 위치에 기록합니다.
- 로그: `adb logcat -s SherpaFileTest` (원본 음성은 업로드하지 않음).
- 스트리밍 방식 참고: [sherpa-onnx 공식 FFmpeg C 구현](https://github.com/k2-fsa/sherpa-onnx/blob/master/ffmpeg-examples/sherpa-onnx-ffmpeg.c), [FFmpegKit Android named pipe](https://github.com/arthenica/ffmpeg-kit/blob/main/android/ffmpeg-kit-android-lib/src/main/java/com/arthenica/ffmpegkit/FFmpegKitConfig.java)
- Python과 FFmpegKit의 입출력 인터페이스는 다르므로 Android용 FFmpegKit native FIFO로 연결합니다.
- 검증 기준: CI의 컴파일/서명/모델 포함 성공, 그리고 **실기기**에서 선택한 M4A의 PCM·decode count·partial/final 확인. CI만으로 실제 전사 성공을 인정하지 않습니다.
