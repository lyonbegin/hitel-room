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
    static let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        return RTCPeerConnectionFactory(
            encoderFactory: RTCDefaultVideoEncoderFactory(),
            decoderFactory: RTCDefaultVideoDecoderFactory())
    }()
    var peers: [String:HitelMeshPeer] = [:]
    var ws: URLSessionWebSocketTask?
    var videoCore: HitelNativeVideoCore?
    var microphoneTrack: RTCAudioTrack?
    var completed: ((Result<Void,Error>) -> Void)?
    var stopped = false
    var ready = false
    func report(_ text:String) {
        DispatchQueue.main.async {[weak self] in self?.onStatus?(text)}
    }
    func updateRemotes() {
        onRemote?(peers.values.compactMap { peer in
            guard let track=peer.video else {return nil}
            return HitelMeshRemoteVideo(id:peer.id,userID:peer.userID,videoTrack:track)
        }.sorted {$0.id < $1.id})
    }
    func microphone(_ enabled:Bool) { microphoneTrack?.isEnabled=enabled }
    func camera(_ enabled:Bool) { videoCore?.setCameraEnabled(enabled) }
}
