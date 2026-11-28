"""Produce exact data-only Korean append assets from a structurally verified pack.
The original multilingual file remains unchanged on the user's device.
"""
import argparse,hashlib,json,pathlib
p=argparse.ArgumentParser()
p.add_argument("base",type=pathlib.Path)
p.add_argument("combined",type=pathlib.Path)
p.add_argument("output",type=pathlib.Path)
a=p.parse_args()
a.output.mkdir(parents=True,exist_ok=True)
block=16384
base_hash=hashlib.sha256(); full_hash=hashlib.sha256()
with a.base.open("rb") as f,a.combined.open("rb") as g:
    b=f.read(block); c=g.read(block)
    assert b[:8]==c[:8]==b"LITERTLM"
    base_hash.update(b);full_hash.update(c)
    (a.output/"pocket-eight-header.bin").write_bytes(c)
    while True:
        b=f.read(4*1024*1024)
        if not b:break
        c=g.read(len(b))
        assert b==c,"Original model payload was altered"
        base_hash.update(b);full_hash.update(c)
    with (a.output/"pocket-eight-tail.bin").open("wb") as out:
        while True:
            c=g.read(4*1024*1024)
            if not c:break
            full_hash.update(c);out.write(c)
meta={"baseSize":a.base.stat().st_size,"combinedSize":a.combined.stat().st_size,"baseSha256":base_hash.hexdigest(),"combinedSha256":full_hash.hexdigest()}
assert meta["baseSize"]==760061960 and meta["combinedSize"]==882565128,meta
for name,key in [("pocket-eight-header.bin","headerSha256"),("pocket-eight-tail.bin","tailSha256")]:
    meta[key]=hashlib.file_digest((a.output/name).open("rb"),"sha256").hexdigest()
(a.output/"pocket-eight.json").write_text(json.dumps(meta))
print("ALL_ORIGINAL_PAYLOAD_BYTES_IDENTICAL",meta)
