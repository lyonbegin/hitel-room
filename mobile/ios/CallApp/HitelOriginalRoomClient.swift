import Foundation
import Combine
import WebRTC
import AVFoundation
import UIKit

/// The deployed /webrtc-room uses Railway /api/public-rooms with WebRTC mesh,
/// NOT the legacy /realtime Socket.IO mediasoup namespace.
struct HitelOriginalRoom: Decodable, Identifiable {
    let id: String
    let title: String?
    let status: String
    let type: String?
    let policy: RoomPolicy?
    let hostUserIds: [String]?
    struct RoomPolicy: Decodable {
        let allowUnlistedParticipants: Bool?
    }
    var joinable: Bool {
        status == "LIVE" && type == "PUBLIC_ROOM" &&
        policy?.allowUnlistedParticipants == true
    }
}

@MainActor
final class HitelOriginalRoomClient: ObservableObject {
    @Published var userID: String
    @Published var displayName = "iPhone 사용자"
    @Published private(set) var rooms: [HitelOriginalRoom] = []
    @Published private(set) var status = "공개방 서버 연결 대기"
    @Published private(set) var joinedRoomID: String?
    @Published private(set) var isHost = false
    @Published private(set) var remoteVideos: [HitelMeshRemoteVideo] = []
    @Published private(set) var localTrack: RTCVideoTrack?
    @Published private(set) var maskView: UIView?
    @Published private(set) var isMaskMode = false
    @Published private(set) var faceTracked = false
    @Published private(set) var localCaptureFPS: Double = 0
    @Published private(set) var localFirstFrame = false
    @Published private(set) var mediaConnected = false
    @Published private(set) var remoteFrameIDs: Set<String> = []
    @Published private(set) var connectedPeerIDs: Set<String> = []
    @Published private(set) var micEnabled = true
    @Published private(set) var camEnabled = true

    private let origin = URL(string:"https://hitel-room-production-ecce.up.railway.app")!
    private let identityKey = "app.hitel.call.public-room-user-v1"
    private var refreshing = false
    private var token: String?
    private var authenticatedUserID: String?
    private var authenticatedDisplayName: String?
    private var media: HitelPublicMeshMedia?

    init() {
        if let saved=UserDefaults.standard.string(forKey:identityKey), !saved.isEmpty {
            userID=saved
        } else {
            let id="iphone-"+UUID().uuidString.lowercased()
            userID=id
            UserDefaults.standard.set(id,forKey:identityKey)
        }
    }

