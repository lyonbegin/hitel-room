# Essence2 GPU3 — Samsung q4q Android 15 real-device log diagnosis (2026-11-23)

## Scope and evidence limitations

Source: user-provided diagnostic paste `붙여넣은 텍스트(1)(20261123-062834).txt`, generated ~15:28 KST on 2026-11-23. This is an **excerpt** containing `hitel_e2_trace.log head / previous rotation`, `hitel_e2_trace.log recent`, and `hitel_ai_e2e.log recent`; the middle of the full device trace is **not present**. Do not treat absence of an error in this paste as proof of its absence in the complete trace. Raw user logs were intentionally not committed.

- Device: `q4q`, API 35 (Android 15), arm64-v8a, process ending `:hitel_gpu3`.
- Original packaged native: `lible_jni.so` SHA-256 `3eed089467f5ffeab88715c0d126f09e87734e84190e6e4899494db6b67657cf`.
- SDK probe initialization: `stage=sdk.backend.clhook installed=true captureFlags=23`.
- Native proof: `[hitel-gpu3] HOOK_INSTALLED`.
- Device OpenCL platform: `[borrow-gpu] QUALCOMM Adreno(TM)`, kernel build succeeded.
- Actual original OpenCL dispatch: repeated `stage=ORIGINAL_GPU_OK` with `originalRC=0`; **cumulative originalGPU counter reaches at least 6,499**. This proves repeated OpenCL kernel submissions reported success, not end-to-end command completion or numerical/pixel parity.
- Examples: `k_convi8_7_16` local `22x8x2` (352), `k_convi8_16_16` local `22x8x2` (352), `k_compose` local `256`, `paste_warp_blend5` dynamic local, all `originalRC=0` in observed excerpt; the `k_convl8_7_16` reported workgroup max 512.
- SDK paste stage: `[le-paste-opencl] n=500 avg_gpu_ms=19.067` (vendor's own timing metric).
- Director backend: `director_ep=cpu (ORT_CPU_EP)`. The model's Director inference on CPU **does not contradict** GPU OpenCL compositor/paste processing. GPU3 did not force `LE_DIRECTOR_OPENCL`.
- No `ORIGINAL_GPU_INVALID_WORK_GROUP_SIZE`, `COMPAT_GPU_OK`, `COMPAT_GPU_FAILED_ORIGINAL_CPU_FALLBACK`, or `DEMOTED` in **provided excerpts**. Thus Stage 2 and Stage 3 are **not observed**, not proven unnecessary globally.

## Render and playout

- `sdk.render.ready frames=250 expected=250 sdkAvailable=0`.
- `sdk.render.complete frames=250 expected=250 sdkAvailable=0`.
- `speech.prepare.end durationMs=9186`: pre-rendered 250 frames; this is NOT low-latency live speech streaming.
- `audio.track.write pcmBytes=320000 returnedBytes=320000 sampleRate=16000`; `sdk.utterance.drained played16k=160000 total16k=160000 completed=1`. This verifies buffer acceptance and playback-head progress but **not external acoustic audibility**.
- `display.present kind=S` covers 249 unique samples with PTS `960..239040` ticks at 24kHz in exact increments of 960 (40 ms), while `uniqueShown=249 due=250`. Only the first PTS=0 presentation slot is absent. All subsequent speech-frame presentation timestamps are present.
- The existing unchanged `Essence2SpeechPlayer.kt` computes the candidate frame from `player.playbackHeadPosition` and skips earlier frames when playback has advanced; it can select candidate 1 immediately if the playback head is already 640 samples (40ms). Thus the missing frame-0 is consistent with **playout startup timing**, not SDK frame generation failure.
- 249 visible speech frame presentation events have median inter-event interval ~40.43 ms (~25fps), observed range ~15.45–47.07 ms; observed presentation lateness median 0ms, max 40ms according to source PTS vs device playback head.
- `surface.post.ok` records `hardwareCanvas=false bitmapWidth=540 bitmapHeight=960`. This is separate from whether GPU computed OpenCL compositor kernels. An observable animated/nonblank display still requires visual inspection or frame hashes.

## Verified vs unverified

| Claim | Status |
|---|---|
| Exact unpatched vendor SO loaded | PASS |
| GPU3 OpenCL table hook installed | PASS |
| Qualcomm Adreno selected and kernels created | PASS |
| Original GPU OpenCL kernel enqueues returned success repeatedly | PASS |
| Full OpenCL command completion and numerical output parity | NOT VERIFIED |
| Compatibility Stage 2 executed | NOT OBSERVED IN EXCERPT |
| Actual vendor CPU compositor demotion | NOT OBSERVED IN EXCERPT |
| Director model inference on GPU | NO — explicit ORT_CPU_EP |
| SDK produced 250/250 frames | PASS |
| 249/250 frames presented, PTS 0 not displayed | PASS (observation) |
| AudioTrack playback head reached 160000/160000 | PASS |
| Actual speaker audible and avatar visually correct | NOT VERIFIED |

## Change discipline

No inference to repatch the vendor ELF or modify the player/PCM/renderer is supported by this log. Preserve current APK and original SDK. Acquire a **complete** route-specific `hitel_e2_trace_GPU3.log` (not just head/recent snippets) if a comprehensive negative assertion about `-54`, compact fallback, or vendor demotion is required. For Stage 2 production equivalence, compare identical frame output hashes/pixel arrays and motion samples against known-correct baseline on same device. 
