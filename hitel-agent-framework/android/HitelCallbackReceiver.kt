package io.agents.pokeclaw.hitel

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import io.agents.pokeclaw.automation.ExternalAutomationContract
import org.json.JSONObject

/** In-package callback receiver; never exported to third-party apps. */
class HitelCallbackReceiver : BroadcastReceiver() {
    companion object { const val ACTION = "io.agents.pokeclaw.HITEL_TASK_CALLBACK" }
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION) return
        val id = intent.getStringExtra(ExternalAutomationContract.EXTRA_REQUEST_ID) ?: return
        val state = intent.getStringExtra(ExternalAutomationContract.EXTRA_STATUS) ?: return
        val prefs = context.getSharedPreferences("hitel_bridge", Context.MODE_PRIVATE)
        if (id != prefs.getString("active_request", null)) return
        val detail = (intent.getStringExtra(ExternalAutomationContract.EXTRA_RESULT)
            ?: intent.getStringExtra(ExternalAutomationContract.EXTRA_ERROR) ?: "").take(12000)
        val pending = goAsync()
        Thread {
            try {
                HitelBridgeHttp.request(context, "/device/tasks/$id",
                    JSONObject().put("status", state).put("detail", detail))
                if (state in setOf("completed", "failed", "cancelled", "blocked", "rejected")) {
                    prefs.edit().remove("active_request").apply()
                }
            } catch (_: Exception) {
                // Preserve request ID for diagnosis; do not report an invented success.
            } finally { pending.finish() }
        }.start()
    }
}
