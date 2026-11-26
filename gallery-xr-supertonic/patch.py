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
# ASR must stay byte-identical to pinned Google upstream. Do not set a global Korean default.
assert 'const val LANGUAGE_CODE = "en-US"' in (base/"services/asr/AsrModelMetadata.kt").read_text()
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

# Add the actual XR HUD engine label instead of inheriting the previous selected engine's label.
replace("customtasks/xrlanguageteacher/models/XrLanguageTeacherEducationalCards.kt","  POCKET_TTS;","  POCKET_TTS,\n  SUPERTONIC_TTS;")
insert("customtasks/xrlanguageteacher/services/XrLanguageTeacherTtsEngineManager.kt","    TtsModelIdentifier.isSystemEngine(modelId) -> SpeechEngine.PLATFORM_TTS",'    modelId == TtsModelIdentifier.SHERPA_SUPERTONIC_3 -> SpeechEngine.SUPERTONIC_TTS\n')
insert("customtasks/xrlanguageteacher/views/cameraview/XrLanguageTeacherSettingsButton.kt","      SpeechEngine.POCKET_TTS -> stringResource(R.string.xrteacher_engine_pocket_tts)",'      SpeechEngine.SUPERTONIC_TTS -> "Supertonic 3"\n')
# A status query must not reset a live Supertonic download to NOT_DOWNLOADED.
# Keep the progress path for the new engine isolated from Google's ML Kit engine.
insert("services/tts/TtsModelDownloader.kt","    val availability =\n      try {\n        ttsServiceProvider.service(forModelId = engineId).checkModelAvailability(engineId)",'''    if (engineId == SupertonicTtsEngine.ID &&
      activeDownloadJobs[engineId]?.isActive == true &&
      ttsServiceProvider.serviceOrNull(engineId)?.checkModelAvailability(engineId) != TtsModelAvailability.Downloaded) {
      return ModelDownloadStatus(
        status = ModelDownloadStatusType.IN_PROGRESS,
        totalBytes = model.downloadInfo.totalBytes,
      )
    }

''')
# Actual application component access, debug/test only; no extra release UI.
entry=root/"Android/src/app/src/debug/java/com/google/ai/edge/gallery/services/tts/SupertonicQaEntryPoint.kt"
entry.parent.mkdir(parents=True,exist_ok=True)
entry.write_text('''package com.google.ai.edge.gallery.services.tts

import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import com.google.ai.edge.gallery.data.ModelDownloader
import com.google.ai.edge.gallery.data.RuntimeType

@EntryPoint
@InstallIn(SingletonComponent::class)
interface SupertonicQaEntryPoint {
  fun ttsServiceProvider(): TtsServiceProvider
  fun modelDownloaders(): Map<RuntimeType, @JvmSuppressWildcards ModelDownloader>
}
''')
s=test.read_text()
s=s.replace("import kotlinx.coroutines.runBlocking",'''import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeout
import com.google.ai.edge.gallery.data.AllowedModel
import com.google.ai.edge.gallery.data.RuntimeType
import com.google.ai.edge.gallery.data.ModelDownloadStatusType
import com.google.ai.edge.gallery.customtasks.xrlanguageteacher.models.XR_LANGUAGE_TEACHER_MODEL_SELECTION_CONFIG
import com.google.ai.edge.gallery.data.ModelSelectionTarget
import com.google.gson.Gson
import dagger.hilt.android.EntryPointAccessors''')
s=s.replace("    val engine=SupertonicTtsEngine(context)",'''    val qa=EntryPointAccessors.fromApplication(context.applicationContext,SupertonicQaEntryPoint::class.java)
    val provider=qa.ttsServiceProvider()
    val engine=provider.serviceOrNull(SupertonicTtsEngine.ID) as SupertonicTtsEngine
    assertTrue(provider.availableModels.any { it.modelId==TtsModelIdentifier.MEDIAPIPE_KOKORO_82M })
    assertTrue(provider.availableModels.any { it.modelId==TtsModelIdentifier.MEDIAPIPE_POCKET_TTS_100M })
    val model=checkNotNull(Gson().fromJson("""'''+json.dumps(model,separators=(",",":"))+'''""",AllowedModel::class.java).toModel())
    val xr=XR_LANGUAGE_TEACHER_MODEL_SELECTION_CONFIG
    assertTrue(xr.sections.single { it.target==ModelSelectionTarget.TTS_MODEL }.modelFilter(model))
    assertTrue(xr.speechLanguageOverlap!!.invoke(listOf("ko-KR","en-US"),model.ttsProfile!!.languages).shared.contains("ko-KR"))
    val downloader=qa.modelDownloaders().getValue(RuntimeType.SHERPA_ONNX)''')
