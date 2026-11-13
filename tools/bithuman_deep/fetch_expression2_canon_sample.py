#!/usr/bin/env python3
"""Read original Wise Pup canon.bin directly from the public sample IMX.

Try HTTP Range to avoid downloading the 198MB sample. If unsupported, stream
the published IMX once and use the independently verified IMX v2 member table.
Never invent canon values or embed a synthetic replacement for the real test.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
import sys
import urllib.request
from pathlib import Path

URL="https://api.bithuman.ai/v1/agent/A23WJF0199/model/download?model=expression-2"
EXPECTED_SIZE=299520
EXPECTED_SHA256="cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5"


def table_from_prefix(raw: bytes):
    src=io.BytesIO(raw)
    head=src.read(8)
    if len(head)!=8 or head[:4]!=b"IMX\x00":
        raise ValueError("IMX v2 magic missing")
    version,count=struct.unpack("<HH",head[4:])
    if version!=2 or count<1 or count>5000:
        raise ValueError(f"Unexpected IMX version/count: {version}/{count}")
    entries={}
    for _ in range(count):
        nbuf=src.read(2)
        if len(nbuf)!=2:raise ValueError("Truncated IMX table")
        n=struct.unpack("<H",nbuf)[0]
        if n<1 or n>8192:raise ValueError("Invalid member name length")
        name=src.read(n).decode("utf-8")
        meta=src.read(16)
        if len(meta)!=16:raise ValueError("Truncated IMX member table")
        offset,size=struct.unpack("<QQ",meta)
        entries[name]=(offset,size)
    return entries


def get_range(start,stop):
    request=urllib.request.Request(URL,headers={
        "Range":f"bytes={start}-{stop}",
        "User-Agent":"Expression2-Source-Fidelity-Tester/1.0"})
    with urllib.request.urlopen(request,timeout=90) as response:
        if response.status!=206:
            return None
        data=response.read(stop-start+2)
        if len(data)!=stop-start+1:
            raise ValueError(f"Invalid Range response length: {len(data)}")
        return data


def download_full(path):
    request=urllib.request.Request(URL,headers={
        "User-Agent":"Expression2-Source-Fidelity-Tester/1.0"})
    with urllib.request.urlopen(request,timeout=90) as response, path.open("wb") as stream:
        while True:
            data=response.read(1024*1024)
            if not data:break
            stream.write(data)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    original=args.output/"canon.bin"
    method="range"
    prefix=get_range(0,65535)
    data=None
    if prefix is not None:
        entries=table_from_prefix(prefix)
        if "canon.bin" not in entries:raise ValueError("Sample missing canon.bin")
        offset,size=entries["canon.bin"]
        if size!=EXPECTED_SIZE:raise ValueError(f"canon size differs: {size}")
        data=get_range(offset,offset+size-1)
    if data is None:
        method="full-imx-fallback"
        file=args.output/"wise-pup.imx"
        download_full(file)
        sys.path.insert(0,str(Path(__file__).resolve().parent))
        from imx_v2 import parse, member_by_name, iter_chunks
        table=parse(file)
        member=member_by_name(table,"canon.bin")
        data=b"".join(iter_chunks(file,member))
        file.unlink()
    if len(data)!=EXPECTED_SIZE:raise ValueError("Wrong canon.bin size")
    sha=hashlib.sha256(data).hexdigest()
    if sha!=EXPECTED_SHA256:raise ValueError(f"Wrong sample canon hash {sha}")
    original.write_bytes(data)
    report={"source_model":"wise-pup","public_imx_url":URL,
            "extracted_member":"canon.bin","fetch_method":method,
            "canon_bytes":len(data),"canon_sha256":sha,
            "original_provenance":"Unmodified public Expression2 IMX member, SHA256 verified"}
    (args.output/"canon_provenance.json").write_text(json.dumps(report,indent=2))
    print("ORIGINAL_WISE_PUP_CANON_VERIFIED",json.dumps(report,sort_keys=True))
if __name__=="__main__":
    main()
