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
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import android.system.Os

/** Called from instrumented call sites inside the SDK's classes.jar, including e2-motion. */
object HitelSdkProbe {
    private val nativeAvailable = runCatching { System.loadLibrary("hitel_e2_probe") }.isSuccess
    @Volatile private var active = false
    @Volatile private var turn = 0
    private var power: PowerManager? = null
    private val context = ThreadLocal<Int>()
    private val snapshotPending = AtomicBoolean()
    private val worker = Executors.newSingleThreadScheduledExecutor { task ->
        Thread(task, "hitel-e2-probe").apply { isDaemon = true }
    }

    private class Window(val id: Int) {
        var input = 0L
        var fed = 0L
        var pulled = 0L
        var shown = 0L
        var ordinal = -1L
        var skipped = 0L
        var a2xReturned = 0L
        var a2xPulls = 0L
        var a2xPushes = 0L
        var renders = 0L
        var hwPulls = 0L
        var availCalls = 0L
        var availMax = Long.MIN_VALUE
        var pullWallUs = 0L
        var pullCpuUs = 0L
        var since = SystemClock.elapsedRealtimeNanos()
    }
    private val windowLock = Any()
    private var window: Window? = null
    fun originalFed(samples: Long) = fed(turn, samples)
    fun originalPulled(ordinal: Long) = pulled(turn, ordinal)
    fun originalPresented() = shown(turn)
    fun input(turnId: Int, samples: Long) {
        synchronized(windowLock) { window?.takeIf { it.id == turnId }?.let { it.input += samples } }
    }
    fun fed(turnId: Int, samples: Long) {
        synchronized(windowLock) { window?.takeIf { it.id == turnId }?.let { it.fed += samples } }
    }
    fun pulled(turnId: Int, ordinal: Long) {
        synchronized(windowLock) { window?.takeIf { it.id == turnId }?.let {
            it.pulled++
            if (ordinal >= 0) {
                it.skipped += (ordinal - it.ordinal - 1).coerceAtLeast(0)
                it.ordinal = ordinal
            }
        } }
    }
    fun shown(turnId: Int) {
        synchronized(windowLock) { window?.takeIf { it.id == turnId }?.let { it.shown++ } }
    }
    fun finishTurn(turnId: Int) {
        flushWindow(turnId, true)
        worker.execute { runCatching { drain() } }
    }
    private fun flushWindow(expectedTurn: Int? = null, finishing: Boolean = false) {
        val fields = synchronized(windowLock) {
            val w = window ?: return
            if (expectedTurn != null && w.id != expectedTurn) return
            val now = SystemClock.elapsedRealtimeNanos()
            val row = arrayOf<Pair<String, Any?>>(
                "turn" to w.id, "elapsedUs" to ((now - w.since) / 1000),
                "targetSamples" to 5120, "targetFrames" to 8,
                "pcmInputSamples" to w.input, "sdkFedSamples" to w.fed,
                "sdkReturnedFrames" to w.pulled, "displayedFrames" to w.shown,
                "ordinalSkipped" to w.skipped, "lastOrdinal" to w.ordinal,
                "a2xPushCalls" to w.a2xPushes, "a2xPullCalls" to w.a2xPulls,
                "a2xAvailCalls" to w.availCalls, "a2xReturnedMotionFrames" to w.a2xReturned,
                "a2xAvailMaxRaw" to w.availMax.takeIf { it != Long.MIN_VALUE },
                "renderCalls" to w.renders, "hwBufferCalls" to w.hwPulls,
                "hwPullWallUs" to w.pullWallUs, "hwPullCpuUs" to w.pullCpuUs,
                "final" to finishing)
            if (finishing) window = null else window = Window(w.id).also {
                it.ordinal = w.ordinal
                it.since = now
            }
            row
        }
        HitelE2Trace.event("sdk.window320", *fields)
    }
    @JvmStatic fun arrayLength(value: Any?): Long =
        if (value == null) -1 else java.lang.reflect.Array.getLength(value).toLong()
    @JvmStatic fun observeObject(name: String, value: Any?) {
        if (!active) return
        val backend = name in setOf("nativeTesseraAttachBundle", "nativeHwEnable",
            "nativeRenderReason", "nativeTesseraReason", "nativeA2xLastError")
        HitelE2Trace.event(if (backend) "sdk.backend.result" else "sdk.internal.result",
            "turn" to (context.get() ?: turn), "call" to name, "resultKind" to "object",
            "null" to (value == null), "type" to value?.javaClass?.name,
            "stringValue" to (value as? String))
    }
    @JvmStatic fun observeResult(name: String, value: Long, kind: String) {
        if (!active) return
        if (name == "nativeA2xAvail") synchronized(windowLock) {
            window?.let { it.availMax = maxOf(it.availMax, value) }
        }
        if (name == "nativeA2xPull" && kind == "I" && value > 0) synchronized(windowLock) {
            window?.let { it.a2xReturned += value }
        }
        // Record raw values, never assume that array length or call count equals generated frames.
        if (name != "nativeA2xAvail" || value > 0) {
            HitelE2Trace.event("sdk.internal.result", "turn" to (context.get() ?: turn),
                "call" to name, "resultKind" to kind, "raw" to value)
        }
    }

