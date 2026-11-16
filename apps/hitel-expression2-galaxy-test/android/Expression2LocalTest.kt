package ai.bithuman.flutter

import ai.bithuman.expression2.Expression2Avatar
import ai.bithuman.expression2.Expression2Credential
import ai.bithuman.expression2.Expression2Model
import android.content.Context
import android.content.pm.ApplicationInfo
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

/** TEST-ONLY: original SDK + original public Wise Pup + 127.0.0.1 metering fixture.
 * Same hashes, synthetic marker and port as the previous successful Galaxy 40-frame test.
 * The native model/inference code is never changed.
 */
internal object Expression2LocalTest {
    private const val TAG = "BH_EXPR2_LOCAL_TEST"
    private const val CODE = "A23WJF0199"
    private const val FIXTURE_CREDENTIAL =
        "EXPR2_PHYSICAL_DEVICE_LOCAL_FIXTURE_NOT_VENDOR_SECRET"
    private var fixture: LoopbackAuthFixture? = null
    private const val MODEL_SHA =
        "f809722b65e933aacf2c577725e45aaba576fae84b4d17658d67d6d018a512ba"
    private const val CANON_SHA =
        "cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5"

    @Synchronized
    private fun ensureFixture() {
        if (fixture == null) {
            fixture = LoopbackAuthFixture { message -> Log.i(TAG, message) }
        }
    }

    private fun sha(file: File): String {
        val hash = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buf = ByteArray(1024 * 1024)
            while (true) {
                val read = input.read(buf)
                if (read < 0) break
                if (read > 0) hash.update(buf, 0, read)
            }
        }
        return hash.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
    }

    private fun originalAsset(context: Context, name: String, size: Long, digest: String): File {
        val folder = File(context.filesDir, "hitel-local-verified-model")
        check(folder.isDirectory || folder.mkdirs()) { "MODEL_CACHE_DIR_CREATE_FAIL" }
        val target = File(folder, name)
        if (target.isFile && target.length() == size && sha(target) == digest) {
            Log.i(TAG, "MODEL_CACHE_HIT name=$name bytes=$size")
            return target
        }
        Log.i(TAG, "MODEL_COPY_BEGIN name=$name bytes=$size")
        val part = File(folder, "$name.part")
        part.delete()
        try {
            context.assets.open(name).buffered().use { input ->
                FileOutputStream(part).use { out ->
                    val buf = ByteArray(1024 * 1024)
                    var count = 0L
                    var next = 32L * 1024 * 1024
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        if (n == 0) continue
                        out.write(buf, 0, n)
                        count += n
                        if (count >= next) {
                            Log.i(TAG, "MODEL_COPY_PROGRESS name=$name bytes=$count")
                            next += 32L * 1024 * 1024
                        }
                    }
                    out.fd.sync()
                }
            }
            check(part.length() == size && sha(part) == digest) {
                "ORIGINAL_MODEL_HASH_MISMATCH name=$name"
            }
            check(part.renameTo(target)) { "MODEL_CACHE_COMMIT_FAIL name=$name" }
            Log.i(TAG, "MODEL_ORIGINAL_SHA256_PASS name=$name bytes=$size")
            return target
        } finally {
            part.delete()
        }
    }

    fun create(context: Context, code: String): Expression2Avatar {
        check(context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            "Local fixture is disabled in release builds"
        }
        check(code == CODE) { "Only the public Wise Pup test identity is supported" }
        ensureFixture()
        val model = originalAsset(context, "combined_litert.tflite", 158524428L, MODEL_SHA)
        val canon = originalAsset(context, "canon.bin", 299520L, CANON_SHA)
        Log.i(TAG, "LOCAL_TEST_ORIGINAL_MODEL_READY")
        val combined = Expression2Model.combined(model, canon)
        Expression2Credential.set(FIXTURE_CREDENTIAL)
        Log.i(TAG, "LOCAL_TEST_CREDENTIAL_REGISTERED synthetic_localhost_only=true")
        val avatar = Expression2RouteSelector.create(context, combined)
        Log.i(TAG, "LOCAL_TEST_ORIGINAL_CREATE_PASS accelerator=${avatar.accelerator} " +
            "routing=${avatar.routing} note=${avatar.acceleratorNote}")
        return avatar
    }
}
