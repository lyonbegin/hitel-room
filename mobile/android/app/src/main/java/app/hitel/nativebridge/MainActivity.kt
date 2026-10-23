package app.hitel.nativebridge

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceError
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewCompat

class MainActivity : Activity() {
    companion object {
        const val HOME = "https://hitel-room-production-ecce.up.railway.app/"
        const val LOG_TAG = "HITEL_E2E"
    }

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i(LOG_TAG, "APP_STARTED")
        webView = WebView(this)
        setContentView(webView)

        // Only the trusted HITEL origin can access the native message bridge.
        WebViewCompat.addWebMessageListener(
            webView,
            "HitelNative",
            setOf("https://hitel-room-production-ecce.up.railway.app")
        ) { _, message, origin, isMainFrame, reply ->
            if (!isMainFrame || origin.host != Uri.parse(HOME).host) return@addWebMessageListener
            if (message.data?.contains("\"action\":\"ping\"") == true) {
                Log.i(LOG_TAG, "BRIDGE_PING_OK")
                reply.postMessage("{\"ok\":true,\"platform\":\"android\"}")
            }
        }

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = true
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.scheme == "https" && url.host == Uri.parse(HOME).host) return false
                startActivity(Intent(Intent.ACTION_VIEW, url))
                return true
            }
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                Log.i(LOG_TAG, "WEB_LOADED $url")
                view.evaluateJavascript(
                    "window.HitelNative && window.HitelNative.postMessage(JSON.stringify({action:'ping'}))",
                    null
                )
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) Log.e(LOG_TAG, "WEB_ERROR ${error.errorCode} ${error.description}")
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                if (request.isForMainFrame) Log.e(LOG_TAG, "HTTP_ERROR ${errorResponse.statusCode}")
            }
        }
        webView.loadUrl(HOME)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
