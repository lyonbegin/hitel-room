package com.google.ai.edge.gallery.services.tts

import android.content.Context
import android.os.Build
import android.util.Log
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsSupertonicModelConfig
import com.k2fsa.sherpa.onnx.GenerationConfig
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream

/** Independent Sherpa-ONNX backend; no ML Kit or Gemma modifications. */
class SupertonicTtsEngine(private val context: Context) : TtsService {
  companion object {
    const val ID = "sherpa_supertonic_3"
    const val NAME = "Supertonic 3 (TTS)"
    const val URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2"
    const val SHA = "82fa96f91c4ef8abaae3a14a3f4153facf88bed821d1f7331cec2700f432c427"
    const val SIZE = 128774318L
    val LANGUAGES = listOf("ko-KR","en-US","ja-JP","fr-FR","es-ES","de-DE","pt-BR","it-IT","hi-IN","id-ID","ar-SA","ru-RU","nl-NL","pl-PL","tr-TR","da-DK","sv-SE","fi-FI","cs-CZ","bg-BG","el-GR","et-EE","hr-HR","hu-HU","lt-LT","lv-LV","ro-RO","sk-SK","sl-SI","uk-UA","vi-VN")
    val FILES = listOf("duration_predictor.int8.onnx","text_encoder.int8.onnx","vector_estimator.int8.onnx","vocoder.int8.onnx","tts.json","unicode_indexer.bin","voice.bin")
    private const val TAG = "HITEL_SUPERTONIC"
    fun root(context: Context) = File(context.filesDir,"supertonic-3-int8-20260511")
    fun installed(context: Context): Boolean {
      val dir = root(context)
      return File(dir,".verified").takeIf { it.isFile }?.readText() == SHA &&
        FILES.all { File(dir,it).let { f -> f.isFile && f.length()>0 } }
    }
  }
  private val mutableStatus = MutableStateFlow<TtsServiceStatus>(TtsServiceStatus.NotDownloaded)
  override val status: StateFlow<TtsServiceStatus> = mutableStatus.asStateFlow()
  override val servedModelIds = setOf(ID)
  override val holdsNativeWeights = true
  override val availableModels = listOf(TtsModelMetadata(ID, NAME, TtsEngineType.SUPERTONIC, LANGUAGES, (0..9).map { it.toString() }))
  private val lock = Mutex()
  private val downloadLock = Mutex()
  private val epoch = AtomicLong()
  private val cleanupScope = CoroutineScope(SupervisorJob()+Dispatchers.IO)
  private var engine: OfflineTts? = null
  private var prepared: TtsConfig? = null
  override suspend fun isSupportedOnDevice() = Build.SUPPORTED_ABIS.any { it == "arm64-v8a" || it == "x86_64" }
  override suspend fun checkModelAvailability(modelId: String): TtsModelAvailability =
    if (installed(context)) TtsModelAvailability.Downloaded else TtsModelAvailability.NotDownloaded

