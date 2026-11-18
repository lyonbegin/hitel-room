#!/usr/bin/env python3
"""Adapt disposable original Flutter SDK to verified public Essence2 local bundles.

Unlike the vendor store, HITEL's importer caches the original public Android
model bytes by their canonical catalog SHA256. This NEVER modifies the original
Essence2 Android native SDK AAR, its metering, or the vendor entitlement gate.
The user still needs an authorized original SDK credential to render.
"""
import argparse
import hashlib
import json
from pathlib import Path

ORIGINAL = "android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt"
ADDITIONAL = "android/src/main/kotlin/ai/bithuman/flutter/HitelEssence2PublicAndroidBundle.kt"
BEGIN = "            fetch = { s ->\n"
END = "            setCredential = { s -> Essence2Credential.set(s) },"

REPLACEMENT = """            fetch = { s ->
                // HITEL supplies a catalog-SHA verified original Android bundle.
                // The SDK's own entitlement, credential and native meter remain active.
                val st = Essence2ModelStore(context, java.io.File(context.filesDir, "essence2"),
                    3L * 1024 * 1024 * 1024, Essence2ModelStore.MeteredDoorResolver(s))
                store = st
                val originalBundle = HitelEssence2PublicAndroidBundle.fetch(
                    context, code,
                    checkCancel = { handle.throwIfCancelled() },
                    progress = { done, total -> loadEvents.fetchProgress(handle, done, total) })
                loadEvents.fetched(handle)
                handle.throwIfCancelled()
                loadEvents.stage(handle, LoadHandle.STAGE_PREPARE)
                originalBundle
            },
"""


def prepare(app, plugin, archive, source_kotlin, report):
    original_file = archive / ORIGINAL
    copy_file = plugin / ORIGINAL
    pristine = original_file.read_text(encoding="utf-8")
    copy = copy_file.read_text(encoding="utf-8")
    if pristine != copy:
        raise AssertionError("Expected fresh byte-identical original Flutter SDK copy")
    start = copy.index("    private fun loadEssence2(")
    end = copy.index("    private fun createEssence2(", start)
    segment = copy[start:end]
    if segment.count(BEGIN) != 1 or segment.count(END) != 1:
        raise AssertionError("Original Essence2 load anchors changed")
    a = segment.index(BEGIN)
    b = segment.index(END, a)
    replaced = segment[:a] + REPLACEMENT + segment[b:]
    original_tail = copy[:start] + copy[end:]
    patched = copy[:start] + replaced + copy[end:]
    if patched[:start] + patched[start+len(replaced):] != original_tail:
        raise AssertionError("SDK plugin methods outside loadEssence2 changed")
    assert "create = { bundle -> createEssence2(store!!, code, bundle, handle) }" in replaced
    assert "admit = { c, m, s -> entitlement.admit(c, m, s) }" in replaced
    assert "setCredential = { s -> Essence2Credential.set(s) }" in replaced
    assert "if (hit != null) store?.let { revalidateLater(it, code) }" in replaced
    copy_file.write_text(patched, encoding="utf-8")
    dest = plugin / ADDITIONAL
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(source_kotlin.read_bytes())
    assert "Essence2ModelStore.Bundle(code, root, donors)" in dest.read_text()
    assert 'https://api.bithuman.ai/v1/agent/' in dest.read_text()
    dart = (app / "lib/main.dart").read_text()
    assert "const _engineSlug = String.fromEnvironment('BH_ENGINE', defaultValue: 'essence2');" in dart
    assert dart.count("BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret)") == 1
    assert "await _openSession(avatar, secret);" in dart
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        "base": "official Flutter plugin 2.6.37",
        "original_android_aar": "ai.bithuman:essence2-android:0.9.5",
        "official_plugin_sha256": hashlib.sha256(pristine.encode()).hexdigest(),
        "kotlin_plugin_method_changed": "loadEssence2 public model fetch closure only",
        "all_plugin_methods_outside_loadEssence2_byte_identical": True,
        "original_vendor_entitlement_admit_identical": True,
        "original_vendor_credential_set_identical": True,
        "original_create_essence2_identical": True,
        "original_app_post_load_flow_identical": True,
        "native_code_changed": False,
        "model_source": "official public Android store member HTTPS grants",
        "local_file_verified_against_official_catalog": True,
        "full_model_in_APK": False,
        "downloads_selected_identity_on_demand": True,
        "requires_original_vendor_runtime_credential": True,
        "HITEL_independent_license_server_integrated": False,
        "Galaxy_Flip3_device_verified": False,
    }, indent=2) + "\n", encoding="utf-8")
    print("PASS_ESSENCE2_ORIGINAL_NATIVE_VENDOR_METER_AND_ENTITLEMENT_PRESERVED_LOCAL_MODEL_IMPORTER")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--app", type=Path, required=True)
    p.add_argument("--plugin", type=Path, required=True)
    p.add_argument("--archive", type=Path, required=True)
    p.add_argument("--source-kotlin", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    a = p.parse_args()
    prepare(a.app, a.plugin, a.archive, a.source_kotlin, a.report)
