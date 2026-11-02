# HITEL iPhone unified native SDK — source-checked compatibility ledger (2026-11-02)

## Product invariant

One real SwiftUI iPhone screen owns **all** camera capture, processed local video, remote video rendering, audio output, CallKit, and call controls. **No WKWebView and no browser MediaStream in the native call path.** The existing ReplayKit screen-streaming app `app.hitel.native` is not modified. The native call app remains `app.hitel.call`. Existing per-install unique device URL is preserved; no numeric pairing code.

The iPhone must interoperate with the **original HITEL Room web client**, not merely with the distinct playground P2P call service.

## Upstream source contracts inspected

| Upstream | File | Runtime semantics |
| --- | --- | --- |
| HITEL Communication SDK 0.1.0 | `src/communication-sdk/index.ts` | `describeRoute` 16 P/P+/N/W cases; `respondWithAI`; `joinRoom(roomId, stream, adapter)`; `joinAICounselorRoom`; `leaveRoom` |
| AI Counselor SDK 1.1.0 | `lyonbegin/ai-consult-beauty-backend/ai_counselor_sdk/src/sdk/index.js` | `create`, `normalizeCounselorProfile`, `respond`, `reset`, `openCamera`, `enterRoom`, `leaveRoom` |
| AI Counselor runtime | `ai_counselor_sdk/src/runtime/server.mjs` | `POST /v1/respond`, `POST /v1/session/reset`, **requires `RUNTIME_API_TOKEN` bearer**; do not embed admin bearer in IPA |
| VideoCore 1.0.0 | `lyonbegin/video-town-front/src/sdk/VideoCore.ts` | `openCamera`, `setMode`, `enableMask`, `disableMask`, `getTrackingStatus`, video/audio track replacement, `stop` |
| MaskedCamera | `lyonbegin/video-town-front/src/mask/MaskedCamera.ts` | MindAR face estimator, One Euro smoothing, point/deadband stabilizers, textured 3D mask, output Canvas; **not yet native-portable** |
| Original HITEL web | `src/App.tsx`, `src/realtime/MediasoupSession.ts` | authenticated `/realtime` Socket.IO, `session:join/ready/start`, `rtc:join/create-transport/connect-transport/produce/consume/resume-consumer` |
| Existing iOS call app | `mobile/ios/CallApp/HitelNativeCallMedia.swift` | `RTCCameraVideoCapturer` to native `RTCVideoTrack`, independent P2P SDP/ICE via playground WSS — **NOT** existing HITEL mediasoup SFU |

## Current branch deliverables, and what they actually do

1. `HitelNativeAICounselor.swift`: Swift `respond`, `reset`, `configure`, `usePreset`, `getProfile` matching AI Counselor 1.1.0 REST fields and all five existing presets. **Server token is not present in this app**, so a backend-authorized proxy/session credential is required for real responses. Do not claim an HTTP 401 is success.
2. `HitelNativeVideoCore.swift`: camera session façade reuses **the same** `HitelNativeCallMedia` owner and native RTCVideoTrack. Actual original camera is connected to the app model. `mask` requests explicitly throw until the complete native tracking/rendering implementation exists; no false-success mask toggle.
3. `HitelNativeCommunicationSDK.swift`: public native facades for 16 route IDs, AI response, `joinRoom`, `joinAICounselorRoom`, `leaveRoom`, with an explicit native SFU room adapter contract. The native SFU adapter is **not implemented**, so these methods must not be reported as having established HITEL web↔iPhone media.
4. `HitelCallModel.swift`, `HitelCallScreen.swift`: integrates the native AI service into SwiftUI and routes native original camera initialization through the VideoCore façade; preserves current P2P playground and device URL flows until tested replacements are ready.

These are **integration foundations, not the completed full port**.

## Existing web ↔ native interoperability must use these EXACT HITEL server events

1. Authenticate the iPhone as a real room user (JWT, server permissions); the current playground device token is **not** an HITEL Room user JWT.
2. Open actual Socket.IO namespace `/realtime` (not generic raw WSS `/lab-sandbox/playground/socket`).
3. Use existing role/room checks: `session:join` → `session:ready` → `session:start` (when appropriate).
4. `rtc:join` and use returned `routerRtpCapabilities`, then `rtc:create-transport` for send and recv.
5. `rtc:connect-transport` with actual DTLS params; `rtc:produce` local audio/video with valid mediasoup RTP parameters.
6. `rtc:consume` the web producer and `rtc:resume-consumer`; render received `RTCVideoTrack` **only** in native `RTCMTLVideoView`.
7. On remote producer changes, use `rtc:new-producer`, `rtc:producer-closed`, `rtc:list-producers`; handle ICE restart and reconnection.
8. `session:leave` and close native transports and tracks. Only display `connected` after actual remote media and transport state confirm.

A **native mediasoup library with exactly one compatible WebRTC binary** must replace the current standalone P2P media transport. Candidate libraries must pass actual iOS build and original HITEL SFU test before selection. Do not link two incompatible WebRTC XCFrameworks.

## Complete native VideoCore fidelity gate

- Same original video, microphone, camera selection, start/stop/recovery behavior.
- Face mesh landmark input (MindAR JavaScript is not itself callable from Swift), equivalent coordinate transform, orientation/mirroring.
- Same One Euro filters, deadband and stability parameters; test motion against actual browser reference clips.
- Same face mask texture mesh, resolution, canvas-equivalent output framing, fps measurements.
- Single native capture owner; processed frames injected directly into WebRTC video source; no image transport over the device-control WebSocket.
- Mode switching without joining a second call, losing audio or leaking camera handles.
- Full tests on actual iPhone and A web browser. Simulator build alone is insufficient.

## Critical AI runtime gate

The actual existing AI server's `tokenGood` rejects `/v1/respond` without `Authorization: Bearer <RUNTIME_API_TOKEN>`. This **must not be compiled into the phone**. Provide authenticated per-user backend proxy or a narrowly scoped server-issued credential, then verify `respond`/session reset and live audio AI processing as separate functions. Live speech processing and AI voice insertion are **not** implemented by the current text-only native client.

## Functional parity status

| Contract | Current native branch |
| --- | --- |
| 16 route classification and route IDs | Implemented in Swift |
| Original local native video track | Existing engine reused through VideoCore facade |
| SwiftUI native video display, no WebView | Preserved from existing call app |
| Native AI Counselor profile and HTTP request contract | Implemented; credentialed live response not verified |
| Native VideoCore face tracking and full mask compositing | NOT implemented |
| Native SFU room adapter to original HITEL Room | NOT implemented |
| Original HITEL web↔iPhone true audio/video | NOT verified |
| Native VoIP background incoming PushKit path | NOT implemented |
| Physical iPhone IPA build/install | NOT verified on this branch |

Never call this full HITEL SDK 2.0 production complete while the required gates above remain open.
