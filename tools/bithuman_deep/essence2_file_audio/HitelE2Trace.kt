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
    private const val MAX_BYTES = 12L * 1024L * 1024L
    private const val STARTUP_BYTES = 512L * 1024L
    private val seq = AtomicLong()
    private val lost = AtomicLong()
    private val started = AtomicBoolean()
    private val bearer = Regex("(?i)Bearer\\s+\\S+")
    private val url = Regex("(?i)(?:https?|content)://\\S+")
    private val secret = Regex("(?i)(bearer|secret|token|password|api[_-]?key)[=:][^,; ]+")
    internal val startupStages = setOf("trace.start", "gpu.route", "sync.route",
        "file.decode.begin", "file.source.format", "file.first_pcm",
        "sync.begin", "sync.preroll", "audio.start", "audio.clock.first",
        "sync.opening.generated", "sync.opening.present", "sync.finish")
    private class Clear(val complete: (Throwable?) -> Unit)
    private class Snapshot(val complete: (Throwable?) -> Unit)
    private class Line(val text: String, val keepStartup: Boolean)
    private val lines = ArrayBlockingQueue<Any>(8192)

    fun init(context: Context) {
        if (!started.compareAndSet(false, true)) return
        val folder = File(context.filesDir.parentFile ?: context.filesDir, "app_flutter")
        folder.mkdirs()
        val output = File(folder, "hitel_e2_trace.log")
        val startup = File(folder, "hitel_e2_startup.log")
        Thread({
            try {
                var writer = FileOutputStream(output, false)
                FileOutputStream(startup, false).use { anchor ->
                    var length = 0L
                    var anchorLength = 0L
                    while (true) {
                        val item = lines.take()
                        if (item is Snapshot) {
                            item.complete(runCatching { writer.flush(); anchor.flush() }.exceptionOrNull())
                            continue
                        }
                        if (item is Clear) {
                            val error = runCatching {
                                writer.flush()
                                writer.channel.truncate(0)
                                writer.channel.position(0)
                                val old = File(folder, "hitel_e2_trace.previous.log")
                                if (old.exists()) check(old.delete()) { "Cannot clear rotated trace" }
                                anchor.channel.truncate(0)
                                anchor.channel.position(0)
                                length = 0L; anchorLength = 0L; lost.set(0)
                            }.exceptionOrNull()
                            item.complete(error)
                            continue
                        }
                        val line = item as Line
                        val bytes = (line.text + "\n").toByteArray(Charsets.UTF_8)
                        if (length + bytes.size > MAX_BYTES) {
                            writer.flush(); writer.close()
                            val old = File(folder, "hitel_e2_trace.previous.log")
                            if (old.exists()) old.delete()
                            output.renameTo(old)
                            writer = FileOutputStream(output, false)
                            length = 0L
                        }
                        writer.write(bytes); length += bytes.size
                        if (line.keepStartup) {
                            if (anchorLength + bytes.size > STARTUP_BYTES) {
                                anchor.channel.truncate(0)
                                anchor.channel.position(0)
                                anchorLength = 0L
                            }
                            anchor.write(bytes); anchorLength += bytes.size
                        }
                        if (lines.isEmpty()) writer.flush()
                    }
                }
            } catch (error: Throwable) {
                Log.e(TAG, "trace_writer_failure kind=" + error.javaClass.simpleName)
            }
        }, "hitel-e2trace-writer").apply { isDaemon = true; start() }
        event("trace.start", "version" to 3, "maxFileBytes" to MAX_BYTES)
    }

    fun clear(complete: (Throwable?) -> Unit) {
        if (!started.get()) { complete(null); return }
        if (!lines.offer(Clear(complete))) complete(IllegalStateException("Trace queue full"))
    }

    fun afterWrites(complete: (Throwable?) -> Unit) {
        if (!started.get()) { complete(IllegalStateException("Trace is unavailable")); return }
        if (!lines.offer(Snapshot(complete))) complete(IllegalStateException("Trace queue full"))
    }

    private fun safe(value: Any?, limit: Int = 160): String {
        if (value == null) return "null"
        if (value is Number || value is Boolean || value is Char) return value.toString()
        var s = value.toString()
        s = s.replace(bearer, "[REDACTED]").replace(url, "[URL_REDACTED]")
        s = s.take(limit).replace('\n', '_').replace('\r', '_').replace('\t', '_').replace(' ', '_')
        return s.replace(secret, "[REDACTED]")
    }

    fun event(stage: String, vararg fields: Pair<String, Any?>) {
        val line = "seq=" + seq.incrementAndGet() +
            " monotonicNs=" + SystemClock.elapsedRealtimeNanos() + " wallMs=" + System.currentTimeMillis() +
            " pid=" + Process.myPid() + " tid=" + Process.myTid() +
            " thread=" + safe(Thread.currentThread().name) + " stage=" + safe(stage) + " lost=" + lost.get() +
            fields.joinToString("") {
                " " + safe(it.first) + "=" + safe(it.second)
            }
        val startup = stage in startupStages
        if (startup || stage.endsWith(".failure") || stage.endsWith(".error")) Log.i(TAG, line)
        if (!lines.offer(Line(line, startup))) lost.incrementAndGet()
    }

    inline fun <T> section(name: String, block: () -> T): T {
        if (!Trace.isEnabled()) return block()
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
