package com.example.x2hello

import ai.bithuman.expression2.Expression2Avatar
import ai.bithuman.expression2.Expression2Credential
import ai.bithuman.expression2.Expression2Model
import ai.bithuman.expression2.Expression2Options
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Bitmap
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/**
 * ON-DEVICE original Expression 2 SDK test shell.
 * Sources remain the original vendor JVM/ARM64 binaries; only the original
 * SelfHostMeter$Companion.apiBase method is changed to localhost for a
 * synthetic test fixture. This APK is not a licensed production SDK client.
 */
class MainActivity : Activity() {
    private val busy = AtomicBoolean(false)
    private val logText = StringBuilder()
    private lateinit var logView: TextView
    private lateinit var preview: ImageView
    private lateinit var runButton: Button
    private var backend: LoopbackAuthFixture? = null

    private fun event(message: String) {
        val entry = "[" + (SystemClock.elapsedRealtime() / 1000) + "s] " + message
        Log.i("EXPR2_DEVICE", entry)
        synchronized(logText) {
            logText.append(entry).append('\n')
        }
        runOnUiThread {
            logView.text = synchronized(logText) { logText.toString() }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18, 12, 18, 12)
            setBackgroundColor(0xFF11131A.toInt())
        }
        val title = TextView(this).apply {
            text = "Expression 2 원본 SDK 실기기 시험"
            textSize = 20f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 4, 0, 12)
        }
        root.addView(title)
        preview = ImageView(this).apply {
            setBackgroundColor(0xFF22252D.toInt())
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        root.addView(preview, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 4f
        ))
        runButton = Button(this).apply {
            text = "원본 엔진 시험 시작"
            setOnClickListener { runOriginalSdk() }
        }
        root.addView(runButton)
        val copyButton = Button(this).apply {
            text = "진단 로그 복사"
            setOnClickListener {
                val logs = synchronized(logText) { logText.toString() }
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("EXPR2_DEVICE_LOG", logs))
                event("DIAGNOSTIC_LOG_COPIED")
            }
        }
        root.addView(copyButton)
        val scroll = ScrollView(this)
        logView = TextView(this).apply {
            textSize = 12f
            setTextColor(0xFFE0E6EF.toInt())
            setPadding(6, 10, 6, 10)
            text = "대기 중\n"
        }
        scroll.addView(logView)
        root.addView(scroll, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 3f
        ))
        setContentView(root)
        try {
            backend = LoopbackAuthFixture(::event)
        } catch (failure: Throwable) {
            event("TEST_LOCAL_AUTH_START_FAILED " + failure.javaClass.simpleName +
                " " + failure.message.orEmpty())
            Log.e("EXPR2_DEVICE", "local test backend", failure)
            runButton.isEnabled = false
            return
        }
        event("DEVICE_ABI " + android.os.Build.SUPPORTED_ABIS.joinToString())
        event("TEST_ONLY original SDK + local model + localhost fixture; no vendor entitlement")
        event("Press 시험 시작. Initial asset cache copy uses ~159MB storage.")
    }

    private fun hash(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val chunk = ByteArray(1024 * 1024)
            while (true) {
                val n = input.read(chunk)
                if (n < 0) break
                if (n > 0) digest.update(chunk, 0, n)
            }
        }
        return digest.digest().joinToString("") {
            "%02x".format(it.toInt() and 0xff)
        }
    }

    private fun localModelFile(name: String, expectedSize: Long, expectedHash: String): File {
        val folder = File(filesDir, "models")
        if (!folder.isDirectory) require(folder.mkdirs()) { "Could not create model cache" }
        val target = File(folder, name)
        if (target.isFile && target.length() == expectedSize && hash(target) == expectedHash) {
            event("MODEL_CACHE_HIT " + name + " bytes=" + expectedSize)
            return target
        }
        target.delete()
        val temporary = File(folder, name + ".part")
        temporary.delete()
        event("MODEL_COPY_BEGIN " + name)
        try {
            assets.open(name).buffered().use { input ->
                FileOutputStream(temporary).use { output ->
                    val buffer = ByteArray(1024 * 1024)
                    var total = 0L
                    var next = 32L * 1024 * 1024
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        if (count == 0) continue
                        output.write(buffer, 0, count)
                        total += count
                        if (total >= next) {
                            event("MODEL_COPY_PROGRESS " + name + " bytes=" + total)
                            next += 32L * 1024 * 1024
                        }
                    }
                    output.fd.sync()
                }
            }
            require(temporary.length() == expectedSize) {
                "Invalid model asset size " + name + "=" + temporary.length()
            }
            require(hash(temporary) == expectedHash) {
                "Invalid model asset SHA256: " + name
            }
            require(temporary.renameTo(target)) { "Could not commit model cache" }
            event("MODEL_ORIGINAL_SHA256_PASS " + name + " bytes=" + expectedSize)
            return target
        } finally {
            temporary.delete()
        }
    }

    private fun runOriginalSdk() {
        if (!busy.compareAndSet(false, true)) return
        runButton.isEnabled = false
        Thread({
            try {
                testEngine()
            } catch (failure: Throwable) {
                event("TEST_FAIL " + failure.javaClass.name + " " + failure.message.orEmpty())
                Log.e("EXPR2_DEVICE", "test failed", failure)
            } finally {
                busy.set(false)
                runOnUiThread { runButton.isEnabled = true }
            }
        }, "expr2-original-physical-test").start()
    }

    private fun saveFrame(bitmap: Bitmap, frameIndex: Int) {
        val target = File(filesDir, "original-frame-" + frameIndex + ".png")
        FileOutputStream(target).use { stream ->
            check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)) {
                "Cannot save original bitmap"
            }
        }
        event("SDK_ORIGINAL_FRAME_SAVED index=" + frameIndex +
            " bytes=" + target.length() + " sha256=" + hash(target).take(16))
    }

    private fun testEngine() {
        val overall = SystemClock.elapsedRealtime()
        event("ORIGINAL_TEST_BEGIN")
        check(backend != null) { "Local test-only auth server missing" }
        val modelFile = localModelFile(
            "combined_litert.tflite", 158524428L,
            "f809722b65e933aacf2c577725e45aaba576fae84b4d17658d67d6d018a512ba"
        )
        val canonFile = localModelFile(
            "canon.bin", 299520L,
            "cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5"
        )
        event("LOCAL_MODEL_READY")
        System.loadLibrary("expr2jni")
        event("SDK_ORIGINAL_ARM64_LIBRARY_LOADED")
        val model = Expression2Model.combined(modelFile, canonFile)
        event("SDK_ORIGINAL_MODEL_CONSTRUCT_PASS modelBytes=" + model.modelBytes)
        Expression2Credential.set(LoopbackAuthFixture.TEST_CREDENTIAL)
        event("LOCAL_TEST_CREDENTIAL_REGISTERED")
        val wav = Wav.read16kMono(assets.open("speech.wav").use { it.readBytes() })
        val count = minOf(wav.samples.size, 32000)
        val pcm = FloatArray(count) { i -> wav.samples[i] / 32768f }
        event("ORIGINAL_AUDIO_READY samples=" + count +
            " sampleRate=" + Expression2Avatar.SAMPLE_RATE)
        val createStart = SystemClock.elapsedRealtime()
        event("SDK_ORIGINAL_CREATE_BEGIN")
        val avatar = Expression2Avatar.create(this, model, Expression2Options())
        event("SDK_ORIGINAL_CREATE_PASS createMs=" +
            (SystemClock.elapsedRealtime() - createStart) +
            " accelerator=" + avatar.accelerator + " routing=" + avatar.routing +
            " note=" + avatar.acceleratorNote)
        avatar.use { sdk ->
            val dest = sdk.newFrameBitmap()
            val inferenceStart = SystemClock.elapsedRealtime()
            event("SDK_ORIGINAL_FEED_BEGIN samples=" + count)
            sdk.feed(pcm)
            event("SDK_ORIGINAL_FEED_RETURN elapsedMs=" +
                (SystemClock.elapsedRealtime() - inferenceStart))
            sdk.flushTail()
            event("SDK_ORIGINAL_FLUSH_RETURN elapsedMs=" +
                (SystemClock.elapsedRealtime() - inferenceStart))
            val deadline = SystemClock.elapsedRealtime() + 180000L
            var frames = 0
            var firstFrameAt = -1L
            while (frames < 40 && SystemClock.elapsedRealtime() < deadline) {
                if (sdk.pull(dest) != null) {
                    frames++
                    if (frames == 1) {
                        firstFrameAt = SystemClock.elapsedRealtime() - inferenceStart
                        event("SDK_ORIGINAL_FIRST_FRAME_PASS firstFrameMs=" + firstFrameAt +
                            " width=" + dest.width + " height=" + dest.height)
                    }
                    if (frames in listOf(1, 2, 10, 20, 40)) {
                        saveFrame(dest, frames)
                    }
                    if (frames == 1 || frames % 5 == 0) {
                        val snapshot = dest.copy(Bitmap.Config.ARGB_8888, false)
                        runOnUiThread { preview.setImageBitmap(snapshot) }
                        event("SDK_ORIGINAL_FRAME_COUNT " + frames +
                            " elapsedMs=" + (SystemClock.elapsedRealtime() - inferenceStart))
                    }
                } else {
                    if (!sdk.hasPendingTail && sdk.queuedFrames == 0) break
                    Thread.sleep(10)
                }
            }
            event("SDK_ORIGINAL_RENDER_RESULT frames=" + frames +
                " inferenceElapsedMs=" + (SystemClock.elapsedRealtime() - inferenceStart) +
                " firstFrameMs=" + firstFrameAt)
            check(frames > 0) { "Original engine did not output a frame" }
            event("SDK_ORIGINAL_RENDER_PASS")
        }
        event("SDK_ORIGINAL_SESSION_CLOSED totalElapsedMs=" +
            (SystemClock.elapsedRealtime() - overall))
    }

    override fun onDestroy() {
        backend?.close()
        backend = null
        super.onDestroy()
    }
}
