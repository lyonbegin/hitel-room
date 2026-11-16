// HITEL extension of the Apache-2.0 bitHuman Flutter Android bridge.
// Original vendor SDK 0.6.2, JNI and model are NOT modified.
package ai.bithuman.flutter

import ai.bithuman.expression2.Accelerator
import ai.bithuman.expression2.Device
import ai.bithuman.expression2.Expression2Avatar
import ai.bithuman.expression2.Expression2Model
import ai.bithuman.expression2.Expression2Options
import ai.bithuman.expression2.Routing
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import java.io.File

/** Use real device/library capabilities and ORIGINAL model compilation to select a route.
 * Library/GPU presence is not proof of neural inference. A first actual output frame is
 * independently reported by the plugin's Expression2Engine.pull().
 * The genuine original credential/entitlement/store/meter remain unchanged.
 */
internal object Expression2RouteSelector {
    private const val TAG = "BH_EXPR2_DEVICE_ROUTE"
    private const val PREFS = "hitel_expression2_route_v1"
    private const val SDK_ID = "expression2-android-0.6.2-qnn-2.49.0"
    private enum class Backend { ADRENO_GPU, HEXAGON_HTP, CPU }

    private data class Caps(
        val dir: File, val delegate: Boolean, val gpu: Boolean,
        val htp: Boolean, val vulkan: Boolean,
        val socManufacturer: String, val socModel: String
    )

    private fun inspect(context: Context): Caps {
        // The original SDK searches applicationInfo.nativeLibraryDir.
        val dir = File(context.applicationInfo.nativeLibraryDir)
        val files = dir.listFiles()?.map { it.name }?.toSet() ?: emptySet()
        val caps = Caps(
            dir, "libQnnTFLiteDelegate.so" in files, "libQnnGpu.so" in files,
            files.any { it.startsWith("libQnnHtp") },
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_VULKAN_HARDWARE_LEVEL),
            if (Build.VERSION.SDK_INT >= 31) Build.SOC_MANUFACTURER else Build.MANUFACTURER,
            if (Build.VERSION.SDK_INT >= 31) Build.SOC_MODEL else Build.HARDWARE
        )
        Log.i(TAG, "DEVICE_CAPABILITIES abi=${Build.SUPPORTED_ABIS.joinToString()} " +
            "soc=${caps.socManufacturer}/${caps.socModel} vulkan=${caps.vulkan} " +
            "qnnDelegate=${caps.delegate} qnnGpu=${caps.gpu} qnnHtp=${caps.htp} " +
            "nativeLibraryDir=${caps.dir}")
        return caps
    }

    private fun options(backend: Backend): Expression2Options = when (backend) {
        Backend.ADRENO_GPU -> Expression2Options(
            accelerator = Accelerator.NPU,  // strict: never silently fallback to CPU
            routing = Routing.GPU_DECODER,
            qnnOptions = Expression2Options.QNN_OPTIONS_ADRENO_FP32
        )
        Backend.HEXAGON_HTP -> Expression2Options(
            accelerator = Accelerator.NPU,
            routing = Routing.HTP_DECODER,
            qnnOptions = Expression2Options.DEFAULT_QNN_OPTIONS
        )
        Backend.CPU -> Expression2Options(
            accelerator = Accelerator.CPU,
            routing = Routing.ALL_CPU
        )
    }

    fun create(context: Context, model: Expression2Model): Expression2Avatar {
        val caps = inspect(context)
        val possible = buildList {
            if (caps.delegate && caps.gpu) add(Backend.ADRENO_GPU)
            if (caps.delegate && caps.htp) add(Backend.HEXAGON_HTP)
            add(Backend.CPU)
        }
        // Retain only a verified successful path for the current system, SDK,
        // model and native library layout, never for a guessed Galaxy model name.
        val identity = "${Build.FINGERPRINT}|$SDK_ID|${model.code}|" +
            "${model.modelBytes}|${model.combinedModel?.length()}|" +
            "${model.identityModel?.length()}|${caps.delegate}:${caps.gpu}:${caps.htp}"
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val cached = if (prefs.getString("identity", "") == identity)
            runCatching { Backend.valueOf(prefs.getString("route", "") ?: "") }.getOrNull()
        else null
        val candidates = if (cached in possible)
            listOf(cached!!) + possible.filterNot { it == cached }
        else possible
        Log.i(TAG, "ROUTE_CANDIDATES ${candidates.joinToString()} cached=${cached ?: "none"}")
        var lastError: Throwable? = null
        for (backend in candidates) {
            val requested = options(backend)
            val started = SystemClock.elapsedRealtime()
            Log.i(TAG, "ROUTE_CREATE_BEGIN requested=$backend qnnOptions=${requested.qnnOptions} " +
                "routing=${requested.routing}")
            try {
                val avatar = Expression2Avatar.create(context, model, requested)
                // Original JVM calls BOTH QNN GPU and HTP routes Device.NPU.
                val valid = if (backend == Backend.CPU)
                    avatar.accelerator == Accelerator.CPU && avatar.routing == Routing.ALL_CPU
                else
                    avatar.accelerator == Accelerator.NPU && avatar.routing.dec == Device.NPU
                if (!valid) {
                    Log.w(TAG, "ROUTE_CREATE_REJECTED requested=$backend actual=${avatar.accelerator} " +
                        "routing=${avatar.routing} note=${avatar.acceleratorNote}")
                    avatar.close()
                    continue
                }
                Log.i(TAG, "ROUTE_CREATE_PASS requested=$backend actual=${avatar.accelerator} " +
                    "routing=${avatar.routing} initMs=${avatar.initMs} " +
                    "elapsedMs=${SystemClock.elapsedRealtime() - started} " +
                    "note=${avatar.acceleratorNote}")
                prefs.edit().putString("identity", identity).putString("route", backend.name).apply()
                return avatar
            } catch (failure: Throwable) {
                if (failure is VirtualMachineError || failure is ThreadDeath) throw failure
                lastError = failure
                Log.w(TAG, "ROUTE_CREATE_FAIL requested=$backend " +
                    "elapsedMs=${SystemClock.elapsedRealtime() - started} " +
                    "cause=${failure.javaClass.simpleName} message=${failure.message}")
            }
        }
        throw IllegalStateException("Original Expression2 engine could not create on any backend", lastError)
    }
}
