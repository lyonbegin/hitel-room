import Foundation
import Combine
import WebRTC

/// The deployed /webrtc-room uses Railway /api/public-rooms with WebRTC mesh,
/// NOT the legacy /realtime Socket.IO mediasoup namespace.
struct HitelOriginalRoom: Decodable, Identifiable {
    let id: String
    let title: String?
    let status: String
    let type: String?
    let policy: RoomPolicy?
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
    @Published private(set) var remoteVideos: [HitelMeshRemoteVideo] = []
    @Published private(set) var localTrack: RTCVideoTrack?
    @Published private(set) var localCaptureFPS: Double = 0
    @Published private(set) var localFirstFrame = false
    @Published private(set) var mediaConnected = false

    private let origin = URL(string:"https://hitel-room-production-ecce.up.railway.app")!
    private let identityKey = "app.hitel.call.public-room-user-v1"
    private var token: String?
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
        do {
            if token == nil {
                status="기존 HITEL 웹과 동일한 사용자 인증 중"
                let data=try await request("/api/auth/dev-token",method:"POST",body:[
                    "userId":userID,"name":displayName,"platformRole":"user"])
                let object=try JSONSerialization.jsonObject(with:data) as? [String:Any]
                guard let access=object?["accessToken"] as? String,!access.isEmpty else {
                    throw NSError(domain:"HITELPublicRoom",code:2,
                        userInfo:[NSLocalizedDescriptionKey:"웹 공통 JWT 발급에 실패했습니다."])
                }
                token=access
            }
            guard let token else {return}
            let data=try await request("/api/public-rooms",bearer:token)
            rooms=try JSONDecoder().decode([HitelOriginalRoom].self,from:data)
                .filter{$0.joinable}
            status="Railway 공개 영상방 "+String(rooms.count)+"개 조회"
        } catch {
            status="공개방 목록 조회 실패: "+error.localizedDescription
            rooms=[]
        }
    }

    func join(_ room:HitelOriginalRoom) async {
        guard room.joinable else { status="참여 가능한 공개방이 아닙니다.";return }
        guard media == nil else {status="먼저 현재 방에서 나가주십시오.";return}
        guard let token else {status="먼저 공개방 목록을 불러와 주십시오.";return}
        do {
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
            next.onRemote={ [weak self] tracks in self?.remoteVideos=tracks }
            next.onFirstFrame={ [weak self] in self?.localFirstFrame=true }
            next.onFPS={ [weak self] fps in self?.localCaptureFPS=fps }
            next.onEnded={ [weak self] in self?.leave() }
            status="네이티브 WebRTC 공개방에 접속 중"
            try await next.connect(to:address,using:ticket)
            localTrack=next.localVideoTrack
            joinedRoomID=room.id
            mediaConnected=true
            status="공개방 신호 연결됨 · 실제 상대 영상 수신 여부 별도 확인"
        } catch {
            media?.stop();media=nil
            status="공개방 접속 실패: "+error.localizedDescription
        }
    }

    func leave() {
        media?.stop();media=nil
        joinedRoomID=nil
        remoteVideos=[];localTrack=nil
        localFirstFrame=false;localCaptureFPS=0
        mediaConnected=false
        status="공개방 퇴장 · 고유 앱 관리 주소 유지"
    }
    func microphone(_ enabled:Bool){media?.microphone(enabled)}
    func camera(_ enabled:Bool){media?.camera(enabled)}
}
