package app.hitel.nativebridge

/**
 * Reconciles Android telephony state with previously observed Accessibility UI.
 * The probe can be launched AFTER Samsung's recording button already showed
 * "녹음 중지"; using only confirmation >= sessionStart is incorrect.
 */
internal object CallRecordingEvidence {
    private const val PRESTART_GRACE_MS = 120_000L

    fun isRecordingDuringProbe(
        callState: String,
        uiState: String,
        uiPackage: String,
        confirmedAtMillis: Long,
        observedAtMillis: Long,
        probeStartMillis: Long,
        lastIdleAtMillis: Long
    ): Boolean {
        if (callState != "OFFHOOK" || uiState != "RECORDING_ACTIVE") return false
        if (uiPackage !in setOf("com.samsung.android.incallui", "com.android.incallui")) return false
        if (confirmedAtMillis <= 0 || observedAtMillis <= 0 || probeStartMillis <= 0) return false
        if (confirmedAtMillis < probeStartMillis - PRESTART_GRACE_MS ||
            observedAtMillis < probeStartMillis - PRESTART_GRACE_MS) return false
        // If the previous call ended, only new UI evidence may validate a new call.
        if (lastIdleAtMillis > 0 &&
            (confirmedAtMillis <= lastIdleAtMillis || observedAtMillis <= lastIdleAtMillis)) return false
        return true
    }
}
