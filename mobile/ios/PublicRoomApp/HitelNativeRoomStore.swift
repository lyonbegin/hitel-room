import Foundation
import SwiftUI
import AVFoundation
import WebRTC

struct HitelNativeRemote: Identifiable {
    let id: String
    let userId: String
    var name: String
    var track: RTCVideoTrack?
}

/// Same room IDs, same bearer login, same member state and same Railway WSS
/// messages as the deployed React Communication SDK. Never creates a parallel
/// iOS room store or displays synthetic remote video/AI participants.
@MainActor
final class HitelNativeRoomStore:ObservableObject {
    @Published var identity:HitelNativeIdentity?
    @Published var rooms:[HitelPublicRoom]=[]
    @Published var room:HitelPublicRoom?
    @Published var remote:[HitelNativeRemote]=[]
    @Published var status="로그인 후 공개방에 접속합니다."
    @Published var error=""
    @Published var busy=false
    @Published var microphoneEnabled=true
    @Published var cameraEnabled=true
    @Published var cameraMode:HitelNativeVideoCore.Mode = .original
    @Published var aiStatus="AI 상담 서버 상태 미확인"
    @Published var aiProfile=HitelNativeAISDK.profiles[0]

    private let sdk=HitelNativeCommunicationSDK()
    private let aiSDK=HitelNativeAISDK()
    private(set) var videoCore:HitelNativeVideoCore?
    private var socket:URLSessionWebSocketTask?
    private var receiver:Task<Void,Never>?
    private var poller:Task<Void,Never>?
    private var peers:[String:HitelNativeMeshPeer]=[:]
    private var connectedPeerIDs=Set<String>()
    private var websocketReady=false
    #if targetEnvironment(simulator)
    private let nativeMediaTest = ProcessInfo.processInfo.arguments.contains("-HITEL_E2E_NATIVE_MEDIA")
    private var nativeMediaObserved=false
    private func persistNativeMediaEvidence(_ value:String) {
        guard nativeMediaTest,
              let folder=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first else{return}
        let file=folder.appendingPathComponent("hitel-public-native-media-e2e.txt")
        try? value.write(to:file,atomically:true,encoding:.utf8)
        NSLog("HITEL_NATIVE_MEDIA_%@",value)
    }
    #endif

    var isHost:Bool {
        guard let room,let identity else{return false}
        return room.hostUserIds.contains(identity.userId)
    }
    var localTrack:RTCVideoTrack? {videoCore?.videoTrack}

    func login(id:String,name:String,role:String) async {
        guard !busy else{return}
        busy=true;error=""
        do {
            let user=try await sdk.authenticate(userId:id.trimmingCharacters(in:.whitespaces),
                                                 name:name.trimmingCharacters(in:.whitespaces),role:role)
            identity=user
            status="Communication SDK 연결됨 · 공개방 목록"
            await refresh()
            startPolling()
            Task {await loadAIStatus()}
        }catch{self.error=error.localizedDescription}
        busy=false
    }

    func refresh() async {
        guard let identity else{return}
        do {
            let latest=try await sdk.list(identity:identity)
            rooms=latest.filter{$0.status=="LIVE"}
            if let opened=room {
                if let current=latest.first(where:{$0.id==opened.id}) {
                    room=current
                }else{
                    leave()
                    status="방장이 대화방을 종료했거나 방이 삭제되었습니다."
                }
            }
        }catch{self.error="공개방 목록 동기화 실패: "+error.localizedDescription}
    }

    func create(title:String,capacity:Int) async {
        guard let identity,!busy else{return}
        busy=true;error=""
        do {
            let room=try await sdk.create(title:title,capacity:capacity,identity:identity)
            busy=false
            await refresh()
            await enter(room)
        }catch{
            self.error="공개방 개설 실패: "+error.localizedDescription
            busy=false
        }
    }

