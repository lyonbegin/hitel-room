import Foundation
import WebRTC

final class HitelMeshPeer {
    let id: String
    let userID: String
    let connection: RTCPeerConnection
    var remoteDescriptionReady = false
    var pendingICE: [RTCIceCandidate] = []
    var video: RTCVideoTrack?
    init(id:String,userID:String,connection:RTCPeerConnection) {
        self.id=id
        self.userID=userID
        self.connection=connection
    }
}
