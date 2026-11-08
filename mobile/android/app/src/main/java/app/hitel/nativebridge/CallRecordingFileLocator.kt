package app.hitel.nativebridge

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject

/** Look up Samsung call recordings already indexed by MediaStore. */
internal object CallRecordingFileLocator {
    fun recent(context: Context, limit: Int = 20): JSONObject {
        val required = if (Build.VERSION.SDK_INT >= 33)
            Manifest.permission.READ_MEDIA_AUDIO else Manifest.permission.READ_EXTERNAL_STORAGE
        if (context.checkSelfPermission(required) != PackageManager.PERMISSION_GRANTED)
            return JSONObject().put("status", "PERMISSION_REQUIRED").put("permission", required)

        val base = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val columns = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.RELATIVE_PATH,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DATE_MODIFIED,
            MediaStore.Audio.Media.MIME_TYPE
        )
        val items = JSONArray()
        try {
            context.contentResolver.query(
                base, columns, null, null, "${MediaStore.Audio.Media.DATE_MODIFIED} DESC"
            )?.use { cursor ->
                val ids = columns.map(cursor::getColumnIndexOrThrow)
                var seen = 0
                while (cursor.moveToNext() && seen++ < 500 && items.length() < limit) {
                    val folder = (cursor.getString(ids[2]) ?: "").trim('/')
                    val normalized = folder.lowercase()
                    if (normalized != "recordings/call" &&
                        normalized != "recordings/call recordings" &&
                        normalized != "recordings/callrecordings" &&
                        normalized != "call") continue
                    val uri = ContentUris.withAppendedId(base, cursor.getLong(ids[0]))
                    items.put(JSONObject()
                        .put("uri", uri.toString())
                        .put("relativePath", folder)
                        .put("displayName", cursor.getString(ids[1]) ?: "")
                        .put("sizeBytes", cursor.getLong(ids[3]))
                        .put("modifiedSeconds", cursor.getLong(ids[4]))
                        .put("mimeType", cursor.getString(ids[5]) ?: ""))
                }
            }
        } catch (e: SecurityException) {
            return JSONObject().put("status", "ACCESS_DENIED")
                .put("error", e.message ?: "SecurityException")
        } catch (e: RuntimeException) {
            return JSONObject().put("status", "QUERY_FAILED")
                .put("error", e.message ?: "RuntimeException")
        }
        return JSONObject().put("status", "INDEX_QUERY_COMPLETE")
            .put("files", items)
            .put("note", "In-progress/pending recordings may not appear or be readable; this is not live PCM access.")
    }
}
