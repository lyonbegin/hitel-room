import SwiftUI
import WebKit

private let hitelURL = URL(string: "https://hitel-room-production-ecce.up.railway.app/")!
private let allowedHost = "hitel-room-production-ecce.up.railway.app"

@main
struct HitelNativeApp: App {
    var body: some Scene {
        WindowGroup {
            HitelWebView().ignoresSafeArea()
        }
    }
}

struct HitelWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "hitelNative")

        let config = WKWebViewConfiguration()
        config.userContentController = controller
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        NSLog("HITEL_E2E APP_STARTED")
        webView.load(URLRequest(url: hitelURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) { }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard webView.url?.host == allowedHost else { return }
            NSLog("HITEL_E2E WEB_LOADED %@", webView.url?.absoluteString ?? "")
            webView.evaluateJavaScript(
                "window.webkit.messageHandlers.hitelNative.postMessage({action:'ping'})",
                completionHandler: nil
            )
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "hitelNative",
                  message.frameInfo.isMainFrame,
                  message.frameInfo.securityOrigin.host == allowedHost,
                  let messageBody = message.body as? [String: Any],
                  let action = messageBody["action"] as? String,
                  action == "ping" else { return }
            NSLog("HITEL_E2E BRIDGE_PING_OK")
            message.webView?.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('hitel-native-ready',{detail:{platform:'ios'}}))",
                completionHandler: nil
            )
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            NSLog("HITEL_E2E WEB_ERROR %@", error.localizedDescription)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            NSLog("HITEL_E2E WEB_ERROR %@", error.localizedDescription)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url,
               let scheme = url.scheme,
               scheme == "https",
               url.host == allowedHost {
                decisionHandler(.allow)
                return
            }
            if let url = navigationAction.request.url, navigationAction.targetFrame != nil {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
