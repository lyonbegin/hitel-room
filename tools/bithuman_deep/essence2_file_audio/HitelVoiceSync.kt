package ai.bithuman.flutter

import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import java.util.ArrayDeque

/** Owned frames in SDK ordinal order. Each frame is disposed or passed to the display once. */
internal class VoiceFrameQueue<T>(
    private val capacity: Int,
    private val release: (T) -> Unit,
) {
    private data class Item<T>(val at: Long, val frame: T)
    private val frames = ArrayDeque<Item<T>>()
    val size: Int get() = frames.size
    val full: Boolean get() = size >= capacity

    fun offer(at: Long, frame: T) {
        if (full) release(frame) else frames.addLast(Item(at, frame))
    }

    fun takeDue(samples: Long): T? {
        var newest: Item<T>? = null
        while (frames.peekFirst()?.let { it.at <= samples } == true) {
            newest?.let { release(it.frame) }
            newest = frames.removeFirst()
        }
        return newest?.frame
    }

    fun clear() {
        while (frames.isNotEmpty()) release(frames.removeFirst().frame)
    }
}

internal data class VoiceAudioPosition(
    val turn: Int,
    val samples: Long,
    val headSamples: Long,
    val timestamp: Boolean,
    val playing: Boolean,
)

internal class HitelVoiceSync(
    private val currentTurn: () -> Int,
    private val audioPosition: () -> VoiceAudioPosition?,
) {
    private class Frame(val bitmap: Bitmap, val hw: HwFrame?, val ordinal: Long, val at: Long) {
        fun release() {
            if (hw == null) bitmap.recycle() else hw.release()
        }
    }

    private val main = Handler(Looper.getMainLooper())
    private val lock = Any()
    private val shownHardware = ArrayDeque<HwFrame>()
    private var discarded = 0L
    private val ready = VoiceFrameQueue<Frame>(6) { frame -> frame.release(); discarded++ }
    private var turn = 0
    private var framePending = false
    private var closed = false
    private var shown = 0L
    private var lastOrdinal = -1L
    private var draw: ((Bitmap) -> Boolean)? = null

    val readyCount: Int get() = synchronized(lock) { ready.size }
    val full: Boolean get() = synchronized(lock) { ready.full }

    fun attach(draw: (Bitmap) -> Boolean) {
        synchronized(lock) {
            if (!closed) this.draw = draw
        }
    }

    fun begin(next: Int) {
        synchronized(lock) {
            if (closed || next != currentTurn()) return
            ready.clear()
            turn = next
            discarded = 0
            shown = 0
            lastOrdinal = -1
        }
    }

    fun offer(turn: Int, ordinal: Long, at: Long, bitmap: Bitmap, hw: HwFrame?) {
        synchronized(lock) {
            val frame = Frame(bitmap, hw, ordinal, at)
            val clock = audioPosition()
            if (closed || turn != this.turn || turn != currentTurn() ||
                (clock?.turn == turn && !clock.playing)) {
                frame.release()
                return
            }
            ready.offer(at, frame)
            schedule()
        }
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
            Choreographer.getInstance().postFrameCallback { present() }
        }
    }

    private fun present() {
        synchronized(lock) {
            framePending = false
            val clock = audioPosition() ?: return
            if (closed || clock.turn != turn || turn != currentTurn()) return
            val frame = ready.takeDue(if (clock.playing) clock.samples else clock.samples - 1)
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
                        "sdkFrameIndex" to frame.ordinal, "ptsSamples" to frame.at,
                        "audioSamples" to clock.samples, "headSamples" to clock.headSamples,
                        "lateMs" to (clock.samples - frame.at) / 16.0, "timestamp" to clock.timestamp,
                        "ordinalGap" to ordinalGap, "dropped" to discarded, "ready" to ready.size)
                } else frame.release()
            }
            if (!clock.playing) {
                ready.clear()
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
            ready.clear()
            while (shownHardware.isNotEmpty()) shownHardware.removeFirst().release()
        }
    }
}
