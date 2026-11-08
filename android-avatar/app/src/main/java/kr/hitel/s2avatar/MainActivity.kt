package kr.hitel.s2avatar

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.util.zip.ZipInputStream
import org.json.JSONObject

/**
 * Local, secure WebView host. No user videos or voice are uploaded by this class.
 * /avatar/ is served from the app-private avatar directory.
 */
class MainActivity : Activity() {
    private val localOrigin = "https://appassets.androidplatform.net"
    private val pickAvatar = 2001
    private val pickAudio = 2002
    private val audioPermissionCode = 2003
    private lateinit var page: WebView
    private lateinit var avatarDir: File
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingAudioPermission: PermissionRequest? = null

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        avatarDir = File(filesDir, "avatar/current").apply { mkdirs() }
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/avatar/", WebViewAssetLoader.InternalStoragePathHandler(this, avatarDir))
            .build()
        page = WebView(this)
        page.settings.javaScriptEnabled = true
        page.settings.domStorageEnabled = true
        page.settings.allowFileAccess = false
        page.settings.allowContentAccess = false
        page.settings.mediaPlaybackRequiresUserGesture = true
        page.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        page.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.scheme == "https" && request.url.host == "appassets.androidplatform.net") return false
                if (request.url.scheme == "about") return false
                try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                catch (_: Exception) { Log.w("HITEL", "Cannot open URL") }
                return true
            }
        }
        page.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                Log.d("HITEL-AVATAR", message.message() + " @" + message.lineNumber())
                return true
            }
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (request.origin.scheme != "https" ||
                        request.origin.host != "appassets.androidplatform.net" ||
                        !request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        request.deny()
                        return@runOnUiThread
                    }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                    } else {
                        pendingAudioPermission = request
                        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), audioPermissionCode)
                    }
                }
            }
            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingAudioPermission === request) pendingAudioPermission = null
            }
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                parameters: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "audio/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("audio/wav", "audio/x-wav", "audio/wave"))
                }
                startActivityForResult(intent, pickAudio)
                return true
            }
        }
        page.addJavascriptInterface(object {
            @JavascriptInterface fun importAvatarZip() {
                runOnUiThread {
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/zip"
                    }
                    startActivityForResult(intent, pickAvatar)
                }
            }
            @JavascriptInterface fun hasAvatar(): Boolean =
                File(avatarDir, "01.mp4").isFile &&
                    File(avatarDir, "combined_data.json.gz").isFile
        }, "HitelAndroid")
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        setContentView(page)
        page.loadUrl(localOrigin + "/assets/index.html")
    }

    @Deprecated("Activity result API retained to avoid extra Android dependencies")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == pickAudio) {
            fileCallback?.onReceiveValue(if (resultCode == RESULT_OK && data?.data != null) arrayOf(data.data!!) else null)
            fileCallback = null
            return
        }
        if (requestCode == pickAvatar && resultCode == RESULT_OK && data?.data != null) {
            val uri = data.data!!
            Thread {
                try {
                    importZip(uri)
                    runOnUiThread {
                        page.evaluateJavascript("window.hitelAvatarImported(true, '아바타 팩 설치 완료')", null)
                    }
                } catch (e: Exception) {
                    Log.e("HITEL-AVATAR", "Failed to import avatar", e)
                    runOnUiThread {
                        page.evaluateJavascript("window.hitelAvatarImported(false, " + JSONObject.quote(e.message ?: "압축 파일 오류") + ")", null)
                    }
                }
            }.start()
        }
    }

    /** Only two allow-listed files; no zip-slip or unbounded archive expansion. */
    private fun importZip(uri: Uri) {
        val staging = File(filesDir, "avatar/staging")
        staging.deleteRecursively()
        staging.mkdirs()
        val expected = setOf("01.mp4", "combined_data.json.gz")
        val found = mutableSetOf<String>()
        var total = 0L
        try {
            contentResolver.openInputStream(uri)?.use { input ->
                ZipInputStream(input).use { archive ->
                    while (true) {
                        val entry = archive.nextEntry ?: break
                        val path = entry.name
                        if (!entry.isDirectory && path in expected) {
                            check(found.add(path)) { "아바타 파일이 중복되었습니다: " + path }
                            File(staging, path).outputStream().use { dest ->
                                val buf = ByteArray(8192)
                                var fileBytes = 0L
                                while (true) {
                                    val n = archive.read(buf)
                                    if (n < 0) break
                                    fileBytes += n
                                    total += n
                                    check(fileBytes <= 100L * 1024 * 1024 && total <= 120L * 1024 * 1024) {
                                        "아바타 파일이 너무 큽니다."
                                    }
                                    dest.write(buf, 0, n)
                                }
                            }
                        }
                        archive.closeEntry()
                    }
                }
            } ?: error("압축 파일을 열 수 없습니다.")
            check(found == expected) { "01.mp4 및 combined_data.json.gz가 모두 필요합니다." }
            check(File(staging, "01.mp4").length() > 0L && File(staging, "combined_data.json.gz").length() > 0L) {
                "빈 아바타 파일입니다."
            }
            val previous = File(filesDir, "avatar/previous")
            previous.deleteRecursively()
            if (avatarDir.exists()) check(avatarDir.renameTo(previous)) { "기존 아바타 교체 실패" }
            if (!staging.renameTo(avatarDir)) {
                if (previous.exists()) previous.renameTo(avatarDir)
                error("새 아바타 저장 실패")
            }
            previous.deleteRecursively()
        } finally {
            staging.deleteRecursively()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, results)
        if (requestCode == audioPermissionCode) {
            val pending = pendingAudioPermission
            pendingAudioPermission = null
            if (results.firstOrNull() == PackageManager.PERMISSION_GRANTED)
                pending?.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            else pending?.deny()
        }
    }

    override fun onPause() { page.onPause(); super.onPause() }
    override fun onResume() { super.onResume(); page.onResume() }
    override fun onDestroy() {
        pendingAudioPermission?.deny()
        fileCallback?.onReceiveValue(null)
        page.destroy()
        super.onDestroy()
    }
}
