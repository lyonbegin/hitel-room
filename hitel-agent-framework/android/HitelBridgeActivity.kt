package io.agents.pokeclaw.hitel

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import io.agents.pokeclaw.automation.ExternalAutomationActivity
import io.agents.pokeclaw.automation.ExternalAutomationContract
import org.json.JSONObject
import java.net.URL
import javax.net.ssl.HttpsURLConnection

/** Explicitly user-operated bridge for the development gateway. */
class HitelBridgeActivity : Activity() {
    private lateinit var status: TextView
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = getSharedPreferences("hitel_bridge", Context.MODE_PRIVATE)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 48, 32, 24)
        }
        layout.addView(TextView(this).apply { text = "HITEL device bridge — review each task before execution" })
        val url = EditText(this).apply {
            hint = "HTTPS ARTEMIS gateway base URL"
            setText(prefs.getString("url", ""))
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
        }
        val token = EditText(this).apply {
            hint = "Device token"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setText(prefs.getString("token", ""))
        }
        status = TextView(this).apply { text = "No request approved." }
        layout.addView(url); layout.addView(token)
        layout.addView(Button(this).apply {
            text = "Check pending task"
            setOnClickListener {
                try {
                    val endpoint = URL(url.text.toString().trim().trimEnd('/'))
                    require(endpoint.protocol == "https" && endpoint.host.isNotBlank() &&
                        endpoint.userInfo == null && endpoint.query == null && endpoint.ref == null)
                    val secret = token.text.toString().trim()
                    require(secret.length >= 32)
                    prefs.edit().putString("url", endpoint.toString()).putString("token", secret).apply()
                    fetchTask()
                } catch (_: Exception) { status.text = "HTTPS URL and device token required." }
            }
        })
        layout.addView(status)
        setContentView(layout)
    }

    private fun fetchTask() {
        status.text = "Checking..."
        Thread {
            try {
                val task = HitelBridgeHttp.request(this, "/device/pending")
                runOnUiThread {
                    if (!task.has("id")) {
                        status.text = "No pending tasks."
                    } else {
                        val id = task.getString("id")
                        val goal = task.getString("goal")
                        AlertDialog.Builder(this)
                            .setTitle("Approve phone task?")
                            .setMessage(goal)
                            .setPositiveButton("Approve") { _, _ -> decide(id, goal, true) }
                            .setNegativeButton("Reject") { _, _ -> decide(id, goal, false) }
                            .show()
                    }
                }
            } catch (_: Exception) { runOnUiThread { status.text = "Connection failed." } }
        }.start()
    }

    private fun decide(id: String, goal: String, approve: Boolean) {
        Thread {
            try {
                HitelBridgeHttp.request(this, "/device/tasks/$id",
                    JSONObject().put("status", if (approve) "approved" else "rejected"))
                if (approve) {
                    getSharedPreferences("hitel_bridge", Context.MODE_PRIVATE).edit()
                        .putString("active_request", id).commit()
                }
                runOnUiThread {
                    status.text = if (approve) "Approved; launching PokeClaw." else "Rejected."
                    if (approve) {
                        val intent = Intent(this, ExternalAutomationActivity::class.java).apply {
                            action = ExternalAutomationContract.ACTION_RUN_TASK
                            putExtra(ExternalAutomationContract.EXTRA_TASK, goal)
                            putExtra(ExternalAutomationContract.EXTRA_REQUEST_ID, id)
                            putExtra(ExternalAutomationContract.EXTRA_RETURN_ACTION, HitelCallbackReceiver.ACTION)
                            putExtra(ExternalAutomationContract.EXTRA_RETURN_PACKAGE, packageName)
                        }
                        startActivity(intent)
                    }
                }
            } catch (_: Exception) { runOnUiThread { status.text = "Could not submit decision." } }
        }.start()
    }
}

internal object HitelBridgeHttp {
    fun request(context: Context, path: String, body: JSONObject? = null): JSONObject {
        val prefs = context.getSharedPreferences("hitel_bridge", Context.MODE_PRIVATE)
        val base = prefs.getString("url", "") ?: ""
        val token = prefs.getString("token", "") ?: ""
        require(base.startsWith("https://") && token.length >= 32)
        val connection = URL(base.trimEnd('/') + path).openConnection() as HttpsURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 10000
            connection.readTimeout = 15000
            connection.setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                connection.requestMethod = "POST"
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            check(connection.responseCode in 200..299)
            return JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        } finally { connection.disconnect() }
    }
}
