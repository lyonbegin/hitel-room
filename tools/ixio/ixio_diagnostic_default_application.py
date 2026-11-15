#!/usr/bin/env python3
"""Diagnostic only: replace the Manifest Application string with framework default.

This makes no DEX, native, or resource-table changes and deliberately disables
the original Application.onCreate path. Only validates framework provider setup.
"""
import argparse,copy,hashlib,pathlib,re,struct,zipfile
import ixio_repack_separate as rep
from ixio_dex_exact_reassemble import u16,u32

APPS={
 "main":"com.lguplus.aicallagent.IXIApplication",
 "recorder":"com.lguplus.callrecorder.IXIcallrecorderApplication",
}

def replace_manifest_string_pool(chunk,indices,replacement):
    header,flags,start,style_start,offsets,strings,ends=rep.pool_parse(chunk)
    if flags & 256:
        value=rep.elen8(len(replacement))+rep.elen8(len(replacement.encode()))+replacement.encode()+b"\0"
    else:
        value=rep.elen16(len(replacement))+replacement.encode("utf-16le")+b"\0\0"
    tail=style_start or len(chunk)
    raw=chunk[start:tail]
    # A target class name can already occur twice in the original string pool.
    # Replace from higher byte offsets to lower ones to preserve original ranges.
    for index in sorted(indices,key=lambda i:offsets[i],reverse=True):
        begin,end=offsets[index],ends[index]
        raw=raw[:begin]+value+raw[end:]
        delta=len(value)-(end-begin)
        offsets=[v+delta if v>=end else v for v in offsets]
    raw+=b"\\0"*((-len(raw))%4)
    new_style=start+len(raw) if style_start else 0
    head=bytearray(chunk[:start])
    for i,v in enumerate(offsets):
        struct.pack_into("<I",head,header+i*4,v)
    struct.pack_into("<I",head,24,new_style)
    new=bytes(head)+raw+(chunk[style_start:] if style_start else b"")
    struct.pack_into("<I",head,4,len(new))
    new=bytes(head)+raw+(chunk[style_start:] if style_start else b"")
    result_strings=rep.pool_parse(new)[5]
    if any(result_strings[i]!=replacement for i in indices):
        raise ValueError("Application string patch verification failed")
    if any(a!=b for i,(a,b) in enumerate(zip(result_strings,strings)) if i not in indices):
        raise ValueError("Non-target manifest string modified")
    return new

def patch_axml(blob,group):
    if u16(blob,0)!=3 or u32(blob,4)!=len(blob):raise ValueError("Invalid AXML")
    p=8;blocks=[];changed=0
    rep.ORIGINAL_APPLICATION=APPS[group]
    while p<len(blob):
        ty,head,size=struct.unpack_from("<HHI",blob,p)
        if not size or p+size>len(blob):raise ValueError("Invalid chunk")
        ch=blob[p:p+size];p+=size
        if ty==1:
            all_strings=rep.pool_parse(ch)[5]
            matches=[i for i,s in enumerate(all_strings) if s==APPS[group]]
            if matches:
                ch=replace_manifest_string_pool(ch,matches,"android.app.Application")
                changed+=1
        blocks.append(ch)
    if changed!=1:raise ValueError("Expected a single binary XML string pool")
    ret=bytearray(blob[:8]+b"".join(blocks))
    struct.pack_into("<I",ret,4,len(ret))
    return bytes(ret)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("group",choices=APPS)
    parser.add_argument("input_apk")
    parser.add_argument("output_unsigned_apk")
    args=parser.parse_args()
    with zipfile.ZipFile(args.input_apk) as src,zipfile.ZipFile(args.output_unsigned_apk,"w") as out:
        for item in src.infolist():
            if re.fullmatch(r"META-INF/.*\.(?:RSA|EC|DSA|SF|MF)",item.filename,re.I):continue
            data=src.read(item)
            if item.filename=="AndroidManifest.xml":
                data=patch_axml(data,args.group)
            out.writestr(copy.copy(item),data)
    with zipfile.ZipFile(args.input_apk) as src,zipfile.ZipFile(args.output_unsigned_apk) as out:
        for n in out.namelist():
            if n!="AndroidManifest.xml" and src.read(n)!=out.read(n):
                raise ValueError("Unexpected source data changed: "+n)
    print("DIAGNOSTIC_FRAMEWORK_APPLICATION=PASS",args.group)
if __name__=="__main__":main()
