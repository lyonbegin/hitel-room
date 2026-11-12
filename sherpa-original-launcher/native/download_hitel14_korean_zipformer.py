#!/usr/bin/env python3
"""Download the exact Korean STT model declared by the supplied HITEL14 APK.

Provenance: flow-lab/KoreanSherpaStt.java and APK classes.dex.
Keep model assets isolated from the existing 174M model on installed devices.
"""
from pathlib import Path
import hashlib
import json
import shutil
from huggingface_hub import hf_hub_download

REPO = "k2-fsa/sherpa-onnx-streaming-zipformer-korean-2024-06-16"
REVISION = "ba6078bca4daf3f0dd37f79d0ab505af71df14a6"
DEST = Path("sherpa-original-launcher/app/src/main/assets/sensevoice")
FILES = {
    "encoder": ("encoder-epoch-99-avg-1.int8.onnx", 115_000_000,
        "8d0b1aa24fbedd4e3948564ab7facd151b8ce9b0c48fc987c541de2de3af5697"),
    "decoder": ("decoder-epoch-99-avg-1.onnx", 9_500_000, None),
    "joiner": ("joiner-epoch-99-avg-1.int8.onnx", 2_000_000,
        "128b80a66a1f718488af8560f9d15895109b99ff3e573f0a0130e03774ef1ced"),
    "tokens": ("tokens.txt", 50_000, None),
}
DEST.mkdir(parents=True, exist_ok=True)
report = {"model": REPO, "revision": REVISION, "files": {}}
for kind, (name, min_bytes, expected_sha) in FILES.items():
    source = Path(hf_hub_download(repo_id=REPO, revision=REVISION, filename=name))
    actual_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    actual_size = source.stat().st_size
    assert actual_size >= min_bytes, f"{name}: downloaded file too small ({actual_size})"
    if expected_sha:
        assert actual_sha == expected_sha, f"{name}: SHA256 mismatch {actual_sha}"
    target = DEST / name
    shutil.copyfile(source, target)
    report["files"][kind] = {
        "name": name, "bytes": actual_size, "sha256": actual_sha,
        "pinned_origin": f"{REPO}@{REVISION}",
    }
    print("HITEL14_VERIFIED_KOREAN_MODEL", kind, report["files"][kind], flush=True)

Path("sherpa-original-launcher/hitel14-model-integrity.json").write_text(
    json.dumps(report, indent=2, ensure_ascii=False))
print("HITEL14_KOREAN_ZIPFORMER_OFFICIAL_MODEL_READY", flush=True)
