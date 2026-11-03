import Foundation
import WebRTC

extension HitelPublicMeshMedia {
    func peerConnection(_ pc:RTCPeerConnection,didChange state:RTCSignalingState){}
    func peerConnection(_ pc:RTCPeerConnection,didAdd stream:RTCMediaStream){
        if let track=stream.videoTracks.first { remember(track,in:pc) }
    }
    func peerConnection(_ pc:RTCPeerConnection,didRemove stream:RTCMediaStream){}
    func peerConnectionShouldNegotiate(_ pc:RTCPeerConnection){}
    func peerConnection(_ pc:RTCPeerConnection,didChange state:RTCIceConnectionState){
        switch state {
        case .connected,.completed: report("상대 참가자 WebRTC ICE 연결됨")
        case .failed: report("상대 참가자 ICE 실패 · TURN 필요 여부 확인")
        case .disconnected: report("상대 참가자 WebRTC 일시 중단")
        default:break
        }
    }
    func peerConnection(_ pc:RTCPeerConnection,didChange state:RTCIceGatheringState){}
    func peerConnection(_ pc:RTCPeerConnection,didGenerate candidate:RTCIceCandidate) {
        guard let peer=peers.values.first(where:{$0.connection === pc}) else{return}
        signal(to:peer.id,data:["candidate":[
            "candidate":candidate.sdp,
            "sdpMid":candidate.sdpMid ?? "",
            "sdpMLineIndex":Int(candidate.sdpMLineIndex)
        ]])
    }
    func peerConnection(_ pc:RTCPeerConnection,
                        didStartReceivingOn transceiver:RTCRtpTransceiver) {
        if let track=transceiver.receiver.track as? RTCVideoTrack {
            remember(track,in:pc)
        }
    }
    func remember(_ track:RTCVideoTrack,in pc:RTCPeerConnection) {
        DispatchQueue.main.async {[weak self] in
            guard let self,
                  let peer=self.peers.values.first(where:{$0.connection === pc})
                  else {return}
            peer.video=track
            self.updateRemotes()
            self.onStatus?("상대 영상 트랙 연결됨 · 프레임 표시 검증 필요")
        }
    }
    func peerConnection(_ pc:RTCPeerConnection,didRemove candidates:[RTCIceCandidate]){}
    func peerConnection(_ pc:RTCPeerConnection,didOpen channel:RTCDataChannel){}
}
