package app.hitel.nativebridge

import android.app.Activity
import android.graphics.Bitmap
import android.view.PixelCopy
import android.os.Handler
import android.os.Looper
import android.util.Base64
import java.io.ByteArrayOutputStream
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
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

class MainActivity : Activity() {
    companion object {
        const val ORIGIN = "https://hitel-web-preview-production.up.railway.app"
        const val LAB_ORIGIN = "https://hitel-communication-web-production.up.railway.app"
        const val RELAY_ORIGIN = "wss://hitel-device-relay-production.up.railway.app"
        const val HOME = "$ORIGIN/portal"
        const val LOG_TAG = "HITEL_E2E"
    }

    private lateinit var webView: WebView
    private val networkClient = OkHttpClient()
    private var communicationSocket: WebSocket? = null
    private var communicationToken: String? = null
    /** Native app opens the signaling socket itself; this is NOT the WebView JS Bridge. */
    private fun connectCommunicationNetwork(token: String) {
        if (token.isBlank() || token == communicationToken || labDestroyed) return
        communicationSocket?.close(1000, "Communication session replaced")
        communicationToken = token
        val uri = Uri.parse(RELAY_ORIGIN + "/comm-api/ws").buildUpon()
            .appendQueryParameter("token", token).build().toString()
        val request = Request.Builder().url(uri).build()
        communicationSocket = networkClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(LOG_TAG, "COMM_SOCKET_CONNECTED")
                webSocket.send(JSONObject().put("type", "comm.ping").toString())
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val event = JSONObject(text)
                    when (event.optString("type")) {
                        "comm.pong" -> Log.i(LOG_TAG, "COMM_SOCKET_PONG")
                        "comm.snapshot" -> Log.i(LOG_TAG, "COMM_SNAPSHOT_OK")
                        "comm.event" -> {
                            val detail=JSONObject().put("type","communication.event")
                                .put("event",event.optJSONObject("event"))
                            runOnUiThread {
                                if (!labDestroyed) webView.evaluateJavascript(
                                    "window.dispatchEvent(new CustomEvent('hitel-native-event',{detail:" +
                                        detail.toString() + "}))", null
                                )
                            }
                        }
                    }
                } catch (e: Exception) { Log.w(LOG_TAG, "COMM_EVENT_ERROR " + e.message) }
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w(LOG_TAG, "COMM_SOCKET_FAILURE " + t.message)
                reconnect(webSocket)
            }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                reconnect(webSocket)
            }
            private fun reconnect(socket: WebSocket) {
                if (communicationSocket !== socket || labDestroyed) return
                communicationToken = null
                frameHandler.postDelayed({
                    if (!labDestroyed && communicationToken == null) connectCommunicationNetwork(token)
                }, 3000)
            }
        })
    }

    private var labSocket: WebSocket? = null
    private var activeTicket: String? = null
    private var labDestroyed = false
    private val frameHandler = Handler(Looper.getMainLooper())
    private var frameTask: Runnable? = null

    private fun startFrameStream(socket: WebSocket) {
        frameTask?.let { frameHandler.removeCallbacks(it) }
        val task = object : Runnable {
            override fun run() {
                if (labSocket !== socket || webView.width <= 0 || webView.height <= 0) return
                try {
                    val bitmap = Bitmap.createBitmap(webView.width,webView.height,Bitmap.Config.ARGB_8888)
                    PixelCopy.request(window,bitmap,{status ->
                        if(status == PixelCopy.SUCCESS && labSocket === socket){
                            val out=ByteArrayOutputStream()
                            bitmap.compress(Bitmap.CompressFormat.PNG,80,out)
                            if(out.size() < 2_000_000){
                                socket.send(JSONObject().put("type","frame")
                                    .put("png",Base64.encodeToString(out.toByteArray(),Base64.NO_WRAP)).toString())
                            }
                        }
                        bitmap.recycle()
                    },frameHandler)
                } catch(e: Exception){Log.w(LOG_TAG,"LAB_FRAME_ERROR " + e.message)}
                frameHandler.postDelayed(this,4000)
            }
        }
        frameTask=task
        frameHandler.postDelayed(task,2500)
    }
    private fun isTrusted(host: String?) = host == Uri.parse(ORIGIN).host || host == Uri.parse(LAB_ORIGIN).host

    private fun connectLabNetwork(ticket: String) {
        if (ticket.isBlank() || ticket == activeTicket) return
        labSocket?.close(1000, "Pairing replaced")
        activeTicket = ticket
        val uri = Uri.parse(RELAY_ORIGIN + "/lab-api/ws").buildUpon()
            .appendQueryParameter("role", "device")
            .appendQueryParameter("side", "android")
            .appendQueryParameter("ticket", ticket).build().toString()
        val request = Request.Builder().url(uri).build()
        labSocket = networkClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(LOG_TAG, "LAB_SOCKET_CONNECTED")
                runOnUiThread { startFrameStream(webSocket) }
                webSocket.send(JSONObject().put("type", "hello").put("platform", "android")
                    .put("capabilities", "webview,tts,dialer,camera,mic").toString())
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = JSONObject(text)
                    if (msg.optString("type") != "command") return
                    val action = msg.optString("action")
                    runOnUiThread {
                        val result = JSONObject().put("type","result")
                            .put("requestId",msg.optString("requestId")).put("platform","android")
                            .put("ok",true)
                        val data=msg.optJSONObject("data") ?: JSONObject()
                        try {
                            when (action) {
                                "home", "launch", "navigate" -> {
                                    val screen=if(action=="navigate")msg.optString("screen","home")else "home"
                                    val safe=if(screen in setOf("home","sdk","ai","call","media"))screen else "home"
                                    webView.loadUrl(LAB_ORIGIN + "/sdk-lab/device?side=android&screen=" + safe + "&pair=" + Uri.encode(ticket))
                                }
                                "reload" -> webView.reload()
                                "back" -> if (webView.canGoBack()) webView.goBack()
                                "ping" -> Unit
                                "getCapabilities" -> result.put("capabilities", JSONObject()
                                    .put("nativeBridge",true).put("localTts",true)
                                    .put("openSystemDialer",true).put("webrtcWebview",true)
                                    .put("readCellularRemoteAudio",false).put("injectCellularAudio",false))
                                "tts.speak" -> {
                                    val body=data.optString("text").take(1000)
                                    if(body.isBlank()||!ttsReady)throw IllegalStateException("TTS unavailable")
                                    speaker?.language=Locale.forLanguageTag(data.optString("language","ko-KR"))
                                    result.put("ok",speaker?.speak(body,TextToSpeech.QUEUE_FLUSH,null,"hitel-wifi") == TextToSpeech.SUCCESS)
                                    result.put("scope","local-device-only")
                                }
                                "tts.stop" -> {speaker?.stop();result.put("scope","local-device-only")}
                                "call.openDialer" -> {
                                    val phone=data.optString("phone")
                                    if(!phone.matches(Regex("[+0-9*# -]{1,24}")))throw IllegalArgumentException("Invalid number")
                                    startActivity(Intent(Intent.ACTION_DIAL,Uri.fromParts("tel",phone,null)))
                                }
                                else -> throw IllegalArgumentException("Unsupported network action")
                            }
                        }catch(e:Exception){
                            result.put("ok",false).put("error",e.message ?: "Native command failed")
                        }
                        Log.i(LOG_TAG,"LAB_CMD_"+action.uppercase(Locale.ROOT))
                        webSocket.send(result.toString())
                    }
                } catch (e: Exception) { Log.w(LOG_TAG, "LAB_SOCKET_MESSAGE_ERROR " + e.message) }
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(LOG_TAG, "LAB_SOCKET_FAILURE " + t.message)
                if (labSocket === webSocket) {
                    activeTicket = null
                    frameHandler.postDelayed({
                        if (!labDestroyed && activeTicket == null) connectLabNetwork(ticket)
                    },3000)
                }
            }
        })
    }
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

        WebViewCompat.addWebMessageListener(webView, "HitelNative", setOf(ORIGIN, LAB_ORIGIN)) {
            _, message, origin, isMainFrame, reply ->
            if (!isMainFrame || origin.scheme != "https" || !isTrusted(origin.host)) {
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
                        isTrusted(request.origin.host)
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
                if (url.scheme == "https" && isTrusted(url.host)) return false
                if (url.scheme == "http" || url.scheme == "https")
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                else if (url.scheme == "tel")
                    startActivity(Intent(Intent.ACTION_DIAL, url))
                return true
            }
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                Log.i(LOG_TAG, "WEB_LOADED " + Uri.parse(url).buildUpon().clearQuery().build().toString())
                // Native -> WebView event channel consumed by Communication SDK.
                if (isTrusted(Uri.parse(url).host)) {
                    val paired = Uri.parse(url).getQueryParameter("pair")
                    if (!paired.isNullOrEmpty()) connectLabNetwork(paired)
                    Uri.parse(url).getQueryParameter("callToken")?.let { connectCommunicationNetwork(it) }
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
        val labUrl = intent.getStringExtra("hitel_url")
        val launchUrl = if (!labUrl.isNullOrBlank() && Uri.parse(labUrl).scheme == "https" &&
            Uri.parse(labUrl).host == Uri.parse(LAB_ORIGIN).host) labUrl else HOME
        webView.loadUrl(launchUrl)
        intent.getStringExtra("hitel_ticket")?.let { connectLabNetwork(it) }
        intent.getStringExtra("hitel_call_token")?.let { connectCommunicationNetwork(it) }
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
        labDestroyed = true
        frameTask?.let { frameHandler.removeCallbacks(it) }
        labSocket?.close(1000, "Activity destroyed")
        communicationSocket?.close(1000, "Activity destroyed")
        networkClient.dispatcher.executorService.shutdown()
        webView.destroy()
        super.onDestroy()
    }
}
