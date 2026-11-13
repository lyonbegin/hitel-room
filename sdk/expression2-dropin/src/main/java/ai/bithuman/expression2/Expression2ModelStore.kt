package ai.bithuman.expression2

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import java.security.MessageDigest

/**
 * Self-contained IMX v2 model store. The first tested identity is the public
 * Wise Pup showcase. A private identity is NOT silently treated as Wise Pup.
 */
class Expression2ModelStore(context: Context) {
    private val dir = File(context.applicationContext.filesDir, "expression2-models")

    fun fetch(agentCode: String): Expression2Model {
        require(agentCode == PUBLIC_AGENT) {
            "Independent model retrieval is verified only for public agent " + PUBLIC_AGENT
        }
        if (!dir.isDirectory && !dir.mkdirs()) error("Model cache directory unavailable")
        val modelFile = File(dir, "wise-pup-expression2.imx")
        if (!modelFile.isFile || modelFile.length() != PUBLIC_BYTES) {
            downloadPublicModel(modelFile)
        }
        val index = indexImx(modelFile)
        val graph = index["combined_litert.tflite"] ?: error("Missing combined_litert.tflite")
        val canonMember = index["canon.bin"] ?: error("Missing canon.bin")
        check(graph.length == 158524428L) { "Unexpected Expression2 graph size" }
        check(canonMember.length == 299520L) { "Unexpected Expression2 canonical state size" }
        val canon = ByteArray(canonMember.length.toInt())
        RandomAccessFile(modelFile, "r").use { file ->
            file.seek(canonMember.offset)
            file.readFully(canon)
        }
        return Expression2Model(modelFile, graph.offset, graph.length, canon)
    }

    private fun downloadPublicModel(target: File) {
        val temp = File(dir, "wise-pup-expression2.part")
        temp.delete()
        val url = URL("https://api.bithuman.ai/v1/agent/" + PUBLIC_AGENT +
            "/model/download?model=expression-2")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 20000
            readTimeout = 120000
            instanceFollowRedirects = true
        }
        try {
            check(connection.responseCode == 200) {
                "Public model download HTTP " + connection.responseCode
            }
            val digest = MessageDigest.getInstance("SHA-256")
            connection.inputStream.use { input ->
                FileOutputStream(temp).use { output ->
                    val block = ByteArray(1024 * 1024)
                    while (true) {
                        val got = input.read(block)
                        if (got < 0) break
                        if (got == 0) continue
                        digest.update(block, 0, got)
                        output.write(block, 0, got)
                    }
                    output.fd.sync()
                }
            }
            check(temp.length() == PUBLIC_BYTES) { "Public IMX download incomplete" }
            val actual = digest.digest().joinToString("") { "%02x".format(it) }
            check(actual == PUBLIC_SHA) { "Public IMX SHA-256 mismatch" }
            check(temp.renameTo(target)) { "Unable to commit downloaded IMX" }
        } finally {
            connection.disconnect()
            temp.delete()
        }
    }

    private data class Member(val offset: Long, val length: Long)

    private fun indexImx(source: File): Map<String, Member> {
        RandomAccessFile(source, "r").use { input ->
            val magic = ByteArray(4)
            input.readFully(magic)
            check(magic.contentEquals(byteArrayOf(73, 77, 88, 0))) { "Not IMX v2" }
            check(input.u16() == 2) { "Unsupported IMX format" }
            val count = input.u16()
            check(count in 1..5000) { "Invalid IMX entry count" }
            val result = LinkedHashMap<String, Member>()
            for (n in 0 until count) {
                val size = input.u16()
                check(size in 1..8192) { "Invalid IMX member name" }
                val nameBytes = ByteArray(size)
                input.readFully(nameBytes)
                val name = String(nameBytes, Charsets.UTF_8)
                check(!name.startsWith("/") && !name.contains("..") &&
                    !name.contains('\\') && !name.contains('\u0000')) {
                    "Invalid IMX member path"
                }
                val offset = java.lang.Long.reverseBytes(input.readLong())
                val length = java.lang.Long.reverseBytes(input.readLong())
                check(offset >= 0 && length >= 0 &&
                    offset <= source.length() && length <= source.length() - offset) {
                    "Invalid IMX member boundary"
                }
                check(result.put(name, Member(offset, length)) == null) {
                    "Duplicate IMX member"
                }
            }
            val minimum = input.filePointer
            var previousEnd = minimum
            result.values.sortedBy { it.offset }.forEach { member ->
                check(member.offset >= previousEnd) { "Overlapping IMX members" }
                previousEnd = member.offset + member.length
            }
            return result
        }
    }

    private fun RandomAccessFile.u16(): Int =
        java.lang.Short.toUnsignedInt(java.lang.Short.reverseBytes(readShort()))

    companion object {
        private const val PUBLIC_AGENT = "A23WJF0199"
        private const val PUBLIC_BYTES = 197741350L
        private const val PUBLIC_SHA =
            "d2c70beaa48b73d40681366879599d4940f744b736105c030fe13c6852d626d9"
    }
}

class Expression2Model internal constructor(
    internal val sourceFile: File,
    internal val graphOffset: Long,
    internal val graphLength: Long,
    internal val canon: ByteArray
) {
    internal fun mapGraph(): ByteBuffer =
        RandomAccessFile(sourceFile, "r").use { file ->
            file.channel.map(FileChannel.MapMode.READ_ONLY, graphOffset, graphLength)
                .order(ByteOrder.nativeOrder())
        }
}