    // Locations proved by ARM64 disassembly, not inferred from HardwareBuffer:
    // 0x165788 LE_A2X_CUDA; 0x170a68 LE_DIRECTOR_OPENCL;
    // 0x1f95bc LE_TESSERA_CPU (mere presence selects CPU).
    private fun env(name: String): String = runCatching { Os.getenv(name) }.getOrNull() ?: "(unset)"
    @JvmStatic fun observeCreateArgs(call: String, provider: String?, threads: Int, height: Int) {
        if (!active) return
        runCatching {
            HitelE2Trace.event("sdk.backend.create_args", "call" to call,
                "requestedEP" to (provider?.ifEmpty { "(default-empty)" } ?: "(null)"),
                "threadsArg" to threads, "outputHeightArg" to height,
                "LE_A2X_CUDA" to env("LE_A2X_CUDA"),
                "LE_DIRECTOR_OPENCL" to env("LE_DIRECTOR_OPENCL"),
                "LE_TESSERA_CPU" to env("LE_TESSERA_CPU"),
                "LE_PASTE_OPENCL" to env("LE_PASTE_OPENCL"),
                "BITHUMAN_ENGINE_QUIET" to env("BITHUMAN_ENGINE_QUIET"),
                "BITHUMAN_DEBUG" to env("BITHUMAN_DEBUG"))
        }
    }
    @JvmStatic fun observeCreated(call: String, handle: Long) {
        if (!active) return
        runCatching { HitelE2Trace.event("sdk.backend.created",
            "call" to call, "success" to (handle != 0L)) }
    }
    private val lastBackendNs = AtomicLong(0)
    private val nativeBridge by lazy { Class.forName("ai.bithuman.elevate.NativeBridge") }
    private fun status(name: String, handle: Long, values: LongArray): Int =
        (nativeBridge.getMethod(name, java.lang.Long.TYPE, LongArray::class.java)
            .invoke(null, handle, values) as Number).toInt()
    private fun reason(name: String, handle: Long): String? =
        nativeBridge.getMethod(name, java.lang.Long.TYPE).invoke(null, handle) as? String
    @JvmStatic fun observeBackend(call: String, handle: Long) {
        if (!active || handle == 0L) return
        val now = SystemClock.elapsedRealtimeNanos()
        val prev = lastBackendNs.get()
        if (call.startsWith("nativeRender") &&
            (now - prev < 1_000_000_000L || !lastBackendNs.compareAndSet(prev, now))) return
        lastBackendNs.set(now)
        // JNI getters confirmed from ElevateFrames.checkRender()/stats().
        // RenderStatus is an error code and count, NOT a GPU/CPU enum.
        // TesseraStats supplies state and composed/passthrough counters.
        runCatching {
            val render = LongArray(1)
            val tessera = LongArray(2)
            val rc = status("nativeRenderStatus", handle, render)
            val tc = status("nativeTesseraStats", handle, tessera)
            HitelE2Trace.event("sdk.backend.snapshot", "turn" to turn, "after" to call,
                "renderStatus" to rc, "renderCountRaw" to render[0],
                "renderReason" to reason("nativeRenderReason", handle),
                "tesseraStateRaw" to tc, "tesseraComposed" to tessera[0],
                "tesseraPassthrough" to tessera[1],
                "tesseraReason" to reason("nativeTesseraReason", handle))
        }.onFailure { HitelE2Trace.failure("sdk.backend.snapshot.failure", it, "after" to call) }
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
        worker.scheduleWithFixedDelay({
            runCatching { flushWindow(); drain() }
                .onFailure { HitelE2Trace.failure("sdk.probe.poll.failure", it) }
        }, 320, 320, TimeUnit.MILLISECONDS)
        HitelE2Trace.event("sdk.probe.ready", "nativeLibrary" to nativeAvailable, "captureFlags" to flags,
            "logd" to (flags and 1 != 0), "stderr" to (flags and 2 != 0),
            "gpuTiming" to (flags and 4 != 0), "ortProfileRequested" to (flags and 8 != 0),
            "vendorDebugEnabled" to (flags and 16 != 0),
            "androidApi" to Build.VERSION.SDK_INT,
            "device" to Build.MODEL, "soc" to (if (Build.VERSION.SDK_INT >= 31) Build.SOC_MODEL else Build.HARDWARE))
    }