s=s.replace("      engine.downloadModel(SupertonicTtsEngine.ID,SupertonicTtsEngine.SIZE).collect {}",'''      val completed=CompletableDeferred<com.google.ai.edge.gallery.data.ModelDownloadStatus>()
      downloader.download(null,model,false) { _,status ->
        if(status.status==ModelDownloadStatusType.SUCCEEDED || status.status==ModelDownloadStatusType.FAILED) {
          completed.complete(status)
        }
      }
      val terminal=withTimeout(480000) { completed.await() }
      assertEquals(terminal.errorMessage,ModelDownloadStatusType.SUCCEEDED,terminal.status)
      assertEquals(ModelDownloadStatusType.SUCCEEDED,downloader.queryStatus(model).status)
      android.util.Log.i("HITEL_SUPERTONIC","XR_FILTER_KO_AND_HILT_DOWNLOADER_PASS")''')
test.write_text(s)

# Only augment the selected Basic ASR card. Keep Google ASR gates and service byte-identical.
card = "ui/common/modelitem/ModelRadioItem.kt"
insert(card, "import androidx.compose.animation.AnimatedContent", """import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.provider.Settings
import android.util.Log
import androidx.compose.material3.TextButton
import androidx.compose.material3.Checkbox
import kotlinx.coroutines.ensureActive
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.ai.edge.gallery.services.asr.AsrEngineType
import com.google.ai.edge.gallery.services.asr.AsrModelRegistry
import com.google.ai.edge.gallery.ui.modelmanager.downloadLanguagePack
import com.google.ai.edge.gallery.ui.modelmanager.refreshLanguagePackStatuses
""")
insert(card, "      // Explain why the model can't be used.", """      if (selected && selectable && modelManagerViewModel != null &&
        AsrModelRegistry.engineTypeForModelId(model.modelId) == AsrEngineType.MLKIT_BASIC) {
        HitelBasicPackPanel(model, modelManagerViewModel)
      }
      if (selected && model.modelId == "hitel_soda_local") {
        val context = LocalContext.current
        val prefs = remember(context) { context.getSharedPreferences("hitel_soda_source", Context.MODE_PRIVATE) }
        HitelSodaLocalPanel(prefs)
      }

""")
p = base/card
p.write_text(p.read_text() + """
private data class HitelSodaPack(val locale: String, val version: String, val name: String, val uri: Uri)
private data class HitelSodaExpected(val bytes: Long, val sha1: String)
private val hitelSodaKnown = mapOf(
  "soda-ko-KR-v5072.zip" to HitelSodaExpected(93639000L, "58DEECE081FD89EE928BA6BD705B6878BE6BD395"),
  "soda-en-US-v3072.zip" to HitelSodaExpected(62065000L, "F8745C8DBBDAE1E77A9A9E7BAF378CBC78B7BB2A"),
)
private val hitelSodaName = Regex("soda-([A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})+)-v([0-9]+)[.]zip", RegexOption.IGNORE_CASE)

private fun hitelListSodaPacks(context: Context, tree: Uri): List<HitelSodaPack> {
  val resolver = context.contentResolver
  val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
  val columns = arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME)
  val result = mutableListOf<HitelSodaPack>()
  resolver.query(children, columns, null, null, null)?.use { cursor ->
    while (cursor.moveToNext()) {
      val name = cursor.getString(1) ?: continue
      val match = hitelSodaName.matchEntire(name) ?: continue
      val locale = Locale.forLanguageTag(match.groupValues[1]).toLanguageTag()
      if (locale == "und") continue
      result.add(HitelSodaPack(locale, match.groupValues[2], name,
        DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0))))
    }
  } ?: error("Cannot read selected folder")
  return result.sortedWith(compareBy({ it.locale }, { it.name }))
}

@Composable
private fun HitelSodaLocalPanel(prefs: android.content.SharedPreferences) {
  val context = LocalContext.current
  var folder by remember { mutableStateOf(prefs.getString("folder", null)) }
  var refresh by remember { mutableStateOf(0) }
  var verify by remember { mutableStateOf(0) }
  var error by remember { mutableStateOf("") }
  var scanning by remember { mutableStateOf(false) }
  var packs by remember { mutableStateOf<List<HitelSodaPack>>(emptyList()) }
  var checked by remember { mutableStateOf(prefs.getStringSet("checked_models", emptySet())?.toSet() ?: emptySet()) }
  var results by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
  val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
    if (uri != null) {
      try {
        context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        val old = folder
        folder = uri.toString()
        if (old != folder) {
          checked = emptySet()
          prefs.edit().remove("checked_models").apply()
        }
        prefs.edit().putString("folder", folder).apply()
        if (old != null && old != folder) {
          try {
            context.contentResolver.releasePersistableUriPermission(Uri.parse(old), Intent.FLAG_GRANT_READ_URI_PERMISSION)
          } catch (_: Exception) { }
        }
        error = ""
        refresh++
        Log.i("HITEL_SODA_LOCAL", "FOLDER_SELECTED")
      } catch (e: Exception) {
        error = "Folder permission failed: " + (e.message ?: e.javaClass.simpleName)
        Log.w("HITEL_SODA_LOCAL", "FOLDER_PERMISSION_FAILED", e)
      }
    }
  }
  LaunchedEffect(folder, refresh) {
    scanning = true
    results = emptyMap()
    packs = emptyList()
    error = ""
    try {
      val selected = folder
      if (selected != null) {
        packs = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
          hitelListSodaPacks(context, Uri.parse(selected))
        }
        checked = checked.intersect(packs.map { it.name }.toSet())
        prefs.edit().putStringSet("checked_models", checked).apply()
        Log.i("HITEL_SODA_LOCAL", "SCAN_COMPLETE packs=" + packs.size)
      }
    } catch (e: kotlinx.coroutines.CancellationException) {
      throw e
    } catch (e: Exception) {
      error = "Folder scan failed: " + (e.message ?: e.javaClass.simpleName)
      Log.w("HITEL_SODA_LOCAL", "SCAN_FAILED", e)
    } finally {
      scanning = false
    }
  }
  LaunchedEffect(folder, refresh, verify, checked, packs) {
    results = emptyMap()
    if (verify > 0 && !scanning) {
      for (pack in packs.filter { it.name in checked }) {
        results = results + (pack.name to "Checking ZIP...")
        val state = try {
          kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            hitelVerifySodaPack(context, pack)
          }
        } catch (e: kotlinx.coroutines.CancellationException) {
          throw e
        } catch (e: Exception) {
          Log.w("HITEL_SODA_LOCAL", "VERIFY_FAILED " + pack.locale, e)
          "Verification failed: " + (e.message ?: e.javaClass.simpleName)
        }
        results = results + (pack.name to state)
      }
    }
  }
  Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    Text("SODA Local model folder", style = MaterialTheme.typography.titleSmall)
    Text("Select one folder containing SODA ZIP language packs. Check the languages you want to use.",
      style = MaterialTheme.typography.bodySmall)
    Text(folder ?: "No folder selected", style = MaterialTheme.typography.bodySmall)
    Row {
      TextButton(onClick = { picker.launch(null) }) { Text("Select model folder") }
      TextButton(enabled = folder != null && !scanning, onClick = { refresh++ }) { Text("Rescan") }
    }
    if (scanning) Text("Scanning folder...")
    if (!scanning && folder != null && packs.isEmpty()) Text("No SODA language ZIP files found.")
    if (packs.isNotEmpty()) {
      Text("Local languages: " + checked.size + " / " + packs.size, style = MaterialTheme.typography.titleSmall)
      Row {
        TextButton(onClick = {
          checked = packs.map { it.name }.toSet()
          prefs.edit().putStringSet("checked_models", checked).apply()
        }) { Text("Select all") }
        TextButton(onClick = {
          checked = emptySet()
          prefs.edit().putStringSet("checked_models", checked).apply()
        }) { Text("Clear all") }
      }
    }
    for (pack in packs) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked = pack.name in checked, onCheckedChange = { enabled ->
          checked = if (enabled) checked + pack.name else checked - pack.name
          prefs.edit().putStringSet("checked_models", checked).apply()
          Log.i("HITEL_SODA_LOCAL", "LANGUAGE_SELECTION " + pack.locale + " v" + pack.version + " checked=" + enabled)
        })
        Column(modifier = Modifier.weight(1f)) {
          val language = Locale.forLanguageTag(pack.locale)
          Text(language.getDisplayName(Locale.getDefault()) + " (" + pack.locale + ")")
          Text(pack.name, style = MaterialTheme.typography.bodySmall)
          Text(results[pack.name] ?: "Not verified", style = MaterialTheme.typography.bodySmall)
        }
      }
    }
    TextButton(enabled = checked.isNotEmpty() && !scanning, onClick = { verify++ }) { Text("Verify selected models") }
    if (error.isNotEmpty()) Text(error, color = MaterialTheme.colorScheme.error,
      style = MaterialTheme.typography.bodySmall)
    Text("Native SODA runtime is not connected. Local recognition cannot start yet; no ML Kit fallback.",
      color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
  }
}

private suspend fun hitelVerifySodaPack(context: Context, pack: HitelSodaPack): String {
  val expected = hitelSodaKnown[pack.name]
  val digest = java.security.MessageDigest.getInstance("SHA-1")
  var bytes = 0L
  val input = context.contentResolver.openInputStream(pack.uri) ?: error("Cannot read ZIP")
  input.use {
    val buffer = ByteArray(65536)
    while (true) {
      kotlinx.coroutines.currentCoroutineContext().ensureActive()
      val count = it.read(buffer)
      if (count < 0) break
      bytes += count
      if (expected != null) check(bytes <= expected.bytes) { "ZIP exceeds expected size" }
      digest.update(buffer, 0, count)
    }
  }
  val hash = digest.digest().joinToString("") { "%02X".format(it.toInt() and 255) }
  if (expected != null) {
    check(bytes == expected.bytes) { "ZIP size mismatch: " + bytes }
    check(hash.equals(expected.sha1, ignoreCase = true)) { "ZIP SHA-1 mismatch" }
    Log.i("HITEL_SODA_LOCAL", "ZIP_VERIFIED " + pack.locale + " bytes=" + bytes + " sha1=" + hash)
    return "ZIP verified (runtime not connected)"
  }
  Log.i("HITEL_SODA_LOCAL", "ZIP_HASH_ONLY " + pack.locale + " bytes=" + bytes + " sha1=" + hash)
  return "Hash calculated; official checksum unknown (not verified)"
}

/** User-triggered language downloads and public settings, never a private Google Activity. */
@Composable
private fun HitelBasicPackPanel(model: Model, manager: ModelManagerViewModel) {
  val context = LocalContext.current
  val ui by manager.uiState.collectAsStateWithLifecycle()
  val tags = listOf("en-US", "ko-KR")
  var network by remember { mutableStateOf(hitelNetworkDescription(context)) }
  LaunchedEffect(model.name) {
    manager.refreshLanguagePackStatuses(model, tags)
  }
  Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    Text("ML Kit Basic language packs", style = MaterialTheme.typography.titleSmall)
    Text(network, style = MaterialTheme.typography.bodySmall)
    for (tag in tags) {
      val status = ui.languagePackStatus[model.name]?.get(tag)
      Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
          text = tag + ": " + (status?.status?.name ?: "Checking"),
          modifier = Modifier.weight(1f),
          style = MaterialTheme.typography.bodySmall,
        )
        TextButton(
          enabled = status?.status != ModelDownloadStatusType.IN_PROGRESS &&
            status?.status != ModelDownloadStatusType.SUCCEEDED &&
            status?.status != ModelDownloadStatusType.UNAVAILABLE,
          onClick = {
            network = hitelNetworkDescription(context)
            Log.i("HITEL_ASR_PACK", "DOWNLOAD_REQUEST " + tag + " " + network)
            manager.downloadLanguagePack(model, tag)
          },
        ) { Text("Download") }
      }
      if (status?.status == ModelDownloadStatusType.FAILED) {
        Text(status.errorMessage.orEmpty(), color = MaterialTheme.colorScheme.error,
          style = MaterialTheme.typography.bodySmall)
      }
    }
    if (network.contains("VPN") && network.contains("metered=true")) {
      Text("Google Speech Services may pause language downloads on this metered VPN. " +
        "Open Google app > Settings > Voice > Offline speech recognition and allow all networks, if offered.",
        style = MaterialTheme.typography.bodySmall)
    }
    Row {
      TextButton(onClick = {
        network = hitelNetworkDescription(context)
        manager.refreshLanguagePackStatuses(model, tags)
        Log.i("HITEL_ASR_PACK", "REFRESH " + network)
      }) { Text("Refresh status") }
      TextButton(onClick = {
        try {
          context.startActivity(Intent(Settings.ACTION_VOICE_INPUT_SETTINGS))
        } catch (e: Exception) {
          Log.w("HITEL_ASR_PACK", "Voice settings unavailable", e)
          context.startActivity(Intent(Settings.ACTION_SETTINGS))
        }
      }) { Text("Voice settings") }
    }
    TextButton(onClick = {
      try {
        context.startActivity(Intent(Intent.ACTION_MAIN)
          .addCategory(Intent.CATEGORY_LAUNCHER)
          .setPackage("com.google.android.googlequicksearchbox"))
      } catch (e: Exception) {
        Log.w("HITEL_ASR_PACK", "Google app unavailable", e)
        context.startActivity(Intent(Settings.ACTION_SETTINGS))
      }
    }) { Text("Open Google app") }
  }
}

private fun hitelNetworkDescription(context: Context): String {
  return try {
    val cm = context.getSystemService(ConnectivityManager::class.java)
    val caps = cm.getNetworkCapabilities(cm.activeNetwork)
    if (caps == null) "Network: disconnected"
    else {
      val transport = when {
        caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "VPN"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "Wi-Fi"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "Ethernet"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "Cellular"
        else -> "Other"
      }
      "Network: " + transport + ", metered=" + cm.isActiveNetworkMetered +
        ", validated=" + caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) +
        ", reported downstream=" + caps.linkDownstreamBandwidthKbps + " kbps"
    }
  } catch (e: Exception) {
    Log.w("HITEL_ASR_PACK", "Network query failed", e)
    "Network: unknown"
  }
}
""")

