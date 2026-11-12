#!/usr/bin/env python3
"""Patch the upstream bitHuman demo to accept API credentials at runtime instead of embedding them in an APK."""
from pathlib import Path
import sys

IMPORTS = """import android.app.AlertDialog
import android.text.InputType
import android.widget.EditText
"""
METHOD = """
    // Demo-only credential entry. In-memory only: never hardcode or persist a vendor API secret.
    private var runtimeSecret = ""

    private fun requestCredential() {
        if (busy) return
        val field = EditText(this).apply {
            hint = "bitHuman API Secret"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setSingleLine(true)
        }
        AlertDialog.Builder(this)
            .setTitle("bitHuman on-device demo")
            .setMessage("Enter a Creator-plan API Secret. It stays in RAM and is used by the official SDK for model download and session authentication. Long-press the screen to change it.")
            .setView(field)
            .setCancelable(false)
            .setPositiveButton("Start") { _, _ ->
                runtimeSecret = field.text?.toString()?.trim().orEmpty()
                if (runtimeSecret.isBlank()) {
                    status.text = "API Secret is required. Long-press to enter."
                } else {
                    start()
                }
            }
            .show()
    }
"""
def main(path: Path):
    s = path.read_text(encoding="utf-8")
    assert s.count("import android.app.Activity") == 1
    assert s.count("    override fun onCreate(savedInstanceState: Bundle?) {") == 1
    assert s.count("        setContentView(root)\n        start()\n") == 1
    assert s.count("val secret = BuildConfig.BITHUMAN_API_SECRET") == 1
    s = s.replace("import android.app.Activity\n", "import android.app.Activity\n" + IMPORTS)
    s = s.replace("    override fun onCreate(savedInstanceState: Bundle?) {",
                  METHOD + "\n    override fun onCreate(savedInstanceState: Bundle?) {")
    s = s.replace("        setContentView(root)\n        start()\n",
                  "        setContentView(root)\n        root.setOnLongClickListener { requestCredential(); true }\n        requestCredential()\n")
    s = s.replace("val secret = BuildConfig.BITHUMAN_API_SECRET", "val secret = runtimeSecret")
    path.write_text(s, encoding="utf-8")
    assert "val secret = BuildConfig.BITHUMAN_API_SECRET" not in s
    print("PATCHED_RUNTIME_SECRET_UI",path)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch_runtime_secret.py path/to/MainActivity.kt")
    main(Path(sys.argv[1]))
