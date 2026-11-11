#!/usr/bin/env python3
"""Download Korean streaming 72M Zipformer INT8 ONNX chunk-16 for Galaxy.
Model files are fetched at a single pinned Hugging Face revision and checked
against the publisher's SHA256SUMS when available. No private call data used.
"""
from pathlib import Path
from huggingface_hub import hf_hub_download, model_info
import hashlib, shutil, json, re

repo="kangkyu/icefall-asr-ko-streaming-zipformer-72m"
revision=model_info(repo).sha
assert len(revision)==40 and re.fullmatch("[a-f0-9]{40}",revision)
dest=Path("sherpa-original-launcher/app/src/main/assets/sensevoice")
dest.mkdir(parents=True,exist_ok=True)
manifest=Path(hf_hub_download(repo_id=repo,filename="SHA256SUMS",revision=revision)).read_text()
checksums={}
for line in manifest.splitlines():
    m=re.match(r"^([a-fA-F0-9]{64})\\s+\\*?(.+)$",line.strip())
    if m:checksums[Path(m.group(2)).name]=m.group(1).lower()
report={"model":repo,"revision":revision,"assets":{}}
for kind in ("encoder","decoder","joiner","tokens"):
    source_name="tokens.txt" if kind=="tokens" else f"{kind}-epoch-99-avg-1-chunk-16-left-128.int8.onnx"
    dest_name=source_name if kind=="tokens" else f"{kind}.int8.onnx"
    assert source_name in checksums, ("Missing publisher digest",source_name)
    source=Path(hf_hub_download(repo_id=repo,filename=source_name,revision=revision))
    target=dest/dest_name
    shutil.copyfile(source,target)
    actual=hashlib.file_digest(target.open("rb"),"sha256").hexdigest()
    assert actual==checksums[source_name], (kind,actual,checksums[source_name])
    report["assets"][kind]={"file":dest_name,"bytes":target.stat().st_size,"sha256":actual}
    print("VERIFIED_72M_CHUNK16_INT8",kind,report["assets"][kind],flush=True)
enc=report["assets"]["encoder"]["bytes"]
assert 35_000_000<enc<110_000_000,enc
Path("sherpa-original-launcher/zipformer-model-integrity.json").write_text(json.dumps(report,indent=2))
print("KOREAN_72M_INT8_CHUNK16_MODEL_READY",report["revision"],flush=True)
