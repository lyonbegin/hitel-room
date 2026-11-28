package com.google.ai.edge.gallery.services.tts

import android.content.Context
import android.util.Log
import com.google.mediapipe.tasks.audio.texttospeech.AudioChunk
import com.google.mediapipe.tasks.audio.texttospeech.SynthesisOptions
import com.google.mediapipe.tasks.audio.texttospeech.WordTimestamp
import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map

/** One public Pocket TTS model ID, two mutually exclusive native sessions.
 *  The original multilingual model is never modified. The Korean companion has
 *  its own tokenizer, BF16 weights and matching BF16 voice KV cache.
 *  SDK 1.2.0 only accepts a fixed set of native locale identifiers, so the
 *  isolated Korean bundle uses its known en-US/alba slot internally only.
 */
internal class HitelPocketKoreanRoutingSynthesizer(
  private val context: Context,
  private val basePath: String,
  private val create: (String) -> MediaPipeSynthesizer,
) : MediaPipeSynthesizer {
  private val nativeVoiceIds: List<String>
  @Volatile private var active: MediaPipeSynthesizer? = null
  private var korean = false
  init {
    val base = create(basePath)
    active = base
    try {
      nativeVoiceIds = base.listVoiceIds()
    } catch (e: Exception) {
      base.close()
      throw e
    }
  }

  override fun listVoiceIds(): List<String> =
    (nativeVoiceIds + KOREAN_VOICE).distinct()

  private fun select(useKorean: Boolean): MediaPipeSynthesizer {
    val current = active
    if (current != null && useKorean == korean) return current
    val path = if (useKorean) extractKoreanCompanion(context).absolutePath else basePath
    // Retain at most one native model at a time.
    active = null
    current?.close()
    val next = create(path)
    korean = useKorean
    active = next
    Log.i("HITEL_POCKET_KO", "NATIVE_SESSION_SWITCH korean=$useKorean")
    return next
  }

  private fun wantsKorean(options: SynthesisOptions): Boolean {
    val primary = options.locale?.substringBefore('-')?.lowercase()
    return primary == "ko" || (primary.isNullOrEmpty() && options.voiceId == KOREAN_VOICE)
  }

  override fun synthesizeAudioChunks(text: String, options: SynthesisOptions): Flow<AudioChunk> = flow {
    val ko = wantsKorean(options)
    val engine = select(ko)
    val nativeOptions = if (ko) SynthesisOptions(voiceId = "alba", locale = "en-US") else options
    emitAll(engine.synthesizeAudioChunks(text, nativeOptions))
  }

  override fun synthesizeStream(text: String, options: SynthesisOptions): Flow<FloatArray> =
    synthesizeAudioChunks(text, options).map { it.samples }

  override fun computeWordTimestamps(text: String, samples: FloatArray, sampleRateHz: Int): List<WordTimestamp> =
    active?.computeWordTimestamps(text, samples, sampleRateHz).orEmpty()

  override fun cancel() { active?.cancel() }
  override fun close() {
    val current = active
    active = null
    current?.close()
  }

  companion object {
    const val KOREAN_VOICE = "hitelko"
    private const val ASSET = "hitel/pocket_tts_ko_int8.litertlm"
    private const val DIGEST_ASSET = "hitel/pocket_tts_ko_int8.sha256"
    @Synchronized
    private fun extractKoreanCompanion(context: Context): File {
      val expected = context.assets.open(DIGEST_ASSET).bufferedReader().use { it.readText().trim() }
      require(expected.matches(Regex("[0-9a-f]{64}")))
      val dir = File(context.filesDir, "hitel_pocket_ko/" + expected)
      check(dir.isDirectory || dir.mkdirs())
      val dest = File(dir, "pocket_tts_int8.litertlm")
      if (dest.isFile && File(dir, "verified.sha256").takeIf { it.isFile }?.readText()?.trim() == expected) return dest
      val temp = File(dir, "model.tmp")
      val digest = MessageDigest.getInstance("SHA-256")
      try {
        context.assets.open(ASSET).use { input ->
          temp.outputStream().buffered().use { output ->
            val buffer = ByteArray(1024 * 1024)
            while (true) {
              val n = input.read(buffer)
              if (n < 0) break
              digest.update(buffer, 0, n)
              output.write(buffer, 0, n)
            }
          }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
        check(actual == expected) { "Korean Pocket TTS companion checksum mismatch" }
        check(temp.renameTo(dest)) { "Could not install Korean companion" }
        File(dir, "verified.sha256").writeText(expected)
        Log.i("HITEL_POCKET_KO", "COMPANION_READY bytes=" + dest.length())
        return dest
      } finally { temp.delete() }
    }
  }
}
