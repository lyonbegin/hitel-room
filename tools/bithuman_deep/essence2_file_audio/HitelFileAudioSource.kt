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

    init {
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "start" -> {
                    val turn = Turn(checkNotNull(call.argument<Int>("turn")))
                    current = turn
                    HitelE2Trace.event("file.channel.start", "turn" to turn.id)
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
                        val pcm = answer?.get("pcm") as? ByteArray
                        if (pcm != null || answer?.get("done") == true)
                            HitelE2Trace.event("file.channel.next", "turn" to id,
                                "chunk" to answer?.get("chunk"), "pcmBytes" to pcm?.size,
                                "done" to answer?.get("done"), "queueDepth" to turn?.queue?.size)
                        main.post { if (!closed) result.success(answer ?: mapOf("cancelled" to true)) }
                    }
                }
                "cancel" -> { current = null; result.success(null) }
                else -> result.notImplemented()
            }
        }
    }

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
                // The channel consumer drains chunks as soon as possible. The queue
                // bounds the decoder-to-Dart handoff independently of speaker playout.
                val startedAt = System.nanoTime()
                if (pcm.isNotEmpty() && emit(turn, mapOf("pcm" to pcm, "chunk" to (chunks + 1)))) {
                    digest.update(pcm); bytes24k += pcm.size
                    HitelE2Trace.event("file.pcm.chunk", "turn" to turn.id, "chunk" to (chunks + 1),
                        "pcmBytes" to pcm.size, "totalBytes" to bytes24k, "depth" to turn.queue.size,
                        "publishUs" to (System.nanoTime() - startedAt) / 1000)
                    if (chunks++ == 0) HitelE2Trace.event("file.first_pcm", "turn" to turn.id,
                        "elapsedMs" to (System.nanoTime() - started) / 1000000,
                        "pcmBytes" to pcm.size)
                    if (chunks % 25 == 0) HitelE2Trace.event("file.pcm.progress", "turn" to turn.id,
                        "chunks" to chunks, "bytes24k" to bytes24k)
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
                    val at = System.nanoTime()
                    val pcm24 = converter.process(pcm16)
                    HitelE2Trace.event("file.resample", "turn" to turn.id, "segment" to seq,
                        "pcm16Bytes" to pcm16.size, "pcm24Bytes" to pcm24.size,
                        "sourceMs" to sourcePositionMs, "last" to last,
                        "durationUs" to (System.nanoTime() - at) / 1000)
                    publish(pcm24)
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