  override fun downloadModel(modelId: String, expectedTotalBytes: Long): Flow<TtsDownloadProgress> = flow {
    downloadLock.withLock {
      if (installed(context)) { emit(TtsDownloadProgress(SIZE,SIZE)); return@withLock }
      val target = root(context)
      val staging = File(target.parentFile,target.name+".staging")
      val archive = File(target.parentFile,target.name+".tar.bz2.part")
      staging.deleteRecursively()
      archive.delete()
      check(staging.mkdirs())
      mutableStatus.value = TtsServiceStatus.Downloading
      try {
        check(target.parentFile!!.usableSpace > SIZE*3) { "Insufficient storage for Supertonic" }
        val connection = java.net.URL(URL).openConnection() as HttpURLConnection
        connection.connectTimeout=20000
        connection.readTimeout=30000
        connection.instanceFollowRedirects=true
        val digest=MessageDigest.getInstance("SHA-256")
        var count=0L
        try {
          check(connection.responseCode==200) { "HTTP ${connection.responseCode}" }
          connection.inputStream.use { input ->
            archive.outputStream().use { output ->
              val buf=ByteArray(65536)
              var reported=0L
              while(true) {
                currentCoroutineContext().ensureActive()
                val n=input.read(buf)
                if(n<0) break
                count+=n
                check(count<=SIZE)
                digest.update(buf,0,n)
                output.write(buf,0,n)
                if(count-reported>=1048576) { emit(TtsDownloadProgress(count,SIZE)); reported=count }
              }
            }
          }
        } finally { connection.disconnect() }
        check(count==SIZE)
        check(digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }==SHA) { "Supertonic SHA256 mismatch" }
        TarArchiveInputStream(BZip2CompressorInputStream(archive.inputStream().buffered())).use { tar ->
          while(true) {
            currentCoroutineContext().ensureActive()
            val entry=tar.nextTarEntry ?: break
            val name=entry.name.substringAfterLast('/')
            if(name !in FILES) continue
            check(entry.isFile && !entry.isSymbolicLink && !entry.isLink)
            val file=File(staging,name)
            check(!file.exists())
            file.outputStream().use { output ->
              val buf=ByteArray(65536)
              while(true) {
                currentCoroutineContext().ensureActive()
                val n=tar.read(buf)
                if(n<0) break
                output.write(buf,0,n)
              }
            }
            check(file.length()==entry.size && file.length()>0)
          }
        }
        check(FILES.all { File(staging,it).let { f -> f.isFile && f.length()>0 } })
        File(staging,".verified").writeText(SHA)
        target.deleteRecursively()
        check(staging.renameTo(target))
        check(installed(context))
        mutableStatus.value=TtsServiceStatus.Downloaded
        Log.i(TAG,"MODEL_VERIFIED bytes=$count")
        emit(TtsDownloadProgress(SIZE,SIZE))
      } catch(e: CancellationException) { mutableStatus.value=TtsServiceStatus.NotDownloaded; throw e }
      catch(e: Exception) { mutableStatus.value=TtsServiceStatus.Failed(e); Log.e(TAG,"DOWNLOAD_FAILED",e); throw e }
      finally { archive.delete(); staging.deleteRecursively() }
    }
  }.flowOn(Dispatchers.IO)

  override suspend fun prepare(config:TtsConfig) = withContext(Dispatchers.IO) {
    lock.withLock {
      check(config.modelId==ID)
      try {
        check(installed(context)) { "Supertonic model not installed" }
        if(engine==null) {
          mutableStatus.value=TtsServiceStatus.Initializing
          val dir=root(context)
          fun path(name:String)=File(dir,name).absolutePath
          engine=OfflineTts(config=OfflineTtsConfig(model=OfflineTtsModelConfig(
            supertonic=OfflineTtsSupertonicModelConfig(
              durationPredictor=path(FILES[0]),textEncoder=path(FILES[1]),vectorEstimator=path(FILES[2]),
              vocoder=path(FILES[3]),ttsJson=path(FILES[4]),unicodeIndexer=path(FILES[5]),voiceStyle=path(FILES[6])),
            numThreads=2,provider="cpu",debug=false)))
          Log.i(TAG,"ENGINE_READY rate=${engine!!.sampleRate()} speakers=${engine!!.numSpeakers()}")
        }
        prepared=config
        mutableStatus.value=TtsServiceStatus.Ready
      } catch(e: Exception) { mutableStatus.value=TtsServiceStatus.Failed(e); throw e }
    }
  }

  override fun synthesize(text:String, config:TtsConfig?):TtsOutput = TtsOutput.AudioStream(
    channelFlow {
      val jobEpoch=epoch.get()
      lock.withLock {
        val native=engine ?: throw TtsServiceError.EngineUnavailable("Supertonic not prepared")
        val effective=config ?: prepared ?: throw TtsServiceError.EngineUnavailable("No config")
        val lang=Locale.forLanguageTag(effective.languageCode ?: "ko-KR").language
        require(LANGUAGES.any { Locale.forLanguageTag(it).language==lang }) { "Unsupported language: $lang" }
        val sid=(effective.voiceId?.toIntOrNull() ?: 0).coerceIn(0,native.numSpeakers()-1)
        val rate=native.sampleRate()
        val resampler=PcmResampler(rate)
        mutableStatus.value=TtsServiceStatus.Synthesizing
        var samplesOut=0L
        val producer=this
        try {
          native.generateWithConfigAndCallback(text,GenerationConfig(sid=sid,speed=effective.speed ?: 1f,numSteps=8,extra=mapOf("lang" to lang))) { samples ->
            if(!producer.isActive || epoch.get()!=jobEpoch) 0
            else {
              val pcm=resampler.convert(samples)
              if(pcm.isNotEmpty()) {
                // Block only the native producer on bounded-channel backpressure.
                val sent=runBlocking { runCatching { producer.send(pcm) }.isSuccess }
                if(!sent) 0 else { samplesOut+=pcm.size/2; if(epoch.get()==jobEpoch) 1 else 0 }
              } else 1
            }
          }
          if(epoch.get()==jobEpoch && producer.isActive) {
            check(samplesOut>0) { "Supertonic produced no PCM" }
            Log.i(TAG,"SYNTHESIS_OK lang=$lang sid=$sid samples24k=$samplesOut")
          }
        } catch(e: CancellationException) { throw e }
        catch(e: Exception) { mutableStatus.value=TtsServiceStatus.Failed(e); throw e }
        finally { if(mutableStatus.value==TtsServiceStatus.Synthesizing) mutableStatus.value=TtsServiceStatus.Ready }
      }
    }.buffer(8).flowOn(Dispatchers.IO)
  )
  // Continuous linear resampling; preserves interpolation state across native callbacks.
  private class PcmResampler(private val rate:Int) {
    private var next=0.0
    private var index=0L
    private var last=0f
    fun convert(samples:FloatArray):ByteArray {
      require(rate>0)
      val out=java.io.ByteArrayOutputStream()
      for(s in samples) {
        while(next<=index.toDouble()) {
          val f=if(index==0L) s else last+(s-last)*(next-(index-1)).toFloat()
          val n=(f.coerceIn(-1f,1f)*32767).toInt()
          out.write(n and 255); out.write((n shr 8) and 255)
          next+=rate/24000.0
        }
        last=s; index++
      }
      return out.toByteArray()
    }
  }
  override fun pause() {}
  override fun resume() {}
  override fun stop() { epoch.incrementAndGet() }
  override fun cancel()=stop()
  override suspend fun release() { stop(); withContext(Dispatchers.IO) { lock.withLock { engine?.release();engine=null;prepared=null;mutableStatus.value=if(installed(context)) TtsServiceStatus.Downloaded else TtsServiceStatus.NotDownloaded } } }
  override fun destroy() { stop(); cleanupScope.launch { release() } }
  override suspend fun deleteModel(modelId:String) { downloadLock.withLock { release(); withContext(Dispatchers.IO) { root(context).deleteRecursively(); mutableStatus.value=TtsServiceStatus.NotDownloaded } } }
}
