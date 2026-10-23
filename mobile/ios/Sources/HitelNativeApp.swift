import SwiftUI
import WebKit
import AVFoundation

private let allowedHost = "hitel-web-preview-production.up.railway.app"
private let labHost = "hitel-communication-web-production.up.railway.app"
private let relayHost = "hitel-device-relay-production.up.railway.app"
private func trusted(_ host: String?) -> Bool { host == allowedHost || host == labHost }
private let hitelURL = URL(string: "https://hitel-web-preview-production.up.railway.app/portal")!

@main
struct HitelNativeApp: App {
    var body: some Scene {
        WindowGroup { HitelWebView().ignoresSafeArea() }
    }
}

struct HitelWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "hitelNative")
        let config = WKWebViewConfiguration()
        config.userContentController = controller
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        NSLog("HITEL_E2E APP_STARTED")
        let candidate = ProcessInfo.processInfo.environment["HITEL_LAB_URL"].flatMap(URL.init(string:))
        let launchURL = candidate?.scheme == "https" && candidate?.host == labHost ? candidate! : hitelURL
        view.load(URLRequest(url: launchURL))
        if let ticket = ProcessInfo.processInfo.environment["HITEL_LAB_TICKET"], !ticket.isEmpty {
            context.coordinator.connectLabNetwork(ticket, webView: view)
        }
        return view
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
        private let speaker = AVSpeechSynthesizer()
        private var labSocket: URLSessionWebSocketTask?
        private var labTicket: String?
        private weak var attachedWebView: WKWebView?
        private func streamFrames(_ socket: URLSessionWebSocketTask) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) { [weak self] in
                guard let self = self, self.labSocket === socket,
                      let web = self.attachedWebView else { return }
                web.takeSnapshot(with: nil) { image, error in
                    if let image = image, let png = image.pngData(), png.count < 2_000_000,
                       self.labSocket === socket {
                        let payload = ["type": "frame", "png": png.base64EncodedString()]
                        if let data = try? JSONSerialization.data(withJSONObject: payload),
                           let value = String(data: data, encoding: .utf8) {
                            socket.send(.string(value)) { _ in }
                        }
                    }
                    self.streamFrames(socket)
                }
            }
        }
        private func receiveLabMessage(_ socket: URLSessionWebSocketTask) {
            socket.receive { [weak self] result in
                guard let self = self, self.labSocket === socket else { return }
                if case let .success(message) = result {
                    var text: String?
                    switch message {
                    case .string(let value): text = value
                    case .data(let data): text = String(data: data, encoding: .utf8)
                    @unknown default: break
                    }
                    if let body = text?.data(using: .utf8),
                       let obj = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
                       obj["type"] as? String == "command",
                       let action = obj["action"] as? String {
                        DispatchQueue.main.async {
                            guard let web = self.attachedWebView else { return }
                            switch action {
                            case "home", "launch", "navigate":
                                let desired = action == "navigate" ? (obj["screen"] as? String ?? "home") : "home"
                                let screen = ["home","sdk","ai","call","media"].contains(desired) ? desired : "home"
                                if let ticket = self.labTicket,
                                   let encoded = ticket.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
                                   let url = URL(string: "https://" + labHost + "/sdk-lab/device?side=ios&screen=" + screen + "&pair=" + encoded) {
                                    web.load(URLRequest(url: url))
                                }
                            case "reload": web.reload()
                            case "back": if web.canGoBack { web.goBack() }
                            case "ping": break
                            default: break
                            }
                            NSLog("HITEL_E2E LAB_CMD_%@", action.uppercased())
                            let event = ["type": "event", "name": "command.done", "value": action]
                            if let data = try? JSONSerialization.data(withJSONObject: event),
                               let value = String(data: data, encoding: .utf8) {
                                socket.send(.string(value)) { _ in }
                            }
                        }
                    }
                }
                self.receiveLabMessage(socket)
            }
        }
        func connectLabNetwork(_ ticket: String, webView: WKWebView) {
            if ticket.isEmpty || ticket == labTicket { return }
            labSocket?.cancel(with: .normalClosure, reason: nil)
            labTicket = ticket
            attachedWebView = webView
            guard let encoded = ticket.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
                  let url = URL(string: "wss://" + relayHost + "/lab-api/ws?role=device&side=ios&ticket=" + encoded) else { return }
            let socket = URLSession.shared.webSocketTask(with: url)
            labSocket = socket
            socket.resume()
            NSLog("HITEL_E2E LAB_SOCKET_CONNECT_REQUESTED")
            let hello = ["type": "hello", "platform": "ios", "capabilities": "webview,tts,dialer,camera,mic"]
            if let data = try? JSONSerialization.data(withJSONObject: hello),
               let value = String(data: data, encoding: .utf8) {
                socket.send(.string(value)) { error in
                    if let error = error { NSLog("HITEL_E2E LAB_SOCKET_ERROR %@", error.localizedDescription) }
                    else { NSLog("HITEL_E2E LAB_SOCKET_CONNECTED") }
                }
            }
            receiveLabMessage(socket)
            streamFrames(socket)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard trusted(webView.url?.host) else { return }
            if let url = webView.url, let ticket = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "pair" })?.value {
                connectLabNetwork(ticket, webView: webView)
            }
            NSLog("HITEL_E2E WEB_LOADED %@", webView.url?.absoluteString ?? "")
            // Native -> WKWebView event channel consumed by Communication SDK.
            webView.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('hitel-native-event',{detail:{type:'app.ready',platform:'ios'}}))",
                completionHandler: nil
            )
            webView.evaluateJavaScript(
                "window.webkit.messageHandlers.hitelNative.postMessage({action:'ping'});window.webkit.messageHandlers.hitelNative.postMessage({action:'getCapabilities'})",
                completionHandler: nil
            )
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "hitelNative",
                  message.frameInfo.isMainFrame,
                  trusted(message.frameInfo.securityOrigin.host),
                  let cmd = message.body as? [String: Any],
                  let action = cmd["action"] as? String else { return }

            var response: [String: Any] = [
                "requestId": cmd["requestId"] as? String ?? "",
                "ok": true,
                "platform": "ios"
            ]
            switch action {
            case "ping":
                NSLog("HITEL_E2E BRIDGE_PING_OK")
            case "getCapabilities":
                response["bridgeVersion"] = 1
                response["capabilities"] = [
                    "nativeBridge": true,
                    "localTts": true,
                    "openSystemDialer": true,
                    "webrtcWebview": true,
                    "readCellularRemoteAudio": false,
                    "injectCellularAudio": false
                ]
                NSLog("HITEL_E2E CAPABILITIES_OK")
            case "tts.speak":
                let text = String((cmd["text"] as? String ?? "").prefix(1000))
                if text.isEmpty {
                    response["ok"] = false
                    response["error"] = "Empty text"
                } else {
                    let utterance = AVSpeechUtterance(string: text)
                    utterance.voice = AVSpeechSynthesisVoice(language: cmd["language"] as? String ?? "ko-KR")
                    speaker.stopSpeaking(at: .immediate)
                    speaker.speak(utterance)
                    response["scope"] = "local-device-only"
                }
            case "tts.stop":
                speaker.stopSpeaking(at: .immediate)
                response["scope"] = "local-device-only"
            case "call.openDialer":
                let number = cmd["phone"] as? String ?? ""
                let digits = CharacterSet(charactersIn: "+0123456789*# -")
                if number.isEmpty || number.count > 24 || !number.unicodeScalars.allSatisfy({ digits.contains($0) }) {
                    response["ok"] = false
                    response["error"] = "Invalid number"
                } else if let encoded = number.addingPercentEncoding(withAllowedCharacters: digits),
                          let url = URL(string: "tel:" + encoded) {
                    UIApplication.shared.open(url)
                } else {
                    response["ok"] = false
                    response["error"] = "Dialer unavailable"
                }
            default:
                response["ok"] = false
                response["error"] = "Unsupported action"
            }
            guard let data = try? JSONSerialization.data(withJSONObject: response),
                  let json = String(data: data, encoding: .utf8) else { return }
            message.webView?.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('hitel-native-response',{detail:" + json + "}))",
                completionHandler: nil
            )
        }

        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            // WKWebView may use camera/microphone only in trusted HITEL content.
            let trusted = origin.protocol == "https" && trusted(origin.host) &&
                frame.isMainFrame
            decisionHandler(trusted ? .grant : .deny)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            NSLog("HITEL_E2E WEB_ERROR %@", error.localizedDescription)
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            NSLog("HITEL_E2E WEB_ERROR %@", error.localizedDescription)
        }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = action.request.url, url.scheme == "https", trusted(url.host) {
                decisionHandler(.allow)
                return
            }
            if let url = action.request.url, ["https", "http", "tel"].contains(url.scheme ?? "") {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }
    }
}
