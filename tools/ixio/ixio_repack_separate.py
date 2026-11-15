#!/usr/bin/env python3
"""Per-app IXIO APK package reconstruction, using exact runtime DEX and original APK resources.

Does not transcompile Dalvik code or modify native libraries.
The two original package names, services, permissions, and independent app identities remain.
"""
import argparse
import copy
import gzip
import hashlib
import io
import json
import pathlib
import re
import struct
import zipfile
from ixio_dex_exact_reassemble import exact_roundtrip,sha,u16,u32

ORIGINAL_APPLICATION="com.inka.appsealing.AppSealingApplication"
TARGETS={
 "main":("com.lguplus.aicallagent.IXIApplication",{
  "e87946208b78fcf8f90303235edb3aa32818ae15adb2c1683733bc42e09aaf36":"classes15.dex",
  "f2879f47177c29a7573317e2c41af60319091d553641ee6bcc5aaabe3aa31970":"classes16.dex",
  "78e41a73d0351f927e42af7ffef5ca9c7684b4b8136b8768d16b5f49f70877cc":"classes17.dex",
  "2cf7258dd1f5baa08898477dde3f05d0defb41231fc8ddda5567515325131805":"classes18.dex",
 }),
 "recorder":("com.lguplus.callrecorder.IXIcallrecorderApplication",{
  "bbeec40b906d15bb230cd689d69c93d4ee33249937f5df4b5d860dd8188f5e2c":"classes6.dex",
 })
}
APK_HASHES={"xapk":"4ec4793327930e72589c1d47e552e1e77f97ccf77db71c63c701934f2337a3fc",
            "recorder":"3cf822dda33eeef28ec3b85cb5872182371c92d07ed100e3a0fab71fbf1a37d7"}
def dlen8(b,p):
 v=b[p];p+=1
 if v&128:return ((v&127)<<8)|b[p],p+1
 return v,p
def elen8(n):
 return bytes([0x80|(n>>8),n&255]) if n>127 else bytes([n])
def dlen16(b,p):
 v=u16(b,p);p+=2
 if v&0x8000:return ((v&0x7fff)<<16)|u16(b,p),p+2
 return v,p
def elen16(n):
 return struct.pack("<HH",0x8000|(n>>16),n&65535) if n>32767 else struct.pack("<H",n)
def pool_parse(chunk):
 typ,header,size=struct.unpack_from("<HHI",chunk)
 if typ!=1 or len(chunk)!=size:raise ValueError("Bad Android XML string pool")
 count,styles,flags,start,style_start=struct.unpack_from("<IIIII",chunk,8)
 offsets=[u32(chunk,header+4*i) for i in range(count)]
 strings=[];ends=[]
 for off in offsets:
  p=start+off
  if flags&256:
   _,p=dlen8(chunk,p);n,p=dlen8(chunk,p)
   strings.append(chunk[p:p+n].decode("utf8"));ends.append(p+n+1-start)
  else:
   n,p=dlen16(chunk,p)
   strings.append(chunk[p:p+n*2].decode("utf-16le"));ends.append(p+n*2+2-start)
 return header,flags,start,style_start,offsets,strings,ends
def patch_pool(chunk,new_app):
 header,flags,start,style_start,offsets,strings,ends=pool_parse(chunk)
 oldids=[i for i,x in enumerate(strings) if x==ORIGINAL_APPLICATION]
 if len(oldids)!=1:raise ValueError("AppSealing Application not in manifest string pool")
 idx=oldids[0];s=offsets[idx];e=ends[idx]
 if flags&256:
  val=elen8(len(new_app))+elen8(len(new_app.encode()))+new_app.encode()+b"\0"
 else:val=elen16(len(new_app))+new_app.encode("utf-16le")+b"\0\0"
 tail=style_start or len(chunk)
 raw=chunk[start:tail]
 raw=raw[:s]+val+raw[e:]
 delta=len(val)-(e-s)
 offsets=[v+delta if v>=e else v for v in offsets]
 raw+=b"\0"*((-len(raw))%4)
 new_style=start+len(raw) if style_start else 0
 headerbuf=bytearray(chunk[:start])
 for i,v in enumerate(offsets):struct.pack_into("<I",headerbuf,header+4*i,v)
 struct.pack_into("<I",headerbuf,24,new_style)
 updated=bytes(headerbuf)+raw+(chunk[style_start:] if style_start else b"")
 struct.pack_into("<I",headerbuf,4,len(updated))
 updated=bytes(headerbuf)+raw+(chunk[style_start:] if style_start else b"")
 after=pool_parse(updated)[5]
 if after[idx]!=new_app or any(a!=b for i,(a,b) in enumerate(zip(after,strings)) if i!=idx):
  raise ValueError("Unintended binary XML string changes")
 return updated,after
def patch_manifest(b,new_app):
 if u16(b,0)!=3 or u32(b,4)!=len(b):raise ValueError("Not valid Android binary manifest")
 p=8;chunks=[];pool=[];found_app=False;removed_zygote=False
 while p<len(b):
  typ,header,size=struct.unpack_from("<HHI",b,p)
  if not size or p+size>len(b):raise ValueError("Bad XML chunk")
  ch=b[p:p+size];p+=size
  if typ==1:ch,pool=patch_pool(ch,new_app)
  elif typ==0x102 and pool:
   tag=pool[u32(ch,20)]
   if tag=="application":
    found_app=True
    attr_start,attr_size,attr_count=struct.unpack_from("<HHH",ch,24)
    for n in range(attr_count):
     off=16+attr_start+n*attr_size
     name_idx=u32(ch,off+4)
     if pool[name_idx]=="zygotePreloadName":
      ch=bytearray(ch);del ch[off:off+attr_size]
      struct.pack_into("<I",ch,4,len(ch))
      struct.pack_into("<H",ch,28,attr_count-1)
      for a in (30,32,34):
       v=u16(ch,a)
       if v==n+1:struct.pack_into("<H",ch,a,0)
       elif v>n+1:struct.pack_into("<H",ch,a,v-1)
      ch=bytes(ch);removed_zygote=True;break
  chunks.append(ch)
 if not found_app or not removed_zygote:raise ValueError("Cannot restore Application and remove AppSealing Zygote")
 out=bytearray(b[:8]+b"".join(chunks))
 struct.pack_into("<I",out,4,len(out))
 return bytes(out)
