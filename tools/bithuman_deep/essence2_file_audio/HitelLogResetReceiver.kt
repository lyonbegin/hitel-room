package ai.bithuman.flutter

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Package replacement runs after Android has stopped the old APK's process. */
class HitelLogResetReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            HitelDiagnostics.prepareForInstall(context)
        }
    }
}
