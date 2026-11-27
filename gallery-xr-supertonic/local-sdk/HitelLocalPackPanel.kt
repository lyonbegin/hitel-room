package com.google.ai.edge.gallery.ui.modelmanager

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import android.widget.Toast
import android.util.Log
import com.google.ai.edge.gallery.data.Model
import com.google.ai.edge.gallery.data.ModelDownloadStatus
import com.google.ai.edge.gallery.data.ModelDownloadStatusType
import com.google.ai.edge.gallery.data.supplementary.LanguageState
import com.hitel.soda.sdk.LocalSodaSdk
import kotlinx.coroutines.*

/** Gallery UI for the local SDK. Imported files stay in private Gallery storage across restarts. */
@Composable
internal fun rememberHitelLocalPackPicker(
    manager:ModelManagerViewModel,
    onBusy:(Boolean)->Unit={},
    onMessage:(String)->Unit={}
):(Model)->Unit {
    val context=LocalContext.current.applicationContext
    val scope=rememberCoroutineScope()
    var pending by remember { mutableStateOf<Model?>(null) }
    val busyCallback by rememberUpdatedState(onBusy)
    val messageCallback by rememberUpdatedState(onMessage)
    val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        val model=pending
        if(uri==null||model==null){busyCallback(false);pending=null;return@rememberLauncherForActivityResult}
        scope.launch {
            busyCallback(true)
            try {
                val locale=withContext(Dispatchers.IO){
                    LocalSodaSdk(context){_,_->}.use{ it.importModel(uri) }
                }
                manager.setLanguagePackStatus(model,locale,ModelDownloadStatus(status=ModelDownloadStatusType.SUCCEEDED))
                manager.supplementarySpeechModelRepository.onLanguageDownloadProgress(model.name,LanguageState.Installed(locale))
                manager.supplementarySpeechModelRepository.retryModel(model)
                manager.refreshLanguagePackStatuses(model,listOf("ko-KR","en-US"))
                manager.checkAsrEngineSupport()
                val message="$locale 로컬 모델 준비 완료"
                messageCallback(message)
                Toast.makeText(context,message,Toast.LENGTH_LONG).show()
                Log.i("HITEL_LOCAL_SDK","GALLERY_LOCAL_IMPORT_READY locale=$locale")
            }catch(e:CancellationException){throw e}
            catch(e:Exception){
                val message="로컬 모델 가져오기 실패: "+e.message
                messageCallback(message)
                Toast.makeText(context,message,Toast.LENGTH_LONG).show()
                Log.e("HITEL_LOCAL_SDK",message,e)
            }finally{busyCallback(false);pending=null}
        }
    }
    return {model->
        if(pending==null){
            pending=model
            picker.launch(arrayOf("*/*"))
        }
    }
}

@Composable
fun HitelLocalPackPanel(model:Model,manager:ModelManagerViewModel){
    val context=LocalContext.current
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    val picker=rememberHitelLocalPackPicker(manager,{busy=it},{message=it})
    Column {
        Text("ML Kit Basic — 로컬 SODA SDK")
        Text("한국어: "+if(LocalSodaSdk.installed(context,"ko-KR"))"준비 완료" else "ZIP 선택 필요")
        Text("영어: "+if(LocalSodaSdk.installed(context,"en-US"))"준비 완료" else "ZIP 선택 필요")
        TextButton(enabled=!busy,onClick={picker(model)}){Text("로컬 모델 ZIP 선택")}
        if(busy){LinearProgressIndicator();Text("ZIP 검증 및 엔진 초기화 중")}
        if(message.isNotEmpty())Text(message)
        if(!LocalSodaSdk.supportsDevice())Text("원본 엔진은 ARM64 실기기에서 실행됩니다.")
    }
}
