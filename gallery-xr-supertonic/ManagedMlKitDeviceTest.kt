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
    // Query actual language support, not merely the existence of a service.
    if (android.os.Build.VERSION.SDK_INT >= 33) {
      val support = CompletableDeferred<android.speech.RecognitionSupport?>()
      var platform: android.speech.SpeechRecognizer? = null
      instrumentation.runOnMainSync {
        try {
          platform = android.speech.SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
          val intent = android.content.Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "ko-KR")
            .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          platform!!.checkRecognitionSupport(intent, context.mainExecutor,
            object : android.speech.RecognitionSupportCallback {
              override fun onSupportResult(result: android.speech.RecognitionSupport) {
                Log.i(tag, "PLATFORM_INSTALLED=${result.installedOnDeviceLanguages}")
                Log.i(tag, "PLATFORM_PENDING=${result.pendingOnDeviceLanguages}")
                Log.i(tag, "PLATFORM_SUPPORTED=${result.supportedOnDeviceLanguages}")
                support.complete(result)
              }
              override fun onError(error: Int) {
                Log.w(tag, "PLATFORM_SUPPORT_ERROR=$error")
                support.complete(null)
              }
            })
        } catch (e: Exception) {
          Log.w(tag, "PLATFORM_SUPPORT_EXCEPTION", e)
          support.complete(null)
        }
      }
      val downloadDone = CompletableDeferred<Boolean>()
      try {
        val result = withTimeoutOrNull(20000) { support.await() }
        if (result != null && result.supportedOnDeviceLanguages.any { it.equals("ko-KR", true) } &&
            result.installedOnDeviceLanguages.none { it.equals("ko-KR", true) }) {
          instrumentation.runOnMainSync {
            try {
              val downloadIntent = android.content.Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "ko-KR")
                .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
              if (android.os.Build.VERSION.SDK_INT >= 34) {
                platform!!.triggerModelDownload(downloadIntent, context.mainExecutor,
                  object : android.speech.ModelDownloadListener {
                    override fun onProgress(completedPercent: Int) { Log.i(tag, "PLATFORM_DOWNLOAD_PROGRESS=$completedPercent") }
                    override fun onSuccess() { Log.i(tag, "PLATFORM_DOWNLOAD_SUCCESS"); downloadDone.complete(true) }
                    override fun onScheduled() { Log.i(tag, "PLATFORM_DOWNLOAD_SCHEDULED") }
                    override fun onError(error: Int) { Log.w(tag, "PLATFORM_DOWNLOAD_CALLBACK_ERROR=$error"); downloadDone.complete(false) }
                  })
              } else {
                platform!!.triggerModelDownload(downloadIntent)
              }
              Log.i(tag, "PLATFORM_KOREAN_DOWNLOAD_REQUESTED")
            } catch (e: Exception) { Log.w(tag, "PLATFORM_DOWNLOAD_ERROR", e) }
          }
          if (android.os.Build.VERSION.SDK_INT >= 34) {
            Log.i(tag, "PLATFORM_DOWNLOAD_TERMINAL=${withTimeoutOrNull(120000) { downloadDone.await() }}")
          }
        }
      } finally { instrumentation.runOnMainSync { platform?.destroy() } }
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
