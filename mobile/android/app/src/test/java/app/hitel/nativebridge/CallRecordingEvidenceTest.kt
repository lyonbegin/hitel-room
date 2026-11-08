package app.hitel.nativebridge

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CallRecordingEvidenceTest {
    private val start = 1_794_155_166_225L
    private val confirmedBeforeStart = 1_794_155_153_384L
    private val observedBeforeStart = 1_794_155_153_379L

    private fun recorded(
        state: String = "OFFHOOK",
        ui: String = "RECORDING_ACTIVE",
        pkg: String = "com.samsung.android.incallui",
        confirmed: Long = confirmedBeforeStart,
        observed: Long = observedBeforeStart,
        lastIdle: Long = 0
    ) = CallRecordingEvidence.isRecordingDuringProbe(
        state, ui, pkg, confirmed, observed, start, lastIdle
    )

    @Test fun samsungRealLogRecordingStartedBeforeProbeIsConfirmed() {
        assertTrue(recorded())
    }

    @Test fun stalePreviousCallCannotBeReused() {
        assertFalse(recorded(lastIdle = start - 1))
    }

    @Test fun recordingConfirmationOlderThanTwoMinutesRejected() {
        assertFalse(recorded(confirmed = start - 121_000L, observed = start - 121_000L))
    }

    @Test fun noCallCannotBeConfirmed() {
        assertFalse(recorded(state = "IDLE"))
    }

    @Test fun noRecordingStopLabelCannotBeConfirmed() {
        assertFalse(recorded(ui = "RECORDING_START_AVAILABLE"))
    }

    @Test fun unrelatedAppCannotConfirmRecording() {
        assertFalse(recorded(pkg = "com.other.app"))
    }

    @Test fun missingEvidenceCannotConfirmRecording() {
        assertFalse(recorded(confirmed = 0L))
    }
}
