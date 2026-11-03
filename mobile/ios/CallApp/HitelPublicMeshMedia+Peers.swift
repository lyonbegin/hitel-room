import Foundation
import WebRTC

extension HitelPublicMeshMedia {
    func ensurePeer(id:String,userID:String)->HitelMeshPeer? {
        if let current=peers[id] {return current}
        let config=RTCConfiguration()
        config.iceServers=[
            RTCIceServer(urlStrings:["stun:stun.l.google.com:19302"])]
        config.sdpSemantics = .unifiedPlan
        let options=RTCMediaConstraints(mandatoryConstraints:nil,optionalConstraints:nil)
        guard let rtc=Self.factory.peerConnection(
            with:config,constraints:options,delegate:self) else {
            report("WebRTC PeerConnection 생성 실패")
            return nil
        }
        if let microphoneTrack {
            rtc.add(microphoneTrack,streamIds:["hitel-public"])
        }
        if let localVideoTrack {
            rtc.add(localVideoTrack,streamIds:["hitel-public"])
        }
        let peer=HitelMeshPeer(id:id,userID:userID,connection:rtc)
        peers[id]=peer
        return peer
    }
}
