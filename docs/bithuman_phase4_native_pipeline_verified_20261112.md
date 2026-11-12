# Verified independent bitHuman Expression 2 Phase4 renderer research

**Date:** 2026-11-12 (KST/UTC); public Wise Pup sample, Android SDK 0.6.2, isolated internal analysis.
**Branch:** feature/bithuman-expression2-imx-sdk-audit-20261112.
**Status:** 53-frame CPU video generated and quantitatively verified. Standalone Kotlin Android APK **compiled, installed and fully ran all 53 frames on the Android 14 API34 x86_64 Google APIs emulator** (run 43246265487, both jobs success).

## Actual evidence

- Public IMX v2 extraction: https://github.com/lyonbegin/hitel-room/actions/runs/43226116772
- Offline graph inspection (five TFLite subgraphs): https://github.com/lyonbegin/hitel-room/actions/runs/43226883541
- Real independent CPU model execution: https://github.com/lyonbegin/hitel-room/actions/runs/43229511340
- Android 14 encoder+tokenizer execution: https://github.com/lyonbegin/hitel-room/actions/runs/43230843459
- Actual ARM64 JNI callgraph metadata and decompiler excerpts: https://github.com/lyonbegin/hitel-room/actions/runs/43244274511
- Canonical seeded 14-frame comparison: https://github.com/lyonbegin/hitel-room/actions/runs/43244089540
- Verified independent **53-frame** pipeline: https://github.com/lyonbegin/hitel-room/actions/runs/43245140384
- Independent full-pipeline Android APK build AND successful Android emulator execution: https://github.com/lyonbegin/hitel-room/actions/runs/43246265487

## Exact native model data flow observed in ARM64 JNI decompilation

Ghidra 12.2 analyzed the published libexpr2jni.so from ai.bithuman:expression2-android:0.6.2. JNI functions are evidence of actual published code, but the engine's API auth logic is not modified or invoked.

1. History initialization (native function FUN_001a7db0):
   - canon.bin Float32 tensor shape [16,90,52].
   - Copies each channel's 90*52 float plane into sixteen history slots, creating [1,16,16,90,52].
   - Each plane 0x4920=18,720 bytes; one 16-channel canon block 0x49200=299,520 bytes.
2. Audio and recurrent motion (FUN_001a8500):
   - Enc -> tok14 TFLite inference calls.
   - Processes token banks in groups of 6 and 8.
   - Each token step uses rank-5 history and rank-3 audio token; step generates [1,16,90,52].
   - History rolls **left** by one, copies 15 older slots and appends the newly generated latent to slot 15.
3. RGB decoder assembly (FUN_001a9f6c):
   - Decoder channels 0–15: current motion [16,90,52].
   - Decoder channels 16–31: previous motion [16,90,52].
   - Decoder channels 32–35: one-hot phase indicator (the selected phase channel is a plane of 1.0, other phase channels 0.0).
   - First motion receives itself as previous when no prior state exists and emits phase 3 only.
   - Each subsequent motion yields phase 0,1,2,3.
   - Consequently 14 motion steps produce 1 + 13*4 = **53 RGB frames**, then decoded in batches using dec8 / dec16.
4. The public Java JNI accessor Native_stepHistoryInputIndex reads a field from the runtime instance (native pointer+0x28); it does not return a fixed constant.
5. Authentic vendor pipeline additionally performs audio-window processing, state scheduling, overlap and backend routing that the prototype has not fully reproduced.

## Actual image generation results

The independently implemented script tools/bithuman_deep/decoder_phase4_reconstruction.py uses:
- Public Wise Pup IMX parsed by own imx_v2.py, extracts canon.bin and combined_litert.tflite.
- Google ai-edge-litert 2.3.0 CPU interpreter, no bitHuman Android SDK or API Secret.
- Controlled test audio: 220Hz+440Hz synthetic sine wave at 16kHz.
- Enc -> tok14 -> 14 canonical-seeded autoregressive step calls -> phase4 decoder inputs -> 3 dec16 + 1 dec8 invocations.
- Outputs 53 frames, 416x720 RGB, 20fps, 2.65 sec H.264 MP4.

Measured:
- First-frame RGB MAE relative to original idle.mp4 first frame: **18.27648** (0–255 scale).
- Prior canonical-seeded, incomplete decoder method: 25.06987.
- Initial all-zero history / incorrect decoder: 41.50374.
- Successive generated-frame mean absolute RGB difference: **2.38617** (0–255 scale).
- Three dec16 CPU calls: 940.31ms, 692.026ms, 649.883ms.
- One dec8 CPU call: 365.238ms.
- All 53 frame pixel SHA-256 hashes recorded; more than one distinct frame.
- Model-graph identity is plausible and visibly close to the original dog, though not pixel-identical.

