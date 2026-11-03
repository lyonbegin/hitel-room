import Foundation
import Combine
import SocketIO

/// Native client for the ORIGINAL HITEL Room API and Socket.IO namespace.
/// This is not the independent /lab-sandbox/playground WSS service.
struct HitelOriginalRoom: Decodable, Identifiable {
    let id: String
    let title: String?
    let status: String
}

@MainActor
final class HitelOriginalRoomClient: ObservableObject {
    @Published var userID: String
    @Published var displayName: String = "iPhone 사용자"
    @Published private(set) var rooms: [HitelOriginalRoom] = []
    @Published private(set) var status: String = "기존 HITEL 공개방 서버 연결 대기"
    @Published private(set) var socketReady = false
    @Published private(set) var joinedRoomID: String?
    @Published private(set) var routerCapabilitiesReceived = false

    private let origin = URL(string: "https://hitel-room-production-ecce.up.railway.app")!
    private var manager: SocketManager?
    private var socket: SocketIOClient?
    private var token: String?
    private let identityKey = "app.hitel.call.original-room-identity.v1"

    init() {
        if let saved = UserDefaults.standard.string(forKey: identityKey), !saved.isEmpty {
            userID = saved
        } else {
            let value = "iphone-" + UUID().uuidString.lowercased()
            UserDefaults.standard.set(value, forKey: identityKey)
            userID = value
        }
    }

    /// Identical REST endpoints to src/lib/api.ts on the original web app.
    func refreshRooms() async {
        status = "원본 HITEL 서버에서 사용자 인증 중"
        do {
            let identity = [
                "userId": userID.trimmingCharacters(in: .whitespacesAndNewlines),
                "name": displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                "platformRole": "user"
            ]
            guard !identity["userId", default: ""].isEmpty,
                  !identity["name", default: ""].isEmpty else {
                status = "사용자 ID와 표시 이름이 필요합니다."
                return
            }
            let response = try await request("/api/auth/dev-token", method: "POST", json: identity)
            guard let accessToken = response["accessToken"] as? String,
                  !accessToken.isEmpty else {
                throw NSError(domain:"HITEL",code:1,userInfo:[NSLocalizedDescriptionKey:"JWT 발급 응답에 accessToken이 없습니다."])
            }
            token = accessToken
            let data = try await requestData("/api/telemedicine/consultations/me", bearer: accessToken)
            let list = try JSONDecoder().decode([HitelOriginalRoom].self, from: data)
            rooms = list
            status = "원본 HITEL 서버에서 방 \(list.count)개 조회 · Socket.IO 연결 중"
            connectSocket(accessToken)
        } catch {
            status = "원본 HITEL 서버 인증/목록 실패: " + error.localizedDescription
            socketReady = false
            rooms = []
        }
    }

