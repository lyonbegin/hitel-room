package ai.bithuman.expression2

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.io.RandomAccessFile

/**
 * Tests only HITEL's independently owned session setup function.
 * No original bitHuman SDK/JNI/metring classes or vendor secrets are involved.
 */
class HitelSessionManagerTest {
    private inline fun withModel(block: (Expression2Model) -> Unit) {
        val source = File.createTempFile("hitel-x2-session-", ".imx")
        try {
            RandomAccessFile(source, "rw").use { it.setLength(158524428L + 128) }
            val model = Expression2Model(
                sourceFile = source,
                graphOffset = 128L,
                graphLength = 158524428L,
                canon = ByteArray(299520)
            )
            block(model)
        } finally {
            source.delete()
        }
    }

    @Test fun armCreatesIndependentArmedSessionAndEngineState() = withModel { model ->
        val session = HitelSessionManager.arm(model)
        assertEquals(HitelSession.Phase.ARMED, session.currentPhase)
        assertEquals(158524428L, session.modelBytes)
        assertTrue(session.id.isNotBlank())
        session.markEngineReady()
        assertEquals(HitelSession.Phase.ENGINE_READY, session.currentPhase)
        session.close()
        assertEquals(HitelSession.Phase.CLOSED, session.currentPhase)
    }

    @Test fun armRejectsInvalidCanonBytes() = withModel { model ->
        val invalid = Expression2Model(model.sourceFile, model.graphOffset,
            model.graphLength, ByteArray(2))
        try {
            HitelSessionManager.arm(invalid)
            fail("Invalid model must not arm a session")
        } catch (_: IllegalArgumentException) { }
    }

    @Test fun armRejectsOutOfBoundsGraph() = withModel { model ->
        val invalid = Expression2Model(model.sourceFile, model.graphOffset + 1,
            model.graphLength, model.canon)
        try {
            HitelSessionManager.arm(invalid)
            fail("Out-of-bounds original IMX graph must be rejected")
        } catch (_: IllegalArgumentException) { }
    }

    @Test fun sessionDisallowsDoubleEngineReady() = withModel { model ->
        val session = HitelSessionManager.arm(model)
        session.markEngineReady()
        try {
            session.markEngineReady()
            fail("Engine should not be initialized a second time")
        } catch (_: IllegalStateException) { }
    }
}
