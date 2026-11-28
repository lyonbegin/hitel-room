"""Apply Korean Pocket TTS companion integration to the pinned Gallery source.
Existing download URLs, model IDs, UI, and native SDK stay unchanged.
"""
from pathlib import Path
import sys,shutil
root=Path(sys.argv[1])
base=root/"Android/src/app/src/main/java/com/google/ai/edge/gallery"
here=Path(__file__).resolve().parent
def replace(path,old,new):
    p=base/path
    s=p.read_text()
    assert s.count(old)==1,(path,s.count(old),old)
    p.write_text(s.replace(old,new,1))

engine="services/tts/MediaPipeTtsEngine.kt"
replace(engine,'''      TextToSpeechSynthesizer(
        TextToSpeech.create(
          TextToSpeechOptions(
            baseOptions =
              BaseOptions.builder().setModelAssetPath(modelPath).setDelegate(delegate).build(),
            defaultVoiceId = null,
            defaultLocale = DEFAULT_TTS_LANGUAGE_CODE,
            cacheDirectory = File(context.cacheDir, CACHE_DIRECTORY_NAME).absolutePath,
          )
        )
      )''','''      val create: (String) -> MediaPipeSynthesizer = { path ->
        TextToSpeechSynthesizer(
          TextToSpeech.create(
            TextToSpeechOptions(
              baseOptions =
                BaseOptions.builder().setModelAssetPath(path).setDelegate(delegate).build(),
              defaultVoiceId = null,
              defaultLocale = DEFAULT_TTS_LANGUAGE_CODE,
              cacheDirectory = File(context.cacheDir, CACHE_DIRECTORY_NAME).absolutePath,
            )
          )
        )
      }
      if (File(modelPath).name == "pocket_tts_int8.litertlm") {
        HitelPocketKoreanRoutingSynthesizer(context, modelPath, create)
      } else {
        create(modelPath)
      }''')
models="services/tts/MediaPipeTtsModels.kt"
replace(models,'      "alba" to "en-US",','      "hitelko" to "ko-KR",\n      "alba" to "en-US",')
replace(models,'          "daan",\n        ),\n      defaultLanguages = listOf("en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "pt-BR", "nl-NL"),','          "daan",\n          "hitelko",\n        ),\n      defaultLanguages = listOf("en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "pt-BR", "nl-NL", "ko-KR"),')
# Augment the allowed-model profile before it is converted to Model.
# Applies equally to remote and bundled allowlists. Keep original download metadata.
replace("data/ModelAllowlist.kt","          languages = ttsConfig.languages,","""          languages = if (ttsConfig.engineModelId == "mediapipe_pocket_tts_100m") {
            (ttsConfig.languages + "ko-KR").distinct()
          } else ttsConfig.languages,""")
replace("customtasks/xrlanguageteacher/models/XrLanguageTeacherPersonaVoices.kt",
        '          "nl-NL" to CharacterPersona.entries.associateWith { "daan" },',
        '          "nl-NL" to CharacterPersona.entries.associateWith { "daan" },\n          "ko-KR" to CharacterPersona.entries.associateWith { "hitelko" },')
shutil.copy2(here/"HitelPocketKoreanRoutingSynthesizer.kt",base/"services/tts/HitelPocketKoreanRoutingSynthesizer.kt")
print("POCKET_KOREAN_INTEGRATION_PATCH_PASS")
