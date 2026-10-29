# HITEL Communication SDK — ws-scrcpy Android 11

**Transport:** NetrisTV/ws-scrcpy (MIT), WebSocket + H.264 (WebCodecs/MSE), **not WebRTC**.

## Pinned source
- Upstream: https://github.com/NetrisTV/ws-scrcpy
- Commit: `cd6cea6ebde17af6685c2b325183fc24bef9d52b`
- MIT license: https://github.com/NetrisTV/ws-scrcpy/blob/master/LICENSE
- The modified upstream scrcpy 1.19 WebSocket Android server JAR is used without inventing a fake Android UI.

## Components
- `lab-ws-scrcpy/build.sh`: clone pinned upstream, disable iOS and unnecessary shell/file-browser tools, build browser WebCodecs player and Android tracker
- `lab-ws-scrcpy/run-proof.sh`: booted real Android 11 only; prove device tracker and H.264 browser pixels, plus touch packets
- `lab-ws-scrcpy/browser-proof.py`: genuine Chromium WebCodecs pixel diversity and interaction test; captures screenshots
- `lab-ws-scrcpy/gateway.mjs`: ephemeral HTTP and websocket forward only; **no video transcoding** or VNC
- `lab-ws-scrcpy/live-session.sh`: GitHub KVM host with Railway reverse WebSocket, server cleanup and explicit-stop lifecycle
- `lab-ws-scrcpy/session.mjs`: authenticate GitHub runner with GitHub Actions OIDC and relay browser traffic over the persistent Railway WebSocket
- `sandbox-control/ws-scrcpy-host.mjs`: register the runner and track session state; stop/finish endpoints
- `sandbox-control/ws-scrcpy-relay.mjs`: same-origin HTTP proxy and raw binary WebSocket frame relay
- `src/device-lab/WsScrcpyEmbed.tsx`: actual H.264 browser WebCodecs viewer with MSE fallback
- `.github/workflows/hitel-ws-scrcpy-proof.yml`: one-off KVM/Android11 H.264 video and input verification, no VNC
- `.github/workflows/hitel-ws-scrcpy-live.yml`: separately triggered disposable live host

## Real data flow

Android 11 KVM → upstream modified scrcpy-server H.264 over ADB-forwarded WebSocket → ws-scrcpy server → localhost:8081 gateway → authenticated GitHub-runner reverse WebSocket → same-origin Railway app → browser WebCodecs.

Railway carries the live H.264 WebSocket frames and browser HTTP requests over an authenticated runner connection. Video frames remain binary and are not base64-expanded or transcoded. The old `scrcpy → Xvfb → x11vnc → websockify → noVNC` pipeline is removed from this feature branch.

## Verification gates
1. KVM `/dev/kvm` exists; Android `sys.boot_completed=1`; `ro.build.version.release=11`
2. Upstream ws-scrcpy bundle is built from the pinned commit
3. Android tracker reports `emulator-5554` and a real scrcpy-server PID
4. Chrome WebCodecs displays non-black, non-flat actual Android canvas pixels
5. Browser touch gesture emits ws-scrcpy WebSocket control frames
6. The Railway same-origin health endpoint confirms the reverse relay and actual ws-scrcpy engine
7. Railway accepts GitHub OIDC claim and shows live session (not a synthetic screenshot)
8. Session stops on the user button; GitHub's hosted-runner rotation reuses the cached Android image

## Security and operating constraints
- Upstream ws-scrcpy is a prototype **without built-in authorization**. Do not make a persistent publicly accessible device endpoint from this feature.
- The browser endpoint is same-origin on Railway; only the authenticated temporary GitHub runner holds the local ws-scrcpy connection.
- GitHub Actions host setup delay is **separate** from display/interaction latency.
- Running this prototype is not evidence of WebRTC media transport or a fully commissioned multiuser device lab.
- Do not merge/deploy to production until actual KVM/WebCodecs/input and authenticated Railway registration checks pass.

## Proof links
- Android WebCodecs + input: https://github.com/lyonbegin/hitel-room/actions/runs/40636049130
- HITEL TypeScript UI: https://github.com/lyonbegin/hitel-room/actions/runs/40636894409
