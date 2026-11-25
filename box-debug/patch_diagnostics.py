from pathlib import Path
import sys

root=Path(sys.argv[1])
app=root/"app/src/main/java/com/google/ai/edge/gallery"
count=0
def edit(path, changes):
    global count
    s=path.read_text()
    for old,new in changes:
        if s.count(old)!=1:
            raise RuntimeError(f"{path}: expected one match, got {s.count(old)}: {old[:120]}")
        s=s.replace(old,new,1)
        count+=1
    path.write_text(s)
    print("PATCHED",path)

edit(root/"app/src/main/java/com/box/gallery/GalleryApplication.kt",[
("    super.onCreate()",'''    super.onCreate()
    android.util.Log.i("HITEL_BOX", "APP_START package=$packageName sdk=${android.os.Build.VERSION.SDK_INT} device=${android.os.Build.MODEL}")
    registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
      override fun onActivityCreated(a: android.app.Activity, b: android.os.Bundle?) { android.util.Log.i("HITEL_BOX", "ACTIVITY_CREATED ${a.javaClass.simpleName}") }
      override fun onActivityStarted(a: android.app.Activity) {}
      override fun onActivityResumed(a: android.app.Activity) { android.util.Log.i("HITEL_BOX", "ACTIVITY_RESUMED ${a.javaClass.simpleName}") }
      override fun onActivityPaused(a: android.app.Activity) {}
      override fun onActivityStopped(a: android.app.Activity) {}
      override fun onActivitySaveInstanceState(a: android.app.Activity, b: android.os.Bundle) {}
      override fun onActivityDestroyed(a: android.app.Activity) { android.util.Log.i("HITEL_BOX", "ACTIVITY_DESTROYED ${a.javaClass.simpleName}") }
    })''')])
edit(app/"ui/common/textandvoiceinput/HoldToDictateViewModel.kt",[
('    speechRecognizer.startListening(recognizerIntent)','''    android.util.Log.i("HITEL_BOX", "ASR_SYSTEM_START language=${recognizerIntent.getStringExtra(RecognizerIntent.EXTRA_LANGUAGE)}")
    try {
      speechRecognizer.startListening(recognizerIntent)
    } catch (e: Exception) {
      android.util.Log.e("HITEL_BOX", "ASR_SYSTEM_START_FAILED", e)
      throw e
    }'''),
('  override fun onReadyForSpeech(params: Bundle?) {}','  override fun onReadyForSpeech(params: Bundle?) { android.util.Log.i("HITEL_BOX", "ASR_READY") }'),
('  override fun onBeginningOfSpeech() {}','  override fun onBeginningOfSpeech() { android.util.Log.i("HITEL_BOX", "ASR_SPEECH_BEGIN") }'),
('  override fun onEndOfSpeech() {}','  override fun onEndOfSpeech() { android.util.Log.i("HITEL_BOX", "ASR_SPEECH_END") }'),
('  override fun onError(error: Int) {}','''  override fun onError(error: Int) {
    android.util.Log.e("HITEL_BOX", "ASR_SYSTEM_ERROR code=$error")
    setRecognizing(false)
  }'''),
('  override fun onResults(results: Bundle?) {','''  override fun onResults(results: Bundle?) {
    android.util.Log.i("HITEL_BOX", "ASR_FINAL count=${results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.size ?: 0}")''')])
edit(app/"ui/whisper/WhisperViewModel.kt",[
('            recorder.startRecording()','''            android.util.Log.i("HITEL_BOX", "WHISPER_RECORD_START state=${recorder.state} rate=${WhisperEngine.SAMPLE_RATE} buffer=$bufferSize")
            recorder.startRecording()'''),
('                if (read > 0) {','''                if (read < 0) {
                    android.util.Log.e("HITEL_BOX", "WHISPER_PCM_READ_ERROR code=$read")
                    break
                }
                if (read > 0) {'''),
('            if (samples.isEmpty()) {','''            android.util.Log.i("HITEL_BOX", "WHISPER_PCM_READY samples=${samples.size} rate=16000")
            if (samples.isEmpty()) {'''),
('            val result = engine.transcribe(samples)','''            val startMs = android.os.SystemClock.elapsedRealtime()
            val result = try {
                engine.transcribe(samples)
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                android.util.Log.e("HITEL_BOX", "WHISPER_TRANSCRIBE_FAILED", e)
                _uiState.value = _uiState.value.copy(isTranscribing = false, errorMessage = "Whisper: " + e.javaClass.simpleName)
                return@launch
            }
            android.util.Log.i("HITEL_BOX", "WHISPER_RESULT chars=${result.length} elapsedMs=${android.os.SystemClock.elapsedRealtime()-startMs}")''')])
edit(root/"whisper/src/main/java/com/google/ai/edge/gallery/whisper/WhisperEngine.kt",[
('        contextHandle = loadModelNative(modelPath)','''        android.util.Log.i("HITEL_BOX", "WHISPER_LOAD_BEGIN exists=${java.io.File(modelPath).exists()} bytes=${java.io.File(modelPath).length()}")
        contextHandle = loadModelNative(modelPath)
        android.util.Log.i("HITEL_BOX", "WHISPER_LOAD_END loaded=${contextHandle != 0L}")'''),
('            transcribeNative(contextHandle, audioData, language)','''            android.util.Log.i("HITEL_BOX", "WHISPER_NATIVE_BEGIN language=$language samples=${audioData.size}")
            transcribeNative(contextHandle, audioData, language)''')])
