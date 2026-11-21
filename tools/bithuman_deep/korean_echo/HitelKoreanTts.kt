package ai.bithuman.flutter

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.k2fsa.sherpa.onnx.*
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.zip.ZipInputStream
import org.json.JSONObject

/** Korean-only local VITS. Owns no AudioTrack: all sound goes through the avatar. */
class HitelKoreanTts(private val binding: FlutterPlugin.FlutterPluginBinding) {
    private val context: Context = binding.applicationContext
    private val main = Handler(Looper.getMainLooper())
    private val synthesis = Executors.newSingleThreadExecutor()
    private val delivery = Executors.newSingleThreadExecutor()
    private val channel = MethodChannel(binding.binaryMessenger, "ai.hitel/korean_tts")
    @Volatile private var current: Turn? = null
    @Volatile private var detached = false
    private var engine: OfflineTts? = null // synthesis executor only
    private var probeReceiver: android.content.BroadcastReceiver? = null
    private class Turn(val id: Int, val text: String) {
        val queue = ArrayBlockingQueue<Map<String, Any>>(16)
    }

    init {
        if ((context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            val receiver = object : android.content.BroadcastReceiver() {
                override fun onReceive(c: Context, intent: android.content.Intent) {
                    if (intent.getBooleanExtra("unfocus", false)) {
                        channel.invokeMethod("probeUnfocus", null)
                        return
                    }
                    val encoded = intent.getStringExtra("text_b64") ?: return
                    val text = String(android.util.Base64.decode(encoded, android.util.Base64.DEFAULT), Charsets.UTF_8)
                    val clipboard = c.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    runCatching { clipboard.setPrimaryClip(android.content.ClipData.newPlainText("HITEL test input", text)) }
                    // Test setup only: Android shell cannot type Korean Unicode. Fill the
                    // existing controller; the harness still submits with the real Enter key.
                    channel.invokeMethod("probeInput", text)
                }
            }
            val filter = android.content.IntentFilter("ai.hitel.debug.ECHO_CLIPBOARD")
            if (android.os.Build.VERSION.SDK_INT >= 33)
                context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
            else context.registerReceiver(receiver, filter)
            probeReceiver = receiver
        }
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "start" -> {
                    val id = call.argument<Int>("turn")!!
                    val text = call.argument<String>("text")!!
                    val turn = Turn(id, text)
                    current = turn
                    result.success(null)
                    synthesis.execute { generate(turn) }
                }
                "next" -> {
                    val turn = current
                    val id = call.argument<Int>("turn")
                    delivery.execute {
                        var event: Map<String, Any>? = null
                        while (!detached && turn != null && turn === current && turn.id == id) {
                            event = turn.queue.poll(50, TimeUnit.MILLISECONDS)
                            if (event != null) break
                        }
                        val answer = if (!detached && turn === current) event else null
                        main.post { if (!detached) result.success(answer ?: mapOf("cancelled" to true)) }
                    }
                }
                "cancel" -> {
                    val id = call.argument<Int>("turn")
                    if (id == null || current?.id == id) current = null
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun live(turn: Turn) = !detached && current === turn
    private fun emit(turn: Turn, event: Map<String, Any>): Boolean {
        while (live(turn)) if (turn.queue.offer(event, 50, TimeUnit.MILLISECONDS)) return true
        return false
    }

    private fun load(): OfflineTts {
        engine?.let { return it }
        val dir = File(context.filesDir, "hitel-ko-vits-1")
        val marker = File(dir, "hitel-model.json")
        if (!marker.exists()) {
            dir.mkdirs()
            val name = binding.flutterAssets.getAssetFilePathByName("assets/hitel_ko_tts.zip")
            var manifest: ByteArray? = null
            ZipInputStream(context.assets.open(name)).use { zip ->
                while (true) {
                    val entry = zip.nextEntry ?: break
                    val file = File(dir, entry.name)
                    check(file.canonicalPath.startsWith(dir.canonicalPath + File.separator))
                    if (!entry.isDirectory) {
                        if (entry.name == "hitel-model.json") manifest = zip.readBytes()
                        else {
                            file.parentFile!!.mkdirs()
                            file.outputStream().use { zip.copyTo(it) }
                        }
                    }
                    zip.closeEntry()
                }
            }
            // Commit extraction only after all model/data members are written.
            marker.writeBytes(checkNotNull(manifest))
        }
        val model = JSONObject(marker.readText()).getString("model")
        val t0 = System.nanoTime()
        HitelE2Trace.event("tts.load.begin", "engine" to "sherpa-onnx-vits", "language" to "ko-KR")
        val tts = OfflineTts(config = OfflineTtsConfig(
            model = OfflineTtsModelConfig(
                vits = OfflineTtsVitsModelConfig(
                    model = File(dir, model).path,
                    tokens = File(dir, "tokens.txt").path,
                    dataDir = File(dir, "espeak-ng-data").path),
                numThreads = 2, provider = "cpu", debug = false),
            maxNumSentences = 1))
        check(tts.sampleRate() == 22050) { "Unexpected Korean TTS rate: ${tts.sampleRate()}" }
        engine = tts
        HitelE2Trace.event("tts.load.end", "elapsedMs" to (System.nanoTime() - t0) / 1000000)
        return tts
    }

    private fun generate(turn: Turn) {
        if (!live(turn)) return
        try {
            val tts = load()
            if (!live(turn)) return
            val started = System.nanoTime()
            val digest = MessageDigest.getInstance("SHA-256")
            val reference = File(context.filesDir, "hitel-echo-latest.pcm")
            var samples24k = 0L
            var chunks = 0
            val segments = KoreanSpeechSegments.split(turn.text)
            HitelE2Trace.event("tts.begin", "turn" to turn.id, "chars" to turn.text.length,
                "segments" to segments.size, "inputSha256" to sha(turn.text.toByteArray(Charsets.UTF_8)))
            reference.outputStream().use { output ->
                val resampler = KoreanPcmResampler(22050, 24000) { pcm ->
                    if (live(turn)) {
                        if (emit(turn, mapOf("pcm" to pcm))) {
                            output.write(pcm); digest.update(pcm); samples24k += pcm.size / 2
                            if (chunks++ == 0) HitelE2Trace.event("tts.first_pcm", "turn" to turn.id,
                                "elapsedMs" to (System.nanoTime() - started) / 1000000)
                        }
                    }
                }
                for ((index, segment) in segments.withIndex()) {
                    if (!live(turn)) return@use
                    HitelE2Trace.event("tts.segment.begin", "turn" to turn.id, "index" to index,
                        "chars" to segment.length)
                    tts.generateWithCallback(segment, sid = 0, speed = 1.0f, callback = KoreanTtsPcmCallback { samples ->
                        if (!live(turn)) 0 else { resampler.push(samples); if (live(turn)) 1 else 0 }
                    })
                    // Publish even a short segment before synthesising the next one.
                    resampler.flushPacket()
                    HitelE2Trace.event("tts.segment.end", "turn" to turn.id, "index" to index,
                        "samples24k" to samples24k)
                }
                if (live(turn)) resampler.finish()
            }
            if (!live(turn)) return
            check(samples24k > 0) { "Korean TTS produced no speech" }
            HitelE2Trace.event("tts.done", "turn" to turn.id, "samples24k" to samples24k,
                "chunks" to chunks, "pcmSha256" to hex(digest.digest()),
                "elapsedMs" to (System.nanoTime() - started) / 1000000)
            emit(turn, mapOf("done" to true, "samples24k" to samples24k))
        } catch (error: Throwable) {
            if (live(turn)) {
                HitelE2Trace.failure("tts.error", error, "turn" to turn.id)
                emit(turn, mapOf("error" to (error.message ?: error.javaClass.simpleName)))
            }
        }
    }

    fun close() {
        detached = true; current = null; channel.setMethodCallHandler(null)
        probeReceiver?.let { context.unregisterReceiver(it) }; probeReceiver = null
        synthesis.execute { engine?.release(); engine = null }
        synthesis.shutdown(); delivery.shutdown()
    }

    private fun sha(bytes: ByteArray) = hex(MessageDigest.getInstance("SHA-256").digest(bytes))
    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
}
