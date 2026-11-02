import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Native counterpart of ai_counselor_sdk/src/sdk/index.js (AI Counselor 1.1.0).
/// Requests go to the existing AI Counselor runtime; no API provider secret is embedded in the app.
final class HitelNativeAICounselor {
    static let sdkVersion = "1.1.0"
    private let endpoint: URL
    private let http: URLSession
    private let accessToken: String?
    private(set) var sessionId: String
    private(set) var profile: [String: Any]

    enum CounselorError: LocalizedError {
        case invalidText
        case runtimeCredentialMissing
        case invalidEndpoint
        case invalidResponse
        case server(Int, String)
        var errorDescription: String? {
            switch self {
            case .invalidText: return "AI 상담 메시지가 비어 있습니다."
            case .runtimeCredentialMissing: return "AI Counselor 서버의 사용자별 인증 연동이 필요합니다. 관리자 토큰을 iPhone 앱에 저장하지 않습니다."
            case .invalidEndpoint: return "AI Counselor 런타임 주소가 잘못되었습니다."
            case .invalidResponse: return "AI Counselor 응답 형식이 올바르지 않습니다."
            case .server(let status, let message): return "AI Counselor HTTP \(status): \(message)"
            }
        }
    }

    private static let defaults: [String: [String: Any]] = [
        "generic": [
            "domain": "general", "name": "AI 상담사", "role": "범용 인공지능 상담사",
            "objective": "요구를 파악하고 적절한 안내를 제공한다.",
            "instructions": ["확인하지 못한 사실을 만들어내지 않는다."], "tools": [String]()
        ],
        "beauty": [
            "domain": "beauty-dermatology", "name": "AI언니", "role": "피부·미용 상담사",
            "objective": "피부·미용 상담 요구를 구조화하고 다음 행동을 안내한다.",
            "instructions": ["의학적 진단을 확정하지 않는다."],
            "tools": ["procedures", "clinics", "booking"]
        ],
        "elderly-care": [
            "domain": "elderly-care", "name": "돌봄 상담사", "role": "장기요양·통합돌봄 상담사",
            "objective": "어르신과 보호자에게 필요한 돌봄을 파악한다.",
            "instructions": ["급여·기관 정보는 실제 제공된 자료를 바탕으로 안내한다."],
            "tools": ["long-term-care", "care-centers", "welfare-equipment"]
        ],
        "tutoring": [
            "domain": "education", "name": "AI 튜터", "role": "개인 과외 상담사",
            "objective": "학습자의 이해와 목표에 맞춰 설명한다.",
            "instructions": ["한 번에 한 개념씩 설명하고 이해도를 확인한다."],
            "tools": ["curriculum", "problems"]
        ],
        "interview": [
            "domain": "career-interview", "name": "AI 면접관", "role": "모의면접 상담사",
            "objective": "모의면접과 구체적 피드백을 제공한다.",
            "instructions": ["질문은 한 번에 하나씩 한다."],
            "tools": ["jobs", "resume", "interview-rubric"]
        ]
    ]

    init(
        endpoint: URL = URL(string: "https://ai-counselor-sdk-production.up.railway.app")!,
        profile: [String: Any] = ["preset": "generic"],
        sessionId: String = UUID().uuidString,
        accessToken: String? = nil,
        http: URLSession = .shared
    ) {
        self.endpoint = endpoint
        self.http = http
        self.sessionId = sessionId
        self.accessToken = accessToken
        self.profile = Self.normalize(profile)
    }

    /// Mirrors normalizeCounselorProfile() from the existing JavaScript SDK.
    static func normalize(_ input: [String: Any]) -> [String: Any] {
        let preset = (input["preset"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "generic"
        let base = defaults[preset] ?? defaults["generic"]!
        func string(_ key: String, _ fallback: String = "") -> String {
            guard let raw = input[key] as? String, !raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                return fallback
            }
            return raw.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        func strings(_ key: String) -> [String] {
            (input[key] as? [String])?.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty } ?? []
        }
        let defaultsPolicy: [String: Any] = [
            "maxReplySentences": 5, "askBeforeAssuming": true,
            "humanHandoffWhenUncertain": true
        ]
        var policy = defaultsPolicy
        if let custom = input["policy"] as? [String: Any] {
            policy.merge(custom) { _, new in new }
        }
        let baseTools = base["tools"] as? [String] ?? []
        let tools = (input["tools"] == nil) ? baseTools : strings("tools")
        let baseInstructions = base["instructions"] as? [String] ?? []
        let instructions = ((input["instructions"] == nil) ? baseInstructions : strings("instructions")) + strings("additionalInstructions")
        return [
            "preset": defaults[preset] != nil ? preset : "custom",
            "id": string("id", preset),
            "domain": string("domain", base["domain"] as? String ?? "general"),
            "name": string("name", base["name"] as? String ?? ""),
            "role": string("role", base["role"] as? String ?? ""),
            "objective": string("objective", base["objective"] as? String ?? ""),
            "language": string("language", "ko"),
            "voice": string("voice", "coral"),
            "instructions": instructions,
            "policy": policy,
            "tools": Array(NSOrderedSet(array: tools)) as? [String] ?? tools,
            "knowledge": strings("knowledge")
        ]
    }

    func getProfile() -> [String: Any] { profile }

    func configure(_ changes: [String: Any]) {
        profile.merge(changes) { _, new in new }
        profile = Self.normalize(profile)
    }

    func usePreset(_ preset: String, overrides: [String: Any] = [:]) throws {
        guard Self.defaults[preset] != nil else { throw CounselorError.invalidResponse }
        var raw = overrides
        raw["preset"] = preset
        profile = Self.normalize(raw)
    }

    func respond(_ text: String, context: [String: Any] = [:]) async throws -> [String: Any] {
        let message = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { throw CounselorError.invalidText }
        guard let accessToken, !accessToken.isEmpty else { throw CounselorError.runtimeCredentialMissing }
        return try await request(
            "/v1/respond",
            body: ["sessionId": sessionId, "profile": profile, "text": message, "context": context]
        )
    }

    func reset() async throws {
        guard let accessToken, !accessToken.isEmpty else { throw CounselorError.runtimeCredentialMissing }
        _ = try await request("/v1/session/reset", body: ["sessionId": sessionId])
        sessionId = UUID().uuidString
    }

    private func request(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        guard let url = URL(string: path, relativeTo: endpoint)?.absoluteURL else {
            throw CounselorError.invalidEndpoint
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 25
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let accessToken, !accessToken.isEmpty {
            req.setValue("Bearer " + accessToken, forHTTPHeaderField: "Authorization")
        }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await http.data(for: req)
        guard let status = (response as? HTTPURLResponse)?.statusCode else {
            throw CounselorError.invalidResponse
        }
        let parsed = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard (200..<300).contains(status) else {
            throw CounselorError.server(status, parsed["error"] as? String ?? "요청 실패")
        }
        return parsed
    }
}