# SODA Local has its own selection identity; no SDK call or readiness claim.
vm = "ui/modelmanager/TaskModelSelectionViewModel.kt"
insert(vm, "/** Returns the models [section] offers, in display order. */", '''private const val HITEL_SODA_LOCAL_ID = "hitel_soda_local"
private val hitelSodaLocalModel = Model(
  name = "SODA Local",
  modelId = HITEL_SODA_LOCAL_ID,
  displayName = "SODA Local",
  info = "Local language ZIPs. Native SODA runtime not connected.",
  downloadInfo = com.google.ai.edge.gallery.data.ModelDownloadInfo(localRelativeDirPathOverride = "soda-local"),
  declaredModelType = ModelType.ASR,
)

''')
replace(vm, '''    ModelSelectionTarget.ASR_MODEL,
    ModelSelectionTarget.TTS_MODEL ->
      modelManagerUiState.supplementaryModels.filter(section.modelFilter)''', '''    ModelSelectionTarget.ASR_MODEL ->
      modelManagerUiState.supplementaryModels.filter(section.modelFilter) + hitelSodaLocalModel
    ModelSelectionTarget.TTS_MODEL ->
      modelManagerUiState.supplementaryModels.filter(section.modelFilter)''')
insert(vm, "    val statuses = currentBinding.host.uiState.value.modelDownloadStatus\n    val mainModel =", '''    if (selectedModels.any { it.modelId == HITEL_SODA_LOCAL_ID }) {
      Log.i(TAG, "HITEL_SODA_LOCAL: launch blocked; native runtime not connected; no SDK download")
      update(state.value.copy(
        launchPhase = ModelSelectionLaunchPhase.IDLE,
        gateRequest = null,
        startedDownloads = emptySet(),
        downloadErrorMessage = "SODA Local: native recognition engine is not connected. Local ZIP selection is saved. No ML Kit download was started.",
      ))
      return
    }
''')
insert(vm, "    val sectionByModelName =\n", '''    if (hitelSodaLocalModel.name in current.selections.values) {
      Log.i(TAG, "HITEL_SODA_LOCAL: rejected download gate")
      update(current.copy(launchPhase = ModelSelectionLaunchPhase.IDLE, gateRequest = null,
        startedDownloads = emptySet(), mobileDataConfirmation = null))
      return
    }
''')
# Explicitly exclude the local candidate from legacy automatic saved-engine checks.
replace(vm, '''          isSavedSelection(section.target, it) && isDownloaded(it) && !isMemoryLow(it)''', '''          it.modelId != HITEL_SODA_LOCAL_ID &&
            isSavedSelection(section.target, it) && isDownloaded(it) && !isMemoryLow(it)''')
