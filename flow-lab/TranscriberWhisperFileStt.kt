package app.hitel.samsungprobe

// Adapted from Majkey25/transcriber-android AudioTranscriber.kt,
// particularly transcribeWhisper(), createWhisperRecognizer(), decodeAudio().
// Copyright (c) 2026 Majkey25, MIT: THIRD_PARTY_MAJKEY25_MIT.txt.
// The original file decoder/PCM chunker lives in TranscriberM4aDecoder.kt.
// The audio recognizer here is the upstream OfflineRecognizer and Whisper-small,
// explicitly targeting Korean ("ko") rather than upstream Czech/AUTO defaults.
import android.content.Context
import android.net.Uri
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineWhisperModelConfig
import java.io.File
import java.io.IOException
import kotlin.math.min

object TranscriberWhisperFileStt {
    interface Progress {
        fun onPhase(message: String)
        fun onSentence(text: String)
    }

    @JvmStatic
    fun transcribe(context: Context, file: File, progress: Progress): String {
        if (!file.isFile || !file.canRead() || file.length() <= 0)
            throw IOException("Unable to read selected Samsung M4A: " + file.name)
        val app = context.applicationContext
        progress.onPhase("원본 Transcriber Whisper-small 모델 준비 중 · 최초 다운로드 약 375MB")
        val modelFolder = TranscriberWhisperModelStore(app).ensureInstalled { message ->
            progress.onPhase(message)
        }
        progress.onPhase("Transcriber OfflineRecognizer 초기화 · 한국어(ko)")
        val whisper = OfflineWhisperModelConfig(
            encoder = modelFolder.resolve(TranscriberWhisperModelStore.ENCODER).path,
            decoder = modelFolder.resolve(TranscriberWhisperModelStore.DECODER).path,
            language = "ko",
            task = "transcribe",
            tailPaddings = 500,
        )
        val model = OfflineModelConfig(
            whisper = whisper,
            numThreads = min(4, Runtime.getRuntime().availableProcessors()),
            provider = "cpu",
            modelType = "whisper",
            tokens = modelFolder.resolve(TranscriberWhisperModelStore.TOKENS).path,
        )
        val recognizer = OfflineRecognizer(config = OfflineRecognizerConfig(modelConfig = model))
        val transcript = StringBuilder()
        var decodedChunks = 0
        var totalPcmFrames = 0L
        var lastSampleRate = 0
        try {
            TranscriberM4aDecoder.decode(app, Uri.fromFile(file),
                TranscriberM4aDecoder.AudioChunkConsumer { samples, sampleRate ->
                    decodedChunks++
                    totalPcmFrames += samples.size
                    lastSampleRate = sampleRate
                    val stream = recognizer.createStream()
                    try {
                        // Exact upstream file-ASR sequence:
                        // acceptWaveform(samples, sampleRate) -> decode() -> getResult()
                        stream.acceptWaveform(samples, sampleRate)
                        recognizer.decode(stream)
                        val result = recognizer.getResult(stream)
                        val sentence = result.text.trim()
                        if (sentence.isNotEmpty()) {
                            if (transcript.isNotEmpty()) transcript.append('\n')
                            transcript.append(sentence)
                            progress.onSentence(sentence)
                        }
                        LabStore.log("SAMSUNG_REC_MIT_OFFLINE_CHUNK",
                            "sampleRate=" + sampleRate +
                            "; pcmSamples=" + samples.size +
                            "; textChars=" + sentence.length +
                            "; language=" + result.lang)
                    } finally {
                        stream.release()
                    }
                })
        } finally {
            recognizer.release()
        }
        LabStore.log("SAMSUNG_REC_MIT_OFFLINE_RESULT",
            "chunks=" + decodedChunks +
            "; frames=" + totalPcmFrames +
            "; rate=" + lastSampleRate +
            "; chars=" + transcript.length +
            "; source=Majkey25/transcriber-android" +
            "; language=ko; engine=OfflineRecognizer-Whisper-small")
        if (decodedChunks == 0) throw IOException("Transcriber 디코더가 PCM을 출력하지 않았습니다.")
        if (transcript.isEmpty()) throw IOException(
            "Transcriber 원본 OfflineRecognizer가 한국어 문장을 출력하지 않았습니다.")
        return transcript.toString()
    }
}