    private func request(_ path:String,method:String="GET",
                         body:[String:Any]?=nil,bearer:String?=nil) async throws -> Data {
        var req=URLRequest(url:origin.appendingPathComponent(String(path.dropFirst())))
        req.httpMethod=method
        req.setValue("no-store",forHTTPHeaderField:"Cache-Control")
        if let bearer { req.setValue("Bearer "+bearer,forHTTPHeaderField:"Authorization") }
        if let body {
            req.setValue("application/json",forHTTPHeaderField:"Content-Type")
            req.httpBody=try JSONSerialization.data(withJSONObject:body)
        }
        let (data,response)=try await URLSession.shared.data(for:req)
        let http=response as? HTTPURLResponse
        guard let status=http?.statusCode,(200...299).contains(status) else {
            let value=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any]
            let message=value?["message"] as? String ?? value?["error"] as? String
                ?? "HTTP "+String(http?.statusCode ?? 0)
            throw NSError(domain:"HITELPublicRoom",code:http?.statusCode ?? -1,
                userInfo:[NSLocalizedDescriptionKey:message])
        }
        return data
    }

    func refreshRooms() async {
        guard !refreshing else {return}
        refreshing=true
        defer {refreshing=false}
        do {
            if token == nil || authenticatedUserID != userID ||
                authenticatedDisplayName != displayName {
                status="기존 HITEL 웹과 동일한 사용자 인증 중"
                let data=try await request("/api/auth/dev-token",method:"POST",body:[
                    "userId":userID,"name":displayName,"platformRole":"user"])
                let object=try JSONSerialization.jsonObject(with:data) as? [String:Any]
                guard let access=object?["accessToken"] as? String,!access.isEmpty else {
                    throw NSError(domain:"HITELPublicRoom",code:2,
                        userInfo:[NSLocalizedDescriptionKey:"웹 공통 JWT 발급에 실패했습니다."])
                }
                token=access
                authenticatedUserID=userID
                authenticatedDisplayName=displayName
                UserDefaults.standard.set(userID,forKey:identityKey)
            }
            guard let token else {return}
            let data=try await request("/api/public-rooms",bearer:token)
            rooms=try JSONDecoder().decode([HitelOriginalRoom].self,from:data)
                .filter{$0.joinable}
            if let joinedRoomID, !rooms.contains(where: {$0.id == joinedRoomID}) {
                leave()
                status="서버에서 공개방이 종료되어 목록으로 돌아왔습니다."
            } else if joinedRoomID == nil {
                status="Railway 공개 영상방 "+String(rooms.count)+"개 조회"
            }
        } catch {
            let nsError=error as NSError
            if nsError.code == 401 { token=nil }
            status="공개방 목록 조회 실패: "+error.localizedDescription
            if joinedRoomID == nil { rooms=[] }
        }
    }

    private func authorizeMedia() async throws {
        for medium: AVMediaType in [.video, .audio] {
            let current = AVCaptureDevice.authorizationStatus(for:medium)
            let authorized:Bool
            switch current {
            case .authorized:authorized=true
            case .notDetermined:authorized=await AVCaptureDevice.requestAccess(for:medium)
            case .denied,.restricted:authorized=false
            @unknown default:authorized=false
            }
            if !authorized {
                let label = medium == .video ? "카메라" : "마이크"
                throw NSError(domain:"HITELPermissions",code:403,userInfo:[
                    NSLocalizedDescriptionKey:label+" 접근 권한이 필요합니다. iPhone 설정을 확인해 주십시오."])
            }
        }
    }

    func createPublicRoom(title:String,maxParticipants:Int) async -> HitelOriginalRoom? {
        let cleanTitle=title.trimmingCharacters(in:.whitespacesAndNewlines)
        guard !cleanTitle.isEmpty,(2...32).contains(maxParticipants) else {
            status="방 이름과 정원(2~32명)을 확인해 주십시오."
            return nil
        }
        if token == nil { await refreshRooms() }
        guard let token else {return nil}
        do {
            let data=try await request("/api/public-rooms",method:"POST",body:[
                "title":cleanTitle,"maxParticipants":maxParticipants],bearer:token)
            let room=try JSONDecoder().decode(HitelOriginalRoom.self,from:data)
            guard room.joinable else {
                status="서버에서 공개방 생성 결과를 확인할 수 없습니다."
                return nil
            }
            status="공개 영상방 생성 완료 · 입장 준비"
            return room
        } catch {
            status="공개방 생성 실패: "+error.localizedDescription
            return nil
        }
    }

    func endPublicRoom() async {
        guard isHost,let id=joinedRoomID,let token else {
            status="방장에게만 공개방 종료 권한이 있습니다."
            return
        }
        do {
            let escaped=id.addingPercentEncoding(withAllowedCharacters:.urlPathAllowed) ?? id
            _ = try await request("/api/public-rooms/"+escaped+"/end",
                                  method:"POST",bearer:token)
            leave()
            status="공개 영상방을 종료했습니다."
            await refreshRooms()
        } catch {
            status="공개방 종료 실패: "+error.localizedDescription
        }
    }

    func join(_ room:HitelOriginalRoom) async {
        guard room.joinable else { status="참여 가능한 공개방이 아닙니다.";return }
        guard media == nil else {status="먼저 현재 방에서 나가주십시오.";return}
        guard let token else {status="먼저 공개방 목록을 불러와 주십시오.";return}
        do {
            status="실제 iPhone 카메라·마이크 접근 허용 확인 중"
            try await authorizeMedia()
            status="Railway 공개방 접속권 발급 중"
            let path="/api/public-rooms/"+room.id.addingPercentEncoding(
                withAllowedCharacters:.urlPathAllowed)!+"/join"
            let data=try await request(path,method:"POST",bearer:token)
            guard let payload=try JSONSerialization.jsonObject(with:data) as? [String:Any],
                  let ticket=payload["ticket"] as? String,!ticket.isEmpty,
                  let session=payload["session"] as? [String:Any],
                  session["id"] as? String == room.id,
                  session["status"] as? String == "LIVE",
                  session["type"] as? String == "PUBLIC_ROOM",
                  (session["policy"] as? [String:Any])?["allowUnlistedParticipants"] as? Bool == true else {
                throw NSError(domain:"HITELPublicRoom",code:3,
                    userInfo:[NSLocalizedDescriptionKey:"공개방 접속권/세션 확인 실패"])
            }
            let pathURL="/api/public-rooms/"+room.id.addingPercentEncoding(
                withAllowedCharacters:.urlPathAllowed)!+"/signal"
            var url=URLComponents(url:origin.appendingPathComponent(
                String(pathURL.dropFirst())),resolvingAgainstBaseURL:false)!
            url.scheme="wss"
            guard let address=url.url else {return}
            let next=HitelPublicMeshMedia()
            media=next
            next.onStatus={ [weak self] text in self?.status=text }
            next.onRemote={ [weak self] tracks in
                guard let self else{return}
                self.remoteVideos=tracks
                let ids=Set(tracks.map(\.id))
                self.remoteFrameIDs.formIntersection(ids)
                self.connectedPeerIDs.formIntersection(ids)
                self.mediaConnected = !self.connectedPeerIDs.isEmpty
            }
            next.onRemoteFirstFrame={ [weak self] id in
                self?.remoteFrameIDs.insert(id)
            }
            next.onICEConnected={ [weak self] id in
                self?.connectedPeerIDs.insert(id)
                self?.mediaConnected = true
            }
            next.onFirstFrame={ [weak self] in self?.localFirstFrame=true }
            next.onMaskTracking={ [weak self] tracked in
                guard let self,self.isMaskMode else {return}
                self.faceTracked=tracked
                self.status=tracked
                    ? "ARKit 3D 얼굴 메시 추적 중 · 실제 전송 프레임 확인"
                    : "ARKit 카메라 실행 중 · 얼굴 검출 대기"
            }
            next.onMaskFailure={ [weak self] error in
                guard let self else{return}
                if self.isMaskMode {self.chooseMask(false)}
                self.status="ARKit 가면 영상 오류 · 원본 카메라 복귀: "+error
            }
            next.onFPS={ [weak self] fps in self?.localCaptureFPS=fps }
            next.onEnded={ [weak self] in self?.leave() }
            status="네이티브 WebRTC 공개방에 접속 중"
            try await next.connect(to:address,using:ticket)
            localTrack=next.localVideoTrack
            joinedRoomID=room.id
            isHost=room.hostUserIds?.contains(userID) == true
            mediaConnected=false
            status="공개방 신호 연결됨 · 실제 상대 영상 수신 여부 별도 확인"
        } catch {
            media?.stop();media=nil
            status="공개방 접속 실패: "+error.localizedDescription
        }
    }

    func leave() {
        media?.stop();media=nil
        joinedRoomID=nil
        isHost=false
        remoteVideos=[];localTrack=nil
        localFirstFrame=false;localCaptureFPS=0
        maskView=nil;isMaskMode=false;faceTracked=false
        mediaConnected=false
        remoteFrameIDs=[];connectedPeerIDs=[]
        micEnabled=true;camEnabled=true
        status="공개방 퇴장 · 고유 앱 관리 주소 유지"
    }
    func chooseMask(_ enabled:Bool) {
        guard let media else {return}
        do {
            try media.setMask(enabled)
            maskView=media.maskView
            isMaskMode=enabled
            faceTracked=false
            localFirstFrame=false
            localCaptureFPS=0
            if enabled {
                DispatchQueue.main.asyncAfter(deadline:.now()+8) {[weak self] in
                    guard let self,self.isMaskMode,!self.localFirstFrame else {return}
                    self.chooseMask(false)
                    self.status = self.isMaskMode
                        ? "ARKit 첫 프레임 8초 미수신 · 원본 카메라 복구 실패"
                        : "ARKit 가면 프레임 미수신으로 원본 카메라를 복구했습니다."
                }
            }
        } catch {
            status="가면 영상 전환 실패: "+error.localizedDescription
        }
    }
    func toggleMicrophone(){ micEnabled.toggle();media?.microphone(micEnabled) }
    func toggleCamera(){ camEnabled.toggle();media?.camera(camEnabled) }
}
