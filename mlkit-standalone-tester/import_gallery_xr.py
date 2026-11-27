from pathlib import Path
import sys, shutil, hashlib
upstream=Path(sys.argv[1])/"Android/src/app/src/main/java/com/google/ai/edge/gallery"
dest=Path(sys.argv[2])/"app/src/main/java/com/google/ai/edge/gallery"
def copy(rel):
    src=upstream/rel
    target=dest/rel
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(src,target)
    print("XR_UPSTREAM_EXACT",rel,hashlib.sha256(src.read_bytes()).hexdigest(),flush=True)
for rel in [
    "customtasks/xrlanguageteacher/xr/GlassesMicStream.kt",
    "services/asr/AsrServiceStatus.kt",
    "services/asr/AsrServiceError.kt",
    "services/asr/AsrAmplitudeNormalizer.kt",
]:
    copy(rel)
source=upstream/"services/asr/MlKitAsrService.kt"
s=source.read_text()
print("XR_UPSTREAM_SERVICE",hashlib.sha256(source.read_bytes()).hexdigest(),flush=True)
a=s.index("  override suspend fun prepare(config: AsrPreparationConfig)")
b=s.index("  companion object {",a)
methods=s[a:b]
# Standalone host does not implement the rest of Gallery's model repository interface.
# Only remove override modifiers. Method bodies and response handling remain upstream.
methods=methods.replace("  override ","  ")
helper_start=s.index("    internal fun normalizeMlKitAudioLevel",b)
helpers=s[helper_start:]
header=s[:s.index("package ")]
imports="\n".join(line for line in s.splitlines() if line.startswith("import ") and "com.google.ai.edge.gallery.data.supplementary" not in line)
prefix='''
private const val TAG = "AGMlKitAsrService"
data class AsrPreparationConfig(val languageCode: String = "en-US")
data class AsrRecordingOptions(val showInterimResults: Boolean = true,
  val externalAudioSource: (() -> android.os.ParcelFileDescriptor?)? = null)

/** Minimal standalone host for the exact upstream prepare/startRecording/stopRecording/
 * cancelRecording/release and transcript helper bodies. Not a full Gallery service.
 * Never uses a substitute SDK or bypasses its official status checks.
 */
class XrOriginalRecordingProbe(private val context: Context) {
  private val _status = MutableStateFlow<AsrServiceStatus>(AsrServiceStatus.Unknown)
  val status = _status.asStateFlow()
  private val _currentAmplitude = MutableStateFlow(0f)
  val currentAmplitude = _currentAmplitude.asStateFlow()
  @Volatile private var preparedConfig = AsrPreparationConfig()
  @Volatile private var cachedRecognizer: SpeechRecognizer? = null
  @Volatile private var recognitionJob: Job? = null
  @Volatile private var isCancelled = false
  private val speechRecognizerOverride: SpeechRecognizer? = null
  private val recognitionFlowProvider: ((SpeechRecognizerRequest)->Flow<SpeechRecognizerResponse>)? = null
  private val speechRecognizer: SpeechRecognizer
    get() = cachedRecognizer ?: SpeechRecognition.getClient(speechRecognizerOptions {
      locale = Locale.forLanguageTag(preparedConfig.languageCode)
      preferredMode = SpeechRecognizerOptions.Mode.MODE_BASIC
    }).also { cachedRecognizer=it }
  private fun closeQuietly(client: SpeechRecognizer) {
    if (cachedRecognizer === client) cachedRecognizer = null
    runCatching { client.close() }.onFailure { Log.w(TAG,"close failed",it) }
  }
  suspend fun rawLanguageStatus(language: String): Int {
    val client=SpeechRecognition.getClient(speechRecognizerOptions {
      locale=Locale.forLanguageTag(language)
      preferredMode=SpeechRecognizerOptions.Mode.MODE_BASIC
    })
    try { return client.checkStatus() } finally { client.close() }
  }
'''
out=dest/"services/asr/XrOriginalRecordingProbe.kt"
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(header+"package com.google.ai.edge.gallery.services.asr\n"+imports+"\n"+prefix+methods+"  companion object {\n    private const val STOP_RECOGNITION_TIMEOUT_MS = 2000L\n"+helpers)
print("XR_EXTRACTED_METHODS_SHA256",hashlib.sha256(methods.encode()).hexdigest(),flush=True)
