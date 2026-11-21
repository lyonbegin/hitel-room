package ai.bithuman.flutter

import java.io.ByteArrayOutputStream
import kotlin.math.roundToInt

/** sherpa JNI reflects invoke(float[]):Integer. An indy lambda only exposes
 * invoke(Object):Object on newer Kotlin/D8 and aborts ART with NoSuchMethodError.
 * Keep this concrete typed implementation at the JNI boundary. */
class KoreanTtsPcmCallback(private val accept: (FloatArray) -> Int) : (FloatArray) -> Int {
    override fun invoke(samples: FloatArray): Int = accept(samples)
}

/** Keep the echoed transcript intact; split only the synthesis work at word boundaries. */
object KoreanSpeechSegments {
    fun split(text: String): List<String> {
        val result = ArrayList<String>()
        var from = 0
        var i = 0
        while (i < text.length) {
            val size = i - from + 1
            val limit = if (result.isEmpty()) 14 else 32
            val c = text[i]
            val punctuation = c in ".!?。！？\n"
            if (punctuation || (size >= limit && c.isWhitespace()) || size >= 64) {
                text.substring(from, i + 1).takeIf { it.isNotBlank() }?.let(result::add)
                from = i + 1
            }
            i++
        }
        text.substring(from).takeIf { it.isNotBlank() }?.let(result::add)
        return result
    }
}

/** Continuous linear resampling. Integer positions prevent drift between callback blocks. */
class KoreanPcmResampler(
    private val inputRate: Int,
    private val outputRate: Int,
    private val sink: (ByteArray) -> Unit,
) {
    private var previous = 0f
    private var inputCount = 0L
    private var outputIndex = 0L
    private val packet = ByteArrayOutputStream(4800)
    fun push(samples: FloatArray) {
        for (sample in samples) {
            val at = inputCount++
            while (outputIndex * inputRate <= at * outputRate) {
                val position = outputIndex * inputRate
                val fraction = (position - (at - 1) * outputRate).toDouble() / outputRate
                val value = if (at == 0L) sample else (previous + (sample - previous) * fraction).toFloat()
                write(value); outputIndex++
            }
            previous = sample
        }
    }
    private fun write(value: Float) {
        val pcm = (value.coerceIn(-1f, 1f) * 32767).roundToInt().coerceIn(-32768, 32767)
        packet.write(pcm and 255); packet.write((pcm shr 8) and 255)
        if (packet.size() >= 4800) flushPacket()
    }
    fun flushPacket() {
        if (packet.size() == 0) return
        sink(packet.toByteArray()); packet.reset()
    }
    fun finish() {
        // Complete the duration of the last input sample without duplicating chunk boundaries.
        while (outputIndex * inputRate < inputCount * outputRate) { write(previous); outputIndex++ }
        flushPacket()
    }
}
