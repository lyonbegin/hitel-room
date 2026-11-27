# HITEL Gallery — designated development baseline (2026-11-28 KST)

User-designated continuation baseline: the Gallery Global ASR build, incorporating the previous local SODA and Mobile Actions local model import features.

- Branch: `build/gallery-global-asr-20261128`
- Designated source commit: `9a67c6b8a841e19b850d76b95ef8afe27f8ba3a8`
- Build: https://github.com/lyonbegin/hitel-room/actions/runs/46046719329
- Upstream Gallery: `9cb31cf47c21b0ed76901ff589a52b509803edfa`
- Package: `com.google.aiedge.gallery`
- Expected APK: `HITEL_Gallery_Global_ASR.apk`

All subsequent Gallery changes must start from the designated source (or its verified descendants), preserve local SODA Korean/English pack import, the shared global ASR settings, Mobile Actions local LiteRT-LM model import and existing XR/TTS behavior. Do not revert to older independent testers or older Gallery branches without explicit instruction.

## Signing and data continuity
Existing app/model data must be preserved. Check package identity and signing certificate SHA-256 before recommending any in-place installation. The designated build was still compiling when this record was made. A reusable matching private signing key has NOT been confirmed or retained. This record designates the source baseline, not a recovered signing key. Do not claim matching signature until verified. Do not instruct the user to uninstall or clear app data as a workaround.

## Validation
Only source integration/preflight and build environment setup were confirmed when this record was made. Check final build, signature, release assets and tests before labeling a release verified.