edit(app/"ui/llmchat/LlmChatModelHelper.kt",[
('      val engine = Engine(engineConfig)\n      engine.initialize()','''      Log.i("HITEL_BOX", "LLM_INIT_BEGIN model=${model.name} backend=$accelerator maxTokens=$maxTokens fileExists=${java.io.File(modelPath).exists()} fileBytes=${java.io.File(modelPath).length()} tools=${tools.size}")
      val engine = Engine(engineConfig)
      engine.initialize()
      Log.i("HITEL_BOX", "LLM_ENGINE_READY")'''),
('      onDone(cleanUpMediapipeTaskErrorMessage(e.message ?: "Unknown error"))','''      Log.e("HITEL_BOX", "LLM_INIT_FAILED model=${model.name}", e)
      onDone(cleanUpMediapipeTaskErrorMessage(e.message ?: "Unknown error"))'''),
('    onDone("")','''    Log.i("HITEL_BOX", "LLM_INIT_SUCCESS model=${model.name}")
    onDone("")'''),
('      onError("LlmModelInstance is not initialized.")','''      Log.e("HITEL_BOX", "LLM_INFERENCE_BLOCKED model=${model.name} reason=NOT_INITIALIZED")
      onError("LlmModelInstance is not initialized.")'''),
('    conversation.sendMessageAsync(','    Log.i("HITEL_BOX", "LLM_SEND model=${model.name} inputChars=${input.length} images=${images.size} audioClips=${audioClips.size}")\n    val inferenceStart = android.os.SystemClock.elapsedRealtime()\n    var firstMessage = true\n    conversation.sendMessageAsync('),
('          resultListener(message.toString(), false, message.channels["thought"])','''          if (firstMessage) {
            firstMessage = false
            Log.i("HITEL_BOX", "LLM_FIRST_MESSAGE elapsedMs=${android.os.SystemClock.elapsedRealtime()-inferenceStart}")
          }
          resultListener(message.toString(), false, message.channels["thought"])'''),
('        override fun onDone() {\n          resultListener("", true, null)','''        override fun onDone() {
          Log.i("HITEL_BOX", "LLM_DONE elapsedMs=${android.os.SystemClock.elapsedRealtime()-inferenceStart}")
          resultListener("", true, null)'''),
('            Log.e(TAG, "onError", throwable)','            Log.e("HITEL_BOX", "LLM_CALLBACK_ERROR", throwable)\n            Log.e(TAG, "onError", throwable)')])
edit(app/"customtasks/agentchat/AgentChatTaskModule.kt",[
('    agentTools.skillManagerViewModel.loadSkills {','''    android.util.Log.i("HITEL_BOX", "AGENT_INIT_BEGIN model=${model.name}")
    agentTools.skillManagerViewModel.loadSkills {
      android.util.Log.i("HITEL_BOX", "AGENT_SKILLS_READY count=${agentTools.skillManagerViewModel.getSelectedSkills().size}")'''),
('        onDone = onDone,','''        onDone = { error ->
          android.util.Log.i("HITEL_BOX", "AGENT_INIT_END success=${error.isEmpty()}")
          onDone(error)
        },''')])
edit(app/"customtasks/agentchat/AgentTools.kt",[
('      Log.d(TAG, "load skill. Skill content:\\n$skillContent")','      Log.i("HITEL_BOX", "AGENT_LOAD_SKILL found=${skill != null}")'),
('          "\\n- skillName: ${skillName}\\n- scriptName: ${scriptName}\\n- data: ${data}\\n",','          "\\n- skillName: ${skillName}\\n- scriptName: ${scriptName}\\n- dataChars: ${data.length}\\n",'),
('            Log.d(TAG, "Got Secret from ask info dialog: ${secret.substring(0, 3)}")','            Log.d(TAG, "Secret supplied")'),
('      Log.d(TAG, "Calling JS script.\\n- url: $url\\n- data: $data")','      Log.i("HITEL_BOX", "AGENT_JS_BEGIN dataChars=${data.length}")'),
('      val result = action.result.await()','      val result = action.result.await()\n      Log.i("HITEL_BOX", "AGENT_JS_END resultChars=${result.length}")'),
('        Log.d(TAG, "Result: ${resultJson.result}")','        Log.i("HITEL_BOX", "AGENT_JS_SUCCESS")'),
('      Log.d(TAG, "Run intent. Intent: \'$intent\', parameters: \'$parameters\'")','      Log.i("HITEL_BOX", "AGENT_INTENT_BEGIN parametersChars=${parameters.length}")'),
('      if (IntentHandler.handleAction(context, intent, parameters)) {','      if (IntentHandler.handleAction(context, intent, parameters)) {\n        Log.i("HITEL_BOX", "AGENT_INTENT_SUCCESS")'),
('      } else {\n        return@runBlocking mapOf(\n          "action" to intent,','      } else {\n        Log.e("HITEL_BOX", "AGENT_INTENT_FAILED")\n        return@runBlocking mapOf(\n          "action" to intent,')])
edit(app/"ui/modelmanager/ModelManagerViewModel.kt",[
('  fun downloadModel(task: Task?, model: Model) {','''  fun downloadModel(task: Task?, model: Model) {
    Log.i("HITEL_BOX", "MODEL_DOWNLOAD_BEGIN model=${model.name} bytes=${model.sizeInBytes}")'''),
('      val onDoneFn: (error: String) -> Unit = { error ->','''      val onDoneFn: (error: String) -> Unit = { error ->
        Log.i("HITEL_BOX", "MODEL_INIT_CALLBACK model=${model.name} hasInstance=${model.instance != null} errorPresent=${error.isNotEmpty()}")''')])
print("PATCH_COUNT",count)