    fun setTurn(turnId: Int) {
        turn = turnId
        if (nativeAvailable) nativeSetTurn(turnId)
        synchronized(windowLock) { window = Window(turnId) }
        requestSnapshot(turnId)
    }

    fun requestSnapshot(turnId: Int) {
        if (!snapshotPending.compareAndSet(false, true)) return
        worker.execute {
            try {
                sampleThreads(turnId)
                logMappedLibraries(turnId)
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
        synchronized(windowLock) {
            window?.takeIf { it.id == (context.get() ?: turn) }?.let { w ->
                when (name) {
                    "nativeA2xPush" -> w.a2xPushes++
                    "nativeA2xPull" -> w.a2xPulls++
                    "nativeA2xAvail" -> w.availCalls++
                    "nativeRenderKpBorrow", "nativeRenderDriveBorrow" -> w.renders++
                    "nativeHwBuffer" -> {
                        w.hwPulls++
                        w.pullWallUs += elapsed / 1000
                        w.pullCpuUs += cpuUs
                    }
                    else -> Unit
                }
            }
        }
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
            val message = fields[4]
            val backend = listOf("[borrow]", "[borrow-gpu]", "[le-director-opencl]",
                "[le_a2x]", "[le-open]", "[le-paste-opencl]", "[le-stepdown]",
                "[le]", "[le-place]", "ExecutionProvider", "[le_ort_profile]").any { message.contains(it) }
            HitelE2Trace.event(if (backend) "sdk.backend.native" else "sdk.native.log",
                "turn" to fields[5], "nativeNs" to fields[0],
                "nativeTid" to fields[1], "nativeCpuUs" to fields[2], "transport" to fields[3],
                "message" to message)
        }
    }

    private fun logMappedLibraries(turnId: Int) {
        runCatching {
            val matches = Regex("(?i)opencl|onnx|qnn|vulkan|adreno|mali|lible_jni|tensorflow|npu|gpu")
            val libraries = File("/proc/self/maps").useLines { rows ->
                rows.mapNotNull { it.substringAfterLast(' ').takeIf { p ->
                    p.endsWith(".so") && matches.containsMatchIn(p)
                } }.distinct().toList()
            }
            for (lib in libraries) HitelE2Trace.event("sdk.library.mapped",
                "turn" to turnId, "library" to lib.substringAfterLast('/'))
        }.onFailure { HitelE2Trace.failure("sdk.library.maps.failure", it) }
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
