package app.hitel.nativebridge

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream

/**
 * READ-ONLY probe of already indexed call recordings. No files are modified,
 * no private Samsung app directories are accessed, and no audio is uploaded.
 * IS_PENDING media may be invisible to other apps (Android scoped storage).
 */
internal object CallRecordingFileProbe {
    fun sample(context: Context, startedAtEpochMs: Long, limit: Int = 8): JSONObject {
        val required = if (Build.VERSION.SDK_INT >= 33)
            Manifest.permission.READ_MEDIA_AUDIO else Manifest.permission.READ_EXTERNAL_STORAGE
        if (context.checkSelfPermission(required) != PackageManager.PERMISSION_GRANTED) {
            return JSONObject().put("status", "PERMISSION_REQUIRED").put("permission", required)
        }
        if (Build.VERSION.SDK_INT < 29) {
            return JSONObject().put("status", "UNSUPPORTED_API").put("apiLevel", Build.VERSION.SDK_INT)
        }
        val root = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.RELATIVE_PATH,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DATE_MODIFIED,
            MediaStore.Audio.Media.MIME_TYPE,
            MediaStore.MediaColumns.IS_PENDING
        )
        val path = MediaStore.Audio.Media.RELATIVE_PATH
        val selection = "($path LIKE ? OR $path LIKE ? OR $path LIKE ?)"
        val args = arrayOf("Recordings/Call%", "Call/%", "Sounds/Call%")
        val files = JSONArray()
        try {
            val cursor = context.contentResolver.query(
                root, projection, selection, args,
                "${MediaStore.Audio.Media.DATE_MODIFIED} DESC"
            ) ?: return JSONObject().put("status", "NULL_CURSOR").put("files", files)
            cursor.use {
                val ids = projection.map(cursor::getColumnIndexOrThrow)
                while (cursor.moveToNext() && files.length() < limit) {
                    val id = cursor.getLong(ids[0])
                    val uri = ContentUris.withAppendedId(root, id)
                    val size = cursor.getLong(ids[3])
                    val modified = cursor.getLong(ids[4])
                    val item = JSONObject()
                        .put("uri", uri.toString())
                        .put("folder", cursor.getString(ids[1]) ?: "")
                        .put("name", cursor.getString(ids[2]) ?: "")
                        .put("sizeBytes", size)
                        .put("lastModifiedSeconds", modified)
                        .put("modifiedAfterTestStart", modified >= startedAtEpochMs / 1000 - 5)
                        .put("mime", cursor.getString(ids[5]) ?: "")
                        .put("isPending", cursor.getInt(ids[6]) == 1)
                    if (size <= 0L) {
                        item.put("readStatus", "EMPTY_SIZE")
                    } else {
                        // Test a *small read only*, not a complete audio copy.
                        try {
                            val pfd = context.contentResolver.openFileDescriptor(uri, "r")
                            if (pfd == null) {
                                item.put("readStatus", "NULL_FD")
                            } else {
                                pfd.use { handle ->
                                    val buffer = ByteArray(64)
                                    val read = FileInputStream(handle.fileDescriptor).use { stream ->
                                        stream.read(buffer)
                                    }
                                    item.put("readStatus", if (read > 0) "READ_OK" else "READ_EOF")
                                        .put("readBytes", if (read > 0) read else 0)
                                }
                            }
                        } catch (e: Exception) {
                            item.put("readStatus", "READ_FAILED")
                                .put("readError", e.javaClass.simpleName)
                        }
                    }
                    files.put(item)
                }
            }
        } catch (e: SecurityException) {
            return JSONObject().put("status", "ACCESS_DENIED")
                .put("detail", e.javaClass.simpleName)
        } catch (e: Exception) {
            return JSONObject().put("status", "QUERY_FAILED")
                .put("detail", e.javaClass.simpleName)
                .put("message", e.message ?: "")
        }
        return JSONObject().put("status", "QUERY_COMPLETE")
            .put("files", files)
            .put("filesystemFiles", directPathSamples(startedAtEpochMs))
            .put("note", "No row while recording may be IS_PENDING/private storage, not an audio capture failure.")
    }
    /**
     * Separate physical-path experiment. A normal user-space app cannot read
     * Samsung's private /data/data directory. File API access can also be
     * denied by FUSE; permission errors are recorded, not treated as silence.
     */
    private fun directPathSamples(startedAtEpochMs: Long): JSONArray {
        val output = JSONArray()
        val root = android.os.Environment.getExternalStorageDirectory()
        val dirs = listOf(
            File(root, "Recordings/Call"),
            File(root, "Recordings/Call recordings"),
            File(root, "Sounds/Call")
        )
        for (dir in dirs) {
            val entries = try { dir.listFiles() } catch (_: SecurityException) { null }
            val candidates = (entries ?: emptyArray()).filter { it.isFile }
                .sortedByDescending { it.lastModified() }.take(8)
            if (entries == null || candidates.isEmpty()) {
                output.put(JSONObject()
                    .put("source", "DIRECT_FILE_PATH")
                    .put("uri", dir.absolutePath)
                    .put("folder", dir.absolutePath)
                    .put("readStatus", if (!dir.exists()) "DIR_NOT_VISIBLE" else "DIR_EMPTY_OR_RESTRICTED")
                    .put("sizeBytes", 0L)
                    .put("modifiedAfterTestStart", false))
            }
            for (file in candidates) {
                val record = JSONObject()
                    .put("source", "DIRECT_FILE_PATH")
                    .put("uri", file.absolutePath)
                    .put("folder", dir.absolutePath)
                    .put("name", file.name)
                    .put("sizeBytes", file.length())
                    .put("lastModifiedMillis", file.lastModified())
                    .put("modifiedAfterTestStart", file.lastModified() >= startedAtEpochMs - 5_000L)
                if (file.length() == 0L) {
                    record.put("readStatus", "EMPTY_SIZE")
                } else {
                    try {
                        val buffer = ByteArray(64)
                        val read = FileInputStream(file).use { it.read(buffer) }
                        record.put("readStatus", if (read > 0) "READ_OK" else "READ_EOF")
                            .put("readBytes", if (read > 0) read else 0)
                    } catch (e: Exception) {
                        record.put("readStatus", "READ_FAILED")
                            .put("readError", e.javaClass.simpleName)
                    }
                }
                output.put(record)
            }
        }
        return output
    }

}
