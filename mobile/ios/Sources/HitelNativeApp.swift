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
        if let token = ProcessInfo.processInfo.environment["HITEL_CALL_TOKEN"], !token.isEmpty {
            context.coordinator.connectCommunicationNetwork(token, webView: view)
        }
        return view
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
        private let speaker = AVSpeechSynthesizer()
        private var communicationSocket: URLSessionWebSocketTask?
        private var communicationToken: String?
        private var communicationLastSequence = 0
        private func receiveCommunicationEvent(_ event: [String: Any], socket: URLSessionWebSocketTask) {
            let sequence = event["sequence"] as? Int ?? 0
            guard sequence > communicationLastSequence else { return }
            communicationLastSequence = sequence
            let ack: [String: Any] = ["type": "comm.ack", "sequence": sequence]
            if let data = try? JSONSerialization.data(withJSONObject: ack),
               let line = String(data: data, encoding: .utf8) {
                socket.send(.string(line)) { _ in }
            }
            let name = (event["type"] as? String ?? "UNKNOWN").uppercased()
            NSLog("HITEL_E2E COMM_EVENT_%@", name)
            let payload: [String: Any] = ["type": "communication.event", "event": event]
            if let bytes = try? JSONSerialization.data(withJSONObject: payload),
               let json = String(data: bytes, encoding: .utf8) {
                DispatchQueue.main.async { [weak self] in
                    self?.attachedWebView?.evaluateJavaScript(
                        "window.dispatchEvent(new CustomEvent('hitel-native-event',{detail:" + json + "}))",
                        completionHandler: nil
                    )
                }
            }
        }
        private func receiveCommunication(_ socket: URLSessionWebSocketTask) {
            socket.receive { [weak self] result in
                guard let self = self, self.communicationSocket === socket else { return }
                switch result {
                case .success(let message):
                    let raw: String?
                    switch message {
                    case .string(let text): raw = text
                    case .data(let data): raw = String(data: data, encoding: .utf8)
                    @unknown default: raw = nil
                    }
                    if let body = raw?.data(using: .utf8),
                       let obj = try? JSONSerialization.jsonObject(with: body) as? [String: Any] {
                        switch obj["type"] as? String ?? "" {
                        case "comm.pong": NSLog("HITEL_E2E COMM_SOCKET_PONG")
                        case "comm.snapshot":
                            NSLog("HITEL_E2E COMM_SNAPSHOT_OK")
                            for event in obj["events"] as? [[String: Any]] ?? [] {
                                self.receiveCommunicationEvent(event, socket: socket)
                            }
                        case "comm.event":
                            if let event = obj["event"] as? [String: Any] {
                                self.receiveCommunicationEvent(event, socket: socket)
                            }
                        case "comm.actionAck": NSLog("HITEL_E2E COMM_ACTION_ACK")
                        default: break
                        }
                    }
                    self.receiveCommunication(socket)
                case .failure(let error):
                    NSLog("HITEL_E2E COMM_SOCKET_FAILURE %@", error.localizedDescription)
                    guard let token = self.communicationToken, let web = self.attachedWebView else { return }
                    self.communicationToken = nil
                    self.communicationSocket = nil
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self, weak web] in
                        guard let self = self, let web = web else { return }
                        self.connectCommunicationNetwork(token, webView: web)
                    }
                }
            }
        }
        func connectCommunicationNetwork(_ token: String, webView: WKWebView) {
            if token.isEmpty || token == communicationToken { return }
            if let oldToken = communicationToken, oldToken != token { communicationLastSequence = 0 }
            communicationSocket?.cancel(with: .normalClosure, reason: nil)
            communicationToken = token
            attachedWebView = webView
            var parts = URLComponents()
            parts.scheme = "wss"
            parts.host = relayHost
            parts.path = "/comm-api/ws"
            parts.queryItems = [URLQueryItem(name: "token", value: token),
                                URLQueryItem(name: "since", value: String(communicationLastSequence))]
            guard let url = parts.url else { return }
            let socket = URLSession.shared.webSocketTask(with: url)
            communicationSocket = socket
            socket.resume()
            NSLog("HITEL_E2E COMM_SOCKET_CONNECT_REQUESTED")
            socket.send(.string("{\"type\":\"comm.ping\"}")) { error in
                if let error = error {
                    NSLog("HITEL_E2E COMM_SOCKET_SEND_ERROR %@", error.localizedDescription)
                } else {
                    NSLog("HITEL_E2E COMM_SOCKET_CONNECTED")
                }
            }
            receiveCommunication(socket)
        }

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
                            let data = obj["data"] as? [String: Any] ?? [:]
                            var reply: [String: Any] = [
                                "type": "result",
                                "requestId": obj["requestId"] as? String ?? "",
                                "platform": "ios",
                                "ok": true
                            ]
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
                            case "getCapabilities":
                                reply["capabilities"] = [
                                    "nativeBridge": true,"localTts": true,"openSystemDialer": true,
                                    "webrtcWebview": true,"readCellularRemoteAudio": false,
                                    "injectCellularAudio": false
                                ]
                            case "tts.speak":
                                let text = String((data["text"] as? String ?? "").prefix(1000))
                                if text.isEmpty {
                                    reply["ok"] = false
                                    reply["error"] = "Empty TTS text"
                                } else {
                                    let line = AVSpeechUtterance(string: text)
                                    line.voice = AVSpeechSynthesisVoice(language: data["language"] as? String ?? "ko-KR")
                                    self.speaker.stopSpeaking(at: .immediate)
                                    self.speaker.speak(line)
                                    reply["scope"] = "local-device-only"
                                }
                            case "tts.stop":
                                self.speaker.stopSpeaking(at: .immediate)
                                reply["scope"] = "local-device-only"
                            case "call.openDialer":
                                let number = data["phone"] as? String ?? ""
                                let chars = CharacterSet(charactersIn: "+0123456789*# -")
                                if number.isEmpty || number.count > 24 ||
                                   !number.unicodeScalars.allSatisfy({ chars.contains($0) }) {
                                    reply["ok"] = false
                                    reply["error"] = "Invalid number"
                                } else if let encoded = number.addingPercentEncoding(withAllowedCharacters: chars),
                                          let url = URL(string: "tel:" + encoded) {
                                    UIApplication.shared.open(url)
                                }
                            default:
                                reply["ok"] = false
                                reply["error"] = "Unsupported network action"
                            }
                            NSLog("HITEL_E2E LAB_CMD_%@", action.uppercased())
                            if let bytes = try? JSONSerialization.data(withJSONObject: reply),
                               let value = String(data: bytes, encoding: .utf8) {
                                socket.send(.string(value)) { _ in }
                            }
                        }
                    }
                }
                switch result {
                case .success:
                    self.receiveLabMessage(socket)
                case .failure(let error):
                    NSLog("HITEL_E2E LAB_SOCKET_RECEIVE_ERROR %@", error.localizedDescription)
                    guard let ticket = self.labTicket, let web = self.attachedWebView else { return }
                    self.labSocket = nil
                    self.labTicket = nil
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self, weak web] in
                        guard let self = self, let web = web else { return }
                        self.connectLabNetwork(ticket, webView: web)
                    }
                }
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
            if let url = webView.url, let token = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "callToken" })?.value {
                connectCommunicationNetwork(token, webView: webView)
            }
            var safeURL = webView.url.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false) }
            safeURL?.query = nil
            NSLog("HITEL_E2E WEB_LOADED %@", safeURL?.string ?? "")
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
