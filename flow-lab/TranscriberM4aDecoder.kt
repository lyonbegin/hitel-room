package app.hitel.samsungprobe

// Source-derived implementation, adapted from Majkey25/transcriber-android,
// app/src/main/java/cz/majkey/prepis/AudioTranscriber.kt (MIT).
// Copyright (c) 2026 Majkey25. See flow-lab/THIRD_PARTY_MAJKEY25_MIT.txt.
// Decoding functions, media drain behavior, PCM channel mixing and chunking
// are preserved from upstream. Changed only application integration and budget wiring.
import android.content.ContentResolver
import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

object TranscriberM4aDecoder {
    fun interface AudioChunkConsumer {
        fun accept(samples: FloatArray, sampleRate: Int)
    }

    @JvmStatic fun decode(context: Context, uri: Uri, consumer: AudioChunkConsumer) {
        TranscriberM4aCore(context.contentResolver).decodeAudio(uri) { samples, sampleRate ->
            consumer.accept(samples, sampleRate)
        }
    }
}

internal class TranscriberM4aCore(private val resolver: ContentResolver) {
    private fun checkActive(budget: LocalAudioBudget) { budget.checkTime() }

    internal fun decodeAudio(
        uri: Uri,
        budget: LocalAudioBudget = LocalAudioBudget(),
        consume: (FloatArray, Int) -> Unit,
    ) {
        checkActive(budget)
        val descriptor = resolver.openFileDescriptor(uri, "r")
            ?: throw IOException("The recording cannot be opened")
        descriptor.use {
            checkActive(budget)
            val extractor = MediaExtractor()
            try {
                checkActive(budget)
                extractor.setDataSource(it.fileDescriptor)
                checkActive(budget)
                val trackIndex = (0 until extractor.trackCount).firstOrNull { index ->
                    extractor.getTrackFormat(index)
                        .getString(MediaFormat.KEY_MIME)
                        ?.startsWith("audio/") == true
                } ?: throw IOException("The file contains no audio track")

                extractor.selectTrack(trackIndex)
                decodeTrack(extractor, extractor.getTrackFormat(trackIndex), budget) { samples, sampleRate ->
                    checkActive(budget)
                    consume(samples, sampleRate)
                    checkActive(budget)
                }
            } finally {
                extractor.release()
            }
        }
        checkActive(budget)
    }

