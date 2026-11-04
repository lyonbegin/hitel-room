import SwiftUI

@main
struct HitelCallConnectProbeApp: App {
    @StateObject private var monitor = CallConnectionMonitor.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ProbeHomeScreen(monitor: monitor)
                .onAppear { monitor.refresh(reason: "화면 열림") }
                .onOpenURL { received in
                    // Handle a document handed to HITEL by the iOS document
                    // interaction mechanism. Direct Notes share presentation
                    // remains a device-level test, not a guaranteed shortcut.
                    Task {
                        await NotesAudioImporter.shared.receive(received, source: "OpenURL")
                    }
                }
                .onChange(of: scenePhase) { phase in
                    if phase == .active {
                        monitor.refresh(reason: "앱 전면 복귀")
                    } else if phase == .background {
                        ProbeEvidence.append("앱 백그라운드 이동 — CallKit 즉시 감시 보장되지 않음")
                    }
                }
        }
    }
}
