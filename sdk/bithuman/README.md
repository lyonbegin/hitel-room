# HITEL bitHuman Flutter source integration (NO APK)

**Status (2026-11-16): source committed; Kotlin/Android integration compile PASS; user-device inference unverified.**

## Provenance

- **Original Flutter source:** https://gitlab.com/bithuman/sdk/homebrew-bithuman, tag `flutter-plugin-v2.6.40`, commit `9417e7c2d44dd4437bf1129cbc3f54921e1d7234`.
- **Vendored source:** `sdk/bithuman/flutter-plugin`, preserving upstream Apache-2.0 `LICENSE` and the original Dart, Kotlin, iOS and macOS code.
- **Original Expression 2 SDK:** bitHuman `expression2-android:0.6.2` byte-reassembled AAR, SHA-256 `2529f8f0a064b4c8e8a1bb6f5fdd4627143ba4e09e05bd506bee1540e68e1527`. Existing GitHub Actions run `43546359857`, artifact `expression2-original-bytecode-and-arm64-reassembled-aar` (ID `14094272006`). The original vendor AAR and native JNI bytes are not committed to this repository.
- **Source-only Kotlin CI:** https://github.com/lyonbegin/hitel-room/actions/runs/43801571568 (PASS, `:bithuman:compileDebugKotlin`; **no APK generated**).

## Exact source modifications

Only **four** Flutter plugin files differ from the official tagged source. The verified upstream file SHA-256 guards are in `tools/bithuman_deep/flutter_original_expression2/vendor_original_flutter_source.py`.

1. `android/build.gradle`: replace the official `ai.bithuman:expression2-android:0.6.1` dependency with the local coordinate `ai.hitel.reassembled:expression2-android:0.6.2` and add Qualcomm QNN LiteRT delegate/runtime 2.49.0. Original Essence 2 dependency remains unchanged. A local Maven repository is configured at the **consuming application's** `android/local-sdk-maven`.
2. `android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt`: call `Expression2RouteSelector.create(context, model)` in the existing `loadInOrder` credential+entitlement flow rather than using default engine creation. Existing fetch/door/meter/session/security code is intact.
3. `android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt`: log `ROUTE_FIRST_FRAME_PASS` on the first actual original output frame. Existing streaming feed/pull and Flutter Texture renderer remain intact.
4. **New** `android/src/main/kotlin/ai/bithuman/flutter/Expression2RouteSelector.kt`: device+model capability and backend selection through original `Expression2Options` and `Expression2Avatar.create`.

## Runtime accelerator selection

The source reads `Build.SUPPORTED_ABIS`, `Build.SOC_MODEL`, `Build.SOC_MANUFACTURER`, Vulkan availability and the **extracted** native libraries under `applicationInfo.nativeLibraryDir`; it never concludes that a model can run on GPU just from the phone name or Vulkan support.

- Adreno GPU: require extracted `libQnnGpu.so` and `libQnnTFLiteDelegate.so`; request **original** `Routing.GPU_DECODER` + `QNN_OPTIONS_ADRENO_FP32` + strict `Accelerator.NPU`.
- Hexagon HTP NPU: require delegate and `libQnnHtp*` libraries; request **original** `Routing.HTP_DECODER` + `DEFAULT_QNN_OPTIONS` + strict `Accelerator.NPU`.
- CPU: request original `Routing.ALL_CPU` + `Accelerator.CPU`.

An original QNN engine-create failure tries the next backend. The first successful backend is cached per Android fingerprint, SDK, model and detected QNN library availability. Backend creation and **actual first pulled frame** are recorded as separate log events; GPU inference success cannot be claimed from a successful code compile or native library presence.

## Integrating this source in the user's own Flutter app

1. Declare the plugin as a local path dependency, e.g. `bithuman: { path: ../../sdk/bithuman/flutter-plugin }` in `pubspec.yaml` using standard YAML nesting.
2. Use the already verified original AAR from run `43546359857`; install its **unaltered bytes** under `android/local-sdk-maven/ai/hitel/reassembled/expression2-android/0.6.2/expression2-android-0.6.2.aar` with an `aar` Maven POM for group `ai.hitel.reassembled`.
3. In `android/app/build.gradle.kts`, use `minSdk = 29`, `ndk { abiFilters += "arm64-v8a" }`, and **`packaging { jniLibs { useLegacyPackaging = true } }`**. Extracted native libraries are required for bitHuman's original QNN delegate lookup.
4. The real product still calls `BithumanAvatar.load(agentCode, engine: 'expression2', apiSecret: authorizedSecret)` and displays `Texture(textureId: avatar.textureId)`. No Hello app, substitute inference engine or synthetic credential is involved.
5. Use Android logcat tag `BH_EXPR2_DEVICE_ROUTE`. Distinguish `DEVICE_CAPABILITIES`, `ROUTE_CREATE_BEGIN`, `ROUTE_CREATE_PASS/FAIL`, and `ROUTE_FIRST_FRAME_PASS`.

**Not yet proven:** Adreno GPU decoder compilation and frame generation on the user's Galaxy Z Fold, performance vs Hexagon and CPU on that device, and sustained frame timing. This source-only CI was not a physical-device test. The original vendor authorization and commercial usage terms still apply.
