#!/usr/bin/env python3
"""Instrument only the official Essence2 Android example's Activity.
Apply AFTER essence2_official_sample_runtime_secret_patch.py.
No native engine, original SDK classes, or authentication code modified.
"""
from pathlib import Path
import argparse,hashlib,json

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--file",type=Path,required=True)
    parser.add_argument("--report",type=Path,required=True)
    args=parser.parse_args()
    original=args.file.read_text()
    s=original
    replacements=[
        ("import android.app.Activity\n",
         "import android.app.Activity\n"
         "import android.content.ClipData\n"
         "import android.content.ClipboardManager\n"
         "import android.content.Context\n"
         "import android.os.SystemClock\n"
         "import android.widget.Button\n"),
        ("    private lateinit var status: TextView\n",
         "    private lateinit var status: TextView\n"
         "    private val deviceDiagnostics = StringBuilder()\n"
         "    private fun diag(msg: String) {\n"
         "        val line = \"[\" + SystemClock.elapsedRealtime() + \"ms] \" + msg\n"
         "        Log.i(\"ESSENCE2_DEVICE\", line)\n"
         "        synchronized(deviceDiagnostics) {\n"
         "            if (deviceDiagnostics.length > 100000) deviceDiagnostics.delete(0, 40000)\n"
         "            deviceDiagnostics.append(line).append('\\n')\n"
         "        }\n"
         "    }\n"),
        ("        setContentView(root)\n        showSecretPrompt()\n",
         "        val copyButton = Button(this).apply {\n"
         "            text = \"진단 로그 복사\"\n"
         "            setOnClickListener {\n"
         "                val manager = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager\n"
         "                val logs = synchronized(deviceDiagnostics) { deviceDiagnostics.toString() }\n"
         "                manager.setPrimaryClip(ClipData.newPlainText(\"Essence2 diagnostics\", logs))\n"
         "                status.text = \"진단 로그 복사 완료. 채팅에 붙여 넣어 주십시오.\"\n"
         "            }\n"
         "        }\n"
         "        root.addView(copyButton, FrameLayout.LayoutParams(\n"
         "            WRAP, WRAP, Gravity.TOP or Gravity.END\n"
         "        ))\n"
         "        setContentView(root)\n"
         "        diag(\"DEVICE_ABIS=\" + android.os.Build.SUPPORTED_ABIS.joinToString(\",\"))\n"
         "        diag(\"ORIGINAL_ESSENCE2_ANDROID_0_10_3_DEVICE_TEST_READY\")\n"
         "        showSecretPrompt()\n"),
        ("        val secret = runtimeApiSecret\n",
         "        val sessionBeginMs = SystemClock.elapsedRealtime()\n"
         "        diag(\"ORIGINAL_ESSENCE2_DEVICE_TEST_BEGIN\")\n"
         "        val secret = runtimeApiSecret\n"),
        ("        val store = Essence2ModelStore(this)\n",
         "        val store = Essence2ModelStore(this)\n"
         "        val modelBeginMs = SystemClock.elapsedRealtime()\n"
         "        diag(\"ORIGINAL_SDK_MODEL_STORE_FETCH_BEGIN agent=A52DHS2219\")\n"),
        ("        say(\"identity ready — starting the engine…\")\n",
         "        diag(\"ORIGINAL_SDK_MODEL_STORE_FETCH_PASS elapsedMs=\" +\n"
         "            (SystemClock.elapsedRealtime() - modelBeginMs))\n"
         "        say(\"identity ready — starting the engine…\")\n"),
        ("        Essence2Avatar.create(identity.dir).use { avatar ->\n",
         "        val engineBeginMs = SystemClock.elapsedRealtime()\n"
         "        diag(\"ORIGINAL_SDK_CREATE_BEGIN\")\n"
         "        Essence2Avatar.create(identity.dir).use { avatar ->\n"
         "            diag(\"ORIGINAL_SDK_CREATE_PASS ms=\" +\n"
         "                (SystemClock.elapsedRealtime() - engineBeginMs) +\n"
         "                \" width=\" + avatar.width + \" height=\" + avatar.height)\n"),
        ("            avatar.feed(pcm)                      // 16-bit little-endian PCM bytes, as read\n",
         "            diag(\"ORIGINAL_SDK_FEED_BEGIN pcmBytes=\" + pcm.size)\n"
         "            avatar.feed(pcm)                      // 16-bit little-endian PCM bytes, as read\n"
         "            diag(\"ORIGINAL_SDK_FEED_RETURN ms=\" +\n"
         "                (SystemClock.elapsedRealtime() - engineBeginMs))\n"),
        ("            avatar.endOfAudio()                   // \"that is the whole utterance\"\n",
         "            avatar.endOfAudio()                   // \"that is the whole utterance\"\n"
         "            diag(\"ORIGINAL_SDK_END_OF_AUDIO_RETURN\")\n"),
        ("                    frame.rewind()\n",
         "                    frame.rewind()\n"
         "                    if (out.isEmpty()) {\n"
         "                        diag(\"ORIGINAL_SDK_FIRST_FRAME_PASS elapsedMs=\" +\n"
         "                            (SystemClock.elapsedRealtime() - engineBeginMs))\n"
         "                    }\n"),
        ("                    bmp.copyPixelsFromBuffer(frame)\n",
         "                    bmp.copyPixelsFromBuffer(frame)\n"
         "                    if (out.isEmpty()) {\n"
         "                        val first = File(filesDir, \"essence2-first-frame.png\")\n"
         "                        first.outputStream().use { output ->\n"
         "                            bmp.compress(Bitmap.CompressFormat.PNG, 100, output)\n"
         "                        }\n"
         "                        diag(\"ORIGINAL_SDK_FIRST_FRAME_PNG bytes=\" + first.length())\n"
         "                    }\n"),
        ("                    out.add(jpeg.toByteArray())\n",
         "                    out.add(jpeg.toByteArray())\n"
         "                    if (out.size % 25 == 0) {\n"
         "                        diag(\"ORIGINAL_SDK_FRAMES count=\" + out.size +\n"
         "                            \" elapsedMs=\" + (SystemClock.elapsedRealtime() - engineBeginMs))\n"
         "                    }\n"),
        ("            frames = out\n",
         "            diag(\"ORIGINAL_SDK_RENDER_RESULT frames=\" + out.size +\n"
         "                \" expected=\" + expected +\n"
         "                \" engineMs=\" + (SystemClock.elapsedRealtime() - engineBeginMs) +\n"
         "                \" totalMs=\" + (SystemClock.elapsedRealtime() - sessionBeginMs))\n"
         "            frames = out\n"),
        ("                Log.e(TAG, \"failed\", t)\n",
         "                Log.e(TAG, \"failed\", t)\n"
         "                diag(\"ORIGINAL_SDK_TEST_FAILED type=\" + t.javaClass.simpleName +\n"
         "                    \" message=\" + (t.message ?: \"\").take(400))\n")
    ]
    for before,after in replacements:
        count=s.count(before)
        if count!=1:
            raise RuntimeError("ESSENCE2_DIAGNOSTICS_ANCHOR_COUNT "+str(count)+" expected 1 for "+repr(before[:90]))
        s=s.replace(before,after,1)
    assert "Essence2Credential.set(secret)" in s
    assert "Essence2Avatar.create(identity.dir)" in s
    assert "ORIGINAL_SDK_RENDER_RESULT" in s
    assert "ORIGINAL_SDK_FIRST_FRAME_PASS" in s
    args.file.write_text(s)
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps({
        "old_app_sha256":hashlib.sha256(original.encode()).hexdigest(),
        "modified_app_sha256":hashlib.sha256(s.encode()).hexdigest(),
        "app_only_diagnostics_hunks":len(replacements),
        "original_vendor_sdk_modified":False,
        "no_api_secret_embedded":True,
        "native_inference_on_real_phone_verified":False
    },indent=2)+"\n")
    print("ESSENCE2_PHYSICAL_PHONE_DIAGNOSTICS_APP_ONLY_PATCH_PASS",len(replacements))

if __name__=="__main__":
    main()
