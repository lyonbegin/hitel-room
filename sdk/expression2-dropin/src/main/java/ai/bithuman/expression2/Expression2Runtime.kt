package ai.bithuman.expression2

import android.graphics.Color
import android.os.Debug
import android.os.SystemClock
import android.util.Log
import org.tensorflow.lite.Interpreter
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.min

/**
 * Exact original-vector-verified front-end and canonical initialization,
 * followed by candidate independent execution of the public IMX graph.
 * Motion-window selection and lip-sync are NOT yet proven vendor-equivalent.
 */
internal object Expression2Native {
    init { System.loadLibrary("hitel_expression2_core") }
    external fun preprocess(input44000: FloatArray): FloatArray
    external fun canonHistory(canon: ByteArray): ByteArray
}

internal class Expression2Runtime(private val model: Expression2Model) : AutoCloseable {
    private val interpreter = Interpreter(model.mapGraph(),
        Interpreter.Options().setNumThreads(2))
    private val history: Array<Array<Array<Array<FloatArray>>>> = loadHistory()
    private var lastMotion: Array<Array<FloatArray>>? = null
    private var closed = false
    private var windowNumber = 0

    private fun trace(stage: String, window: Int) {
        Log.i("HITEL_EXPRESSION2", "window=" + window + " phase=" + stage +
            " uptimeMs=" + SystemClock.elapsedRealtime() +
            " nativeHeapMiB=" + (Debug.getNativeHeapAllocatedSize() / (1024 * 1024)))
    }

    private fun loadHistory(): Array<Array<Array<Array<FloatArray>>>> {
        trace("canon_history_begin", 0)
        val source = Expression2Native.canonHistory(model.canon)
        trace("canon_history_done", 0)
        check(source.size == 4792320) { "Canonical history native parity output invalid" }
        val data = ByteBuffer.wrap(source).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
        return Array(1) {
            Array(16) {
                Array(16) {
                    Array(90) { FloatArray(52).also { data.get(it) } }
                }
            }
        }
    }

    private data class FrameSpec(
        val current: Array<Array<FloatArray>>,
        val previous: Array<Array<FloatArray>>,
        val phase: Int
    )

    /**
     * Returns generated real pixels (416x720), not copied sample or idle images.
     * The caller chooses how many novel frames to retain from the overlapping
     * output. This output is independent candidate behavior, not bitwise parity.
     */
    fun runWindow(input44000: FloatArray, first: Boolean,
                  emit: (IntArray) -> Unit) {
        check(!closed) { "Expression2 renderer closed" }
        require(input44000.size == 44000)
        val window = ++windowNumber
        trace("preprocess_begin", window)
        val ready = Expression2Native.preprocess(input44000)
        trace("preprocess_done", window)
        check(ready.size == 35200) { "Native audio preprocessing failed" }

        val encoded = Array(1) { Array(55) { Array(12) { FloatArray(768) } } }
        val tokens = Array(1) { Array(14) { Array(16) { FloatArray(384) } } }
        trace("enc_begin", window)
        interpreter.runSignature(mapOf("args_0" to arrayOf(ready)),
            mutableMapOf<String, Any>("output_0" to encoded), "enc")
        trace("enc_done", window)
        trace("tok14_begin", window)
        interpreter.runSignature(mapOf("args_0" to encoded),
            mutableMapOf<String, Any>("output_0" to tokens), "tok14")

        trace("tok14_done", window)
        val sequence = ArrayList<FrameSpec>(56)
        for (i in 0 until 14) {
            val token = Array(1) { Array(16) { c -> tokens[0][i][c].clone() } }
            val next = Array(1) { Array(16) { Array(90) { FloatArray(52) } } }
            trace("step_" + i + "_begin", window)
            interpreter.runSignature(mapOf("args_0" to history, "args_1" to token),
                mutableMapOf<String, Any>("output_0" to next), "step")
            trace("step_" + i + "_done", window)
            val current = next[0]
            val previous = lastMotion ?: current
            if (first && i == 0) {
                sequence.add(FrameSpec(current, previous, 3))
            } else {
                for (phase in 0 until 4)
                    sequence.add(FrameSpec(current, previous, phase))
            }
            for (c in 0 until 16) {
                for (h in 0 until 15) history[0][c][h] = history[0][c][h + 1]
                history[0][c][15] = current[c]
            }
            lastMotion = current
        }
        val keepStart = if (first) 0 else max(0, sequence.size - 32)
        var offset = keepStart
        while (offset < sequence.size) {
            val count = min(16, sequence.size - offset)
            val batch = if (count > 8) 16 else 8
            val input = ByteBuffer.allocateDirect(batch * 36 * 90 * 52 * 4)
                .order(ByteOrder.nativeOrder())
            for (k in 0 until batch) {
                val item = sequence[offset + min(k, count - 1)]
                for (channel in 0 until 36) {
                    when {
                        channel < 16 -> for (y in 0 until 90)
                            for (x in 0 until 52)
                                input.putFloat(item.current[channel][y][x])
                        channel < 32 -> for (y in 0 until 90)
                            for (x in 0 until 52)
                                input.putFloat(item.previous[channel - 16][y][x])
                        else -> repeat(90 * 52) {
                            input.putFloat(if (channel - 32 == item.phase) 1f else 0f)
                        }
                    }
                }
            }
            input.rewind()
            val output = ByteBuffer.allocateDirect(batch * 3 * 720 * 416 * 4)
                .order(ByteOrder.nativeOrder())
            trace("decoder_" + (if (batch == 16) "dec16" else "dec8") +
                "_begin_at_" + offset, window)
            interpreter.runSignature(mapOf("args_0" to input),
                mutableMapOf<String, Any>("output_0" to output),
                if (batch == 16) "dec16" else "dec8")
            trace("decoder_done_at_" + offset, window)
            for (k in 0 until count) emit(toPixels(output, k))
            trace("frames_emitted_" + (offset + count), window)
            offset += count
        }
    }

    private fun toPixels(buffer: ByteBuffer, frame: Int): IntArray {
        val plane = 720 * 416
        val start = frame * 3 * plane
        val pixels = IntArray(plane)
        for (i in 0 until plane) {
            val r = channel(buffer.getFloat((start + i) * 4))
            val g = channel(buffer.getFloat((start + plane + i) * 4))
            val b = channel(buffer.getFloat((start + 2 * plane + i) * 4))
            pixels[i] = Color.rgb(r, g, b)
        }
        return pixels
    }

    private fun channel(n: Float): Int = max(0, min(255, (n * 255f + .5f).toInt()))
    override fun close() {
        closed = true
        interpreter.close()
    }
}
