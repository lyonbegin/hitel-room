# bitHuman Expression 2 — ARM64 NativeBridge Android Emulator verification

Test date: 2026-11-12 UTC.
Primary matrix: https://github.com/lyonbegin/hitel-room/actions/runs/43215154314
Extra images: https://github.com/lyonbegin/hitel-room/actions/runs/43216133474
Corrected follow-up workflow: https://github.com/lyonbegin/hitel-room/actions/runs/43216669792

## Confirmed principle

An ARM64 Android AVD cannot boot on the GitHub x86_64 QEMU host, but a Google APIs x86_64 AVD with libndk_translation can run ARM64 native library code within the app using a native bridge. These are different mechanisms.

Official Android Developers: https://android-developers.googleblog.com/2020/03/run-arm-apps-on-android-emulator.html
Independent OWASP MASTG: https://mas.owasp.org/MASTG/0x05b-Android-Security-Testing/

## Real results: exactly the same Expression 2 0.6.2 APK on each emulator

The APK is the official Android hello app with a read-only log probe inserted into onCreate. The probe calls System.loadLibrary("LiteRt") and System.loadLibrary("expr2jni") and checks explicit success markers in Logcat. It uses neither a user API secret nor the model inference API.

| API | Version | Target | APK install | LiteRt | expr2jni |
|---|---|---|---|---|---|
| 30 | Android 11 | Google APIs x86_64 | PASS | LOADED | LOADED |
| 31 | Android 12 | Google APIs x86_64 | PASS | LOADED | LOADED |
| 32 | Android 12L | Google APIs x86_64 | PASS | LOADED | LOADED |
| 33 | Android 13 | Google APIs x86_64 | INSTALL_FAILED_NO_MATCHING_ABIS | NOT TESTED | NOT TESTED |
| 33 | Android 13 | Google Play x86_64 | INSTALL_FAILED_NO_MATCHING_ABIS | NOT TESTED | NOT TESTED |
| 34 | Android 14 | Google APIs x86_64 | PASS | LOADED | LOADED |
| 35 | Android 15 | Google APIs x86_64 | PASS | LOADED | LOADED |
| 36 | Android 16 | Google APIs x86_64 | PASS | LOADED | LOADED |

The Android 13 result applies to the **specific emulator system images tested**, not every Android 13 implementation.

## Evidence

- Android 11: artifact https://github.com/lyonbegin/hitel-room/actions/runs/43215154314/artifacts/13943007826
- Android 12: artifact https://github.com/lyonbegin/hitel-room/actions/runs/43215154314/artifacts/13942574836
- Android 12L: artifact https://github.com/lyonbegin/hitel-room/actions/runs/43216669792/artifacts/13942953822
- Android 13 Google APIs: artifact https://github.com/lyonbegin/hitel-room/actions/runs/43215154314/artifacts/13943621678
- Android 13 Google Play: artifact https://github.com/lyonbegin/hitel-room/actions/runs/43216133474/artifacts/13943911394
- Android 14: artifact https://github.com/lyonbegin/hitel-room/actions/runs/43215154314/artifacts/13943826195
- Android 15: artifact https://github.com/lyonbegin/hitel-room/actions/runs/43215154314/artifacts/13943731401
- Android 16: artifact https://github.com/lyonbegin/hitel-room/actions/runs/43216669792/artifacts/13942688979

In successful runs the emulator reports ro.dalvik.vm.native.bridge=libndk_translation.so and an ABI list that includes arm64-v8a. Logcat records LOAD_OK:LiteRt and LOAD_OK:expr2jni, ending with ARM64_VENDOR_LIBRARIES_LOADED_ON_EMULATOR.

## Interpretation and limitations

- Native ARM64 library loading is directly proven for API 30, 31, 32, 34, 35, 36.
- The bridge does not emulate Qualcomm Hexagon NPU. No frames, lip sync, model inference or GPU/NPU performance were validated.
- The official SDK has identity model and credential dependencies that are independent of OS ABI translation.
- The first extra-images workflow jobs for Android 12L and 16 exited with shell code 2 AFTER successful native loads, because android-emulator-runner splits newline-separated scripts into separate sh -c processes. Corrected using a single shell invocation in commit 9e1c659. The corrected run 43216669792 finished with Android 12L SUCCESS, Android 16 SUCCESS, and Android 13 Google Play FAILURE for an expected ABI mismatch.
- Android 13 stock x86_64 images tested here reject the ARM64-only package. Consider Android 14 API 34 Google APIs x86_64 for repeatable further investigation, with API 30 and 35 as comparison targets.
- Reproduce using .github/workflows/bithuman-arm-translation-matrix.yml and tools/bithuman_audit/probe_emulator_native_bridge.sh.

The exact scope is native-library load and app lifecycle; do NOT label this as successful audiovisual rendering.
