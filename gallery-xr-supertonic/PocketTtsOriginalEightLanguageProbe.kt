package com.google.ai.edge.gallery.services.tts

import android.os.SystemClock
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.mediapipe.tasks.audio.texttospeech.SynthesisOptions
import com.google.mediapipe.tasks.audio.texttospeech.TextToSpeech
import com.google.mediapipe.tasks.audio.texttospeech.TextToSpeechOptions
import com.google.mediapipe.tasks.core.BaseOptions
import java.io.File
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.flow.collect
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketTtsOriginalEightLanguageProbe {
  @Test fun originalNativeSwitching() = runBlocking {
    val context=InstrumentationRegistry.getInstrumentation().targetContext
    val model=File(context.filesDir,"pocketprobe/eight/pocket_tts_int8.litertlm")
    assertTrue(model.isFile)
    val beforeCreate=SystemClock.elapsedRealtime()
    TextToSpeech.create(TextToSpeechOptions(
      baseOptions=BaseOptions.builder().setModelAssetPath(model.absolutePath).build(),
      defaultVoiceId="alba",
      defaultLocale="en-US",
      cacheDirectory=File(context.cacheDir,"pocketprobe-eight").absolutePath,
    )).use { tts ->
      Log.i("HITEL_POCKET_PROBE","ORIGINAL_NATIVE_CREATE_MS "+(SystemClock.elapsedRealtime()-beforeCreate))
      Log.i("HITEL_POCKET_PROBE","ORIGINAL_NATIVE_VOICES "+tts.listVoices())
      val locales=listOf("en-US","fr-FR","en-US","ko-KR","en-US","ko-KR")
      for ((index,locale) in locales.withIndex()) {
        val voice=when(locale){"fr-FR"->"estelle";"ko-KR"->"ko_hitel";else->"alba"}
        val text=when(locale){"fr-FR"->"Bonjour tout le monde.";"ko-KR"->"안녕하세요. 한국어 음성 합성 시험입니다.";else->"Hello world."}
        val start=SystemClock.elapsedRealtime()
        var first=-1L
        var samples=0L
        var finalSeen=false
        var energy=0.0
        File(context.filesDir,"pocketprobe/eight-$index.pcm").outputStream().buffered().use { out ->
          withTimeout(180000L) {
            tts.synthesizeStream(text,SynthesisOptions(voiceId=voice,locale=locale)).collect { chunk ->
              if(chunk.samples.isNotEmpty() && first<0) first=SystemClock.elapsedRealtime()-start
              assertTrue(chunk.sampleRateHz==24000)
              finalSeen=finalSeen||chunk.isFinal
              for(x in chunk.samples) {
                assertTrue(x.isFinite())
                samples++
                energy+=x.toDouble()*x
                val s=(x.coerceIn(-1f,1f)*32767).toInt()
                out.write(s and 255);out.write((s shr 8) and 255)
              }
            }
          }
        }
        val elapsed=SystemClock.elapsedRealtime()-start
        Log.i("HITEL_POCKET_PROBE","ORIGINAL_NATIVE_PCM index=$index locale=$locale firstMs=$first totalMs=$elapsed samples=$samples rtf="+elapsed.toDouble()*24/samples+" final=$finalSeen")
        assertTrue(first>=0&&samples>2400&&energy>0.00001&&finalSeen)
      }
    }
    Unit
  }
}
