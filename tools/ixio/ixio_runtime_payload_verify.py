#!/usr/bin/env python3
"""Verify *existing* AppSealing/AppPealing runtime DEX files. No memory reads."""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import pathlib
import struct
import zipfile
import zlib

def u32(data, off):
    return struct.unpack_from("<I", data, off)[0]

def descriptor(data, offset, limit):
    if offset >= len(data):
        return ""
    for _ in range(5):
        if offset >= len(data):
            return ""
        b=data[offset];offset+=1
        if not b & 0x80:
            break
    end=data.find(b"\x00",offset,min(len(data),offset+limit))
    return data[offset:end].decode("utf-8","replace") if end >= offset else ""

def dex_info(data, originals):
    result={"kind":"dex","bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()}
    result["original_match"]=originals.get(result["sha256"],[])
    if len(data)<112 or data[:4]!=b"dex\n" or data[7]!=0:
        result["dex_structure"]="invalid_magic_or_header"
        return result
    try:
        file_size=u32(data,0x20)
        header_size=u32(data,0x24)
        endian=u32(data,0x28)
        cls_count=u32(data,0x60)
        cls_off=u32(data,0x64)
        string_count=u32(data,0x38)
        string_off=u32(data,0x3c)
        type_count=u32(data,0x40)
        type_off=u32(data,0x44)
        result.update({"dex_version":data[4:7].decode("ascii","replace"),
                       "claimed_size":file_size,"class_defs_count":cls_count,
                       "string_ids_size":string_count,"type_ids_size":type_count,
                       "file_size_matches":file_size==len(data),
                       "signature_matches":hashlib.sha1(data[32:]).digest()==data[12:32],
                       "checksum_matches":(zlib.adler32(data[12:])&0xffffffff)==u32(data,8)})
        okay=(file_size==len(data) and header_size==112 and endian==0x12345678
              and cls_count<250000 and cls_off+cls_count*32<=len(data)
              and string_off+string_count*4<=len(data)
              and type_off+type_count*4<=len(data))
        result["dex_structure"]="plausible" if okay else "invalid_sections"
        if not okay:
            return result
        relevant=[]
        own=0
        namespace_counts={}
        for i in range(cls_count):
            ti=u32(data,cls_off+i*32)
            if ti>=type_count:
                continue
            si=u32(data,type_off+ti*4)
            if si>=string_count:
                continue
            so=u32(data,string_off+si*4)
            d=descriptor(data,so,256)
            if not d.startswith("L"):
                continue
            if d.startswith(("Lcom/lguplus/aicallagent/","Lcom/lguplus/callrecorder/")):
                own+=1
            if any(x in d.lower() for x in ("record","audio","speech","transcri","stt","pcm","ondevice","sherpa","microphone","call","voice")):
                if len(relevant)<90: relevant.append(d[:200])
        result["ixio_own_class_defs"]=own
        result["relevant_class_descriptors_sample"]=relevant
    except (IndexError, ValueError, struct.error) as e:
        result["dex_structure"]="malformed"
        result["parser_error"]=str(e)[:150]
    return result

def baseline(folder):
    mapping={}
    def register(data,label):
        h=hashlib.sha256(data).hexdigest()
        mapping.setdefault(h,[]).append(label)
    main=folder/"main-splits"
    for p in main.glob("*.apk"):
        with zipfile.ZipFile(p) as z:
            for n in z.namelist():
                if (pathlib.PurePosixPath(n).name.startswith("classes") and n.endswith(".dex")
                    or n.startswith("assets/sealed") and n.endswith(".dex")):
                    register(z.read(n),p.name+":"+n)
    rec=folder/"recorder.apk"
    if rec.is_file():
        with zipfile.ZipFile(rec) as z:
            for n in z.namelist():
                if (pathlib.PurePosixPath(n).name.startswith("classes") and n.endswith(".dex")
                    or n.startswith("assets/sealed") and n.endswith(".dex")):
                    register(z.read(n),"recorder.apk:"+n)
    return mapping

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input",required=True)
    ap.add_argument("--originals",default=".ixio-inputs")
    ap.add_argument("--output",required=True)
    args=ap.parse_args()
    root=pathlib.Path(args.input)
    originals=baseline(pathlib.Path(args.originals))
    records=[]
    for p in sorted(root.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in (".dex",".zip"):
            continue
        try:
            data=p.read_bytes()
            if p.suffix.lower()==".dex":
                info=dex_info(data,originals)
                records.append({"path":str(p.relative_to(root)),**info})
            elif zipfile.is_zipfile(io.BytesIO(data)):
                with zipfile.ZipFile(io.BytesIO(data)) as z:
                    inside=[]
                    for member in z.infolist():
                        if member.filename.endswith(".dex") and member.file_size<128*1024*1024:
                            inside.append({"name":member.filename,**dex_info(z.read(member),originals)})
                    records.append({"path":str(p.relative_to(root)),"kind":"zip","bytes":len(data),
                        "sha256":hashlib.sha256(data).hexdigest(),"dex_members":inside,
                        "zip_members":len(z.infolist())})
        except Exception as e:
            records.append({"path":str(p.relative_to(root)),"error":str(e)[:250]})
    dexes=[r for r in records if r.get("kind")=="dex"]
    for r in records:
        dexes.extend(r.get("dex_members",[]))
    report={"tool":"AppPealing preserved dump / AppSealing runtime app_payload_lib",
      "analyzer_only":True, "baseline_dex_hashes":len(originals),
      "dex_examined":len(dexes),
      "valid_signature_checksum":sum(x.get("signature_matches") and x.get("checksum_matches") for x in dexes),
      "new_valid_dex":sum(x.get("signature_matches") and x.get("checksum_matches") and not x.get("original_match") for x in dexes),
      "new_valid_ixio_class_defs":sum(x.get("ixio_own_class_defs",0) for x in dexes if x.get("signature_matches") and x.get("checksum_matches") and not x.get("original_match")),
      "records":records}
    pathlib.Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    pathlib.Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k!="records"},ensure_ascii=False))

if __name__=="__main__":
    main()
