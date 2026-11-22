import Foundation
import CoreGraphics
import WebRTC

/// Detects decoded remote frames without copying pixels into JavaScript or
/// turning a track object into a false assertion that video is visible.
final class HitelRemoteVideoProbe: NSObject, RTCVideoRenderer {
    private let lock = NSLock()
    private var hasFrame = false
    var onFirstFrame: (() -> Void)?

    func setSize(_ size: CGSize) {}

    func renderFrame(_ frame: RTCVideoFrame?) {
        guard frame != nil else { return }
        lock.lock()
        let isFirst = !hasFrame
        if isFirst { hasFrame = true }
        lock.unlock()
        if isFirst {
            DispatchQueue.main.async { [weak self] in
                self?.onFirstFrame?()
            }
        }
    }
}
