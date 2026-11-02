import Foundation
import AVFoundation
import WebRTC

/// Native iOS WebRTC engine. SDP and ICE travel over our independent WSS
/// signaling protocol, not WKWebView/JavaScript or the ReplayKit screen relay.
final class HitelNativeCallMedia: NSObject, RTCPeerConnectionDelegate {
    private static let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        return RTCPeerConnectionFactory(encoderFactory: RTCDefaultVideoEncoderFactory(),
                                        decoderFactory: RTCDefaultVideoDecoderFactory())
    }()
    var onIce: (([String: Any]) -> Void)?
    var onConnection: ((String) -> Void)?
    var onTrack: ((RTCVideoTrack) -> Void)?
    var onError: ((String) -> Void)?

    private var peer: RTCPeerConnection?
    private(set) var nativeVideoCore: HitelNativeVideoCore?
    private var video: RTCVideoTrack?
    private var audio: RTCAudioTrack?
    private var queuedIce: [RTCIceCandidate] = []
    private var remoteDescriptionReady = false

    var localVideoTrack: RTCVideoTrack? { video }

    func prepare() {
        if peer != nil { return }
        let configuration = RTCConfiguration()
        configuration.iceServers = [RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"])]
        configuration.sdpSemantics = .unifiedPlan
        configuration.continualGatheringPolicy = .gatherContinually
        let constraints = RTCMediaConstraints(mandatoryConstraints: nil,
                                             optionalConstraints: ["DtlsSrtpKeyAgreement":"true"])
        guard let newPeer = Self.factory.peerConnection(with: configuration, constraints: constraints, delegate: self) else {
            onError?("네이티브 PeerConnection을 생성하지 못했습니다.")
            return
        }
        peer = newPeer
        let audioSource = Self.factory.audioSource(with: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil))
        let audioTrack = Self.factory.audioTrack(with: audioSource, trackId: "hitel-native-audio")
        audio = audioTrack
        newPeer.add(audioTrack, streamIds: ["hitel-stream"])
        let core = HitelNativeVideoCore(factory: Self.factory)
        nativeVideoCore = core
        video = core.videoTrack
        newPeer.add(core.videoTrack, streamIds: ["hitel-stream"])
        do {
            try core.openCamera(mode: .original)
        } catch {
            onError?("VideoCore camera: " + error.localizedDescription)
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
            try session.setActive(true)
        } catch {
            onError?("오디오 세션: " + error.localizedDescription)
        }
    }

    func createOffer(_ send: @escaping ([String: Any]) -> Void) {
        prepare()
        guard let peer else { return }
        let constraints = RTCMediaConstraints(mandatoryConstraints: [
            "OfferToReceiveAudio":"true","OfferToReceiveVideo":"true"], optionalConstraints:nil)
        peer.offer(for: constraints) { [weak self] sdp, error in
            guard let self, let sdp else { self?.onError?(error?.localizedDescription ?? "SDP Offer 실패"); return }
            peer.setLocalDescription(sdp) { error in
                if let error { self.onError?(error.localizedDescription); return }
                send(["type":"offer","sdp":sdp.sdp])
            }
        }
    }

    func receiveOffer(_ payload: [String: Any], respond: @escaping ([String: Any]) -> Void) {
        prepare()
        guard let sdp = payload["sdp"] as? String, let peer else { return }
        peer.setRemoteDescription(RTCSessionDescription(type: .offer, sdp: sdp)) { [weak self] error in
            guard let self else { return }
            if let error { self.onError?(error.localizedDescription); return }
            self.flushCandidates()
            let constraints = RTCMediaConstraints(mandatoryConstraints: [
                "OfferToReceiveAudio":"true","OfferToReceiveVideo":"true"], optionalConstraints:nil)
            peer.answer(for: constraints) { answer,error in
                guard let answer else { self.onError?(error?.localizedDescription ?? "SDP Answer 실패");return }
                peer.setLocalDescription(answer) { error in
                    if let error { self.onError?(error.localizedDescription); return }
                    respond(["type":"answer","sdp":answer.sdp])
                }
            }
        }
    }

    func receiveAnswer(_ payload: [String: Any]) {
        guard let sdp=payload["sdp"] as? String, let peer else { return }
        peer.setRemoteDescription(RTCSessionDescription(type: .answer, sdp: sdp)) { [weak self] error in
            if let error {self?.onError?(error.localizedDescription)}
            else {self?.flushCandidates()}
        }
    }

    func addIce(_ payload: [String: Any]) {
        guard let candidate=payload["candidate"] as? String else {return}
        let mid=payload["sdpMid"] as? String
        let line=(payload["sdpMLineIndex"] as? NSNumber)?.int32Value ?? 0
        let ice=RTCIceCandidate(sdp:candidate,sdpMLineIndex:line,sdpMid:mid)
        if remoteDescriptionReady {peer?.add(ice)}else{queuedIce.append(ice)}
    }

    private func flushCandidates() {
        remoteDescriptionReady=true
        queuedIce.forEach { peer?.add($0) }
        queuedIce.removeAll()
    }
    func mute(_ muted:Bool) {audio?.isEnabled = !muted}
    func camera(_ enabled:Bool) {nativeVideoCore?.setCameraEnabled(enabled)}
    func shutdown() {
        nativeVideoCore?.stop()
        nativeVideoCore=nil
        peer?.close();peer=nil;video=nil;audio=nil
        queuedIce=[];remoteDescriptionReady=false
        try? AVAudioSession.sharedInstance().setActive(false)
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {
        if let track=stream.videoTracks.first {onTrack?(track)}
    }
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        onConnection?(String(describing:newState))
    }
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        onIce?(["candidate":candidate.sdp, "sdpMid":candidate.sdpMid ?? "",
                "sdpMLineIndex":Int(candidate.sdpMLineIndex)])
    }
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates:[RTCIceCandidate]) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel:RTCDataChannel) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didStartReceivingOn transceiver: RTCRtpTransceiver) {
        if let track=transceiver.receiver.track as? RTCVideoTrack {onTrack?(track)}
    }
}
