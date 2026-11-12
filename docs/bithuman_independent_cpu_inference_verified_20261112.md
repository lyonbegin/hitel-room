# Verified independent CPU inference of public bitHuman models

Test UTC: 2026-11-12T13:35.
GitHub Actions: https://github.com/lyonbegin/hitel-room/actions/runs/43228689213
Source: tools/bithuman_deep/run_cpu_inference.py
Workflow: .github/workflows/bithuman-cpu-inference.yml

## Claim limited to actual CPU neural network inference

Two native independent model runtimes were installed through pip, without invoking the closed-source bitHuman SDK or supplying credentials.

- Google ai-edge-litert 2.3.0: loaded the official public wise-pup IMX member combined_litert.tflite.
- ONNX Runtime 1.31.1 CPU Execution Provider: loaded the official public sofia-ramirez IMX member a2x_dec.onnx.
- Both models actually executed on the GitHub Ubuntu x86_64 CPU with two deterministic synthetic test cases each.
- Tensor outputs were finite and changed with different inputs.
- No photos, proprietary secret, account authentication, cloud model generation, Android JNI calls or face frames were involved.

## Expression 2 encoder (TFLite)

LiteRT interpreter model loaded, five SignatureDefs available: enc, tok14, step, dec16, dec8.
TFLite interpreter initialization 0.0015–0.0016 sec; tensor allocation 0.0759–0.0826 sec.
Observed peak RSS approx 320,624–320,796 KB on GitHub x86_64.

| Synthetic input | Input shape | Output shape | Encoder invoke duration | Output SHA256 |
|---|---|---|---:|---|
| float32 zeros | [1,35200] | [1,55,12,768] | 0.0439 sec | 8492d59510efe59f428e1c7e7b5ae21282b5d9e844ea83d97c545e223c4bdbf3 |
| 220 + 440Hz tones | [1,35200] | [1,55,12,768] | 0.0585 sec | 1c7dab1bdc335b51a7bbcfaa44986dff9772a9e23784503d915e94fb6441c5e6 |

Both resulting tensors were finite. These are synthetic audio-like 16 kHz PCM inputs, NOT actual speech/TTS.

Proof:
- https://github.com/lyonbegin/hitel-room/actions/runs/43228689213/artifacts/13947874397

## Essence 2 decoder (ONNX)

a2x_dec.onnx loaded using CPUExecutionProvider. Inputs ctx_t [1,256], prev [1,63], h [1,1,256].
Outputs m [1,63] and h_out [1,1,256]. Session creation 0.0075–0.0116 sec.

| Synthetic vector | Session.run duration | m SHA256 |
|---|---:|---|
| zero vectors | about 0.0004 sec | 6f30e3654e88ca4e99c83451851bd194c261a2ad48048a13dfd524c0ec09f803 |
| sinusoidal ctx_t vector | about 0.0004 sec | 494fe4a9c9970a927a386162eff6b543e4fae3c2a9ab0e3379b8e1688540403f |

This is an independent decoder subgraph calculation; it does not establish correctness of the full audio frontend or produce render frames.

Proof:
- https://github.com/lyonbegin/hitel-room/actions/runs/43228689213/artifacts/13949067081

## Remaining unknowns

- Connecting all Expression2 subgraphs with the correct state, sliding windows, identity conditioning, and full decoder input preparation.
- Running Essence2 streaming audio frontend and image compositor end-to-end.
- Rendering a sequence of frames synchronized to live audio and head motions.
- Android x86_64 NativeBridge full inference (not just library load).
- Actual latency and memory on a physical ARM64 Android phone.

Next step: use real intermediate outputs from enc to invoke tok14 and validate shape, finite numerical results. For step and dec, prove separate subgraph invocation first; do not synthesize identity conditioning and claim authentic video without accurate pipeline data.
