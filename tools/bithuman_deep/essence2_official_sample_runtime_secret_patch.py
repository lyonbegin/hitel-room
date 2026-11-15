#!/usr/bin/env python3
"""Make original bitHuman essence2-hello sample usable on a physical Android device.

This is an APP UI patch only, not an SDK or vendor-class patch.
Allows the user to paste a valid API Secret locally after APK installation.
Never inserts API Secret values into BuildConfig or source/APK, never persists
them to disk or prints them to logs. JVM/ARM64 native SDK bytes unchanged.
"""
import argparse,difflib,hashlib,json
from pathlib import Path

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--file",type=Path,required=True)
    ap.add_argument("--report",type=Path,required=True)
    a=ap.parse_args()
    original=a.file.read_text()
    text=original
    replacements=[
      ('import android.app.Activity\n',
       'import android.app.Activity\nimport android.app.AlertDialog\nimport android.text.InputType\nimport android.widget.EditText\n'),
      ('    private var frames: List<ByteArray> = emptyList()\n',
       '    private var frames: List<ByteArray> = emptyList()\n\n'
       '    // User enters the credential on their own device only. Never persist/log it.\n'
       '    @Volatile private var runtimeApiSecret: String = ""\n'),
      ('setOnClickListener { start() }',
       'setOnClickListener { if (runtimeApiSecret.isBlank()) showSecretPrompt() else start() }'),
      ('        setContentView(root)\n        start()\n',
       '        setContentView(root)\n        showSecretPrompt()\n'),
      ('    private fun start() {\n',
       '    /** Local, in-memory credential prompt. Not saved in the APK, preferences or logs. */\n'
       '    private fun showSecretPrompt() {\n'
       '        val field = EditText(this).apply {\n'
       '            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD\n'
       '            isSingleLine = true\n'
       '            hint = "API Secret"\n'
       '        }\n'
       '        val dialog = AlertDialog.Builder(this)\n'
       '            .setTitle("Essence 2 실기기 테스트")\n'
       '            .setMessage("본인의 bitHuman API Secret을 입력하십시오. 키는 이 기기의 메모리에서만 사용하며 파일에 저장하지 않습니다. 모델 다운로드에는 네트워크가 필요합니다.")\n'
       '            .setView(field)\n'
       '            .setPositiveButton("테스트 시작") { _, _ ->\n'
       '                val candidate = field.text.toString().trim()\n'
       '                field.text.clear()\n'
       '                if (candidate.isBlank()) {\n'
       '                    say("API Secret이 비어 있습니다. 화면을 터치하여 다시 입력하십시오.")\n'
       '                } else {\n'
       '                    runtimeApiSecret = candidate\n'
       '                    start()\n'
       '                }\n'
       '            }\n'
       '            .setNegativeButton("나중에") { _, _ ->\n'
       '                say("화면을 터치하면 API Secret 입력 창이 열립니다.")\n'
       '            }\n'
       '            .create()\n'
       '        dialog.setOnShowListener { field.requestFocus() }\n'
       '        dialog.show()\n'
       '    }\n\n'
       '    private fun start() {\n'),
      ('        val secret = BuildConfig.BITHUMAN_API_SECRET\n',
       '        val secret = runtimeApiSecret\n'),
      ('            say("No API secret. Put\\n\\nbithumanApiSecret=<your API secret>\\n\\nin ~/.gradle/gradle.properties (or export BITHUMAN_API_SECRET) and rebuild. Essence 2 needs it to download the avatar and run the session.")\n',
       '            say("API Secret이 필요합니다. 화면을 터치하여 입력하십시오.")\n')
    ]
    for before,after in replacements:
        count=text.count(before)
        if count!=1:raise ValueError(f"OFFICIAL_SAMPLE_SOURCE_CHANGED__EXPECTED_ONE_HUNK__{count}: {before!r}")
        text=text.replace(before,after,1)
    a.file.write_text(text)
    a.report.parent.mkdir(parents=True,exist_ok=True)
    summary={
      "target":"Official bitHuman essence2-hello MainActivity.kt",
      "original_sha256":hashlib.sha256(original.encode()).hexdigest(),
      "modified_sha256":hashlib.sha256(text.encode()).hexdigest(),
      "edited_hunks":len(replacements),
      "official_vendor_sdk_bytecode_modified":False,
      "original_sdk_native_elf_modified":False,
      "original_app_render_logic_feed_pull_modified":False,
      "api_secret_persisted":False,
      "api_secret_hardcoded":False,
      "api_secret_via_app_ui":True,
      "models_still_downloaded_by_official_Essence2ModelStore":True,
      "app_ui_is_modified_intentionally":True,
    }
    a.report.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n")
    (a.report.parent/"official-sample-UI-only.patch").write_text(
       "".join(difflib.unified_diff(original.splitlines(keepends=True),
               text.splitlines(keepends=True),
               fromfile="upstream/android/essence2-hello/app/MainActivity.kt",
               tofile="local/essence2-hello/app/MainActivity.kt")))
    print("ESSENCE2_OFFICIAL_SAMPLE_RUNTIME_KEY_UI_PATCH_PASS",len(replacements))
if __name__=="__main__":main()
