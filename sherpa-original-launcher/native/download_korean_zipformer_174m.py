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
# Pin observed SHA256 values from the independent x86_64 4-model verified-M4A
# benchmark (private action 42827478126); publisher SHA256SUMS has a different
# path notation and was NOT marked verified in that run.
pinned={
    "encoder":"e595e2e37f46078387868ffa656b775de787fa511cf851cf8e1892d7dbdabe54",
    "decoder":"f5dfa6c8609b29da86c739d4904889475c33b62e28e70c619952a0ee6c31416f",
    "joiner":"64efd9aeb71fb2278c713b3d5eb5ec45edf6b2ccd8716d3709044f17723c13fd",
    "tokens":"435dfb9e0a2b6a79124f1a4d8f0f33a951b25384726e2e0d854f081533e6ec9d",
}
report={}
for kind in ("encoder","decoder","joiner","tokens"):
    source_name="tokens.txt" if kind=="tokens" else f"{kind}-epoch-99-avg-1-chunk-16-left-128.int8.onnx"
    asset_name=source_name if kind=="tokens" else f"{kind}.int8.onnx"
    source=Path(hf_hub_download(repo_id=repo,filename=source_name))
    target=dest/asset_name
    shutil.copyfile(source,target)
    with target.open("rb") as file:
        h=hashlib.file_digest(file,"sha256").hexdigest()
    expected=pinned[kind]
    assert h==expected, f"Different model from successful original-M4A benchmark: {source_name}, {h} != {expected}"
    report[kind]={"name":asset_name,"bytes":target.stat().st_size,
                  "sha256":h,"verified_against_prior_benchmark":True}
    print("VERIFIED_KOREAN_MODEL",kind,report[kind],flush=True)
Path("sherpa-original-launcher/zipformer-model-integrity.json").write_text(
    json.dumps(report,indent=2,ensure_ascii=False))
assert report["encoder"]["bytes"]>140_000_000
print("KOREAN_174M_INT8_CHUNK32_MODEL_READY",flush=True)
