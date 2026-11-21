package ai.bithuman.flutter

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
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
    @Volatile private var utterance = 0L
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
                    catch (e: Exception) { HitelE2Trace.failure("speech.playback.exception", e, "epoch" to item.epoch); throw e }
                    base = -1
                }
            }
        } finally { idle?.recycle() }
    }

    private data class Frame(val sample: Long, val jpeg: ByteArray)

    private fun noteIdle() {
        if (++idleShown % 25L == 1L) HitelE2Trace.event("display.present",
            "kind" to 'I', "newMouthFrame" to false, "epoch" to epoch, "utterance" to utterance,
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
        if (!active(e)) return
        val utteranceId = ++utterance
        HitelE2Trace.event("speech.prepare.begin", "epoch" to e, "utterance" to utteranceId, "samples16k" to audio.samples.size)
        val began = System.nanoTime()
        // Preserve the maker's PCM16 AudioTrack and sample-clock presenter, but do
        // not wait for every encoded frame before beginning audible playback.
        // Only the render worker mutates frames; the player snapshots under this lock.
        val frames = ArrayList<Frame>()
        val playbackError = java.util.concurrent.atomic.AtomicReference<Throwable?>(null)
        var playbackThread: Thread? = null
        val totalFrames = (pcm.size / 2 + 16000 / avatar.fps - 1) / (16000 / avatar.fps)
        val audioSeconds = pcm.size / 32000.0
        val minLeadFrames = minOf(totalFrames, maxOf(25, avatar.fps * 2))
        fun startPlayback(reason: String, renderElapsedMs: Long) {
            if (playbackThread != null || !active(e)) return
            HitelE2Trace.event("speech.playback.lookahead", "epoch" to e,
                "utterance" to utteranceId, "reason" to reason,
                "preparedFrames" to synchronized(frames) { frames.size },
                "expectedFrames" to totalFrames, "elapsedRenderMs" to renderElapsedMs)
            playbackThread = Thread({
                try { play(pcm, frames, input.size / 2, base, gen, e, utteranceId) }
                catch (t: Throwable) {
                    playbackError.set(t)
                    HitelE2Trace.failure("speech.playback.exception", t, "epoch" to e)
                }
            }, "bh-e2-audio-clock").apply { isDaemon = true; start() }
        }
        val bmp = avatar.newFrameBitmap()
        // The maker displays a half-size decode; cache that display size before playback.
        val display = Bitmap.createBitmap((avatar.width + 1) / 2, (avatar.height + 1) / 2, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(display)
        val bounds = Rect(0, 0, display.width, display.height)
        val paint = Paint(Paint.FILTER_BITMAP_FLAG)
        val jpeg = ByteArrayOutputStream(256 * 1024)
        try {
            (avatar as Essence2Engine).renderPrepared(pcm, { active(e) }) { frame, at ->
                bmp.copyPixelsFromBuffer(frame)
                canvas.drawBitmap(bmp, null, bounds, paint)
                jpeg.reset()
                check(display.compress(Bitmap.CompressFormat.JPEG, 88, jpeg)) { "Speech frame compression failed" }
                check(frames.isEmpty() || at > frames.last().sample) { "Non-monotonic speech frame position" }
                val readyCount = synchronized(frames) {
                    frames.add(Frame(at, jpeg.toByteArray()))
                    frames.size
                }
                // Use the measured *actual* rendering throughput. Start once the
                // unrendered tail is expected to finish before the audio clock
                // reaches it, including a conservative 20% speed allowance and
                // a 1-second scheduling margin. Starting after just the first
                // frame would reproduce the dropped-mouth-frame regression.
                if (playbackThread == null && readyCount >= minLeadFrames) {
                    val elapsedSec = (System.nanoTime() - began) / 1e9
                    val conservativeFps = (readyCount / maxOf(elapsedSec, 0.001)) * 0.80
                    val remainingSec = (totalFrames - readyCount).coerceAtLeast(0) /
                        maxOf(conservativeFps, 0.001)
                    if (remainingSec + 1.0 <= audioSeconds) {
                        startPlayback("measured_lookahead", (elapsedSec * 1000).toLong())
                    }
                }
            }
        } finally { display.recycle(); bmp.recycle() }
        if (!active(e)) {
            playbackThread?.join(1000)
            return
        }
        check(frames.isNotEmpty()) { "Renderer returned no speech frames" }
        // The original exact frame positions, JPEGs, audio PCM and DAC clock
        // remain unchanged; only the full-utterance preplay barrier is removed.
        HitelE2Trace.event("speech.prepare.end", "epoch" to e, "frames" to frames.size,
            "durationMs" to (System.nanoTime() - began) / 1000000)
        if (playbackThread == null) {
            startPlayback("render_complete_fallback", (System.nanoTime() - began) / 1000000)
        }
        // Keep the original single-turn boundary: do not process next utterance
        // or idle-loop frames until this same PCM/frames playback has drained.
        val playback = playbackThread ?: error("Speech playback did not start")
        while (playback.isAlive) {
            playback.join(100)
            if (!active(e)) break
        }
        playbackError.get()?.let { throw IllegalStateException("Original AudioTrack playout failed", it) }
    }

    /** Vendor play(): static voice buffer, cached display-size images and the device sample counter. */
    private fun play(pcm: ByteArray, frames: List<Frame>, inputSamples: Int, base: Long, gen: Int, e: Int, utteranceId: Long) {
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
            val options = BitmapFactory.Options().apply { inSampleSize = 1 }
            var shown = -1
            var candidate = 0
            var lastCaptionHead = -1600L
            val deadline = System.nanoTime() + (total * 1000000000L / 16000) + 3000000000L
            while (active(e)) {
                val head = player.playbackHeadPosition.toLong() and 0xffffffffL
                due = beforeDue + minOf(expected.toLong(), head / perFrame + 1)
                val nextFrame = synchronized(frames) {
                    if (frames.isEmpty()) null else {
                        while (candidate + 1 < frames.size && frames[candidate + 1].sample <= head) candidate++
                        if (head >= frames[candidate].sample && shown != candidate && head < total)
                            frames[candidate]
                        else null
                    }
                }
                if (nextFrame != null) {
                    val f = nextFrame
                    val image = BitmapFactory.decodeByteArray(f.jpeg, 0, f.jpeg.size, options)
                        ?: error("Speech frame decode failed")
                    try { if (active(e)) onFrame(image) } finally { image.recycle() }
                    shown = candidate
                    val displayedHead = player.playbackHeadPosition.toLong() and 0xffffffffL
                    due = beforeDue + minOf(expected.toLong(), displayedHead / perFrame + 1)
                    uniqueShown++
                    speechPresented++
                    speechWritten = beforeDue + expected
                    stats.onPresented(true, stats.turnGen)
                    stats.speechUnits = speechPresented.toInt()
                    stats.offsetMs = (displayedHead - f.sample) * 1000.0 / 16000
                    HitelE2Trace.event("display.present", "kind" to 'S', "newMouthFrame" to true,
                        "pts24k" to f.sample * 3 / 2, "deviceClock24k" to displayedHead * 3 / 2,
                        "late24k" to (displayedHead - f.sample) * 3 / 2,
                        "speechWritten" to speechWritten, "speechPresented" to speechPresented,
                        "uniqueShown" to uniqueShown, "due" to due,
                        "coveragePct" to (uniqueShown * 100.0 / maxOf(due, 1)), "epoch" to e, "utterance" to utteranceId)
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
                    HitelE2Trace.event("sdk.utterance.drained", "epoch" to e, "utterance" to utteranceId, "completed" to completed,
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

