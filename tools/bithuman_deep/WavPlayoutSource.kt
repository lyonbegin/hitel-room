package ai.bithuman.flutter

import java.io.Closeable
import java.io.DataInputStream
import java.io.InputStream

/** Reads the packaged, build-validated 16 kHz mono WAV in response to player credit. */
internal class WavPlayoutSource(input: InputStream, headerSize: Int, val samples: Int) : Closeable {
    private val stream = DataInputStream(input)
    private val converter = Pcm16kTo24k()
    var readSamples = 0
        private set

    init {
        // readFully also works for compressed assets where skip() can be short.
        stream.readFully(ByteArray(headerSize))
    }

    /** played24 is this turn's position on the SDK speaker's 24 kHz clock. */
    fun refill(played24: Long, offer: (ByteArray) -> Unit) {
        val target = minOf(samples.toLong(), played24.coerceAtLeast(0) * 2 / 3 + LOOKAHEAD)
        while (readSamples < target) {
            val count = minOf(BLOCK.toLong(), target - readSamples).toInt()
            val pcm = ByteArray(count * 2)
            stream.readFully(pcm)
            readSamples += count
            val converted = converter.process(pcm)
            if (converted.isNotEmpty()) offer(converted)
        }
        if (readSamples == samples) {
            val tail = converter.flush()
            if (tail.isNotEmpty()) offer(tail)
        }
    }

    override fun close() = stream.close()

    companion object {
        // Enough input to prime the speech model before it can return the first frame.
        const val LOOKAHEAD = 32000
        const val BLOCK = 2560
    }
}
