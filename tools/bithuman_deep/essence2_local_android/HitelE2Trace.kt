package ai.bithuman.flutter

import android.content.Context
import android.os.Process
import android.os.SystemClock
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/** Internal debug-only causal diagnostics. No secret, PCM, or HTTP body is logged. */
internal object HitelE2Trace {
    private const val TAG = "HITEL_E2TRACE"
    private const val MAX_BYTES = 4L * 1024L * 1024L
    private const val MAX_RECORDS = 120000L
    private val seq = AtomicLong()
    private val lost = AtomicLong()
    private val started = AtomicBoolean()
    private val lines = ArrayBlockingQueue<String>(8192)

    fun init(context: Context) {
        if (!started.compareAndSet(false, true)) return
        // Flutter application-support directory is a sibling of filesDir on Android.
        val folder = File(context.filesDir.parentFile ?: context.filesDir, "app_flutter")
        folder.mkdirs()
        val output = File(folder, "hitel_e2_trace.log")
        Thread({
            try {
                var writer = FileOutputStream(output, false)
                var length = 0L
                while (true) {
                    val bytes = (lines.take() + "\n").toByteArray(Charsets.UTF_8)
                    if (length + bytes.size > MAX_BYTES) {
                        writer.flush()
                        writer.close()
                        val old = File(folder, "hitel_e2_trace.previous.log")
                        if (old.exists()) old.delete()
                        output.renameTo(old)
                        writer = FileOutputStream(output, false)
                        length = 0L
                    }
                    writer.write(bytes)
                    length += bytes.size
                    if (lines.isEmpty()) writer.flush()
                }
            } catch (t: Throwable) {
                Log.e(TAG, "trace_writer_failure kind=" + t.javaClass.simpleName)
            }
        }, "hitel-e2trace-writer").apply { isDaemon = true; start() }
        event("trace.start", "version" to 1, "maxFileBytes" to MAX_BYTES)
    }

    private fun safe(value: Any?): String {
        if (value == null) return "null"
        if (value is Number || value is Boolean || value is Char) return value.toString()
        var s = value.toString().take(160).replace('\n', '_').replace('\r', '_').replace(' ', '_')
        s = s.replace(Regex("(?i)(bearer|secret|token|password|api[_-]?key)[=:][^,; ]+"), "[REDACTED]")
        s = s.replace(Regex("https?://[^,; ]+"), "[URL_REDACTED]")
        return s
    }

    fun event(stage: String, vararg fields: Pair<String, Any?>) {
        val n = seq.incrementAndGet()
        if (n > MAX_RECORDS) return
        val line = "seq=" + n +
            " monotonicNs=" + SystemClock.elapsedRealtimeNanos() +
            " wallMs=" + System.currentTimeMillis() +
            " pid=" + Process.myPid() + " tid=" + Process.myTid() +
            " thread=" + safe(Thread.currentThread().name) +
            " stage=" + safe(stage) + " lost=" + lost.get() +
            fields.joinToString("") { " " + safe(it.first) + "=" + safe(it.second) }
        Log.i(TAG, line)
        if (!lines.offer(line)) lost.incrementAndGet()
    }

    fun failure(stage: String, err: Throwable, vararg fields: Pair<String, Any?>) {
        val at = err.stackTrace.firstOrNull()
        val detail = arrayOf<Pair<String, Any?>>(
            "errorClass" to err.javaClass.name,
            "causeClass" to (err.cause?.javaClass?.name ?: "none"),
            "message" to (err.message ?: ""),
            "source" to ((at?.className ?: "?") + "." + (at?.methodName ?: "?") + ":" + (at?.lineNumber ?: -1))
        ) + fields
        event(stage, *detail)
    }
}
