package ai.bithuman.flutter

import ai.bithuman.essence2.Essence2Avatar
import android.graphics.Bitmap
import android.graphics.ColorSpace
import android.os.SystemClock
import android.util.Log
import com.cloudwebrtc.webrtc.HitelAvatarMediaBus
import java.io.InputStream
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/** Owns SDK input and frame extraction. Both outputs terminate at the WebRTC sender. */
internal class OfficialEssence2FileEngine(private val sdk: Essence2Avatar) : AvatarEngine {
    override val name = "essence2-rtc-pcm"
    override val width get() = sdk.width
    override val height get() = sdk.height
    override val fps = 25
    override val idle: IdleClip? = null
    override val hardwareFrames = runCatching { sdk.useHardwareBuffers(32) }.isSuccess
    private val srgb = ColorSpace.get(ColorSpace.Named.SRGB)
    private class Chunk(val turn: Long, val bytes: ByteArray?)
    private val input = LinkedBlockingQueue<Chunk>()
    private val state = Object()
    private val feed = Executors.newSingleThreadExecutor { Thread(it, "e2-rtc-feed") }
    private val pull = Executors.newSingleThreadExecutor { Thread(it, "e2-rtc-pull") }
    private val source = Executors.newSingleThreadExecutor { Thread(it, "e2-rtc-pcm") }
    @Volatile private var turn = 0L
    @Volatile private var started = 0L
    @Volatile private var ended = 0L
    @Volatile private var total = 0L
    @Volatile private var closed = false
    private var receiving = false
    private var fileGeneration = 0L
    private val sdkClock = Any()

    init {
        feed.execute { runFeed() }
        pull.execute { runPull() }
    }

    /** A new request supersedes the previous fixture, including its queued PCM and video. */
    fun playPcm(open: () -> InputStream) {
        val generation = synchronized(state) {
            check(!closed)
            cancelLocked()
            fileGeneration
        }
        source.execute {
            try {
                open().buffered().use { stream ->
                    val buffer = ByteArray(3200)
                    while (true) {
                        var size = 0
                        while (size < buffer.size) {
                            val n = stream.read(buffer, size, buffer.size-size)
                            if (n < 0) break
                            size += n
                        }
                        synchronized(state) {
                            if (closed || generation != fileGeneration) return@execute
                            if (size == 0) { endOfPcm(); return@execute }
                            push(buffer.copyOf(size))
                        }
                    }
                }
            } catch (e: Exception) {
                synchronized(state) { if (generation == fileGeneration) cancelLocked() }
                Log.e(TAG, "RTC_PCM_SOURCE_ERROR", e)
            }
        }
    }

    fun appendPcm16(bytes: ByteArray) = synchronized(state) {
        if (bytes.isNotEmpty() && !closed) push(bytes.copyOf())
    }

    private fun push(bytes: ByteArray) {
        require(bytes.size % 2 == 0)
        if (!receiving) {
            turn = generations.incrementAndGet()
            check(HitelAvatarMediaBus.begin(turn)) { "RTC capture unavailable" }
            input.clear()
            total = 0
            receiving = true
        }
        if (!HitelAvatarMediaBus.append(turn, bytes)) { cancelLocked(); return }
        total += bytes.size/2
        input.add(Chunk(turn, bytes))
    }

    fun endOfPcm() = synchronized(state) {
        if (receiving) {
            receiving = false
            HitelAvatarMediaBus.end(turn,total)
            input.add(Chunk(turn, null))
        }
    }
    fun cancelFile() = synchronized(state) { cancelLocked() }
    private fun cancelLocked() {
        HitelAvatarMediaBus.cancel(turn)
        turn = 0
        receiving = false
        fileGeneration++
        input.clear()
        state.notifyAll()
    }

    private fun runFeed() {
        var generation = 0L
        try {
            while (!closed) {
                val packet = input.take()
                if (packet.turn != turn) continue
                if (generation != packet.turn) {
                    synchronized(sdkClock) {
                        started = 0
                        if (generation != 0L) sdk.resetAudio(startFrame = 0)
                        generation = packet.turn
                    }
                }
                if (packet.bytes == null) {
                    sdk.endOfAudio()
                    ended = generation
                } else {
                    sdk.feed(packet.bytes)
                    if (started != generation) synchronized(state) {
                        started = generation
                        state.notifyAll()
                    }
                }
            }
        } catch (_: InterruptedException) { Thread.currentThread().interrupt() }
        catch (e: Exception) { Log.e(TAG, "RTC_FEED_ERROR", e) }
    }

