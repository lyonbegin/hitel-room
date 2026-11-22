# HITEL Android-first unified client — implementation status

Base: 23f798e1c156f7fb49598b1b284b6a4b58837520.
Original iOS Call/ARKit reference: 07a22ce2834292ba06fda9c415cb7ba604e2a640.
Do not alter the existing server or old deployment. Existing iOS source remains independently buildable.

Implemented in this increment: Flutter public-room REST + ticketed WSS and Unified Plan WebRTC P2P camera/mic, remote renderers, ICE queue, room creation/join/leave/end, camera/mic controls. Uses the original IPA's Railway public-room protocol. No claim that this adapter supports the Fly webrtc-new SFU. The latter is a separate client adapter pending actual protocol specification. Testing dev-token is deliberately the original API; replace with authenticated user login for production.
Not implemented yet: ARCore composite frames, paired Essence2 GPU + PCM WebRTC source, native loopback, existing 1:1 device URL signaling, 16 routes UI, AI Counselor, Telecom, SFU adapter, iOS Flutter bridge. No device or cross-platform test success claimed.
