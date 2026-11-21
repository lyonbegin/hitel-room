package ai.bithuman.flutter

import android.content.Context
import android.content.ClipData
import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.core.content.FileProvider
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.OutputStreamWriter
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Runs before Dart boot, so a new APK cannot inherit the prior build's logs. */
class HitelDiagnostics(binding: FlutterPlugin.FlutterPluginBinding) {
    private val context = binding.applicationContext
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
            } else if (call.method == "share") {
                HitelE2Trace.afterWrites { failure ->
                    val export = runCatching {
                        if (failure != null) throw failure
                        val output = File(context.cacheDir, "hitel-diagnostics").apply { mkdirs() }
                        val archive = File(output, "HITEL_Essence2_Detailed_Trace.zip")
                        val folder = File(context.filesDir.parentFile, "app_flutter")
                        ZipOutputStream(archive.outputStream().buffered()).use { zip ->
                            for (name in DiagnosticFiles.names) {
                                val file = File(folder, name)
                                if (file.isFile) {
                                    zip.putNextEntry(ZipEntry(name))
                                    file.inputStream().use { it.copyTo(zip) }
                                    zip.closeEntry()
                                }
                            }
                            val report = OutputStreamWriter(zip, Charsets.UTF_8).buffered()
                            zip.putNextEntry(ZipEntry("frame_timeline.csv"))
                            HitelTimelineCsv.writeFrames(folder, report)
                            report.flush()
                            zip.closeEntry()
                        }
                        archive
                    }
                    main.post {
                        try {
                            val archive = export.getOrThrow()
                            val uri = FileProvider.getUriForFile(
                                context, context.packageName + ".hitel.diagnostics", archive)
                            val send = Intent(Intent.ACTION_SEND).apply {
                                type = "application/zip"
                                putExtra(Intent.EXTRA_STREAM, uri)
                                clipData = ClipData.newRawUri("HITEL diagnostics", uri)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            context.startActivity(Intent.createChooser(send, "HITEL 진단 로그").apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            })
                            result.success(null)
                        } catch (error: Exception) {
                            result.error("log_export_failed", error.message, null)
                        }
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
