# bitHuman Expression 2 Android emulator — verified results

**Date:** 2026-11-12
**Source repository:** https://github.com/lyonbegin/hitel-room
**Branch:** \`feature/bithuman-expression2-imx-sdk-audit-20261112\`
**Run:** https://github.com/lyonbegin/hitel-room/actions/runs/43207466967
**Previous successful emulator setup replicated:** https://github.com/lyonbegin/webrtc/actions/runs/42797639420

## Summary / pass criteria

| Experiment | Observed verdict | Exact scope |
|---|---|---|
| Upstream Expression2 Android app, SDK 0.6.2 | PASS | Gradle assembleDebug; JVM unit tests |
| Android 15 Google APIs x86_64 KVM AVD | PASS | Emulator boot, adb install, MainActivity launch, expected "No API secret" UI |
| SDK native inference on x86_64 AVD | NOT TESTED | AAR/APK only package arm64-v8a native libraries. No x86_64 equivalents. SDK session was not created. |
| Android 11 Google APIs arm64-v8a AVD on x86_64 Ubuntu runner | BLOCKED | QEMU2 emulator explicitly rejects cross-architecture AVD before Android boots |
| Expression2 voice/lip-sync/head motion | NOT VERIFIED | No authorized SDK credential and no compatible Android ARM64 runtime |
| Real ARM64 Android phone | NOT TESTED | Requires available real test hardware and SDK access |

## Original x86_64 ADB evidence

- Job: \`android15-x86_64-proven-runner\` (job 131146165412), success.
- APK contained \`lib/arm64-v8a/...\` and **no** \`lib/x86_64/...\` native libraries.
- ADB reported:
  - \`ORIGINAL_APK_ARM64_LIBRARIES_CONFIRMED\`
  - \`APK_HAS_NO_X86_64_NATIVE_LIBS\`
  - \`Success\`
  - \`ADB_INSTALL_EXIT_CODE=0\`
  - \`ORIGINAL_SDK_SAMPLE_APK_INSTALLED\`
  - \`LAUNCHED_UI_WITH_NO_API_CREDENTIAL_EXPECTED\`
- Screenshot, UI XML, ADB properties, install output, logcat:
  https://github.com/lyonbegin/hitel-room/actions/runs/43207466967/artifacts/13938867875

**Interpretation:** Successful APK install + Java UI launch **does not demonstrate** that ARM64 \`libexpr2jni.so\` was loaded or executed on x86_64. The sample checks for its API secret before creating the avatar.

## Original ARM64 AVD evidence

- Job: \`android-arm64-system-image-experimental\` (job 131146165829), failure.
- Runner: Ubuntu 24.04 **x86_64** host, no hardware acceleration, Android API 30 \`google_apis/arm64-v8a\`.
- Emulator emitted: \`FATAL | Avd's CPU Architecture 'arm64' is not supported by the QEMU2 emulator on x86_64 host. System image must match the host architecture.\`
- The Android 11 ARM64 emulator **never booted**, so no APK installation and no SDK JNI execution occurred.
- The workflow subsequently showed \`Timeout waiting for emulator to boot\`.
- Log: https://github.com/lyonbegin/hitel-room/actions/runs/43207466967

## Consequences for the project

The verified emulator E2E method from November 10 remains valid for apps with x86_64 native dependencies. It confirms Java/Kotlin lifecycle, ADB install, screenshot/UI hierarchy, and crashes for this SDK's sample, but **cannot validate Expression 2's ARM64 native renderer**.

The SDK itself is obtainable and compiles, but native lip sync needs a **compatible ARM64 Android execution environment** and **valid vendor API credentials**. The next meaningful test must collect actual model initialization, first-frame time, FPS, RAM, offline expiry, lip-sync and head-motion output—not just a running Activity.

**Do not label these tests "rendering passed".** APK/UI success is a separate, narrower verdict.
