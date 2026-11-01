# HITEL iPhone Communication SDK — 16-route native final test plan

## Artifacts
- Web Playground: https://hitel-communication-web-production.up.railway.app/communication-playground
- iPhone Sideloadly IPA: https://github.com/lyonbegin/hitel-room/releases/download/hitel-iphone-free-7day-unsigned/HITEL-iPhone-Free-7day-unsigned.ipa
- Branch: `feature/ws-scrcpy-android11-20261028`
- Native app: `mobile/ios/Sources/HitelNativePlaygroundScreen.swift`, `HitelNativePlaygroundModel.swift`, `HitelNativeCallMedia.swift`
- Server: `sandbox-control/communication-playground.mjs`
- UI: `src/communication-playground/CommunicationPlayground.tsx`

## Verified test scope
- **16/16**: two independent WebSocket clients can send invite, ringing, accept, end and retrieve server ACK.
- **7/7 with N**: native-side one-time PIN, role-scoped 64-byte WSS capability, actual signaling and SDP/ICE routing using node test peers, independent of a WebView bridge.
- **iOS ARM64**: Xcode compiles `HitelNative.app` and embedded ReplayKit extension; IPA build assertions verify embedded native arm64 `WebRTC.framework/WebRTC` binary.
- **Simulator runtime**: GitHub Actions runs on an Apple iOS Simulator, installs the app, launches and captures screenshot (see separate workflow result).
- **Not proven**: live iPhone camera/microphone bidirectional media; user must grant permissions and perform final hardware loop. A Swift or protocol test does not prove audio/video call quality.
- **External dependencies absent**: PSTN ingress/egress for P/P+, access to cellular remote call audio, live AI provider audio processing, PushKit/APNs delivery when app is terminated, production TURN service. These functions remain visibly unverified.

## Final real iPhone ↔ browser test: W → N (SC-15)
1. Open the deployed Web Playground in Windows Chrome/Edge at the URL above.
2. Click **SC-15 W → N** and **새 테스트 세션**.
3. Under **실제 iPhone N 플레이어 연결**, note the **B pairing code**.
4. On the installed iPhone HITEL app, select the **네이티브 통화** tab, enter the B code and press **접속**.
5. In web PLAYER A click **WebSocket 연결**; expect both A and B peer status connected. **Never click browser controls for N**.
6. In web PLAYER A select **발신**. Confirm iPhone CallKit incoming ring and/or native call UI state `ringing`.
7. Accept on iPhone. In web PLAYER A click **카메라·마이크 허용** and **WebRTC 연결 실행**.
8. Verify remote **actual video and audible microphone audio** on both sides. Both must show real connected ICE state, not only WebSocket ACK.
9. Mute microphone, disable and re-enable camera and check actual remote effects; end on either side.
10. Lock/unlock the phone and test reconnect. The iOS OS may suspend call media in background; do not claim an automatic foreground-free call start. Check call status and actual reconnection.

## Final real iPhone → browser test: N → W (SC-12)
1. New SC-12 session, enter the **A native code** in iPhone.
2. Browser PLAYER B: connect WebSocket, grant camera/mic.
3. From iPhone tap **발신**; Browser PLAYER B click **수락**. Native iPhone automatically creates WebRTC Offer; browser answers via direct WebSocket.
4. Check real two-way audio/video, mute, camera, end; log success/failure.

## N → N (SC-11)
1. Use two physically distinct signed iPhones running the same IPA. New SC-11 produces **A** and **B** distinct native codes.
2. Enter A on first iPhone, B on second; confirm web peer presence both connected.
3. Place call on A, answer on B using iOS CallKit; verify both native WebRTC peer states, remote video and audio. No browser media is used.
4. Repeat with Wi-Fi/cellular change, lock screen and incoming call interruptions.

## P/P+ tests
The other nine scenarios have complete independent WebSocket signaling and error/unsupported labels, **not** actual carrier audio. Do not present them as integrated telephone calls without installing and verifying a PSTN gateway/carrier agreement. Native P+ auxiliary AI panel needs an authorized audio source and an independent AI runtime.

## Debugging
- Browser: Player A/B WebSocket connection logs, event sequence, SDP forwarding, ICE state and scenario notes.
- iPhone: Swift live log in native calling tab, `CallKit` incoming and `RTCIceConnectionState`.
- Relay: `HITEL_PLAYGROUND_EVENT` Railway logs; session expiry is 120 minutes.
- Build: GitHub Actions free IPA, iOS-native-device compile, simulator launch and 16+7 scenario smoke workflows.

**Do not enter a real telephone number or assume emergency calling is supported in this playground.**
