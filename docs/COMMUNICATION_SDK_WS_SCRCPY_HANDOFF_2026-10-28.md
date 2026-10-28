# Communication SDK — ws-scrcpy Android 11 one-click integration (2026-10-28)

## Goal
In HITEL Railway /sdk-lab, clicking **Android 실행** requests a disposable Android 11 guest on a GitHub Actions KVM runner. Embed the real guest video through ws-scrcpy (H.264 over WebSocket) and allow touch, drag, keyboard, app install, and terminate. Avoid any GitHub Run workflow interaction or user-entered token.

## Verified repository facts
- Repository: lyonbegin/hitel-room
- Implementation branch: feature/communication-sdk
- main has .github/workflows/android-web-session-runner.yml containing workflow_dispatch + 5-minute schedule, Actions OIDC claim, GitHub KVM, and original-native-live.sh.
- Current native test launcher: mobile/tests/original-native-live.sh, which still uses noVNC/websockify and nginx edge; this is NOT ws-scrcpy.
- Existing Android original vendor: vendor/android-emulator-platform.
- Some recent commits removed the GitHub production launch path for a Railway Sandbox-only design. Before deployment, establish which branch/environment is the actual source of truth.

## Upstream source
https://github.com/NetrisTV/ws-scrcpy (MIT)
Requirements: Node.js, adb in PATH, Android 5+ with debugging enabled. Browser: WebSockets, H.264 decode via WebCodecs or MSE (fallback WASM). For Android emulator upstream warns that the device-bound server may not be externally reachable; use **proxy over adb**. Upstream explicitly warns that authorization and transport encryption are absent by default; do not expose raw adb or ws-scrcpy port publicly.

## Implementation checklist
1. Inspect deployed Railway service and branch mapping; avoid silently recreating old always-on Relay services.
2. Establish start/claim/finish control-plane API and verify that a browser click launches the selected runner without user interaction. If polling is used, report the expected queue delay instead of implying instant launch. Do not create runtime admin-token input fields.
3. On KVM runner, boot original Android 11 and confirm: /dev/kvm, adb devices, sys.boot_completed=1, input, and actual screen pixels.
4. Install/run ws-scrcpy in the Android host network namespace or adjacent container with adb connectivity. Use upstream proxy-over-adb mode; keep adb local and use one authenticated HTTPS/WSS ingress to the viewer.
5. Embed the actual ws-scrcpy viewer in /sdk-lab; device start/stop/loading/errors and browser reconnection must reflect real server state; never simulate a phone screen.
6. Verify Playwright browser screenshot with nonblank pixels and actual Android UI, then touch, swipe, keyboard, APK install, relaunch, and complete shutdown.
7. Cleanup on explicit stop, runner cancellation, runner timeout, and idle expiration. No always-on paid VM/Relay unless needed and approved.
8. Capture logs and screenshots; only report success when both live-video and input tests pass.

## Operational acceptance evidence
- One web click yields a real Android 11 launcher in Railway /sdk-lab.
- ws-scrcpy WebSocket accepts the viewer and actual H.264 frames are decoded.
- Remote actions change real Android UI; screenshot before/after comparison.
- A user can install a test APK without GitHub interface.
- Stop/timeout tears down compute; subsequent click provisions a fresh state.
- Logs show GitHub runner, Android boot, scrcpy transport, browser E2E, and cleanup.

## Important constraints
Do not mistake a successful websocket HTTP 101 for proven decoded video.
Do not mistake GitHub workflow triggered for Android booted.
Do not mistake the prior noVNC integration for completed ws-scrcpy work.
Do not remove existing fallback until new transport passes end-to-end testing.