    func enter(_ target:HitelPublicRoom) async {
        guard let identity,!busy,room==nil else{return}
        busy=true;error=""
        var newCore:HitelNativeVideoCore?
        do {
            // Real hardware permissions, not simulated successful media.
            #if targetEnvironment(simulator)
            if !nativeMediaTest {
                guard await AVCaptureDevice.requestAccess(for:.video),
                      await AVCaptureDevice.requestAccess(for:.audio) else {
                    throw HitelNativeAPIError(message:"카메라와 마이크 권한이 필요합니다.")
                }
            }
            #else
            guard await AVCaptureDevice.requestAccess(for:.video),
                  await AVCaptureDevice.requestAccess(for:.audio) else {
                throw HitelNativeAPIError(message:"카메라와 마이크 권한이 필요합니다.")
            }
            #endif
            let core=HitelNativeVideoCore()
            #if targetEnvironment(simulator)
            if nativeMediaTest {core.startSyntheticForSimulator()}
            else {try core.start()}
            #else
            try core.start()
            #endif
            newCore=core
            let admission=try await sdk.join(target.id,identity:identity)
            guard admission.session.type=="PUBLIC_ROOM",
                  admission.session.policy.allowUnlistedParticipants,
                  admission.session.status=="LIVE" else {
                throw HitelNativeAPIError(message:"해당 영상방은 공개 입장이 불가능합니다.")
            }
            let webSocket=sdk.webSocket(roomId:target.id,ticket:admission.ticket)
            videoCore=core
            socket=webSocket
            websocketReady=false
            webSocket.resume()
            // Native URLSession WSS uses identical WebSocket messages as React.
            receiver=Task { [weak self] in
                guard let self else{return}
                await self.receiveLoop(webSocket)
            }
            room=admission.session
            status="Railway 공개방 WebSocket 접속 중 · 상대방 영상 대기"
            busy=false
            await refresh()
        }catch{
            newCore?.stop()
            self.error="공개방 입장 실패: "+error.localizedDescription
            busy=false
        }
    }

    private func receiveLoop(_ task:URLSessionWebSocketTask) async {
        do {
            while !Task.isCancelled {
                let message=try await task.receive()
                guard socket === task else{return}
                let text:String
                switch message {
                case .string(let value):text=value
                case .data(let data):text=String(data:data,encoding:.utf8) ?? ""
                @unknown default:continue
                }
                guard let data=text.data(using:.utf8),
                      let json=try JSONSerialization.jsonObject(with:data) as? [String:Any] else{continue}
                receive(json)
            }
        }catch{
            if socket === task && room != nil {
                status="실시간 서버 연결 끊김: "+error.localizedDescription
                // Never leave a stale call UI labeled connected.
                leave()
                self.error="실시간 연결이 해제되었습니다. 방 목록에서 다시 입장해 주십시오."
            }
        }
    }

    private func receive(_ event:[String:Any]) {
        guard let type=event["type"] as? String else{return}
        switch type {
        case "welcome":
            websocketReady=true
            status="공개 영상방 연결됨 · 실제 원격 미디어 수신 대기"
            for raw in event["peers"] as? [[String:Any]] ?? [] {
                guard let id=raw["peerId"] as? String,let userId=raw["userId"] as? String else{continue}
                _=makePeer(id:id,userId:userId)
            }
            Task {await refresh()}
        case "peer-joined":
            guard let id=event["peerId"] as? String,let userId=event["userId"] as? String else{return}
            // The existing peer sends the offer, just as in React's mesh adapter.
            makePeer(id:id,userId:userId)?.offer()
            Task {await refresh()}
        case "peer-left":
            guard let id=event["peerId"] as? String else{return}
            peers.removeValue(forKey:id)?.close()
            connectedPeerIDs.remove(id)
            remote.removeAll{$0.id==id}
            Task {await refresh()}
        case "signal":
            guard let from=event["from"] as? String,
                  let userId=event["userId"] as? String,
                  let data=event["data"] as? [String:Any],
                  let peer=makePeer(id:from,userId:userId) else{return}
            if let desc=data["description"] as? [String:Any] {peer.receiveDescription(desc)}
            if let candidate=data["candidate"] as? [String:Any] {peer.receiveCandidate(candidate)}
        case "room-ended":
            leave()
            status="방장이 대화방을 종료했습니다."
            Task {await refresh()}
        default:break
        }
    }

