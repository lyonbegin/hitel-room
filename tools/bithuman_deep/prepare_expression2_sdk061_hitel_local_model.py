#!/usr/bin/env python3
"""Reassemble the existing HITEL 0.6.1 Flutter plugin with a local ORIGINAL
public Wise Pup model. Keep every vendor AAR model/inference/native method
unchanged and keep the existing HITEL entitlement and meter endpoints.
"""
import argparse
import hashlib
import json
from pathlib import Path

MODEL_SHA = "f809722b65e933aacf2c577725e45aaba576fae84b4d17658d67d6d018a512ba"
CANON_SHA = "cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5"
MODEL_SIZE = 158524428
CANON_SIZE = 299520
ENTITLEMENT_PATH = "android/src/main/kotlin/ai/bithuman/flutter/EntitlementWindow.kt"
ENGINE_PATH = "android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt"

OLD_FETCH = '''            fetch = { s ->
                val store = Expression2ModelStore(context, java.io.File(context.filesDir, "expression2"),
                    3L * 1024 * 1024 * 1024, Expression2ModelStore.MeteredDoorResolver(s))
                val model = store.fetch(code, false, handle.storeCancel) { member, done, total ->
                    if (total > 0 && done == total) Log.i(TAG, "fetched $member")
                    loadEvents.fetchProgress(handle, done, total)
                }
                loadEvents.fetched(handle)
                handle.throwIfCancelled()
                loadEvents.stage(handle, LoadHandle.STAGE_PREPARE)
                model
            },'''

LOCAL_FETCH = '''            fetch = { _ ->
                // The original public Wise Pup IMX members are bundled in this
                // HITEL debug APK. Do not request the vendor model download door.
                // EntitlementWindow.admit(...) still runs BEFORE this closure,
                // and Expression2Avatar.create(...) still runs AFTER it.
                handle.throwIfCancelled()
                val root = java.io.File(context.filesDir, "hitel_expression2_public")
                if (!root.isDirectory && !root.mkdirs()) {
                    throw java.io.IOException("Could not create local model directory")
                }
                fun digest(file: java.io.File): String {
                    val sha = java.security.MessageDigest.getInstance("SHA-256")
                    file.inputStream().buffered().use { stream ->
                        val buffer = ByteArray(1024 * 1024)
                        while (true) {
                            val count = stream.read(buffer)
                            if (count < 0) break
                            sha.update(buffer, 0, count)
                        }
                    }
                    return sha.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
                }
                fun verifiedMember(name: String, size: Long, sha256: String): java.io.File {
                    val destination = java.io.File(root, name)
                    if (destination.isFile && destination.length() == size
                        && digest(destination) == sha256) return destination
                    val temporary = java.io.File(root, "$name.pending")
                    try {
                        context.assets.open("hitel_expression2_public/$name").use { input ->
                            temporary.outputStream().use { output -> input.copyTo(output) }
                        }
                        if (temporary.length() != size || digest(temporary) != sha256) {
                            throw java.io.IOException("Bundled original model failed size/SHA-256: $name")
                        }
                        if (destination.exists() && !destination.delete()) {
                            throw java.io.IOException("Could not replace damaged model cache: $name")
                        }
                        if (!temporary.renameTo(destination)) {
                            throw java.io.IOException("Could not publish verified local model: $name")
                        }
                    } finally {
                        temporary.delete()
                    }
                    return destination
                }
                val modelFile = verifiedMember(
                    "combined_litert.tflite", 158524428L,
                    "f809722b65e933aacf2c577725e45aaba576fae84b4d17658d67d6d018a512ba")
                handle.throwIfCancelled()
                val canonFile = verifiedMember(
                    "canon.bin", 299520L,
                    "cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5")
                handle.throwIfCancelled()
                val model = Expression2Model.combined(modelFile, canonFile, code)
                Log.i(TAG, "HITEL original Wise Pup public model loaded from verified local APK assets")
                loadEvents.fetched(handle)
                handle.throwIfCancelled()
                loadEvents.stage(handle, LoadHandle.STAGE_PREPARE)
                model
            },'''


def once(data: bytes, old: bytes, new: bytes, label: str) -> bytes:
    count = data.count(old)
    assert count == 1, (label, count)
    changed = data.replace(old, new, 1)
    assert changed.replace(new, old, 1) == data, label
    return changed


