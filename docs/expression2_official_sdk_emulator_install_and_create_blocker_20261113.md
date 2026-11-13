# Expression 2 official SDK 0.6.2: original app installation on Android emulator (2026-11-13)

## Actual run and outcome

Original full-install CI: https://github.com/lyonbegin/hitel-room/actions/runs/43406900426

- Original app source: https://github.com/bithuman-product/bithuman-examples/tree/main/android/expression2-hello
- Official SDK dependency: `ai.bithuman:expression2-android:0.6.2`, unmodified vendor AAR SHA-256 `067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584`.
- Public model: Wise Pup / `A23WJF0199`, original IMX downloaded from the vendor's public endpoint; model contents stored in GitHub Actions cache and verified against the saved hashes.
- Android AVD: Android 14 / API 34, `x86_64, arm64-v8a` ABI list, `ro.dalvik.vm.native.bridge=libndk_translation.so`.
- APK built from actual official GitHub Android example, using vendor Gradle dependency and its original `Wav.kt`/sample audio.
- `adb install -r`: **Success**, native library in APK verified.
- `System.loadLibrary("expr2jni")`: **PASS** (original vendor unmodified ARM64 native library).
- Original model files pushed onto emulator and read from Android app storage: **PASS**, `combined_litert.tflite` 158,524,428 bytes / SHA-256 `f809722b65e933aacf2c577725e45aaba576fae84b4d17658d67d6d018a512ba`; `canon.bin` 299,520 bytes / SHA-256 `cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5`.
- `Expression2Model.combined(File,File)`: **PASS**, original SDK model object reports `modelBytes=158524428`.
- `Expression2Avatar.create(context, model, options)`: **CALLED, REJECTED**, exact category `ai.bithuman.expression2.Expression2Exception`; error states no API Secret, hence vendor cannot attribute rendering to an account.
- Model is present and readable; download, ABI, linkage, and local model construction are **not** the blocker on this emulator.
- Actual model inference, audio feed, frame pull, 20fps, and final video output: **NOT REACHED/NOT VERIFIED**. An app installing is NOT proof that the SDK renders.

## Test integrity change

Follow-on test commit `37977a0d0cdba95a63370028502eb9e02c2e4836` changes the CI verdict: an official `create()` refusal is a **failed full-render test** rather than a green success. Reproducing this result does not require any user installation or manual actions.

## Engineering next action

Original SDK rendering requires authorization through the SDK's documented session mechanism. A local model file, a successful native loader and constructed model object are insufficient to establish a rendering session. To continue without a vendor credential, an independent public-model engine can be tested separately, but it is not equivalent to declaring the official unmodified SDK running end-to-end. No fabricated success, mocked output, or undocumented bypass has been used.

## Second run: strict full-render verdict

[CI run 43407580595](https://github.com/lyonbegin/hitel-room/actions/runs/43407580595) reproduced all SDK installation/model/native library PASS stages. It then ended as **FAILURE** by design because `Expression2Avatar.create()` rejected the unauthenticated session. The actual SDK returned `Expression2Exception: refusing to serve: no API secret was found`. No real frame was returned. The corrected negative verdict and the logs are in CI artifact outputs. This distinguishes verified SDK model/library installation from unsuccessful original SDK rendering.
