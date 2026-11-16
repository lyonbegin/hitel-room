#!/usr/bin/env python3
"""Derive a test-only copy of the verified bitHuman Flutter Android plugin.

Upstream Flutter source stays intact in sdk/bithuman/flutter-plugin.
No vendor engine patch here: the independent one-method meter endpoint patch
is applied ONLY to a debug AAR by the existing proven test script in CI.
"""
from pathlib import Path
import sys

def main():
    plugin = Path(sys.argv[1]).resolve()
    fixture = Path(sys.argv[2]).resolve()
    local_test = Path(sys.argv[3]).resolve()
    assert (plugin/"LICENSE").is_file()
    root = plugin/"android/src/main/kotlin/ai/bithuman/flutter"
    bridge = root/"BithumanPlugin.kt"
    text = bridge.read_text()
    original = """    private fun loadExpression2(code: String, secret: String?, t0: Long, handle: LoadHandle, gen: Long): AvatarEngine {
"""
    change = original + """        // HITEL test variant ONLY: existing proven original model and local test
        // fixture. No user API Secret; bypasses network model store in test app,
        // not the vendor inference engine or original Flutter player/Texture.
        if (secret.isNullOrBlank() && code == "A23WJF0199") {
            handle.throwIfCancelled()
            loadEvents.stage(handle, LoadHandle.STAGE_PREPARE)
            val original = Expression2LocalTest.create(context, code)
            handle.throwIfCancelled()
            loadEvents.fetched(handle)
            loadEvents.stage(handle, LoadHandle.STAGE_PREPARED)
            android.util.Log.i("BH_EXPR2_LOCAL_TEST",
                "FLUTTER_LOCAL_TEST_ORIGINAL_ENGINE_READY (no user API Secret)")
            return Expression2Engine(original)
        }
"""
    assert text.count(original) == 1
    assert "Expression2RouteSelector.create(context, model)" in text
    bridge.write_text(text.replace(original, change, 1))
    destination = root/"Expression2LocalTest.kt"
    assert not destination.exists()
    destination.write_bytes(local_test.read_bytes())
    server = root/"LoopbackAuthFixture.kt"
    assert not server.exists()
    old = fixture.read_text()
    assert old.startswith("package com.example.x2hello\n")
    old = old.replace("package com.example.x2hello\n",
                      "package ai.bithuman.flutter\n", 1)
    assert "EXPR2_PHYSICAL_DEVICE_LOCAL_FIXTURE_NOT_VENDOR_SECRET" in old
    server.write_text(old)
    assert "Expression2LocalTest.create(context, code)" in bridge.read_text()
    print("HITEL_FLUTTER_LOCAL_FIXTURE_NO_USER_SECRET_SOURCE_PATCH_PASS")
    print("Original Flutter plugin, original JNI and original SDK model retained")

if __name__ == "__main__":
    main()
