import SwiftUI
import WebKit
import AVFoundation

private let allowedHost = "hitel-web-preview-production.up.railway.app"
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
        view.allowsBackForwardNavigationGestures = true
        NSLog("HITEL_E2E APP_STARTED")
        view.load(URLRequest(url: hitelURL))
        return view
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        private let speaker = AVSpeechSynthesizer()

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard webView.url?.host == allowedHost else { return }
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
                  message.frameInfo.securityOrigin.host == allowedHost,
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

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            NSLog("HITEL_E2E WEB_ERROR %@", error.localizedDescription)
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            NSLog("HITEL_E2E WEB_ERROR %@", error.localizedDescription)
        }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = action.request.url, url.scheme == "https", url.host == allowedHost {
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
