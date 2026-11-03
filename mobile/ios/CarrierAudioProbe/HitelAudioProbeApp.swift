import SwiftUI

/// Physical iPhone call-audio experiment. Entirely independent from the
/// production HITEL video call app and its Railway services.
@main
struct HitelAudioProbeApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var probe = HitelAudioProbeStore()

    var body: some Scene {
        WindowGroup {
            HitelAudioProbeScreen(probe: probe)
                .onChange(of: scenePhase) { phase in
                    if phase == .active {
                        probe.refreshCall()
                        probe.refresh()
                    }
                }
        }
    }
}
