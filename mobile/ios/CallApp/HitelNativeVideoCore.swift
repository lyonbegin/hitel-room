import Foundation
import AVFoundation
import WebRTC

/// Native VideoCore session corresponding to VideoCore 1.0.0.
/// The camera and video track belong to VideoCore, NEVER to a particular
/// P2P/SFU transport. Both transports can be supplied the same RTCVideoTrack
/// without capturing twice. No WebView or browser media element is involved.
enum HitelNativeCameraMode: String, Codable {
    case original
    case mask
}

struct HitelNativeTrackingStatus {
    let fps: Double
}

enum HitelVideoCoreError: LocalizedError {
    case noCamera
    case maskRendererNotInstalled

    var errorDescription: String? {
        switch self {
        case .noCamera: return "실제 iPhone 카메라를 시작할 수 없습니다."
        case .maskRendererNotInstalled:
            return "기존 VideoCore의 얼굴 추적·가면 합성 이식 전이므로 mask 모드를 실행하지 않습니다."
        }
    }
}

/// Platform-native camera owner. Its output track can be attached to a native
/// WebRTC P2P peer now, and an actual mediasoup Producer after SFU integration.
final class HitelNativeVideoCore: NSObject, RTCVideoCapturerDelegate {
    static let sdkVersion = "1.0.0"

    private lazy var capturer = RTCCameraVideoCapturer(delegate: self)
    private let source: RTCVideoSource
    private let statsLock = NSLock()
    private var frameCount: Int = 0
    private var windowFrameCount: Int = 0
    private var windowBeganAt: TimeInterval = 0
    private var measuredCaptureFPS: Double = 0
    var onFirstFrame: (() -> Void)?
    var onCaptureFPS: ((Double) -> Void)?
    let videoTrack: RTCVideoTrack
    private(set) var mode: HitelNativeCameraMode = .original
    private(set) var cameraOpened = false
    var hasReceivedFrame: Bool {
        statsLock.lock()
        defer { statsLock.unlock() }
        return frameCount > 0
    }
    var captureFPS: Double {
        statsLock.lock()
        defer { statsLock.unlock() }
        return measuredCaptureFPS
    }

    init(factory: RTCPeerConnectionFactory) {
        let source = factory.videoSource()
        self.source = source
        self.videoTrack = factory.videoTrack(with: source, trackId: "hitel-videocore-native")
        super.init()
    }

    /// RTCVideoCapturerDelegate receives the actual camera frames. A track
    /// object or a capture-start request alone cannot prove that frames exist.
    func capturer(_ capturer: RTCVideoCapturer, didCapture frame: RTCVideoFrame) {
        let now = Date().timeIntervalSince1970
        var first = false
        var updatedFPS: Double?
        statsLock.lock()
        if frameCount == 0 { first = true; windowBeganAt = now }
        frameCount += 1
        windowFrameCount += 1
        let elapsed = now - windowBeganAt
        if elapsed >= 1 {
            measuredCaptureFPS = Double(windowFrameCount) / elapsed
            windowFrameCount = 0
            windowBeganAt = now
            updatedFPS = measuredCaptureFPS
        }
        statsLock.unlock()

        // Forward the unchanged frame into the ONE VideoCore-owned WebRTC
        // source used by both native preview and the outgoing track.
        source.capturer(capturer, didCapture: frame)
        if first { DispatchQueue.main.async { [weak self] in self?.onFirstFrame?() } }
        if let updatedFPS {
            DispatchQueue.main.async { [weak self] in self?.onCaptureFPS?(updatedFPS) }
        }
    }

    @discardableResult
    func openCamera(mode: HitelNativeCameraMode = .original) throws -> RTCVideoTrack {
        guard mode == .original else { throw HitelVideoCoreError.maskRendererNotInstalled }
        if !cameraOpened {
            guard let device =
                RTCCameraVideoCapturer.captureDevices().first(where: { $0.position == .front }) ??
                RTCCameraVideoCapturer.captureDevices().first,
                let format = RTCCameraVideoCapturer.supportedFormats(for: device).sorted(by: {
                    let a = CMVideoFormatDescriptionGetDimensions($0.formatDescription)
                    let b = CMVideoFormatDescriptionGetDimensions($1.formatDescription)
                    return abs(Int(a.width) - 640) < abs(Int(b.width) - 640)
                }).first else {
                throw HitelVideoCoreError.noCamera
            }
            capturer.startCapture(with: device, format: format, fps: 24)
            cameraOpened = true
        }
        videoTrack.isEnabled = true
        self.mode = mode
        return videoTrack
    }

    @discardableResult
    func setMode(_ next: HitelNativeCameraMode) throws -> RTCVideoTrack {
        try openCamera(mode: next)
    }

    @discardableResult
    func enableMask() throws -> RTCVideoTrack {
        throw HitelVideoCoreError.maskRendererNotInstalled
    }

    @discardableResult
    func disableMask() throws -> RTCVideoTrack {
        try openCamera(mode: .original)
    }

    func setCameraEnabled(_ enabled: Bool) {
        videoTrack.isEnabled = enabled
    }

    func getTrackingStatus() -> HitelNativeTrackingStatus? { nil }

    /// Does not close the call's microphone, remote receivers or RTC transport.
    func stop() {
        if cameraOpened { capturer.stopCapture() }
        cameraOpened = false
        statsLock.lock()
        frameCount = 0
        windowFrameCount = 0
        windowBeganAt = 0
        measuredCaptureFPS = 0
        statsLock.unlock()
        videoTrack.isEnabled = false
    }
}
