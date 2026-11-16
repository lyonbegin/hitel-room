package ai.hitel.hitel_expression2_gpu

import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * READ-ONLY diagnostics. Actual original SDK GPU/NPU inference remains inside the
 * vendored bitHuman Flutter BithumanPlugin and Expression2RouteSelector.
 *
 * Presence of native libraries or Android GPU features NEVER means QNN model
 * creation or inference has succeeded. For actual runtime evidence use route logs.
 */
class MainActivity : FlutterActivity() {
    private val channelName = "ai.hitel.expression2.hardware"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "inspectHardware" -> {
                        try {
                            result.success(inspectHardware())
                        } catch (error: Exception) {
                            result.error("DEVICE_INSPECT", error.message, null)
                        }
                    }
                    "readOwnLogs" -> {
                        Thread({
                            try {
                                val logs = readOwnLogs()
                                runOnUiThread { result.success(logs) }
                            } catch (error: Exception) {
                                runOnUiThread { result.error("LOGCAT", error.message, null) }
                            }
                        }, "expr2-own-logcat").apply { isDaemon = true }.start()
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun inspectHardware(): Map<String, Any> {
        val info = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val dir = File(applicationInfo.nativeLibraryDir)
        val names = dir.listFiles()?.map { it.name }?.toSet() ?: emptySet()
        val apkGpus = listOf("libQnnGpu.so", "libQnnTFLiteDelegate.so")
        val loadedGpu = apkGpus.all { it in names }
        val loadedNpu = "libQnnTFLiteDelegate.so" in names &&
            names.any { it.startsWith("libQnnHtp") }
        return linkedMapOf(
            "manufacturer" to Build.MANUFACTURER,
            "brand_model" to "${Build.BRAND} / ${Build.MODEL}",
            "android_api" to Build.VERSION.SDK_INT,
            "cpu_abis" to Build.SUPPORTED_ABIS.joinToString(", "),
            "soc_vendor" to (if (Build.VERSION.SDK_INT >= 31)
                Build.SOC_MANUFACTURER else Build.MANUFACTURER),
            "soc_model" to (if (Build.VERSION.SDK_INT >= 31)
                Build.SOC_MODEL else Build.HARDWARE),
            "open_gl_es" to info.deviceConfigurationInfo.glEsVersion,
            "vulkan_hardware_level" to packageManager.hasSystemFeature(
                PackageManager.FEATURE_VULKAN_HARDWARE_LEVEL),
            "qnn_gpu_libraries_extracted" to loadedGpu,
            "qnn_htp_libraries_extracted" to loadedNpu,
            "native_library_directory" to dir.absolutePath,
            "qnn_library_names" to names.filter { it.startsWith("libQnn") }
                .sorted().joinToString(", "),
            "caution" to "원본 모델 GPU 추론 성공은 ROUTE_CREATE_PASS로만 판정"
        )
    }

    private fun readOwnLogs(): String {
        val cmd = listOf("logcat", "-d", "--pid=${Process.myPid()}", "-t", "250")
        val p = ProcessBuilder(cmd).redirectErrorStream(true).start()
        val output = p.inputStream.bufferedReader().use { it.readText() }
        val status = p.waitFor()
        if (status != 0) return "logcat failed (exit $status): $output"
        val targets = listOf("BH_EXPR2_LOCAL_TEST", "BH_EXPR2_DEVICE_ROUTE", "EXPR2_LOCAL_FIXTURE", "BithumanPlugin", "Expression2",
            "QNN", "Qnn", "Gpu", "Delegate", "LiteRT")
        val matched = output.lineSequence().filter { line ->
            targets.any { line.contains(it) }
        }.takeLastSafe(180).joinToString("\n")
        return matched.ifEmpty {
            "이 앱 프로세스에 기록된 GPU 추론 로그가 아직 없습니다. " +
            "원본 SDK 버튼을 실행하신 후 새로고침하십시오."
        }
    }

    private fun <T> Sequence<T>.takeLastSafe(count: Int): List<T> =
        toList().takeLast(count)
}
