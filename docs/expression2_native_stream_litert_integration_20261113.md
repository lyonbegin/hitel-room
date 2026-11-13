# Expression 2 — native PCM stream + public LiteRT frame generation integration (2026-11-13)

## Scope and provenance

This document records the concrete independent-SDK continuation after
`docs/expression2_independent_sdk_development_handoff_20261113.md`.
The target is exclusively Expression 2, not Essence 2.

- Repository: `lyonbegin/hitel-room`
- Branch: `feature/bithuman-expression2-imx-sdk-audit-20261112`
- Original vendor package under analysis: `ai.bithuman:expression2-android:0.6.2`.
- Original ARM64 function index: 2,629 FDE records in `.eh_frame_hdr`/ `.eh_frame`.
- Original third-party executable/billing/auth functions are **not copied into the new APK**.
- The independently generated C++ source is *not* bitHuman's original C++ source.
- The public Wise Pup Expression 2 model is downloaded from its public endpoint,
  checked, and packaged for isolated model experiments only.

## New source files

| File | Exact purpose |
|---|---|
| `sdk/expression2-verified-core/include/expression2_stream_state.h` | Public opaque C API, snapshot, pre-inference status codes |
| `sdk/expression2-verified-core/src/expression2_stream_state.cpp` | PCM Float32 vector, initial 64,000 sample capacity, owned Canon history, counters, pre-inference threshold guards and reset |
| `sdk/expression2-verified-core/test-android/stream_state_smoke.cpp` | 26 independent candidate smoke assertions, no vendor runtime needed |
| `sdk/expression2-verified-core/test-android/StreamSmokeActivity.kt` | JNI/Android smoke entry point |
| `sdk/expression2-verified-core/test-android/verify_stream_emulator.sh` | Android 14 screenshot, logcat and 26-case strict verdict |
| `sdk/expression2-verified-core/src/expression2_stream_jni.cpp` | JNI bridge from 44,000 PCM floats and original Canon to 35,200 preprocessed floats |
| `experiments/bithuman-independent-android/NativeStreamPhase4Activity.kt` | Previously proven standalone Kotlin LiteRT phase4 renderer, now using native C++ PCM preprocessing input |
| `experiments/bithuman-independent-android/test_native_stream_phase4_emulator.sh` | Requires both native input evidence and real 53-model-frame output |
| `.github/workflows/expression2-stream-state-candidate.yml` | Source-built C++ host + ARM64 APK + Android 14 smoke CI |
| `.github/workflows/expression2-native-stream-to-litert-53frame.yml` | Source-built ARM64/x86_64 JNI + public model + Android real frame CI |

## Exact pre-inference correspondence

- `FUN_001a7fbc`: the original 9-case synthetic-engine feed oracle recorded exact copied Float32 values, initial capacity >=64,000, segment flags and sample counters; our new state copies original PCM Float32 bytes and tracks counters in an owned std::vector.
- `FUN_001acf1c`: original vector append capacity/content tests; our new implementation relies on standard C++ vector insertion, not transplanted original machine instructions.
- `FUN_001a7db0`: verified Canon expansion function remains unchanged and is invoked at state creation/reset.
- `FUN_001a80dc`: scheduler sample thresholds 25,600, 44,000, then `step*25600+18400` observed under synthetic backpressure; the independent precheck **never calls the model**.
- `FUN_001a8230`: sample end-boundary trim and tail bit observed in the original 11-case oracle; the new API implements representable state transitions without claiming the original backend flush.
- `FUN_001a9794`: the bit-exact source-derived input-44,000 / output-35,200 preprocessing implementation is reused without modification.
- `FUN_001a8500`: **unimplemented original/native end-to-end inference scheduling**. Do not mistake a one-window Kotlin model sample for parity.

## Native + model experiment wiring

1. New Kotlin Activity creates exactly 44,000 input Float32 samples from a reproducible 220/440 Hz test tone.
2. `System.loadLibrary("expression2_verified_core")` loads the independent new JNI library.
3. `verifiedNativeStreamPreprocess(canon,pcm)` constructs owned Canon history and feeds three PCM chunks (8,000; 17,600; 18,400).
4. The JNI module verifies native state has 44,000 samples, then calls the previously proven 44,000-to-35,200 preprocessing function.
5. Kotlin sends `Array(1) { FloatArray(35200) }` to the same LiteRT `enc`, `tok14`, `step`, `dec16/dec8` renderer already successful in the *separate* earlier real-model Android prototype.
6. The exact previously documented decoder layout is current 16 motion channels, previous 16 motion channels, four one-hot phase channels, and 53 frames from 14 motion steps.

The model runner is **not** the original JNI streaming scheduler; timing/latency/lip-sync is not thereby proven. Original live speech input and model-output bit-exact parity still require separate tests. This is a one-window integration proof, not a finished real-time SDK.

## Evidence and verdicts

| Test | Source | Verdict |
|---|---|---|
| Original two-function 6-vector bit parity, Android 14 | https://github.com/lyonbegin/hitel-room/actions/runs/43443392494 | PASS |
| New independent 26-case PCM/tail/scheduler smoke, Android 14 | https://github.com/lyonbegin/hitel-room/actions/runs/43443944879 | PASS (26/26) |
| Historical standalone Kotlin real LiteRT 53-frame rendering | https://github.com/lyonbegin/hitel-room/actions/runs/43246265487 | PASS (synthetic audio) |
| Historical Python CPU phase4 53-frame test | https://github.com/lyonbegin/hitel-room/actions/runs/43245140384 | PASS (synthetic audio) |
| Integrated native PCM → Kotlin LiteRT 53-frame test | https://github.com/lyonbegin/hitel-room/actions/runs/43444969601 | **Must read current run status/log before assigning PASS or FAIL** |

Evidence for Android C++ pre-inference 26-case confirmation is the test log line:
`EXPR2_STREAM_PREINFERENCE_SMOKE_PASS passed=26 failed=0`.

The integrated APK should only PASS after the emulator proves *both*:
`NATIVE_STREAM_INPUT_PASS pcm=44000 modelInput=35200` and
`INDEPENDENT_ANDROID_PHASE4_PASS frames=53`.
The integration run may require fixes; this document does not predeclare success.

## Next gates (in order)

1. Confirm integrated native-C++-input-to-model Android emulator job and collect original PNGs/logcat/memory evidence.
2. Replace synthetic tone with documented 44,000-sample real speech vectors; compare encoder/frame results, never claim speech sync merely on visible movement.
3. Implement model-native streaming state/timestamp ownership, production `feed/pump/pull/flushTail/reset/close` and backpressure, preserving original pre-inference state comparisons.
4. Derive full C++ LiteRT interpreter path (same graph tensors and output format) instead of relying only on Android Kotlin for model inference.
5. Validate original-vs-independent outputs and concurrency on Android 14 emulator and ARM64 device, report delays, FPS, crashes and leaks.
6. Do not deliver a production/installed SDK before 4 and 5; do not bypass vendor billing/auth.

Historical exceptions:
- Some older vendor-free CI runs failed with shell pipeline exit 141 caused by `unzip ... | grep -q` under `pipefail`; fixed by writing the APK file list to disk first.
- An initial stream-state Android run used `set -o pipefail` under the runner's `/bin/sh`; fixed by invoking a separate `bash` script. Failures were test harness execution, not verified model defects.
