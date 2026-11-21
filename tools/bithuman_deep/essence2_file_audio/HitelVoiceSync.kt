package ai.bithuman.flutter

import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import java.util.ArrayDeque

/** Owned frames in SDK ordinal order. Each frame is disposed or passed to the display once. */
internal class VoiceFrameQueue<T>(
    private val capacity: Int,
    private val release: (T, String) -> Unit,
) {
    private data class Item<T>(val at: Long, val until: Long, val frame: T)
    private val frames = ArrayDeque<Item<T>>()
    val size: Int get() = frames.size
    val full: Boolean get() = size >= capacity
    val hasOpeningFrame: Boolean get() = frames.peekFirst()?.at == 0L

    fun offer(at: Long, until: Long, frame: T) {
        if (full) release(frame, "queue_full") else frames.addLast(Item(at, until, frame))
    }

    fun takeDue(samples: Long): T? {
        var newest: Item<T>? = null
        while (frames.peekFirst()?.let { it.at <= samples } == true) {
            val item = frames.removeFirst()
            if (samples >= item.until + HitelPcmTimeline.HOP) {
                release(item.frame, "audio_passed_window")
                continue
            }
            newest?.let { release(it.frame, "newer_due") }
            newest = item
        }
        return newest?.frame
    }

    fun clear(reason: String) {
        while (frames.isNotEmpty()) release(frames.removeFirst().frame, reason)
    }
}

internal data class VoiceAudioPosition(
    val turn: Int,
    val samples: Long,
    val headSamples: Long,
    val timestamp: Boolean,
    val playing: Boolean,
    val observedNs: Long = 0,
) {
    fun at(nowNs: Long): Long =
        if (!playing || !timestamp || observedNs == 0L || samples < 0L) samples
        else HitelPcmTimeline.sampleAt(samples, observedNs, nowNs, headSamples)
}

internal class HitelVoiceSync(
    private val currentTurn: () -> Int,
    private val audioPosition: () -> VoiceAudioPosition?,
) {
    private class Frame(val bitmap: Bitmap, val hw: HwFrame?, val ordinal: Long,
                        val window: HitelPcmTimeline.Window) {
        fun release() {
            if (hw == null) bitmap.recycle() else hw.release()
        }
    }

    private val main = Handler(Looper.getMainLooper())
    private val lock = Any()
    private val shownHardware = ArrayDeque<HwFrame>()
    private var discarded = 0L
    private val ready = VoiceFrameQueue<Frame>(6, ::discard)
    private var turn = 0
    private var framePending = false
    private var closed = false
    private var shown = 0L
    private var lastOrdinal = -1L
    private var draw: ((Bitmap) -> Boolean)? = null

    val readyCount: Int get() = synchronized(lock) { ready.size }
    val full: Boolean get() = synchronized(lock) { ready.full }
    val hasOpeningFrame: Boolean get() = synchronized(lock) { ready.hasOpeningFrame }

    fun attach(draw: (Bitmap) -> Boolean) {
        synchronized(lock) {
            if (!closed) this.draw = draw
        }
    }

    fun begin(next: Int) {
        synchronized(lock) {
            if (closed || next != currentTurn()) return
            ready.clear("turn_changed")
            turn = next
            discarded = 0
            shown = 0
            lastOrdinal = -1
        }
    }

    fun offer(turn: Int, ordinal: Long, window: HitelPcmTimeline.Window, bitmap: Bitmap, hw: HwFrame?) {
        synchronized(lock) {
            val frame = Frame(bitmap, hw, ordinal, window)
            val clock = audioPosition()
            if (closed || turn != this.turn || turn != currentTurn()) {
                frame.release()
                return
            }
            if (clock?.turn == turn && !clock.playing) {
                discard(frame, "after_audio_end")
                return
            }
            ready.offer(window.start, window.endExclusive, frame)
            schedule()
        }
    }

    private fun discard(frame: Frame, reason: String) {
        frame.release()
        discarded++
        val audio = audioPosition()?.takeIf { it.turn == turn }?.at(System.nanoTime())
        HitelE2Trace.event("sync.drop", "turn" to turn, "sdkFrameIndex" to frame.ordinal,
            "firstSample" to frame.window.start, "endSample" to frame.window.endExclusive,
            "audioSamples" to audio, "reason" to reason)
    }

    fun audioAdvanced() {
        synchronized(lock) {
            if (!closed && (ready.size > 0 || audioPosition()?.playing == false)) schedule()
        }
    }

    private fun schedule() {
        if (framePending || draw == null) return
        framePending = true
        main.post {
            Choreographer.getInstance().postFrameCallback(::present)
        }
    }

    private fun present(vsyncNs: Long) {
        synchronized(lock) {
            framePending = false
            val clock = audioPosition() ?: return
            if (closed || clock.turn != turn || turn != currentTurn()) return
            val position = clock.at(System.nanoTime())
            val frame = ready.takeDue(if (clock.playing) position else position - 1)
            if (frame != null) {
                if (draw?.invoke(frame.bitmap) == true) {
                    shown++
                    val ordinalGap = (frame.ordinal - lastOrdinal - 1).coerceAtLeast(0)
                    lastOrdinal = frame.ordinal
                    if (frame.hw == null) frame.release()
                    else {
                        shownHardware.addLast(frame.hw)
                        if (shownHardware.size > 4) shownHardware.removeFirst().release()
                    }
                    HitelE2Trace.event("sync.present", "turn" to turn, "shown" to shown,
                        "sdkFrameIndex" to frame.ordinal, "ptsSamples" to frame.window.start,
                        "endSample" to frame.window.endExclusive, "vsyncNs" to vsyncNs,
                        "audioSamples" to position, "headSamples" to clock.headSamples,
                        "lateMs" to (position - frame.window.start) / 16.0, "timestamp" to clock.timestamp,
                        "ordinalGap" to ordinalGap, "dropped" to discarded, "ready" to ready.size)
                } else discard(frame, "surface_unavailable")
            }
            if (!clock.playing) {
                ready.clear("audio_end")
                HitelE2Trace.event("sync.finish", "turn" to turn, "shown" to shown,
                    "audioSamples" to clock.samples, "dropped" to discarded)
            } else if (ready.size > 0) {
                schedule()
            }
        }
    }

    fun close() {
        synchronized(lock) {
            closed = true
            draw = null
            ready.clear("closed")
            while (shownHardware.isNotEmpty()) shownHardware.removeFirst().release()
        }
    }
}
