# HITEL Expression 2 — independent drop-in Android SDK (candidate)

This Android library is the SDK replacement target for the *unchanged*
[bithuman-product/bithuman-examples/android/expression2-hello](https://github.com/bithuman-product/bithuman-examples/tree/main/android/expression2-hello)
sample application. The canonical app's Activity, layout, bundled speech WAV,
audio playback and asset sources are not rewritten.

The original sample uses four public classes:
- Expression2Credential.set(String)
- Expression2ModelStore(Context).fetch(String)
- Expression2Options()
- Expression2Avatar.create(Context, model, options), feed, flushTail, pull,
  newFrameBitmap, hasPendingTail, queuedFrames, close, FPS, sample rate

Here those names are provided in an independently compiled Android library.
No published bitHuman expression2-android AAR or proprietary libexpr2jni.so is
loaded or packaged. The audio preprocessor and canonical history setup link
from the original-vector-verified native C++ source in
sdk/expression2-verified-core. The public Wise Pup model is downloaded via
the public showcase endpoint and checked against a known SHA-256; only
A23WJF0199 model loading is currently supported.

The Android model runtime uses the public IMX embedded TFLite signature
graph (enc, tok14, step, dec16, dec8). This is the model's actual runtime
type, not a new app. The renderer is *inside the replacement SDK* and is
called by the original app. It consumes the original app's real WAV PCM,
not synthetic tones or a separate test Activity.

## Verification boundary

The native preprocessing and Canon initialization functions are bitwise
original-vector-verified. The complete audio window overlap behavior,
timing, shape/state continuity and frame parity are **NOT original-equivalent
verified**. The initial candidate uses 44,000-sample model windows and
25,600-sample advancement, retaining 53 initial frames and up to 32 later
frames. These policies are **not proven exact** and are subject to removal
once the original scheduler equivalence tests resolve them.

The original sample application has a mandatory BuildConfig API-secret
blank check. A full run of the *original unmodified app source* therefore
requires a nonempty value at build time; a self-hosted SDK-only sentinel
can satisfy the sample's local check without authenticating to bitHuman,
but it is **not** a real bitHuman credential and must never be represented
as one. The local replacement SDK never sends credentials to the vendor.

Compilation/installation alone is not proof of successful model frames.
The CI workflow separately tracks SDK AAR, original-app APK, emulator
launch, generated frames, and output correctness; failures stay failures.
