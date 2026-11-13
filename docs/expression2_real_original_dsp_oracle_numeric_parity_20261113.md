# Expression 2 original SDK numeric differential verification (2026-11-13)

## Scope

Expression 2 only, official unmodified SDK 0.6.2. Not Essence 2.
This is a tested original SDK **numerical DSP subroutine** and comparison with a separate candidate implementation. It is not a completed real-time SDK.

- AAR: ai.bithuman:expression2-android:0.6.2
- Original AAR SHA-256: 067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584.
- Original ARM64 libexpr2jni.so internal function: FUN_001a9794, RVA 0x001a9794.
- Original JNI anchor: Java_ai_bithuman_expression2_Native_feed, RVA 0x001724d8.
- ELF load address is established from the live JNI export, original ARM64 instruction at target checked to be 0xd10283ff.
- Original function was **actually invoked** on Android 14 x86_64 Google APIs emulator through ARM64 NativeBridge; its 35,200 Float32 output samples were captured and compared with those from a separate candidate function.
- Identical function inputs for both: 44,000 Float32 16kHz PCM samples, scale=1.25. Two outputs of exactly 35,200 Float32.

## Verified run links

- First real original SDK DSP oracle: https://github.com/lyonbegin/hitel-room/actions/runs/43344594322
- Original window selection fix: https://github.com/lyonbegin/hitel-room/actions/runs/43345450620
- Original frintm rounding fix: https://github.com/lyonbegin/hitel-room/actions/runs/43345789416
- **Strict numeric regression passed**: https://github.com/lyonbegin/hitel-room/actions/runs/43346901381
- Input PCM and original-vs-candidate outputs and JSON: https://github.com/lyonbegin/hitel-room/actions/runs/43346901381/artifacts/14002616347
- Installable original ARM64 function test APK: https://github.com/lyonbegin/hitel-room/actions/runs/43346901381/artifacts/14002770097

## Actual Android original-vs-candidate results

| Input | Bit-equal Float32 out of 35,200 | MAE | Max absolute error |
|---|---:|---:|---:|
| Silence | 35,200 | 0 | 0 |
| Impulse | 35,200 | 0 | 0 |
| 220Hz+440Hz sine | 35,119 | 1.3715841553427957e-10 | 5.9604644775390625e-8 |
| Deterministic noise | 35,116 | 1.42238356850364e-10 | 5.9604644775390625e-8 |
| English TTS speech | 35,164 | 6.095929579301314e-11 | 5.9604644775390625e-8 |

The above values were measured by actually invoking the unmodified original ARM64 machine code in Android. They do not establish bitwise identity for all PCM; residual discrepancies are real.

## Found source-based differences

1. Original segment selection carries the previously selected source-window offset into the next overlapping segment. The previous prototype compared with the fixed output window, causing large waveform differences; this was corrected based on the original function and actual output.
2. Original DSP uses output block length 1,120, overlap 192, offset scan ±117 samples, and Float32 weighting constant 0.0052083335. Candidate changed to follow the recovered function, not invented behavior.
3. Original ARM64 frintm semantics affect negative rounding; candidate updated to floor after 0.5 bias, fixing the impulse comparison.
4. Disabling compiler floating-point contraction was tried and actually worsened parity, causing the strict CI to fail. This experiment was reverted based on actual same-input output measurements, not relaxed test limits.
5. Remaining differences are one ULP (Float32 last bit) and are preserved as non-identical.

## Automated gate

- All tests require exactly 35,200 outputs.
- Silence and impulse must be 100% bit equal.
- Other cases require 34,848/35,200 or more exact values, MAE <= 1e-9, maximum absolute error <= 1.2e-7.
- The entire input PCM, original output arrays, candidate output arrays, SHA256 digests, and numeric report are retained for every passing run.
- Failure in any condition makes the GitHub Actions job fail.

## Source files

- experiments/bithuman-expression2-oracle/OriginalPreprocessorJNI.cpp
- experiments/bithuman-expression2-oracle/MainActivity.kt
- experiments/bithuman-expression2-oracle/test_original_emulator.sh
- .github/workflows/expression2-original-dsp-oracle.yml

## What is NOT proven

This is verification of a single actual original audio preprocessing function. It does not yet prove byte-identical floating point operations in all cases, the entire vendor feed/pump/pull state machine, exact encoder frame timings, authentication, live speech lip sync, performance, or SDK-level parity.


## Latest current branch verification: original NEON coefficient interpretation

Current expression2-oracle candidate uses the source-derived Float32 coefficient 0.0052083335 instead of dividing by 192.0f. The last CI attempt deliberately disabled compiler floating-point contraction; this made original SDK numerical parity *worse*, so the change was reverted without lowering strict pass thresholds.

Actual latest **both-job success**, with all five exact same-PCM numerical tests and original SDK JNI function invocation:
https://github.com/lyonbegin/hitel-room/actions/runs/43347454776

| Input | Latest bit-identical of 35,200 | Latest MAE | Maximum absolute error |
|---|---:|---:|---:|
| silence | 35,200 | 0 | 0 |
| impulse | 35,200 | 0 | 0 |
| sine | 35,038 | 2.7431683106855914e-10 | 5.9604644775390625e-8 |
| fixed_noise | 35,086 | 1.9303777001120828e-10 | 5.9604644775390625e-8 |
| spoken_tts | 35,151 | 8.2972374829379e-11 | 5.9604644775390625e-8 |

- Latest downloadable original and candidate Float32 outputs, the exact source input PCM, reports, emulator logs:
  https://github.com/lyonbegin/hitel-room/actions/runs/43347454776/artifacts/14001199663
- Latest compiled original ARM64 reference function test APK:
  https://github.com/lyonbegin/hitel-room/actions/runs/43347454776/artifacts/14002770858

The earlier best strict-pass version 43346901381 with division by 192.0f had a *slightly higher bit-exact count*; the current coefficient expresses the original source decompiler's 0.0052083335 constant. Both versions remain strict-pass **numerical**, not all-bit-exact. Each code change must preserve a test report that truly invokes and compares to the unmodified SDK routine, never merely compare two independent implementations.
