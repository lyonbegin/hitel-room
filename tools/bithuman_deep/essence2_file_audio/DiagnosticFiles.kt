package ai.bithuman.flutter

import java.io.File

/** Clear only diagnostic files. Model and credential directories are never walked. */
object DiagnosticFiles {
    val names = listOf("boot_status.txt", "hitel_e2_trace.log",
        "hitel_e2_trace.previous.log", "hitel_ai_e2e.log", "hitel_sdk_backend.log")

    fun clear(folder: File) {
        for (name in names) {
            val file = File(folder, name)
            if (file.isFile) check(file.delete()) { "Cannot clear $name" }
        }
    }

    fun clearForInstall(folder: File, state: File, installStamp: String): Boolean {
        if (state.isFile && state.readText() == installStamp) return false
        clear(folder)
        state.parentFile?.mkdirs()
        state.writeText(installStamp)
        return true
    }
}