    private func request(_ path: String, method: String, json: [String: String]) async throws -> [String:Any] {
        var req = URLRequest(url: origin.appendingPathComponent(String(path.dropFirst())))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField:"Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: json)
        let (data, response) = try await URLSession.shared.data(for: req)
        try validate(response: response, data: data)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String:Any] else {
            throw NSError(domain:"HITEL",code:2,userInfo:[NSLocalizedDescriptionKey:"인증 응답 형식 오류"])
        }
        return object
    }

    private func requestData(_ path: String, bearer: String) async throws -> Data {
        var req = URLRequest(url: origin.appendingPathComponent(String(path.dropFirst())))
        req.setValue("Bearer " + bearer, forHTTPHeaderField:"Authorization")
        let (data,response) = try await URLSession.shared.data(for:req)
        try validate(response:response,data:data)
        return data
    }

    private func validate(response:URLResponse, data:Data) throws {
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let http = response as? HTTPURLResponse
            let raw = (try? JSONSerialization.jsonObject(with:data)) as? [String:Any]
            let message = raw?["message"] as? String ?? raw?["error"] as? String
                ?? "HTTP \(http?.statusCode ?? 0)"
            throw NSError(domain:"HITEL",code:http?.statusCode ?? -1,
                          userInfo:[NSLocalizedDescriptionKey:message])
        }
    }

    /// JS web: io(`${origin}/realtime`, { transports: ['websocket'], auth: {token} }).
    /// Swift Socket.IO namespace connect payload is its namespace auth object.
    private func connectSocket(_ accessToken: String) {
        socket?.disconnect()
        socket?.removeAllHandlers()
        socketReady = false
        joinedRoomID = nil
        routerCapabilitiesReceived = false
        let m = SocketManager(socketURL: origin,
                              config:[.log(false), .forceWebsockets(true),
                                      .reconnects(true), .handleQueue(DispatchQueue.main)])
        let s = m.socket(forNamespace:"/realtime")
        manager = m
        socket = s
        s.on("connection:ready") { [weak self] _, _ in
            self?.socketReady = true
            self?.status = "원본 HITEL /realtime Socket.IO 인증 완료 · 실제 미디어 미연결"
        }
        s.on("connection:error") { [weak self] data, _ in
            self?.socketReady = false
            self?.status = "원본 HITEL 인증 거부: " + String(describing:data.first ?? "unknown")
        }
        s.on(clientEvent:.connectError) { [weak self] data, _ in
            self?.socketReady = false
            self?.status = "원본 HITEL Socket.IO 연결 실패: " + String(describing:data.first ?? "unknown")
        }
        s.on(clientEvent:.disconnect) { [weak self] _, _ in
            self?.socketReady = false
            self?.routerCapabilitiesReceived = false
            self?.status = "원본 HITEL 실시간 서버 연결 끊김 · 복구 대기"
        }
        s.on("session:started") { [weak self] _,_ in
            self?.status = "서버에서 대화 시작 이벤트 수신 · 실제 영상은 별도 연결 필요"
        }
        s.on("session:ended") { [weak self] _,_ in
            self?.joinedRoomID = nil
            self?.routerCapabilitiesReceived = false
            self?.status = "원본 HITEL 방 종료 통지"
        }
        s.connect(withPayload:["token":accessToken])
    }

    /// Server ACK must contain { ok: true, data: { session: ... } }.
    /// A successful ACK is ONLY room signaling, never media connected.
    func join(_ room: HitelOriginalRoom) {
        guard socketReady, let socket else {
            status = "Socket.IO 인증 완료 후 방에 입장할 수 있습니다."
            return
        }
        status = "원본 HITEL 서버에 방 입장 요청 중"
        socket.emitWithAck("session:join", ["sessionId": room.id])
            .timingOut(after:15) { [weak self] reply in
                guard let self else { return }
                if let data = reply.first as? [String:Any], data["ok"] as? Bool == true,
                   let payload = data["data"] as? [String:Any], payload["session"] != nil {
                    self.joinedRoomID = room.id
                    self.routerCapabilitiesReceived = false
                    self.status = "원본 HITEL 방 입장 ACK 확인 · mediasoup 영상 미연결"
                } else {
                    let response = reply.first as? [String:Any]
                    let error = response?["error"] as? [String:Any]
                    self.status = "방 입장 거부/시간 초과: " +
                        (error?["message"] as? String ?? "서버 ACK 불일치")
                }
            }
    }

    func markReady() {
        guard socketReady, let roomID = joinedRoomID, let socket else { return }
        socket.emitWithAck("session:ready", ["sessionId":roomID,"ready":true])
            .timingOut(after:15) { [weak self] reply in
                guard let self else { return }
                if let ack = reply.first as? [String:Any], ack["ok"] as? Bool == true {
                    self.status = "기존 HITEL 방 준비 완료 ACK · 미디어 미연결"
                } else {
                    self.status = "서버 준비 요청 거부/시간 초과"
                }
            }
    }

    /// Read actual router capabilities; do not mistake this for an RTC transport.
    func verifySFURouter() {
        guard socketReady, let roomID = joinedRoomID, let socket else { return }
        routerCapabilitiesReceived = false
        status = "기존 HITEL mediasoup rtc:join 요청 중"
        socket.emitWithAck("rtc:join", ["sessionId":roomID,"resume":false])
            .timingOut(after:15) { [weak self] reply in
                guard let self else { return }
                guard let ack = reply.first as? [String:Any], ack["ok"] as? Bool == true,
                      let payload = ack["data"] as? [String:Any],
                      let caps = payload["routerRtpCapabilities"] as? [String:Any],
                      caps["codecs"] != nil else {
                    let error = (reply.first as? [String:Any])?["error"] as? [String:Any]
                    self.status = "SFU 라우터 접속 실패: " +
                        (error?["message"] as? String ?? "ACK/Capabilities 확인 필요")
                    return
                }
                self.routerCapabilitiesReceived = true
                self.status = "mediasoup 라우터 기능 협상 완료 · 전송/수신 트랙 미연결"
            }
    }

    func leave() {
        guard let roomID = joinedRoomID else { return }
        socket?.emit("session:leave", ["sessionId":roomID])
        joinedRoomID = nil
        routerCapabilitiesReceived = false
        status = "원본 HITEL 방 퇴장 신호 전송 · 고유 앱 웹주소는 유지"
    }
}
