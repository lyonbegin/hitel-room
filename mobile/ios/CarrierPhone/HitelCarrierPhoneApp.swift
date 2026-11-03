import SwiftUI

/// Separate native iOS carrier-phone application.
/// This target does not import HITEL's WebRTC/video call modules.
@main
struct HitelCarrierPhoneApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var phone = HitelCarrierPhoneModel()

    var body: some Scene {
        WindowGroup {
            HitelCarrierPhoneScreen(model: phone)
                .onAppear {
                    phone.refreshCallStatus()
                    phone.refreshInjectionStatus()
                }
                .onChange(of: scenePhase) { phase in
                    if phase == .active {
                        phone.refreshCallStatus()
                        phone.refreshInjectionStatus()
                    }
                }
        }
    }
}