    private fun decodeTrack(
        extractor: MediaExtractor,
        inputFormat: MediaFormat,
        budget: LocalAudioBudget,
        consume: (FloatArray, Int) -> Unit,
    ) {
        val mime = inputFormat.getString(MediaFormat.KEY_MIME)
            ?: throw IOException("The audio track has no MIME type")
        var sampleRate = inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        var channelCount = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        var pcmEncoding = AudioFormat.ENCODING_PCM_16BIT
        budget.pcmFrameBytes(sampleRate, channelCount, pcmEncoding)
        var chunker = PcmChunker(channelCount, pcmChunkSamples(sampleRate))
        checkActive(budget)
        val codec = MediaCodec.createDecoderByType(mime)

        try {
            checkActive(budget)
            codec.configure(inputFormat, null, null, 0)
            checkActive(budget)
            codec.start()

            val bufferInfo = MediaCodec.BufferInfo()
            var inputEnded = false
            var outputEnded = false
            var idleCycles = 0

            while (!outputEnded) {
                checkActive(budget)
                var progressed = false
                if (!inputEnded) {
                    val inputIndex = codec.dequeueInputBuffer(CODEC_TIMEOUT_US)
                    if (inputIndex >= 0) {
                        val input = checkNotNull(codec.getInputBuffer(inputIndex)).apply { clear() }
                        val size = extractor.readSampleData(input, 0)
                        if (size < 0) {
                            codec.queueInputBuffer(
                                inputIndex,
                                0,
                                0,
                                0,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM,
                            )
                            inputEnded = true
                        } else {
                            budget.chargeCompressedBytes(size)
                            codec.queueInputBuffer(inputIndex, 0, size, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                        progressed = true
                    }
                }

                when (val outputIndex = codec.dequeueOutputBuffer(bufferInfo, CODEC_TIMEOUT_US)) {
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val outputFormat = codec.outputFormat
                        sampleRate = outputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        channelCount = outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        pcmEncoding = if (outputFormat.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
                            outputFormat.getInteger(MediaFormat.KEY_PCM_ENCODING)
                        } else {
                            AudioFormat.ENCODING_PCM_16BIT
                        }
                        budget.pcmFrameBytes(sampleRate, channelCount, pcmEncoding)
                        chunker = PcmChunker(channelCount, pcmChunkSamples(sampleRate))
                        progressed = true
                    }

                    MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
                    else -> if (outputIndex >= 0) {
                        budget.chargeDecodedBytes(bufferInfo.size, sampleRate, channelCount, pcmEncoding)
                        if (bufferInfo.size > 0) {
                            val output = checkNotNull(codec.getOutputBuffer(outputIndex)).apply {
                                position(bufferInfo.offset)
                                limit(bufferInfo.offset + bufferInfo.size)
                                order(ByteOrder.LITTLE_ENDIAN)
                            }
                            val chunks = chunker.add(output, pcmEncoding)
                            codec.releaseOutputBuffer(outputIndex, false)
                            chunks.forEach { consume(it, sampleRate) }
                        } else {
                            codec.releaseOutputBuffer(outputIndex, false)
                        }
                        outputEnded = bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                        progressed = true
                    }
                }

                idleCycles = if (progressed) 0 else idleCycles + 1
                if (idleCycles >= MAX_IDLE_CYCLES) throw IOException("The audio decoder is not responding")
            }

            chunker.finish()?.let { consume(it, sampleRate) }
        } finally {
            runCatching { codec.stop() }
            codec.release()
        }
    }


    companion object {
        private const val CODEC_TIMEOUT_US = 10_000L
        private const val MAX_IDLE_CYCLES = 3_000
    }
}

internal class PcmChunker(
    private val channelCount: Int,
    private val chunkSamples: Int,
) {
    init {
        require(channelCount in 1..MAX_CHANNEL_COUNT) { "Unsupported audio channel count" }
        require(chunkSamples in 1..MAX_CHUNK_SAMPLES) { "Unsupported audio chunk size" }
    }

    private var chunk = FloatArray(chunkSamples)
    private var size = 0

    fun add(buffer: ByteBuffer, pcmEncoding: Int): List<FloatArray> {
        val bytesPerSample = when (pcmEncoding) {
            AudioFormat.ENCODING_PCM_16BIT -> Short.SIZE_BYTES
            AudioFormat.ENCODING_PCM_FLOAT -> Float.SIZE_BYTES
            else -> throw IOException("Unsupported PCM encoding: $pcmEncoding")
        }
        val frameSize = bytesPerSample * channelCount
        if (buffer.remaining() % frameSize != 0) throw IOException("Incomplete PCM frame")

        val complete = mutableListOf<FloatArray>()
        while (buffer.hasRemaining()) {
            var mixed = 0f
            repeat(channelCount) {
                mixed += when (pcmEncoding) {
                    AudioFormat.ENCODING_PCM_16BIT -> buffer.short / 32_768f
                    else -> buffer.float
                }
            }
            chunk[size++] = (mixed / channelCount).coerceIn(-1f, 1f)
            if (size == chunk.size) {
                complete += chunk
                chunk = FloatArray(chunkSamples)
                size = 0
            }
        }
        return complete
    }

    fun finish(): FloatArray? = if (size == 0) null else chunk.copyOf(size)
}

internal fun pcmChunkSamples(sampleRate: Int): Int {
    require(sampleRate in 1..MAX_SAMPLE_RATE) { "Unsupported audio sample rate" }
    return sampleRate * CHUNK_SECONDS
}

private const val CHUNK_SECONDS = 25
internal const val MAX_SAMPLE_RATE = 192_000
internal const val MAX_CHANNEL_COUNT = 32
private const val MAX_CHUNK_SAMPLES = MAX_SAMPLE_RATE * CHUNK_SECONDS

