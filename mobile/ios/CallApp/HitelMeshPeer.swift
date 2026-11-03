import Foundation
import WebRTC

final class HitelMeshPeer {
    let id: String
    let userID: String
    let connection: RTCPeerConnection
    var remoteDescriptionReady = false
    var pendingICE: [RTCIceCandidate] = []
    var video: RTCVideoTrack?
    var probe: HitelRemoteVideoProbe?
    init(id:String,userID:String,connection:RTCPeerConnection) {
        self.id=id
        self.userID=userID
        self.connection=connection
    }
    func detachVideoProbe() {
        if let video, let probe { video.remove(probe) }
        probe=nil;video=nil
    }
}
