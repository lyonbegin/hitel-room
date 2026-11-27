package com.google.ai.edge.gallery.ui.common

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayInputStream
import java.io.File
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MobileActionsLocalImportTest {
  @Test fun rejectsInvalidHeaderAndTruncatedFile():Unit=runBlocking {
    val dir=InstrumentationRegistry.getInstrumentation().targetContext.cacheDir
    val target=File(dir,"test-mobile-actions.litertlm")
    target.writeText("existing")
    try {
      for (payload in listOf("NOTMODEL", "LITERTLMtruncated")) {
        var rejected=false
        try { HitelMobileActionsImport.copyVerified(ByteArrayInputStream(payload.toByteArray()),target){} }
        catch(e:java.io.IOException){rejected=true}
        assertTrue(rejected)
        assertEquals("existing",target.readText())
      }
      android.util.Log.i("HITEL_MOBILE_LOCAL","INVALID_IMPORT_PRESERVES_EXISTING_PASS")
    }finally{target.delete()}
    Unit
  }
}
