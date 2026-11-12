# Verified reverse-engineering: bitHuman IMX v2 and Android SDK

Date: 2026-11-12 UTC
GitHub successful workflow: https://github.com/lyonbegin/hitel-room/actions/runs/43226116772
Official CLI + JNI metadata artifact: https://github.com/lyonbegin/hitel-room/actions/runs/43226116772/artifacts/13946899182
Independent parser: tools/bithuman_deep/imx_v2.py
Offline tests: tools/bithuman_deep/test_imx_v2.py

## The IMX v2 container format has been independently reconstructed and validated

Binary layout, little-endian:

| Bytes | Type | Meaning |
|---|---|---|
| 0–3 | 4 bytes | magic: 49 4D 58 00 ("IMX" + zero byte) |
| 4–5 | uint16 | format version = 2 |
| 6–7 | uint16 | member count |
| per member | uint16 | UTF-8 member-name byte length |
| next | N bytes | UTF-8 filename |
| next | uint64 | absolute file byte offset |
| next | uint64 | payload byte length |
| after index | bytes | raw contiguous file payloads |

The independent parser validates count, table size, unique UTF-8 names, safe extraction paths, in-file ranges, lack of overlaps, trailing bytes, and member SHA256 when declared by manifest.json.

**This is a working binary file-index reader and extractor, not a learned portrait-to-avatar model generator or a license bypass.**

## Real file and test results

| Item | Expression 2 | Essence 2 |
|---|---:|---:|
| Public sample | wise-pup, A23WJF0199 | sofia-ramirez, A52DHS2219 |
| IMX bytes | 197,741,350 | 152,692,845 |
| IMX SHA256 | d2c70beaa48b73d40681366879599d4940f744b736105c030fe13c6852d626d9 | 62b289461d4f54797fae8ee1edb2ece4708aff0bea1f6a29dbc3cbf77e8df9ea |
| Member count | 17 | 31 |
| Header/index bytes | 1,111 | 1,108 |
| Index + all payload bytes | exact full file size | exact full file size |
| Member list vs official CLI | 17/17 matches | 31/31 matches |
| Member SHA256 verified | 4/4 passed | 30/30 passed |
| Actual single-file extraction | canon.bin | M.f32 |
| Official CLI open without credentials | PASS | PASS |

7/7 offline inspector unit tests also passed. GitHub Actions job completed successfully.

## Expression 2 IMX contents

- combined_litert.tflite: 158,524,428 bytes; Android LiteRT model (dominant payload)
- student_v4_forward_frame_cpuAndNE.mlpackage CoreML weights: 14,175,392 bytes
- dec_p2_v3_all.mlpackage CoreML weights: 12,599,328 bytes
- audiotokenizer_cpuAndNE.mlpackage CoreML weights: 6,225,728 bytes
- dec_p2_cpuAndNE.mlpackage CoreML weights: 4,909,504 bytes
- idle.mp4: 559,148 bytes
- canon.bin and canon.f32: 299,520 bytes each
- manifest.json: 2,346 bytes
- All other CoreML metadata and model descriptors are indexed individually.

Manifest records: family expression-2, engine expression2, decoder decp2v3, engine ABI 1, provenance student_kind w320jnt. The fact that the same IMX carries CoreML and LiteRT assets shows it packages data for multiple platform implementations, rather than the Android-only shared library.

## Essence 2 IMX contents

- P_hevc.mov (base face clip): 2,935,127 bytes
- a2x_enc_stream.onnx (audio to expression encoder): 20,755,566 bytes
- a2x_dec.onnx: 2,473,874 bytes
- model_b1_fp32.onnx and model_b24_fp32.onnx are listed as individual members.
- Includes pose/drive files M.f32, P.f16, pooled64.f16, drive/si.i32, drive/xs.f32, drive/xd.f32, motion template, mask_512.u8, mp4, CoreML assets and additional checkpoints.
- Manifest records H=1920, W=1080, NT=251, canvas fps 25, family essence-2, engine essence2-light, compose unified-mouth-v1.

Interpretation: this sample contains an existing driving-clip representation and separately learned audio-to-expression/face rendering components. This describes file contents and manifest keys only; it does NOT prove the model's final image quality or animation behavior.

## Android SDK binaries

| | Expression 2 | Essence 2 |
|---|---|---|
| Maven artifact | expression2-android:0.6.2 | essence2-android:0.10.3 |
| AAR bytes | 3,130,324 | 10,988,512 |
| Java/Kotlin top-level classes | 35 | 42 |
| Native libraries | libLiteRt.so, libexpr2jni.so | libc++_shared.so, libe2u_jni.so, lible_jni.so, libonnxruntime.so |
| Key API | Expression2Avatar.feed/pull, Expression2ModelStore | Essence2Avatar.feed/pull, Essence2ModelStore |
| Model inference backend | Android LiteRT | Android ONNX Runtime and JNI compositor |

Expression2 JNI libexpr2jni.so dynamically requires libLiteRt.so. Essence2 JNI lible_jni.so and libe2u_jni.so dynamically require libonnxruntime.so. These are actual ELF NEEDED relationships from readelf, not an inference from filenames.

## Reproduce independently

Install CLI by official instructions if an authoritative comparison is desired; open requires no API secret.

    bithuman open wise-pup.imx --json
    bithuman open sofia-ramirez.imx --json

Own parser (no CLI required):

    python3 tools/bithuman_deep/imx_v2.py wise-pup.imx --list-json
    python3 tools/bithuman_deep/imx_v2.py wise-pup.imx --verify
    python3 tools/bithuman_deep/imx_v2.py wise-pup.imx --extract canon.bin --output-dir ./model-elements
    python3 tools/bithuman_deep/imx_v2.py sofia-ramirez.imx --extract M.f32 --output-dir ./model-elements

Binary files are not committed to the repo. GitHub Actions analysis reports contain metadata and hashes only.

## Limits / next work

- The **file format and member extraction** have been verified against genuine public IMX binaries and official CLI.
- The SDK Kotlin and JNI method signatures are extracted; this does not mean the underlying closed-source inference routines were rewritten.
- Next step: use extracted .tflite/.onnx members to inspect actual tensor input/output signatures and compute graph composition.
- On-device rendering, lip-sync quality, performance, CPU fallback and authorization-free inference have not been demonstrated.
