package ai.bithuman.expression2

import android.content.Context
import android.graphics.Bitmap
import java.io.Closeable
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Source-compatible Expression2 facade for the unmodified upstream
 * android/expression2-hello MainActivity. It is NOT a verified byte-for-byte
 * reproduction of the full vendor streaming engine.
 */
class Expression2Options

object Expression2Credential {
    @Volatile private var credential: String = ""
    @JvmStatic fun set(secret: String) { credential = secret }
    // Local engine never sends this value to any vendor authentication endpoint.
}

data class Expression2Frame(
    val index: Long,
    val presentationTimeUs: Long,
    val audioSample: Long,
    val isSpeech: Boolean
)

class Expression2Avatar private constructor(model: Expression2Model) : Closeable {
    private sealed interface Command {
        data class Audio(val pcm: FloatArray) : Command
        data class Flush(val completed: CountDownLatch) : Command
        data object Stop : Command
    }
    private data class Pixels(val index: Long, val content: IntArray)

    private val commands = ArrayBlockingQueue<Command>(1024)
    private val frames = LinkedBlockingQueue<Pixels>()
    private val fault = AtomicReference<Throwable?>()
    @Volatile private var running = true
    @Volatile private var tailPending = false
    @Volatile private var totalSamples = 0L
    @Volatile private var emitted = 0L

    private val renderer = Expression2Runtime(model)
    private val worker = Thread({ runWorker() }, "expression2-render").apply {
        isDaemon = true
        priority = Thread.NORM_PRIORITY
        start()
    }

    val accelerator: String get() = "CPU"
    val routing: String get() = "independent-model"
    val initMs: Long get() = 0L
    val acceleratorNote: String
        get() = "HITEL native verified preprocessor + independent IMX interpreter; original frame parity unverified"

    val queuedFrames: Int get() = frames.size
    val hasPendingTail: Boolean get() = tailPending

    fun newFrameBitmap(): Bitmap =
        Bitmap.createBitmap(416, 720, Bitmap.Config.ARGB_8888)

    fun feed(input: FloatArray) = feed(input, 0, input.size)

    fun feed(input: FloatArray, offset: Int, count: Int) {
        checkActive()
        require(offset >= 0 && count >= 0 && offset <= input.size &&
            count <= input.size - offset) { "Invalid PCM slice" }
        android.util.Log.i("HITEL_EXPRESSION2", "feed_enqueue_pcm=" + count)
        commands.put(Command.Audio(input.copyOfRange(offset, offset + count)))
    }

    fun flushTail() {
        checkActive()
        val latch = CountDownLatch(1)
        tailPending = true
        commands.put(Command.Flush(latch))
        android.util.Log.i("HITEL_EXPRESSION2", "flush_wait_begin")
        latch.await()
        android.util.Log.i("HITEL_EXPRESSION2", "flush_wait_done frames=" + emitted)
        checkFault()
    }

    fun pull(bitmap: Bitmap): Expression2Frame? {
        checkFault()
        require(bitmap.width == 416 && bitmap.height == 720 &&
            bitmap.config == Bitmap.Config.ARGB_8888) { "Bitmap must be 416x720 ARGB_8888" }
        val frame = frames.poll() ?: return null
        bitmap.setPixels(frame.content, 0, 416, 0, 0, 416, 720)
        return Expression2Frame(frame.index,
            frame.index * 1_000_000L / FRAMES_PER_SECOND,
            frame.index * (SAMPLE_RATE / FRAMES_PER_SECOND), true)
    }

    private fun checkFault() {
        val error = fault.get()
        if (error != null) throw IllegalStateException("Independent Expression2 renderer failed", error)
    }

    private fun checkActive() {
        check(running) { "Expression2Avatar already closed" }
        checkFault()
    }

    private fun runWorker() {
        var pcm = FloatArray(65536)
        var used = 0
        var first = true
        try {
            fun append(samples: FloatArray) {
                if (used + samples.size > pcm.size)
                    pcm = pcm.copyOf(maxOf(pcm.size * 2, used + samples.size))
                samples.copyInto(pcm, used)
                used += samples.size
                totalSamples += samples.size
            }

            fun renderWindow(window: FloatArray) {
                val wasFirst = first
                android.util.Log.i("HITEL_EXPRESSION2", "worker_window_begin used=" + used + " first=" + wasFirst)
                renderer.runWindow(window, wasFirst) { pixels ->
                    frames.put(Pixels(emitted++, pixels))
                }
                android.util.Log.i("HITEL_EXPRESSION2", "worker_window_done frames=" + emitted)
                first = false
            }

            fun processCompleteWindows() {
                while (used >= 44000) {
                    renderWindow(pcm.copyOfRange(0, 44000))
                    val stride = 25600
                    pcm.copyInto(pcm, 0, stride, used)
                    used -= stride
                }
            }

            while (true) {
                when (val command = commands.take()) {
                    is Command.Audio -> {
                        append(command.pcm)
                        processCompleteWindows()
                    }
                    is Command.Flush -> {
                        try {
                            val expected = (totalSamples.toDouble() *
                                FRAMES_PER_SECOND / SAMPLE_RATE).roundToInt().toLong()
                            if (used > 0 && (totalSamples > 0L)) {
                                val padded = FloatArray(44000)
                                pcm.copyInto(padded, 0, 0, min(used, 44000))
                                renderWindow(padded)
                            }
                            // Exact original window stitching and pad-frame behavior
                            // remain unverified; do NOT report the count as parity.
                            android.util.Log.i("HITEL_EXPRESSION2", "candidate frames=" + emitted +
                                " expected20fps=" + expected + " inputSamples=" + totalSamples)
                        } finally {
                            tailPending = false
                            command.completed.countDown()
                        }
                    }
                    Command.Stop -> break
                }
            }
        } catch (e: Throwable) {
            android.util.Log.e("HITEL_EXPRESSION2", "worker_failed", e)
            fault.set(e)
            tailPending = false
            // Always unblock pending flush requests on failure.
            for (remaining in commands) {
                if (remaining is Command.Flush) remaining.completed.countDown()
            }
        } finally {
            renderer.close()
        }
    }

    override fun close() {
        if (!running) return
        running = false
        commands.put(Command.Stop)
        worker.join(10000)
        frames.clear()
    }

    companion object {
        const val SAMPLE_RATE = 16000
        const val FRAMES_PER_SECOND = 20
        @JvmStatic
        fun create(context: Context, model: Expression2Model,
                   options: Expression2Options = Expression2Options()): Expression2Avatar {
            context.applicationContext // retain context validation but no UI
            options.hashCode()
            return Expression2Avatar(model)
        }
    }
}
