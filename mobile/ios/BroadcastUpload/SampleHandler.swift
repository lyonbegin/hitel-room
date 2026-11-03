import Foundation
import ReplayKit
import CoreMedia
import CoreImage
import Vision
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
    private var lastCaptionScan = Date.distantPast
    private var lastCaptionText = ""
    private var captionOCRBusy = false
    private let captionOCRQueue = DispatchQueue(label: "app.hitel.broadcast.livecaption-ocr", qos: .userInitiated)
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

    /// Recognizes only the lower-screen overlay area designated for Apple's
    /// Live Captions. The user must move/expand the system caption window
    /// into the bottom 42% of the screen. No invented text and no access to
    /// protected call audio are claimed.
    private func recognizeSystemCaption(in image: CGImage) {
        defer { DispatchQueue.main.async { [weak self] in self?.captionOCRBusy = false } }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["ko-KR", "en-US"]
        // Vision coordinates begin at the bottom. Captions should be placed
        // in this area to avoid sending Phone UI, digits or contact data.
        request.regionOfInterest = CGRect(x: 0.03, y: 0.02, width: 0.94, height: 0.42)
        do {
            try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
            let text = (request.results ?? [])
                .sorted { $0.boundingBox.midY > $1.boundingBox.midY }
                .compactMap { $0.topCandidates(1).first }
                .filter { $0.confidence >= 0.35 }
                .map { $0.string.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { $0.count >= 2 }
                .joined(separator: "\n")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            // Never persist or relay the unfiltered screen: transcripts
            // require an explicit system broadcast and paired viewer.
            // Do not interpret static call-control labels as a transcript.
            guard !text.isEmpty, text != lastCaptionText else { return }
            lastCaptionText = text
            let message: [String: Any] = [
                "type": "caption.ocr",
                "text": String(text.prefix(1200)),
                "source": "apple-live-captions-visual-ocr",
                "timestamp": ISO8601DateFormatter().string(from: Date())
            ]
            guard let data = try? JSONSerialization.data(withJSONObject: message),
                  let value = String(data: data, encoding: .utf8) else { return }
            DispatchQueue.main.async { [weak self] in
                guard let self, self.connected, let socket = self.socket else { return }
                socket.send(.string(value)) { error in
                    if let error { NSLog("HITEL_CAPTION_OCR_SEND_ERROR %@", error.localizedDescription) }
                }
            }
        } catch {
            NSLog("HITEL_CAPTION_OCR_ERROR %@", error.localizedDescription)
        }
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
        // Apple Live Captions is rendered by iOS itself when enabled. The
        // user must opt into call-caption retention (1 hour) to permit
        // screenshots/recordings. This is screen OCR, not a Phone audio tap.
        if Date().timeIntervalSince(lastCaptionScan) >= 1.1 && !captionOCRBusy {
            lastCaptionScan = Date()
            captionOCRBusy = true
            // Copy a downscaled frame before ReplayKit releases its buffer.
            let ocrScale = min(1.0, 960.0 / max(input.extent.width, input.extent.height))
            let ocrInput = input.transformed(by: CGAffineTransform(scaleX: ocrScale, y: ocrScale))
            if let ocrFrame = ciContext.createCGImage(ocrInput, from: ocrInput.extent) {
                captionOCRQueue.async { [weak self] in self?.recognizeSystemCaption(in: ocrFrame) }
            } else {
                captionOCRBusy = false
            }
        }
        sending = true
        ws.send(.data(jpeg)) { [weak self] error in
            self?.sending = false
            if error != nil { self?.connected = false }
        }
    }
}
