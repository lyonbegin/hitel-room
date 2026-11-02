import Foundation

// Same REST contract and Railway database as the React Communication SDK.
// Swift implementation deliberately contains no WKWebView or JavaScript.
struct HitelPublicMember: Decodable, Identifiable {
    let userId: String
    let displayName: String?
    let role: String
    let presence: String
    var id: String { userId }
}
struct HitelPublicPolicy: Decodable {
    let maxParticipants: Int
    let allowUnlistedParticipants: Bool
}
struct HitelPublicRoom: Decodable, Identifiable {
    let id: String
    let title: String
    let type: String
    let status: String
    let hostUserIds: [String]
    let participants: [HitelPublicMember]
    let policy: HitelPublicPolicy
    var memberCount: Int { participants.filter { $0.presence != "LEFT" }.count }
}
struct HitelNativeIdentity {
    let userId: String
    let name: String
    let platformRole: String
    let accessToken: String
}
struct HitelRoomAdmission: Decodable {
    let session: HitelPublicRoom
    let ticket: String
}
struct HitelRoomEnd: Decodable {
    let session: HitelPublicRoom
}
struct HitelNativeAPIError: Error, LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

struct HitelNativeCommunicationSDK {
    // This is the SAME production web origin, not a separate iPhone-only room API.
    static let origin = URL(string: "https://hitel-room-production-ecce.up.railway.app")!
    private let json = JSONDecoder()

    func authenticate(userId: String, name: String, role: String) async throws -> HitelNativeIdentity {
        struct Body: Encodable { let userId: String; let name: String; let platformRole: String }
        struct Response: Decodable { let accessToken: String }
        let data: Response = try await request("/api/auth/dev-token", method: "POST",
                                             body: Body(userId: userId, name: name, platformRole: role))
        return .init(userId: userId, name: name, platformRole: role, accessToken: data.accessToken)
    }

    func list(identity: HitelNativeIdentity) async throws -> [HitelPublicRoom] {
        try await request("/api/public-rooms", identity: identity)
    }

    func get(_ roomId: String, identity: HitelNativeIdentity) async throws -> HitelPublicRoom {
        try await request("/api/public-rooms/\(roomId)", identity: identity)
    }

    func create(title: String, capacity: Int, identity: HitelNativeIdentity) async throws -> HitelPublicRoom {
        struct Body: Encodable { let title: String; let maxParticipants: Int }
        return try await request("/api/public-rooms", method: "POST",
                                 identity: identity, body: Body(title:title,maxParticipants:capacity))
    }

    func join(_ roomId: String, identity: HitelNativeIdentity) async throws -> HitelRoomAdmission {
        try await request("/api/public-rooms/\(roomId)/join", method: "POST", identity: identity)
    }

    func end(_ roomId: String, identity: HitelNativeIdentity) async throws -> HitelPublicRoom {
        let result: HitelRoomEnd = try await request("/api/public-rooms/\(roomId)/end",
                                                     method: "POST",identity:identity)
        return result.session
    }

    func webSocket(roomId: String, ticket: String) -> URLSessionWebSocketTask {
        let origin = Self.origin.absoluteString
            .replacingOccurrences(of: "https://", with: "wss://")
        let url = URL(string: origin + "/api/public-rooms/" + roomId + "/signal")!
        // The same one-time Railway ticket and subprotocol accepted by React:
        // Sec-WebSocket-Protocol: hitel-public, ticket.<opaque>
        return URLSession.shared.webSocketTask(with: url,
                                                protocols: ["hitel-public", "ticket." + ticket])
    }

    private func request<Result: Decodable, Body: Encodable>(
        _ path: String, method: String = "GET",
        identity: HitelNativeIdentity? = nil, body: Body? = nil
    ) async throws -> Result {
        guard let url = URL(string: path, relativeTo: Self.origin)?.absoluteURL else {
            throw HitelNativeAPIError(message:"서버 URL 오류")
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = 15
        req.setValue("no-store",forHTTPHeaderField:"Cache-Control")
        if let identity {
            req.setValue("Bearer " + identity.accessToken,forHTTPHeaderField:"Authorization")
        }
        if let body {
            req.httpBody = try JSONEncoder().encode(body)
            req.setValue("application/json",forHTTPHeaderField:"Content-Type")
        }
        let (data,response) = try await URLSession.shared.data(for:req)
        guard let response = response as? HTTPURLResponse else {
            throw HitelNativeAPIError(message:"서버 응답이 유효하지 않습니다.")
        }
        guard (200...299).contains(response.statusCode) else {
            struct Message: Decodable { let detail: String?; let message: String?; let error: String? }
            let problem = try? JSONDecoder().decode(Message.self,from:data)
            throw HitelNativeAPIError(message:problem?.detail ?? problem?.message ?? problem?.error ??
                                          "공개방 서버 HTTP \(response.statusCode)")
        }
        return try json.decode(Result.self,from:data)
    }

    private func request<Result: Decodable>(
        _ path: String,method: String = "GET",identity: HitelNativeIdentity? = nil
    ) async throws -> Result {
        try await request(path,method:method,identity:identity,body:Optional<Empty>.none)
    }
    private struct Empty: Encodable {}
}