CI evidence artifact:
https://github.com/lyonbegin/hitel-room/actions/runs/43245140384/artifacts/13957240032

## Android implementation

An **independent Google LiteRT** Kotlin application is in:
experiments/bithuman-independent-android/FullPhase4Activity.kt

Standalone Android CI:
.github/workflows/bithuman-independent-android-phase4.yml

The app has:
- Public TFLite model and canon.bin assets.
- No bitHuman SDK AAR, no API Secret, no account authentication.
- Enc -> tok14 -> canon initialized history -> 14 step calls -> 53 RGB frames.
- Android animated preview with approx 50ms display refresh.
- Writes first and last PNG frames into application files for ADB verification.

Build APK success as of run 43246265487, artifact:
https://github.com/lyonbegin/hitel-room/actions/runs/43246265487/artifacts/13956654476

## Android 14 E2E actual verification — PASSED

- Workflow run: https://github.com/lyonbegin/hitel-room/actions/runs/43246265487
- Build job: build-native-full-pipeline **success**.
- Emulator job: prove-on-android14-emulator **success**.
- Android 14 API34 x86_64 Google APIs with ro.product.cpu.abilist=x86_64,arm64-v8a.
- APK: https://github.com/lyonbegin/hitel-room/actions/runs/43246265487/artifacts/13956654476
- Full proof ZIP (ADB device properties, Logcat, screen screenshot, PNGs, memory): https://github.com/lyonbegin/hitel-room/actions/runs/43246265487/artifacts/13958480555
- Logcat:
  - PHASE4_START vendorSDK=NONE credentials=NONE
  - ENC_TOK14_PASS
  - STEP14_PASS
  - DECODE_BATCH_PASS dec16 kept=16 total=16
  - DECODE_BATCH_PASS dec16 kept=16 total=32
  - DECODE_BATCH_PASS dec16 kept=16 total=48
  - DECODE_BATCH_PASS dec8 kept=5 total=53
  - INDEPENDENT_ANDROID_PHASE4_PASS frames=53 totalMs=42960
  - REAL_ANDROID53_PHASE4_PASS
- **53 actual RGB frames** rendered, Kotlin app screen displaying the generated Wise Pup avatar alongside status logs.
- Valid first_frame.png 490,787 bytes and last_frame.png 461,245 bytes extracted through ADB run-as. Their PNG SHA-256 values are different, confirming exported frames are not byte-identical:
  - first: d64f4754e4a3217f9b016ddd969a59912492dfa84bbf69afa27b8350db8598c0
  - last: 712ee3e44019099a04186b2f8d3060c2fd5e6818b96e243affc175e456f846cb
- Captured Android meminfo: app total PSS 300,352 KiB and RSS 358,044 KiB (this is a point-in-time dump after synthesis, not peak memory profiling).
- Measured 42.96 sec is **full model computation for the 53-frame clip**, not 20fps live inference. 53 model frames at 20fps playback are 2.65 sec after computation; playback loop has a 50ms UI interval.
- No actual spoken voice PCM used and no phoneme synchronization tested. Authentication-free public model computation does **not** reproduce a backend photo-to-IMX creator.

## Remaining priorities after successful Android model runtime

1. Replace synthetic audio with controlled real speech at 16kHz and inspect lip motion response.
2. Test streaming chunk advancement and pipeline latencies instead of batch-generation followed by playback.
3. Compare against original avatar output and eventually benchmark on actual ARM64 Android hardware.
4. Identity creation for arbitrary new users remains an entirely separate unsolved pipeline.


## Unfinished technical scope

- Real speech-phoneme sync testing (synthetic tones are not speech).
- Exact vendor audio frontend, overlap scheduler and speaker/idle state parity.
- Consistent real-time 20fps rendering on ARM64 physical hardware (CPU emulator speed not a device benchmark).
- Dynamic loading arbitrary newly generated IMX, user photo -> new identity model generator.
- Essence 2 complete real-time render pipeline (only partial ONNX CPU decoder verification).
- Numerical bitwise equality to authorized SDK rendering is not claimed.

These distinctions are necessary for reproducible research; successful model execution or RGB frame generation does not establish commercial-grade user-created avatar capability.
