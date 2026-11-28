"""Integrate validated eight-language Pocket TTS without replacing the engine."""
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
replace(engine,
    'val modelFile = withContext(ioDispatcher) { resolveModelFile(spec.engineModelId) }',
    '''val modelFile = withContext(ioDispatcher) {
          resolveModelFile(spec.engineModelId)?.let { original ->
            if (spec.engineModelId == TtsModelIdentifier.MEDIAPIPE_POCKET_TTS_100M) {
              HitelPocketEightModel.install(context, original)
            } else original
          }
        }''')
replace(engine,
    'val listed = synthesizer.listVoiceIds().filter(spec.voiceIdFilter)',
    '''val nativeVoices = synthesizer.listVoiceIds().filter(spec.voiceIdFilter)
        val listed = if (spec.engineModelId == TtsModelIdentifier.MEDIAPIPE_POCKET_TTS_100M) {
          if (HitelPocketEightModel.installed(context)) (nativeVoices + "ko_hitel").distinct() else nativeVoices
        } else nativeVoices''')
models="services/tts/MediaPipeTtsModels.kt"
replace(models,'      "alba" to "en-US",','      "ko_hitel" to "ko-KR",\n      "alba" to "en-US",')
replace(models,'          "daan",\n        ),\n      defaultLanguages = listOf("en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "pt-BR", "nl-NL"),','          "daan",\n          "ko_hitel",\n        ),\n      defaultLanguages = listOf("en-US", "fr-FR", "de-DE", "es-ES", "it-IT", "pt-BR", "nl-NL", "ko-KR"),')
replace("data/ModelAllowlist.kt","          languages = ttsConfig.languages,","""          languages = if (ttsConfig.engineModelId == "mediapipe_pocket_tts_100m") {
            (ttsConfig.languages + "ko-KR").distinct()
          } else ttsConfig.languages,""")
replace("customtasks/xrlanguageteacher/models/XrLanguageTeacherPersonaVoices.kt",
        '          "nl-NL" to CharacterPersona.entries.associateWith { "daan" },',
        '          "nl-NL" to CharacterPersona.entries.associateWith { "daan" },\n          "ko-KR" to CharacterPersona.entries.associateWith { "ko_hitel" },')
shutil.copy2(here/"HitelPocketEightModel.kt",base/"services/tts/HitelPocketEightModel.kt")
shutil.copy2(here/"HitelPocketLocalPackPanel.kt",base/"ui/modelmanager/HitelPocketLocalPackPanel.kt")
replace("ui/modelmanager/TtsModelDetails.kt",'''        SupplementaryModelDetails(
          card = card,''','''        if (model.ttsProfile?.engineModelId == "mediapipe_pocket_tts_100m") {
          HitelPocketLocalPackPanel()
        }
        SupplementaryModelDetails(
          card = card,''')
p=root/"Android/src/app/build.gradle.kts"
s=p.read_text()
old='  implementation(libs.tasks.audio)'
assert s.count(old)==1
p.write_text(s.replace(old,'  implementation(files("libs/tasks-audio-1.2.0-ko.aar"))',1))
assert not (base/"services/tts/HitelPocketKoreanRoutingSynthesizer.kt").exists()
print("POCKET_ORIGINAL_SINGLE_ENGINE_INTEGRATION_PASS")
