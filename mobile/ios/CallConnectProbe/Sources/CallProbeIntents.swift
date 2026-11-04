import Foundation
import AppIntents
import CallKit

struct CheckSystemCallConnectedIntent: AppIntent {
    static var title: LocalizedStringResource = "HITEL 통화 연결 여부 확인"
    static var description = IntentDescription("CallKit의 실제 연결 여부만 조회합니다. 일부 VoIP 전화도 포함될 수 있습니다.")

    func perform() async throws -> some IntentResult & ReturnsValue<Bool> {
        let observer = CXCallObserver()
        let connected = ProbeCallState.connected(observer.calls)
        ProbeEvidence.append("단축어 CallKit 연결 조회=" + String(connected))
        return .result(value: connected)
    }
}

struct WaitForConnectedSystemCallIntent: AppIntent {
    static var title: LocalizedStringResource = "HITEL 통화 연결 대기 (최대 15초)"
    static var description = IntentDescription("CallKit에서 시스템 통화 연결을 확인하거나 15초 후 종료합니다.")

    func perform() async throws -> some IntentResult & ReturnsValue<Bool> {
        let observer = CXCallObserver()
        for _ in 0..<15 {
            if Task.isCancelled { return .result(value: false) }
            if ProbeCallState.connected(observer.calls) {
                ProbeEvidence.append("단축어 통화 연결 감지됨")
                return .result(value: true)
            }
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
        let found = ProbeCallState.connected(observer.calls)
        ProbeEvidence.append("단축어 연결 대기 종료 connected=" + String(found))
        return .result(value: found)
    }
}

/// Preserve the previous App Intent's Swift type identity so that an existing
/// Phone-opens Shortcuts automation may keep pointing at the updated action.
/// It NO LONGER synthesizes voice, plays audio, or taps the Phone UI.
/// True means a file-metadata inspection ran, NOT that a call file was found.
struct PlayWhenConnectedIntent: AppIntent {
    static var title: LocalizedStringResource = "HITEL 연결되면 녹음 파일 검사"
    static var description = IntentDescription("전화 연결을 최대 20초 확인하고, 허용된 폴더의 오디오 파일 크기·변경 여부와 Apple 메모 앱 저장소 접근 가능 여부를 반복 기록합니다. 음성은 녹음하지 않습니다.")

    func perform() async throws -> some IntentResult & ReturnsValue<Bool> {
        let observer = CXCallObserver()
        ProbeEvidence.append("자동화 시작: CallKit 연결 대기 (최대 20초)")
        for second in 0..<20 {
            if Task.isCancelled {
                ProbeEvidence.append("FILE-PROBE 자동화 취소 at=" + String(second))
                return .result(value: false)
            }
            if let call = observer.calls.first(where: { $0.hasConnected && !$0.hasEnded && !$0.isOnHold }) {
                let uuid = call.uuid.uuidString
                let previousKey = "hitel.fileProbe.lastScannedCallUUID"
                if UserDefaults.standard.string(forKey: previousKey) == uuid {
                    ProbeEvidence.append("FILE-PROBE 같은 통화 중복 실행 생략")
                    return .result(value: false)
                }
                ProbeEvidence.append("FILE-PROBE 연결 감지됨; 메타데이터 5회 측정 시작")
                var completed = 0
                for n in 0..<5 {
                    if Task.isCancelled { break }
                    if !ProbeCallState.connected(observer.calls) {
                        ProbeEvidence.append("FILE-PROBE 통화 종료/보류 감지, 반복 점검 중단")
                        break
                    }
                    _ = FileProbeEngine.sample(
                        trigger: "Shortcut_Connected_" + String(n + 1),
                        callState: "connected"
                    )
                    completed += 1
                    if n < 4 {
                        try await Task.sleep(nanoseconds: 2_000_000_000)
                    }
                }
                if completed > 0 {
                    UserDefaults.standard.set(uuid, forKey: previousKey)
                }
                ProbeEvidence.append("FILE-PROBE 자동화 검사 " + String(completed) + "회 실행 (녹음 파일 발견과 무관)")
                return .result(value: completed > 0)
            }
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
        ProbeEvidence.append("FILE-PROBE 시간 초과: 20초 내 통화 연결 확인 못함")
        return .result(value: false)
    }
}

struct HitelProbeShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CheckSystemCallConnectedIntent(),
            phrases: ["Check phone connection with \(.applicationName)"],
            shortTitle: "통화 연결 확인",
            systemImageName: "phone.connection"
        )
        AppShortcut(
            intent: WaitForConnectedSystemCallIntent(),
            phrases: ["Wait for phone connection with \(.applicationName)"],
            shortTitle: "통화 연결 대기",
            systemImageName: "phone.arrow.up.right"
        )
        AppShortcut(
            intent: PlayWhenConnectedIntent(),
            phrases: ["Check call file changes with \(.applicationName)"],
            shortTitle: "통화 중 파일 검사",
            systemImageName: "doc.text.magnifyingglass"
        )
    }
}
