#!/usr/bin/env python3
"""Patch official Apache-2.0 bitHuman Flutter v2.6.40 source at original SDK boundaries."""
from pathlib import Path
import hashlib
import json
import sys

ORIGINAL_SHA = {
    "android/build.gradle": "186d95f419216830e7caf4d3b21e785a274fdfda7975fd9193260e2bf7e6523e",
    "android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt": "7329dfa0f32196b92bcd8f8c0d7d2953c809534aad98fd4a85aa19902a5cc6ae",
    "android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt": "59444727b07891fe039e71f9e77b7aeaaf179cbd209e22609b22f5a4af51dc4f",
}

def change(path, old, new):
    s = path.read_text()
    if s.count(old) != 1:
        raise RuntimeError(f"Expected exactly one upstream anchor: {path} count={s.count(old)}")
    path.write_text(s.replace(old, new, 1))

def main():
    plugin = Path(sys.argv[1]).resolve()
    selector = Path(sys.argv[2]).resolve()
    report = Path(sys.argv[3]).resolve()
    license = plugin/"LICENSE"
    assert license.is_file()
    assert hashlib.sha256(license.read_bytes()).hexdigest() == (
        "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"
    )
    for rel, sha in ORIGINAL_SHA.items():
        assert hashlib.sha256((plugin/rel).read_bytes()).hexdigest() == sha, (
            f"Unexpected upstream source changed: {rel}"
        )
    gradle = plugin/"android/build.gradle"
    change(gradle,
        "implementation 'ai.bithuman:expression2-android:0.6.1'",
        "implementation 'ai.hitel.reassembled:expression2-android:0.6.2'\n"
        "    implementation 'com.qualcomm.qti:qnn-litert-delegate:2.49.0'\n"
        "    implementation 'com.qualcomm.qti:qnn-runtime:2.49.0'")
    change(gradle,
        "rootProject.allprojects {\n    repositories {\n        google()\n        mavenCentral()\n",
        "rootProject.allprojects {\n    repositories {\n        google()\n        mavenCentral()\n"
        '        maven {\n'
        '            url = uri("${rootProject.projectDir}/local-sdk-maven")\n'
        '            content { includeGroup("ai.hitel.reassembled") }\n'
        '        }\n')

    bridge = plugin/"android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt"
    change(bridge,
        "try { Expression2Avatar.create(context, model) } catch (e: Exception) {",
        "try { Expression2RouteSelector.create(context, model) } catch (e: Exception) {")

    player = plugin/"android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt"
    change(player,
        "    override fun pull(dst: Bitmap): Long = avatar.pull(dst)?.audioSample ?: -1L",
        """    // First ACTUAL generated frame, distinct from successful SDK create().
    private val firstOriginalFrame = java.util.concurrent.atomic.AtomicBoolean(false)
    override fun pull(dst: Bitmap): Long {
        val frame = avatar.pull(dst) ?: return -1L
        if (firstOriginalFrame.compareAndSet(false, true)) {
            android.util.Log.i("BH_EXPR2_DEVICE_ROUTE", "ROUTE_FIRST_FRAME_PASS " +
                "actual=${avatar.accelerator} routing=${avatar.routing} " +
                "qnnOptions=${avatar.options.qnnOptions} " +
                "width=${dst.width} height=${dst.height} audioSample=${frame.audioSample}")
        }
        return frame.audioSample
    }""")

    target = plugin/"android/src/main/kotlin/ai/bithuman/flutter/Expression2RouteSelector.kt"
    assert not target.exists(), "Refuse to override upstream source file"
    target.write_bytes(selector.read_bytes())
    manifest = {
        "upstream": "https://gitlab.com/bithuman/sdk/homebrew-bithuman",
        "upstream_tag": "flutter-plugin-v2.6.40",
        "upstream_sha": "9417e7c2d44dd4437bf1129cbc3f54921e1d7234",
        "license": "Apache-2.0 original LICENSE retained",
        "reassembled_sdk": "ai.hitel.reassembled:expression2-android:0.6.2",
        "sdk_binary_sha256": "2529f8f0a064b4c8e8a1bb6f5fdd4627143ba4e09e05bd506bee1540e68e1527",
        "original_native_engine_modified": False,
        "vendor_auth_and_entitlement_modified": False,
        "real_device_gpu_inference_verified": False,
        "changed_files": {}
    }
    for rel in [*ORIGINAL_SHA, "android/src/main/kotlin/ai/bithuman/flutter/Expression2RouteSelector.kt"]:
        manifest["changed_files"][rel] = hashlib.sha256((plugin/rel).read_bytes()).hexdigest()
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n")
    print("ORIGINAL_FLUTTER_SOURCE_HITEL_PATCH_PASS")
    print(report.read_text())

if __name__ == "__main__":
    main()