    private func makePeer(id:String,userId:String)->HitelNativeMeshPeer? {
        if let existing=peers[id] {return existing}
        guard let videoCore,let peer=HitelNativeMeshPeer(peerId:id,userId:userId,video:videoCore) else{return nil}
        peer.onSignal={ [weak self] payload in
            Task { @MainActor [weak self] in self?.send(to:id,payload:payload) }
        }
        peer.onRemoteTrack={ [weak self] track in
            Task { @MainActor [weak self] in
                guard let self else{return}
                let name=self.room?.participants.first(where:{$0.userId==userId})?.displayName ?? userId
                if let index=self.remote.firstIndex(where:{$0.id==id}) {
                    self.remote[index].track=track
                }else{
                    self.remote.append(.init(id:id,userId:userId,name:name,track:track))
                }
                #if targetEnvironment(simulator)
                self.nativeMediaObserved=true
                self.persistNativeMediaEvidence("NATIVE_RECEIVED_BROWSER_VIDEO_TRACK_PASS")
                #endif
            }
        }
        peer.onICEState={ [weak self] state in
            Task { @MainActor [weak self] in
                if state.lowercased().contains("connected") || state.lowercased().contains("completed") {
                    self?.connectedPeerIDs.insert(id)
                    self?.status="상대방 영상·음성 WebRTC 연결됨"
                    #if targetEnvironment(simulator)
                    if self?.nativeMediaObserved == true {
                        self?.persistNativeMediaEvidence("NATIVE_RECEIVED_BROWSER_VIDEO_TRACK_AND_ICE_CONNECTED_PASS")
                    }
                    #endif
                }else if state.lowercased().contains("failed") {
                    self?.error="상대방 WebRTC 경로 연결 실패 · TURN 서버가 필요할 수 있습니다."
                }
            }
        }
        peer.onError={ [weak self] problem in
            Task { @MainActor [weak self] in self?.error="WebRTC: "+problem }
        }
        peers[id]=peer
        return peer
    }

    private func send(to peerId:String,payload:[String:Any]) {
        guard websocketReady,let socket,
              JSONSerialization.isValidJSONObject(payload) else{return}
        let message:[String:Any]=["type":"signal","to":peerId,"data":payload]
        guard let data=try? JSONSerialization.data(withJSONObject:message),
              let text=String(data:data,encoding:.utf8) else{return}
        Task {do{try await socket.send(.string(text))}
              catch{self.error="WebSocket 전송 실패: "+error.localizedDescription}}
    }

    func toggleMic() {
        microphoneEnabled.toggle()
        videoCore?.setMicrophoneEnabled(microphoneEnabled)
    }
    func toggleCamera() {
        cameraEnabled.toggle()
        videoCore?.setCameraEnabled(cameraEnabled)
    }
    func changeCameraMode(_ mode:HitelNativeVideoCore.Mode) {
        cameraMode=mode
        videoCore?.mode=mode
        // Identical outbound track, transformed by native Vision before encoding.
    }

    func leave() {
        receiver?.cancel();receiver=nil
        socket?.cancel(with:.normalClosure,reason:nil);socket=nil
        websocketReady=false
        for peer in peers.values {peer.close()}
        peers.removeAll();connectedPeerIDs.removeAll()
        remote.removeAll()
        videoCore?.stop();videoCore=nil
        room=nil
        microphoneEnabled=true;cameraEnabled=true
        cameraMode = .original
        status="공개방 목록"
    }

    func endRoom() async {
        guard let room,let identity,isHost else{return}
        busy=true
        do {
            _=try await sdk.end(room.id,identity:identity)
            leave()
            await refresh()
        }catch{self.error="대화방 종료 실패: "+error.localizedDescription}
        busy=false
    }

    func logout() {
        leave()
        poller?.cancel();poller=nil
        identity=nil;rooms=[]
        error="";status="로그인 후 공개방에 접속합니다."
    }
    private func startPolling() {
        poller?.cancel()
        poller=Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for:.seconds(4))
                if Task.isCancelled {break}
                await self?.refresh()
            }
        }
    }
    private func loadAIStatus() async {
        do {
            let state=try await aiSDK.participantStatus()
            aiStatus=state.participantEnabled ? "AI 상담 서버 사용 가능 (방 참여 여부는 별도)" :
                "AI 상담 서버 참가자 미활성"
        }catch{aiStatus="AI 상담 서버 연결 확인 실패"}
    }
}