def verify_member(file: Path, size: int, hash_expected: str) -> None:
    assert file.is_file(), str(file)
    assert file.stat().st_size == size, (file, file.stat().st_size)
    digest = hashlib.sha256(file.read_bytes()).hexdigest()
    assert digest == hash_expected, (file, digest)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--plugin", type=Path, required=True)
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--model-root", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    model = args.model_root / "combined_litert.tflite"
    canon = args.model_root / "canon.bin"
    verify_member(model, MODEL_SIZE, MODEL_SHA)
    verify_member(canon, CANON_SIZE, CANON_SHA)

    assets = args.app / "android/app/src/main/assets/hitel_expression2_public"
    assets.mkdir(parents=True, exist_ok=True)
    for file in (model, canon):
        target = assets / file.name
        target.write_bytes(file.read_bytes())
    verify_member(assets / model.name, MODEL_SIZE, MODEL_SHA)
    verify_member(assets / canon.name, CANON_SIZE, CANON_SHA)

    base = args.archive / ENTITLEMENT_PATH
    dest = args.plugin / ENTITLEMENT_PATH
    original = base.read_bytes()
    platform_old = (b'fun platformDoor(code: String, model: String): URL =\n'
                    b'            URL("https://api.bithuman.ai/v1/agent/')
    platform_new = (b'fun platformDoor(code: String, model: String): URL =\n'
                    b'            URL("https://hitel-expression2-auth-production.up.railway.app/v1/agent/')
    entitlement = once(original, platform_old, platform_new, "HITEL entitlement platform door")
    assert original.split(b'fun storeDoor(code: String, model: String): URL? {', 1)[1] == (
        entitlement.split(b'fun storeDoor(code: String, model: String): URL? {', 1)[1])
    dest.write_bytes(entitlement)

    base = args.archive / ENGINE_PATH
    dest = args.plugin / ENGINE_PATH
    original = base.read_bytes()
    patched = once(original,
                   b'import ai.bithuman.expression2.Expression2ModelStore\n',
                   b'import ai.bithuman.expression2.Expression2Model\n'
                   b'import ai.bithuman.expression2.Expression2ModelStore\n',
                   "Expression2Model import")
    patched = once(patched, OLD_FETCH.encode(), LOCAL_FETCH.encode(),
                   "original model remote fetch to bundled files")
    assert b'val store = Expression2ModelStore(' not in patched.split(
        b'private fun loadExpression2(', 1)[1].split(b'private fun loadEssence2(', 1)[0]
    assert b'val model = Expression2Model.combined(modelFile, canonFile, code)' in patched
    dest.write_bytes(patched)

    # Only TWO original plugin Kotlin classes may differ. Do not touch the SDK
    # AAR's ARM64 machine code, inference, data, native renderer or meter gate.
    unchanged_count = 0
    for f in args.archive.glob("android/src/main/kotlin/**/*.kt"):
        rel = f.relative_to(args.archive)
        target = args.plugin / rel
        assert target.exists(), str(rel)
        if str(rel) not in (ENTITLEMENT_PATH, ENGINE_PATH):
            assert target.read_bytes() == f.read_bytes(), str(rel)
            unchanged_count += 1

    args.report.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "sdk": "HITEL reassembled Expression2 0.6.1 (Maven ai.hitel.reassembled)",
        "original_vendor_inference_native_modified": False,
        "existing_hitel_jvm_meter_route_preserved": True,
        "existing_hitel_entitlement_check_preserved": True,
        "plugin_changes": [ENTITLEMENT_PATH, ENGINE_PATH],
        "unchanged_plugin_kotlin_count": unchanged_count,
        "model_fetch_vendor_http_removed_for_public_demo": True,
        "model_source": "original public Wise Pup IMX previously cached in GitHub Actions",
        "model_files": [
            {"name": model.name, "bytes": MODEL_SIZE, "sha256": MODEL_SHA},
            {"name": canon.name, "bytes": CANON_SIZE, "sha256": CANON_SHA},
        ],
        "local_model_factory": "Expression2Model.combined(File, File, code)",
        "native_engine_frame_rendered_on_galaxy": False,
        "vendor_entitlement_accepted": False,
    }
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print("PASS_SDK061_HITEL_REASSEMBLED_LOCAL_ORIGINAL_MODEL_ASSETS_SHA256")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
