# HITEL SDK Lab — iPhone Live Simulator Implementation (2026-10-30)

## User-facing URL
https://hitel-communication-web-production.up.railway.app/sdk-lab

## Goal
Display two actual simulators side by side. Preserve the existing Android ws-scrcpy path. The right-hand iPhone must offer independently controlled start/stop, app install/open, direct touch and swipe, text, Home and rotation. Web page reload should reattach to the active session; screenshots from CI must never be shown as if live.

## Changes
- `sandbox-control/ios-live.mjs`: a same-container iOS control plane; workflow dispatch using server-only `HITEL_GITHUB_WORKFLOW_TOKEN`, GitHub Actions OIDC for runner pairing, browser-Origin checked viewer websocket, binary JPEG relay, independent iOS state, persistent status under Railway volume, and workflow-step polling.
- `sandbox-control/server.mjs` and `Dockerfile`: mount the control plane under existing `/lab-sandbox/ios/*`. No new external Relay or Cloudflare infrastructure.
- `src/device-lab/IosLivePanel.tsx` and `IosLivePanel.css`: actual live viewport, touch/swipe mapping, text, app installation, launch, Safari, Home, rotation, start/stop and real remote status.
- `src/device-lab/DeviceLab.tsx`: replace the old iPhone CI-capture panel, keep Android `WsScrcpyEmbed`, and stop polling retired `/lab-api/frame/*` and `/lab-api/status` APIs.
- `mobile/tests/ios-live-agent.py`: Meta idb MJPEG actual screen stream, native iOS input using idb; simulator app controls using simctl; Korean input via simulator pasteboard.
- `.github/workflows/ios-live-simulator.yml` **on default branch main**: mandatory for workflow_dispatch; checkout of `feature/ws-scrcpy-android11-20261028` in macOS 15 hosted runner, rebuild and install `app.hitel.native` for iPhone 16 Pro.

## Transport
`Browser <-> nginx /lab-sandbox/ios/socket <-> same-container Node relay <-> GitHub macOS iPhone 16 Pro + Meta idb`.

The first implementation uses **real-time MJPEG encoded by idb**. H.264 + browser video decoder is not yet implemented. Static CI images are neither shown as live nor used as substitutes.

## Status and evidence
- GitHub repository updates completed (operational branch plus main workflow).
- Railway web service build, healthcheck, and startup succeeded for commit `36c71fcc3c8ba0f53c1091ee1f0362513d264d2d`.
- Old run `40897125896` demonstrates native iOS simulator app boot/install/bridge on the former mobile-native branch; it does NOT demonstrate the new interactive iOS live path.
- **Pending real-device E2E evidence**: start from the browser, workflow dispatch/runner boot, first genuine idb video frame, touch/swipe/Home/rotation, Hangul keyboard, HITEL app install/open, Safari, page reload, isolated Android state, iOS-only stop and automatic macOS replacement.
- GitHub hosted jobs terminate at a finite timeout. Automatic runner replacement is implemented only after a first successful live session; a new Simulator process is **not** an in-memory continuation. Previous call state and app data are **not** yet checkpointed/restored.

## Acceptance checklist
1. Open `/sdk-lab` in a new tab; verify Android panel and iPhone right panel remain separate.
2. Click `iPhone 실행`. Check real GitHub Actions run and boot/build steps in iOS status; do not equate CI success with live streaming success.
3. Verify first non-stale Meta idb video frame and direct touch, drag, Home, rotation and Korean character entry.
4. Use `HITEL 앱 설치` and `앱 실행`; inspect `app.hitel.native` WKWebView and SDK behavior.
5. Reload the browser and verify reconnection to the same iPhone runner ID.
6. Stop iPhone only; Android must remain reachable.
7. Validate automatic replacement after hosted-runner timeout separately; document loss and recovery of app/user state.

## Operational cautions
- Start incurs metered macOS GitHub Actions compute. The controller is scoped to the existing web origin and runner OIDC, but the website control itself does not implement user login.
- Do not claim H.264, continuous call-state preservation, simulator disk snapshots, or passed live iPhone touch verification until actual evidence is collected.
