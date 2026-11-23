# Essence2 GPU3 — Original GPU → compact GPU → original CPU (2026-11-23)

## Contract
- No change to the original native ELF: SHA-256 `3eed089467f5ffeab88715c0d126f09e87734e84190e6e4899494db6b67657cf`.
- Obsolete 4-instruction WG128 ELF (SHA `a96a8892807e432719d9c58814257d03a85cee8eee297803473d9d8153618c14`) must not exist in packaged APK.
- `BASELINE` Android process runs native vendor code exactly as before, without GPU3 interposition.
- `GPU3` Android process preloads **the same original native ELF** and then installs a specific OpenCL function-table hook before SDK `nativeCreate`. The vendor player/PCM/rendering code is unchanged.
- Only stage-2 GPU dispatch may intervene; do not patch or override the vendor CPU demotion logic.

## Three stages
1. `ORIGINAL_GPU_OK` — original `clEnqueueNDRangeKernel` returned success. Return that success unchanged, do not retry.
2. `ORIGINAL_GPU_INVALID_WORK_GROUP_SIZE` — only original return `-54` for whitelisted convolution kernels with expected three-dimensional `localY=8` launch, then retry **the same kernel and arguments** with `localY=1` (expected 352→44, 704→88 total work items per group). Success: `COMPAT_GPU_OK`, return zero.
3. Retry failure: `COMPAT_GPU_FAILED_ORIGINAL_CPU_FALLBACK`; return the **original** `-54` to the vendor SDK. Any other original error: `ORIGINAL_GPU_FAILED_ORIGINAL_CPU_FALLBACK`; return that original error. The vendor decides actual CPU transition; it is NOT forced in the interposer.

## Diagnostics
- Android `HITEL_E2TRACE` file records `stage=sdk.backend.clhook sdkRoute=GPU3 installed=true` before SDK creation and `stage=sdk.backend.native` with `[hitel-gpu3]` messages.
- A typical line includes `stage=ORIGINAL_GPU_OK` or `stage=COMPAT_GPU_OK`, `kernel=`, `originalLocal=`, `compatLocalY=`, `originalRC=`, `compatRC=`, `hostUs=`, and running counters.
- **Important:** `ORIGINAL_CPU_FALLBACK` in a route message means the original error code was handed back to the SDK. Confirm **actual** CPU demotion with the vendor's subsequent `[borrow-gpu] DEMOTED to the CPU compositor` log.
- `hook installed` does not prove a GPU kernel ran; use `ORIGINAL_GPU_OK` / `COMPAT_GPU_OK` with actual kernel name and return value.
- `LE_DIRECTOR_OPENCL` is not forced by GPU3; the native SDK's original backend choice is retained.

## Numerical-correctness limitation
The stage-2 alternative is currently a **workgroup-dispatch geometry retry of the vendor OpenCL kernel**, not a separately mathematically proved scalar rewrite. Altering local workgroup dimensions can change `get_local_id`, `get_group_id`, local memory cooperation, and barriers. Therefore the route's ability to avoid `-54` does **not** establish identical pixel output. Same-input output comparison is mandatory before claiming production equivalence. If parity fails, disable stage 2 for the offending kernel and let the original vendor CPU fallback occur until a verified compatible kernel is available.


## 2026-11-23 follow-up: production dispatch regression (PASS, host simulation only)
- Added `tools/bithuman_deep/test_essence2_gpu3_native_dispatch.py` and `.github/workflows/essence2-gpu3-native-dispatch-regression.yml`.
- PASS run: https://github.com/lyonbegin/hitel-room/actions/runs/45124046067
- Actual production C++ `known_conv_kernel` and `audit_enqueue` bodies are extracted verbatim and compiled with a deterministic fake OpenCL driver; the simulation is not an independent reimplementation of the dispatch algorithm.
- Nine scenarios PASS: original success; -54 compact success; -54 compact failure with exact original -54 returned; non--54 error passthrough; unknown kernel; wrong dimensions; unsupported local Y; non-divisible global Y; oversized remaining local dimensions.
- PASS also verifies stage ordering, counters, preservation of queue/kernel/global/offset/wait/event arguments, and 8→1 local-Y change only on the second call.
- **NOT VERIFIED:** OpenCL GPU hardware execution/command completion, pixel parity, actual SDK CPU demotion, audio speaker output, rendered video. A successful enqueue response does not itself prove completed GPU execution. Do not label these as PASS based on the deterministic host test.
- Original vendor SO, player, PCM, render path and CPU fallback logic were **not modified** by this follow-up. The previously published APK is unchanged; this follow-up is source-level regression assurance, not a new APK build.

## Next physical-device proof
- On the target device, execute both BASELINE and GPU3 with the same bundled Sofia 10-second PCM, preserving complete logs.
- Determine whether `sdk.backend.clhook installed=true` precedes `sdk.backend.native` kernel calls. If no `ORIGINAL_GPU_OK` or `COMPAT_GPU_OK` lines appear, classify GPU execution as NOT VERIFIED, not as automatic success.
- On `-54`, examine both stage-1 and stage-2 kernel, global/local sizes and return codes; on failure require the SDK's own `[borrow-gpu] DEMOTED` before reporting actual CPU fallback.
- Verify synchronized audible speech, a nonblank animated Sofia video, complete ordered frame ordinals, and source-verified image results. Check same-input frame output for geometry-sensitive numerical differences before enabling Stage 2 for production.

## Source files
- `tools/bithuman_deep/essence2_gpu3_original_first_native.cpp`
- `tools/bithuman_deep/prepare_essence2_original_gpu3.py`
- `tools/bithuman_deep/essence2_local_android/HitelSdkLoader.kt`
- `tools/bithuman_deep/essence2_local_android/HitelSdkProbe.kt`
- `tools/bithuman_deep/prepare_essence2_single_apk_ab.py`
- `.github/workflows/essence2-sofia-embedded-android15-offline.yml`
