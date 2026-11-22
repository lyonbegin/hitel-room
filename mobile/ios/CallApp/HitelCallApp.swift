import SwiftUI

/// Standalone iPhone function app. Independent from the working HITEL
/// ReplayKit screen-streaming installation and bundle identifier.
@main
struct HitelCallApp: App {
    @Environment(\.scenePhase) private var phase
    @StateObject private var model = HitelCallModel()
    var body: some Scene {
        WindowGroup {
            HitelCallScreen(model:model)
                .onAppear {model.activate()}
                .onChange(of:phase){ newPhase in
                    if newPhase == .active {model.activate();model.resumeAfterUnlock()}
                }
        }
    }
}