def is_sig(n):
 return bool(re.fullmatch(r"META-INF/.*\.(?:RSA|EC|DSA|SF|MF)",n,re.I))
def repack_apk(raw,package,files,out):
 app,_=TARGETS[package]
 with zipfile.ZipFile(io.BytesIO(raw)) as zin:
  allnames=zin.namelist();existing=set(allnames)
  if any(n in existing for n in files):raise ValueError("Restored DEX name already exists")
  with zipfile.ZipFile(out,"w") as zout:
   for info in zin.infolist():
    if is_sig(info.filename):continue
    data=zin.read(info)
    if info.filename=="AndroidManifest.xml":data=patch_manifest(data,app)
    zout.writestr(copy.copy(info),data)
   for n,d in files.items():
    item=zipfile.ZipInfo(n)
    item.compress_type=zipfile.ZIP_STORED
    item.external_attr=0o644<<16
    zout.writestr(item,d)
  with zipfile.ZipFile(out) as rebuilt:
   modified=[]
   for name in allnames:
    if is_sig(name):continue
    if name!="AndroidManifest.xml" and zin.read(name)!=rebuilt.read(name):
     modified.append(name)
   if modified:raise ValueError("Original unchanged entries modified: "+repr(modified[:5]))
   if any(rebuilt.read(n)!=d for n,d in files.items()):raise ValueError("DEX insertion mismatch")
   native=sum(1 for n in allnames if n.startswith("lib/"))
   return {"source_apk_entries":len(allnames),"preserved_native_entries":native,
      "native_file_content_modified":0,"original_nonmanifest_content_modified":0,
      "protected_application_name_removed":True,"zygote_preload_removed":True,
      "restored_dex_names":list(files),"unsigned_sha256":sha(out.read_bytes()),"unsigned_bytes":out.stat().st_size}
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--xapk",required=True,type=pathlib.Path)
 p.add_argument("--recorder",required=True,type=pathlib.Path)
 p.add_argument("--restored-dir",required=True,type=pathlib.Path)
 p.add_argument("--out",required=True,type=pathlib.Path)
 a=p.parse_args()
 for key,path in (("xapk",a.xapk),("recorder",a.recorder)):
  if sha(path.read_bytes())!=APK_HASHES[key]:raise ValueError("Original "+key+" SHA mismatch")
 a.out.mkdir(parents=True,exist_ok=True)
 groups={};details=[]
 for pkg,(app,known) in TARGETS.items():
  candidate_dir=a.restored_dir/pkg
  candidates=list(candidate_dir.rglob("*.dex"))
  hashes={}
  for path in candidates:
   b=path.read_bytes();digest=sha(b)
   if digest in known:hashes[digest]=b
  missing=set(known)-set(hashes)
  if missing:raise ValueError(f"{pkg} missing original restored DEX hashes: {sorted(missing)}")
  groups[pkg]={}
  for digest,name in known.items():
   original=hashes[digest]
   restored,report=exact_roundtrip(original,name)
   groups[pkg][name]=restored
   report.pop("code_item_index",None)
   report.pop("segment_index",None)
   details.append(report)
 xapk=zipfile.ZipFile(a.xapk)
 outmain=a.out/"main";outrec=a.out/"recorder"
 outmain.mkdir(exist_ok=True);outrec.mkdir(exist_ok=True)
 checkmain=repack_apk(xapk.read("base.apk"),"main",groups["main"],outmain/"base-unsigned.apk")
 splitnames=sorted(n for n in xapk.namelist() if re.fullmatch(r"split_\d+\.apk",n))
 for n in splitnames:(outmain/n).write_bytes(xapk.read(n))
 checkrec=repack_apk(a.recorder.read_bytes(),"recorder",groups["recorder"],outrec/"recorder-unsigned.apk")
 final={"total_method_code_items":sum(x["method_code_items"] for x in details),
   "all_restored_dex_roundtrip_identical":all(x["byte_identical"] for x in details),
   "restored_dex_reports":details,
   "main":{"package":"com.lguplus.aicallagent","split_apks":splitnames,**checkmain},
   "recorder":{"package":"com.lguplus.callrecorder",**checkrec},
   "notes":["Original all non-manifest APK ZIP entries preserved byte-for-byte.",
     "Runtime-loaded restored DEX were split by method code_item and rebuilt with all opaque byte gaps.",
     "Original APK protection wrapper no longer selected as Application.",
     "No login, carrier, device permission, or complete feature behavior is validated by packaging alone."]}
 (a.out/"reassembly-report.json").write_text(json.dumps(final,ensure_ascii=False,indent=2))
 print(json.dumps({"DEX_SPLIT_REASSEMBLY_METHOD_ITEMS":final["total_method_code_items"],
    "MAIN_ADDED":list(groups["main"]),"RECORDER_ADDED":list(groups["recorder"]),
    "ALL_REBUILT_DEX_IDENTICAL":final["all_restored_dex_roundtrip_identical"]},ensure_ascii=False))
if __name__=="__main__":main()
