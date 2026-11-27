package com.google.ai.edge.gallery.services.asr

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.ai.edge.gallery.data.DataStoreRepository
import com.google.ai.edge.gallery.proto.AsrSettingsProto
import java.lang.reflect.Proxy
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GlobalAsrSettingsTest {
  @Test fun sharedSelectionAndMigration():Unit=runBlocking {
    var stored = AsrSettingsProto.getDefaultInstance()
    val store = Proxy.newProxyInstance(
      DataStoreRepository::class.java.classLoader,
      arrayOf(DataStoreRepository::class.java)
    ) { _, method, args ->
      when(method.name) {
        "readAsrSettings" -> stored
        "saveAsrSettings" -> {stored=args!![0] as AsrSettingsProto;Unit}
        else -> error("Unexpected datastore call: "+method.name)
      }
    } as DataStoreRepository
    val scope=CoroutineScope(SupervisorJob()+Dispatchers.Unconfined)
    try {
      val repo=AsrSettingsRepository(store,scope)
      assertEquals("ko-KR",repo.currentSessionSettings().languageCode)
      repo.preferInstalledLocalKorean()
      assertEquals(AsrEngineType.MLKIT_BASIC,repo.selectedEngineType.value)
      assertEquals("ko-KR",repo.currentSessionSettings().preparationConfig().languageCode)
      assertEquals("ko-KR",stored.selectedLanguageCode)
      repo.setGlobalLocalAsr("en-US")
      assertEquals("en-US",repo.currentSessionSettings().languageCode)
      assertEquals("en-US",stored.selectedLanguageCode)
      repo.preferInstalledLocalKorean()
      assertEquals("en-US",repo.currentSessionSettings().languageCode)
      val reloaded=AsrSettingsRepository(store,scope)
      assertEquals(AsrEngineType.MLKIT_BASIC,reloaded.selectedEngineType.value)
      assertEquals("en-US",reloaded.currentSessionSettings().languageCode)
      android.util.Log.i("HITEL_GLOBAL_ASR","GLOBAL_ASR_ATOMIC_SELECTION_PERSISTENCE_PASS")
    }finally{scope.cancel()}
    Unit
  }
}
