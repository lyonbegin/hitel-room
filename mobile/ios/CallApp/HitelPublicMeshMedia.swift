import Foundation
import WebRTC
import AVFoundation

struct HitelMeshRemoteVideo: Identifiable {
    let id: String
    let userID: String
    let videoTrack: RTCVideoTrack
}

final class HitelPublicMeshMedia: NSObject, RTCPeerConnectionDelegate {
    var onStatus: ((String) -> Void)?
    var onRemote: (([HitelMeshRemoteVideo]) -> Void)?
    var onRemoteFirstFrame: ((String) -> Void)?
    var onICEConnected: ((String) -> Void)?
    var onFirstFrame: (() -> Void)?
    var onMaskTracking: ((Bool)->Void)?
    var onMaskFailure: ((String)->Void)?
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
    func prepareTracks() throws {
        let core=HitelNativeVideoCore(factory:Self.factory)
        core.onFirstFrame={[weak self] in self?.onFirstFrame?()}
        core.onCaptureFPS={[weak self] fps in self?.onFPS?(fps)}
        core.onFaceTracked={[weak self] tracking in self?.onMaskTracking?(tracking)}
        core.onCameraError={[weak self] error in self?.onMaskFailure?(error)}
        videoCore=core
        localVideoTrack=try core.openCamera(mode:.original)
        let source=Self.factory.audioSource(with:RTCMediaConstraints(
            mandatoryConstraints:nil,optionalConstraints:nil))
        microphoneTrack=Self.factory.audioTrack(
            with:source,trackId:"hitel-public-audio")
        let session=AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord,mode:.videoChat,
                                 options:[.allowBluetooth,.defaultToSpeaker])
        try session.setActive(true)
    }
    var maskView: UIView? {videoCore?.maskView}
    func setMask(_ enabled:Bool) throws {
        guard let videoCore else {
            throw HitelVideoCoreError.noCamera
        }
        _ = try videoCore.setMode(enabled ? .mask : .original)
        report(enabled
            ? "ARKit 원본 3D 얼굴 텍스처 합성 시작 · 첫 프레임 확인 중"
            : "네이티브 원본 카메라 영상으로 전환")
    }
    func microphone(_ enabled:Bool) { microphoneTrack?.isEnabled=enabled }
    func camera(_ enabled:Bool) { videoCore?.setCameraEnabled(enabled) }
    func finishWelcome(_ result:Result<Void,Error>) {
        let action=completed
        completed=nil
        action?(result)
    }
    func stop() {
        if stopped {return}
        stopped=true
        ws?.cancel(with:.normalClosure,reason:nil);ws=nil
        peers.values.forEach {$0.detachVideoProbe();$0.connection.close()}
        peers.removeAll()
        videoCore?.stop();videoCore=nil
        localVideoTrack=nil;microphoneTrack=nil
        updateRemotes()
        try? AVAudioSession.sharedInstance().setActive(false)
        let error=NSError(domain:"HITEL",code:4,userInfo:[
            NSLocalizedDescriptionKey:"공개방 연결 종료"])
        finishWelcome(.failure(error))
    }
    func signal(to peerID:String, data:[String:Any]) {
        guard let ws,!stopped else{return}
        let payload:[String:Any]=["type":"signal","to":peerID,"data":data]
        guard let bytes=try? JSONSerialization.data(withJSONObject:payload),
              let text=String(data:bytes,encoding:.utf8) else{return}
        ws.send(.string(text)) {[weak self] error in
            if let error { self?.report("WebRTC 신호 실패: "+error.localizedDescription) }
        }
    }
}
