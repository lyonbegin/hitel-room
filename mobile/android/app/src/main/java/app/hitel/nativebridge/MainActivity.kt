package app.hitel.nativebridge

import android.app.Activity
import android.Manifest
import android.content.pm.PackageManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Log
import android.webkit.*
import androidx.webkit.WebViewCompat
import org.json.JSONObject
import java.util.Locale

class MainActivity : Activity() {
    companion object {
        const val ORIGIN = "https://hitel-web-preview-production.up.railway.app"
        const val HOME = "$ORIGIN/portal"
        const val LOG_TAG = "HITEL_E2E"
    }

    private lateinit var webView: WebView
    private var speaker: TextToSpeech? = null
    private var ttsReady = false
    private var pendingMediaPermission: PermissionRequest? = null
    private val mediaPermissionRequestCode = 9001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i(LOG_TAG, "APP_STARTED")
        speaker = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            Log.i(LOG_TAG, "TTS_READY=$ttsReady")
        }
        webView = WebView(this)
        setContentView(webView)

        WebViewCompat.addWebMessageListener(webView, "HitelNative", setOf(ORIGIN)) {
            _, message, origin, isMainFrame, reply ->
            if (!isMainFrame || origin.scheme != "https" || origin.host != Uri.parse(ORIGIN).host) {
                return@addWebMessageListener
            }
            try {
                val req = JSONObject(message.data ?: "{}")
                val action = req.optString("action")
                val response = JSONObject().put("ok", true)
                    .put("requestId", req.optString("requestId"))
                    .put("platform", "android")
                when (action) {
                    "ping" -> Log.i(LOG_TAG, "BRIDGE_PING_OK")
                    "getCapabilities" -> {
                        response.put("bridgeVersion", 1)
                        response.put("capabilities", JSONObject()
                            .put("nativeBridge", true)
                            .put("localTts", true)
                            .put("openSystemDialer", true)
                            .put("webrtcWebview", true)
                            .put("readCellularRemoteAudio", false)
                            .put("injectCellularAudio", false))
                        Log.i(LOG_TAG, "CAPABILITIES_OK")
                    }
                    "tts.speak" -> {
                        val text = req.optString("text").take(1000)
                        if (text.isBlank() || !ttsReady) {
                            response.put("ok", false).put("error", "Local TTS unavailable")
                        } else {
                            speaker?.language = Locale.forLanguageTag(req.optString("language", "ko-KR"))
                            response.put("ok", speaker?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "hitel-local") == TextToSpeech.SUCCESS)
                            response.put("scope", "local-device-only")
                        }
                    }
                    "tts.stop" -> {
                        speaker?.stop()
                        response.put("scope", "local-device-only")
                    }
                    "call.openDialer" -> {
                        val number = req.optString("phone")
                        if (!number.matches(Regex("[+0-9*# -]{1,24}"))) {
                            response.put("ok", false).put("error", "Invalid number")
                        } else {
                            try {
                                startActivity(Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", number, null)))
                            } catch (_: ActivityNotFoundException) {
                                response.put("ok", false).put("error", "Dialer unavailable")
                            }
                        }
                    }
                    else -> response.put("ok", false).put("error", "Unsupported action")
                }
                reply.postMessage(response.toString())
            } catch (e: Exception) {
                Log.e(LOG_TAG, "BRIDGE_ERROR " + e.message)
                reply.postMessage(JSONObject().put("ok", false).put("error", "Invalid request").toString())
            }
        }

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = true
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val trusted = request.origin.scheme == "https" &&
                        request.origin.host == Uri.parse(ORIGIN).host
                    val resources = request.resources.toSet()
                    val allowed = setOf(
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE,
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE
                    )
                    if (!trusted || resources.isEmpty() || !allowed.containsAll(resources)) {
                        request.deny()
                        return@runOnUiThread
                    }
                    val missing = mutableListOf<String>()
                    if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) &&
                        checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
                    ) missing.add(Manifest.permission.RECORD_AUDIO)
                    if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) &&
                        checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED
                    ) missing.add(Manifest.permission.CAMERA)
                    if (missing.isEmpty()) {
                        request.grant(request.resources)
                    } else {
                        pendingMediaPermission?.deny()
                        pendingMediaPermission = request
                        requestPermissions(missing.toTypedArray(), mediaPermissionRequestCode)
                    }
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingMediaPermission === request) pendingMediaPermission = null
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.scheme == "https" && url.host == Uri.parse(ORIGIN).host) return false
                if (url.scheme == "http" || url.scheme == "https")
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                else if (url.scheme == "tel")
                    startActivity(Intent(Intent.ACTION_DIAL, url))
                return true
            }
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                Log.i(LOG_TAG, "WEB_LOADED $url")
                // Native -> WebView event channel consumed by Communication SDK.
                if (Uri.parse(url).host == Uri.parse(ORIGIN).host) {
                    view.evaluateJavascript(
                        """window.dispatchEvent(new CustomEvent('hitel-native-event',{detail:{type:'app.ready',platform:'android'}}))""",
                        null
                    )
                }
                view.evaluateJavascript(
                    """window.HitelNative && (window.HitelNative.postMessage(JSON.stringify({action:'ping'})),window.HitelNative.postMessage(JSON.stringify({action:'getCapabilities'})))""",
                    null
                )
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) Log.e(LOG_TAG, "WEB_ERROR " + error.errorCode + " " + error.description)
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (request.isForMainFrame) Log.e(LOG_TAG, "HTTP_ERROR " + response.statusCode)
            }
        }
        webView.loadUrl(HOME)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != mediaPermissionRequestCode) return
        val webRequest = pendingMediaPermission ?: return
        pendingMediaPermission = null
        if (grantResults.isNotEmpty() &&
            grantResults.size == permissions.size &&
            grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        ) {
            webRequest.grant(webRequest.resources)
        } else {
            webRequest.deny()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        speaker?.stop()
        speaker?.shutdown()
        webView.destroy()
        super.onDestroy()
    }
}
