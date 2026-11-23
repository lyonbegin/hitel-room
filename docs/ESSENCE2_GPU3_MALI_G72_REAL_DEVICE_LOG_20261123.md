# Essence2 GPU3 — Mali-G72 device trace (2026-11-23 ~15:49 KST)

## Source and verdict

User-provided diagnostics text `붙여넣은 텍스트(1)(20261123-064913).txt` from `crownlteks`, Android API 29, arm64. Only the first 39 trace records and recent records ~391–740 are included. **The middle records seq=40–390 are missing.** Consequently **there is no evidentiary basis to claim Stage 2 executed or did not execute**. No raw user trace is committed.

- Loaded original native `lible_jni.so`, SHA-256 `3eed089467f5ffeab88715c0d126f09e87734e84190e6e4899494db6b67657cf`.
- Hook installed: `stage=sdk.backend.clhook installed=true captureFlags=22` and `[hitel-gpu3] HOOK_INSTALLED`. This indicates hook setup, NOT a compatible-GPU retry.
- GPU identified by vendor: `[borrow-gpu] Mali-G72`.
- OpenCL kernels created with rc=0 including conv group. **Creation success does not prove enqueue success**.
- Vendor `clGetKernelWorkGroupInfo` reported maxima of 384 for `k_convl8_7_16`, `k_convl8_16_16`, `k_convr2_16_1`.
- The GPU3 native wrapper calls original enqueue first; it retries with local Y=1 **only** when the original returns `-54` on a whitelisted convolution with 3D local geometry Y=8 and the other guards. A hypothetical 704-local invocation against a 384 maximum can need this path; no 704-local failing dispatch is in the supplied excerpt.
- No `ORIGINAL_GPU_OK`, `ORIGINAL_GPU_INVALID_WORK_GROUP_SIZE`, `COMPAT_GPU_OK`, `COMPAT_GPU_FAILED_ORIGINAL_CPU_FALLBACK`, or `DEMOTED` events in the *visible excerpt*. All may occur in the omitted middle.

## Rendering/playout confirmed

- `sdk.render.ready frames=250 expected=250` and `sdk.render.complete frames=250 expected=250`.
- `speech.prepare.end frames=250 durationMs=22684` = ~22.684 seconds of full-speech **pre-rendering**, not live low-latency streaming.
- `audio.track.write pcmBytes=320000 returnedBytes=320000 sampleRate=16000`.
- 250 `display.present kind=S` events with `pts24k` running 0–239040 by exactly +960 ticks, every 40 ms target PTS: `uniqueShown=250 due=250 coveragePct=100`.
- Observed wall-time between speech display events median 40ms (min 19ms, max 80ms); this is callback timing, not proof of physically displayed video or pixel accuracy.
- `sdk.utterance.drained completed=1 played16k=160000 total16k=160000 uniqueShown=250 due=250` confirms AudioTrack clock progress and 250 display callbacks.
- `director_ep=cpu (ORT_CPU_EP)` means Director model inference on CPU, independent of Mali GPU compositor.
- `hardwareCanvas=false` means Surface Canvas path was not hardware Canvas; does not rule out OpenCL GPU work.
- Do not attribute `22.684s` versus Adreno `9.186s` to GPU3 changes: different physical devices/hardware; no controlled comparison.

## Required next evidence

Obtain complete `hitel_e2_trace.log` or `hitel_e2_trace_GPU3.log`, including missing seq 40–390, and inspect:
- `ORIGINAL_GPU_OK` and actual `originalLocal`, `originalRC`
- `ORIGINAL_GPU_INVALID_WORK_GROUP_SIZE` on a known-conv kernel
- `COMPAT_GPU_OK` with `originalRC=-54`, `compatRC=0` and `compatLocalY=1`
- `COMPAT_GPU_FAILED_ORIGINAL_CPU_FALLBACK` and native `DEMOTED` if applicable

Do not modify production SDK, PCM, video renderer, or retry conditions based on this truncated diagnostic paste alone. Preserve the published APK while evaluating exact route evidence.
