# sherpa-onnx FFmpeg 원본 네이티브 Android 이식

이번 디렉터리의 `sherpa-onnx-ffmpeg.c`는 `k2-fsa/sherpa-onnx@v1.12.26`의 `ffmpeg-examples/sherpa-onnx-ffmpeg.c`를 **단 한 글자도 수정하지 않고** 복사한 원본입니다.

- 원본 파일 GitHub blob SHA: `82cff117389d796d017259f6a0b58cd7fcef0ada`
- https://github.com/k2-fsa/sherpa-onnx/blob/v1.12.26/ffmpeg-examples/sherpa-onnx-ffmpeg.c
- upstream Makefile is also preserved, but it is a desktop build recipe and cannot be run as-is for Android.
- Android ABI builds require `libavcodec`, `libavfilter`, `libavformat`, `libavutil`, `libswresample`, and native `libsherpa-onnx-c-api`/ONNX runtime.
- Original main accepts: tokens, encoder, decoder, joiner, audio filename, [threads], [decoding method]. It contains `av_read_frame` + `SherpaOnnxOnlineStreamAcceptWaveform` + `SherpaOnnxPrint` + endpoint handling.
- Android-specific scope: content URI materialization and bridge to original entrypoint and output. No new ASR loop.
- Original is a demonstration program for desktop; cannot assume Android APK compatibility without native ABI linking tests.

`ci-inspect-upstream-android.yml` prints the actual prebuilt archive/FFmpegKit AAR layout to base the Android link on observed data, not guesses.
