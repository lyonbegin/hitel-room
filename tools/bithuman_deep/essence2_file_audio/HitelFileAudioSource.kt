package ai.bithuman.flutter

import android.os.Handler
import android.os.Looper
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodChannel
import java.security.MessageDigest
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** The old HITEL14 file decoder feeding the existing avatar's 24 kHz wire. No STT/TTS. */
class HitelFileAudioSource(private val binding: FlutterPlugin.FlutterPluginBinding) {
    private val main = Handler(Looper.getMainLooper())
    private val decoder = Executors.newSingleThreadExecutor()
    private val delivery = Executors.newSingleThreadExecutor()
    private val channel = MethodChannel(binding.binaryMessenger, "ai.hitel/file_audio")
    private class Turn(val id: Int) { val queue = ArrayBlockingQueue<Map<String, Any>>(8) }
    @Volatile private var current: Turn? = null
    @Volatile private var closed = false
    @Volatile private var pending24k = 0L

    init {
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "start" -> {
                    val turn = Turn(checkNotNull(call.argument<Int>("turn")))
                    current = turn
                    result.success(null)
                    decoder.execute { decode(turn) }
                }
                "next" -> {
                    val turn = current
                    val id = call.argument<Int>("turn")
                    delivery.execute {
                        var event: Map<String, Any>? = null
                        while (turn != null && live(turn) && turn.id == id) {
                            event = turn.queue.poll(50, TimeUnit.MILLISECONDS)
                            if (event != null) break
                        }
                        val answer = if (turn != null && live(turn)) event else null
                        main.post { if (!closed) result.success(answer ?: mapOf("cancelled" to true)) }
                    }
                }
                "cancel" -> { current = null; result.success(null) }
                else -> result.notImplemented()
            }
        }
    }

    /** Main thread: the ORIGINAL AudioTrack-backed playout coordinate, not a timer. */
    fun setPendingSamples(samples24k: Long) { pending24k = maxOf(0L, samples24k) }
    private fun live(turn: Turn) = !closed && current === turn
    private fun emit(turn: Turn, event: Map<String, Any>): Boolean {
        while (live(turn)) if (turn.queue.offer(event, 50, TimeUnit.MILLISECONDS)) return true
        return false
    }

    private fun decode(turn: Turn) {
        if (!live(turn)) return
        try {
            val asset = binding.flutterAssets.getAssetFilePathByName("assets/hitel_file_reply.m4a")
            val converter = Pcm16kTo24k() // unchanged original bitHuman stream converter
            val digest = MessageDigest.getInstance("SHA-256")
            var chunks = 0
            var bytes24k = 0L
            val started = System.nanoTime()
            HitelE2Trace.event("file.decode.begin", "turn" to turn.id,
                "source" to "bundled-m4a", "chunkMs" to 100, "stt" to false, "tts" to false)
            fun publish(pcm: ByteArray) {
                // Keep enough lead for the SDK's audio frontend, while bounding the
                // decoded file ahead of what the original speaker has actually consumed.
                while (live(turn) && pending24k > 24000L * 3L) Thread.sleep(10)
                if (pcm.isNotEmpty() && emit(turn, mapOf("pcm" to pcm))) {
                    digest.update(pcm); bytes24k += pcm.size
                    if (chunks++ == 0) HitelE2Trace.event("file.first_pcm", "turn" to turn.id,
                        "elapsedMs" to (System.nanoTime() - started) / 1000000,
                        "pcmBytes" to pcm.size)
                    if (chunks % 25 == 0) HitelE2Trace.event("file.pcm.progress", "turn" to turn.id,
                        "chunks" to chunks, "bytes24k" to bytes24k, "pending24k" to pending24k)
                }
            }
            FilePcmStream.decodeAsset(binding.applicationContext, asset, object : FilePcmStream.Callback {
                override fun cancelled() = !live(turn)
                override fun onStart(durationMs: Long, mime: String, sourceRate: Int, channels: Int) {
                    HitelE2Trace.event("file.source.format", "turn" to turn.id, "durationMs" to durationMs,
                        "mime" to mime, "sourceRate" to sourceRate, "channels" to channels,
                        "decodedRate" to 16000, "wireRate" to 24000)
                }
                override fun onProgress(decodedMs: Long, totalMs: Long) { }
                override fun onSegment(seq: Int, pcm16: ByteArray, sourcePositionMs: Long, totalMs: Long, last: Boolean) {
                    if (seq == 1) HitelE2Trace.event("file.first_segment", "turn" to turn.id,
                        "decodedMs" to sourcePositionMs, "totalMs" to totalMs,
                        "beforeFileEnd" to (sourcePositionMs < totalMs))
                    publish(converter.process(pcm16))
                }
            })
            if (!live(turn)) return
            publish(converter.flush())
            if (!live(turn)) return
            val hash = digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
            HitelE2Trace.event("file.decode.done", "turn" to turn.id, "chunks" to chunks,
                "bytes24k" to bytes24k, "pcmSha256" to hash,
                "elapsedMs" to (System.nanoTime() - started) / 1000000)
            emit(turn, mapOf("done" to true))
        } catch (error: Throwable) {
            if (live(turn)) {
                HitelE2Trace.failure("file.error", error, "turn" to turn.id)
                emit(turn, mapOf("error" to (error.message ?: error.javaClass.simpleName)))
            }
        }
    }

    fun close() {
        closed = true; current = null
        channel.setMethodCallHandler(null)
        decoder.shutdown(); delivery.shutdown()
    }
}
