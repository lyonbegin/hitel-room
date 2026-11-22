package ai.bithuman.flutter

import ai.bithuman.elevate.Essence2Avatar
import java.nio.ByteBuffer
import java.util.concurrent.TimeUnit

/**
 * Maker's android/essence2-hello MainActivity.renderOnce, adapted only to an
 * already loaded engine and cancellation. A false pull is NOT end-of-utterance:
 * the original polls for more frames and calls checkRender before playback.
 */
internal object Essence2VendorRender {
    fun render(avatar: Essence2Avatar, startFrame: Int, pcm: ByteArray,
               active: () -> Boolean, onFrame: (ByteBuffer, Long) -> Unit) {
        if (!active()) return
        val resetAt = System.nanoTime()
        HitelE2Trace.event("sdk.resetAudio.begin", "cursor" to startFrame)
        avatar.resetAudio(startFrame = startFrame)
        HitelE2Trace.event("sdk.resetAudio.end", "durationUs" to (System.nanoTime()-resetAt)/1000)
        if (!active()) return
        val frame = avatar.newFrameBuffer()
        val expected = Math.round(pcm.size / 32000.0 * 25).toInt()
        val feedAt = System.nanoTime()
        HitelE2Trace.event("player.feed.call", "samples16k" to pcm.size/2)
        HitelE2Trace.event("sdk.feed.begin", "samples16k" to pcm.size/2)
        avatar.feed(pcm)
        val feedUs = (System.nanoTime()-feedAt)/1000
        HitelE2Trace.event("sdk.feed.end", "durationUs" to feedUs, "sdkQueued" to avatar.available())
        HitelE2Trace.event("player.feed.return", "durationUs" to feedUs)
        val endAt = System.nanoTime()
        avatar.endOfAudio()
        HitelE2Trace.event("sdk.endOfAudio.end", "durationUs" to (System.nanoTime()-endAt)/1000)
        var count = 0
        var lastFrameAtNs = System.nanoTime()
        // There is NO fixed preparation delay: the entire utterance has already
        // been fed and ended. Start playback as soon as all expected SDK frames
        // have arrived and the SDK's ready queue has been drained.
        while (active()) {
            frame.clear()
            val pullAt = System.nanoTime()
            val got = avatar.pull(frame)
            if (got) {
                lastFrameAtNs = System.nanoTime()
                // Native 0.9.5 names the frame's own ordinal; never compact a missing frame.
                val ordinal = avatar.lastFrameIndex
                val at = if (ordinal >= 0) ordinal * 640L else count * 640L
                HitelE2Trace.event("sdk.pull.result", "frame" to true, "ordinal" to ordinal,
                    "durationUs" to (System.nanoTime()-pullAt)/1000, "sdkAvailable" to avatar.available())
                frame.rewind()
                onFrame(frame, at)
                count++
                continue
            }
            val available = avatar.available()
            if (count >= expected && available == 0) {
                HitelE2Trace.event("sdk.render.ready", "frames" to count, "expected" to expected,
                    "sdkAvailable" to available, "reason" to "expected_frames_and_empty_queue")
                break
            }
            // Watchdog is FAILURE detection only, never a minimum wait.
            // A slow device with ongoing frame output may take arbitrarily long.
            val stalledMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - lastFrameAtNs)
            if (stalledMs >= if (count == 0) 180000L else 120000L) {
                HitelE2Trace.event("sdk.render.stalled", "frames" to count, "expected" to expected,
                    "sdkAvailable" to available, "noProgressMs" to stalledMs)
                error("Essence2 renderer stalled: frames=$count expected=$expected available=$available")
            }
            Thread.sleep(10)
        }
        if (!active()) return
        avatar.checkRender()
        check(count > 0) { "Vendor renderer returned no speech frames" }
        HitelE2Trace.event("sdk.render.complete", "frames" to count, "expected" to expected,
            "sdkAvailable" to avatar.available())
    }
}
