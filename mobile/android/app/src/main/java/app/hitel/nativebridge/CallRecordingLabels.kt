package app.hitel.nativebridge

/** A recording STOP control always wins over a START control. */
internal object CallRecordingLabels {
    private val stops = setOf(
        "녹음 중지", "녹음 종료", "통화 녹음 중지", "통화 녹음 종료",
        "stop recording", "stop call recording", "end recording"
    )
    private val starts = setOf(
        "녹음", "녹음 시작", "통화 녹음", "통화 녹음 시작",
        "record", "start recording", "record call", "start call recording"
    )
    private fun normalized(s: String) = s.trim().replace(Regex("\\s+"), " ").lowercase()
    fun isStart(s: String) = normalized(s) in starts
    fun classify(labels: Iterable<String>): String {
        val observed = labels.map(::normalized)
        return when {
            observed.any { it in stops } -> "RECORDING_ACTIVE"
            observed.any { it in starts } -> "RECORDING_START_AVAILABLE"
            else -> "RECORDING_CONTROL_NOT_FOUND"
        }
    }
}
