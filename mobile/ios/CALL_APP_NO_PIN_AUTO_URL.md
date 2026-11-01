# HITEL Communication · Standalone iPhone Call App (NO PIN)

## Product contract

The existing HITEL iPhone **ReplayKit screen-streaming app continues unchanged**.
It is not the call app and MUST NOT be replaced by the native calling binary.

| Artifact | Bundle ID | Release |
|---|---|---|
| Existing screen streamer | `app.hitel.native` and `app.hitel.native.broadcast` | `hitel-iphone-free-7day-unsigned` |
| New standalone native calling app | `app.hitel.call` | `hitel-call-iphone-free-7day-unsigned` |

The call app has its own SwiftUI entrypoint and native WebRTC/CallKit client.
It does not depend on WKWebView communication bridges or the screen-streaming app.

## How automatic registration works

1. On first launch the new HITEL Call app generates a random installation UUID and 256-bit secret using Keychain / secure random; it stores them locally.
2. App sends `POST /lab-sandbox/playground/device/register`, authenticating with its installation secret. Server creates a distinct, cryptographically random 64-character page token and stores it on the Railway persistent volume.
3. The server returns a unique page URL `https://hitel-communication-web-production.up.railway.app/communication-playground/app/<64-hex token>`.
4. The app opens its own **native** WebSocket connection to `/lab-sandbox/playground/device/socket`, sends `device.auth` containing its Keychain identity and receives `device.ready`. The address and device identity persist between launches.
5. When the browser opens the exact per-app URL, React creates/restores a scenario, observes the device state and calls `/playground/device/attach`. Server sends `device.assign` with a temporary side-scoped session token to the authenticated call app.
6. The iPhone independently connects to the existing `/playground/socket` as the correct N/P+ actor. Browser W connects as the other actor. For N→N, paste a second iPhone's **unique app URL** into the other-device field to assign B; no PIN.
7. Subsequent browser reloads reuse the page token and valid session state. iOS foreground activation and WebSocket ping failure re-establish device control session without code entry.

**There is no new eight-digit PIN or numeric pairing step for the standalone call app.** Obsolete older Playground `/native-join` stays server-side solely for compatibility with previous test code; the current app and current UI never call or display it.

Security: the unique page URL is a bearer-control URL. Only share it with people authorized to access that app; do not post it publicly. Native device secret stays in iOS Keychain and is not part of the browser URL. Server issues time-limited side-scoped session credentials rather than the browser owner token.

## What is available for tests

- A native SwiftUI iPhone call dial/accept/reject/end interface with camera and microphone, CallKit incoming UI when app is active, and native WebRTC SDP/ICE.
- 16-path web scenarios (P, P+, N, W; each ×4) with independent WebSockets, W↔W browser real WebRTC, and device-specific per-app pages for N/P+.
- Native P+ companion: iOS phone-app launcher, explicit CallKit system call-state observation, user-entered notes and on-device TTS. It does **not** capture or inject audio into a cellular call.
- Real Railway protocol tests: 16-path basic flows, 80 lifecycle/negative flows, N route handshake, P+ notes, unique app URL registration, device assignment and native WSS handshake.
- Real Chromium automated tests: 16 UI routes, real WebRTC W↔W media, no numeric pairing UI, per-app URL device auto-attachment.
- iOS code-signing-independent ARM64 IPA compile, separate GitHub Release, Apple iOS Simulator app launch.

## Remaining independently verifiable boundaries

A successful simulated device WSS peer or iOS Simulator launch is **not** proof that the user's physical iPhone has successfully completed a real bidirectional CallKit/WebRTC call. The actual signed IPA needs on-device installation and camera/microphone consent for hardware media validation.

P/P+ carrier voice and AI live audio processing require additional legal telephony gateways / authorized media inputs / AI runtime. Do not mark their entire telephone calls as passed merely because signaling has passed.

## URLs

- [Web Playground](https://hitel-communication-web-production.up.railway.app/communication-playground)
- [Separate HITEL Call release](https://github.com/lyonbegin/hitel-room/releases/tag/hitel-call-iphone-free-7day-unsigned)
- [Standalone iPhone Call IPA](https://github.com/lyonbegin/hitel-room/releases/download/hitel-call-iphone-free-7day-unsigned/HITEL-Call-iPhone-Free-7day-unsigned.ipa)

The device URL itself is created **at first launch** and is intentionally not hardcoded into this document.
