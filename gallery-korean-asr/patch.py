from pathlib import Path
import sys
root=Path(sys.argv[1])/"app/src/main/java/com/google/ai/edge/gallery"
def edit(path, pairs):
    p=root/path
    s=p.read_text()
    for a,b in pairs:
        assert s.count(a)==1,(path,a,s.count(a))
        s=s.replace(a,b,1)
    p.write_text(s)
    print("PATCH",path,len(pairs))
edit("services/asr/AsrModelMetadata.kt",[
('const val LANGUAGE_CODE = "en-US"','const val LANGUAGE_CODE = "ko-KR"')])
edit("services/asr/AsrSettingsRepository.kt",[
('proto.selectedModelId.ifEmpty { AsrModelIdentifier.SYSTEM_DEFAULT }','proto.selectedModelId.ifEmpty { AsrModelIdentifier.MLKIT_BASIC }'),
('    _isExplicitlySelected.value = proto.isExplicitlySelected','''    _isExplicitlySelected.value = proto.isExplicitlySelected
    Log.i("HITEL_ASR", "SETTINGS model=${_selectedModelId.value} engine=${_selectedEngineType.value} locale=${_selectedLanguageCode.value} explicit=${proto.isExplicitlySelected}")''')])
edit("services/asr/AsrServiceProvider.kt",[
('import kotlinx.coroutines.launch','import kotlinx.coroutines.launch\nimport kotlinx.coroutines.withTimeoutOrNull'),
('        val status = engine.checkStatus()','''        val language = asrSettingsRepository.selectedLanguageCode.value
        val status = if (engineType == AsrEngineType.MLKIT_BASIC) engine.checkLanguageStatus(language) else engine.checkStatus()
        Log.i("HITEL_ASR", "PROBE engine=$engineType locale=$language status=$status reason=${engine.unavailabilityReason}")'''),
('    val prepConfig = effectiveSettings.preparationConfig()','''    val prepConfig = effectiveSettings.preparationConfig()
    Log.i("HITEL_ASR", "PREPARE selected=${asrSettingsRepository.selectedEngineType.value} actual=${candidate.engineType} locale=${prepConfig.languageCode} model=${prepConfig.modelId}")'''),
('      candidate.prepare(prepConfig)\n      candidate','''      candidate.prepare(prepConfig)
      Log.i("HITEL_ASR", "READY engine=${candidate.engineType} locale=${prepConfig.languageCode}")
      candidate'''),
('        systemEngine.prepare(prepConfig)','''        Log.w("HITEL_ASR", "FALLBACK engine=SYSTEM_DEFAULT locale=${prepConfig.languageCode}")
        systemEngine.prepare(prepConfig.copy(modelId = AsrModelIdentifier.SYSTEM_DEFAULT))'''),
('  /** Gracefully stops recording on all instantiated engines. */','''  /** Download the requested Korean pack only when the user starts dictation. */
  suspend fun ensureKoreanPackForDictation() = mutex.withLock {
    val settings = asrSettingsRepository.currentSessionSettings()
    if (settings.engineType != AsrEngineType.MLKIT_BASIC || settings.languageCode != "ko-KR") return@withLock
    val engine = getOrCreateEngine(AsrEngineType.MLKIT_BASIC) ?: return@withLock
    try {
      val status = engine.checkLanguageStatus("ko-KR")
      Log.i("HITEL_ASR", "KOREAN_PACK status=$status reason=${engine.unavailabilityReason}")
      if (status == AsrServiceStatus.NotDownloaded) {
        val completed = withTimeoutOrNull(90_000L) {
          engine.downloadLanguage("ko-KR").collect { state ->
            Log.i("HITEL_ASR", "KOREAN_PACK_DOWNLOAD state=$state")
          }
          true
        }
        Log.i("HITEL_ASR", "KOREAN_PACK_DOWNLOAD_END completed=$completed status=${engine.checkLanguageStatus("ko-KR")}")
      }
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      Log.e("HITEL_ASR", "KOREAN_PACK_DOWNLOAD_FAILED", e)
    }
  }

  /** Gracefully stops recording on all instantiated engines. */'''),
('  val service = prepareActiveService()\n  if (shouldAbortAfterPrepare())','''  ensureKoreanPackForDictation()
  val service = prepareActiveService()
  Log.i("HITEL_ASR", "DICTATION_BEGIN actual=${service.engineType}")
  if (shouldAbortAfterPrepare())'''),
('    onTranscriptChanged = onTranscriptChanged,','''    onTranscriptChanged = { transcript ->
      Log.d("HITEL_ASR", "DICTATION_TRANSCRIPT chars=${transcript.length}")
      onTranscriptChanged(transcript)
    },'''),
('  onRecordingCompleted()\n}', '''  Log.i("HITEL_ASR", "DICTATION_END engine=${service.engineType}")
  onRecordingCompleted()
}''')])
edit("services/asr/MlKitAsrService.kt",[
('    this.preparedConfig = config','''    this.preparedConfig = config
    Log.i("HITEL_ASR", "MLKIT_PREPARE engine=$engineType locale=${config.languageCode} speechServices=${speechServicesVersionCodeProvider()}")'''),
('    val externalAudioSource = options.externalAudioSource','''    val externalAudioSource = options.externalAudioSource
    Log.i("HITEL_ASR", "MLKIT_RECORD engine=$engineType locale=${preparedConfig.languageCode} externalPcm=${externalAudioSource != null}")'''),
('            is SpeechRecognizerResponse.FinalTextResponse -> {','''            is SpeechRecognizerResponse.FinalTextResponse -> {
              Log.i("HITEL_ASR", "MLKIT_FINAL chars=${response.text.length}")'''),
('            is SpeechRecognizerResponse.CompletedResponse -> {','''            is SpeechRecognizerResponse.CompletedResponse -> {
              Log.i("HITEL_ASR", "MLKIT_COMPLETED chars=${finalizedSegments.length}")''')])
edit("services/asr/SystemSpeechAsrService.kt",[
('    preparedConfig = config\n    val currentStatus = checkStatus()','''    preparedConfig = config
    Log.i("HITEL_ASR", "SYSTEM_PREPARE locale=${config.languageCode}")
    val currentStatus = checkStatus()'''),
('            override fun onError(error: Int) {','''            override fun onError(error: Int) {
              Log.e("HITEL_ASR", "SYSTEM_ERROR code=$error locale=${preparedConfig.languageCode}")''')])
# Legacy intent is unused by the active router but keep its locale consistent.
edit("ui/common/asr/HoldToDictateViewModel.kt",[
('putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")','putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR")')])
print("KOREAN_ASR_PATCH_COMPLETE")
