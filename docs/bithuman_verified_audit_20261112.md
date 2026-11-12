# bitHuman Expression 2: verified GitHub Actions findings

Verified at: 2026-11-12 11:04–11:05 UTC
Branch: feature/bithuman-expression2-imx-sdk-audit-20261112
Successful workflow: https://github.com/lyonbegin/hitel-room/actions/runs/43205827186
Metadata artifact: https://github.com/lyonbegin/hitel-room/actions/runs/43205827186/artifacts/13936878598
Build proof artifact: https://github.com/lyonbegin/hitel-room/actions/runs/43205827186/artifacts/13937881804

## Real files retrieved by the runner

- Official public wise-pup sample IMX: 197,741,350 bytes; SHA256 d2c70beaa48b73d40681366879599d4940f744b736105c030fe13c6852d626d9.
- Its first 4 bytes: 49 4d 58 00 ("IMX\\0"). This file is NOT a standard ZIP archive. Further parsing using the official CLI or a separately documented container parser is necessary.
- Expression 2 version 0.6.2 AAR: 3,130,324 bytes; SHA256 067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584.
- AAR structure: 10 entries, 8,910,905 total uncompressed bytes.
- classes.jar: 277,910 bytes. The static audit enumerated 35 top-level ai.bithuman.expression2 classes.
- jni/arm64-v8a/libLiteRt.so: 5,508,376 bytes, 694 exported symbols.
- jni/arm64-v8a/libexpr2jni.so: 1,188,304 bytes, 2,021 exported symbols.
- These numbers refer to individual shared libraries in the AAR, NOT all runtime transitive dependencies and not the required memory footprint.
- POM dependencies: org.jetbrains.kotlin:kotlin-stdlib:2.0.21 (compile); com.qualcomm.qti:qnn-litert-delegate:2.49.0 and com.qualcomm.qti:qnn-runtime:2.49.0 (runtime).
- Examples of observed Java class names: Expression2Avatar, Expression2ModelStore, Expression2Credential, Expression2Metering, Expression2Backend, Expression2IdleLoop, DecoderContextCache, Native.

## Android compilation evidence

The official Android example was fetched from public GitHub, and its SDK dependency changed from 0.6.1 to 0.6.2 for the experiment. On an Ubuntu GitHub Actions runner with Java 17 and Android platform 35, Gradle completed :app:assembleDebug and :app:testDebugUnitTest successfully ("BUILD SUCCESSFUL in 1m 25s").

No vendor API key was supplied. A working lip-sync session, actual Android phone installation, audio/video synchronization, offline behavior, account authorization and model generation were NOT validated by this compile-only check.

## Engineering conclusions

1. A usable Expression 2 Android AAR and a sample per-person IMX are publicly retrievable; no extraction from a retail APK is required for initial static inspection.
2. AAR contains a JNI bridge and a LiteRT library; additional Qualcomm NPU implementation dependencies are declared separately by Maven POM.
3. The proprietary IMX container must be decoded or inspected with the vendor's documented unauthenticated CLI open command; a ZIP listing alone cannot reveal its internal files.
4. Class names and library symbols are useful audit leads, not the cloud photo-to-IMX training pipeline.
5. For full runtime constraints, use a physical arm64 Android device and valid vendor credentials. Keep that runtime test separate from this static result.

## Next research step

Run the official CLI open --json against a copied public IMX and record the model family, manifest entries, and container tables. Do not infer unseen internal format from the file extension or visible header alone.
