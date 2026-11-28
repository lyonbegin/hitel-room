# HITEL Gallery Pocket TTS Korean 100M continuation

## Baseline and immutable requirements

- Original working Gallery source: 63d5a3d942a6198165508b1f14389c34ae5a083a.
- Upstream: google-ai-edge/gallery at 9cb31cf47c21b0ed76901ff589a52b509803edfa.
- Package: com.google.aiedge.gallery.
- Preserve existing SODA, Mobile Actions, Supertonic, XR, global ASR, original seven Pocket TTS languages and downloaded model paths.
- Korean model: seastar105/pocket-tts-korean-100m revision d5418f368ed97bc982ab80c5b639fe28f280636b.
- Do not add a separate TTS engine or substitute the Korean model with Supertonic.

## Verified evidence

- PKTW record structure: 46110206656; 169 tensor records.
- BF16 conversion + rowwise signed INT8: 46112454252.
- Korean PKTW SHA256: a674093429e1037fdedd8b8e1231d42e3f0329f4227f24566b98b7e833d6e452.
- Voice cache: BF16 layer-kv-time, six layers; the exact test sentence was recognized by independent Whisper ASR (CER 0) in 46112803024. This proves one Linux MediaPipe 1.2.3 test sentence, not all Korean text nor Android/ARM64.
- Direct eight-language container is rejected by native locale dispatch (Unsupported PocketTTS language: 'ko-KR'). Do not advertise direct native ko support.
- Integration uses a bundled Korean companion behind the SAME model ID and existing SDK; Kotlin maps Korean to the native en-US/alba slot of the isolated companion. Original model stays byte-for-byte unchanged. Only one native session is kept active.
- Public source integration/test commit: 777b074ce3dde077acd8c3f71c2a41ef11dd1e82.

## Fixed signing and test release

- Dedicated PRIVATE repo branch: lyonbegin/webrtcsignal build/hitel-gallery-fixed-signing-20261128.
- First fixed-signing build run: 46113484417. Confirm final job/step results and release before claiming an APK is downloadable.
- Private test signer backup release tag: hitel-gallery-private-debug-signing-v1 (private repo only). Never include the key bytes in public source, logs, APK releases, evidence, or chat. Anyone with read access to that private repo could access this backup; do not make the repo public. Development signer only, not production. Prefer migrating to a protected repository Secret when the required admin interface is available; preserve the identical key/certificate.
- Future builds must restore the same backup, verify certificate SHA256 before and after compilation, and fail on mismatch. Do not generate another signer automatically after this initial bootstrap.
- Existing installed APK may use the older ephemeral debug key. An unmatched old signer cannot be upgraded in place. One-time migration may be needed; no more uninstall/data clearing after fixed identity migration.
- Do not publish final APK unless actual Gallery Android English/Korean/English session test, independent Korean ASR, package and fixed signer checks pass. ARM64 real device remains separate from x86_64 emulator.
