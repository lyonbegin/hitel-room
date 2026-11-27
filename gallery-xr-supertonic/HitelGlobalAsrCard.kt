package com.google.ai.edge.gallery.ui.home

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import android.util.Log
import com.google.ai.edge.gallery.services.asr.AsrEngineType
import com.google.ai.edge.gallery.services.asr.AsrModelRegistry
import com.google.ai.edge.gallery.ui.modelmanager.ModelManagerViewModel
import com.google.ai.edge.gallery.ui.modelmanager.rememberHitelLocalPackPicker
import com.hitel.soda.sdk.LocalSodaSdk
import kotlinx.coroutines.*

/** Home-level ASR selection; the existing singleton repository is the only settings store. */
@Composable
internal fun HitelGlobalAsrCard(manager: ModelManagerViewModel) {
  val context = LocalContext.current
  val engine by manager.selectedAsrEngineType.collectAsState()
  val locale by manager.selectedAsrLanguageCode.collectAsState()
  val active by manager.activeAsrEngineType.collectAsState()
  val interim by manager.showInterimResults.collectAsState()
  val state by manager.uiState.collectAsState()
  val scope = rememberCoroutineScope()
  var open by remember { mutableStateOf(false) }
  var busy by remember { mutableStateOf(false) }
  var message by remember { mutableStateOf("") }
  val model = state.supplementaryModels.firstOrNull {
    AsrModelRegistry.engineTypeForModelId(it.modelId) == AsrEngineType.MLKIT_BASIC
  }
  val picker = rememberHitelLocalPackPicker(manager, { busy = it }, { message = it })
  val localKo = LocalSodaSdk.installed(context, "ko-KR")
  val localEn = LocalSodaSdk.installed(context, "en-US")
  fun name(tag: String) = when(tag) { "ko-KR" -> "한국어"; "en-US" -> "English"; else -> tag }
  val engineName = if (engine == AsrEngineType.MLKIT_BASIC) "로컬 SODA (ML Kit Basic)" else engine.name
  Card(modifier=Modifier.fillMaxWidth().padding(horizontal=24.dp,vertical=6.dp)) {
    Column(Modifier.padding(16.dp), verticalArrangement=Arrangement.spacedBy(6.dp)) {
      Text("전역 음성인식 설정 (ASR)", style=MaterialTheme.typography.titleMedium)
      Text("$engineName · "+name(locale))
      Text("한국어 모델: "+if(localKo)"설치 완료" else "미설치",style=MaterialTheme.typography.bodySmall)
      TextButton(onClick={open=true}) { Text("전역 ASR 설정") }
    }
  }
  if(open) AlertDialog(
    onDismissRequest={if(!busy)open=false},
    title={Text("전역 음성인식 설정")},
    text={
      Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
        Text("Gallery의 일반 음성입력과 XR Teacher 대화에서 공통으로 사용합니다.")
        Text("현재 선택: $engineName / "+name(locale))
        Text("실제 최근 엔진: "+(active?.name ?: "아직 미실행"))
        for(tag in listOf("ko-KR","en-US")){
          val installed=if(tag=="ko-KR")localKo else localEn
          val selected=engine==AsrEngineType.MLKIT_BASIC&&locale==tag
          OutlinedButton(
            modifier=Modifier.fillMaxWidth(),
            enabled=installed&&!busy,
            onClick={
              busy=true;message=""
              scope.launch{
                try{
                  val service=withContext(Dispatchers.IO){
                    manager.asrServiceProvider.prepareServiceOrNull(
                      AsrEngineType.MLKIT_BASIC,
                      com.google.ai.edge.gallery.services.asr.AsrPreparationConfig(languageCode=tag,modelId=AsrModelRegistry.modelId(AsrEngineType.MLKIT_BASIC))
                    )
                  }
                  checkNotNull(service){"Local SDK unavailable"}
                  manager.asrSettingsRepository.setGlobalLocalAsr(tag)
                  manager.checkAsrEngineSupport()
                  message=name(tag)+" 전역 기본 ASR 적용 완료"
                  Log.i("HITEL_GLOBAL_ASR","GLOBAL_ASR_APPLIED engine=MLKIT_BASIC locale="+tag)
                }catch(e:CancellationException){throw e}
                catch(e:Exception){message="설정 실패: "+e.message}
                finally{busy=false}
              }
            }
          ){Text(name(tag)+" · "+(if(installed)"설치 완료" else "모델 필요")+(if(selected)" · 선택됨" else ""))}
        }
        TextButton(enabled=!busy&&model!=null,onClick={model?.let(picker)}){Text("로컬 모델 ZIP 선택")}
        if(model==null)Text("모델 목록을 불러오는 중이거나 Basic 모델이 숨겨져 있습니다.")
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
          Switch(checked=interim,onCheckedChange={manager.asrSettingsRepository.setShowInterimResults(it)},enabled=!busy)
          Text("실시간 자막")
        }
        if(busy)LinearProgressIndicator()
        if(message.isNotBlank())Text(message)
        Text("외국어 발음 연습은 수업 언어를 사용합니다. 선택한 엔진에 해당 언어팩이 없으면 인식을 시작하지 않습니다.",style=MaterialTheme.typography.bodySmall)
      }
    },
    confirmButton={TextButton(enabled=!busy,onClick={open=false}){Text("닫기")}}
  )
}
