import Foundation
import WebRTC

/// Native VideoCore interface corresponding to video-town-front/src/sdk/VideoCore.ts.
/// The native RTCVideoTrack remains entirely inside the iPhone; it is not serialized over WebSocket.
enum HitelNativeCameraMode: String, Codable {
    case original
    case mask
}

struct HitelNativeTrackingStatus {
    let fps: Double
}

enum HitelVideoCoreError: LocalizedError {
    case noVideoTrack
    case maskRendererNotInstalled

    var errorDescription: String? {
        switch self {
        case .noVideoTrack: return "실제 네이티브 카메라 영상 트랙을 만들지 못했습니다."
        case .maskRendererNotInstalled:
            return "VideoCore 원본의 얼굴 추적·가면 합성 이식이 완료되지 않았습니다. 가면 모드를 활성화하지 않습니다."
        }
    }
}

/// One camera owner per call. Reuses the current RTCVideoSource of HitelNativeCallMedia
/// instead of opening the hardware camera a second time.
/// IMPORTANT: Full MindAR/3D mask parity is not implemented. Requests fail explicitly.
final class HitelNativeVideoCore {
    static let sdkVersion = "1.0.0"
    private weak var media: HitelNativeCallMedia?
    private(set) var mode: HitelNativeCameraMode = .original
    private(set) var cameraOpened = false

    init(media: HitelNativeCallMedia) {
        self.media = media
    }

    @discardableResult
    func openCamera(mode: HitelNativeCameraMode = .original) throws -> RTCVideoTrack {
        guard mode == .original else { throw HitelVideoCoreError.maskRendererNotInstalled }
        guard let media else { throw HitelVideoCoreError.noVideoTrack }
        media.prepare()
        guard let video = media.localVideoTrack else { throw HitelVideoCoreError.noVideoTrack }
        media.camera(true)
        cameraOpened = true
        self.mode = mode
        return video
    }

    @discardableResult
    func setMode(_ next: HitelNativeCameraMode) throws -> RTCVideoTrack {
        guard next == .original else { throw HitelVideoCoreError.maskRendererNotInstalled }
        return try openCamera(mode: next)
    }

    @discardableResult
    func enableMask() throws -> RTCVideoTrack {
        throw HitelVideoCoreError.maskRendererNotInstalled
    }

    @discardableResult
    func disableMask() throws -> RTCVideoTrack {
        try setMode(.original)
    }

    var videoTrack: RTCVideoTrack? { media?.localVideoTrack }
    func getTrackingStatus() -> HitelNativeTrackingStatus? { nil }

    /// Stop only the camera. Audio and remote RTC media remain independently managed.
    func stop() {
        media?.camera(false)
        cameraOpened = false
    }
}
