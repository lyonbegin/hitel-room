package com.google.ai.edge.gallery.ui.common

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material3.Button
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.google.ai.edge.gallery.common.getModelStorageDir
import com.google.ai.edge.gallery.data.Model
import com.google.ai.edge.gallery.data.ModelDownloadStatusType
import com.google.ai.edge.gallery.ui.modelmanager.ModelManagerViewModel
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Only the pinned built-in Mobile Actions file. Do not change the original inference backend. */
internal object HitelMobileActionsImport {
  const val MODEL_ID = "litert-community/functiongemma-270m-ft-mobile-actions"
  const val VERSION = "38942192c9b723af836d489074823ff33d4a3e7a"
  const val FILE = "mobile_actions_q8_ekv1024.litertlm"
  const val SIZE = 288964608L
  private val magic = "LITERTLM".toByteArray(Charsets.US_ASCII)
  private val lock = Mutex()
  fun matches(model: Model) = model.modelId == MODEL_ID &&
    model.downloadInfo.version == VERSION &&
    model.downloadInfo.downloadFileName == FILE

  /** Verify container header and exact allowlist size before atomic install.
   * Digest is logged for diagnostics; upstream gated SHA-256 not independently available.
   */
  suspend fun copyVerified(input: InputStream, target: File, progress: (Long)->Unit): String {
    check(target.parentFile?.isDirectory == true || target.parentFile?.mkdirs() == true)
    val tmp = File.createTempFile(".hitel-mobile-actions-", ".import", target.parentFile)
    try {
      val digest=MessageDigest.getInstance("SHA-256")
      var total=0L
      FileOutputStream(tmp).use { out ->
        val header=ByteArray(magic.size)
        var pos=0
        while(pos<header.size) {
          currentCoroutineContext().ensureActive()
          val n=input.read(header,pos,header.size-pos)
          if(n<=0)throw IOException("LiteRT-LM header missing")
          pos+=n
        }
        if(!header.contentEquals(magic))throw IOException("Invalid LiteRT-LM header")
        out.write(header);digest.update(header);total=header.size.toLong()
        val buffer=ByteArray(256*1024)
        var last=0L
        while(true){
          currentCoroutineContext().ensureActive()
          val n=input.read(buffer)
          if(n<0)break
          if(n==0)continue
          total+=n
          if(total>SIZE)throw IOException("Model exceeds expected size")
          out.write(buffer,0,n);digest.update(buffer,0,n)
          if(total-last>=2*1024*1024){progress(total);last=total}
        }
        if(total!=SIZE)throw IOException("Model size mismatch: $total / $SIZE bytes")
        out.fd.sync()
      }
      currentCoroutineContext().ensureActive()
      val sha=digest.digest().joinToString(""){"%02x".format(it.toInt() and 255)}
      Files.move(tmp.toPath(),target.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING)
      progress(SIZE)
      return sha
    }finally{tmp.delete()}
  }

  suspend fun install(context: Context, model: Model, uri: Uri, progress:(Long)->Unit):String=lock.withLock {
    require(matches(model)){"Unexpected Mobile Actions model revision"}
    withContext(Dispatchers.IO) {
      val dir=File(getModelStorageDir(context),model.normalizedName+"/"+VERSION)
      val target=File(dir,FILE)
      Log.i("HITEL_MOBILE_LOCAL","IMPORT_ENTER path="+target.absolutePath)
      val input=context.contentResolver.openInputStream(uri) ?: throw IOException("Cannot open selected file")
      val sha=input.use{copyVerified(it,target,progress)}
      Log.i("HITEL_MOBILE_LOCAL","IMPORT_INSTALLED bytes="+target.length()+" sha256="+sha+"; expected official digest not verified")
      sha
    }
  }
}

@Composable
internal fun HitelMobileActionsLocalButton(
  model:Model,
  manager:ModelManagerViewModel,
  onOnlineDownload:()->Unit,
  onlineEnabled:Boolean,
  modifier:Modifier=Modifier,
) {
  val context=LocalContext.current
  val scope=rememberCoroutineScope()
  var busy by remember(model.name){mutableStateOf(false)}
  var progress by remember(model.name){mutableStateOf(0f)}
  var message by remember(model.name){mutableStateOf("")}
  val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){ uri ->
    if(uri!=null&&!busy){
      busy=true;progress=0f;message=""
      scope.launch {
        try{
          val current=manager.uiState.value.modelDownloadStatus[model.name]?.status
          check(current!=ModelDownloadStatusType.IN_PROGRESS&&current!=ModelDownloadStatusType.UNZIPPING){"Stop the existing download first"}
          HitelMobileActionsImport.install(context,model,uri){bytes->
            scope.launch { progress=(bytes.toDouble()/HitelMobileActionsImport.SIZE).toFloat() }
          }
          val status=manager.refreshModelStatus(model)
          check(status?.status==ModelDownloadStatusType.SUCCEEDED){"Gallery did not recognize installed model"}
          Log.i("HITEL_MOBILE_LOCAL","GALLERY_MODEL_AVAILABLE model="+model.name)
          android.widget.Toast.makeText(context,"로컬 모델 설치 완료",android.widget.Toast.LENGTH_SHORT).show()
        }catch(e:CancellationException){throw e}
        catch(e:Exception){message=e.message?:"Import failed";Log.e("HITEL_MOBILE_LOCAL","IMPORT_FAILED",e)}
        finally{busy=false}
      }
    }
  }
  Column(modifier=modifier,verticalArrangement=Arrangement.spacedBy(4.dp)) {
    Button(enabled=!busy,onClick={picker.launch(arrayOf("*/*"))}){Text("로컬 모델 선택")}
    TextButton(enabled=!busy&&onlineEnabled,onClick=onOnlineDownload){Text("Hugging Face 다운로드")}
    if(busy){LinearProgressIndicator(progress={progress});Text("가져오는 중 "+(progress*100).toInt()+"%")}
    if(message.isNotEmpty())Text(message)
  }
}
