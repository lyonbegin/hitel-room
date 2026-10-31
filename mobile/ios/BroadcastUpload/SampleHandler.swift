import Foundation
import ReplayKit
import CoreMedia
import CoreImage
import UIKit

/// ReplayKit broadcast upload extension for an actual iPhone.
/// Broadcast pixels are transmitted only after the user explicitly starts
/// Apple's system broadcast picker. No touch/control messages are accepted.
final class SampleHandler: RPBroadcastSampleHandler {
    // App enters PIN on server, system broadcast extension awaits viewer approval.
    // No pasteboard, unsupported App Groups, or deprecated setup UI are required.
    private var deviceKey = ""
    private let base = "wss://hitel-communication-web-production.up.railway.app/lab-sandbox/physical-iphone/socket"
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])
    private var session: URLSession?
    private var socket: URLSessionWebSocketTask?
    private var active = false
    private var connected = false
    private var sending = false
    private var lastFrame = Date.distantPast
    private var lastDimensions = (width: 0, height: 0)
    private var reconnectAttempts = 0

    override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
        // The system picker (iOS 18+) normally supplies no setupInfo.
        // The user registered an 8-digit code directly with the server first.
        // This extension connects as a PENDING sender and only transmits
        // frames AFTER the authorized viewer approves it in SDK Lab.
        active = true
        connect()
    }

    override func broadcastPaused() { sending = false }
    override func broadcastResumed() {}
    override func broadcastFinished() {
        active = false
        connected = false
        socket?.cancel(with: .normalClosure, reason: nil)
        socket = nil
        session?.invalidateAndCancel()
        session = nil
    }

    private func connect() {
        guard active else { return }
        let target = deviceKey.count == 64
            ? base + "?role=device&deviceKey=" + deviceKey
            : base + "?role=trial"
        guard let url = URL(string: target) else { return }
        session?.invalidateAndCancel()
        session = URLSession(configuration: .ephemeral)
        let ws = session!.webSocketTask(with: url)
        socket = ws
        connected = false
        ws.resume()
        receive(on: ws)
        // URLSessionWebSocketTask does not expose a separate onOpen callback.
        // A frame is sent only when the server confirms pairing.
    }

    private func receive(on ws: URLSessionWebSocketTask) {
        ws.receive { [weak self] result in
            guard let self = self, self.active, self.socket === ws else { return }
            switch result {
            case .success(let message):
                if case .string(let text) = message,
                   let data = text.data(using: .utf8),
                   let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   object["type"] as? String == "paired" {
                    let value = object["deviceKey"] as? String ?? ""
                    if value.count == 64 {
                        self.deviceKey = value
                        self.connected = true
                        self.reconnectAttempts = 0
                        self.hello()
                    }
                }
                self.receive(on: ws)
            case .failure:
                self.connected = false
                guard self.reconnectAttempts < 25 else {
                    self.finishBroadcastWithError(NSError(domain:"HitelScreen",code:2,
                        userInfo:[NSLocalizedDescriptionKey:"HITEL 화면 방송 서버와 연결할 수 없습니다."]))
                    return
                }
                self.reconnectAttempts += 1
                DispatchQueue.main.asyncAfter(deadline: .now()+3.0) { [weak self] in
                    guard let self = self, self.active, self.socket === ws else { return }
                    self.connect()
                }
            }
        }
    }

    private func hello() {
        guard connected, let ws = socket else { return }
        let m = UIScreen.main.bounds
        let payload: [String: Any] = [
            "type":"hello","name":"iPhone",
            "ios":UIDevice.current.systemVersion,
            "width":lastDimensions.width > 0 ? lastDimensions.width : Int(m.width),
            "height":lastDimensions.height > 0 ? lastDimensions.height : Int(m.height)
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let text = String(data: data, encoding: .utf8) else { return }
        ws.send(.string(text)) { _ in }
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard active, connected, sampleBufferType == .video, !sending,
              Date().timeIntervalSince(lastFrame) >= 0.5,
              let buffer = CMSampleBufferGetImageBuffer(sampleBuffer),let ws = socket else { return }
        lastFrame = Date()
        // Do not retain a ReplayKit-owned CVPixelBuffer after this callback.
        let input = CIImage(cvPixelBuffer: buffer)
        let scale = min(1.0, 540.0 / max(input.extent.width, input.extent.height))
        let output = input.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let frame = ciContext.createCGImage(output, from: output.extent),
              let jpeg = UIImage(cgImage: frame).jpegData(compressionQuality: 0.60),
              jpeg.count < 850000 else { return }
        let w = frame.width, h = frame.height
        if lastDimensions.width != w || lastDimensions.height != h {
            lastDimensions = (w,h)
            hello()
        }
        sending = true
        ws.send(.data(jpeg)) { [weak self] error in
            self?.sending = false
            if error != nil { self?.connected = false }
        }
    }
}
