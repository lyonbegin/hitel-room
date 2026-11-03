import SwiftUI
import Foundation
import Security
import UIKit

/// Authenticated viewer of OCR text from HITEL's existing iPhone screen
/// broadcast extension. The broadcast extension reads *pixels* containing
/// Apple Live Captions, not raw carrier-call audio.
/// No external audio accessories or cellular voice interception are used.
@MainActor
final class HitelLiveCaptionViewer: ObservableObject {
    static let shared = HitelLiveCaptionViewer()

    struct Caption: Identifiable, Equatable {
        let id: String
        let text: String
        let at: String
    }

    @Published private(set) var status = "Apple 실시간 자막 화면 공유 연결 대기"
    @Published private(set) var connected = false
    @Published private(set) var captions: [Caption] = []
    @Published private(set) var viewerTokenPresent = false
    @Published private(set) var totalReceived = 0

    private let account = "hitel-live-caption-viewer-token-v1"
    private var socket: URLSessionWebSocketTask?
    private var token: String?
    private var isEnabled = false
    private var retryCounter = 0

    private init() {
        token = Self.loadToken(account: account)
        viewerTokenPresent = token != nil
    }

    private static func loadToken(account: String) -> String? {
        let lookup: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "app.hitel.call.caption-viewer",
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var data: CFTypeRef?
        guard SecItemCopyMatching(lookup as CFDictionary, &data) == errSecSuccess,
              let value = data as? Data,
              let string = String(data: value, encoding: .utf8) else { return nil }
        return string
    }

    func attach(_ candidate: String) {
        let cleaned = candidate.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard cleaned.count == 64,
              cleaned.allSatisfy({ ("0123456789abcdef" as String).contains($0) }) else {
            status = "유효한 HITEL 화면 방송 자막 연결 정보가 아닙니다."
            return
        }
        let lookup: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "app.hitel.call.caption-viewer",
            kSecAttrAccount as String: account
        ]
        SecItemDelete(lookup as CFDictionary)
        var item = lookup
        item[kSecValueData as String] = Data(cleaned.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let result = SecItemAdd(item as CFDictionary, nil)
        guard result == errSecSuccess else {
            status = "화면 방송 연결 정보를 iPhone 키체인에 저장하지 못했습니다."
            return
        }
        token = cleaned
        viewerTokenPresent = true
        captions.removeAll()
        totalReceived = 0
        isEnabled = true
        restart()
    }

    func attachLink(_ url: URL) {
        guard url.scheme?.lowercased() == "hitelcall",
              url.host?.lowercased() == "captions",
              let item = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "viewerToken" }),
              let token = item.value else { return }
        attach(token)
    }

    func start() {
        guard token != nil else {
            status = "HITEL 관리 웹페이지에서 연결 링크를 열거나 복사해 주십시오."
            return
        }
        isEnabled = true
        if socket == nil { connect() }
    }

    func stop() {
        isEnabled = false
        socket?.cancel(with: .normalClosure, reason: nil)
        socket = nil
        connected = false
        status = "화면 자막 보기 중지 · 연결 정보는 유지"
    }

    func removeConnection() {
        stop()
        let lookup: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "app.hitel.call.caption-viewer",
            kSecAttrAccount as String: account
        ]
        SecItemDelete(lookup as CFDictionary)
        token = nil
        viewerTokenPresent = false
        captions.removeAll()
        totalReceived = 0
        status = "화면 자막 연결 정보 삭제"
    }

    func clearCaptionDisplay() { captions.removeAll() }

    func resume() {
        guard isEnabled else { return }
        // The host process may have been suspended while Phone was frontmost.
        // The sender is the independent ReplayKit broadcast extension.
        if socket == nil { connect() }
    }

    private func restart() {
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
        connected = false
        retryCounter = 0
        connect()
    }

    private func connect() {
        guard isEnabled, let token else { return }
        var url = URLComponents()
        url.scheme = "wss"
        url.host = "hitel-communication-web-production.up.railway.app"
        url.path = "/lab-sandbox/physical-iphone/socket"
        url.queryItems = [
            URLQueryItem(name: "role", value: "viewer"),
            URLQueryItem(name: "viewerToken", value: token)
        ]
        guard let target = url.url else { return }
        // The existing screen-broadcast viewer endpoint requires the same
        // Origin header as its approved HTTPS management page in addition to
        // the cryptographically random 64-character viewer token.
        var request = URLRequest(url: target)
        request.setValue("https://hitel-communication-web-production.up.railway.app", forHTTPHeaderField: "Origin")
        let task = URLSession.shared.webSocketTask(with: request)
        socket = task
        status = "HITEL 기존 화면 방송 자막 서버 연결 중"
        task.resume()
        receive(task)
    }

    private func receive(_ task: URLSessionWebSocketTask) {
        task.receive { [weak self, weak task] result in
            Task { @MainActor in
                guard let self, let task, self.socket === task else { return }
                switch result {
                case .success(let message):
                    let data: Data?
                    switch message {
                    case .string(let text): data = Data(text.utf8)
                    case .data: data = nil // Existing JPEG frames are ignored.
                    @unknown default: data = nil
                    }
                    if let data,
                       let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        self.handle(object)
                    }
                    self.receive(task)
                case .failure(let error):
                    self.connected = false
                    self.socket = nil
                    self.status = "자막 연결 끊김: " + error.localizedDescription
                    if self.isEnabled { self.retry() }
                }
            }
        }
    }

    private func retry() {
        guard isEnabled else { return }
        retryCounter += 1
        let wait = min(10.0, 2.0 + Double(retryCounter))
        DispatchQueue.main.asyncAfter(deadline: .now() + wait) { [weak self] in
            guard let self, self.isEnabled, self.socket == nil else { return }
            self.connect()
        }
    }

    private func handle(_ object: [String: Any]) {
        let type = object["type"] as? String ?? ""
        switch type {
        case "status":
            connected = true
            retryCounter = 0
            let online = object["online"] as? Bool ?? false
            status = online
                ? "방송 서버 연결 · 실시간 자막 OCR 수신 대기"
                : "연결됨 · iPhone 시스템 화면 방송이 아직 실행되지 않았습니다."
        case "caption.ocr":
            guard let text = object["text"] as? String,
                  !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  text.count <= 1200,
                  object["source"] as? String == "apple-live-captions-visual-ocr" else { return }
            let at = object["at"] as? String ?? ""
            let sequence = object["sequence"] as? Int ?? 0
            let id = "\(sequence)-\(at)"
            if captions.contains(where: { $0.id == id }) { return }
            captions.append(Caption(id: id, text: text, at: at))
            if captions.count > 80 { captions.removeFirst(captions.count - 80) }
            totalReceived += 1
            status = "iPhone 화면에서 문자 OCR 실제 수신 · \(totalReceived)건"
        default:
            break
        }
    }
}
