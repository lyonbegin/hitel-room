package ai.bithuman.flutter

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Handler
import android.os.Looper
import java.io.ByteArrayOutputStream
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/** The plugin's existing player contract; loading, transport and texture stay with their owners. */
interface SpeechPlayer {
    val stats: AvatarStats
    fun start()
    fun stop()
    fun offer(pcm24k: ByteArray, fedStart: Long = -1L)
    fun endOfReply()
    fun bargeIn(reason: String = "app")
    fun resetPlayout()
    fun noteFirstByte()
    fun sampleUnderruns()
    fun census(): String
}

class LegacySpeechPlayer(private val player: AvatarPlayer) : SpeechPlayer {
    override val stats get() = player.stats
    override fun start() = player.start()
    override fun stop() = player.stop()
    override fun offer(pcm24k: ByteArray, fedStart: Long) = player.offer(pcm24k, fedStart)
    override fun endOfReply() = player.endOfReply()
    override fun bargeIn(reason: String) = player.bargeIn(reason)
    override fun resetPlayout() = player.resetPlayout()
    override fun noteFirstByte() = player.noteFirstByte()
    override fun sampleUnderruns() = player.sampleUnderruns()
    override fun census() = player.census()
}

/**
 * Adapted from the manufacturer's android/essence2-hello MainActivity.renderOnce/play
 * at bithuman-product/bithuman-examples@fea69e72515af7d05f384a9d2147ac0cc181b411.
 *
 * Prepare the utterance before starting its voice. MODE_STATIC contains the SAME 16 kHz
 * samples given to the renderer. Frame i is selected by playbackHeadPosition / 640,
 * never by input arrival time or render speed. This deliberately adds preparation
 * latency on a slow renderer instead of playing voice ahead of the available mouth.
 * The existing engine owns inference, idle and lifecycle; no second model is opened.
 */
