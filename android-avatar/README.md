# HITEL S2 Android — on-device DH_live mini 2.0 avatar

Source project: https://github.com/kleinlee/DH_live
Pinned DH_live commit: 4467e97cd97194c2c54762043cf121c6d313db12 (2026-08-16)
Current scope: Android debug APK, local generated-avatar preview and **WebRTC self-loopback only**.

## Pipeline

1. Android WebViewAssetLoader serves app contents via a secure local HTTPS origin.
2. A Git-SHA-verified DH_live mini 2.0 WASM + JS bundle and a public example avatar are placed in APK assets during the build.
3. The engine loops an original muted avatar video and synthesizes speech-dependent changes to the face using WASM + WebGL.
4. When the engine is genuinely ready, the page obtains canvas.captureStream(25).
5. Two RTCPeerConnection objects perform offer/answer and ICE in this same device without a signaling or media server. The received ontrack stream is rendered as a separate video overlay, not substituted with the source canvas.
6. Test WAV/audio input is sent through Module._setAudioBuffer, the actual model ingestion path.

On first visit the default example avatar is used. For your own video interview, prepare an avatar pack with the original DH_live mini preprocessing tools and import a ZIP containing exactly two files at the archive root:

- 01.mp4
- combined_data.json.gz

**Source video requirement:** DH_live mini's preparation script rejects video with substantial speaking mouth motion. Extract 5–30 seconds of neutral/closed-mouth footage from the interview or capture a separate short neutral clip.

## Building

Open the android-avatar directory in Android Studio with Android SDK 36, AGP 9.0, JDK 17 and Python 3 installed. The Gradle preBuild task automatically runs tools/sync_dhlive.py, fetching nine pinned and verified assets from public GitHub. Network access is required **at build time only**; first-launch runtime assets are bundled.

For CLI on a configured build computer:

    cd android-avatar
    gradle :app:assembleDebug

On this feature branch, the Android APK GitHub Actions workflow stores app-debug.apk as artifact "hitel-s2-android-avatar-debug".

## Test plan

- Cold start: confirm "실제 DH_live mini 아바타 엔진 초기화 완료", then the WebRTC self-stream automatically connects and shows "WebRTC 실제 수신 영상".
- Audio: click "테스트 음성 실행" and visually confirm the mouth animates in sync with actual WAV playback.
- Personal avatar: import a prepared ZIP and verify new avatar, then local WebRTC reconnect.
- Monitor 25FPS, WASM startup time, memory and audio/video sync on real devices.

## Current limits

- This is a **developer proof-of-concept**. No Android APK installation or real-phone performance test has yet been verified by this source commit.
- Bundled sample model/voice/face are from upstream; upstream code README mentions MIT but web avatars and logo/watermark require additional authorization for commercial use. Do not commercially distribute this experimental build before model/asset license review.
- The upstream WASM lacks complete matching published buildable C++ source. Independent native reconstruction is a separate phase.
- No remote user connection, external signaling, interview recorder, production authentication, TTS text service, or real-time microphone-to-WASM adapter in this first stage.
- Audio file playback uses WAV bytes directly; additional formats may be rejected by the vendor WASM.
- Browser and Android WebView must expose captureStream and RTCPeerConnection. The UI shows a clear error when they are absent.
