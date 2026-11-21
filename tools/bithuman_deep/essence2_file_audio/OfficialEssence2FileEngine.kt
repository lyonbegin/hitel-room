package ai.bithuman.flutter

import ai.bithuman.essence2.Essence2Avatar
import android.graphics.Bitmap
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * Minimal, truly LIVE official Essence2 PCM16 path.
 *
 * Dart's local file decoder yields 16 kHz mono PCM16 LE chunks. Each received
 * chunk is queued at once to the original Essence2Avatar.feed(ByteArray) AND
 * to a separate streaming AudioTrack writer. The SDK pull thread starts with
 * the FIRST chunk and paints EACH frame as it appears. endOfAudio() is called
 * only on the actual end marker and NEVER gates audio or video playback.
 *
 * NO entire-file PCM staging, NO JPEG encoding, NO disk frame cache,
 * NO pre-render-then-play, NO custom frame alignment, clock/sync correction,
 * skip-ahead or stale-frame dropping.
 *
 * Like the bitHuman Android example, the video worker polls pull(ByteBuffer)
 * until a frame is available, but the source, audio output and screen do not
 * wait for the whole audio file or for all video frames.
 */
internal class OfficialEssence2FileEngine(
    private val sdk: Essence2Avatar,
    @Suppress("UNUSED_PARAMETER") unusedCacheDir: File,
) : AvatarEngine {
    override val name = "essence2-official-pcm16-live"
    override val width: Int get() = sdk.width
    override val height: Int get() = sdk.height
    override val fps: Int = 25
    override val idle: IdleClip? = null

    private sealed class Packet {
        class Chunk(val turn: Int, val bytes: ByteArray) : Packet()
        class End(val turn: Int) : Packet()
        object Shutdown : Packet()
    }

    private val state = Any()
    private val feedQueue = LinkedBlockingQueue<Packet>()
    private val soundQueue = LinkedBlockingQueue<Packet>()
    private val feedWorker = Executors.newSingleThreadExecutor { work ->
        Thread(work, "e2-live-feed").apply { isDaemon = true }
    }
    private val pullWorker = Executors.newSingleThreadExecutor { work ->
        Thread(work, "e2-live-pull").apply { isDaemon = true }
    }
    private val soundWorker = Executors.newSingleThreadExecutor { work ->
        Thread(work, "e2-live-sound").apply { isDaemon = true }
    }

    private val counter = AtomicInteger()
    @Volatile private var currentTurn = 0
    @Volatile private var sdkStartedTurn = 0
    @Volatile private var sdkEndedTurn = 0
    @Volatile private var acceptedSamples = 0L
    @Volatile private var renderedFrames = 0L
    @Volatile private var closed = false
    @Volatile private var renderer: ((Bitmap) -> Unit)? = null
    @Volatile private var outputTrack: AudioTrack? = null
    private var receiving = false
    private var sdkEverFed = false

    init {
        feedWorker.execute { runFeed() }
        pullWorker.execute { runPull() }
        soundWorker.execute { runSound() }
    }

    /** The caller takes ownership of bitmaps and must recycle them after drawing. */
    fun attachRenderer(callback: (Bitmap) -> Unit) {
        renderer = callback
    }

    /** No wait. Never gather the full PCM or defer the first SDK feed. */
    fun appendPcm16(bytes: ByteArray) {
        if (bytes.isEmpty()) return
        require(bytes.size % 2 == 0) { "16-bit PCM byte length must be even" }
        val turn: Int
        val first: Boolean
        synchronized(state) {
            check(!closed) { "Essence2 SDK already closed" }
            first = !receiving
            if (first) {
                currentTurn = counter.incrementAndGet()
                acceptedSamples = 0L
                renderedFrames = 0L
                receiving = true
            }
            turn = currentTurn
            acceptedSamples += bytes.size / 2
        }
        // Two independent consumers. The incoming ByteArray is not retained by Dart.
        val copy = bytes.copyOf()
        feedQueue.offer(Packet.Chunk(turn, copy))
        soundQueue.offer(Packet.Chunk(turn, copy))
        if (first) Log.i(TAG, "LIVE_BEGIN turn=$turn firstPcmBytes=${bytes.size}")
    }

    /** This signal ONLY closes native input; it never starts playback. */
    fun endOfPcm() {
        val turn: Int
        synchronized(state) {
            if (!receiving || closed) return
            receiving = false
            turn = currentTurn
        }
        feedQueue.offer(Packet.End(turn))
        soundQueue.offer(Packet.End(turn))
        Log.i(TAG, "LIVE_INPUT_END turn=$turn acceptedSamples=$acceptedSamples")
    }

    /** Explicit interruption can stop current audio without synchronizing it to video. */
    fun cancelFile() {
        synchronized(state) {
            currentTurn = counter.incrementAndGet()
            receiving = false
        }
        feedQueue.clear()
        soundQueue.clear()
        val track = outputTrack
        if (track != null) runCatching { track.pause(); track.flush() }
        Log.i(TAG, "LIVE_CANCEL turn=$currentTurn")
    }

    private fun live(turn: Int) = !closed && turn == currentTurn

    private fun runFeed() {
        var loadedTurn = 0
        try {
            while (!closed) {
                when (val packet = feedQueue.take()) {
                    is Packet.Chunk -> {
                        if (!live(packet.turn)) continue
                        if (loadedTurn != packet.turn) {
                            if (sdkEverFed) sdk.resetAudio(startFrame = 0)
                            sdkEverFed = true
                            loadedTurn = packet.turn
                            sdkEndedTurn = 0
                            sdkStartedTurn = packet.turn
                        }
                        if (!live(packet.turn)) continue
                        sdk.feed(packet.bytes) // Original official SDK ByteArray overload
                        Log.i(TAG, "LIVE_FEED turn=${packet.turn} pcm16Bytes=${packet.bytes.size}")
                    }
                    is Packet.End -> {
                        if (!live(packet.turn) || loadedTurn != packet.turn) continue
                        sdk.endOfAudio() // Exact original SDK end marker, AFTER final chunk
                        sdkEndedTurn = packet.turn
                        Log.i(TAG, "LIVE_SDK_END turn=${packet.turn} acceptedSamples=$acceptedSamples")
                    }
                    Packet.Shutdown -> return
                }
            }
        } catch (interrupted: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (failure: Throwable) {
            Log.e(TAG, "LIVE_FEED_FAIL", failure)
        }
    }

    private fun runPull() {
        try {
            val frame = sdk.newFrameBuffer()
            var observedTurn = 0
            var shownInTurn = 0L
            var lastFrameAt = System.nanoTime()
            var renderCheckedTurn = 0
            while (!closed) {
                val turn = currentTurn
                if (turn == 0 || sdkStartedTurn != turn || renderCheckedTurn == turn) {
                    Thread.sleep(10)
                    continue
                }
                if (turn != observedTurn) {
                    observedTurn = turn
                    shownInTurn = 0L
                    lastFrameAt = System.nanoTime()
                }
                frame.clear()
                val ready = sdk.pull(frame) // SDK produced? Display NOW, not at file end.
                if (ready) {
                    if (!live(turn)) continue
                    frame.rewind()
                    val pixels = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    try {
                        pixels.copyPixelsFromBuffer(frame)
                        renderer?.invoke(pixels) ?: pixels.recycle()
                    } catch (failure: Throwable) {
                        pixels.recycle()
                        throw failure
                    }
                    shownInTurn++
                    renderedFrames = shownInTurn
                    lastFrameAt = System.nanoTime()
                    if (shownInTurn == 1L || shownInTurn % 25L == 0L)
                        Log.i(TAG, "LIVE_PULL turn=$turn frame=$shownInTurn acceptedSamples=$acceptedSamples")
                } else {
                    // This short empty-queue poll is the official SDK example's
                    // pull() polling, NOT a wait for a complete audio file.
                    if (sdkEndedTurn == turn) {
                        val approx = ((acceptedSamples * fps + RATE / 2) / RATE)
                        val quietMs = (System.nanoTime() - lastFrameAt) / 1_000_000
                        if (shownInTurn >= approx && sdk.available() == 0 && quietMs > 2_000) {
                            sdk.checkRender()
                            renderCheckedTurn = turn
                            Log.i(TAG, "LIVE_RENDER_DONE turn=$turn frames=$shownInTurn expectedApprox=$approx")
                            continue
                        }
                    }
                    Thread.sleep(10)
                }
            }
        } catch (interrupted: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (failure: Throwable) {
            Log.e(TAG, "LIVE_PULL_FAIL", failure)
        }
    }

    private fun makeTrack(): AudioTrack {
        val minimum = AudioTrack.getMinBufferSize(
            RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT
        )
        check(minimum > 0) { "Unsupported AudioTrack PCM16 16kHz: $minimum" }
        val track = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(AudioFormat.Builder()
                .setSampleRate(RATE)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setTransferMode(AudioTrack.MODE_STREAM) // playback immediately, as PCM arrives
            .setBufferSizeInBytes(maxOf(minimum, 12_800))
            .build()
        check(track.state == AudioTrack.STATE_INITIALIZED) { "Streaming AudioTrack initialization failed" }
        return track
    }

    private fun runSound() {
        var track: AudioTrack? = null
        var playingTurn = 0
        var writtenSamples = 0L
        try {
            while (!closed) {
                when (val packet = soundQueue.take()) {
                    is Packet.Chunk -> {
                        if (!live(packet.turn)) continue
                        if (playingTurn != packet.turn) {
                            track?.let { runCatching { it.stop() }; it.release() }
                            track = makeTrack()
                            outputTrack = track
                            playingTurn = packet.turn
                            writtenSamples = 0L
                            track.play()
                            Log.i(TAG, "LIVE_AUDIO_START turn=${packet.turn}")
                        }
                        var offset = 0
                        while (offset < packet.bytes.size && live(packet.turn)) {
                            // AudioTrack naturally blocks only if its small HW stream
                            // buffer is full. It never waits for SDK video rendering.
                            val written = track!!.write(
                                packet.bytes, offset, packet.bytes.size - offset,
                                AudioTrack.WRITE_BLOCKING
                            )
                            check(written > 0) { "AudioTrack.write=$written turn=${packet.turn}" }
                            offset += written
                            writtenSamples += written / 2
                        }
                    }
                    is Packet.End -> {
                        if (packet.turn != playingTurn || !live(packet.turn)) continue
                        // Only finish/release the *audio* worker after hardware consumes
                        // its tail. No delay is imposed on first audio or first video.
                        val endMs = System.currentTimeMillis() +
                            writtenSamples * 1000L / RATE + 5_000L
                        while (live(packet.turn) && System.currentTimeMillis() < endMs) {
                            if ((track?.playbackHeadPosition?.toLong() ?: 0L) >= writtenSamples) break
                            Thread.sleep(20)
                        }
                        Log.i(TAG, "LIVE_AUDIO_DONE turn=${packet.turn} samples=$writtenSamples")
                        track?.let { runCatching { it.stop() }; it.release() }
                        track = null
                        outputTrack = null
                        playingTurn = 0
                    }
                    Packet.Shutdown -> return
                }
            }
        } catch (interrupted: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (failure: Throwable) {
            Log.e(TAG, "LIVE_AUDIO_FAIL", failure)
        } finally {
            outputTrack = null
            track?.let { runCatching { it.stop() }; it.release() }
        }
    }

    override fun newFrameBitmap(): Bitmap =
        Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    override fun feed(f16k: FloatArray) {
        error("Direct file mode only accepts PCM16 ByteArray via appendPcm16")
    }
    override fun flushTail() = endOfPcm()
    override fun reset() = cancelFile()
    override fun pull(dst: Bitmap): Long = -1L
    override val hasPendingTail: Boolean get() = !closed && sdkEndedTurn != currentTurn
    override val queuedFrames: Int get() = sdk.available()
    override val pendingAudioSlices: Int get() = -1
    override fun stats(): EngineStats? = null

    override fun close() {
        closed = true
        cancelFile()
        feedQueue.offer(Packet.Shutdown)
        soundQueue.offer(Packet.Shutdown)
        feedWorker.shutdownNow()
        pullWorker.shutdownNow()
        soundWorker.shutdownNow()
        val feedStopped = await(feedWorker)
        val pullStopped = await(pullWorker)
        val soundStopped = await(soundWorker)
        if (feedStopped && pullStopped && soundStopped) sdk.close()
        else Log.e(TAG, "SDK left open: streaming worker is still within native SDK call")
    }

    private fun await(worker: java.util.concurrent.ExecutorService): Boolean =
        try { worker.awaitTermination(30, TimeUnit.SECONDS) }
        catch (e: InterruptedException) { Thread.currentThread().interrupt(); false }

    companion object {
        private const val TAG = "E2STREAM"
        private const val RATE = 16_000
    }
}
