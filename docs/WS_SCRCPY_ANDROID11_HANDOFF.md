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
- `lab-ws-scrcpy/live-session.sh`: GitHub KVM host with temporary HTTPS tunnel, server cleanup and ten-minute session deadline
- `lab-ws-scrcpy/session.mjs`: authenticate GitHub runner with GitHub Actions OIDC to Railway native-host registry
- `sandbox-control/ws-scrcpy-host.mjs`: validate real remote ws-scrcpy host and record 10-minute session state; stop/finish endpoints
- `src/device-lab/WsScrcpyEmbed.tsx`: actual H.264 browser WebCodecs viewer with MSE fallback
- `.github/workflows/hitel-ws-scrcpy-proof.yml`: one-off KVM/Android11 H.264 video and input verification, no VNC
- `.github/workflows/hitel-ws-scrcpy-live.yml`: separately triggered disposable live host

## Real data flow

Android 11 KVM → upstream modified scrcpy-server H.264 over ADB-forwarded WebSocket → ws-scrcpy server → disposable localhost:8081 gateway → temporary Cloudflare HTTPS tunnel → browser WebCodecs.

Railway carries only signed session registration and stop/health control, **not** the video media stream. The old `scrcpy → Xvfb → x11vnc → websockify → noVNC` pipeline is removed from this feature branch.

## Verification gates
1. KVM `/dev/kvm` exists; Android `sys.boot_completed=1`; `ro.build.version.release=11`
2. Upstream ws-scrcpy bundle is built from the pinned commit
3. Android tracker reports `emulator-5554` and a real scrcpy-server PID
4. Chrome WebCodecs displays non-black, non-flat actual Android canvas pixels
5. Browser touch gesture emits ws-scrcpy WebSocket control frames
6. Direct public HTTPS tunnel returns actual ws-scrcpy engine health
7. Railway accepts GitHub OIDC claim and shows live session (not a synthetic screenshot)
8. Session stops on button or after ten minutes, with GitHub KVM job ending

## Security and operating constraints
- Upstream ws-scrcpy is a prototype **without built-in authorization**. Do not make a persistent publicly accessible device endpoint from this feature.
- Quick Tunnel is temporary and the gateway self-terminates after 600 seconds; the real host must be started only on demand.
- GitHub Actions host setup delay is **separate** from display/interaction latency.
- Running this prototype is not evidence of WebRTC media transport or a fully commissioned multiuser device lab.
- Do not merge/deploy to production until actual KVM/WebCodecs/input and authenticated Railway registration checks pass.

## Proof links
- Android WebCodecs + input: https://github.com/lyonbegin/hitel-room/actions/runs/40636049130
- HITEL TypeScript UI: https://github.com/lyonbegin/hitel-room/actions/runs/40636894409
