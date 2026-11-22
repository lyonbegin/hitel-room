import Foundation
import WebRTC

/// Swift-native counterpart of Communication SDK 0.1.0's public call contract.
/// It does not execute JavaScript or require WKWebView.
enum HitelEndpointKind: String, Codable, CaseIterable {
    case p = "P"
    case pPlus = "P+"
    case n = "N"
    case w = "W"
}

struct HitelNativeRoute {
    let id: Int
    let from: HitelEndpointKind
    let to: HitelEndpointKind
    var needsPstnGateway: Bool {
        [from, to].contains(.p) || [from, to].contains(.pPlus)
    }
}

/// A native adapter must implement the *existing HITEL* authenticated
/// session:join/ready/start and mediasoup rtc:join/transport/produce/consume contract.
/// Returning a session after only a WebSocket handshake is NOT a connected call.
protocol HitelNativeRoomSession: AnyObject {
    func leave() async
}
protocol HitelNativeRoomAdapter: AnyObject {
    func join(
        roomId: String,
        videoTrack: RTCVideoTrack,
        profile: [String: Any]?
    ) async throws -> HitelNativeRoomSession
}

enum HitelNativeCommunicationError: LocalizedError {
    case activeSession
    case missingRoomId
    case unsupportedPhoneNetwork
    var errorDescription: String? {
        switch self {
        case .activeSession: return "이미 진행 중인 HITEL 통화 세션이 있습니다."
        case .missingRoomId: return "HITEL 서버 통화방 ID가 없습니다."
        case .unsupportedPhoneNetwork: return "일반전화 통신사 음성 게이트웨이는 연결되지 않았습니다."
        }
    }
}

final class HitelNativeCommunicationSDK {
    static let sdkVersion = "0.1.0-native-contract"
    let counselor: HitelNativeAICounselor
    private var activeRoom: HitelNativeRoomSession?

    init(counselor: HitelNativeAICounselor = HitelNativeAICounselor()) {
        self.counselor = counselor
    }

    static func create() -> HitelNativeCommunicationSDK { HitelNativeCommunicationSDK() }

    /// Same numbering as communication-sdk/index.ts (P, P+, N, W × P, P+, N, W).
    func describeRoute(from: HitelEndpointKind, to: HitelEndpointKind) -> HitelNativeRoute {
        let all = HitelEndpointKind.allCases
        let id = all.firstIndex(of: from)! * 4 + all.firstIndex(of: to)! + 1
        return HitelNativeRoute(id: id, from: from, to: to)
    }

    func respondWithAI(
        _ text: String,
        context: [String: Any] = [:]
    ) async throws -> [String: Any] {
        try await counselor.respond(text, context: context)
    }

    /// Only a real, authenticated native SFU adapter is accepted.
    /// The existing iPhone P2P playground is NOT an implementation of this adapter.
    func joinRoom(
        _ roomId: String,
        videoCore: HitelNativeVideoCore,
        adapter: HitelNativeRoomAdapter,
        profile: [String: Any]? = nil
    ) async throws {
        guard activeRoom == nil else { throw HitelNativeCommunicationError.activeSession }
        guard !roomId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw HitelNativeCommunicationError.missingRoomId
        }
        let track = try videoCore.openCamera(mode: .original)
        activeRoom = try await adapter.join(roomId: roomId, videoTrack: track, profile: profile)
    }

    func joinAICounselorRoom(
        _ roomId: String,
        videoCore: HitelNativeVideoCore,
        adapter: HitelNativeRoomAdapter
    ) async throws {
        try await joinRoom(
            roomId, videoCore: videoCore, adapter: adapter,
            profile: counselor.getProfile()
        )
    }

    func leaveRoom() async {
        let prior = activeRoom
        activeRoom = nil
        await prior?.leave()
    }
}
