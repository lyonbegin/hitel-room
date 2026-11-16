# Actual unmodified bitHuman Flutter app and plugins source audit

Official app source: https://github.com/bithuman-product/bithuman-examples/tree/main/app/avatar_chat
Official plugin source: https://gitlab.com/bithuman/sdk/homebrew-bithuman
App commits: fea69e72515af7d05f384a9d2147ac0cc181b411

Flutter plugin tag commits:
flutter-plugin-v2.6.37 590299fa8ed710803ea291d77d4f4d33ca30b5e0
flutter-plugin-v2.6.40 9417e7c2d44dd4437bf1129cbc3f54921e1d7234

Original app requests flutter-plugin-v2.6.37; v2.6.40 is separate comparison.
Every tracked file was compared byte-for-byte with the original checkout. No replacement GPU logic, SDK patch, key or APK added to these source trees.

## avatar_chat (49 matching lines)

- lib/main.dart:154 | const _engineSlug = String.fromEnvironment('BH_ENGINE', defaultValue: 'expression2');
- lib/main.dart:202 | final _input = TextEditingController();
- lib/main.dart:203 | final _keyInput = TextEditingController();
- lib/main.dart:435 | final k = _keyInput.text.trim();
- lib/main.dart:559 | final t = _input.text.trim();
- lib/main.dart:561 | _input.clear();
- lib/main.dart:595 | ? _RefusalView(refusal: _refusal!, needsKey: _needsKey, controller: _keyInput,
- lib/main.dart:655 | controller: _input,
- lib/main.dart:708 | decoration: InputDecoration(
- lib/main.dart:711 | border: const OutlineInputBorder(),

## plugin_2_6_37 (320 matching lines)

- CHANGELOG.md:823 | 'libQnnTFLiteDelegate.so' is present.
- android/build.gradle:3 | // The engines are the PUBLISHED 'ai.bithuman:expression2-android' and
- android/build.gradle:26 | // The Qualcomm Hexagon NPU delegate + runtime (com.qualcomm.qti:qnn-litert-delegate and
- android/build.gradle:122 | implementation 'ai.bithuman:expression2-android:0.6.1'
- android/build.gradle:194 | // 0.8.0 (2026-09-26): useHardwareBuffers takes up to 32 slots (was 16), which the zero-copy
- android/build.gradle:212 | // 0.9.2 (2026-10-02, maven.bithuman.ai only): ADAPTIVE 720p WHILE THROTTLED. On a phone that caps its GPU
- android/build.gradle:219 | // its compiled GPU programs per device + driver and prepares the teeth data during the credential check; Flip5:
- android/build.gradle:244 | // The Hexagon (QNN) delegate opens its libraries by PATH from the app's native-library
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:8 | //   expression-2 ('ai.bithuman:expression2-android')  20 fps, 416x720 portrait.
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:34 | import ai.bithuman.expression2.Expression2Avatar
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:48 | * essence2-android 0.8.0): [bitmap] is a HARDWARE bitmap over the GPU buffer the engine rendered
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:126 | class Expression2Engine(private val avatar: Expression2Avatar) : AvatarEngine {
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:130 | override val fps = Expression2Avatar.FRAMES_PER_SECOND
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:143 | * [Expression2Avatar.idleLoop] ('idleLoopUnavailableReason' says why; BithumanPlugin logs it once at
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:217 | * three times on the CPU: the SDK reads the finished frame back from the GPU into a ByteBuffer
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:220 | * times a second. With 'useHardwareBuffers' the GPU renders straight into a HardwareBuffer,
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:225 | override val hardwareFrames: Boolean = zeroCopy && runCatching { avatar.useHardwareBuffers(HW_SLOTS) }
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:394 | val hf: Essence2HardwareFrame? = if (hardwareFrames) avatar.pullHardwareBuffer() else null
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:475 | val bmp = Bitmap.wrapHardwareBuffer(hf.buffer, SRGB) ?: run { hf.close(); return null }
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:528 | val hf = avatar.idleHardwareBuffer() ?: return null
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:529 | val bmp = Bitmap.wrapHardwareBuffer(hf.buffer, SRGB) ?: run { hf.close(); return null }
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:8 | // Engines: expression-2 through the published 'ai.bithuman:expression2-android' AAR and
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:20 | // frames (a Flutter SurfaceProducer) and the channel glue around it.
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:34 | import ai.bithuman.expression2.Expression2Avatar
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:57 | import io.flutter.view.TextureRegistry
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:74 | private lateinit var textureRegistry: TextureRegistry
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:103 | val entry: TextureRegistry.SurfaceProducer,
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:149 | * with zero-copy delivery, a GPU draw of the engine's own buffer: a hardware Bitmap needs
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:151 | * a Surface connects to one producer API, CPU or GPU.
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:166 | val canvas = try { if (hwCanvas) surface.lockHardwareCanvas() else surface.lockCanvas(null) } catch (e: Exception) {
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:198 | private fun newTexture(): Pair<TextureRegistry.SurfaceProducer, TextureGate> {
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:199 | val entry = textureRegistry.createSurfaceProducer()
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:205 | entry.setCallback(object : TextureRegistry.SurfaceProducer.Callback {
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:238 | textureRegistry = binding.textureRegistry
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:262 | * ImageReaderSurfaceProducer.onImage ("FlutterJNI is not attached to native").
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:421 | // ★ A SurfaceProducer, not a SurfaceTexture. Under Impeller (Vulkan, the
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:427 | // ImageReader whose buffers Impeller imports as they are. The draw is unchanged: the
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:521 | try { Expression2Avatar.create(context, model) } catch (e: Exception) {

## plugin_2_6_40 (324 matching lines)

- CHANGELOG.md:983 | 'libQnnTFLiteDelegate.so' is present.
- android/build.gradle:3 | // The engines are the PUBLISHED 'ai.bithuman:expression2-android' and
- android/build.gradle:26 | // The Qualcomm Hexagon NPU delegate + runtime (com.qualcomm.qti:qnn-litert-delegate and
- android/build.gradle:122 | implementation 'ai.bithuman:expression2-android:0.6.1'
- android/build.gradle:194 | // 0.8.0 (2026-09-26): useHardwareBuffers takes up to 32 slots (was 16), which the zero-copy
- android/build.gradle:212 | // 0.9.2 (2026-10-02, maven.bithuman.ai only): ADAPTIVE 720p WHILE THROTTLED. On a phone that caps its GPU
- android/build.gradle:219 | // its compiled GPU programs per device + driver and prepares the teeth data during the credential check; Flip5:
- android/build.gradle:244 | // The Hexagon (QNN) delegate opens its libraries by PATH from the app's native-library
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:8 | //   expression-2 ('ai.bithuman:expression2-android')  20 fps, 416x720 portrait.
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:34 | import ai.bithuman.expression2.Expression2Avatar
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:48 | * essence2-android 0.8.0): [bitmap] is a HARDWARE bitmap over the GPU buffer the engine rendered
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:126 | class Expression2Engine(private val avatar: Expression2Avatar) : AvatarEngine {
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:130 | override val fps = Expression2Avatar.FRAMES_PER_SECOND
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:143 | * [Expression2Avatar.idleLoop] ('idleLoopUnavailableReason' says why; BithumanPlugin logs it once at
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:217 | * three times on the CPU: the SDK reads the finished frame back from the GPU into a ByteBuffer
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:220 | * times a second. With 'useHardwareBuffers' the GPU renders straight into a HardwareBuffer,
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:225 | override val hardwareFrames: Boolean = zeroCopy && runCatching { avatar.useHardwareBuffers(HW_SLOTS) }
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:394 | val hf: Essence2HardwareFrame? = if (hardwareFrames) avatar.pullHardwareBuffer() else null
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:475 | val bmp = Bitmap.wrapHardwareBuffer(hf.buffer, SRGB) ?: run { hf.close(); return null }
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:528 | val hf = avatar.idleHardwareBuffer() ?: return null
- android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt:529 | val bmp = Bitmap.wrapHardwareBuffer(hf.buffer, SRGB) ?: run { hf.close(); return null }
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:8 | // Engines: expression-2 through the published 'ai.bithuman:expression2-android' AAR and
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:20 | // frames (a Flutter SurfaceProducer) and the channel glue around it.
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:34 | import ai.bithuman.expression2.Expression2Avatar
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:57 | import io.flutter.view.TextureRegistry
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:74 | private lateinit var textureRegistry: TextureRegistry
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:103 | val entry: TextureRegistry.SurfaceProducer,
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:149 | * with zero-copy delivery, a GPU draw of the engine's own buffer: a hardware Bitmap needs
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:151 | * a Surface connects to one producer API, CPU or GPU.
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:166 | val canvas = try { if (hwCanvas) surface.lockHardwareCanvas() else surface.lockCanvas(null) } catch (e: Exception) {
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:198 | private fun newTexture(): Pair<TextureRegistry.SurfaceProducer, TextureGate> {
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:199 | val entry = textureRegistry.createSurfaceProducer()
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:205 | entry.setCallback(object : TextureRegistry.SurfaceProducer.Callback {
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:238 | textureRegistry = binding.textureRegistry
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:262 | * ImageReaderSurfaceProducer.onImage ("FlutterJNI is not attached to native").
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:421 | // ★ A SurfaceProducer, not a SurfaceTexture. Under Impeller (Vulkan, the
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:427 | // ImageReader whose buffers Impeller imports as they are. The draw is unchanged: the
- android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt:522 | try { Expression2Avatar.create(context, model) } catch (e: Exception) {

Interpretation: BH_ENGINE in the original app selects Expression2 versus Essence2, not GPU versus HTP. Flutter display GPU HardwareBuffer and original AI model inference backend must be considered separately. Source grep absence cannot prove no internal SDK automatic routing.
