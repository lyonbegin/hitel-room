# Expression 2 vs Essence 2: native Android emulator parity test

## Correction to research scope

The user's goal is photorealistic animation of a real person's portrait. Therefore **Essence 2 must be tested, not Expression 2 alone**. Both SDKs are run against the same Android emulator verification script on the same GitHub Actions workflow.

## Versions and known limitations

| Property | Expression 2 | Essence 2 |
|---|---|---|
| Maven coordinate | ai.bithuman:expression2-android:0.6.2 | ai.bithuman:essence2-android:0.10.3 |
| Source sample | android/expression2-hello | android/essence2-hello |
| App package | com.example.x2hello | com.example.e2hello |
| Avatar agent | A23WJF0199 (Wise Pup) | A52DHS2219 (Sofia Ramirez) |
| Android minimum API | 26 | 29 |
| Native supported ABI | arm64-v8a | arm64-v8a |
| Audio input | 16kHz mono float32 | 16kHz mono PCM16 LE |
| Output | 416x720 @ 20 fps | up to 1080p @ 25 fps |
| Identity download | ~160MB | 226–281MB |
| API credential | required to render | required to render |

Official docs: https://docs.bithuman.ai/platforms/android

## Test matrix

GitHub Actions workflow \`.github/workflows/bithuman-emulator-real-e2e.yml\` now runs 4 jobs in a 2x2 matrix:

1. Expression 2 × API35 Android 15 x86_64 emulator
2. Essence 2 × API35 Android 15 x86_64 emulator
3. Expression 2 × API30 Android 11 ARM64 emulator (experimental, software CPU emulation)
4. Essence 2 × API30 Android 11 ARM64 emulator (experimental, software CPU emulation)

The emulator evidence includes APK SHA256, APK included ABI libraries, adb install stdout, ro.product.cpu.abi, UI hierarchy, launch activity, filtered logcat and screenshot when accessible.

**Do not label an x86_64 APK install or screen display as successful native rendering.** Both official SDKs are ARM64-only; in the no-key test the app may show the "No API secret" message before invoking the JNI library. Rendering still requires a real ARM64 phone and a legitimate vendor API credential.

ARM64 AVD may fail to boot due to software-emulation limitations on hosted Linux. Failure of an AVD to boot does not prove the SDK fails on a real ARM64 phone.

## Runtime quality gate (not completed by these no-key CI jobs)

A complete native-rendering pass requires a physical ARM64 device and vendor credentials. For each model, record identity-model download/verification, engine initialization time, first video frame after audio feed, achieved fps, audio/video lip-sync offset, generated head motion, 10-minute memory usage and crash-free rendering. Avoid committing API secrets to Gradle-generated BuildConfig or public repositories.
