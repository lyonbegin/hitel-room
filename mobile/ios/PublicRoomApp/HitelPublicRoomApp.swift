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
                #if targetEnvironment(simulator)
                .task {
                    // CI verifies a room CREATED IN THE WEB is visible through
                    // the EXACT same Railway API to the real Swift app.
                    let args=ProcessInfo.processInfo.arguments
                    guard let at=args.firstIndex(of:"-HITEL_E2E_ROOM_ID"),
                          args.indices.contains(at+1),
                          let userAt=args.firstIndex(of:"-HITEL_E2E_USER"),
                          args.indices.contains(userAt+1) else{return}
                    let expected=args[at+1],user=args[userAt+1]
                    await store.login(id:user,name:"iOS shared-room test",role:"user")
                    let matched=store.rooms.contains(where:{$0.id==expected})
                    let line=matched ? "SAME_RAILWAY_ROOM_PASS" : "SAME_RAILWAY_ROOM_FAIL: "+store.error
                    if let folder=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first {
                        try? line.write(to:folder.appendingPathComponent("hitel-public-common-room-e2e.txt"),
                                        atomically:true,encoding:.utf8)
                    }
                    NSLog("HITEL_PUBLIC_NATIVE_%@",line)
                }
                #endif
        }
    }
}
