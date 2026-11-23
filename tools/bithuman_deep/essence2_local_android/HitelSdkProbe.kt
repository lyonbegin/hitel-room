package ai.bithuman.flutter

import android.util.Log
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The original 2026-11-22 WG128 native OpenCL observer ONLY.
 * This is loaded after WG128 JNI initialization, never from BASELINE.
 * NO SDK methods, AvatarPlayer, PCM path or renderer are replaced.
 * JNI functions are provided by the 2026-11-22 pinned probe C++ source.
 */
internal object HitelSdkProbe {
    private val started = AtomicBoolean(false)
    private external fun nativeInstall(profilePrefix: String): Int
    private external fun nativePrepareGpuAudit(): Int
    private external fun nativeDrain(): Array<String>

    @JvmStatic fun afterNativeLoad() {
        if (HitelSdkLoader.route() != "WG128" || !started.compareAndSet(false, true)) return
        try {
            System.loadLibrary("hitel_e2_probe")
            val flags = nativeInstall("")
            val hook = nativePrepareGpuAudit()
            HitelE2Trace.event("sdk.backend.clhook", "sdkRoute" to "WG128",
                "installed" to (hook == 1), "captureFlags" to flags,
                "sourceSdk" to "bf7290b661:WG128_WavPull")
            if (hook != 1) Log.e("HITEL_GPU_SDK", "OpenCL hook NOT installed; do not claim GPU instrumentation")
            Thread({
                while (!Thread.currentThread().isInterrupted) {
                    try {
                        val lines = nativeDrain()
                        for (entry in lines) {
                            val f = entry.split('\t', limit = 6)
                            if (f.size != 6) continue
                            HitelE2Trace.event("sdk.backend.native",
                                "sdkRoute" to "WG128", "nativeNs" to f[0], "nativeTid" to f[1],
                                "nativeCpuUs" to f[2], "transport" to f[3], "message" to f[4],
                                "turn" to f[5])
                        }
                        Thread.sleep(320)
                    } catch (ex: InterruptedException) {
                        Thread.currentThread().interrupt()
                    } catch (ex: Throwable) {
                        Log.e("HITEL_GPU_SDK", "nativeDrain failure", ex)
                        break
                    }
                }
            }, "hitel-wg128-gpu-probe").apply { isDaemon = true; start() }
        } catch (ex: Throwable) {
            Log.e("HITEL_GPU_SDK", "WG128 probe startup failed", ex)
            HitelE2Trace.failure("sdk.backend.clhook.failure", ex, "sdkRoute" to "WG128")
        }
    }
}
