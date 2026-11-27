package com.hitel.mlkit.tester

import android.Manifest
import android.app.Activity
import android.content.*
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.widget.*
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.GenAiException
import com.google.mlkit.genai.common.audio.AudioSource
import com.google.mlkit.genai.speechrecognition.*
import java.util.Locale
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class MainActivity : Activity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var output: TextView
    private lateinit var logScroll: ScrollView
    private lateinit var localePicker: Spinner
    private lateinit var statusLabel: TextView
    private val lines = StringBuilder()
    private var operation: Job? = null
    private var active: SpeechRecognizer? = null
    private var xrProbe: GalleryXrProbe? = null
    private var recognizing = false
    private var file: Uri? = null
    private var localModel: Uri? = null
    private lateinit var fileLabel: TextView
    private lateinit var modelLabel: TextView
    private val tag = "HITEL_MLKIT_PROBE"
    private val language get() = localePicker.selectedItem.toString()
    private val controls = mutableListOf<Button>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(12,12,12,12) }
        root.setOnApplyWindowInsetsListener { v, inset ->
            val bars = inset.getInsets(WindowInsets.Type.systemBars())
            v.setPadding(bars.left+12,bars.top+12,bars.right+12,bars.bottom+12)
            inset
        }
        root.addView(TextView(this).apply { text = "HITEL SODA Local"; textSize = 21f })
        localePicker = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity,android.R.layout.simple_spinner_dropdown_item,listOf("ko-KR","en-US"))
        }
        root.addView(localePicker)
        statusLabel = TextView(this).apply { text = "READY — SDK 1.0.0-alpha2"; textSize = 14f }
        root.addView(statusLabel)
        fun row(vararg specs: Pair<String,()->Unit>) {
            val r = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
            specs.forEach { (label,action) ->
                val b = Button(this).apply { text = label; textSize = 12f; setOnClickListener { action() } }
                controls.add(b)
                r.addView(b,LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1f))
            }
            root.addView(r)
        }
        row("상태 검사" to { runTask("STATUS") { environment(); withClient { check(it) }; platform(false) } },
            "SDK 다운로드" to { runTask("SDK_DOWNLOAD") { environment(); withClient { download(it) } } })
        row("Google 다운로드" to { runTask("PLATFORM_DOWNLOAD") { environment(); platform(true); withClient { check(it) } } },
            "마이크 STT" to { mic() })
        row("PCM 선택" to { chooseFile() },
            "PCM STT" to { val uri=file; if (uri==null) trace("Select raw PCM first") else runTask("PCM_STT") { recognize(uri) } })
        fileLabel=TextView(this).apply { text="PCM 파일: 선택 안 됨"; textSize=12f; maxLines=2 }
        root.addView(fileLabel)
        row("로컬 모델 선택" to { openDocument(12) },
            "로컬 실행 화면" to { startActivity(Intent(this,NativeLocalActivity::class.java)) })
        modelLabel=TextView(this).apply { text="SODA ZIP: 선택 안 됨"; textSize=12f; maxLines=2 }
        root.addView(modelLabel)
        row("XR 원본 마이크" to { xrMic() },
            "XR 원본 PCM" to { val uri=file; if(uri==null) trace("Select raw PCM first") else runTask("XR_ORIGINAL_PCM") { runXr(uri) } })
        row("전체 자동 시험" to { runTask("AUTO") { environment(); platform(false); withClient { download(it) } } },
            "음성 설정" to { try { startActivity(Intent(Settings.ACTION_VOICE_INPUT_SETTINGS)) } catch(e:Exception) { failure("SETTINGS",e) } })
        val actions=LinearLayout(this)
        fun action(name:String, f:()->Unit) {
            actions.addView(Button(this).apply { text=name; textSize=12f; setOnClickListener { f() } },LinearLayout.LayoutParams(0,-2,1f))
        }
        action("중지") {
            if (xrProbe!=null) scope.launch { try { xrProbe?.stop() } catch(e:Exception) { failure("XR_STOP",e) } }
            else if (recognizing) scope.launch { try { trace("STOP_ENTER"); active?.stopRecognition(); trace("STOP_RETURN") } catch(e:Exception) { failure("STOP",e) } }
            else { operation?.cancel(); trace("LOCAL_WAIT_CANCEL_REQUESTED") }
        }
        action("로그 복사") {
            val localLog=java.io.File(filesDir,"local-soda.log")
            val extra=runCatching { if(localLog.isFile) "\n--- Local SODA ---\n"+localLog.readText() else "" }.getOrDefault("")
            getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("ML Kit / Local SODA log",lines.toString()+extra))
            Toast.makeText(this,"로그 복사 완료",Toast.LENGTH_SHORT).show()
        }
        action("로그 지우기") { lines.clear(); output.text=""; trace("LOG_CLEARED") }
        root.addView(actions)
        output=TextView(this).apply { textSize=11f; typeface=android.graphics.Typeface.MONOSPACE; setTextIsSelectable(true) }
        logScroll=ScrollView(this).apply { addView(output) }
        root.addView(logScroll,LinearLayout.LayoutParams(-1,0,1f))
        setContentView(root)
        trace("APP_READY sdk=1.0.0-alpha2 common=1.0.0-beta5 original Google AAR; no replacement engine")
        trace("PCM format: raw signed 16-bit little endian, 16000 Hz, mono; not WAV or M4A")
    }

    private fun trace(message:String) {
        val line = "${System.currentTimeMillis()} +${SystemClock.elapsedRealtime()}ms $message"
        Log.i(tag,line)
        lines.append(line).append('\n')
        if (lines.length>180000) lines.delete(0,lines.length-150000)
        output.text=lines.toString()
        logScroll.post { logScroll.fullScroll(View.FOCUS_DOWN) }
    }
    private fun failure(stage:String,e:Throwable) {
        trace("$stage ERROR ${e.javaClass.name} code=${(e as? GenAiException)?.errorCode} message=${e.message}")
        trace(Log.getStackTraceString(e))
    }
    private fun runTask(name:String,block:suspend ()->Unit) {
        if (operation?.isActive==true) { trace("BUSY $name"); return }
        val started=SystemClock.elapsedRealtime()
        operation=scope.launch {
            controls.forEach { it.isEnabled=false }; localePicker.isEnabled=false
            statusLabel.text="$name RUNNING"
            trace("TASK_ENTER $name locale=$language")
            try { block(); trace("TASK_RETURN $name (see raw status; return alone is not STT success)") }
            catch(e:CancellationException) { trace("TASK_CANCELLED $name ${e.message}") }
            catch(e:Exception) { failure(name,e) }
            finally {
                recognizing=false
                controls.forEach { it.isEnabled=true }; localePicker.isEnabled=true
                statusLabel.text="$name END — see log"
                trace("TASK_END $name elapsed=${SystemClock.elapsedRealtime()-started}ms")
            }
        }
    }
    private fun environment() {
        trace("DEVICE sdk=${Build.VERSION.SDK_INT} model=${Build.MODEL} abis=${Build.SUPPORTED_ABIS.joinToString()} locale=${Locale.getDefault()}")
        for (pkg in listOf("com.google.android.tts","com.google.android.googlequicksearchbox","com.google.android.gms","com.google.android.aicore")) {
            try { val p=packageManager.getPackageInfo(pkg,0); trace("PACKAGE $pkg version=${p.versionName} code=${p.longVersionCode} enabled=${p.applicationInfo?.enabled}") }
            catch(e:Exception) { trace("PACKAGE $pkg unavailable ${e.javaClass.simpleName}") }
        }
        try {
            trace("VOICE_SERVICE_SETTING=${Settings.Secure.getString(contentResolver,"voice_recognition_service")}")
            val services=packageManager.queryIntentServices(Intent("android.speech.RecognitionService"),0)
            trace("RESOLVED_SERVICES=${services.joinToString { it.serviceInfo.packageName + "/" + it.serviceInfo.name }}")
            val cm=getSystemService(ConnectivityManager::class.java)
            val cap=cm.getNetworkCapabilities(cm.activeNetwork)
            trace("NETWORK active=${cm.activeNetwork} metered=${cm.isActiveNetworkMetered} validated=${cap?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)} unmetered=${cap?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)} vpn=${cap?.hasTransport(NetworkCapabilities.TRANSPORT_VPN)}")
            trace("STORAGE available=${StatFs(filesDir.absolutePath).availableBytes}")
            trace("MIC_PERMISSION=${checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED}")
            trace("PLATFORM_AVAILABLE=${android.speech.SpeechRecognizer.isRecognitionAvailable(this)} ON_DEVICE=${android.speech.SpeechRecognizer.isOnDeviceRecognitionAvailable(this)}")
        } catch(e:Exception) { failure("ENVIRONMENT",e) }
    }
    private suspend fun withClient(block:suspend (SpeechRecognizer)->Unit) {
        trace("SDK_GET_CLIENT_ENTER locale=$language mode=BASIC")
        val client=SpeechRecognition.getClient(speechRecognizerOptions { locale=Locale.forLanguageTag(language); preferredMode=SpeechRecognizerOptions.Mode.MODE_BASIC })
        active=client
        trace("SDK_GET_CLIENT_RETURN class=${client.javaClass.name}")
        try { block(client) } finally {
            trace("SDK_CLOSE_ENTER"); runCatching { client.close() }.onFailure { failure("SDK_CLOSE",it) }; active=null; trace("SDK_CLOSE_RETURN")
        }
    }
    private suspend fun check(client:SpeechRecognizer):Int {
        val started=SystemClock.elapsedRealtime()
        trace("CHECK_STATUS_ENTER")
        val s=withTimeout(30000) { client.checkStatus() }
        val name=when(s) { FeatureStatus.AVAILABLE -> "AVAILABLE"; FeatureStatus.DOWNLOADABLE -> "DOWNLOADABLE"; FeatureStatus.DOWNLOADING -> "DOWNLOADING"; FeatureStatus.UNAVAILABLE -> "UNAVAILABLE"; else -> "UNKNOWN" }
        trace("CHECK_STATUS_RETURN raw=$s name=$name elapsed=${SystemClock.elapsedRealtime()-started}ms")
        return s
    }
    private suspend fun download(client:SpeechRecognizer) {
        val s=check(client)
        if(s==FeatureStatus.AVAILABLE) { trace("ALREADY_AVAILABLE"); return }
        // Explicit button requests a real SDK download even when checkStatus reports unavailable.
        // Do not override the SDK status or treat its rejection as success.
        trace("SDK_DOWNLOAD_ENTER initial=$s")
        val start=SystemClock.elapsedRealtime()
        var events=0
        var completedCallback=false
        var errorCode:Int?=null
        var previousBytes=0L
        val finished=withTimeoutOrNull(180000) {
            client.download().collect { ev ->
                events++
                when(ev) {
                    is DownloadStatus.DownloadStarted -> trace("DOWNLOAD_STARTED bytes=${ev.bytesToDownload}")
                    is DownloadStatus.DownloadProgress -> { val bytes=ev.totalBytesDownloaded; trace("DOWNLOAD_PROGRESS bytes=$bytes delta=${bytes-previousBytes}"); previousBytes=bytes }
                    is DownloadStatus.DownloadCompleted -> { completedCallback=true; trace("DOWNLOAD_COMPLETED_CALLBACK") }
                    is DownloadStatus.DownloadFailed -> { errorCode=ev.e.errorCode; failure("DOWNLOAD_FAILED_CALLBACK",ev.e) }
                }
            }
            true
        }
        trace("SDK_DOWNLOAD_FLOW_END flowReturned=$finished completedCallback=$completedCallback errorCode=$errorCode events=$events elapsed=${SystemClock.elapsedRealtime()-start}ms")
        var current=check(client)
        if(current==FeatureStatus.DOWNLOADING) {
            trace("MODEL_PENDING_OBSERVE_BEGIN intervalMs=10000 maxSamples=18; no repeat download requests")
            for(i in 1..18) {
                delay(10000)
                val cm=getSystemService(ConnectivityManager::class.java)
                val caps=cm.getNetworkCapabilities(cm.activeNetwork)
                trace("PENDING_POLL index=$i metered=${cm.isActiveNetworkMetered} validated=${caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)} vpn=${caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN)}")
                current=check(client)
                if(current!=FeatureStatus.DOWNLOADING) break
            }
        }
        trace("MODEL_DOWNLOAD_VERDICT raw=$current installed=${current==FeatureStatus.AVAILABLE} completedCallback=$completedCallback lastError=$errorCode")
        platform(false)
    }
    private suspend fun platform(doDownload:Boolean) {
        if(Build.VERSION.SDK_INT<33) { trace("PLATFORM_SUPPORT_API requires Android 13"); return }
        val p=android.speech.SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
        val intent=Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE,language)
            .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL,android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        try {
            val support=CompletableDeferred<Boolean>()
            trace("PLATFORM_CHECK_SUPPORT_ENTER")
            p.checkRecognitionSupport(intent,mainExecutor,object:android.speech.RecognitionSupportCallback {
                override fun onSupportResult(result:android.speech.RecognitionSupport) {
                    trace("PLATFORM_INSTALLED=${result.installedOnDeviceLanguages}")
                    trace("PLATFORM_PENDING=${result.pendingOnDeviceLanguages}")
                    trace("PLATFORM_SUPPORTED=${result.supportedOnDeviceLanguages}")
                    support.complete(true)
                }
                override fun onError(error:Int) { trace("PLATFORM_SUPPORT_ERROR=$error"); support.complete(false) }
            })
            trace("PLATFORM_SUPPORT_END=${withTimeoutOrNull(20000){support.await()}}")
            if(doDownload) {
                trace("PLATFORM_DOWNLOAD_REQUEST_ENTER locale=$language")
                if(Build.VERSION.SDK_INT>=34) {
                    val done=CompletableDeferred<Boolean>()
                    p.triggerModelDownload(intent,mainExecutor,object:android.speech.ModelDownloadListener {
                        override fun onProgress(completedPercent:Int) { trace("PLATFORM_DOWNLOAD_PROGRESS=$completedPercent") }
                        override fun onSuccess() { trace("PLATFORM_DOWNLOAD_SUCCESS"); done.complete(true) }
                        override fun onScheduled() { trace("PLATFORM_DOWNLOAD_SCHEDULED") }
                        override fun onError(error:Int) { trace("PLATFORM_DOWNLOAD_ERROR=$error"); done.complete(false) }
                    })
                    trace("PLATFORM_DOWNLOAD_REQUEST_RETURN")
                    trace("PLATFORM_DOWNLOAD_TERMINAL=${withTimeoutOrNull(120000){done.await()}}")
                } else { p.triggerModelDownload(intent); trace("PLATFORM_DOWNLOAD_REQUEST_RETURN (no callback API)") }
            }
        } finally { p.destroy(); trace("PLATFORM_DESTROY") }
    }
    private suspend fun runXr(uri:Uri?) {
        val probe=GalleryXrProbe(this,::trace)
        xrProbe=probe
        try { probe.run(language,uri) } finally { xrProbe=null }
    }
    private fun xrMic() {
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),13); return
        }
        runTask("XR_ORIGINAL_MIC") { runXr(null) }
    }
    private fun mic() {
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),10); return
        }
        runTask("MIC_STT") { recognize(null) }
    }
    override fun onRequestPermissionsResult(code:Int,permissions:Array<out String>,results:IntArray) {
        super.onRequestPermissionsResult(code,permissions,results)
        if(code==13 && results.firstOrNull()==PackageManager.PERMISSION_GRANTED) xrMic()
        if(code==10) { trace("MIC_PERMISSION_RESULT=${results.firstOrNull()}"); if(results.firstOrNull()==PackageManager.PERMISSION_GRANTED) mic() }
    }
    private fun chooseFile() { openDocument(11) }
    private fun openDocument(code:Int) {
        trace("FILE_PICKER_ENTER kind=${if(code==12) "SODA_ZIP" else "PCM"}")
        try {
            val intent=Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                type="*/*"
                addCategory(Intent.CATEGORY_OPENABLE)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivityForResult(intent,code)
        } catch(e:Exception) { failure("FILE_PICKER",e) }
    }
    private fun documentName(uri:Uri):String {
        return try {
            contentResolver.query(uri,arrayOf(android.provider.OpenableColumns.DISPLAY_NAME),null,null,null)?.use {
                if(it.moveToFirst()) it.getString(0) else null
            } ?: "선택한 파일"
        } catch(e:Exception) { "선택한 파일" }
    }
    override fun onActivityResult(code:Int,result:Int,data:Intent?) {
        super.onActivityResult(code,result,data)
        if(code!=11 && code!=12) return
        val uri=data?.data
        if(result!=RESULT_OK || uri==null) { trace("FILE_PICKER_CANCELLED code=$code"); return }
        val name=documentName(uri)
        if(code==11) {
            file=uri
            fileLabel.text="PCM 파일: $name"
            trace("PCM_SELECTED name=$name")
        } else {
            localModel=uri
            modelLabel.text="SODA ZIP: $name"
            trace("LOCAL_MODEL_SELECTED name=$name; start independent native process")
            startActivity(Intent(this,NativeLocalActivity::class.java).setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
        }
    }
    private suspend fun verifyLocal(uri:Uri) {
        val name=documentName(uri)
        trace("LOCAL_ZIP_VERIFY_ENTER name=$name")
        val result=withContext(Dispatchers.IO) {
            val digest=java.security.MessageDigest.getInstance("SHA-1")
            var bytes=0L
            val header=ByteArray(4)
            var headerCount=0
            val input=contentResolver.openInputStream(uri) ?: error("Cannot open selected file")
            input.use {
                val buf=ByteArray(65536)
                while(true) {
                    ensureActive()
                    val n=it.read(buf)
                    if(n<0) break
                    if(n==0) continue
                    if(headerCount<4) {
                        val copy=minOf(n,4-headerCount)
                        System.arraycopy(buf,0,header,headerCount,copy)
                        headerCount+=copy
                    }
                    digest.update(buf,0,n)
                    bytes+=n
                }
            }
            val zip=headerCount==4 && header[0]==0x50.toByte() && header[1]==0x4b.toByte() && header[2]==3.toByte() && header[3]==4.toByte()
            Triple(bytes,digest.digest().joinToString("") { "%02X".format(it.toInt() and 255) },zip)
        }
        trace("LOCAL_ZIP_VERIFY_RESULT name=$name bytes=${result.first} sha1=${result.second} zipHeader=${result.third}")
        val known=when(name) {
            "soda-ko-KR-v5072.zip" -> 93639000L to "58DEECE081FD89EE928BA6BD705B6878BE6BD395"
            "soda-en-US-v3072.zip" -> 62065000L to "F8745C8DBBDAE1E77A9A9E7BAF378CBC78B7BB2A"
            else -> null
        }
        val verified=known!=null && result.third && result.first==known.first && result.second.equals(known.second,true)
        val verdict=when {
            !result.third -> "NOT_ZIP"
            known==null -> "HASH_ONLY_UNKNOWN_VERSION"
            verified -> "EXPECTED_SIZE_SHA1_MATCH"
            else -> "SIZE_OR_HASH_MISMATCH"
        }
        trace("LOCAL_ZIP_VERDICT=$verdict; SDK local model registration/loading not implemented")
        modelLabel.text="SODA ZIP: $name / $verdict"
    }
    private suspend fun recognize(uri:Uri?) {
        withClient { client ->
            if(check(client)!=FeatureStatus.AVAILABLE) { trace("STT_BLOCKED_MODEL_NOT_AVAILABLE"); return@withClient }
            trace("WARMUP_ENTER"); withTimeout(30000){client.warmup()}; trace("WARMUP_RETURN")
            val pipe=uri?.let { ParcelFileDescriptor.createPipe() }
            val read=pipe?.get(0)
            val write=pipe?.get(1)
            try {
                coroutineScope {
                    trace("AUDIO_SOURCE=${if(uri==null) "MIC" else "PFD_PIPE raw16k mono s16le chunk=1024 bytes/32ms"}")
                    val request=speechRecognizerRequest {
                        audioSource=read?.let{AudioSource.fromPfd(it)} ?: AudioSource.fromMic()
                    }
                    recognizing=true
                    var finals=0
                    trace("START_RECOGNITION_ENTER")
                    val producer=if(uri!=null && write!=null) launch(Dispatchers.IO) {
                        var bytes=0L
                        var chunks=0L
                        val start=SystemClock.elapsedRealtime()
                        try {
                            ParcelFileDescriptor.AutoCloseOutputStream(write).use { sink ->
                                val input=contentResolver.openInputStream(uri) ?: error("Cannot open raw PCM")
                                input.use {
                                    val buffer=ByteArray(1024)
                                    while(isActive) {
                                        var n=0
                                        while(n<buffer.size) {
                                            val count=it.read(buffer,n,buffer.size-n)
                                            if(count<=0) break
                                            n+=count
                                        }
                                        if(n==0) break
                                        check(n%2==0) { "Invalid PCM: odd byte count" }
                                        val due=start+bytes/32
                                        delay((due-SystemClock.elapsedRealtime()).coerceAtLeast(0L))
                                        sink.write(buffer,0,n)
                                        bytes+=n; chunks++
                                        if(chunks==1L || chunks%32L==0L) withContext(Dispatchers.Main) {
                                            trace("PCM_WRITE chunks=$chunks bytes=$bytes elapsed=${SystemClock.elapsedRealtime()-start}ms")
                                        }
                                        if(n<buffer.size) break
                                    }
                                    delay((start+bytes/32-SystemClock.elapsedRealtime()).coerceAtLeast(0L))
                                }
                            }
                            withContext(Dispatchers.Main) { trace("PCM_EOF chunks=$chunks bytes=$bytes"); client.stopRecognition(); trace("PCM_STOP_RETURN") }
                        } catch(e:CancellationException) { throw e }
                        catch(e:Exception) { withContext(Dispatchers.Main) { failure("PCM_PRODUCER",e) }; throw e }
                    } else null
                    try {
                        withTimeout(120000) {
                            client.startRecognition(request).takeWhile { response ->
                                when(response) {
                                    is SpeechRecognizerResponse.PartialTextResponse -> trace("PARTIAL=${response.text}")
                                    is SpeechRecognizerResponse.FinalTextResponse -> { finals++; trace("FINAL=${response.text}") }
                                    is SpeechRecognizerResponse.ErrorResponse -> { failure("RECOGNITION_ERROR",response.e); throw response.e }
                                    is SpeechRecognizerResponse.CompletedResponse -> trace("COMPLETED_RESPONSE finals=$finals")
                                    else -> if(response !is SpeechRecognizerResponse.AudioLevelResponse) trace("RESPONSE=${response.javaClass.simpleName}")
                                }
                                response !is SpeechRecognizerResponse.CompletedResponse
                            }.collect{}
                        }
                        trace("RECOGNITION_FLOW_END finalCount=$finals")
                    } finally {
                        runCatching { read?.close() }
                        runCatching { write?.close() }
                        producer?.cancel()
                    }
                }
            } finally { recognizing=false; runCatching { read?.close() }; runCatching { write?.close() } }
        }
    }
    override fun onDestroy() { scope.cancel(); super.onDestroy() }
}
