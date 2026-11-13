package com.example.x2hello

import ai.bithuman.expression2.Expression2Avatar
import ai.bithuman.expression2.Expression2Credential
import ai.bithuman.expression2.Expression2Model
import ai.bithuman.expression2.Expression2Options
import android.app.Activity
import android.graphics.Bitmap
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.widget.TextView
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

/**
 * Loads the genuine unmodified Expression2 0.6.2 AAR, backed by public Wise Pup
 * data downloaded from bitHuman, on Android 14 x86_64 + ARM64 NativeBridge.
 *
 * This is not an independent LiteRT implementation, a mocked SDK, or a
 * license bypass. A true SDK rendering PASS requires create/feed/pull success.
 */
class MainActivity : Activity() {
    private val tag = "EXPR2_OFFICIAL"
    private lateinit var label: TextView

    private fun report(value: String) {
        Log.i(tag, value)
        runOnUiThread { label.append(value + "\n") }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        label = TextView(this).apply {
            textSize = 13f
            setPadding(16, 16, 16, 16)
            text = "Original bitHuman Expression2 0.6.2 emulator smoke test\n"
        }
        setContentView(label)
        Thread({ runProbe() }, "official-x2-sdk-probe").start()
    }

    private fun sha256(file: File): String {
        val hash = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { stream ->
            val bytes = ByteArray(1 shl 20)
            while (true) {
                val n = stream.read(bytes)
                if (n < 0) break
                hash.update(bytes, 0, n)
            }
        }
        return hash.digest().joinToString("") { "%02x".format(it) }
    }

    private fun runProbe() {
        try {
            report("SDK_PROBE_BEGIN abi=" + android.os.Build.SUPPORTED_ABIS.joinToString())
            // Explicitly test that the original ARM64 DSO, not a substitute,
            // is loadable through Android's installed native bridge.
            try {
                System.loadLibrary("expr2jni")
                report("SDK_ORIGINAL_NATIVE_LOAD_PASS libexpr2jni.so")
            } catch (e: Throwable) {
                report("SDK_ORIGINAL_NATIVE_LOAD_FAIL " + e.javaClass.simpleName + " " + e.message)
                Log.e(tag, "original shared library load", e)
                return
            }

            // The model is deliberately NOT bundled with the APK. ADB pushes
            // the complete original public IMX extracted members first.
            val root = File(getExternalFilesDir(null), "models")
            val networkFreeModel = File(root, "combined_litert.tflite")
            val canon = File(root, "canon.bin")
            report("MODEL_LOCATION " + root.absolutePath)
            if (!networkFreeModel.isFile || !canon.isFile) {
                report("SDK_MODEL_MISSING model=" + networkFreeModel.exists() +
                    " canon=" + canon.exists())
                return
            }
            require(networkFreeModel.length() == 158524428L)
            require(canon.length() == 299520L)
            report("MODEL_ORIGINAL_FILES_VERIFIED sizes=" + networkFreeModel.length() +
                "," + canon.length() +
                " modelSha256=" + sha256(networkFreeModel) +
                " canonSha256=" + sha256(canon))

            val localModel = Expression2Model.combined(networkFreeModel, canon)
            require(localModel.combinedModel == networkFreeModel)
            report("SDK_ORIGINAL_MODEL_CONSTRUCT_PASS " + localModel.modelBytes)
            val secret = BuildConfig.BITHUMAN_API_SECRET
            if (secret.isNotBlank()) {
                Expression2Credential.set(secret)
                report("SDK_CREDENTIAL_CONFIGURED")
            } else {
                report("SDK_CREDENTIAL_UNSET_NO_TEST_SECRET")
            }

            // Real original official SDK runtime entry point.
            // The same invocation is used in the vendor's example.
            report("SDK_OFFICIAL_CREATE_BEGIN")
            val started = SystemClock.elapsedRealtime()
            val avatar = try {
                Expression2Avatar.create(this, localModel, Expression2Options())
            } catch (e: Throwable) {
                val message = e.message.orEmpty().replace("\n", " ").take(300)
                report("SDK_OFFICIAL_CREATE_REJECTED " + e.javaClass.name + " " + message)
                Log.e(tag, "real original SDK create failure", e)
                return
            }
            avatar.use {
                report("SDK_OFFICIAL_CREATE_PASS millis=" +
                    (SystemClock.elapsedRealtime() - started) +
                    " accelerator=" + it.accelerator + " routing=" + it.routing)
                // Uses original bundled sample WAV and unmodified SDK
                // feed / flush / pull. Exactly one 1.6 second chunk + tail.
                val wav = Wav.read16kMono(assets.open("speech.wav").use { asset ->
                    asset.readBytes()
                })
                val count = minOf(wav.samples.size, 32000)
                val pcm = FloatArray(count) { i -> wav.samples[i] / 32768f }
                val dest: Bitmap = it.newFrameBitmap()
                it.feed(pcm)
                it.flushTail()
                val timeoutAt = SystemClock.elapsedRealtime() + 180000L
                var frames = 0
                while (SystemClock.elapsedRealtime() < timeoutAt && frames < 40) {
                    if (it.pull(dest) != null) {
                        frames++
                        if (frames == 1) {
                            FileOutputStream(File(filesDir, "official-first-frame.png")).use { output ->
                                dest.compress(Bitmap.CompressFormat.PNG, 100, output)
                            }
                            report("SDK_OFFICIAL_FIRST_FRAME_PASS")
                        }
                    } else {
                        if (!it.hasPendingTail && it.queuedFrames == 0) break
                        Thread.sleep(20)
                    }
                }
                report("SDK_OFFICIAL_RENDER_RESULT frames=" + frames +
                    " firstFrameFile=" + File(filesDir, "official-first-frame.png").exists())
                if (frames > 0) report("SDK_OFFICIAL_RENDER_PASS")
                else report("SDK_OFFICIAL_RENDER_NO_FRAMES")
            }
        } catch (e: Throwable) {
            report("SDK_PROBE_UNEXPECTED_FAIL " + e.javaClass.name + " " +
                e.message.orEmpty().replace("\n", " ").take(300))
            Log.e(tag, "official sdk probe", e)
        } finally {
            report("SDK_PROBE_END")
        }
    }
}
