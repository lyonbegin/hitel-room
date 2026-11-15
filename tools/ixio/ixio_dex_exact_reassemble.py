#!/usr/bin/env python3
"""Losslessly split real DEX code_items and non-code spans; assemble from independent streams."""
import hashlib
import json
import struct
import zlib

u16=lambda b,p:struct.unpack_from("<H",b,p)[0]
u32=lambda b,p:struct.unpack_from("<I",b,p)[0]
sha=lambda b:hashlib.sha256(b).hexdigest()

def uleb(b,p):
    a=0
    for sh in (0,7,14,21,28):
        if p>=len(b):raise ValueError("ULEB out of bounds")
        v=b[p];p+=1;a|=(v&127)<<sh
        if v<128:return a,p
    raise ValueError("ULEB overflow")
def sleb(b,p):
    a=0;sh=0
    for _ in range(5):
        if p>=len(b):raise ValueError("SLEB out of bounds")
        v=b[p];p+=1;a|=(v&127)<<sh;sh+=7
        if v<128:
            if sh<32 and v&64:a-=1<<sh
            return a,p
    raise ValueError("SLEB overflow")
def validate(b):
    if len(b)<112 or b[:4]!=b"dex\n" or b[7]!=0:raise ValueError("Not a complete DEX")
    if u32(b,32)!=len(b):raise ValueError("DEX file_size mismatch")
    if b[12:32]!=hashlib.sha1(b[32:]).digest():raise ValueError("DEX SHA1 invalid")
    if u32(b,8)!=(zlib.adler32(b[12:])&0xffffffff):raise ValueError("DEX Adler32 invalid")
def method_ranges(b):
    nc,co=u32(b,96),u32(b,100);nm=u32(b,88)
    offsets={}
    for ci in range(nc):
        d=u32(b,co+ci*32+24)
        if not d:continue
        p=d;counts=[]
        for _ in range(4):
            n,p=uleb(b,p);counts.append(n)
        for n in counts[:2]:
            for _ in range(n):_,p=uleb(b,p);_,p=uleb(b,p)
        for n in counts[2:]:
            mid=0
            for _ in range(n):
                diff,p=uleb(b,p);mid+=diff
                _,p=uleb(b,p)
                off,p=uleb(b,p)
                if off:
                    if mid>=nm:raise ValueError("bad method id")
                    offsets.setdefault(off,[]).append(mid)
    ranges=[]
    for off, mids in sorted(offsets.items()):
        if off+16>len(b):raise ValueError("bad code offset")
        ct=u16(b,off+6);insn=u32(b,off+12);end=off+16+insn*2
        if ct:
            if insn%2:end+=2
            end+=ct*8
            handlers,end=uleb(b,end)
            if handlers>10000:raise ValueError("unreasonable handlers")
            for _ in range(handlers):
                n,end=sleb(b,end)
                if abs(n)>10000:raise ValueError("unreasonable catch size")
                for _ in range(abs(n)):
                    _,end=uleb(b,end);_,end=uleb(b,end)
                if n<=0:_,end=uleb(b,end)
        if end>len(b):raise ValueError("code item beyond file")
        ranges.append((off,end,mids))
    for a,bnext in zip(ranges,ranges[1:]):
        if a[1]>bnext[0]:raise ValueError("overlapping method code items")
    return ranges
def exact_roundtrip(data,label):
    validate(data);ranges=method_ranges(data)
    method_data=bytearray();gap_data=bytearray();segments=[];methods=[];cursor=0
    for off,end,mids in ranges:
        if off>cursor:
            start=len(gap_data);gap_data.extend(data[cursor:off])
            segments.append(("gap",start,off-cursor))
        chunk=data[off:end];start=len(method_data);method_data.extend(chunk)
        segments.append(("code",start,len(chunk)))
        methods.append({"offset":off,"size":len(chunk),"method_ids":mids,"sha256":sha(chunk)})
        cursor=end
    if cursor<len(data):
        start=len(gap_data);gap_data.extend(data[cursor:])
        segments.append(("gap",start,len(data)-cursor))
    rebuilt=b"".join((method_data if k=="code" else gap_data)[off:off+n] for k,off,n in segments)
    if rebuilt!=data or sha(rebuilt)!=sha(data):raise ValueError("Byte-identical roundtrip failed")
    return rebuilt,{"label":label,"bytes":len(data),"sha256":sha(data),"method_code_items":len(ranges),
            "method_code_bytes":len(method_data),"noncode_bytes":len(gap_data),
            "method_reference_count":sum(len(r[2]) for r in ranges),
            "classes":u32(data,96),"code_item_index":methods,
            "segment_index":segments,"byte_identical":True}