replace(vm, '''  when (status?.status) {
    ModelDownloadStatusType.SUCCEEDED,''', '''  if (model.modelId == HITEL_SODA_LOCAL_ID) false
  else when (status?.status) {
    ModelDownloadStatusType.SUCCEEDED,''')
insert(vm, "  val asrLanguages = selectedLanguages(ModelSelectionTarget.ASR_MODEL) ?: return null", '''  if (sections.any { it.selectedModel?.modelId == HITEL_SODA_LOCAL_ID }) return null
''')
print("SODA_LOCAL_INDEPENDENT_SELECTION_NO_SDK_DOWNLOAD")

# Fail closed if any original ASR service or ML Kit ASR gate was modified.
import subprocess
asr_paths = [
    str((base/"services/asr").relative_to(root)),
    str((base/"data/supplementary/gates/MlKitAsrBasicGate.kt").relative_to(root)),
    str((base/"data/supplementary/gates/MlKitAsrAdvancedGate.kt").relative_to(root)),
    str((base/"customtasks/xrlanguageteacher/services/XrLanguageTeacherAsrCoordinator.kt").relative_to(root)),
    str((base/"customtasks/xrlanguageteacher/models/LanguageUtils.kt").relative_to(root)),
]
subprocess.run(["git","-C",str(root),"diff","--exit-code","HEAD","--",*asr_paths],check=True)
print("ASR_UPSTREAM_UNCHANGED en-US")
print("PATCH_APPLIED",len(langs),"languages")
