#!/usr/bin/env python3
"""Read DEX headers and class-name summary from already recovered files.

This is a lightweight verification parser, not a dex decompiler.
Avoid emitting embedded string literals, personally identifying data, etc.
"""
import collections
import hashlib
import json
import pathlib
import struct
import sys
import zipfile

TAGS = ("speech", "stt", "asr", "audio", "record", "capture", "media", "pcm", "telephony",
        "transcript", "recognition", "voice", "call", "whisper", "sherpa", "microphone",
        "speaker", "binder", "accessibility")

def u32(b, off):
    return struct.unpack_from("<I", b, off)[0]

def dex_details(raw, fname):
    o = {"file": fname, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    if len(raw) < 112 or raw[:4] != b"dex\n" or raw[7] != 0:
        return {**o, "is_dex": False}
    file_size = u32(raw,32)
    string_count, string_off = u32(raw,56),u32(raw,60)
    type_count,type_off = u32(raw,64),u32(raw,68)
    class_count,class_off = u32(raw,96),u32(raw,100)
    o.update({"is_dex":True,"dex_version":raw[4:7].decode("ascii","replace"),
              "declared_size":file_size,"declared_size_matches":file_size==len(raw),
              "class_count":class_count,"string_count":string_count})
    if string_count>3_000_000 or class_count>1_500_000 or type_count>1_500_000:
        o["parse_error"]="unreasonable table lengths";return o
    if string_off+4*string_count>len(raw) or type_off+4*type_count>len(raw) or class_off+32*class_count>len(raw):
        o["parse_error"]="table outside file";return o
    strings=[]
    for i in range(string_count):
        pos=u32(raw,string_off+4*i)
        if pos>=len(raw):
            strings.append("");continue
        # UTF-16 code point count is ULEB128.
        for j in range(5):
            if pos>=len(raw):break
            v=raw[pos];pos+=1
            if v<128:break
        end=raw.find(b"\0",pos,min(len(raw),pos+800))
        if end<0:end=pos
        strings.append(raw[pos:end].decode("utf-8","replace"))
    types=[strings[u32(raw,type_off+4*i)] if u32(raw,type_off+4*i)<len(strings) else "" for i in range(type_count)]
    classes=[]
    for i in range(class_count):
        idx=u32(raw,class_off+32*i)
        if idx<len(types):classes.append(types[idx])
    top=collections.Counter()
    tag_matches=collections.Counter()
    for d in classes:
        parts=d.strip("L;").split("/")
        top["/".join(parts[:3])] +=1
        for t in TAGS:
            if t in d.lower():
                tag_matches[t]+=1
    o["class_descriptors"] = classes[:100] if class_count<=100 else []
    o["top_class_prefixes"]=top.most_common(24)
    o["tagged_class_counts"]=dict(tag_matches)
    return o

def analyze_file(p):
    results=[]
    b=p.read_bytes()
    if b[:4] == b"PK\x03\x04":
        try:
            with zipfile.ZipFile(p) as z:
                for n in z.namelist():
                    if n.endswith(".dex") and z.getinfo(n).file_size <= 250_000_000:
                        results.append(dex_details(z.read(n),str(p)+":"+n))
        except Exception as e:
            results.append({"file":str(p),"zip_error":type(e).__name__})
    elif b[:4]==b"dex\n":
        results.append(dex_details(b,str(p)))
    return results

def main():
    root=pathlib.Path(sys.argv[1])
    out=pathlib.Path(sys.argv[2])
    details=[]
    for p in sorted(root.rglob("*")):
        if p.is_file() and p.suffix.lower() in (".dex",".zip",".apk"):
            details.extend(analyze_file(p))
    out.write_text(json.dumps({"files":details},ensure_ascii=False,indent=2))
    print("DEX_ANALYSIS_FILES="+str(len(details)))
    for d in details:
        print("DEX_ITEM",d["file"],"bytes",d["bytes"],"classes",d.get("class_count"),"tagged",d.get("tagged_class_counts"))
if __name__ == "__main__":
    main()
