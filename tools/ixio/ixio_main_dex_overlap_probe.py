#!/usr/bin/env python3
"""Index DEX class ownership, detecting collisions caused by adding restored DEX.

Only exposes class identity for selected Android infrastructure and IXIO startup
types; no bytecode or proprietary method source is published.
"""
from __future__ import annotations
from collections import defaultdict,Counter
import argparse, json, struct, zipfile, pathlib, re

def u32(b,at):return struct.unpack_from("<I",b,at)[0]
def read_uleb(b,at):
    x=0
    for i in range(5):
        v=b[at+i]
        x|=(v&0x7f)<<(7*i)
        if not v&0x80:return x,at+i+1
    raise ValueError("invalid ULEB")
def dex_classes(b):
    if b[:4]!=b"dex\n":raise ValueError("Not a dex file")
    if u32(b,0x20)!=len(b):raise ValueError("DEX file size mismatch")
    n_strings=u32(b,0x38); strings_off=u32(b,0x3c)
    n_types=u32(b,0x40); types_off=u32(b,0x44)
    n_classes=u32(b,0x60); classes_off=u32(b,0x64)
    if n_strings>2000000 or n_types>2000000 or n_classes>2000000:raise ValueError("implausible DEX counts")
    def s(idx):
        off=u32(b,strings_off+idx*4)
        _,offset=read_uleb(b,off)
        end=b.index(b"\x00",offset)
        return b[offset:end].decode("utf8",errors="replace")
    def t(idx):return s(u32(b,types_off+idx*4))
    classes=[]
    for i in range(n_classes):
        at=classes_off+i*32
        idx,flags,super_idx=struct.unpack_from("<III",b,at)
        desc=t(idx)
        superclass=t(super_idx) if super_idx!=0xffffffff else None
        classes.append((desc,flags,superclass))
    return classes
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--apk",required=True)
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    owners=defaultdict(list)
    by_dex={}
    targets={}
    with zipfile.ZipFile(a.apk) as z:
        for f in sorted((n for n in z.namelist() if re.fullmatch(r"classes\d*\.dex",n)),
                        key=lambda x:int(x[7:-4]) if x[7:-4] else 1):
            classes=dex_classes(z.read(f))
            by_dex[f]={"classes":len(classes)}
            for desc,flags,superclass in classes:
                owners[desc].append(f)
                if any(x in desc for x in (
                    "com/google/firebase/FirebaseApp",
                    "StringResourceValueReader",
                    "com/lguplus/aicallagent/IXIApplication;",
                    "Hilt_IXIApplication;",
                    "AppSealingApplication;",
                    "FirebaseInitProvider;")):
                    targets[desc]={"owner_dex":owners[desc],"flags_hex":hex(flags),"is_final":bool(flags&0x10),"superclass":superclass}
    collisions={k:v for k,v in owners.items() if len(v)>1}
    # A normal APK with user-provided restored DEX can have duplicated classes.
    # Report only counts, package families and essential framework class names.
    flags=Counter()
    relevant=[]
    for cls,files in collisions.items():
        if cls.startswith(("Lcom/google/firebase/","Lcom/google/android/gms/")):
            flags["firebase_or_gms"]+=1;relevant.append({"class":cls,"owners":files})
        elif cls.startswith("Lcom/lguplus/"):
            flags["ixio"]+=1
        elif cls.startswith("Landroidx/"):
            flags["androidx"]+=1
        else:flags["other"]+=1
    report={
      "dex_inventory":by_dex,
      "total_class_definitions":sum(x["classes"] for x in by_dex.values()),
      "total_unique_types":len(owners),
      "duplicate_class_descriptor_count":len(collisions),
      "duplicate_class_packages":dict(flags),
      "google_firebase_gms_conflicts":relevant[:80],
      "startup_class_owners_and_base_types":targets,
      "assessment":"Duplicate class names may cause lookup differences; this does not by itself prove Firebase crash causation."
    }
    pathlib.Path(a.out).parent.mkdir(parents=True,exist_ok=True)
    pathlib.Path(a.out).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
    print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main()
