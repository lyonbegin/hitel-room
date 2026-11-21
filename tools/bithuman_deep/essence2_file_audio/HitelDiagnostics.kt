package ai.bithuman.flutter

import android.content.Context
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodChannel
import java.io.File

/** Runs before Dart boot, so a new APK cannot inherit the prior build's logs. */
class HitelDiagnostics(binding: FlutterPlugin.FlutterPluginBinding) {
    private val channel = MethodChannel(binding.binaryMessenger, "ai.hitel/diagnostics")
    private val main = Handler(Looper.getMainLooper())

    init {
        HitelE2Trace.init(binding.applicationContext)
        channel.setMethodCallHandler { call, result ->
            if (call.method == "clearNative") {
                HitelE2Trace.clear { error ->
                    main.post {
                        if (error == null) result.success(null)
                        else result.error("log_clear_failed", error.message, null)
                    }
                }
            } else result.notImplemented()
        }
    }

    fun close() { channel.setMethodCallHandler(null) }

    companion object {
        fun prepareForInstall(context: Context) {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            val folder = File(context.filesDir.parentFile, "app_flutter")
            val marker = File(context.filesDir, "hitel-diagnostics-install.txt")
            // lastUpdateTime changes even for install -r of the same versionCode.
            val stamp = "${info.firstInstallTime}:${info.lastUpdateTime}:${info.versionName}"
            DiagnosticFiles.clearForInstall(folder, marker, stamp)
        }
    }
}
