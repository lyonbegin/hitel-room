package ai.bithuman.flutter

import android.content.Context
import android.os.Build
import android.os.Debug
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import android.os.Trace
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Called from instrumented call sites inside the SDK's classes.jar, including e2-motion. */
object HitelSdkProbe {
    private val nativeAvailable = runCatching { System.loadLibrary("hitel_e2_probe") }.isSuccess
    @Volatile private var active = false
    @Volatile private var turn = 0
    private var power: PowerManager? = null
    private val context = ThreadLocal<Int>()
    private val snapshotPending = AtomicBoolean()
    private val worker = Executors.newSingleThreadExecutor { task ->
        Thread(task, "hitel-e2-probe").apply { isDaemon = true }
    }

    @Synchronized fun install(context: Context) {
        if (active) return
        power = context.getSystemService(PowerManager::class.java)
        val profileFolder = File(context.cacheDir, "hitel-sdk-profiler/" + Process.myPid()).apply { mkdirs() }
        val flags = if (nativeAvailable) runCatching {
            nativeInstall(if (profileFolder.isDirectory) File(profileFolder, "director").absolutePath else "")
        }.getOrDefault(0) else 0
        if (flags and 8 != 0) HitelE2Trace.sdkProfileFolder = profileFolder
        HitelE2Trace.drainSdkProbe = ::drain
        active = true
        HitelE2Trace.event("sdk.probe.ready", "nativeLibrary" to nativeAvailable, "captureFlags" to flags,
            "logd" to (flags and 1 != 0), "stderr" to (flags and 2 != 0),
            "gpuTiming" to (flags and 4 != 0), "ortProfileRequested" to (flags and 8 != 0),
            "androidApi" to Build.VERSION.SDK_INT,
            "device" to Build.MODEL, "soc" to (if (Build.VERSION.SDK_INT >= 31) Build.SOC_MODEL else Build.HARDWARE))
    }

    fun setTurn(turnId: Int) {
        turn = turnId
        if (nativeAvailable) nativeSetTurn(turnId)
    }

    fun requestSnapshot(turnId: Int) {
        if (!snapshotPending.compareAndSet(false, true)) return
        worker.execute {
            try {
                sampleThreads(turnId)
                HitelE2Trace.event("sdk.device", "turn" to turnId,
                    "thermalStatus" to runCatching { power?.currentThermalStatus }.getOrNull(),
                    "processors" to Runtime.getRuntime().availableProcessors())
                drain()
            } finally {
                snapshotPending.set(false)
            }
        }
    }

    fun <T> inTurn(turnId: Int, block: () -> T): T {
        val previous = context.get()
        context.set(turnId)
        return try { block() } finally {
            if (previous == null) context.remove() else context.set(previous)
        }
    }

    @JvmStatic fun begin(name: String): Long {
        if (!active) return 0
        Trace.beginSection("HITEL.sdk." + name)
        return SystemClock.elapsedRealtimeNanos()
    }

    @JvmStatic fun cpuStart(nanos: Long): Long = if (nanos == 0L) 0 else Debug.threadCpuTimeNanos()

    @JvmStatic fun finish(name: String, start: Long, cpu: Long, failed: Boolean) {
        if (start == 0L) return
        val elapsed = SystemClock.elapsedRealtimeNanos() - start
        val cpuUs = (Debug.threadCpuTimeNanos() - cpu) / 1000
        Trace.endSection()
        // Empty availability polls are frequent; the trace still contains every poll.
        if (elapsed >= 100_000 || failed || name in detailedCalls) {
            HitelE2Trace.event("sdk.internal.call", "turn" to (context.get() ?: turn),
                "call" to name, "startNs" to start, "wallUs" to elapsed / 1000,
                "cpuUs" to cpuUs, "failed" to failed)
        }
    }

    @Synchronized fun drain() {
        if (!nativeAvailable) return
        val lines = runCatching { nativeDrain() }.getOrElse {
            HitelE2Trace.failure("sdk.native.drain.failure", it)
            return
        }
        for (line in lines) {
            val fields = line.split('\t', limit = 6)
            if (fields.size != 6) continue
            HitelE2Trace.event("sdk.native.log", "turn" to fields[5], "nativeNs" to fields[0],
                "nativeTid" to fields[1], "nativeCpuUs" to fields[2], "transport" to fields[3],
                "message" to fields[4])
        }
    }

    private fun sampleThreads(turnId: Int) {
        if (!nativeAvailable) return
        for (row in runCatching { nativeThreads() }.getOrDefault(emptyArray())) {
            val f = row.split('\t')
            if (f.size != 5) continue
            HitelE2Trace.event("sdk.worker.cpu", "turn" to turnId, "workerTid" to f[0],
                "worker" to f[1], "state" to f[2], "cpuTicks" to f[3], "ticksPerSec" to f[4])
        }
    }

    private external fun nativeInstall(profilePrefix: String): Int
    private external fun nativeSetTurn(turnId: Int)
    private external fun nativeDrain(): Array<String>
    private external fun nativeThreads(): Array<String>

    private val detailedCalls = setOf("nativeCreate", "nativeHwEnable", "nativeA2xCreate",
        "nativeA2xPush", "nativeA2xPull", "nativeRenderKpBorrow", "nativeHwBuffer",
        "nativeBorrowFlush", "nativeA2xFinish", "nativeA2xReset", "nativeDestroy")
}
