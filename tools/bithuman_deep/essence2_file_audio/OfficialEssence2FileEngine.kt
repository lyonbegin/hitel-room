package ai.bithuman.flutter

import ai.bithuman.essence2.Essence2Avatar
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Official Essence2 Android example path, with no AvatarPlayer synchronization:
 * receive PCM16 LE @ 16000 Hz -> one SDK feed(byte[]) -> endOfAudio()
 * -> pull(ByteBuffer) until complete -> checkRender()
 * -> play the original PCM using the SDK example's AudioTrack playback-head clock.
 *
 * One worker owns every SDK call. Finished frames are spooled to cache instead of
 * keeping ~1,450 1080p JPEG frames in RAM for a minute-long recording.
 * This is deliberately PRE-RENDERED playback, not low-latency streaming.
 */
internal class OfficialEssence2FileEngine(
    private val sdk: Essence2Avatar,
    private val cacheRoot: File,
) : AvatarEngine {
    override val name = "essence2-official-pcm16-file"
    override val width: Int get() = sdk.width
    override val height: Int get() = sdk.height
    override val fps = 25
    override val idle: IdleClip? = null

    private val guard = Any()
    private val pending = ByteArrayOutputStream()
    private val worker = Executors.newSingleThreadExecutor { task ->
        Thread(task, "e2-official-file").apply { isDaemon = true }
    }
    private var generation = 0
    private var previouslyFed = false
    @Volatile private var closed = false

    fun appendPcm16(bytes: ByteArray) {
        require(bytes.size % 2 == 0) { "PCM16 must have an even byte count" }
        synchronized(guard) {
            check(!closed) { "Essence2 engine has closed" }
            pending.write(bytes)
        }
    }

    /** Called ONLY after Dart reports the LAST converted PCM chunk. */
    fun endOfPcm(draw: (Bitmap) -> Unit) {
        val turn: Int
        val speech: ByteArray
        synchronized(guard) {
            check(!closed) { "Essence2 engine has closed" }
            speech = pending.toByteArray()
            pending.reset()
            turn = ++generation
        }
        if (speech.isEmpty()) return
        worker.execute {
            try {
                renderThenPlay(speech, turn, draw)
            } catch (interrupted: InterruptedException) {
                Thread.currentThread().interrupt()
            } catch (error: Throwable) {
                Log.e(TAG, "OFFICIAL_FAIL turn=$turn pcmBytes=${speech.size}", error)
            }
        }
    }

    private fun active(turn: Int): Boolean =
        !closed && synchronized(guard) { generation == turn }

    /** Cancellation only discards work; it never calls the SDK concurrently with the worker. */
    fun cancelFile() {
        synchronized(guard) {
            generation++
            pending.reset()
        }
    }

    private fun renderThenPlay(pcm: ByteArray, turn: Int, draw: (Bitmap) -> Unit) {
        if (!active(turn)) return
        val samples = pcm.size / 2
        val expected = ((samples.toLong() * fps + RATE / 2) / RATE).toInt()
        cacheRoot.mkdirs()
        val directory = File(cacheRoot, "turn-${turn}-${System.nanoTime()}")
        check(directory.mkdirs()) { "Unable to create frame cache directory" }
        val frames = ArrayList<File>(expected + 16)
        try {
            // SDK call sequence is identical to bitHuman android/essence2-hello.
            if (previouslyFed) sdk.resetAudio(startFrame = 0)
            previouslyFed = true
            val frame = sdk.newFrameBuffer()
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val output = ByteArrayOutputStream(256 * 1024)
            val t0 = System.nanoTime()
            Log.i(TAG, "OFFICIAL_FEED turn=$turn pcm16Bytes=${pcm.size} samples=$samples expected=$expected")
            try {
                sdk.feed(pcm)                    // EXACT official PCM16 LE ByteArray overload
                sdk.endOfAudio()                 // EXACT official end marker
                var lastFrameNs = System.nanoTime()
                while (active(turn)) {
                    frame.clear()
                    if (sdk.pull(frame)) {       // EXACT official ByteBuffer pull
                        if (frames.isEmpty()) Log.i(TAG,
                            "OFFICIAL_FIRST_FRAME turn=$turn elapsedMs=${(System.nanoTime() - t0) / 1_000_000}")
                        lastFrameNs = System.nanoTime()
                        frame.rewind()
                        bitmap.copyPixelsFromBuffer(frame)
                        output.reset()
                        check(bitmap.compress(Bitmap.CompressFormat.JPEG, 88, output)) {
                            "JPEG encode returned false"
                        }
                        val item = File(directory, "frame-${frames.size.toString().padStart(5, '0')}.jpg")
                        item.writeBytes(output.toByteArray())
                        frames.add(item)
                        if (frames.size % 25 == 0) Log.i(TAG,
                            "OFFICIAL_RENDER turn=$turn frames=${frames.size}/$expected " +
                            "elapsedMs=${(System.nanoTime() - t0) / 1_000_000}")
                    } else {
                        if (frames.size >= expected && sdk.available() == 0) break
                        val quietLimitMs = if (frames.isEmpty()) 30_000L else 5_000L
                        if ((System.nanoTime() - lastFrameNs) / 1_000_000 >= quietLimitMs) break
                        Thread.sleep(10)           // EXACT official polling interval
                    }
                }
                if (!active(turn)) return
                sdk.checkRender()                   // EXACT official render-error check
            } finally {
                bitmap.recycle()
            }
            check(frames.isNotEmpty()) { "Essence2 returned zero frames" }
            Log.i(TAG, "OFFICIAL_FRAMES_DONE turn=$turn frames=${frames.size}/$expected " +
                "elapsedMs=${(System.nanoTime() - t0) / 1_000_000}")
            playLikeOfficialExample(pcm, frames, turn, draw)
        } finally {
            frames.forEach { runCatching { it.delete() } }
            runCatching { directory.delete() }
        }
    }

    private fun playLikeOfficialExample(
        pcm: ByteArray, frames: List<File>, turn: Int, draw: (Bitmap) -> Unit
    ) {
        if (!active(turn)) return
        val track = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(RATE)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setTransferMode(AudioTrack.MODE_STATIC)
            .setBufferSizeInBytes(pcm.size)
            .build()
        val options = BitmapFactory.Options().apply { inSampleSize = 2 }
        try {
            var written = 0
            while (written < pcm.size && active(turn)) {
                val n = track.write(pcm, written, pcm.size - written)
                check(n > 0) { "AudioTrack.write returned $n at $written/${pcm.size}" }
                written += n
            }
            if (!active(turn)) return
            track.play()
            Log.i(TAG, "OFFICIAL_PLAY turn=$turn samples=${pcm.size / 2} frames=${frames.size}")
            var shown = -1
            val deadline = System.currentTimeMillis() + pcm.size * 1000L / 2 / RATE + 3_000L
            while (active(turn)) {
                val head = track.playbackHeadPosition
                val index = head / (RATE / fps)
                if (index < frames.size && index != shown) {
                    shown = index
                    val bitmap = BitmapFactory.decodeFile(frames[index].absolutePath, options)
                    if (bitmap != null) {
                        try { draw(bitmap) } finally { bitmap.recycle() }
                    }
                }
                if (head >= pcm.size / 2 || index >= frames.size) break
                if (System.currentTimeMillis() > deadline) break
                Thread.sleep(5) // Same audio-head polling interval as official sample
            }
            Log.i(TAG, "OFFICIAL_PLAY_DONE turn=$turn lastFrame=$shown")
        } finally {
            runCatching { track.stop() }
            track.release()
        }
    }

    override fun newFrameBitmap(): Bitmap =
        Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    override fun feed(f16k: FloatArray) {
        error("Official file mode only accepts PCM16 ByteArray through appendPcm16()")
    }
    override fun flushTail() = Unit
    override fun reset() = cancelFile()
    override fun pull(dst: Bitmap): Long = -1L
    override val hasPendingTail get() = false
    override val queuedFrames: Int get() = sdk.available()
    override val pendingAudioSlices get() = -1
    override fun stats(): EngineStats? = null

    override fun close() {
        closed = true
        cancelFile()
        worker.shutdownNow()
        val terminated = try { worker.awaitTermination(60, TimeUnit.SECONDS) }
                         catch (e: InterruptedException) { Thread.currentThread().interrupt(); false }
        if (terminated) sdk.close()
        else Log.e(TAG, "SDK left open: official renderer is still in a native call")
    }

    companion object {
        private const val TAG = "E2OFFICIAL"
        private const val RATE = 16_000
    }
}