    private fun runPull() {
        val buffer = if (hardwareFrames) null else sdk.newFrameBuffer()
        var finished = 0L
        var observed = 0L
        var lastClock = -1L
        var count = 0
        var lastOrdinal = -1L
        var lastFrameMs = 0L
        try {
            while (!closed) {
                val generation = synchronized(state) {
                    while (!closed && (turn == 0L || started != turn || finished == turn)) state.wait()
                    if (closed) return
                    turn
                }
                if (observed != generation) {
                    observed = generation
                    lastClock = -1
                    count = 0
                    lastOrdinal = -1
                    lastFrameMs = SystemClock.elapsedRealtime()
                }
                val position = HitelAvatarMediaBus.consumed(generation)
                if (position < 0) { finished = generation; continue }
                val clock = position.coerceAtMost((total-640).coerceAtLeast(0))
                if (clock > lastClock) synchronized(sdkClock) {
                    if (started == generation && turn == generation) {
                        sdk.setPlayoutPosition(clock)
                        lastClock = clock
                    }
                }
                val before = SystemClock.elapsedRealtimeNanos()
                val hw = if (hardwareFrames) sdk.pullHardwareBuffer() else null
                buffer?.clear()
                val ready = if (hardwareFrames) hw != null else sdk.pull(buffer!!)
                val elapsed = SystemClock.elapsedRealtimeNanos() - before
                if (!ready) {
                    val complete = ended == generation && position >= total && sdk.available() == 0
                    val quiet = SystemClock.elapsedRealtime() - lastFrameMs
                    if (complete && ((lastOrdinal+1)*640 >= total-320 || quiet > 30000)) finished = generation
                    else Thread.sleep(4)
                    continue
                }
                if (turn != generation) { hw?.close(); continue }
                lastOrdinal = sdk.lastFrameIndex
                lastFrameMs = SystemClock.elapsedRealtime()
                if (hw != null) {
                    val bitmap = Bitmap.wrapHardwareBuffer(hw.buffer, srgb)
                    if (bitmap == null) { hw.close(); continue }
                    HitelAvatarMediaBus.frame(generation, bitmap, Runnable { hw.close() })
                } else {
                    buffer!!.rewind()
                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    bitmap.copyPixelsFromBuffer(buffer)
                    HitelAvatarMediaBus.frame(generation, bitmap, Runnable { bitmap.recycle() })
                }
                if (count++ % 25 == 0) HitelE2Trace.event("video.pull", "turn" to generation,
                    "sdkFrameIndex" to sdk.lastFrameIndex, "pullUs" to elapsed/1000,
                    "playedSamples" to position, "gpuHardware" to hardwareFrames)
            }
        } catch (_: InterruptedException) { Thread.currentThread().interrupt() }
        catch (e: Exception) { Log.e(TAG, "RTC_PULL_ERROR", e) }
    }

    override fun newFrameBitmap() = Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888)
    override fun feed(f16k: FloatArray) { error("Use PCM16 input") }
    override fun flushTail() = endOfPcm()
    override fun reset() = cancelFile()
    override fun pull(dst: Bitmap) = -1L
    override val hasPendingTail get() = turn != 0L && ended != turn
    override val queuedFrames get() = sdk.available()
    override val pendingAudioSlices = -1
    override fun stats(): EngineStats? = null
    override fun close() {
        synchronized(state) { closed = true; cancelLocked() }
        source.shutdownNow(); feed.shutdownNow(); pull.shutdownNow()
        // Native calls can finish asynchronously. Never free SDK memory while they are active.
        Thread({
            for (executor in listOf(feed,pull,source)) {
                while (!executor.awaitTermination(30, TimeUnit.SECONDS)) Log.w(TAG, "waiting for SDK shutdown")
            }
            sdk.close()
        }, "e2-rtc-close").start()
    }
    companion object {
        private const val TAG = "E2STREAM"
        private val generations = AtomicLong()
    }
}
