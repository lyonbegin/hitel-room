package io.agents.pokeclaw.hitel

import android.app.Activity
import android.os.Bundle
import android.content.Context
import android.graphics.Rect
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.text.InputType
import android.content.pm.ApplicationInfo
import io.agents.pokeclaw.service.ClawAccessibilityService
import org.json.JSONObject
import org.json.JSONArray
import java.net.URL
import java.net.HttpURLConnection
import java.util.concurrent.atomic.AtomicBoolean

/** Short, explicitly approved direct execution session. No autonomous phone-side LLM. */
class HitelDirectActivity : Activity() {
    private val active = AtomicBoolean(false)
    private lateinit var status: TextView
    private fun debugBuild() = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32, 48, 32, 24) }
        layout.addView(TextView(this).apply { text = "HITEL Direct — authorize screen reading and app navigation for up to 180 seconds. Only approve a trusted controller. Do not open sensitive screens." })
        val endpoint = EditText(this).apply { hint = "HTTPS gateway"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI }
        val token = EditText(this).apply { hint = "Device token"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
        // Disposable emulator test configuration only; never accepts prefilled secrets in release.
        if (debugBuild()) {
            endpoint.setText(intent.getStringExtra("test_endpoint") ?: "")
            token.setText(intent.getStringExtra("test_token") ?: "")
        }
        status = TextView(this).apply { text = "Not authorized." }
        layout.addView(endpoint); layout.addView(token)
        layout.addView(Button(this).apply {
            text = "Approve direct session"
            setOnClickListener {
                try {
                    val url = URL(endpoint.text.toString().trim().trimEnd('/'))
                    val loopback = debugBuild() && url.protocol == "http" && url.host == "127.0.0.1" && url.port == 8766
                    require((url.protocol == "https" || loopback) && url.userInfo == null && url.query == null && url.ref == null && url.host.isNotBlank())
                    val key = token.text.toString().trim()
                    require(key.length >= 32)
                    require(ClawAccessibilityService.isRunning())
                    if (active.compareAndSet(false, true)) {
                        status.text = "Authorized: 180 seconds maximum."
                        Thread { runSession(url.toString(), key) }.start()
                    }
                } catch (_: Exception) { status.text = "Valid gateway, token and enabled Accessibility service required." }
            }
        })
        layout.addView(Button(this).apply { text = "Stop direct session"; setOnClickListener { active.set(false); status.text = "Stopped." } })
        layout.addView(status)
        setContentView(layout)
    }
    override fun onDestroy() { active.set(false); super.onDestroy() }

    private fun request(base: String, key: String, path: String, body: JSONObject? = null): JSONObject {
        val c = URL(base + path).openConnection() as HttpURLConnection
        try {
            c.instanceFollowRedirects = false
            c.connectTimeout = 5000; c.readTimeout = 10000
            c.setRequestProperty("Authorization", "Bearer $key")
            if (body != null) {
                c.requestMethod = "POST"; c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            check(c.responseCode in 200..299)
            return JSONObject(c.inputStream.bufferedReader().use { it.readText() })
        } finally { c.disconnect() }
    }
    private fun runSession(base: String, key: String) {
        val end = android.os.SystemClock.elapsedRealtime() + 180000
        var count = 0
        try {
            while (active.get() && android.os.SystemClock.elapsedRealtime() < end && count < 16) {
                val item = request(base, key, "/device/actions/pending")
                if (!item.has("id")) { Thread.sleep(400); continue }
                val id = item.getString("id")
                require(id.matches(Regex("[0-9a-f]{32}")))
                if (!active.get()) break
                val answer = try { execute(item.getString("action"), item.getJSONObject("args")) }
                catch (_: Exception) { JSONObject().put("ok", false).put("error", "native action failed") }
                request(base, key, "/device/actions/$id", answer)
                count++
            }
        } catch (_: Exception) {
            runOnUiThread { status.text = "Session ended: connection or action error." }
        } finally { active.set(false) }
    }

    private fun execute(action: String, args: JSONObject): JSONObject {
        val service = ClawAccessibilityService.getInstance() ?: return JSONObject().put("ok", false).put("error", "Accessibility unavailable")
        val root = service.rootInActiveWindow
        val pkg = root?.packageName?.toString() ?: ""
        // Never expose or operate on account/authentication/permission surfaces.
        if (pkg in setOf("com.google.android.gms", "com.google.android.gsf.login", "com.android.permissioncontroller", "com.google.android.permissioncontroller")) {
            root?.recycle()
            return JSONObject().put("ok", false).put("error", "sensitive system surface")
        }
        val answer = JSONObject()
        if (action == "get_screen_info") {
            val nodes = JSONArray()
            var sensitive = false
            fun visit(node: android.view.accessibility.AccessibilityNodeInfo, depth: Int) {
                if (depth > 20 || nodes.length() >= 160) return
                if (node.isPassword) { sensitive = true; return }
                if (node.isVisibleToUser) {
                    val b = Rect(); node.getBoundsInScreen(b)
                    nodes.put(JSONObject().put("text", node.text?.toString()?.take(120) ?: "")
                        .put("description", node.contentDescription?.toString()?.take(120) ?: "")
                        .put("x", b.centerX()).put("y", b.centerY()).put("clickable", node.isClickable))
                }
                for (i in 0 until node.childCount) {
                    val child = node.getChild(i) ?: continue
                    try { visit(child, depth + 1) } finally { child.recycle() }
                }
            }
            try { if (root != null) visit(root, 0) } finally { root?.recycle() }
            if (sensitive || pkg.isEmpty()) return JSONObject().put("ok", false).put("error", "screen unavailable or sensitive")
            return answer.put("ok", true).put("package", pkg).put("nodes", nodes)
        }
        root?.recycle()
        val metrics = resources.displayMetrics
        fun coordinate(name: String, limit: Int): Int = args.getInt(name).also { require(it in 0 until limit) }
        val success = when (action) {
            "open_app" -> {
                val target = args.getString("package")
                require(target.matches(Regex("[A-Za-z0-9_.]{1,160}")))
                require(target !in setOf("com.google.android.gms", "com.google.android.gsf.login"))
                service.openApp(target)
            }
            "tap" -> service.performTap(coordinate("x", metrics.widthPixels), coordinate("y", metrics.heightPixels))
            "swipe" -> service.performSwipe(coordinate("x1", metrics.widthPixels), coordinate("y1", metrics.heightPixels), coordinate("x2", metrics.widthPixels), coordinate("y2", metrics.heightPixels), 350L)
            "back" -> service.pressBack()
            "home" -> service.pressHome()
            else -> false
        }
        return answer.put("ok", success).put("action", action)
    }
}
