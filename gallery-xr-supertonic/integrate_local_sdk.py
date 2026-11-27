from pathlib import Path
import sys, shutil
root=Path(sys.argv[1]).resolve()
here=Path(__file__).resolve().parent/"local-sdk"
android=root/"Android/src"
base=android/"app/src/main/java/com/google/ai/edge/gallery"
def change(p,a,b):
    s=p.read_text()
    assert s.count(a)==1,(str(p),s.count(a),a)
    p.write_text(s.replace(a,b,1))
def write(p,s):
    p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
module=android/"hitel-local-soda-sdk"
write(module/"build.gradle.kts",'''plugins { id("com.android.library") }
android {
  namespace = "com.hitel.soda.sdk"
  compileSdk { this.version = release(37) { minorApiLevel = 0 } }
  defaultConfig { minSdk = 31 }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
  }
}
''')
write(module/"src/main/AndroidManifest.xml",'''<manifest xmlns:android="http://schemas.android.com/apk/res/android">
<queries><package android:name="com.google.android.tts"/></queries>
</manifest>''')
for rel,name in [("com/hitel/soda/sdk","LocalSodaSdk.java"),("com/google/android/libraries/assistant/soda","Soda.java")]:
    p=module/"src/main/java"/rel/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(here/name,p)
change(android/"build.gradle.kts","  alias(libs.plugins.android.application) apply false","  alias(libs.plugins.android.application) apply false\n  id(\"com.android.library\") version \"9.0.1\" apply false")
with (android/"settings.gradle.kts").open("a") as f:f.write('\ninclude(":hitel-local-soda-sdk")\n')
# Same upstream dependency versions, with Google's Central mirror before Maven Central.
settings=android/"settings.gradle.kts"
s=settings.read_text()
assert s.count("    mavenCentral()")==2
settings.write_text(s.replace("    mavenCentral()", '    maven { url = uri("https://maven-central.storage-download.googleapis.com/maven2") }\n    mavenCentral()'))
change(android/"app/build.gradle.kts","dependencies {","dependencies {\n  implementation(project(\":hitel-local-soda-sdk\"))")
shutil.copy2(here/"HitelLocalSodaAsrService.kt",base/"services/asr/HitelLocalSodaAsrService.kt")
change(base/"di/SpeechServicesModule.kt","      MlKitAsrService(context, AsrEngineType.MLKIT_BASIC)","      com.google.ai.edge.gallery.services.asr.HitelLocalSodaAsrService(context)")
# Preserve Basic model id and Gallery selection paths. No dummy SODA model.
import subprocess
subprocess.run(["git","-C",str(root),"restore","--source=HEAD","--",str((base/"ui/modelmanager/TaskModelSelectionViewModel.kt").relative_to(root))],check=True)
# The original Basic gate still checks installed speech package version. New SDK also
# verifies the exact native library hash at import/prepare, and reports actual readiness.
card=base/"ui/common/modelitem/ModelRadioItem.kt"
s=card.read_text()
start=s.index("private data class HitelSodaPack")
s=s[:start]
a=s.index("      if (selected && selectable && modelManagerViewModel != null &&")
b=s.index("      // Explain why",a)
s=s[:a]+'''      if (modelManagerViewModel != null &&
        AsrModelRegistry.engineTypeForModelId(model.modelId) == AsrEngineType.MLKIT_BASIC) {
        com.google.ai.edge.gallery.ui.modelmanager.HitelLocalPackPanel(model, modelManagerViewModel)
      }

'''+s[b:]
card.write_text(s.rstrip()+"\n")
# The supported pack list matches the SDK's exact known hashes, not the old remote catalog.
reg=base/"services/asr/AsrModelRegistry.kt"
s=reg.read_text()
a="allowlistLanguages(AsrModelIdentifier.MLKIT_BASIC).ifEmpty { MLKIT_BASIC_SUPPORTED_LOCALES }"
assert s.count(a)==1
reg.write_text(s.replace(a,'listOf("ko-KR", "en-US")'))
# Both XR teacher's existing download action and Basic's model-card picker now import a file.
shutil.copy2(here/"HitelLocalPackPanel.kt",base/"ui/modelmanager/HitelLocalPackPanel.kt")
xr=base/"customtasks/xrlanguageteacher/views/XrLanguageTeacherLanguagePackBinding.kt"
change(xr,"  val modelManagerUiState by modelManagerViewModel.uiState.collectAsStateWithLifecycle()",
'''  val localPicker = com.google.ai.edge.gallery.ui.modelmanager.rememberHitelLocalPackPicker(modelManagerViewModel)
  val modelManagerUiState by modelManagerViewModel.uiState.collectAsStateWithLifecycle()''')