class Essence2SpeechPlayer(
    private val avatar: AvatarEngine,
    private val workers: Workers,
    private val onPlayout: (Long) -> Unit,
    private val onFrame: (Bitmap) -> Unit,
) : SpeechPlayer {
    override val stats = AvatarStats()
    private data class Message(val epoch: Int, val pcm: ByteArray? = null,
                               val fedStart: Long = -1, val playGen: Int = 0,
                               val end: Boolean = false)
    private val inbox = LinkedBlockingQueue<Message>()
    private val main = Handler(Looper.getMainLooper())
    private val trackLock = Any()
    @Volatile private var track: AudioTrack? = null
    @Volatile private var epoch = 0
    @Volatile private var playGen = 0
    @Volatile private var fed = 0L
    @Volatile private var played = 0L
    @Volatile private var completed = 0L
    @Volatile private var uniqueShown = 0L
    @Volatile private var due = 0L
    @Volatile private var speechWritten = 0L
    @Volatile private var speechPresented = 0L
    private var idleShown = 0L
    private fun active(e: Int) = workers.running && epoch == e

    override fun start() { workers.spawn("bh-essence-speech", ::run) }
    override fun noteFirstByte() = stats.markFirstByte()
    @Synchronized override fun offer(pcm24k: ByteArray, fedStart: Long) {
        if (!workers.running || pcm24k.isEmpty()) return
        if (fedStart >= 0) fed = maxOf(fed, fedStart + pcm24k.size / 2)
        inbox.offer(Message(epoch, pcm24k.copyOf(), fedStart, playGen))
    }
    @Synchronized override fun endOfReply() { inbox.offer(Message(epoch, end = true)) }
    @Synchronized override fun resetPlayout() { playGen++; fed = 0; played = 0 }
    @Synchronized override fun bargeIn(reason: String) {
        epoch++
        inbox.clear()
        synchronized(trackLock) { track?.let { runCatching { it.pause() }; runCatching { it.flush() } } }
        reportPlayed(fed, playGen)
        HitelE2Trace.event("speech.cancel", "epoch" to epoch, "reason" to reason)
    }
    override fun stop() {
        workers.stop()
        bargeIn("stop")
    }
    override fun sampleUnderruns() {
        synchronized(trackLock) { stats.underruns = track?.let { runCatching { it.underrunCount }.getOrDefault(0) } ?: 0 }
    }
    override fun census() = "speechWritten=$speechWritten speechPresented=$speechPresented " +
        "mouthUnique=$uniqueShown due=$due completed=$completed mode=vendor-prepared-audio-clock"

    private fun reportPlayed(position: Long, gen: Int) {
        main.post {
            if (gen == playGen) {
                played = maxOf(played, minOf(position, fed))
                onPlayout(played)
            }
        }
    }

    /** Only this worker calls the engine, including reset: a cut cannot reset under a pull. */
    private fun run() {
        val bytes = ByteArrayOutputStream()
        var collecting = epoch
        var base = -1L
        var gen = playGen
        var idle: Bitmap? = null
        try {
            while (workers.running) {
                if (collecting != epoch) { bytes.reset(); base = -1; collecting = epoch }
                val item = inbox.poll(40, TimeUnit.MILLISECONDS)
                if (item == null) {
                    if (bytes.size() == 0 && AppVisibility.process.visible) {
                        if (avatar.hardwareFrames) {
                            avatar.idle?.nextSlot()?.let { f -> try { onFrame(f.bitmap); noteIdle() } finally { f.release() } }
                        } else {
                            if (idle == null) idle = avatar.newFrameBitmap()
                            if ((avatar.idle?.next(idle!!) ?: -1) >= 0) { onFrame(idle!!); noteIdle() }
                        }
                    }
                    continue
                }
                if (!active(item.epoch)) continue
                if (item.pcm != null) {
                    if (base < 0) { base = item.fedStart; gen = item.playGen }
                    bytes.write(item.pcm)
                }
                if (item.end && bytes.size() > 0) {
                    val pcm24k = bytes.toByteArray()
                    bytes.reset()
                    try { renderAndPlay(pcm24k, base, gen, item.epoch) }
                    catch (e: Exception) { HitelE2Trace.failure("speech.playback.exception", e); throw e }
                    base = -1
                }
            }
        } finally { idle?.recycle() }
    }

    private data class Frame(val sample: Long, val jpeg: ByteArray)

    private fun noteIdle() {
        if (++idleShown % 25L == 1L) HitelE2Trace.event("display.present",
            "kind" to 'I', "newMouthFrame" to false, "epoch" to epoch,
            "speechWritten" to speechWritten, "speechPresented" to speechPresented,
            "uniqueShown" to uniqueShown, "due" to due)
    }

    private fun renderAndPlay(input: ByteArray, base: Long, gen: Int, e: Int) {
        if (!active(e)) return
        // Use the vendor's Wav resampler, with a PCM WAV header for the wire's 24 kHz mono.
        val header = java.nio.ByteBuffer.allocate(44).order(java.nio.ByteOrder.LITTLE_ENDIAN)
        header.put("RIFF".toByteArray()).putInt(36 + input.size).put("WAVEfmt ".toByteArray())
            .putInt(16).putShort(1).putShort(1).putInt(24000).putInt(48000)
            .putShort(2).putShort(16).put("data".toByteArray()).putInt(input.size)
        val audio = Essence2VendorWav.read16kMono(header.array() + input)
        val pcm = audio.toLittleEndianBytes()
        avatar.reset()
        if (!active(e)) return
        HitelE2Trace.event("speech.prepare.begin", "epoch" to e, "samples16k" to audio.samples.size)
        val began = System.nanoTime()
        HitelE2Trace.event("player.feed.call", "samples16k" to audio.samples.size)
        avatar.feed(audio.toFloats())
        HitelE2Trace.event("player.feed.return", "durationUs" to (System.nanoTime() - began) / 1000)
        avatar.flushTail()
        val frames = ArrayList<Frame>()
        val bmp = if (!avatar.hardwareFrames) avatar.newFrameBitmap() else null
        val jpeg = ByteArrayOutputStream(512 * 1024)
        var lastProgress = System.nanoTime()
        try {
            while (active(e)) {
                var at = -1L
                var hw: HwFrame? = null
                var copy: Bitmap? = null
                try {
                    val image = if (avatar.hardwareFrames) {
                        hw = avatar.pullSlot()
                        at = hw?.at ?: -1
                        if (hw != null) { copy = hw!!.bitmap.copy(Bitmap.Config.ARGB_8888, false); copy } else null
                    } else { at = avatar.pull(bmp!!); if (at >= 0) bmp else null }
                    if (image != null && at >= 0) {
                        jpeg.reset()
                        check(image.compress(Bitmap.CompressFormat.JPEG, 88, jpeg)) { "Speech frame compression failed" }
                        check(frames.isEmpty() || at > frames.last().sample) { "Non-monotonic speech frame position" }
                        frames.add(Frame(at, jpeg.toByteArray()))
                        lastProgress = System.nanoTime()
                    } else {
                        if (!avatar.hasPendingTail && avatar.queuedFrames == 0) break
                        check((System.nanoTime() - lastProgress) / 1000000 < 120000) { "Renderer stopped producing speech frames" }
                        Thread.sleep(10)
                    }
                } finally { copy?.recycle(); hw?.release() }
            }
        } finally { bmp?.recycle() }
        if (!active(e)) return
        check(frames.isNotEmpty()) { "Renderer returned no speech frames" }
        // No invented mouth for missing frames. Keep source sample positions, report missing coverage.
        HitelE2Trace.event("speech.prepare.end", "epoch" to e, "frames" to frames.size,
            "durationMs" to (System.nanoTime() - began) / 1000000)
        play(pcm, frames, input.size / 2, base, gen, e)
    }

    /** Vendor play(): static voice buffer, half-size JPEG decode and the device sample counter. */
    private fun play(pcm: ByteArray, frames: List<Frame>, inputSamples: Int, base: Long, gen: Int, e: Int) {
        val player = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(16000).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(pcm.size).build()
        try {
            val t0 = System.nanoTime()
            if (!active(e)) return
            // Static writes replace the shared buffer, so a partial write cannot be appended.
            val written = player.write(pcm, 0, pcm.size)
            check(written == pcm.size) { "AudioTrack incomplete static write: $written/${pcm.size}" }
            HitelE2Trace.event("audio.track.write", "kind" to 'S', "pcmBytes" to pcm.size,
                "returnedBytes" to written, "sampleRate" to 16000, "durationUs" to (System.nanoTime()-t0)/1000)
            synchronized(trackLock) {
                if (!active(e)) return
                track = player
                player.play()
            }
            stats.markFirstAudio()
            stats.onAudioWrite()
            val total = pcm.size / 2
            val perFrame = 16000 / avatar.fps
            val expected = (total + perFrame - 1) / perFrame
            val beforeDue = due
            val options = BitmapFactory.Options().apply { inSampleSize = 2 }
            var shown = -1
            var candidate = 0
            var lastCaptionHead = -1600L
            val deadline = System.nanoTime() + (total * 1000000000L / 16000) + 3000000000L
            while (active(e)) {
                val head = player.playbackHeadPosition.toLong() and 0xffffffffL
                due = beforeDue + minOf(expected.toLong(), head / perFrame + 1)
                while (candidate + 1 < frames.size && frames[candidate + 1].sample <= head) candidate++
                if (head >= frames[candidate].sample && shown != candidate && head < total) {
                    val f = frames[candidate]
                    val image = BitmapFactory.decodeByteArray(f.jpeg, 0, f.jpeg.size, options)
                        ?: error("Speech frame decode failed")
                    try { if (active(e)) onFrame(image) } finally { image.recycle() }
                    shown = candidate
                    uniqueShown++
                    speechPresented++
                    speechWritten = beforeDue + expected
                    stats.onPresented(true, stats.turnGen)
                    stats.offsetMs = (head - f.sample) * 1000.0 / 16000
                    HitelE2Trace.event("display.present", "kind" to 'S', "newMouthFrame" to true,
                        "pts24k" to f.sample * 3 / 2, "deviceClock24k" to head * 3 / 2,
                        "late24k" to (head - f.sample) * 3 / 2,
                        "speechWritten" to speechWritten, "speechPresented" to speechPresented,
                        "uniqueShown" to uniqueShown, "due" to due,
                        "coveragePct" to (uniqueShown * 100.0 / maxOf(due, 1)), "epoch" to e)
                }
                if (base >= 0 && head - lastCaptionHead >= 1600) {
                    reportPlayed(base + minOf(inputSamples.toLong(), head * 3 / 2), gen)
                    lastCaptionHead = head
                }
                if (head >= total) {
                    due = beforeDue + expected
                    completed++
                    idleShown = 0
                    if (base >= 0) reportPlayed(base + inputSamples, gen)
                    HitelE2Trace.event("sdk.utterance.drained", "epoch" to e, "completed" to completed,
                        "played16k" to head, "total16k" to total,
                        "uniqueShown" to uniqueShown, "due" to due)
                    return
                }
                check(System.nanoTime() < deadline) { "AudioTrack playback did not finish" }
                Thread.sleep(5)
            }
        } finally {
            synchronized(trackLock) {
                if (track === player) track = null
                runCatching { player.stop() }
                player.release()
            }
        }
    }
}

