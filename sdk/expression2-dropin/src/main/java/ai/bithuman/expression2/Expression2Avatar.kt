package ai.bithuman.expression2

import android.content.Context
import android.graphics.Bitmap
import java.io.Closeable
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicReference
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

    private val commands = ArrayBlockingQueue<Command>(1024)
    private val fault = AtomicReference<Throwable?>()
    @Volatile private var running = true
    @Volatile private var tailPending = false
    @Volatile private var totalSamples = 0L
    @Volatile private var emitted = 0L

    private val renderer = Expression2Runtime(model)
    private val nativePcm = Expression2Native.streamCreate(model.canon).also {
        check(it != 0L) { "Cannot initialize original-derived native PCM state" }
    }
    private val nativeFrames = Expression2Native.frameQueueCreate().also {
        check(it != 0L) { "Cannot initialize independent native output queue" }
    }
    private val bitmapPixels = IntArray(416 * 720)
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

    val queuedFrames: Int get() = Expression2Native.frameCount(nativeFrames)
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

    @Synchronized fun pull(bitmap: Bitmap): Expression2Frame? {
        checkFault()
        require(bitmap.width == 416 && bitmap.height == 720 &&
            bitmap.config == Bitmap.Config.ARGB_8888) { "Bitmap must be 416x720 ARGB_8888" }
        val index = Expression2Native.framePop(nativeFrames, bitmapPixels)
        if (index == -1L) return null
        check(index >= 0) { "Native frame queue pop failed" }
        bitmap.setPixels(bitmapPixels, 0, 416, 0, 0, 416, 720)
        return Expression2Frame(index,
            index * 1_000_000L / FRAMES_PER_SECOND,
            index * (SAMPLE_RATE / FRAMES_PER_SECOND), true)
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
        var first = true
        try {
            fun renderWindow(window: FloatArray) {
                val wasFirst = first
                android.util.Log.i("HITEL_EXPRESSION2",
                    "worker_window_begin first=" + wasFirst)
                renderer.runWindow(window, wasFirst) { pixels ->
                    check(Expression2Native.frameStage(nativeFrames, emitted, pixels) == 0) {
                        "Frame staging native copy failed"
                    }
                    check(Expression2Native.framePump(nativeFrames) == 0) {
                        "Frame staging native ownership transfer failed"
                    }
                    emitted++
                }
                android.util.Log.i("HITEL_EXPRESSION2",
                    "worker_window_done frames=" + emitted)
                check(Expression2Native.streamFinishWindow(nativePcm) == 0) {
                    "Native PCM step counter could not advance"
                }
                first = false
            }
            fun processSourceDerivedWindows() {
                while (true) {
                    val window = Expression2Native.streamNextWindow(nativePcm) ?: break
                    renderWindow(window)
                }
            }
            while (true) {
                when (val command = commands.take()) {
                    is Command.Audio -> {
                        check(Expression2Native.streamFeed(nativePcm, command.pcm) == 0) {
                            "Native PCM append failed"
                        }
                        totalSamples += command.pcm.size
                        val status = Expression2Native.streamSnapshot(nativePcm)
                        android.util.Log.i("HITEL_EXPRESSION2",
                            "native_pcm_samples=" + (status?.get(0) ?: -1) +
                            " native_pcm_capacity=" + (status?.get(1) ?: -1) +
                            " native_step=" + (status?.get(4) ?: -1))
                        processSourceDerivedWindows()
                    }
                    is Command.Flush -> {
                        try {
                            check(Expression2Native.streamEnd(nativePcm) == 0) {
                                "Native PCM end segment failed"
                            }
                            processSourceDerivedWindows()
                            val expected = (totalSamples.toDouble() *
                                FRAMES_PER_SECOND / SAMPLE_RATE).roundToInt().toLong()
                            android.util.Log.i("HITEL_EXPRESSION2",
                                "candidate frames=" + emitted +
                                " expected20fps=" + expected +
                                " inputSamples=" + totalSamples)
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
            Expression2Native.streamDestroy(nativePcm)
            renderer.close()
        }
    }

    override fun close() {
        if (!running) return
        running = false
        commands.put(Command.Stop)
        worker.join(10000)
        check(!worker.isAlive) { "Renderer has not terminated; native buffers retained" }
        Expression2Native.frameQueueDestroy(nativeFrames)
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
