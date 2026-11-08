package app.hitel.nativebridge

import org.junit.Assert.assertEquals
import org.junit.Test

class CallRecordingLabelsTest {
    @Test fun stopLabelAlwaysWins() =
        assertEquals("RECORDING_ACTIVE", CallRecordingLabels.classify(listOf("녹음", "녹음 중지")))

    @Test fun startLabelIsRecognized() =
        assertEquals("RECORDING_START_AVAILABLE", CallRecordingLabels.classify(listOf(" 녹음   시작 ")))

    @Test fun unknownScreenDoesNotClick() =
        assertEquals("RECORDING_CONTROL_NOT_FOUND", CallRecordingLabels.classify(listOf("통화 종료", "키패드")))

    @Test fun englishRecordingStatus() =
        assertEquals("RECORDING_ACTIVE", CallRecordingLabels.classify(listOf("Stop recording")))

    @Test fun exactMatchAvoidsAccidentalActions() =
        assertEquals("RECORDING_CONTROL_NOT_FOUND", CallRecordingLabels.classify(listOf("녹음 예약")))

    @Test fun englishStart() =
        assertEquals("RECORDING_START_AVAILABLE", CallRecordingLabels.classify(listOf("record call")))
}
