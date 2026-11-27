package com.google.ai.edge.gallery.services.asr

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.ParcelFileDescriptor
import android.util.Log
import com.hitel.soda.sdk.LocalSodaSdk
import com.google.ai.edge.gallery.data.supplementary.SpeechAvailability
import com.google.ai.edge.gallery.data.supplementary.SpeechUnavailabilityReason
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.channels.awaitClose
import java.io.InputStream
import kotlin.math.abs

/** Replacement Basic backend only. Uses local SDK, never the Google model downloader. */
class HitelLocalSodaAsrService(private val context: Context): AsrService {
    override val engineType=AsrEngineType.MLKIT_BASIC
    override val activeModel get()=AsrModelRegistry.mlKitBasicModel()
    override val availableModels get()=listOf(activeModel)
    override val managesOwnDownloads=true
    private val state=MutableStateFlow<AsrServiceStatus>(AsrServiceStatus.Unknown)
    override val status=state.asStateFlow()
    private val amplitude=MutableStateFlow(0f)
    override val currentAmplitude=amplitude.asStateFlow()
    @Volatile private var language="en-US"
    private val lock=Any()
    @Volatile private var session:Session?=null

    private class Session {
        @Volatile var stopping=false
        @Volatile var cancelled=false
        @Volatile var record:AudioRecord?=null
        @Volatile var stream:InputStream?=null
        val done=CompletableDeferred<Unit>()
        fun stop(cancel:Boolean) {
            cancelled=cancelled||cancel
            stopping=true
            runCatching{record?.stop()}
            runCatching{stream?.close()}
        }
    }
    private fun log(message:String)=Log.i("HITEL_LOCAL_SDK",message)
    override suspend fun checkStatus():AsrServiceStatus =
        if(!LocalSodaSdk.supportsDevice()) AsrServiceStatus.Unavailable
        else if(LocalSodaSdk.anyInstalled(context)) AsrServiceStatus.Ready
        else AsrServiceStatus.NotDownloaded
    override suspend fun checkLanguageStatus(languageCode:String):AsrServiceStatus =
        if(!LocalSodaSdk.supportsDevice()||!LocalSodaSdk.supportsLocale(languageCode)) AsrServiceStatus.Unavailable
        else if(LocalSodaSdk.installed(context,languageCode)) AsrServiceStatus.Ready
        else AsrServiceStatus.NotDownloaded
    override fun download():Flow<AsrServiceStatus> = flow {
        log("LOCAL_IMPORT_REQUIRED; network download not invoked")
        if(LocalSodaSdk.anyInstalled(context))emit(AsrServiceStatus.Downloaded)
        else throw AsrServiceError.Unknown("Select a local SODA ZIP on ML Kit Basic model card.")
    }
    override fun downloadLanguage(languageCode:String):Flow<AsrServiceStatus> = flow {
        log("LOCAL_IMPORT_REQUIRED locale=$languageCode; network download not invoked")
        if(LocalSodaSdk.installed(context,languageCode))emit(AsrServiceStatus.Downloaded)
        else throw AsrServiceError.Unknown("Select local ZIP for $languageCode on ML Kit Basic model card.")
    }
    override suspend fun prepare(config:AsrPreparationConfig) {
        if(!LocalSodaSdk.installed(context,config.languageCode))throw AsrServiceError.ModelNotDownloaded()
        language=config.languageCode
        state.value=AsrServiceStatus.Initializing
        try {
            withContext(Dispatchers.IO){ LocalSodaSdk(context){_,_->}.use{it.prepare(language)} }
            state.value=AsrServiceStatus.Ready
            log("LOCAL_SDK_PREPARED locale=$language")
        }catch(e:CancellationException){throw e}
        catch(e:Exception){state.value=AsrServiceStatus.Failed;throw AsrServiceError.ModelInitializationFailed(e)}
    }
    override fun startRecording(options:AsrRecordingOptions):Flow<String> = callbackFlow {
        val run=Session()
        synchronized(lock) {
            if(session!=null)throw AsrServiceError.RecognizerBusy()
            session=run
        }
        val tag=language
        val worker=launch(Dispatchers.IO) {
            var sdk:LocalSodaSdk?=null
            var started=false
            var accepted=0L
            var lastPartial=""
            val committed=StringBuilder()
            val transcriptLock=Any()
            var lastEmission=""
            fun publish(text:String) {
                if(!run.cancelled&&text.isNotBlank()&&text!=lastEmission){lastEmission=text;trySend(text)}
            }
            try {
                if(!LocalSodaSdk.installed(context,tag))throw AsrServiceError.ModelNotDownloaded()
                val engine=LocalSodaSdk(context){text,isFinal->
                    synchronized(transcriptLock) {
                        if(isFinal) {
                            if(committed.isNotEmpty())committed.append(' ')
                            committed.append(text.trim())
                            lastPartial=""
                            publish(committed.toString())
                        }else{
                            lastPartial=text.trim()
                            if(options.showInterimResults)publish(listOf(committed.toString(),lastPartial).filter{it.isNotBlank()}.joinToString(" "))
                        }
                    }
                }
                sdk=engine
                engine.prepare(tag)
                if(run.stopping)return@launch
                val external=options.externalAudioSource
                if(external!=null) {
                    val fd=external.invoke() ?: throw AsrServiceError.AudioRecordingFailed()
                    run.stream=ParcelFileDescriptor.AutoCloseInputStream(fd)
                }else{
                    if(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)
                        throw AsrServiceError.AudioPermissionDenied()
                    val min=AudioRecord.getMinBufferSize(16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT)
                    check(min>0)
                    val rec=AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,maxOf(min,4096))
                    run.record=rec
                    check(rec.state==AudioRecord.STATE_INITIALIZED)
                    rec.startRecording()
                    check(rec.recordingState==AudioRecord.RECORDSTATE_RECORDING)
                }
                if(run.stopping)return@launch
                engine.start();started=true
                state.value=AsrServiceStatus.Recognizing
                log("LOCAL_SDK_RECOGNITION_ENTER locale=$tag source="+(if(external==null)"MIC" else "PFD"))
                val chunk=ByteArray(1024)
                while(!run.stopping&&isActive) {
                    var n=0
                    while(n<chunk.size&&!run.stopping){
                        val count=run.record?.read(chunk,n,chunk.size-n) ?: run.stream!!.read(chunk,n,chunk.size-n)
                        if(count<=0)break
                        n+=count
                    }
                    if(n==0)break
                    check(n%2==0)
                    var peak=0
                    for(i in 0 until n step 2)peak=maxOf(peak,abs(((chunk[i].toInt() and 255) or (chunk[i+1].toInt() shl 8)).toShort().toInt()))
                    amplitude.value=(peak/32768f).coerceIn(0f,1f)
                    engine.push(chunk,n)
                    accepted+=n
                    if(accepted%32768L==0L)log("LOCAL_SDK_PCM_ACCEPTED bytes=$accepted")
                    if(n<chunk.size)break
                }
            }catch(e:CancellationException){run.cancelled=true;throw e}
            catch(e:Exception){
                if(!run.stopping){state.value=AsrServiceStatus.Failed;close(e)}
            }finally{
                withContext(NonCancellable){
                    run.stop(run.cancelled)
                    runCatching{run.record?.release()}
                    if(started){
                        state.value=AsrServiceStatus.Processing
                        runCatching{sdk?.finish()}.onFailure{log("LOCAL_SDK_FINISH_ERROR "+it.message)}
                    }
                    synchronized(transcriptLock){
                        // Native final callback is not yet guaranteed. Preserve last real partial at
                        // session end as Gallery does; never label the fallback a native FINAL.
                        if(!run.cancelled&&lastPartial.isNotBlank()){
                            log("LOCAL_SDK_PARTIAL_FLUSH (not native final)")
                            publish(listOf(committed.toString(),lastPartial).filter{it.isNotBlank()}.joinToString(" "))
                        }
                    }
                    runCatching{sdk?.close()}
                    amplitude.value=0f
                    if(state.value!=AsrServiceStatus.Failed)state.value=AsrServiceStatus.Ready
                    synchronized(lock){if(session===run)session=null}
                    log("LOCAL_SDK_RECOGNITION_END acceptedBytes=$accepted cancelled=${run.cancelled}")
                    run.done.complete(Unit)
                    channel.close()
                }
            }
        }
        awaitClose { run.stop(false); if(!run.done.isCompleted)worker.cancel() }
    }
    override suspend fun stopRecording(){
        val run=session?:return
        run.stop(false)
        withTimeoutOrNull(7000){run.done.await()}
    }
    override suspend fun cancelRecording(){
        val run=session?:return
        run.stop(true)
        withTimeoutOrNull(7000){run.done.await()}
    }
    override fun release(){session?.stop(true)}
}
