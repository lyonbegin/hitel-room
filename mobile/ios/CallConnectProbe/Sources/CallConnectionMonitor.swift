import Foundation
import Combine
import CallKit

enum ProbeEvidence {
    private static let key = "hitel.callconnection.probe.events"

    static func append(_ message: String) {
        let stamp = ISO8601DateFormatter().string(from: Date())
        let defaults = UserDefaults.standard
        var rows = defaults.stringArray(forKey: key) ?? []
        rows.append("\(stamp) | \(message)")
        defaults.set(Array(rows.suffix(160)), forKey: key)
    }

    static func events() -> [String] {
        UserDefaults.standard.stringArray(forKey: key) ?? []
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}

enum ProbeCallState {
    static func current(_ calls: [CXCall]) -> String {
        let active = calls.filter { !$0.hasEnded }
        if active.contains(where: { $0.hasConnected && !$0.isOnHold }) { return "connected" }
        if active.contains(where: { $0.isOnHold }) { return "held" }
        if active.contains(where: { $0.isOutgoing }) { return "dialing" }
        if !active.isEmpty { return "ringing" }
        return "idle"
    }

    static func connected(_ calls: [CXCall]) -> Bool {
        calls.contains { $0.hasConnected && !$0.hasEnded && !$0.isOnHold }
    }
}

/// CallKit reports system call states, including some VoIP calls.
/// A regular third-party app is NOT guaranteed to stay running in background.
final class CallConnectionMonitor: NSObject, ObservableObject, CXCallObserverDelegate {
    static let shared = CallConnectionMonitor()

    @Published private(set) var state: String = "idle"
    @Published private(set) var connected = false
    @Published private(set) var count = 0
    @Published private(set) var lastChecked = "아직 없음"
    @Published private(set) var recentEvidence: [String] = []
    private let observer = CXCallObserver()
    private var previousState = "uninitialized"

    private override init() {
        super.init()
        observer.setDelegate(self, queue: .main)
        refresh(reason: "CallKit 관찰 시작")
    }

    func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        refresh(reason: "CallKit 상태 변경 수신")
    }

    func refresh(reason: String = "직접 조회") {
        let calls = observer.calls
        let next = ProbeCallState.current(calls)
        count = calls.filter { !$0.hasEnded }.count
        connected = ProbeCallState.connected(calls)
        state = next
        lastChecked = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        if next != previousState {
            ProbeEvidence.append("\(reason): \(previousState) → \(next), 연결=\(connected)")
            previousState = next
        }
        recentEvidence = Array(ProbeEvidence.events().suffix(35).reversed())
    }

    func clearEvents() {
        ProbeEvidence.clear()
        previousState = "uninitialized"
        refresh(reason: "측정 초기화")
    }
}
