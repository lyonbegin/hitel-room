# Verified dec8 canonical feature placement experiment (not a reconstructed avatar)

Date UTC: 2026-11-12
GitHub success: https://github.com/lyonbegin/hitel-room/actions/runs/43232241295
PNG and JSON evidence: https://github.com/lyonbegin/hitel-room/actions/runs/43232241295/artifacts/13950722817
Source: tools/bithuman_deep/test_decoder_channel_layout.py
Public source: wise-pup IMX, official idle.mp4 + canon.bin + combined_litert.tflite.

## Test method

Independent Google ai-edge-litert 2.3.0 invoked actual dec8 TFLite signature on CPU for six different synthetic placements of the authentic 16x90x52 Float32 canon.bin tensor inside the documented 8x36x90x52 decoder input. All 6 dec8 invocations returned finite RGB output [8,3,720,416]. The first frame of each result was converted from float RGB to PNG and compared to the first frame of the real idle.mp4 rendered at the same 416x720 resolution.

The 36-channel decoder input contract remains unknown. These placement experiments are not presumed correct. The numerical RGB-to-idle error is only a diagnostic ranking; it does not prove correct identity or animation quality.

## Measured results

| Case | Decoder CPU call (s) | Rendered image std (0–255) | RGB MAE against idle frame |
|---|---:|---:|---:|
| all_zero | 0.9957 | 7.68 | 55.14 |
| canon_0_16 | 0.7690 | 58.24 | 69.28 |
| canon_16_32 | 0.7327 | 10.28 | 54.55 |
| canon_20_36 | 0.7328 | 32.12 | 61.37 |
| canon_0_16_and_16_32 | 0.7296 | 57.59 | 68.15 |
| canon_0_16_and_20_36 | 0.7322 | 70.56 | 77.53 |

Authentic canon tensor: 16x90x52 float32, min -2.6684, max 2.9210, std 0.8579.

The original public idle video depicts the white dog Wise Pup beside a cup. Several synthetic dec8 outputs instead show a human-looking person in the cup scene; most layouts show blurry/incorrect identity. The visually vivid result is NOT the intended Wise Pup face. In particular, the low MAE for zero inputs is due to a nearly flat, low-contrast output rather than successful identity reconstruction.

## What this confirms

- The decoder is a functional, real pretrained inference graph, not merely a stub returning shape metadata.
- Real canon.bin changes its output substantially when placed at different channel offsets.
- These six naive layouts do NOT reconstruct the correct identity-conditioned frame.
- The correct 36-channel contract must be inferred from actual native pipeline dataflow, including motion latent, canon/identity channels and any spatial conditioning.

## Required next work

1. Inspect public SDK JNI dataflow for decoder input assembly and find exact channel semantics.
2. Feed actual enc -> tok14 output into the correct multi-step scheduler; then supply decoder conditioning.
3. Compare synthesized frames against canonical idle and a genuine audio-guided vendor reference.
4. Only after matching identity and stable frame generation attempt full 20fps Android synthesis.

There is still NO complete independent bitHuman talking-head renderer or new user-photo model creator. Do not label this experiment as successful avatar reproduction.
