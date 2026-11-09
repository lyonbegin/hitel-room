package app.hitel.nativebridge

import java.io.File
import java.io.RandomAccessFile
import java.nio.charset.StandardCharsets

/**
 * Inspects MP4/M4A top-level atom headers only. Never changes or copies audio.
 *
 * Structural inspection is NOT a decode test: a present 'moov' box is a
 * prerequisite for conventional MP4 demuxing, but not proof that AAC samples
 * are accessible; 'moof' indicates a fragmented MP4 candidate.
 */
internal object Mp4GrowingFileInspector {
    data class Scan(
        val bytes: Long,
        val atoms: List<String>,
        val hasMoov: Boolean,
        val hasMoof: Boolean,
        val hasMdat: Boolean,
        val incompleteAtom: Boolean,
        val parseError: String? = null
    ) {
        val containerHint: String
            get() = when {
                parseError != null -> "UNKNOWN"
                hasMoof -> "FRAGMENTED_MP4_CANDIDATE"
                hasMoov -> "MP4_METADATA_PRESENT"
                hasMdat -> "MP4_MEDIA_WITHOUT_VISIBLE_METADATA"
                else -> "UNKNOWN_OR_HEADER_ONLY"
            }
    }

    fun inspect(file: File, maxAtoms: Int = 16): Scan = try {
        RandomAccessFile(file, "r").use { inspect(it, maxAtoms) }
    } catch (ex: Exception) {
        Scan(0, emptyList(), false, false, false, false, ex.javaClass.simpleName)
    }

    internal fun inspect(reader: RandomAccessFile, maxAtoms: Int = 16): Scan {
        val bytes = reader.length()
        val atoms = ArrayList<String>()
        var hasMoov = false
        var hasMoof = false
        var hasMdat = false
        var incompleteAtom = false
        var offset = 0L
        while (offset <= bytes - 8 && atoms.size < maxAtoms) {
            reader.seek(offset)
            val smallSize = reader.readInt().toLong() and 0xFFFF_FFFFL
            val typeBytes = ByteArray(4)
            reader.readFully(typeBytes)
            val type = String(typeBytes, StandardCharsets.ISO_8859_1)
            if (!type.all { it.code in 32..126 }) break
            val headerSize = if (smallSize == 1L) 16L else 8L
            if (offset > bytes - headerSize) {
                incompleteAtom = true
                break
            }
            val atomBytes = when (smallSize) {
                0L -> bytes - offset
                1L -> reader.readLong()
                else -> smallSize
            }
            if (atomBytes < headerSize || atomBytes > Long.MAX_VALUE - offset) {
                incompleteAtom = true
                break
            }
            atoms.add(type)
            when (type) {
                "moov" -> hasMoov = true
                "moof" -> hasMoof = true
                "mdat" -> hasMdat = true
            }
            val next = offset + atomBytes
            if (next > bytes) {
                incompleteAtom = true
                break
            }
            if (smallSize == 0L) break
            offset = next
        }
        return Scan(bytes, atoms, hasMoov, hasMoof, hasMdat, incompleteAtom)
    }
}
