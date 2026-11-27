package com.google.ai.edge.gallery.services.asr

import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.audio.AudioSource
import com.google.mlkit.genai.speechrecognition.SpeechRecognition
import com.google.mlkit.genai.speechrecognition.SpeechRecognizerOptions
import com.google.mlkit.genai.speechrecognition.SpeechRecognizerResponse
import com.google.mlkit.genai.speechrecognition.speechRecognizerOptions
import com.google.mlkit.genai.speechrecognition.speechRecognizerRequest
import java.io.File
import java.util.Locale
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ManagedMlKitDeviceTest {
  @Test fun koreanBasicRecognition(): Unit = runBlocking {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val tag = "HITEL_MLKIT_TEST"
    val source = File(context.filesDir, "mlkit-ko-test.pcm")
    assertTrue("Missing actual PCM fixture", source.length() > 32000)
    // Compare Android's public on-device recognizer with the ML Kit client.
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    instrumentation.runOnMainSync {
      try {
        Log.i(tag, "PLATFORM_RECOGNITION_AVAILABLE=${android.speech.SpeechRecognizer.isRecognitionAvailable(context)}")
        Log.i(tag, "PLATFORM_ON_DEVICE_AVAILABLE=${android.speech.SpeechRecognizer.isOnDeviceRecognitionAvailable(context)}")
      } catch (e: Exception) {
        Log.w(tag, "PLATFORM_AVAILABILITY_ERROR", e)
      }
    }
    val client = SpeechRecognition.getClient(speechRecognizerOptions {
      locale = Locale.forLanguageTag("ko-KR")
      preferredMode = SpeechRecognizerOptions.Mode.MODE_BASIC
    })
    try {
      var status = withTimeout(30000) { client.checkStatus() }
      Log.i(tag, "INITIAL_STATUS=$status")
      // Allow freshly booted Google services to initialize; never bypass availability.
      repeat(12) {
        if (status == FeatureStatus.UNAVAILABLE) {
          delay(5000)
          status = withTimeout(30000) { client.checkStatus() }
          Log.i(tag, "AVAILABILITY_RECHECK=$status")
        }
      }
      if (status == FeatureStatus.DOWNLOADABLE || status == FeatureStatus.DOWNLOADING) {
        val downloadResult = withTimeoutOrNull(180000) {
          client.download().collect { Log.i(tag, "DOWNLOAD_EVENT=$it") }
          true
        }
        Log.i(tag, "DOWNLOAD_FLOW_FINISHED=$downloadResult")
        status = withTimeout(30000) { client.checkStatus() }
      }
      Log.i(tag, "AFTER_DOWNLOAD_STATUS=$status")
      if (status == FeatureStatus.UNAVAILABLE) {
        // Compare a common supported locale on the same service, without downloading or changing models.
        val probe = SpeechRecognition.getClient(speechRecognizerOptions {
          locale = Locale.forLanguageTag("en-US")
          preferredMode = SpeechRecognizerOptions.Mode.MODE_BASIC
        })
        try {
          Log.i(tag, "CONTROL_EN_US_BASIC_STATUS=${withTimeout(30000) { probe.checkStatus() }}")
        } catch (e: Exception) {
          Log.w(tag, "CONTROL_EN_US_BASIC_ERROR", e)
        } finally { probe.close() }
        Log.i(tag, "DEVICE_ABIS=${android.os.Build.SUPPORTED_ABIS.joinToString()}; SDK=${android.os.Build.VERSION.SDK_INT}; MODEL=${android.os.Build.MODEL}")
      }
      assertEquals("ML Kit model unavailable; download only attempted for downloadable/downloading status", FeatureStatus.AVAILABLE, status)
      withTimeout(30000) { client.warmup() }
      Log.i(tag, "WARMUP_OK")
      val finals = mutableListOf<String>()
      ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
        val request = speechRecognizerRequest { audioSource = AudioSource.fromPfd(fd) }
        withTimeout(60000) {
          val stopper = launch { delay(15000); client.stopRecognition() }
          try {
            client.startRecognition(request).takeWhile { response ->
              when (response) {
                is SpeechRecognizerResponse.PartialTextResponse -> Log.i(tag, "PARTIAL=${response.text}")
                is SpeechRecognizerResponse.FinalTextResponse -> {
                  finals.add(response.text)
                  Log.i(tag, "FINAL=${response.text}")
                }
                is SpeechRecognizerResponse.ErrorResponse -> error("ML Kit recognition error: ${response.e}")
                else -> Log.i(tag, "RESPONSE=${response.javaClass.simpleName}")
              }
              response !is SpeechRecognizerResponse.CompletedResponse
            }.collect {}
          } finally { stopper.cancel() }
        }
      }
      val result = finals.joinToString(" ")
      Log.i(tag, "FINAL_TRANSCRIPT=$result")
      assertTrue("Expected Korean words from real audio: $result", result.contains("안녕") && result.contains("한국어"))
      Log.i(tag, "MLKIT_BASIC_KOREAN_PCM_PASS")
    } finally { client.close() }
    Unit
  }
}
