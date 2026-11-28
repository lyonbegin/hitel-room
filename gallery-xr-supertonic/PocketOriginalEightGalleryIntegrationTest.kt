package com.google.ai.edge.gallery.services.tts

import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.ai.edge.gallery.data.AllowedModel
import com.google.gson.Gson
import java.io.File
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.flow.collect
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketOriginalEightGalleryIntegrationTest {
  @Test fun originalPocketTtsAndKorean() = runBlocking {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val id = TtsModelIdentifier.MEDIAPIPE_POCKET_TTS_100M
    val model = checkNotNull(Gson().fromJson("""{"name":"PocketTTS 100M (TTS)","modelId":"litert-community/pocket-tts","modelFile":"pocket_tts_int8.litertlm","commitHash":"bca93d6756489f9403f94d66826cfa65f80023a1","description":"Pocket TTS","sizeInBytes":760061960,"modelType":"tts","taskTypes":[],"ttsConfig":{"engineModelId":"mediapipe_pocket_tts_100m","defaultVoice":"alba","languages":["en-US","fr-FR","de-DE","es-ES","it-IT","pt-BR","nl-NL"]}}""",AllowedModel::class.java).toModel())
    val previous = TtsModelRegistry.registeredAllowlistModels
    TtsModelRegistry.registerAllowlistModels(listOf(model))
    val source = File(context.filesDir,"pocketprobe/baseline/pocket_tts_int8.litertlm")
    assertTrue("Missing baseline",source.isFile)
    val dest=File(model.getPath(context))
    check(dest.parentFile!!.isDirectory || dest.parentFile!!.mkdirs())
    source.copyTo(dest,overwrite=true)
    val engine=MediaPipeTtsEngine(context)
    try {
      val meta=engine.availableModels.single { it.modelId == id }
      assertEquals(8,meta.supportedLanguages.distinct().size)
      assertTrue(meta.supportedLanguages.contains("ko-KR"))
      assertTrue(meta.availableVoices.contains("ko_hitel"))
      for ((index,locale) in listOf("en-US","fr-FR","en-US","ko-KR","en-US","ko-KR").withIndex()) {
        val cfg=TtsConfig(modelId=id,languageCode=locale,voiceId=when(locale){"ko-KR"->"ko_hitel";"fr-FR"->"estelle";else->"alba"})
        val text=when(locale){"ko-KR"->"안녕하세요. 한국어 음성 합성 시험입니다.";"fr-FR"->"Bonjour tout le monde.";else->"Hello world."}
        val file=File(context.filesDir,"pocketprobe/gallery-$index.pcm")
        withTimeout(180_000L) {
          engine.prepare(cfg)
          val start=android.os.SystemClock.elapsedRealtime()
          var first=-1L
          file.outputStream().buffered().use { out ->
            (engine.synthesize(text,cfg) as TtsOutput.AudioStream).flow.collect {
              if(it.isNotEmpty()&&first<0)first=android.os.SystemClock.elapsedRealtime()-start
              out.write(it)
            }
          }
          Log.i("HITEL_POCKET_EIGHT","GALLERY_EIGHT_TIMING index=$index locale=$locale firstMs=$first totalMs="+(android.os.SystemClock.elapsedRealtime()-start))
          assertTrue(first>=0)
        }
        assertTrue("PCM size",file.length() > 4800)
        assertTrue("PCM nonzero",file.readBytes().any { it.toInt()!=0 })
        Log.i("HITEL_POCKET_KO","GALLERY_POCKET_PCM_PASS locale=$locale bytes="+file.length())
      }
    } finally {
      engine.release()
      TtsModelRegistry.registerAllowlistModels(previous)
    }
    Unit
  }
}
