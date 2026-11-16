#!/usr/bin/env python3
"""Diagnostic only: replace FirebaseInitProvider manifest target with context-safe
provider, add one new DEX. Keep IXIApplication, all original Firebase classes,
and all original resource/native bytes.
"""
from __future__ import annotations
import argparse,copy,hashlib,json,pathlib,re,struct,zipfile
import ixio_repack_separate as rep
from ixio_diagnostic_default_application import replace_manifest_string_pool
from ixio_dex_exact_reassemble import u16,u32

ORIGINAL="com.google.firebase.provider.FirebaseInitProvider"
BRIDGE="com.hitel.ixio.bootstrap.FirebaseContextBridgeProvider"
def patch_axml(blob):
    if u16(blob,0)!=3 or u32(blob,4)!=len(blob):raise ValueError("Not a valid Android binary manifest")
    chunks=[];at=8;changes=0
    while at<len(blob):
        typ,header,size=struct.unpack_from("<HHI",blob,at)
        if not size or at+size>len(blob):raise ValueError("invalid Android XML chunk")
        b=blob[at:at+size]
        if typ==1:
            names=rep.pool_parse(b)[5]
            matches=[i for i,n in enumerate(names) if n==ORIGINAL]
            if matches:
                b=replace_manifest_string_pool(b,matches,BRIDGE)
                changes+=len(matches)
        chunks.append(b);at+=size
    if changes!=1:raise ValueError(f"expected one Firebase provider class string, got {changes}")
    out=bytearray(blob[:8]+b"".join(chunks))
    struct.pack_into("<I",out,4,len(out))
    return bytes(out)

def build(input_apk,new_dex,output_apk):
    seen=set()
    with zipfile.ZipFile(input_apk) as z,zipfile.ZipFile(output_apk,"w") as out:
        if "classes19.dex" in z.namelist():raise ValueError("classes19.dex already exists")
        if "AndroidManifest.xml" not in z.namelist():raise ValueError("AndroidManifest.xml not found")
        for info in z.infolist():
            if re.fullmatch(r"META-INF/.*\.(?:RSA|EC|DSA|SF|MF)",info.filename,re.I):continue
            b=z.read(info)
            if info.filename=="AndroidManifest.xml":b=patch_axml(b)
            out.writestr(copy.copy(info),b)
            seen.add(info.filename)
        added=zipfile.ZipInfo("classes19.dex")
        added.compress_type=zipfile.ZIP_STORED
        added.external_attr=(0o644<<16)
        out.writestr(added,pathlib.Path(new_dex).read_bytes())
    with zipfile.ZipFile(input_apk) as source,zipfile.ZipFile(output_apk) as rebuilt:
        for n in seen:
            if n!="AndroidManifest.xml" and source.read(n)!=rebuilt.read(n):
                raise ValueError(f"changed original vendor entry {n}")
        assert rebuilt.read("classes19.dex")==pathlib.Path(new_dex).read_bytes()
    return {"original_base":str(input_apk),"patched_manifest_provider":BRIDGE,
            "new_dex":"classes19.dex","unchanged_original_entries":len(seen)-1,
            "firebase_provider_manifest_present":True,
            "ixio_application_manifest_untouched":True,
            "unsigned_sha256":hashlib.sha256(pathlib.Path(output_apk).read_bytes()).hexdigest()}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--original-base",type=pathlib.Path,required=True)
    p.add_argument("--bridge-dex",type=pathlib.Path,required=True)
    p.add_argument("--output-base",type=pathlib.Path,required=True)
    p.add_argument("--report",type=pathlib.Path,required=True)
    a=p.parse_args()
    a.output_base.parent.mkdir(parents=True,exist_ok=True)
    report=build(a.original_base,a.bridge_dex,a.output_base)
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main()
