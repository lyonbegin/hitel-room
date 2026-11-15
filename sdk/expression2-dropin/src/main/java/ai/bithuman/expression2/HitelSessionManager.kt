package ai.bithuman.expression2

import android.util.Log
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

/**
 * HITEL-owned local engine session, deliberately unrelated to bitHuman
 * SelfHostMeter/MeterHost, vendor credentials, usage reporting and authorization.
 * This is the FIRST replaceable function in the vendor-FREE independent SDK.
 *
 * Real vendor classes.jar and libexpr2jni.so MUST NOT be present in the build.
 */
internal class HitelSession internal constructor(
    val id: String,
    val modelBytes: Long
) {
    enum class Phase { ARMED, ENGINE_READY, ABANDONED, CLOSED }

    private val phase = AtomicReference(Phase.ARMED)
    val currentPhase: Phase get() = phase.get()

    fun markEngineReady() {
        check(phase.compareAndSet(Phase.ARMED, Phase.ENGINE_READY)) {
            "HITEL session cannot enter ENGINE_READY from ${phase.get()}"
        }
    }

    fun abandon() {
        phase.set(Phase.ABANDONED)
    }

    fun close() {
        phase.set(Phase.CLOSED)
    }
}

/**
 * Independently implemented arm() replacing the session-setup RESPONSIBILITY
 * of the original SDK only in our own independent implementation.
 * It does NOT return or fabricate vendor SelfHostMeter authorization.
 */
internal object HitelSessionManager {
    private const val TAG = "HITEL_EXPRESSION2"

    fun arm(model: Expression2Model): HitelSession {
        Log.i(TAG, "HITEL_OWN_ARM_BEGIN")
        require(model.sourceFile.isFile) { "Local IMX model is missing" }
        require(model.graphOffset >= 0L && model.graphLength == 158524428L) {
            "Model graph bounds differ from verified Wise Pup original"
        }
        require(model.graphOffset <= model.sourceFile.length() &&
            model.graphLength <= model.sourceFile.length() - model.graphOffset) {
            "Model graph is outside the source IMX file"
        }
        require(model.canon.size == 299520) {
            "Canonical state differs from verified Wise Pup original"
        }
        val session = HitelSession(UUID.randomUUID().toString(), model.graphLength)
        Log.i(TAG, "HITEL_OWN_ARM_PASS session=" + session.id +
            " modelBytes=" + session.modelBytes + " source=independent_local_only")
        return session
    }
}
