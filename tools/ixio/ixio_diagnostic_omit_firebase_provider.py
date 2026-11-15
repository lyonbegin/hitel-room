#!/usr/bin/env python3
"""Diagnostic-only test: temporarily omit FirebaseInitProvider while keeping each APK's DEX untouched.

NOT a production release or functional-equivalent substitute. Used only to
determine whether failures occur before the restored original Application starts.
"""
import argparse,copy,io,pathlib,re,struct,zipfile,hashlib
from ixio_repack_separate import pool_parse
from ixio_dex_exact_reassemble import u16,u32
TARGET="com.google.firebase.provider.FirebaseInitProvider"

def omit_firebase_provider(b):
    if u16(b,0)!=3 or u32(b,4)!=len(b):raise ValueError("invalid binary manifest")
    p=8;chunks=[];pool=[];removed=0;depth=0
    while p<len(b):
        typ,header,size=struct.unpack_from("<HHI",b,p)
        if size<=0 or p+size>len(b):raise ValueError("bad XML chunk")
        ch=b[p:p+size];p+=size
        if typ==1:
            pool=pool_parse(ch)[5]
        if depth:
            if typ==0x102:depth+=1
            elif typ==0x103:depth-=1
            continue
        if typ==0x102 and pool:
            name_idx=u32(ch,20)
            tag=pool[name_idx] if name_idx<len(pool) else ""
            if tag=="provider":
                start,step,count=struct.unpack_from("<HHH",ch,24)
                values={}
                for i in range(count):
                    off=16+start+i*step
                    namekey=u32(ch,off+4)
                    raw_idx=u32(ch,off+8)
                    vtype=ch[off+15]
                    typedidx=u32(ch,off+16)
                    if namekey>=len(pool):continue
                    values[pool[namekey]]=pool[raw_idx] if raw_idx<len(pool) else (pool[typedidx] if vtype==3 and typedidx<len(pool) else "")
                if values.get("name")==TARGET:
                    depth=1;removed+=1
                    continue
        chunks.append(ch)
    if depth or removed!=1:raise ValueError("expected one Firebase provider, got "+str(removed))
    result=bytearray(b[:8]+b"".join(chunks))
    struct.pack_into("<I",result,4,len(result))
    return bytes(result)

def repack(infile,outfile):
    with zipfile.ZipFile(infile) as inp,zipfile.ZipFile(outfile,"w") as out:
        if "AndroidManifest.xml" not in inp.namelist():raise ValueError("missing manifest")
        for info in inp.infolist():
            if re.fullmatch(r"META-INF/.*\.(?:RSA|DSA|EC|SF|MF)",info.filename,re.I):continue
            data=inp.read(info)
            if info.filename=="AndroidManifest.xml":data=omit_firebase_provider(data)
            out.writestr(copy.copy(info),data)
    with zipfile.ZipFile(infile) as inp,zipfile.ZipFile(outfile) as out:
        for name in inp.namelist():
            if name=="AndroidManifest.xml" or re.fullmatch(r"META-INF/.*\.(?:RSA|DSA|EC|SF|MF)",name,re.I):continue
            if inp.read(name)!=out.read(name):raise ValueError("unexpected APK byte change in "+name)
    return hashlib.sha256(pathlib.Path(outfile).read_bytes()).hexdigest()

def main():
    p=argparse.ArgumentParser()
    p.add_argument("original_signed")
    p.add_argument("output_unsigned")
    a=p.parse_args()
    print("DIAGNOSTIC_ONLY_OMIT_FIREBASE_PROVIDER=PASS",repack(a.original_signed,a.output_unsigned))
if __name__=="__main__":main()
