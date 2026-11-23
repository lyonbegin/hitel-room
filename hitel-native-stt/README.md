# HITEL Native STT — experimental C++ implementation

Independent experimental source. The stable `stt/main` and Samsung recording M4A → PCM512 → FIFO routes are unchanged.

## Implemented

- `NativeSttEngine`: signed 16-bit PCM at 16kHz → float; preserve all PCM samples in order.
- Whenever an actual recognizer returns changed *whole-utterance* text, dispatch a new partial caption synchronously. No modulo-N gating, no 640ms UI timer, no simulated word pacing.
- On endpoint or EOF, emit the final utterance; an updated partial may replace text even when its length decreases.
- Each decoding step records source samples, processing time, changed-result flag, and a monotonic emit timestamp.
- Public Sherpa-ONNX C API adapter: requires **the same original imported IXIO** `encoder.ort`, `decoder.ort`, `joiner.ort`, `tokens.txt`, `bpe.vocab`. Does not substitute a public Korean model.
- Android `NativeSttBridge` + C++ JNI entrypoints are available for later experimental integration; production `SpeakerEngine` does not select this backend.

## Verified tests

`cmake -S hitel-native-stt -B /tmp/hitel-build -DBUILD_TESTING=ON`

`cmake --build /tmp/hitel-build && ctest --test-dir /tmp/hitel-build --output-on-failure`

Tests cover every changed partial, suppress unchanged text, preserve all PCM samples, two's-complement normalization, correction/retraction, endpoint reset, EOF final, invalid PCM rejection.

GitHub Actions compiles the engine and tests, checks the public C API adapter with the upstream official header, compiles the JNI entrypoints and Java source.

## Optional original-model inference from raw 16k PCM

Requires a **separate public** Sherpa-ONNX C API shared library and headers, not `libsherpa-onnx-jni.so` from proprietary IXIO.

`cmake -S hitel-native-stt -B /tmp/hitel-real -DHITEL_WITH_SHERPA=ON -DSHERPA_HEADER_ROOT=/public/sherpa/header/root -DSHERPA_C_API_LIBRARY=/public/sherpa/libsherpa-onnx-c-api.so`

`cmake --build /tmp/hitel-real`

`/tmp/hitel-real/hitel_native_stt_cli /path/to/ixio-stt /path/to/16k-mono.pcm`

The user-provided proprietary model files have **not** been available in this CI runtime. Public Sherpa compatibility, output parity with original `CombinedSTTKWS`, and per-word latency improvements are **not proven**. The original encoder may still require ~640ms of audio per decode. To improve native recognition frequency, validate the `.ort` graph and encoder cache then re-export an actually compatible shorter-chunk model; merely changing metadata is unsafe.

## Native JNI build (when public runtime is available)

The JNI Java class is deliberately **not activated** in the current Android app. Build the separate JNI shared library only after public Sherpa ARM64 library is staged and original IXIO model inference succeeds. Preserve the original STT APK as the fallback.
