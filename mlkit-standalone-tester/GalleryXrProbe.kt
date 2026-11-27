package com.hitel.mlkit.tester

import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.ai.edge.gallery.customtasks.xrlanguageteacher.xr.GlassesMicStream
import com.google.ai.edge.gallery.services.asr.AsrPreparationConfig
import com.google.ai.edge.gallery.services.asr.AsrRecordingOptions
import com.google.ai.edge.gallery.services.asr.XrOriginalRecordingProbe
import com.google.mlkit.genai.common.FeatureStatus
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.io.IOException
import android.os.SystemClock

/** Comparison path. The original XR capture is exercised on the phone context.
 * The original SDK status remains authoritative. Local JNI remains separate.
 */
class GalleryXrProbe(private val context:Context, private val trace:(String)->Unit) {
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main.immediate)
    private val mic=GlassesMicStream(scope,Dispatchers.IO)
    private var service:XrOriginalRecordingProbe?=null
    private var source:ParcelFileDescriptor?=null
    private var fileWriter:ParcelFileDescriptor?=null
    private var producer:Job?=null
    private var stopping=false

    suspend fun run(locale:String, uri:Uri?) {
        val s=XrOriginalRecordingProbe(context)
        service=s
        try {
            trace("XR_ORIGINAL_STATUS_ENTER locale=$locale")
            val raw=withTimeout(30000){s.rawLanguageStatus(locale)}
            trace("XR_ORIGINAL_STATUS_RETURN raw=$raw")
            if(raw!=FeatureStatus.AVAILABLE) {
                trace("XR_BLOCKED_MODEL_NOT_AVAILABLE raw=$raw; official model gate preserved; selected local ZIP is not registered in Google service")
                return
            }
            trace("XR_ORIGINAL_PREPARE_ENTER")
            withTimeout(30000){s.prepare(AsrPreparationConfig(languageCode=locale))}
            trace("XR_ORIGINAL_PREPARE_RETURN")
            if(uri==null) {
                source=mic.open(context) ?: error("Original GlassesMicStream.open returned null")
                trace("XR_ORIGINAL_GLASSES_MIC_OPEN_RETURN phone_context=true format=16000/1/PCM16 chunkBytes=640")
            } else {
                val (read,write)=ParcelFileDescriptor.createPipe()
                source=read; fileWriter=write
                trace("XR_FILE_PFD_OPEN chunkBytes=640")
                producer=scope.launch(Dispatchers.IO) {
                    try {
                        val start=SystemClock.elapsedRealtime()
                        var bytes=0L
                        ParcelFileDescriptor.AutoCloseOutputStream(write).use { out ->
                            val input=context.contentResolver.openInputStream(uri) ?: throw IOException("Cannot open raw PCM")
                            input.use {
                                val buffer=ByteArray(640)
                                while(isActive) {
                                    val n=it.read(buffer)
                                    if(n<=0) break
                                    check(n%2==0){"PCM must have even byte count"}
                                    delay((start+bytes/32-SystemClock.elapsedRealtime()).coerceAtLeast(0))
                                    out.write(buffer,0,n)
                                    bytes+=n
                                    if(bytes%32000L<640L)withContext(Dispatchers.Main){trace("XR_FILE_FEED bytes=$bytes")}
                                }
                                delay((start+bytes/32-SystemClock.elapsedRealtime()).coerceAtLeast(0))
                            }
                        }
                        withContext(Dispatchers.Main){trace("XR_FILE_EOF bytes=$bytes"); stop()}
                    }catch(e:CancellationException){throw e}
                    catch(e:Exception){withContext(Dispatchers.Main){trace("XR_FILE_ERROR "+android.util.Log.getStackTraceString(e));stop()}}
                }
            }
            var emissions=0
            trace("XR_ORIGINAL_START_RECORDING_ENTER; externalAudioSource=PFD")
            withTimeout(120000) {
                s.startRecording(AsrRecordingOptions(showInterimResults=true, externalAudioSource={source})).collect {
                    emissions++
                    trace("XR_ORIGINAL_TRANSCRIPT count=$emissions text=$it")
                }
            }
            trace("XR_ORIGINAL_FLOW_END emissions=$emissions")
        } finally {
            mic.stop()
            runCatching { source?.close() }
            runCatching { fileWriter?.close() }
            producer?.cancel()
            runCatching { s.release() }
            service=null
            scope.cancel()
            trace("XR_ORIGINAL_RELEASE")
        }
    }
    suspend fun stop() {
        if(stopping)return
        stopping=true
        trace("XR_ORIGINAL_STOP_ENTER")
        mic.finishAndFlush()
        runCatching { fileWriter?.close() }
        service?.stopRecording()
        trace("XR_ORIGINAL_STOP_RETURN")
    }
}
