package ai.bithuman.flutter

import ai.bithuman.essence2.Essence2Avatar
import android.graphics.Bitmap
import android.graphics.ColorSpace
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTimestamp
import android.media.AudioTrack
import android.os.Build
import android.os.Trace
import android.util.Log
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/** PCM feeds the SDK and AudioTrack independently. The hardware clock controls the view. */
internal class OfficialEssence2FileEngine(
    private val sdk: Essence2Avatar,
    val voiceSync: Boolean,
    private val skipAhead: Boolean,
) : AvatarEngine {
    override val name = "essence2-official-pcm16-live"
    override val width: Int get() = sdk.width
    override val height: Int get() = sdk.height
    override val fps: Int = 25
    override val idle: IdleClip? = null
    // Exact original Essence2Engine zero-copy output contract.
    override val hardwareFrames: Boolean =
        runCatching { sdk.useHardwareBuffers(HW_SLOTS) }
            .onFailure { Log.e(TAG, "GPU_INIT_FAILED original SDK rejected hardware buffers", it)
                HitelE2Trace.failure("gpu.init.failure", it) }
            .isSuccess
    private val srgb = ColorSpace.get(ColorSpace.Named.SRGB)

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

    private val clockWorker = Executors.newSingleThreadScheduledExecutor { work ->
        Thread(work, "e2-audio-clock").apply { isDaemon = true }
    }
    private val trackLock = Any()
    private val sdkClockLock = Any()
    @Volatile private var audioPosition: VoiceAudioPosition? = null
    private val presenter = if (voiceSync) HitelVoiceSync({ currentTurn }, { audioPosition }) else null

    private val counter = AtomicInteger()
    @Volatile private var currentTurn = 0
    @Volatile private var sdkStartedTurn = 0
    @Volatile private var sdkEndedTurn = 0
    @Volatile private var acceptedSamples = 0L
    @Volatile private var renderedFrames = 0L
    @Volatile private var closed = false
    @Volatile private var renderer: ((Bitmap, HwFrame?) -> Unit)? = null
    @Volatile private var outputTrack: AudioTrack? = null
    private var receiving = false
    private var sdkEverFed = false

    init {
        Log.i(TAG, "GPU_DELIVERY mode=" + (if (hardwareFrames) "HARDWARE_BUFFER" else "CPU_FALLBACK"))
        HitelE2Trace.event("gpu.route", "hardwareBuffers" to hardwareFrames,
            "renderPath" to (if (hardwareFrames) "pullHardwareBuffer" else "pullByteBuffer"),
            "width" to width, "height" to height)
        feedWorker.execute { runFeed() }
        pullWorker.execute { runPull() }
        soundWorker.execute { runSound() }
    }

    /** GPU callback owns HwFrame; CPU fallback callback recycles Bitmap. */
    fun attachRenderer(callback: (Bitmap, HwFrame?) -> Unit) {
        renderer = callback
    }

    fun attachSyncRenderer(draw: (Bitmap) -> Boolean) {
        checkNotNull(presenter).attach(draw)
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
        if (first) {
            HitelSdkProbe.setTurn(turn)
            presenter?.begin(turn)
        }
        HitelSdkProbe.input(turn, (bytes.size / 2).toLong())
        // Two independent consumers. The incoming ByteArray is not retained by Dart.
        val copy = bytes.copyOf()
        feedQueue.offer(Packet.Chunk(turn, copy))
        soundQueue.offer(Packet.Chunk(turn, copy))
        HitelE2Trace.event("pcm.received", "turn" to turn, "bytes" to bytes.size,
            "acceptedSamples" to acceptedSamples, "first" to first,
            "feedQueue" to feedQueue.size, "soundQueue" to soundQueue.size)
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
        HitelE2Trace.event("pcm.input.end", "turn" to turn, "acceptedSamples" to acceptedSamples,
            "feedQueue" to feedQueue.size, "soundQueue" to soundQueue.size)
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
        presenter?.begin(currentTurn)
        synchronized(trackLock) {
            outputTrack?.let { track -> runCatching { track.pause(); track.flush() } }
            audioPosition = null
        }
        HitelE2Trace.event("stream.cancel", "turn" to currentTurn)
        Log.i(TAG, "LIVE_CANCEL turn=$currentTurn")
    }

    private fun live(turn: Int) = !closed && turn == currentTurn

    private inline fun <T> traceSdk(section: String, call: () -> T): T =
        HitelE2Trace.section(section, call)

    private fun runFeed() {
        var loadedTurn = 0
        var sdkFeedCount = 0
        try {
            while (!closed) {
                when (val packet = feedQueue.take()) {
                    is Packet.Chunk -> {
                        if (!live(packet.turn)) continue
                        if (loadedTurn != packet.turn) {
                            synchronized(sdkClockLock) { sdkStartedTurn = 0 }
                            if (sdkEverFed) sdk.resetAudio(startFrame = 0)
                            sdkEverFed = true
                            loadedTurn = packet.turn
                            sdkEndedTurn = 0
                        }
                        if (!live(packet.turn)) continue
                        val feedStart = System.nanoTime()
                        HitelE2Trace.event("sdk.feed.begin", "turn" to packet.turn,
                            "bytes" to packet.bytes.size, "queuedChunks" to feedQueue.size)
                        HitelSdkProbe.inTurn(packet.turn) { traceSdk("HITEL.e2.feed") { sdk.feed(packet.bytes) } }
                        HitelSdkProbe.fed(packet.turn, (packet.bytes.size / 2).toLong())
                        if (sdkStartedTurn != packet.turn) {
                            synchronized(sdkClockLock) {
                                if (live(packet.turn)) sdkStartedTurn = packet.turn
                            }
                        }
                        val feedMs = (System.nanoTime() - feedStart) / 1_000_000
                        Log.i(TAG, "LIVE_FEED turn=${packet.turn} pcm16Bytes=${packet.bytes.size} feedMs=$feedMs")
                        HitelE2Trace.event("sdk.feed", "turn" to packet.turn,
                            "chunk" to ++sdkFeedCount, "bytes" to packet.bytes.size,
                            "feedMs" to feedMs, "queuedChunks" to feedQueue.size)
                    }
                    is Packet.End -> {
                        if (!live(packet.turn) || loadedTurn != packet.turn) continue
                        HitelE2Trace.event("sdk.end.begin", "turn" to packet.turn)
                        traceSdk("HITEL.e2.endOfAudio") { sdk.endOfAudio() }
                        HitelE2Trace.event("sdk.end.done", "turn" to packet.turn)
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
            HitelE2Trace.failure("sdk.feed.failure", failure, "turn" to currentTurn)
        }
    }

    private fun runPull() {
        try {
            val frame = if (hardwareFrames) null else sdk.newFrameBuffer()
            var observedTurn = 0
            var shownInTurn = 0L
            var lastFrameAt = System.nanoTime()
            var renderCheckedTurn = 0
            var waitReportedAt = System.nanoTime()
            var lastSdkIndex = -1L
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
                    lastSdkIndex = -1L
                }
                if (presenter?.full == true) {
                    Thread.sleep(2)
                    continue
                }
                // Restore original SDK GPU frame ownership; do not read back pixels.
                if (!hardwareFrames) frame!!.clear()
                if (Trace.isEnabled()) Trace.setCounter("HITEL.e2.motionReady", sdk.available().toLong())
                val pullThreadCpuStarted = android.os.Debug.threadCpuTimeNanos()
                val pullStarted = System.nanoTime()
                val hw = if (hardwareFrames) {
                    traceSdk("HITEL.e2.pullHardwareBuffer") { sdk.pullHardwareBuffer() }
                } else null
                val ready = if (hardwareFrames) hw != null else traceSdk("HITEL.e2.pullBytes") { sdk.pull(frame!!) }
                val pullUs = (System.nanoTime() - pullStarted) / 1_000
                val pullThreadCpuUs = (android.os.Debug.threadCpuTimeNanos() - pullThreadCpuStarted) / 1_000
                val pullMillis = pullUs / 1_000
                val pullThreadCpuMs = pullThreadCpuUs / 1_000
                if (ready) {
                    if (!live(turn)) { hw?.close(); continue }
                    lastSdkIndex = sdk.lastFrameIndex
                    HitelSdkProbe.pulled(turn, lastSdkIndex)
                    val ordinal = if (lastSdkIndex >= 0) lastSdkIndex else shownInTurn
                    val pts = ordinal * (RATE / fps)
                    if (hardwareFrames) {
                        val owned = checkNotNull(hw)
                        val wrapped = Bitmap.wrapHardwareBuffer(owned.buffer, srgb)
                        if (wrapped == null) {
                            owned.close()
                            error("SDK hardware frame cannot be wrapped: GPU output failed")
                        }
                        val delivered = HwFrame(wrapped, pts, -1, owned)
                        if (presenter != null) presenter.offer(turn, ordinal, pts, wrapped, delivered)
                        else {
                            val callback = renderer
                            if (callback == null) delivered.release()
                            else try { callback(wrapped, delivered) }
                            catch (failure: Throwable) { delivered.release(); throw failure }
                        }
                    } else {
                        frame!!.rewind()
                        val pixels = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                        try {
                            pixels.copyPixelsFromBuffer(frame)
                            if (presenter != null) presenter.offer(turn, ordinal, pts, pixels, null)
                            else renderer?.invoke(pixels, null) ?: pixels.recycle()
                        } catch (failure: Throwable) {
                            pixels.recycle()
                            throw failure
                        }
                    }
                    val now = System.nanoTime()
                    val frameGapMs = (now - lastFrameAt) / 1_000_000
                    shownInTurn++
                    renderedFrames = shownInTurn
                    lastFrameAt = now
                    if (shownInTurn == 1L || shownInTurn % 25L == 0L)
                        Log.i(TAG, "LIVE_PULL turn=$turn frame=$shownInTurn route=" + (if (hardwareFrames) "GPU" else "CPU") + " pullMs=$pullMillis acceptedSamples=$acceptedSamples")
                    HitelE2Trace.event("video.pull", "turn" to turn, "frame" to shownInTurn,
                        "sdkFrameIndex" to lastSdkIndex, "gpuHardware" to hardwareFrames,
                        "pullMs" to pullMillis, "pullThreadCpuMs" to pullThreadCpuMs,
                        "pullUs" to pullUs, "pullThreadCpuUs" to pullThreadCpuUs,
                        "frameGapMs" to frameGapMs,
                        "playedSamples" to audioPosition?.takeIf { it.turn == turn }?.samples)
                } else {
                    val waitingAt = System.nanoTime()
                    if (waitingAt - waitReportedAt >= 1_000_000_000L) {
                        waitReportedAt = waitingAt
                        HitelE2Trace.event("video.wait", "turn" to turn,
                            "frames" to shownInTurn, "inputEnded" to (sdkEndedTurn == turn),
                            "quietMs" to (waitingAt - lastFrameAt) / 1_000_000,
                            "acceptedSamples" to acceptedSamples, "feedQueue" to feedQueue.size)
                    }
                    // This short empty-queue poll is the official SDK example's
                    // pull() polling, NOT a wait for a complete audio file.
                    if (sdkEndedTurn == turn) {
                        val approx = ((acceptedSamples * fps + RATE / 2) / RATE)
                        val quietMs = (System.nanoTime() - lastFrameAt) / 1_000_000
                        // With the original SDK skip-ahead clock enabled, displayed
                        // frame count can be below the expected nominal frame count.
                        val lastOrdinal = lastSdkIndex + 1L
                        if ((shownInTurn >= approx || lastOrdinal >= approx) &&
                            sdk.available() == 0 && quietMs > 2_000) {
                            val integrity = runCatching { sdk.checkRender() }
                            integrity.onFailure { HitelE2Trace.failure("sdk.checkRender.failure", it, "turn" to turn) }
                            renderCheckedTurn = turn
                            HitelE2Trace.event("video.finish", "turn" to turn,
                                "frames" to shownInTurn, "lastOrdinal" to lastOrdinal,
                                "expectedApprox" to approx, "integrityPassed" to integrity.isSuccess)
                            Log.i(TAG, "LIVE_RENDER_DONE turn=$turn frames=$shownInTurn expectedApprox=$approx lastOrdinal=$lastOrdinal integrityPassed=${integrity.isSuccess}")
                            HitelSdkProbe.finishTurn(turn)
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
            HitelE2Trace.failure("video.pull.failure", failure, "turn" to currentTurn)
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
        if (Build.VERSION.SDK_INT >= 31) {
            track.setStartThresholdInFrames(minOf(track.bufferSizeInFrames, RATE / 10))
        }
        HitelE2Trace.event("audio.track.created", "rate" to RATE,
            "minimumBufferBytes" to minimum, "bufferFrames" to track.bufferSizeInFrames,
            "sessionId" to track.audioSessionId, "state" to track.state)
        return track
    }

    private fun monitorAudio(track: AudioTrack, turn: Int): ScheduledFuture<*> {
        val timestamp = AudioTimestamp()
        var readAt = 0L
        var timestampValid = false
        var lastSamples = 0L
        var lastLogged = -1L
        return clockWorker.scheduleWithFixedDelay({
            try {
                val position = synchronized(trackLock) {
                    if (outputTrack !== track || !live(turn) || track.playState != AudioTrack.PLAYSTATE_PLAYING) {
                        return@scheduleWithFixedDelay
                    }
                    val now = System.nanoTime()
                    val head = Integer.toUnsignedLong(track.playbackHeadPosition).coerceAtMost(acceptedSamples)
                    if (now - readAt >= 250_000_000 || !timestampValid) {
                        readAt = now
                        timestampValid = track.getTimestamp(timestamp)
                    }
                    val audible = if (timestampValid) {
                        val elapsed = (now - timestamp.nanoTime).coerceAtLeast(0)
                        Integer.toUnsignedLong(timestamp.framePosition.toInt()) + elapsed * RATE / 1_000_000_000L
                    } else head
                    lastSamples = audible.coerceIn(lastSamples.coerceAtMost(head), head)
                    VoiceAudioPosition(turn, lastSamples, head, timestampValid, playing = true)
                        .also { audioPosition = it }
                }
                presenter?.audioAdvanced()
                if (skipAhead) synchronized(sdkClockLock) {
                    if (sdkStartedTurn == turn && live(turn)) {
                        val samples = if (voiceSync) position.samples else position.headSamples
                        traceSdk("HITEL.e2.setPlayoutPosition") { sdk.setPlayoutPosition(samples) }
                        if (samples / RATE != lastLogged) {
                            lastLogged = samples / RATE
                            HitelE2Trace.event("sdk.playout.clock", "turn" to turn,
                                "playedSamples" to samples, "headSamples" to position.headSamples)
                        }
                    }
                }
            } catch (failure: Exception) {
                HitelE2Trace.failure("sdk.playout.failure", failure, "turn" to turn)
            }
        }, 0, 20, TimeUnit.MILLISECONDS)
    }

    private fun releaseTrack(track: AudioTrack?) {
        if (track == null) return
        synchronized(trackLock) {
            if (outputTrack === track) outputTrack = null
            runCatching { track.stop() }
            track.release()
        }
    }

    private fun runSound() {
        var track: AudioTrack? = null
        var playingTurn = 0
        var writtenSamples = 0L
        var monitor: ScheduledFuture<*>? = null
        val pcmHash = MessageDigest.getInstance("SHA-256")
        runCatching { android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO) }
            .onFailure { Log.w(TAG, "Audio thread uses the default scheduler priority", it) }
        try {
            while (!closed) {
                when (val packet = soundQueue.take()) {
                    is Packet.Chunk -> {
                        if (!live(packet.turn)) continue
                        var firstAudio = false
                        if (playingTurn != packet.turn) {
                            monitor?.cancel(false)
                            monitor = null
                            releaseTrack(track)
                            track = makeTrack()
                            synchronized(trackLock) { outputTrack = track }
                            playingTurn = packet.turn
                            writtenSamples = 0L
                            pcmHash.reset()
                            firstAudio = true
                            if (presenter != null) {
                                val started = System.nanoTime()
                                while (live(packet.turn) && presenter.readyCount < 3 &&
                                    System.nanoTime() - started < 120_000_000L) {
                                    Thread.sleep(4)
                                }
                                HitelE2Trace.event("sync.preroll", "turn" to packet.turn,
                                    "ready" to presenter.readyCount,
                                    "waitMs" to (System.nanoTime() - started) / 1_000_000)
                            }
                        }
                        val writeStarted = System.nanoTime()
                        HitelE2Trace.event("audio.write.begin", "turn" to packet.turn,
                            "bytes" to packet.bytes.size, "queuedChunks" to soundQueue.size)
                        var offset = 0
                        while (offset < packet.bytes.size && live(packet.turn)) {
                            // The FIRST PCM bytes go to the hardware buffer BEFORE play().
                            // Starting an empty AudioTrack was causing an avoidable
                            // underrun at speech onset. Do not wait for another chunk.
                            val written = track!!.write(
                                packet.bytes, offset, packet.bytes.size - offset,
                                if (firstAudio) AudioTrack.WRITE_NON_BLOCKING
                                else AudioTrack.WRITE_BLOCKING
                            )
                            if (!live(packet.turn)) break
                            check(written >= 0) { "AudioTrack.write=$written turn=${packet.turn}" }
                            pcmHash.update(packet.bytes, offset, written)
                            offset += written
                            writtenSamples += written / 2
                            if (firstAudio) {
                                synchronized(trackLock) {
                                    if (live(packet.turn)) track.play()
                                }
                                firstAudio = false
                                if (!live(packet.turn)) break
                                monitor = monitorAudio(track, packet.turn)
                                HitelE2Trace.event("audio.start", "turn" to packet.turn,
                                    "route" to "AudioTrack.STREAM", "rate" to RATE,
                                    "firstWriteBytes" to written, "prefilled" to (written > 0))
                            } else if (written == 0) {
                                Thread.sleep(2)
                            }
                        }
                        HitelE2Trace.event("audio.write.done", "turn" to packet.turn,
                            "writtenBytes" to offset, "writtenSamples" to writtenSamples,
                            "playedSamples" to track?.playbackHeadPosition,
                            "writeMs" to (System.nanoTime() - writeStarted) / 1_000_000,
                            "underruns" to track?.underrunCount, "queuedChunks" to soundQueue.size)
                    }
                    is Packet.End -> {
                        if (packet.turn != playingTurn || !live(packet.turn)) continue
                        val activeTrack = checkNotNull(track)
                        if (Build.VERSION.SDK_INT >= 31 && writtenSamples in 1L until RATE / 10L) {
                            activeTrack.setStartThresholdInFrames(writtenSamples.toInt())
                        }
                        val underrunsBeforeTail = activeTrack.underrunCount
                        HitelE2Trace.event("audio.drain.begin", "turn" to packet.turn,
                            "writtenSamples" to writtenSamples, "playedSamples" to activeTrack.playbackHeadPosition)
                        val deadline = System.nanoTime() + writtenSamples * 1_000_000_000L / RATE + 5_000_000_000L
                        var headDoneAt = 0L
                        while (live(packet.turn) && System.nanoTime() < deadline) {
                            if (Integer.toUnsignedLong(activeTrack.playbackHeadPosition) >= writtenSamples) {
                                val now = System.nanoTime()
                                if (headDoneAt == 0L) headDoneAt = now
                                val audible = audioPosition?.takeIf { it.turn == packet.turn && it.timestamp }
                                if ((audible != null && audible.samples >= writtenSamples) ||
                                    now - headDoneAt >= 250_000_000L) break
                            }
                            Thread.sleep(10)
                        }
                        if (!live(packet.turn)) continue
                        val finalHead = Integer.toUnsignedLong(activeTrack.playbackHeadPosition).coerceAtMost(writtenSamples)
                        if (finalHead < writtenSamples) {
                            Log.e(TAG, "LIVE_AUDIO_INCOMPLETE turn=${packet.turn} headSamples=$finalHead writtenSamples=$writtenSamples")
                            HitelE2Trace.event("audio.incomplete", "turn" to packet.turn,
                                "playedSamples" to finalHead, "writtenSamples" to writtenSamples)
                        }
                        else
                            Log.i(TAG, "LIVE_AUDIO_DONE turn=${packet.turn} samples=$writtenSamples headSamples=$finalHead")
                        HitelSdkProbe.requestSnapshot(packet.turn)
                        HitelE2Trace.event("audio.finish", "turn" to packet.turn,
                            "playedSamples" to finalHead, "writtenSamples" to writtenSamples,
                            "pcm16Sha256" to pcmHash.digest().joinToString("") { "%02x".format(it.toInt() and 255) },
                            "complete" to (finalHead >= writtenSamples),
                            "underruns" to underrunsBeforeTail, "underrunsIncludingTail" to activeTrack.underrunCount)
                        monitor?.cancel(false)
                        monitor = null
                        releaseTrack(track)
                        track = null
                        if (live(packet.turn)) {
                            audioPosition = VoiceAudioPosition(packet.turn, finalHead, finalHead,
                                timestamp = false, playing = false)
                            presenter?.audioAdvanced()
                        }
                        playingTurn = 0
                    }
                    Packet.Shutdown -> return
                }
            }
        } catch (interrupted: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (failure: Throwable) {
            Log.e(TAG, "LIVE_AUDIO_FAIL", failure)
            HitelE2Trace.failure("audio.failure", failure, "turn" to playingTurn,
                "writtenSamples" to writtenSamples, "playedSamples" to track?.playbackHeadPosition)
        } finally {
            monitor?.cancel(false)
            releaseTrack(track)
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
        HitelE2Trace.event("stream.close.begin", "turn" to currentTurn)
        closed = true
        cancelFile()
        feedQueue.offer(Packet.Shutdown)
        soundQueue.offer(Packet.Shutdown)
        feedWorker.shutdownNow()
        pullWorker.shutdownNow()
        soundWorker.shutdownNow()
        clockWorker.shutdownNow()
        val feedStopped = await(feedWorker)
        val pullStopped = await(pullWorker)
        val soundStopped = await(soundWorker)
        val clockStopped = await(clockWorker)
        presenter?.close()
        if (feedStopped && pullStopped && soundStopped && clockStopped) sdk.close()
        else Log.e(TAG, "SDK left open: streaming worker is still within native SDK call")
    }

    private fun await(worker: java.util.concurrent.ExecutorService): Boolean =
        try { worker.awaitTermination(30, TimeUnit.SECONDS) }
        catch (e: InterruptedException) { Thread.currentThread().interrupt(); false }

    companion object {
        private const val TAG = "E2STREAM"
        private const val RATE = 16_000
        private const val HW_SLOTS = 32
    }
}
