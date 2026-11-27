from pathlib import Path
import shutil,sys
root=Path(sys.argv[1])
base=root/"Android/src/app/src/main/java/com/google/ai/edge/gallery"
here=Path(__file__).resolve().parent
def change(p,a,b):
    s=p.read_text()
    assert s.count(a)==1,(str(p),s.count(a),a)
    p.write_text(s.replace(a,b,1))
shutil.copy2(here/"HitelGlobalAsrCard.kt",base/"ui/home/HitelGlobalAsrCard.kt")
change(base/"ui/home/HomeScreen.kt","                // Tab header for categories.","                HitelGlobalAsrCard(modelManagerViewModel)\n\n                // Tab header for categories.")
settings=base/"services/asr/AsrSettingsRepository.kt"
change(settings,"  /** Updates the persisted BCP-47 language code for ASR recognition. */",'''  /** Atomic, explicit global selection used by every common ASR entry point. */
  fun setGlobalLocalAsr(languageCode: String) {
    require(languageCode == "ko-KR" || languageCode == "en-US")
    update { builder ->
      builder.selectedModelId = AsrModelRegistry.modelId(AsrEngineType.MLKIT_BASIC)
      builder.selectedLanguageCode = languageCode
      builder.isExplicitlySelected = true
    }
  }

  /** Startup migration for a previously installed Korean pack without a saved explicit locale.
   * Runs against the persisted proto too when asynchronous initial load is still in progress.
   * Never overwrites a deliberate saved language/engine selection.
   */
  fun preferInstalledLocalKorean() {
    update { builder ->
      val basic = AsrModelRegistry.modelId(AsrEngineType.MLKIT_BASIC)
      if (!builder.isExplicitlySelected ||
          (builder.selectedModelId == basic && builder.selectedLanguageCode.isEmpty())) {
        builder.selectedModelId = basic
        builder.selectedLanguageCode = "ko-KR"
        builder.isExplicitlySelected = true
      }
    }
  }

  /** Updates the persisted BCP-47 language code for ASR recognition. */''')
change(settings,"  ): AsrSessionSettings {\n    val currentModelId = _selectedModelId.value","  ): AsrSessionSettings = synchronized(lock) {\n    val currentModelId = modelIdOf(settings)")
change(settings,"    return AsrSessionSettings(\n      modelId = resolvedModelId,\n      languageCode = languageCodeOverride ?: _selectedLanguageCode.value,\n      showInterimResults = _showInterimResults.value,\n    )","    AsrSessionSettings(\n      modelId = resolvedModelId,\n      languageCode = languageCodeOverride ?: languageCodeOf(settings),\n      showInterimResults = showInterimResultsOf(settings),\n    )")
# Change the global repository default, not language metadata for unrelated English-only models.
change(settings,"    fun languageCodeOf(languageCode: String): String = languageCode.ifEmpty {\n      AsrDefaults.LANGUAGE_CODE\n    }",'''    fun languageCodeOf(languageCode: String): String = languageCode.ifEmpty {
      "ko-KR"
    }''')
change(base/"ui/modelmanager/ModelManagerViewModel.kt","  init {\n    observeTtsSettingsUiState()","  init {\n    if (com.hitel.soda.sdk.LocalSodaSdk.installed(context, \"ko-KR\")) {\n      asrSettingsRepository.preferInstalledLocalKorean()\n    }\n    observeTtsSettingsUiState()")
change(base/"ui/modelmanager/HitelLocalPackPanel.kt","                manager.setLanguagePackStatus(model,locale,ModelDownloadStatus(status=ModelDownloadStatusType.SUCCEEDED))","                manager.asrSettingsRepository.setGlobalLocalAsr(locale)\n                manager.setLanguagePackStatus(model,locale,ModelDownloadStatus(status=ModelDownloadStatusType.SUCCEEDED))")
change(base/"services/asr/HitelLocalSodaAsrService.kt",'@Volatile private var language="en-US"','@Volatile private var language="ko-KR"')
provider=base/"services/asr/AsrServiceProvider.kt"
change(provider,"    val prepConfig = effectiveSettings.preparationConfig()","    val prepConfig = effectiveSettings.preparationConfig()\n    Log.i(TAG, \"GLOBAL_ASR_PREPARE engine=\${candidate.engineType} locale=\${prepConfig.languageCode}\")".replace("\\$", "$"))
# XR conversation uses exactly the shared Basic locale, not its separate native-language preference.
teacher=base/"customtasks/xrlanguageteacher/services/XrLanguageTeacherAsrCoordinator.kt"
change(teacher,"  val supportedTags = getSupportedLocaleTagsForAsrModel(selectedAsrModelID.value)\n  return resolveEngineLocaleTagForLanguage(mainLang, supportedTags)",'''  if (selectedAsrEngineType == com.google.ai.edge.gallery.services.asr.AsrEngineType.MLKIT_BASIC) {
    return asrSettingsRepository.selectedLanguageCode.value
  }
  val supportedTags = getSupportedLocaleTagsForAsrModel(selectedAsrModelID.value)
  return resolveEngineLocaleTagForLanguage(mainLang, supportedTags)''')
# Vocabulary games intentionally recognize the study language; don't silently switch the global
# local engine to System Speech if its study-language pack is absent.
game=base/"customtasks/xrlanguageteacher/services/XrLanguageTeacherGameAsr.kt"
change(game,"  val systemConfig =\n    AsrSessionSettings(","  if (engineType == AsrEngineType.MLKIT_BASIC) {\n    Log.w(TAG, \"Global local ASR has no ready study-language pack; no fallback\")\n    return null\n  }\n  val systemConfig =\n    AsrSessionSettings(")
print("HITEL_GLOBAL_ASR_HOME_AND_SHARED_SETTINGS_CONNECTED")
