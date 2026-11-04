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

/// One-action Shortcuts experiment: wait, then play the locally generated WAV.
/// iOS may suspend a Shortcuts action while Phone is in front. No success claim.
struct PlayWhenConnectedIntent: AppIntent {
    static var title: LocalizedStringResource = "HITEL 연결되면 녹음 명령 재생"
    static var description = IntentDescription("실제 시스템 통화 연결을 최대 15초 확인한 후 저장된 영어 명령 음성 파일을 재생합니다. 접근성 인식 및 녹음 시작은 별도로 시험해야 합니다.")

    func perform() async throws -> some IntentResult & ReturnsValue<Bool> {
        let observer = CXCallObserver()
        ProbeEvidence.append("원클릭 자동화 시작: 연결 대기")
        for _ in 0..<15 {
            if Task.isCancelled {
                ProbeEvidence.append("원클릭 자동화 취소")
                return .result(value: false)
            }
            if let call = observer.calls.first(where: { $0.hasConnected && !$0.hasEnded && !$0.isOnHold }) {
                let key = "hitel.callprobe.lastPlaybackCallUUID"
                let uuid = call.uuid.uuidString
                if UserDefaults.standard.string(forKey: key) == uuid {
                    ProbeEvidence.append("해당 통화 중복 실행 차단")
                    return .result(value: false)
                }
                let worked = await CallConnectedCommandPlayback.playSavedCommand()
                if worked { UserDefaults.standard.set(uuid, forKey: key) }
                return .result(value: worked)
            }
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
        ProbeEvidence.append("원클릭 자동화 종료: 15초 이내 통화 연결 미감지")
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
                phrases: ["Play call record command with \(.applicationName)"],
                shortTitle: "연결되면 명령 재생",
                systemImageName: "waveform.badge.mic"
        )
    }
}
