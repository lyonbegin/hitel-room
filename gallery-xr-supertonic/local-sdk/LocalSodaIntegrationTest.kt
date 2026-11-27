package com.google.ai.edge.gallery.services.asr
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.hitel.soda.sdk.LocalSodaSdk
import com.google.ai.edge.gallery.data.supplementary.SpeechAvailability
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LocalSodaIntegrationTest {
    @Test fun testLocalBackendWithoutPack()=runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val service=HitelLocalSodaAsrService(context)
        assertEquals(AsrEngineType.MLKIT_BASIC,service.engineType)
        assertTrue(LocalSodaSdk.supportsLocale("ko-KR"))
        assertTrue(LocalSodaSdk.supportsLocale("en-US"))
        assertFalse(LocalSodaSdk.supportsLocale("ja-JP"))
        assertFalse(LocalSodaSdk.installed(context,"ko-KR"))
        val expected=if(LocalSodaSdk.supportsDevice())AsrServiceStatus.NotDownloaded else AsrServiceStatus.Unavailable
        assertEquals(expected,service.checkLanguageStatus("ko-KR"))
        assertFalse(service.checkLanguageAvailability("mlkit_asr_basic","ko-KR") is SpeechAvailability.Available)
        var failed=false
        try{service.prepare(AsrPreparationConfig(languageCode="ko-KR"))}catch(e:AsrServiceError.ModelNotDownloaded){failed=true}
        assertTrue(failed)
        android.util.Log.i("HITEL_LOCAL_SDK","GALLERY_SDK_NO_FAKE_READY_PASS; ARM64_STT_NOT_TESTED")
    }
}
