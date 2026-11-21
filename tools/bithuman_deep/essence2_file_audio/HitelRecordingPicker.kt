package ai.bithuman.flutter

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.PluginRegistry

/** Owns the source selection. Only the existing playback trigger starts a decoder. */
internal class HitelRecordingPicker(context: Context) : PluginRegistry.ActivityResultListener {
    private val resolver = context.contentResolver
    private val prefs = context.getSharedPreferences("hitel_recording_source", Context.MODE_PRIVATE)
    private var activityBinding: ActivityPluginBinding? = null
    private var pending: MethodChannel.Result? = null
    private val readers = mutableMapOf<Uri, Int>()
    private var selected = prefs.getString("uri", null)?.let(Uri::parse)
    private var name = prefs.getString("name", null)

    fun attach(binding: ActivityPluginBinding) {
        activityBinding = binding
        binding.addActivityResultListener(this)
    }

    fun detach(forConfigurationChange: Boolean = false) {
        activityBinding?.removeActivityResultListener(this)
        activityBinding = null
        if (!forConfigurationChange) {
            pending?.success(null)
            pending = null
        }
    }

    fun displayName(): String? = name

    fun acquireSource(): Uri? = selected?.also { uri ->
        readers[uri] = (readers[uri] ?: 0) + 1
    }

    fun releaseSource(uri: Uri) {
        val count = readers[uri] ?: return
        if (count == 1) {
            readers.remove(uri)
            releaseUnusedGrant(uri)
        } else readers[uri] = count - 1
    }

    private fun releaseUnusedGrant(uri: Uri) {
        if (uri != selected && uri !in readers) {
            runCatching { resolver.releasePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        }
    }

    @Suppress("DEPRECATION")
    fun choose(result: MethodChannel.Result) {
        val activity = activityBinding?.activity
            ?: return result.error("picker_unavailable", "파일 선택기를 열 수 없습니다.", null)
        if (pending != null) return result.error("picker_busy", "파일 선택기가 열려 있습니다.", null)
        pending = result
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("audio/*", "application/mp4"))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        try {
            activity.startActivityForResult(intent, REQUEST)
        } catch (_: RuntimeException) {
            pending = null
            result.error("picker_unavailable", "안드로이드 파일 선택기를 열 수 없습니다.", null)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != REQUEST) return false
        val result = pending ?: return false
        pending = null
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) {
            HitelE2Trace.event("file.source.selection.cancel")
            result.success(null)
            return true
        }
        try {
            val displayName = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
                ?: uri.lastPathSegment?.substringAfterLast('/')
            if (displayName == null || !displayName.endsWith(".m4a", ignoreCase = true)) {
                result.error("not_m4a", "M4A 녹음 파일을 선택해 주세요.", null)
                return true
            }
            resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val previous = selected
            selected = uri
            name = displayName
            prefs.edit().putString("uri", uri.toString()).putString("name", displayName).apply()
            previous?.let(::releaseUnusedGrant)
            HitelE2Trace.event("file.source.selection.saved", "source" to "android-document")
            result.success(displayName)
        } catch (error: RuntimeException) {
            HitelE2Trace.event("file.source.selection.error", "kind" to error.javaClass.simpleName)
            result.error("source_permission_failed", "녹음 파일을 열 수 없습니다. 파일 위치를 확인해 주세요.", null)
        }
        return true
    }

    private companion object {
        const val REQUEST = 0x4822
    }
}
