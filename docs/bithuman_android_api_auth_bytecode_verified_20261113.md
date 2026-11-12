# bitHuman Android API credential, metering and frame-gate reverse engineering

Date: 2026-11-13 KST (GitHub Actions UTC 2026-11-12).
Verification run: https://github.com/lyonbegin/hitel-room/actions/runs/43323736373
AAR class bytecode JSON/Markdown: https://github.com/lyonbegin/hitel-room/actions/runs/43323736373/artifacts/13991028556
Read-only analyzer: tools/bithuman_deep/audit_android_auth.py
Workflow: .github/workflows/bithuman-android-auth-audit.yml

## Verification conditions and limits

Read-only inspection of genuine published Maven AAR archives. JDK 17 javap read private and public Kotlin/JVM class methods, bytecode calls, constant-string names and class relationships. No secrets were used, no session with the vendor backend was opened and no modified library was made. This verifies code paths, not network responses, server behavior, or whether a vendor SDK session would run on a specific device.

| SDK | Version | AAR bytes | AAR SHA256 |
|---|---|---:|---|
| Expression 2 | 0.6.2 | 3,130,324 | 067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584 |
| Essence 2 | 0.10.3 | 10,988,512 | 49bdeafc6a29675058851c5f7336dacaa0518d5af5bc6130eece96af73513e67 |

## Source-confirmed distinctions

1. **Model contents / acquisition**: the publicly distributed Wise Pup and Sofia Ramirez sample IMX containers can be downloaded and independently parsed without an API secret. Expression2ModelStore and Essence2ModelStore separately contain MeteredDoorResolver and PublicMirrorResolver strategies. A public/mirror model acquisition path does **not** establish permission to render with the official SDK.
2. **Credential setter**: Expression2Credential.set(...) calls Expression2CredentialStore.setSecret(...); Essence2Credential.set(...) likewise calls Essence2CredentialStore.setSecret(...). Both stores use a JVM static volatile String field, not an IMX decryption key.
3. **Expression 2 session creation**: Expression2Avatar$Companion.create(...) calls MeterHost.arm(model), then createEngine(...), associating a SelfHostMeter session with the avatar. If engine creation fails, abandonment is handled.
4. **Expression 2 per-frame checks**: Expression2Avatar.pull(Bitmap) and pull(ByteBuffer) invoke SelfHostMeter.noteObserved, MeterHost.gate, SelfHostMeter.withholds and then native pullToBitmap/pullToBuffer, followed by SelfHostMeter.noteFrames. The session condition is therefore checked in the frame retrieval path, not just at Gradle build or model-download time.
5. **Essence 2**: internally uses package ai.bithuman.elevate (not necessarily the public ai.bithuman.essence2 name in the sample). E2UAvatar$Companion.create(...) calls SelfHostMeter$Companion.arm(...), and has MeteringRefused error handling. E2UAvatar contains private gate() and pull(ByteBuffer), with a SelfHostMeter.withholds reference in the frame path. Essence2ModelStore$MeteredDoorResolver calls Essence2Credential.current and SelfHostMeter$Companion.resolveCredential.
6. **HTTP and persistent metering**: Both archives contain HttpBeatSink.validate(...), beat(...), validateWithBody(...), beatWithBody(...) and private post(...). The Java implementation uses HttpURLConnection and Authorization-related request setup; MeterLedger stores local usage records, SelfHostMeter keeps session/validation and retry/refusal state. These code-level facts do not prove specific undocumented server request body contents or acceptance behavior.
7. **Server-side REST validity** (documentation): POST https://api.bithuman.ai/v1/validate with api-secret request header; valid boolean indicates accept/reject. This REST path is separate from the app's wrapper class and should not be confused with mere successful local Credential.set(...).

## Verified call flow overview

Expression 2:

    Expression2Credential.set(secret)
         -> Expression2CredentialStore.secret (volatile JVM field)
         -> Expression2ModelStore.MeteredDoorResolver (if default metered download)
         -> Expression2Avatar.create(...)
              -> MeterHost.arm(model) -> SelfHostMeter session
              -> createEngine(...)
         -> Expression2Avatar.feed(pcm)
         -> Expression2Avatar.pull(frame)
              -> SelfHostMeter.noteObserved()
              -> MeterHost.gate(...)
              -> SelfHostMeter.withholds()
              -> native frame pull
              -> SelfHostMeter.noteFrames()
         -> close() -> SelfHostMeter.stop()

Essence 2:

    Essence2Credential.set(secret)
         -> Essence2CredentialStore.secret (volatile JVM field)
         -> Essence2ModelStore.MeteredDoorResolver
         -> E2UAvatar.create(...) -> SelfHostMeter.arm(...) / MeteringRefused
         -> E2UAvatar.feed(...) -> E2UAvatar.pull(...)
              -> private gate()/SelfHostMeter.withholds()
              -> native frame operation

This map intentionally omits internal conditional patch points, secret extraction procedures and forged server responses; it documents supported call flow and refusal boundaries.

## Practical consequence for the public sample IMX project

- IMX file reading and running extracted TFLite/ONNX graphs with an independent runtime do not require bitHuman SDK Credential.set. Independent Expression2 model execution was separately verified by the project.
- The genuine official Android SDK carries its own authentication/session/metering requirements even when the same public IMX is locally present. Merely deleting a key prompt in the example application's Activity does not demonstrate a working official SDK session.
- The vendor docs state that offline continuation is up to five minutes *after* an authenticated session starts; it is not evidence of unlimited unauthenticated sessions.
- To validate the real official SDK's streaming speed and correctness, the controlled positive case needs a valid authorized API secret. This report has not performed such a positive test; no secret was supplied.
- To avoid a false pass, always distinguish: (A) PUBLIC IMX EXTRACT, (B) INDEPENDENT MODEL INFERENCE, (C) OFFICIAL SDK AUTHENTICATED SESSION, (D) REAL-TIME FPS AND A/V SYNC.
- There is no basis here to claim that the official SDK's server-side authorization is removable by local configuration. Do not label a modified sample app or a successful JVM setter as proof that authentication was accepted.

## Grounded primary sources

- https://docs.bithuman.ai/platforms/android
- https://docs.bithuman.ai/platforms/android/troubleshooting
- https://docs.bithuman.ai/platforms/android/reference
- https://docs.bithuman.ai/start/api-secret
- https://github.com/bithuman-product/bithuman-examples/tree/main/android/expression2-hello
- https://github.com/bithuman-product/bithuman-examples/tree/main/android/essence2-hello

## Verification status

- Read-only real AAR authentication code-flow inspection: **PASS** both SDKs.
- Public IMX direct acquisition without API Secret: **PASS** (existing CI runs).
- Real official SDK authenticated session: **NOT TESTED**, no valid credential provided.
- Real official SDK unauthenticated accepted session: **NOT DEMONSTRATED**.
- Any ability to bypass vendor metering or server authorization: **NOT CLAIMED OR TESTED**.
