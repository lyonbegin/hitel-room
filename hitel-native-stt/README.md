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

## Native-only Android experimental APK (2026-11-23)

- Source branch: `feature/ixio-native-stt-reimplementation-20261123`.
- **Different Android package:** `app.hitel.recording.ixio.nativestt.experiment`; the existing IXIO V14 and `stt/main` installed apps are neither replaced nor modified.
- `SpeakerEngine` in this branch routes the existing FAAD2 M4A → PCM512 FIFO to `NativePcmKoreanStt` and the `NativeSttBridge` JNI. There is **no** original IXIO JNI bundled into this separate test APK, preventing cross-version `libonnxruntime.so` collisions.
- The public Sherpa-ONNX v2.0.3 archive is SHA-256 pinned, and its public C API + matching public ONNX Runtime are staged with the custom ARM64 JNI library.
- Build script: `bash speaker-standalone/ci/build_test_github_faad2_v12.sh && bash hitel-native-stt/ci/build_native_only_apk.sh`.
- GitHub workflow: `.github/workflows/ixio-native-stt-experimental-apk.yml`. The workflow validates M4A, PCM, ARM64 ELF, JNI dynamic linkage, APK signature, unique package ID, and absence of original IXIO JNI before producing an external Actions artifact.
- GitHub Release API upload returned **HTTP 403 Resource not accessible by integration** in the first run. This is a publish-permission failure, **not** an APK compilation failure; the verified APK is instead delivered as an Actions artifact. Do not claim the Release URL exists.
- No real original IXIO `.ort` loading, token accuracy or word-latency improvement has yet been verified. The user must import the original STT.zip in the separate test app. The new C++ partial event callback is instantaneous **only when the model actually supplies a new hypothesis**; it does not promise intervals shorter than the original 640ms encoder chunk.
