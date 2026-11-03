import Foundation
import WebRTC

extension HitelPublicMeshMedia {
    func createOffer(for peer:HitelMeshPeer) {
        let pc=peer.connection
        let constraints=RTCMediaConstraints(
            mandatoryConstraints:["OfferToReceiveAudio":"true",
                                   "OfferToReceiveVideo":"true"],optionalConstraints:nil)
        pc.offer(for:constraints) {[weak self,weak peer] sdp,error in
            guard let self,let peer,let sdp else {
                self?.report("공개방 Offer 생성 실패: "+(error?.localizedDescription ?? ""))
                return
            }
            pc.setLocalDescription(sdp) {[weak self] failure in
                if let failure { self?.report(failure.localizedDescription);return }
                self?.signal(to:peer.id,data:[
                    "description":["type":"offer","sdp":sdp.sdp]])
            }
        }
    }
    func createAnswer(for peer:HitelMeshPeer) {
        let pc=peer.connection
        let constraints=RTCMediaConstraints(
            mandatoryConstraints:["OfferToReceiveAudio":"true",
                                   "OfferToReceiveVideo":"true"],optionalConstraints:nil)
        pc.answer(for:constraints) {[weak self,weak peer] sdp,error in
            guard let self,let peer,let sdp else {
                self?.report("공개방 Answer 생성 실패: "+(error?.localizedDescription ?? ""))
                return
            }
            pc.setLocalDescription(sdp) {[weak self] failure in
                if let failure { self?.report(failure.localizedDescription);return }
                self?.signal(to:peer.id,data:[
                    "description":["type":"answer","sdp":sdp.sdp]])
            }
        }
    }
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
