import Foundation

/// Swift counterpart of AICounselor 1.1.0's domain/profile and server-participant
/// status contracts. It NEVER embeds RUNTIME_API_TOKEN or OPENAI_API_KEY in the app.
/// AI is a separate optional server participant, not a fabricated local peer.
struct HitelNativeCounselorProfile: Identifiable, Hashable {
    let id: String
    let label: String
    let role: String
}
struct HitelNativeAISDK {
    static let runtime = URL(string:"https://ai-counselor-sdk-production.up.railway.app")!
    static let profiles: [HitelNativeCounselorProfile] = [
        .init(id:"generic",label:"일반 상담",role:"상담사"),
        .init(id:"elderly-care",label:"고령자 돌봄",role:"돌봄 상담사"),
        .init(id:"beauty",label:"뷰티 상담",role:"뷰티 상담사"),
        .init(id:"tutoring",label:"교육 상담",role:"학습 상담사"),
        .init(id:"interview",label:"면접 상담",role:"면접 상담사")
    ]
    struct Status: Decodable {
        let participantEnabled: Bool
    }
    func participantStatus() async throws -> Status {
        let url = Self.runtime.appendingPathComponent("v1/rooms/status")
        let (data,response) = try await URLSession.shared.data(from:url)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw HitelNativeAPIError(message:"AI 상담 서버를 확인할 수 없습니다.")
        }
        return try JSONDecoder().decode(Status.self,from:data)
    }
    // No client-only AI join. An AI participant must be explicitly attached by
    // the server with valid credentials to the SAME roomId, then appear over WSS.
}
