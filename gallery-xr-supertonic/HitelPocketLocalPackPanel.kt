package com.google.ai.edge.gallery.ui.modelmanager

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import com.google.ai.edge.gallery.services.tts.HitelPocketEightModel
import kotlinx.coroutines.*

@Composable
internal fun HitelPocketLocalPackPanel() {
  val context=LocalContext.current
  val scope=rememberCoroutineScope()
  var ready by remember { mutableStateOf(HitelPocketEightModel.installed(context)) }
  var busy by remember { mutableStateOf(false) }
  var message by remember { mutableStateOf("") }
  val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
    if(uri!=null)scope.launch {
      busy=true
      try {
        withContext(Dispatchers.IO){HitelPocketEightModel.importPack(context,uri)}
        ready=HitelPocketEightModel.installed(context)
        message="한국어 100M 로컬 모델 준비 완료"
      }catch(e:CancellationException){throw e}
      catch(e:Exception){message="모델 가져오기 실패: "+e.message}
      finally{busy=false}
      Toast.makeText(context,message,Toast.LENGTH_LONG).show()
    }
  }
  Column {
    Text("Pocket TTS 한국어 100M — 로컬 모델")
    Text(if(ready)"준비 완료" else "한국어 모델 ZIP 선택 필요")
    TextButton(enabled=!busy,onClick={picker.launch(arrayOf("*/*"))}) {
      Text("로컬 한국어 모델 ZIP 선택")
    }
    if(busy)LinearProgressIndicator()
    if(message.isNotEmpty())Text(message)
  }
}
