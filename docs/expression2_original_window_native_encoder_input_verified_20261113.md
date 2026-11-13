# Expression 2 original audio-window-to-encoder input validation (2026-11-13)

**Scope:** only original `ai.bithuman:expression2-android:0.6.2`. No Essence 2, vendor authentication, new rendering algorithm or model inference claim.

Original ARM64 reference from run [43328017533](https://github.com/lyonbegin/hitel-room/actions/runs/43328017533), artifact `13992718722`:
- `FUN_001a8500`, RVA `0x001a8500`, machine instructions `0x001a8598`–`0x001a863c`.
- Step `k` uses a PCM source start of `max(k-1,0)*25,600`; source stop `min(available,(k+1)*25,600,start+44,000)`. Input buffer is 44,000 Float32 samples, initially zero-filled.
- Calls original unmodified `FUN_001a9794` on those 44,000 samples, producing 35,200 Float32. The exact original ARM64 path multiplies all 35,200 Float32 outputs by 3.0 before submitting the encoder input tensor.
- Step 0 processes only 25,600 samples and 18,400 zeros **even when subsequent audio is already available**. Step 1 processes 44,000 samples from source offset 0; subsequent steps slide the window by 25,600 samples.
- Original method's `step==0` selects **6** motion tokens; `step>=1` selects **8**, starting at token index 6. These counts are *not* interchangeable with generating 14 motions in one blocking operation.

## Added runtime test

The test harness uses the verified *unmodified ARM64 binary* to execute original `FUN_001a9794` for six source-derived windows. It checks all exact copied/padded bytes, first/second/later window offsets, 35,200 Float32 original outputs, and exactly 3.0x scale to the model-input tensor, preserving each PCM and output as binary evidence. The pre-existing independently reconstructed `candidatePreprocess` is run only as a numeric diagnostic and never substituted for the original path.

New files captured by existing Android oracle CI:
- `original_stream_window_report.json`
- `stream_<case>_window.f32` (44,000 Float32 per case)
- `stream_<case>_original_preprocessed.f32` (35,200 Float32 per case)
- `stream_<case>_original_encoder_x3.f32` (35,200 Float32 per case)

Eight cases: `step0_threshold`, `step0_extra`, `step1_full`, `step2_full`, `step3_partial`, `step3_full`. The step1 full input is required to be byte-identical to previous `spoken_tts_input.f32`, and the original preprocessor output must also be byte-identical on the repeated invocation.

**Critical distinction:** windows are assembled from *actual original machine instruction control flow*, but `FUN_001a8500` is **not invoked end to end** in this harness. Only `FUN_001a9794` executes in the original ARM64 binary. The original scheduler, encoder/tok14/step inference, backend async transfer, live `feed -> pump -> pull`, identity conditioning and live frame timing are **not** established by this test. The test APK remains a function verification tool, not a production talking-avatar SDK.

## Next gate

Use the saved real source-window inputs to compare the original SDK's *actual* encoder/step intermediate tensors, including first-6 and later-8 token slices. Do not claim a full vendor-equivalent stream until original-runtime outputs and frame/PTS metadata match on identical PCM.
## Active-tail sensitivity regression

Two additional cases use identical audio before sample 25,600, but deliberately add nonzero dual-tone audio after that threshold. Step 0 must produce exactly the same original encoder-input Float32 bytes as the non-augmented reference, while step 1 must produce different bytes. Both conditions are asserted on Android output; this prevents a silent-tail input from concealing a mistaken window selection.


## Verified Android execution (not merely proposed)

- [GitHub Actions #43384495476](https://github.com/lyonbegin/hitel-room/actions/runs/43384495476): **both build and Android emulator jobs SUCCESS**.
- APK artifact: `14017504820`; numerical/logs artifact: `14018221066`.
- Android 14 API34, x86_64 AVD with ARM64 `libndk_translation.so`.
- `original_stream_window_report.json`: 8 cases, status PASS, `active_tail_step0_invariant=true`, `active_tail_step1_sensitive=true`.
- Every tested original 35,200-Float32 preprocessor output was bit-exact against the existing candidate on these **eight** controlled windows (`candidate_bit_exact=35200`, `candidate_max_abs_diff=0`). This does not prove universal numerical equivalence.
- Active-tail case output SHA-256 (x3 encoder input): initial step `d93d82040cdbe1f55014...` equals baseline; second step `4ef5275345b38f2ec7cf...` differs from unmodified second-step baseline `d93d82040cdbe1f55014...`.
- Test APK SHA-256: `da72f40754f6748ab21bc9691634a8d6e33011972d457b5d707f18a43e9ebcd1`; matches the Android CI artifact's `apk-sha256.txt`.

**Strict remaining gate:** authenticate-independent *real original runtime* execution of `FUN_001a8500` inference / asynchronous model outputs has NOT been demonstrated. The window preparation in this harness was source-derived; only `FUN_001a9794` was actually executed from the unmodified vendor binary. Rendering, worker queue, live 20fps and real-device proof remain pending. Essence 2 still not started.
