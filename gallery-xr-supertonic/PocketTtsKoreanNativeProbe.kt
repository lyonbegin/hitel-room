package com.google.ai.edge.gallery.services.tts

import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.mediapipe.tasks.audio.texttospeech.SynthesisOptions
import com.google.mediapipe.tasks.audio.texttospeech.TextToSpeech
import com.google.mediapipe.tasks.audio.texttospeech.TextToSpeechOptions
import com.google.mediapipe.tasks.core.BaseOptions
import java.io.File
import java.io.FileOutputStream
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.flow.collect
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.sqrt

/** Native SDK 1.2.0 probe only; not a separate production TTS engine. */
@RunWith(AndroidJUnit4::class)
class PocketTtsKoreanNativeProbe {
  @Test fun nativeSynthesis() = runBlocking {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val args = InstrumentationRegistry.getArguments()
    val context = instrumentation.targetContext
    val caseName = args.getString("probeCase") ?: "baseline"
    val locale = args.getString("probeLocale") ?: "en-US"
    val voice = args.getString("probeVoice") ?: "alba"
    val text = args.getString("probeText") ?: "안녕하세요. 한국어 음성 합성 시험입니다."
    val model = File(context.filesDir, "pocketprobe/$caseName/pocket_tts_int8.litertlm")
    assertTrue("Missing model: $model", model.isFile)
    val result = File(context.filesDir, "pocketprobe/$caseName.pcm")
    TextToSpeech.create(
      TextToSpeechOptions(
        baseOptions = BaseOptions.builder().setModelAssetPath(model.absolutePath).build(),
        defaultVoiceId = voice,
        defaultLocale = locale,
        cacheDirectory = File(context.cacheDir, "pocketprobe-$caseName").absolutePath,
      )
    ).use { tts ->
      Log.i("HITEL_POCKET_PROBE", "VOICE_LIST " + tts.listVoices())
      var n = 0L
      var squares = 0.0
      var chunks = 0
      var finalSeen = false
      FileOutputStream(result).use { out ->
        withTimeout(150_000L) {
          tts.synthesizeStream(text, SynthesisOptions(voiceId = voice, locale = locale)).collect { chunk ->
            assertTrue(chunk.sampleRateHz == 24000)
            chunks++
            finalSeen = finalSeen || chunk.isFinal
            for (x in chunk.samples) {
              assertTrue(x.isFinite())
              n++
              squares += x.toDouble() * x
              val s = (x.coerceIn(-1f, 1f) * 32767).toInt()
              out.write(s and 255)
              out.write((s shr 8) and 255)
            }
          }
        }
      }
      val rms = sqrt(squares / n.coerceAtLeast(1))
      assertTrue("Too short/long: $n", n in 2401..960000)
      assertTrue("Silent: $rms", rms > 0.00001)
      Log.i("HITEL_POCKET_PROBE", "ANDROID_NATIVE_PCM_PASS case=$caseName samples=$n chunks=$chunks final=$finalSeen rms=$rms")
    }
  }
}
