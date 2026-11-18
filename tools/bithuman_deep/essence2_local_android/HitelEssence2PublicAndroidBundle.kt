package ai.bithuman.flutter

import android.content.Context
import ai.bithuman.elevate.Essence2ModelStore
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import org.json.JSONObject

/**
 * HITEL verified public sample importer. Not a vendor-license replacement.
 * Reads the vendor's original Android member catalog; for each member uses
 * exact signed public member-download grants and SHA-256 verification.
 * Original Essence2 native renderer, metering and credential gate are unchanged.
 */
internal object HitelEssence2PublicAndroidBundle {
    private val codes = setOf("A52DHS2219", "A21SKT4314", "A62SJB3901",
                              "A23KSG5258", "A24EKJ8433")
    private val shaPattern = Regex("[0-9a-f]{64}")

    private fun hex(bytes: ByteArray) = bytes.joinToString("") {
        "%02x".format(it.toInt() and 255)
    }

    private fun hash(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(1024 * 1024)
            while (true) {
                val n = input.read(buffer)
                if (n < 0) break
                md.update(buffer, 0, n)
            }
        }
        return hex(md.digest())
    }

    private fun exact(file: File, size: Long, sha: String): Boolean =
        file.isFile && file.length() == size && hash(file) == sha

    private fun safeMember(root: File, name: String): File {
        if (name.isEmpty() || name.startsWith("/") || '\\' in name || ':' in name ||
            name.split('/').any { it.isEmpty() || it == "." || it == ".." }) {
            throw IOException("Unsafe public model member")
        }
        val file = File(root, name).canonicalFile
        if (!file.path.startsWith(root.canonicalPath + File.separator)) {
            throw IOException("Original member escaped model directory")
        }
        return file
    }

    private fun connection(url: String): HttpURLConnection {
        if (!url.startsWith("https://")) throw IOException("Public model download requires HTTPS")
        return (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 30000
            readTimeout = 150000
            instanceFollowRedirects = false
        }
    }

    private fun json(url: String): JSONObject {
        val conn = connection(url)
        try {
            if (conn.responseCode != 200)
                throw IOException("Official model server HTTP " + conn.responseCode)
            val bytes = java.io.ByteArrayOutputStream()
            conn.inputStream.use { input ->
                val buf = ByteArray(8192)
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    if (bytes.size() + n > 1048576) throw IOException("Oversized catalog JSON")
                    bytes.write(buf, 0, n)
                }
            }
            return JSONObject(bytes.toString("UTF-8"))
        } finally {
            conn.disconnect()
        }
    }

    private fun memberUrl(code: String, member: String): String {
        val api = "https://api.bithuman.ai/v1/agent/" + code + "/model/download" +
            "?model=essence-2&member=" + URLEncoder.encode(member, "UTF-8") +
            "&plane=android&redirect=false"
        val grant = json(api)
        if (!grant.optBoolean("success")) throw IOException("Public model member grant refused")
        val data = grant.getJSONObject("data")
        if (data.getString("code") != code || data.getString("model") != "essence-2" ||
            data.getString("filename") != member) {
            throw IOException("Official member grant mismatch")
        }
        return data.getString("url").also {
            if (!it.startsWith("https://")) throw IOException("Non-HTTPS member URL")
        }
    }

    private fun download(
        url: String, target: File, size: Long, sha: String,
        checkCancel: () -> Unit, advance: (Long) -> Unit
    ) {
        target.parentFile?.mkdirs()
        val tmp = File(target.parentFile, target.name + ".hitel-part")
        if (tmp.exists() && !tmp.delete()) throw IOException("Cannot delete incomplete file")
        val digest = MessageDigest.getInstance("SHA-256")
        var count = 0L
        val conn = connection(url)
        try {
            if (conn.responseCode != 200) throw IOException("Original member download failed: " + conn.responseCode)
            conn.inputStream.buffered().use { input ->
                tmp.outputStream().buffered().use { output ->
                    val buffer = ByteArray(1024 * 1024)
                    while (true) {
                        checkCancel()
                        val n = input.read(buffer)
                        if (n < 0) break
                        count += n
                        if (count > size) throw IOException("Member exceeds catalog length")
                        output.write(buffer, 0, n)
                        digest.update(buffer, 0, n)
                        advance(n.toLong())
                    }
                }
            }
            if (count != size || hex(digest.digest()) != sha)
                throw IOException("Original member failed size/SHA-256 verification")
            Files.move(tmp.toPath(), target.toPath(),
                StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
        } finally {
            conn.disconnect()
            tmp.delete()
        }
    }

    @Synchronized
    fun fetch(
        context: Context, code: String, checkCancel: () -> Unit,
        progress: (Long, Long) -> Unit
    ): Essence2ModelStore.Bundle {
        require(code in codes) { "Only five approved public BitHuman showcase codes" }
        val root = File(context.filesDir, "hitel_essence2_public/" + code).canonicalFile
        if (!root.exists() && !root.mkdirs()) throw IOException("Cannot create Android model directory")
        val catalogFile = File(root, "android_store.v1.json")
        val catalog = if (catalogFile.isFile) {
            try {
                JSONObject(catalogFile.readText(Charsets.UTF_8)).also {
                    if (it.getString("agent") != code ||
                        it.getString("format") != "essence2_android_store.v1") {
                        throw IOException("Cached catalog mismatch")
                    }
                }
            } catch (_: Exception) {
                catalogFile.delete()
                json(memberUrl(code, "android_store.v1.json"))
            }
        } else {
            json(memberUrl(code, "android_store.v1.json"))
        }
        if (catalog.getString("agent") != code ||
            catalog.getString("format") != "essence2_android_store.v1") {
            throw IOException("Wrong vendor Android model catalog")
        }
        if (!catalogFile.isFile) catalogFile.writeText(catalog.toString(), Charsets.UTF_8)
        if (catalog.getString("manifest") != "manifest.json")
            throw IOException("Unexpected Android model manifest")
        val files = catalog.getJSONObject("files")
        val names = mutableListOf<String>()
        val namesIterator = files.keys()
        while (namesIterator.hasNext()) names.add(namesIterator.next())
        names.sort()
        if (names.size < 20) throw IOException("Incomplete vendor Android model file inventory")
        val all = listOf("manifest.json") + names
        var total = 0L
        for (name in all) {
            val size = if (name == "manifest.json") catalog.getLong("manifest_bytes")
                       else files.getJSONObject(name).getLong("bytes")
            if (size <= 0 || size > 1000000000L) throw IOException("Invalid model file length")
            total += size
        }
        var completed = 0L
        for (name in all) {
            checkCancel()
            val size = if (name == "manifest.json") catalog.getLong("manifest_bytes")
                       else files.getJSONObject(name).getLong("bytes")
            val expected = if (name == "manifest.json") catalog.getString("manifest_sha256")
                           else files.getJSONObject(name).getString("sha256")
            if (!shaPattern.matches(expected)) throw IOException("Invalid vendor SHA-256")
            val target = safeMember(root, name)
            if (exact(target, size, expected)) {
                completed += size
                progress(completed, total)
            } else {
                download(memberUrl(code, name), target, size, expected, checkCancel) { n ->
                    completed += n
                    progress(completed, total)
                }
            }
        }
        val donors = catalog.getInt("n_donors")
        if (donors <= 0) throw IOException("Invalid original donor count")
        android.util.Log.i("HITEL_Essence2", "Verified local model " + code +
            ": " + names.size + " Android members, " + completed + " bytes")
        return HitelEssence2BundleFactory.fromVerifiedOriginalAndroidFiles(code, root, donors)
    }
}
