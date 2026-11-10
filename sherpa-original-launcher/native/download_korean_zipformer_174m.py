#!/usr/bin/env python3
"""Fetch *verified* official Korean 174M Zipformer chunk-32 INT8 ONNX assets.
Only models are downloaded; the private Samsung M4A never leaves the test repo.
"""
from pathlib import Path
from huggingface_hub import hf_hub_download
import hashlib, shutil, json

repo="kangkyu/icefall-asr-ko-streaming-zipformer-174m"
dest=Path("sherpa-original-launcher/app/src/main/assets/sensevoice")
dest.mkdir(parents=True,exist_ok=True)
checks=Path(hf_hub_download(repo_id=repo,filename="SHA256SUMS")).read_text()
published={}
for l in checks.splitlines():
    p=l.strip().split()
    if len(p)==2 and len(p[0])==64:
        published[p[1].lstrip("*")]=p[0].lower()
report={}
for kind in ("encoder","decoder","joiner","tokens"):
    source_name="tokens.txt" if kind=="tokens" else f"{kind}-epoch-99-avg-1-chunk-32-left-128.int8.onnx"
    asset_name=source_name if kind=="tokens" else f"{kind}.int8.onnx"
    source=Path(hf_hub_download(repo_id=repo,filename=source_name))
    target=dest/asset_name
    shutil.copyfile(source,target)
    with target.open("rb") as file:
        h=hashlib.file_digest(file,"sha256").hexdigest()
    expected=published.get(source_name)
    assert expected is not None, f"Official publisher SHA256 missing for {source_name}"
    assert h==expected, f"Mismatch: {source_name} {h} != {expected}"
    report[kind]={"name":asset_name,"bytes":target.stat().st_size,
                  "sha256":h,"verified_against_publisher":True}
    print("VERIFIED_KOREAN_MODEL",kind,report[kind],flush=True)
Path("sherpa-original-launcher/zipformer-model-integrity.json").write_text(
    json.dumps(report,indent=2,ensure_ascii=False))
assert report["encoder"]["bytes"]>140_000_000
print("KOREAN_174M_INT8_CHUNK32_MODEL_READY",flush=True)
