package ai.bithuman.flutter

import android.util.Log
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Three-stage original GPU -> compact GPU -> vendor CPU fallback observer and selective dispatcher.
 * Loaded after ORIGINAL vendor JNI in GPU3 process only; BASELINE remains original.
 * The ORIGINAL native ELF, AvatarPlayer, PCM and renderer code are unchanged.
 * JNI functions are provided by the 2026-11-22 pinned probe C++ source.
 */
internal object HitelSdkProbe {
    private val started = AtomicBoolean(false)
    private external fun nativeInstall(profilePrefix: String): Int
    private external fun nativePrepareGpuAudit(): Int
    private external fun nativeDrain(): Array<String>

    @JvmStatic fun afterNativeLoad() {
        if (HitelSdkLoader.route() != "GPU3" || !started.compareAndSet(false, true)) return
        try {
            System.loadLibrary("hitel_e2_probe")
            val flags = nativeInstall("")
            val hook = nativePrepareGpuAudit()
            HitelE2Trace.event("sdk.backend.clhook", "sdkRoute" to "GPU3",
                "installed" to (hook == 1), "captureFlags" to flags,
                "executionOrder" to "ORIGINAL_GPU>COMPACT_GPU>ORIGINAL_CPU",
                "originalNativeUnchanged" to true,
                "sourceSdk" to "ORIGINAL:3eed0894;gpu3:runtime-dispatch-only")
            if (hook != 1) Log.e("HITEL_GPU_SDK", "GPU3 hook NOT installed; original vendor fallback still available")
            Thread({
                while (!Thread.currentThread().isInterrupted) {
                    try {
                        val lines = nativeDrain()
                        for (entry in lines) {
                            val f = entry.split('\t', limit = 6)
                            if (f.size != 6) continue
                            HitelE2Trace.event("sdk.backend.native",
                                "sdkRoute" to "GPU3", "nativeNs" to f[0], "nativeTid" to f[1],
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
            }, "hitel-gpu3-gpu-probe").apply { isDaemon = true; start() }
        } catch (ex: Throwable) {
            Log.e("HITEL_GPU_SDK", "GPU3 probe startup failed", ex)
            HitelE2Trace.failure("sdk.backend.clhook.failure", ex, "sdkRoute" to "GPU3")
        }
    }
}
