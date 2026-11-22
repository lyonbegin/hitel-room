#!/usr/bin/env python3
"""Essence2 0.9.5 ARM64: conservative spatial tiling experiment, no model changes."""
import hashlib, json, struct, sys
from pathlib import Path
from zipfile import ZipFile

MEMBER = "jni/arm64-v8a/lible_jni.so"
BASE = "3eed089467f5ffeab88715c0d126f09e87734e84190e6e4899494db6b67657cf"
PATCHES = [
    (0x215f44, 0x5280010b, 0x5280002b, "mov w11,#8 -> #1 (fast local Y)"),
    (0x215f88, 0x52800117, 0x52800037, "mov w23,#8 -> #1 (legacy local Y)"),
]
def sha(b): return hashlib.sha256(b).hexdigest()
def validate_coverage():
    # Embedded kernels use global x/y, local z for channel groups;
    # local scratch weights loaded by linear local id with stride local volume.
    for height,width,n,z,rows in ((64,88,1,4,1),(64,88,3,4,1),(64,88,3,2,1),(64,88,3,1,2)):
        gx=(width+3)//4
        gy=((height+rows*8-1)//(rows*8))*8
        gz=n*z
        global_work=(gx,gy,gz)
        old_local=(gx,8,z)
        new_local=(gx,1,z)
        assert gx*z<=128
        for loc in (old_local,new_local):
            assert all(g%l==0 for g,l in zip(global_work,loc))
        def cover(l):
            points=set()
            for x in range(gx):
                for y in range(gy):
                    for k in range(gz):
                        for ry in range(rows):
                            if y*rows+ry<height:
                                points.add((x,y*rows+ry,k//z,k%l[2]))
            return points
        assert cover(old_local)==cover(new_local)
        assert len(cover(new_local))==gx*height*n*z
        for loc in (old_local,new_local):
            size=loc[0]*loc[1]*loc[2]
            for nw in (9*7*16,9*16*16,9*16):
                assert sorted(i for t in range(size) for i in range(t,nw,size))==list(range(nw))
def patch(b):
    assert sha(b)==BASE, "Unexpected vendor native binary; do not patch"
    assert b[:6]==b"\x7fELF\x02\x01" and struct.unpack_from("<H",b,18)[0]==183
    result=bytearray(b)
    phoff=struct.unpack_from("<Q",b,32)[0]
    entsize,phnum=struct.unpack_from("<HH",b,54)
    for addr,old,new,_ in PATCHES:
        matches=[]
        for i in range(phnum):
            ptype,flags,off,va,pa,filesz,memsz,align=struct.unpack_from("<IIQQQQQQ",b,phoff+i*entsize)
            if ptype==1 and flags&1 and va<=addr and addr+4<=va+filesz:
                matches.append(off+addr-va)
        assert matches==[addr]
        assert struct.unpack_from("<I",b,addr)[0]==old
        struct.pack_into("<I",result,addr,new)
    restored=bytearray(result)
    for addr,old,new,_ in PATCHES:
        struct.pack_into("<I",restored,addr,old)
    assert restored==b
    return bytes(result)
if __name__=="__main__":
    validate_coverage()
    src,dst=map(Path,sys.argv[1:3])
    with ZipFile(src) as zin, ZipFile(dst,"w") as zout:
        original=zin.read(MEMBER)
        fixed=patch(original)
        for member in zin.infolist():
            zout.writestr(member, fixed if member.filename==MEMBER else zin.read(member))
    with ZipFile(src) as zin,ZipFile(dst) as zout:
        assert zin.namelist()==zout.namelist()
        assert all(zin.read(n)==zout.read(n) for n in zin.namelist() if n!=MEMBER)
        assert zout.read(MEMBER)==fixed
    print(json.dumps({"status":"PASS_ADRENO_LOCAL_Y_PATCH_GEOMETRY_TESTS","source_sha256":sha(original),"patched_sha256":sha(fixed),"instruction_changes":[{"address":hex(a),"old":hex(o),"new":hex(n),"meaning":s} for a,o,n,s in PATCHES],"scope":"global dimensions and channel groups unchanged; structural coverage test, not GPU runtime numerical validation"},indent=2))
