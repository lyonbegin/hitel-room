import Foundation
import WebRTC

struct HitelMeshRemoteVideo: Identifiable {
    let id: String
    let userID: String
    let videoTrack: RTCVideoTrack
}

final class HitelPublicMeshMedia: NSObject {
    var onStatus: ((String) -> Void)?
    var onRemote: (([HitelMeshRemoteVideo]) -> Void)?
    var onFirstFrame: (() -> Void)?
    var onFPS: ((Double) -> Void)?
    var onEnded: (() -> Void)?
    var localVideoTrack: RTCVideoTrack?
    var ready = false
}
