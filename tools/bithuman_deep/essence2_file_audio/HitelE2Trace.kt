package ai.bithuman.flutter

import android.content.Context
import android.os.Process
import android.os.SystemClock
import android.os.Trace
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/** Bounded metadata only; clear commands execute on the file writer itself. */
internal object HitelE2Trace {
    private const val TAG = "HITEL_E2TRACE"
    private const val MAX_BYTES = 4L * 1024L * 1024L
    private const val MAX_RECORDS = 120000L
    private val seq = AtomicLong()
    private val records = AtomicLong()
    private val lost = AtomicLong()
    private val started = AtomicBoolean()
    private class Clear(val complete: (Throwable?) -> Unit)
    private class Snapshot(val complete: (Throwable?) -> Unit)
    private val lines = ArrayBlockingQueue<Any>(8192)

    fun init(context: Context) {
        if (!started.compareAndSet(false, true)) return
        val folder = File(context.filesDir.parentFile ?: context.filesDir, "app_flutter")
        folder.mkdirs()
        val output = File(folder, "hitel_e2_trace.log")
        Thread({
            try {
                var writer = FileOutputStream(output, false)
                var length = 0L
                while (true) {
                    val item = lines.take()
                    if (item is Snapshot) {
                        item.complete(runCatching { writer.flush() }.exceptionOrNull())
                        continue
                    }
                    if (item is Clear) {
                        val error = runCatching {
                            writer.flush()
                            writer.channel.truncate(0)
                            writer.channel.position(0)
                            val old = File(folder, "hitel_e2_trace.previous.log")
                            if (old.exists()) check(old.delete()) { "Cannot clear rotated trace" }
                            length = 0L; records.set(0); lost.set(0)
                        }.exceptionOrNull()
                        item.complete(error)
                        continue
                    }
                    val bytes = (item.toString() + "\n").toByteArray(Charsets.UTF_8)
                    if (length + bytes.size > MAX_BYTES) {
                        writer.flush(); writer.close()
                        val old = File(folder, "hitel_e2_trace.previous.log")
                        if (old.exists()) old.delete()
                        output.renameTo(old)
                        writer = FileOutputStream(output, false)
                        length = 0L
                    }
                    writer.write(bytes); length += bytes.size
                    if (lines.isEmpty()) writer.flush()
                }
            } catch (error: Throwable) {
                Log.e(TAG, "trace_writer_failure kind=" + error.javaClass.simpleName)
            }
        }, "hitel-e2trace-writer").apply { isDaemon = true; start() }
        event("trace.start", "version" to 2, "maxFileBytes" to MAX_BYTES)
    }

    fun clear(complete: (Throwable?) -> Unit) {
        if (!started.get()) { complete(null); return }
        lines.clear()
        if (!lines.offer(Clear(complete))) complete(IllegalStateException("Trace queue full"))
    }

    fun afterWrites(complete: (Throwable?) -> Unit) {
        if (!started.get()) { complete(IllegalStateException("Trace is unavailable")); return }
        if (!lines.offer(Snapshot(complete))) complete(IllegalStateException("Trace queue full"))
    }

    private fun safe(value: Any?): String {
        if (value == null) return "null"
        if (value is Number || value is Boolean || value is Char) return value.toString()
        var s = value.toString()
        s = s.replace(Regex("(?i)Bearer\\s+\\S+"), "[REDACTED]")
        s = s.replace(Regex("https?://\\S+"), "[URL_REDACTED]")
        s = s.take(160).replace('\n', '_').replace('\r', '_').replace(' ', '_')
        s = s.replace(Regex("(?i)(bearer|secret|token|password|api[_-]?key)[=:][^,; ]+"), "[REDACTED]")
        return s.replace(Regex("https?://[^,; ]+"), "[URL_REDACTED]")
    }

    fun event(stage: String, vararg fields: Pair<String, Any?>) {
        if (records.incrementAndGet() > MAX_RECORDS) return
        val line = "seq=" + seq.incrementAndGet() +
            " monotonicNs=" + SystemClock.elapsedRealtimeNanos() + " wallMs=" + System.currentTimeMillis() +
            " pid=" + Process.myPid() + " tid=" + Process.myTid() +
            " thread=" + safe(Thread.currentThread().name) + " stage=" + safe(stage) + " lost=" + lost.get() +
            fields.joinToString("") { " " + safe(it.first) + "=" + safe(it.second) }
        Log.i(TAG, line)
        if (!lines.offer(line)) lost.incrementAndGet()
    }

    inline fun <T> section(name: String, block: () -> T): T {
        Trace.beginSection(name)
        return try {
            block()
        } finally {
            Trace.endSection()
        }
    }

    fun failure(stage: String, err: Throwable, vararg fields: Pair<String, Any?>) {
        val at = err.stackTrace.firstOrNull()
        event(stage, *(arrayOf<Pair<String, Any?>>(
            "errorClass" to err.javaClass.name, "causeClass" to (err.cause?.javaClass?.name ?: "none"),
            "message" to (err.message ?: ""),
            "source" to ((at?.className ?: "?") + "." + (at?.methodName ?: "?") + ":" + (at?.lineNumber ?: -1))
        ) + fields))
    }
}
