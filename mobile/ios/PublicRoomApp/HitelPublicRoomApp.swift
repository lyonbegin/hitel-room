import SwiftUI

/// Standalone public-room app, not a WebView or the existing screen streamer.
/// Uses exactly the same Railway room database and signaling as /webrtc-room.
@main
struct HitelPublicRoomApp: App {
    @StateObject private var store=HitelNativeRoomStore()
    @Environment(\.scenePhase) private var phase
    var body:some Scene {
        WindowGroup{
            HitelNativePublicRoomScreen(store:store)
                .onChange(of:phase){ phase in
                    if phase == .active {Task{await store.refresh()}}
                }
        }
    }
}
