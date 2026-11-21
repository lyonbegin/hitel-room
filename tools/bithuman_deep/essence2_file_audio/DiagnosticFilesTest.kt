package ai.bithuman.flutter

import java.io.File
import java.nio.file.Files

fun main() {
    val root = Files.createTempDirectory("hitel-diagnostics-test").toFile()
    try {
        val logs = File(root, "app_flutter").apply { mkdirs() }
        val state = File(root, "files/install.txt")
        val model = File(logs, "models/model.onnx").apply {
            parentFile.mkdirs(); writeText("unchanged model")
        }
        val credential = File(logs, "credentials.json").apply { writeText("unchanged credential") }
        for (name in DiagnosticFiles.names) File(logs, name).writeText("OLD_BUILD_LOG")
        check(DiagnosticFiles.clearForInstall(logs, state, "install-1"))
        check(DiagnosticFiles.names.none { File(logs, it).exists() })
        File(logs, "boot_status.txt").writeText("CURRENT_BUILD_LOG")
        check(!DiagnosticFiles.clearForInstall(logs, state, "install-1"))
        check(File(logs, "boot_status.txt").readText() == "CURRENT_BUILD_LOG")
        check(DiagnosticFiles.clearForInstall(logs, state, "install-2"))
        check(!File(logs, "boot_status.txt").exists())
        check(model.readText() == "unchanged model")
        check(credential.readText() == "unchanged credential")
        println("PASS_DIAGNOSTICS_NEW_INSTALL_UPDATE_RESET_SAME_INSTALL_PRESERVED_MODELS_UNTOUCHED")
    } finally { root.deleteRecursively() }
}
