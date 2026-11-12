package com.example.x2hello

import android.app.Activity
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.widget.ScrollView
import android.widget.TextView
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import java.security.MessageDigest
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Standalone, credential-free diagnostic app. The only inference runtime used is Google LiteRT.
 * Includes the public showcase Expression2 TFLite model as an uncompressed Android asset.
 * Tests real encoder -> tokenizer operations. DOES NOT produce face video or use vendor API.
 */
class MainActivity : Activity() {
    private val tag = "HITEL_IMX_CPU"
    private lateinit var display: TextView

    private fun record(message: String) {
        Log.i(tag, message)
        runOnUiThread {
            display.append(message + "\n")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        display = TextView(this).apply {
            textSize = 13f
            setTextColor(0xfff2f2f2.toInt())
            setBackgroundColor(0xff17212b.toInt())
            setPadding(24, 30, 24, 30)
            text = "Independent LiteRT / Expression 2 encoder\n"
        }
        val container = ScrollView(this).apply { addView(this@MainActivity.display) }
        setContentView(container)
        Thread {
            try {
                runInference()
            } catch (error: Throwable) {
                record("FAIL " + error.javaClass.simpleName + ": " + error.message)
                Log.e(tag, "independent inference failed", error)
            }
        }.start()
    }

    private fun runInference() {
        record("IMX_LOCAL_START runtime=Google-LiteRT; vendor-sdk=NONE; api-secret=NONE")
        val openStarted = SystemClock.elapsedRealtime()
        val mapped = assets.openFd("combined_litert.tflite").use { asset ->
            FileInputStream(asset.fileDescriptor).channel.use { file ->
                file.map(FileChannel.MapMode.READ_ONLY, asset.startOffset, asset.length)
            }
        }
        record("MODEL_MAPPED bytes=" + mapped.capacity() +
            " ms=" + (SystemClock.elapsedRealtime() - openStarted))
        Interpreter(mapped, Interpreter.Options().setNumThreads(2)).use { engine ->
            val audio = Array(1) { FloatArray(35200) { i ->
                val t = i.toDouble() / 16000.0
                (0.12 * sin(2.0 * PI * 220 * t) + 0.02 * sin(2.0 * PI * 440 * t)).toFloat()
            }}
            val encoded = Array(1) { Array(55) { Array(12) { FloatArray(768) } } }
            val startEnc = SystemClock.elapsedRealtime()
            engine.runSignature(
                mapOf("args_0" to audio),
                mutableMapOf<String, Any>("output_0" to encoded),
                "enc"
            )
            val encTime = SystemClock.elapsedRealtime() - startEnc
            val encStats = digest(encoded.asSequence().flatMap { it.asSequence() }.flatMap { it.asSequence() }.flatMap { it.asSequence() })
            record("ENC_PASS shape=[1,55,12,768] ms=$encTime sha256=" + encStats)
            val tokens = Array(1) { Array(14) { Array(16) { FloatArray(384) } } }
            val startTok = SystemClock.elapsedRealtime()
            engine.runSignature(
                mapOf("args_0" to encoded),
                mutableMapOf<String, Any>("output_0" to tokens),
                "tok14"
            )
            val tokTime = SystemClock.elapsedRealtime() - startTok
            val tokStats = digest(tokens.asSequence().flatMap { it.asSequence() }.flatMap { it.asSequence() }.flatMap { it.asSequence() })
            record("TOK14_PASS shape=[1,14,16,384] ms=$tokTime sha256=" + tokStats)
            record("INDEPENDENT_ANDROID_CPU_PASS two signatures; rendering NOT tested")
        }
    }

    private fun digest(values: Sequence<Float>): String {
        val sha = MessageDigest.getInstance("SHA-256")
        val chunk = ByteBuffer.allocate(16384).order(ByteOrder.LITTLE_ENDIAN)
        var n = 0
        for (value in values) {
            require(value.isFinite()) { "Non-finite model output at float index $n" }
            if (chunk.remaining() < 4) {
                sha.update(chunk.array(), 0, chunk.position())
                chunk.clear()
            }
            chunk.putFloat(value)
            n += 1
        }
        sha.update(chunk.array(), 0, chunk.position())
        require(n > 0) { "Empty model output" }
        return sha.digest().joinToString("") { "%02x".format(it) }
    }
}
