package app.hitel.samsungprobe

// Adapted from Majkey25/transcriber-android TranscriptionWorker.kt / ModelStore
// Copyright (c) 2026 Majkey25. MIT license: THIRD_PARTY_MAJKEY25_MIT.txt
// Only the original Whisper-small INT8 files are retained (not Omnilingual).
import android.content.Context
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest

internal class TranscriberWhisperModelStore(private val context: Context) {
    private val directory = context.filesDir.resolve("models/transcriber-whisper-small-int8")

    fun ensureInstalled(onPhase: (String) -> Unit): File {
        if (!directory.isDirectory && !directory.mkdirs()) throw IOException("Cannot make whisper model directory")
        for (spec in WHISPER_FILES) install(spec, onPhase)
        return directory
    }

    private fun install(spec: ModelFile, onPhase: (String) -> Unit) {
        val target = directory.resolve(spec.name)
        if (target.length() == spec.size && sha256(target) == spec.sha256) return
        val partial = directory.resolve(spec.name + ".part")
        if (partial.length() > spec.size && !partial.delete())
            throw IOException("Cannot reset overlong partial model: " + spec.name)
        onPhase("Transcriber Whisper 모델: " + spec.name +
            " (" + (spec.size / 1024 / 1024) + " MiB) · 최초 1회 다운로드")
        if (partial.length() < spec.size) download(spec, partial)
        if (partial.length() != spec.size || sha256(partial) != spec.sha256) {
            partial.delete()
            throw IOException("Model verification failed: " + spec.name)
        }
        Files.move(partial.toPath(), target.toPath(),
            StandardCopyOption.REPLACE_EXISTING)
    }

    private fun download(spec: ModelFile, partial: File) {
        val offset = partial.length()
        val conn = URL(spec.url).openConnection() as HttpURLConnection
        conn.instanceFollowRedirects = true
        conn.connectTimeout = 30_000
        conn.readTimeout = 60_000
        conn.setRequestProperty("User-Agent", "HITEL14-Transcriber-MIT/1")
        if (offset > 0) conn.setRequestProperty("Range", "bytes=" + offset + "-")
        try {
            val status = conn.responseCode
            val append = offset > 0 && status == HttpURLConnection.HTTP_PARTIAL
            if (status != HttpURLConnection.HTTP_OK && !append)
                throw IOException("Whisper download HTTP " + status + ": " + spec.name)
            BufferedInputStream(conn.inputStream).use { input ->
                FileOutputStream(partial, append).buffered().use { output ->
                    val bytes = ByteArray(128 * 1024)
                    var written = if (append) offset else 0L
                    while (true) {
                        val n = input.read(bytes)
                        if (n < 0) break
                        written += n
                        if (written > spec.size) throw IOException("Excess model download: " + spec.name)
                        output.write(bytes, 0, n)
                    }
                }
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun sha256(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).buffered().use { stream ->
            val buffer = ByteArray(128 * 1024)
            while (true) {
                val n = stream.read(buffer)
                if (n < 0) break
                md.update(buffer, 0, n)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    private data class ModelFile(val name: String,val size: Long,val sha256: String,val url: String)
    companion object {
        const val ENCODER = "small-encoder.int8.onnx"
        const val DECODER = "small-decoder.int8.onnx"
        const val TOKENS = "small-tokens.txt"
        private const val REV = "8f3c18b358db4d1f2fc1eae49d75cd20989e4309"
        private const val BASE = "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small/resolve/" + REV
        private val WHISPER_FILES = listOf(
            ModelFile(ENCODER,112_442_483L,
                "4cbe7b22fa9026b843b60a68640c747de05bafb1a11b57edc0e66c232d9f33a9",
                BASE + "/" + ENCODER),
            ModelFile(DECODER,262_226_114L,
                "acad50b5c782696e91b55914cc5ab4f756f1532f76e22aa6fc615f39fb69a8ee",
                BASE + "/" + DECODER),
            ModelFile(TOKENS,816_730L,
                "b34b360dbb493e781e479794586d661700670d65564001f23024971d1f2fa126",
                BASE + "/" + TOKENS)
        )
    }
}
