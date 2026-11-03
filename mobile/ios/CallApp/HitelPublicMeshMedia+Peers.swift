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
    func acceptSignal(_ payload:[String:Any],from peer:HitelMeshPeer) {
        if let description=payload["description"] as? [String:Any],
           let kind=description["type"] as? String,
           let sdp=description["sdp"] as? String {
            guard kind == "offer" || kind == "answer" else{return}
            let session=RTCSessionDescription(
                type:kind=="offer" ? .offer : .answer,sdp:sdp)
            peer.connection.setRemoteDescription(session) {[weak self,weak peer] error in
                guard let self,let peer else{return}
                if let error {self.report("Remote SDP 실패: "+error.localizedDescription);return}
                peer.remoteDescriptionReady=true
                peer.pending.forEach{peer.connection.add($0)}
                peer.pending.removeAll()
                if kind == "offer" {self.createAnswer(for:peer)}
            }
        }
        receiveCandidate(payload,from:peer)
    }
    func receiveCandidate(_ payload:[String:Any],from peer:HitelMeshPeer) {
        guard let candidate=payload["candidate"] as? [String:Any],
              let text=candidate["candidate"] as? String else{return}
        let line=(candidate["sdpMLineIndex"] as? NSNumber)?.int32Value ?? 0
        let ice=RTCIceCandidate(sdp:text,sdpMLineIndex:line,
                               sdpMid:candidate["sdpMid"] as? String)
        if peer.remoteDescriptionReady {peer.connection.add(ice)}
        else {peer.pending.append(ice)}
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
