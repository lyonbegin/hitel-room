from pathlib import Path
import json, sys, shutil
root=Path(sys.argv[1])
base=root/"Android/src/app/src/main/java/com/google/ai/edge/gallery"
here=Path(__file__).resolve().parent
def replace(path, old, new):
    p=base/path
    s=p.read_text()
    assert s.count(old)==1,(str(p),s.count(old),old)
    p.write_text(s.replace(old,new,1))
def insert(path, marker, addition):
    replace(path,marker,addition+marker)
replace("services/asr/AsrModelMetadata.kt",'const val LANGUAGE_CODE = "en-US"','const val LANGUAGE_CODE = "ko-KR"')
insert("data/ModelEnums.kt",'  @SerializedName("mlkit_asr")','''  @SerializedName("sherpa_onnx")
  SHERPA_ONNX(
    downloadsViaRepository = false,
    autoDownloadsOnStartup = false,
    supportsTopLevelDownload = true,
    supportsDelete = true,
    installsLanguagePacks = false,
  ),
''')
replace("services/tts/TtsEngineType.kt","  MEDIAPIPE,","  MEDIAPIPE,\n  SUPERTONIC,")
insert("services/tts/TtsConstants.kt","  /** Backward-compatible legacy alias.",'  const val SHERPA_SUPERTONIC_3 = "sherpa_supertonic_3"\n\n')
insert("services/tts/TtsModule.kt","  companion object {",'''  @Binds
  @IntoMap
  @RuntimeTypeKey(RuntimeType.SHERPA_ONNX)
  abstract fun bindSupertonicDownloader(downloader: MlKitTtsModelDownloader): ModelDownloader

''')
insert("services/tts/TtsModule.kt","    /** Provides the central",'''    @Provides
    @Singleton
    @IntoMap
    @TtsEngineKey(TtsEngineType.SUPERTONIC)
    fun provideSupertonicTtsEngine(@ApplicationContext context: Context): TtsService =
      SupertonicTtsEngine(context)

''')
replace("services/tts/TtsModelRegistry.kt","it.modelType == ModelType.TTS && it.backendSpec.runtimeType == RuntimeType.LITERT_LM","it.modelType == ModelType.TTS && it.backendSpec.runtimeType in setOf(RuntimeType.LITERT_LM, RuntimeType.SHERPA_ONNX)")
langs="ko-KR en-US ja-JP fr-FR es-ES de-DE pt-BR it-IT hi-IN id-ID ar-SA ru-RU nl-NL pl-PL tr-TR da-DK sv-SE fi-FI cs-CZ bg-BG el-GR et-EE hr-HR hu-HU lt-LT lv-LV ro-RO sk-SK sl-SI uk-UA vi-VN".split()
model=dict(name="Supertonic 3 (TTS)",modelId="hitel/supertonic-3-int8",modelFile="sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2",commitHash="2026-05-11",description="Offline multilingual Supertonic 3 INT8 (Sherpa-ONNX).",sizeInBytes=128774318,minDeviceMemoryInGb=4,modelType="tts",runtimeType="sherpa_onnx",taskTypes=[],url="https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2",ttsConfig=dict(engineModelId="sherpa_supertonic_3",defaultVoice="0",languages=langs))
# Overlay only; do not replace Google's remote allowlist or modify existing device gates.
replace("ui/modelmanager/ModelManagerViewModel.kt","for (allowedModel in modelAllowlist.models) {",'''val supertonic = Gson().fromJson(
          """'''+json.dumps(model,ensure_ascii=False,separators=(",",":"))+'''""",
          com.google.ai.edge.gallery.data.AllowedModel::class.java,
        )
        for (allowedModel in modelAllowlist.models.filterNot { it.name == supertonic.name } + supertonic) {''')
insert("data/supplementary/SupplementarySpeechModelRepository.kt","    // File-backed LiteRT models.",'''    if (model.backendSpec.runtimeType == RuntimeType.SHERPA_ONNX) {
      return if (com.google.ai.edge.gallery.services.tts.SupertonicTtsEngine.installed(context)) {
        SpeechModelState.Ready(voices = extractVoicesForModel(model))
      } else {
        SpeechModelState.Downloadable(totalBytes = model.downloadInfo.totalBytes)
      }
    }

''')
# Existing generic HUD uses a neutral label until new engine icon/enum is added;
# don't mislabel it as Kokoro or platform. Voice IDs are explicit, provisional.
insert("customtasks/xrlanguageteacher/models/XrLanguageTeacherPersonaVoices.kt","      TtsModelIdentifier.MEDIAPIPE_POCKET_TTS_100M to POCKET_TTS,",'''      TtsModelIdentifier.SHERPA_SUPERTONIC_3 to PersonaVoiceTable(
        defaultVoices = mapOf(
          CharacterPersona.BUDDY to "0",
          CharacterPersona.NERDY to "1",
          CharacterPersona.SECRET_AGENT to "2",
          CharacterPersona.WIZARD to "3",
        ),
      ),
''')
shutil.copy2(here/"SupertonicTtsEngine.kt",base/"services/tts/SupertonicTtsEngine.kt")
# Only add dependency; do not replace upstream libraries.
gradle=root/"Android/src/app/build.gradle.kts"
s=gradle.read_text()
assert s.count("dependencies {")==1
gradle.write_text(s.replace("dependencies {",'''dependencies {
  implementation(files("libs/sherpa-onnx-2.0.3.aar"))
  implementation("org.apache.commons:commons-compress:1.27.1")
''',1))
# Add a real instrumentation test (runs the very same engine used by XR).
test=root/"Android/src/app/src/androidTest/java/com/google/ai/edge/gallery/services/tts/SupertonicDeviceTest.kt"
test.parent.mkdir(parents=True,exist_ok=True)
test.write_text('''package com.google.ai.edge.gallery.services.tts

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.flow.collect
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.*
import java.io.File

@RunWith(AndroidJUnit4::class)
class SupertonicDeviceTest {
  @Test fun koreanAndEnglish() = runBlocking {
    val context=InstrumentationRegistry.getInstrumentation().targetContext
    val engine=SupertonicTtsEngine(context)
    try {
      engine.downloadModel(SupertonicTtsEngine.ID,SupertonicTtsEngine.SIZE).collect {}
      assertTrue(SupertonicTtsEngine.installed(context))
      for ((locale,text) in listOf("ko-KR" to "안녕하세요. 한국어 음성 합성 시험입니다.", "en-US" to "Hello. This is an English speech synthesis test.")) {
        val cfg=TtsConfig(modelId=SupertonicTtsEngine.ID,languageCode=locale,voiceId="0")
        engine.prepare(cfg)
        val file=File(context.filesDir,"supertonic-test-"+locale+".pcm")
        file.outputStream().use { output ->
          (engine.synthesize(text,cfg) as TtsOutput.AudioStream).flow.collect { output.write(it) }
        }
        assertTrue("PCM length",file.length()>24000)
        assertTrue("PCM nonzero",file.readBytes().any { it.toInt()!=0 })
      }
    } finally { engine.release() }
  }
}
''')
print("PATCH_APPLIED",len(langs),"languages")
