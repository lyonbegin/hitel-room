package ai.bithuman.flutter

/** The SDK's lastFrameIndex is an utterance ordinal. It advances once per 640 input samples. */
internal object HitelPcmTimeline {
    const val RATE = 16_000
    const val HOP = 640L

    data class Window(val start: Long, val endExclusive: Long)

    fun window(ordinal: Long, accepted: Long): Window? {
        if (ordinal < 0 || ordinal > Long.MAX_VALUE / HOP) return null
        val start = ordinal * HOP
        if (start >= accepted) return null
        return Window(start, start + minOf(HOP, accepted - start))
    }

    fun sampleAt(anchor: Long, anchorNs: Long, nowNs: Long, limit: Long): Long =
        (anchor + (nowNs - anchorNs) * RATE / 1_000_000_000L).coerceAtMost(limit)
}
