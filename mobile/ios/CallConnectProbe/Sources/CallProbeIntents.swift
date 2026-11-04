import Foundation
import AppIntents
import CallKit

/// Exposes a value to Shortcuts. It does not start system recording.
struct CheckSystemCallConnectedIntent: AppIntent {
    static var title: LocalizedStringResource = "HITEL 통화 연결 여부 확인"
    static var description = IntentDescription("현재 시스템 통화가 연결되어 있는지 읽습니다. 전화 및 일부 VoIP 통화를 구별하지 못합니다.")

    func perform() async throws -> some IntentResult & ReturnsValue<Bool> {
        let observer = CXCallObserver()
        let connected = ProbeCallState.connected(observer.calls)
        let state = ProbeCallState.current(observer.calls)
        ProbeEvidence.append("단축어 연결 조회: \(state), 결과=\(connected)")
        return .result(value: connected)
    }
}

/// A time-bounded polling experiment that Shortcuts can invoke while Phone opens.
/// The Shortcuts runner may suspend or time out; success is not guaranteed.
struct WaitForConnectedSystemCallIntent: AppIntent {
    static var title: LocalizedStringResource = "HITEL 통화 연결 대기 (최대 15초)"
    static var description = IntentDescription("시스템 통화가 연결되면 참을 반환합니다. 시간 초과/중단 시 거짓을 반환합니다. 백그라운드 실행은 실제 기기 검증이 필요합니다.")

    func perform() async throws -> some IntentResult & ReturnsValue<Bool> {
        let observer = CXCallObserver()
        ProbeEvidence.append("단축어 15초 연결 대기 시작")
        for _ in 0..<15 {
            if Task.isCancelled {
                ProbeEvidence.append("단축어 대기 취소")
                return .result(value: false)
            }
            if ProbeCallState.connected(observer.calls) {
                ProbeEvidence.append("단축어 대기 중 연결 감지 성공")
                return .result(value: true)
            }
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
        let result = ProbeCallState.connected(observer.calls)
        ProbeEvidence.append("단축어 15초 경과, 연결=\(result)")
        return .result(value: result)
    }
}

struct HitelProbeShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        [
            AppShortcut(
                intent: CheckSystemCallConnectedIntent(),
                phrases: ["Check phone connection with \(.applicationName)"],
                shortTitle: "통화 연결 확인",
                systemImageName: "phone.connection"
            ),
            AppShortcut(
                intent: WaitForConnectedSystemCallIntent(),
                phrases: ["Wait for phone connection with \(.applicationName)"],
                shortTitle: "통화 연결 대기",
                systemImageName: "phone.arrow.up.right"
            )
        ]
    }
}
