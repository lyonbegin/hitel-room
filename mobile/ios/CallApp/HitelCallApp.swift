import SwiftUI

/// Standalone iPhone function app. Independent from the working HITEL
/// ReplayKit screen-streaming installation and bundle identifier.
@main
struct HitelCallApp: App {
    @Environment(\.scenePhase) private var phase
    @StateObject private var model = HitelCallModel()
    @ObservedObject private var captions = HitelLiveCaptionViewer.shared
    var body: some Scene {
        WindowGroup {
            HitelCallScreen(model:model)
                .onOpenURL { captions.attachLink($0) }
                .onAppear {model.activate()}
                .onChange(of:phase){ newPhase in
                    if newPhase == .active {model.activate();model.resumeAfterUnlock();captions.resume()}
                    if newPhase == .background {model.releasePreviewForPhoneApp()}
                }
        }
    }
}