change(xr,"  return remember(uiState, engines) {","  return remember(uiState, engines, localPicker) {")
change(xr,"          modelManagerViewModel.downloadLanguagePack(pack.model, pack.languageTag)",
'''          if (com.google.ai.edge.gallery.services.asr.AsrModelRegistry.engineTypeForModelId(pack.model.modelId) ==
            com.google.ai.edge.gallery.services.asr.AsrEngineType.MLKIT_BASIC) {
            localPicker(pack.model)
          } else {
            modelManagerViewModel.downloadLanguagePack(pack.model, pack.languageTag)
          }''')

# Model Manager's Supplementary tab uses the same local file picker.
global_card=base/"ui/modelmanager/TtsModelDetails.kt"
change(global_card,"""  modelManagerViewModel: ModelManagerViewModel,
): SupplementaryModelsActions =
  remember(supplementaryModelsViewModel, modelManagerViewModel) {""",
"""  modelManagerViewModel: ModelManagerViewModel,
): SupplementaryModelsActions {
  val localPicker = rememberHitelLocalPackPicker(modelManagerViewModel)
  return remember(supplementaryModelsViewModel, modelManagerViewModel, localPicker) {""")
change(global_card,"""        modelManagerViewModel.downloadLanguagePack(model, languageCode)""",
"""        if (com.google.ai.edge.gallery.services.asr.AsrModelRegistry.engineTypeForModelId(model.modelId) ==
          com.google.ai.edge.gallery.services.asr.AsrEngineType.MLKIT_BASIC) localPicker(model)
        else modelManagerViewModel.downloadLanguagePack(model, languageCode)""")
change(global_card,"""        modelManagerViewModel.downloadModelAfterMobileDataCheck(task = null, model = model)""",
"""        if (com.google.ai.edge.gallery.services.asr.AsrModelRegistry.engineTypeForModelId(model.modelId) ==
          com.google.ai.edge.gallery.services.asr.AsrEngineType.MLKIT_BASIC) localPicker(model)
        else modelManagerViewModel.downloadModelAfterMobileDataCheck(task = null, model = model)""")
change(global_card,"""      onStopVoicePreview = modelManagerViewModel::stopVoicePreview,
    )
  }""","""      onStopVoicePreview = modelManagerViewModel::stopVoicePreview,
    )
  }
}""")
change(global_card,"""        SupplementaryModelDetails(
          card = card,""",
"""        if (com.google.ai.edge.gallery.services.asr.AsrModelRegistry.engineTypeForModelId(model.modelId) ==
          com.google.ai.edge.gallery.services.asr.AsrEngineType.MLKIT_BASIC) {
          HitelLocalPackPanel(model, viewModel)
        }
        SupplementaryModelDetails(
          card = card,""")
change(reg,"""  fun supportedLanguages(model: Model): List<String> {
    model.asrProfile""","""  fun supportedLanguages(model: Model): List<String> {
    if (engineTypeForModelId(model.modelId) == AsrEngineType.MLKIT_BASIC) return listOf("ko-KR", "en-US")
    model.asrProfile""")

print("LOCAL_SODA_SDK_MODULE_AND_BASIC_PROVIDER_CONNECTED")
