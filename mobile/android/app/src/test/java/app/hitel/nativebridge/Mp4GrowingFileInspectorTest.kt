package app.hitel.nativebridge

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

class Mp4GrowingFileInspectorTest {
    private fun box(type: String, body: ByteArray = ByteArray(0)): ByteArray {
        require(type.length == 4)
        return ByteBuffer.allocate(8 + body.size).order(ByteOrder.BIG_ENDIAN)
            .putInt(8 + body.size).put(type.toByteArray(Charsets.US_ASCII)).put(body).array()
    }
    private fun scan(vararg boxes: ByteArray): Mp4GrowingFileInspector.Scan {
        val file = File.createTempFile("mp4-atom-test", ".m4a")
        try {
            file.writeBytes(boxes.flatMap { it.asList() }.toByteArray())
            return Mp4GrowingFileInspector.inspect(file)
        } finally { file.delete() }
    }

    @Test fun completedConventionalM4aHasMoovAndMdat() {
        val scan = scan(box("ftyp", byteArrayOf(1,2,3,4)), box("mdat", ByteArray(14)), box("moov", ByteArray(12)))
        assertEquals("MP4_METADATA_PRESENT", scan.containerHint)
        assertTrue(scan.hasMoov)
        assertTrue(scan.hasMdat)
    }

    @Test fun unfinishedConventionalM4aHasNoMoov() {
        val truncated = box("mdat", ByteArray(10))
        val file = File.createTempFile("m4a-pending", ".m4a")
        try {
            // Header says that mdat needs 1000 bytes, but only 10 bytes arrived.
            file.writeBytes(box("ftyp") + byteArrayOf(0,0,3,-24,109,100,97,116) + ByteArray(10))
            val scan = Mp4GrowingFileInspector.inspect(file)
            assertEquals("MP4_MEDIA_WITHOUT_VISIBLE_METADATA", scan.containerHint)
            assertTrue(scan.incompleteAtom)
            assertFalse(scan.hasMoov)
        } finally { file.delete() }
    }

    @Test fun fragmentedM4aIsDetected() {
        val scan = scan(box("ftyp"), box("moov"), box("moof", ByteArray(5)), box("mdat", ByteArray(100)))
        assertEquals("FRAGMENTED_MP4_CANDIDATE", scan.containerHint)
        assertTrue(scan.hasMoof)
    }

    @Test fun corruptHeaderIsNotMisreportedAsDecoded() {
        val scan = scan(byteArrayOf(0,0,0,2,109,111,111,118))
        assertEquals("UNKNOWN_OR_HEADER_ONLY", scan.containerHint)
        assertTrue(scan.incompleteAtom)
    }

    @Test fun zeroLengthFileIsNotRecorded() {
        val scan = scan()
        assertEquals(0L, scan.bytes)
        assertEquals("UNKNOWN_OR_HEADER_ONLY", scan.containerHint)
    }
}
