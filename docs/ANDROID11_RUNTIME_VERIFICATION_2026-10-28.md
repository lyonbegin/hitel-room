# Communication SDK Android 11 실기 검증 (2026-10-28 KST)

## Railway production
- Service: HITEL-ROOM / hitel-communication-web
- Branch: feature/railway-android-sandbox-10min-20261025
- Web UI commit deployed SUCCESS: a48840df1ec9d49e798d458143bd371ee6b4a036
- RAILWAY_API_TOKEN variable registered; end-user token / pairing input removed

## KVM probe on actual Railway Sandbox
- Proof: https://github.com/lyonbegin/hitel-room/actions/runs/40535529395
- API response: `{"ok":true,"kvm":false,"result":"KVM_UNAVAILABLE\n"}`
- Probe Sandbox destroyed; subsequent status=deleted, sandboxId=null.
- Therefore existing Android 11 KVM checkpoint cannot be prepared on Railway Sandbox.

## Actual Android 11, HITEL APK and Native Bridge
- Proof: https://github.com/lyonbegin/hitel-room/actions/runs/40537245282
- Artifact (screenshot/logs): https://github.com/lyonbegin/hitel-room/actions/runs/40537245282/artifacts/12748543653
- GitHub ephemeral runner KVM: READY
- Android emulator OS version 11; boot completed in 33913 ms
- HITEL APK Gradle build and adb install: SUCCESS
- Android native activity: app.hitel.nativebridge/.MainActivity
- APP_STARTED: PASS
- WEB_LOADED /sdk-lab/device: PASS
- BRIDGE_PING_OK: PASS
- CAPABILITIES_OK: PASS
- Screen captured from actual ADB screencap: real-android11.png
- TTS_READY=false: TTS initialization not demonstrated

## Unverified / blocked scope
- Web-controlled, live noVNC Android from Railway Sandbox: BLOCKED by lack of guest KVM
- PSTN 16 scenarios, production WebRTC media, AI Counselor, third-party Play Store/APK installs, and 10-minute live emulator auto-deletion: NOT END-TO-END VERIFIED
- A KVM-capable on-demand Android execution host with live viewer routing is required, while keeping Railway web UI and no end-user authorization input.

Do not represent a saved screenshot or ordinary HTML as a live Android emulator.
