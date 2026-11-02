# HITEL Public Room — iPhone Native App

## Identity and interoperability
This is a standalone **SwiftUI / AVFoundation / native WebRTC** app, not a WebView, React Native, or ReplayKit streaming app.
- Git branch: `feature/iphone-native-public-room-20261103`
- Bundle ID: `app.hitel.publicroom` (does not replace `app.hitel.call` or the ReplayKit streamer).
- Same Railway production site and data as https://hitel-room-production-ecce.up.railway.app/webrtc-room.
- Same API: `POST /api/auth/dev-token`, `GET/POST /api/public-rooms`, `POST /api/public-rooms/:id/join`, `POST /api/public-rooms/:id/end`.
- Same WSS: `wss://hitel-room-production-ecce.up.railway.app/api/public-rooms/:id/signal`, authenticates with one-time WebSocket subprotocol ticket.
- Same WebRTC payload: `welcome`, `peer-joined`, `signal.description` (SDP), `signal.candidate` (ICE), `peer-left`, `room-ended`.
- Peer-to-peer media is native Google WebRTC. No Fly app modifications.

## Three native integration modules
- `PublicRoomApp/HitelNativeCommunicationSDK.swift`: Rails-style public room API/identity and WSS ticket.
- `PublicRoomApp/HitelNativeVideoCore.swift`: native camera, microphone, Vision image masking, local and remote WebRTC tracks.
- `PublicRoomApp/HitelNativeAISDK.swift`: reads current AI Counselor SDK v1.1.0 presets, runtime health and participant status from existing Railway app.
- `PublicRoomApp/HitelNativeRoomStore.swift`: live room state and native WebRTC mesh peers.
- `PublicRoomApp/HitelNativePublicRoomScreen.swift`: SwiftUI lobby, creation form, video tiles and camera/microphone controls.

### AI limitation
AI Counselor's real server participant is connected to a separate consultation room; it **does not** yet join the Railway public room. The native screen reports real SDK status; it does not fabricate an AI media participant or text completion.

### Media test limitation
A headless iOS Simulator cannot provide the physical iPhone camera. The test-only flag `-HITEL_E2E_NATIVE_MEDIA` generates non-camera native frames so the actual browser decoder can be checked end-to-end. The physical iPhone camera uses AVCapture in normal builds. Actual iPhone hardware and carrier-to-Wi-Fi NAT/TURN interoperability remain separate validation items.

## Install
The GitHub Actions workflow builds an **unsigned ARM64 IPA**. Unsigned binaries cannot be directly installed on an ordinary iPhone. Use a trusted Apple Developer signing workflow or sideloading tool that legitimately re-signs the IPA. App signing assets, Apple IDs and API keys are never embedded in the GitHub repo. The GitHub release is for source/binary distribution, not evidence of signing.

## Build
```bash
cd mobile/ios
xcodegen generate --spec project.public-room.yml
xcodebuild -project HitelPublicRoom.xcodeproj -scheme HitelPublicRoom -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```
The iOS workflow validates Swift compilation, separate ARM64 binary, actual simulator launch, web-created room list sync, and (when fully passing) cross-platform media receipt.
