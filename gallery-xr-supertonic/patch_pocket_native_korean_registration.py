"""Experimental minimal registration-only extension of pinned Android MediaPipe 1.2.0.
No inference functions, existing language entries, or original voice mappings are replaced.
The three original unknown-language/voice fallbacks receive Korean-only branches.
Use only after runtime regression and intelligibility tests pass.
"""
import argparse, hashlib, pathlib, struct, zipfile, io
from keystone import Ks, KS_ARCH_ARM64, KS_ARCH_X86, KS_MODE_LITTLE_ENDIAN, KS_MODE_64
from elftools.elf.elffile import ELFFile

SPECS = {
    "arm64-v8a": ("8ddf00aeb13ce1d71a73875c2245d4e57138f27a7e1db5fcf9fb56ccfad6a0de", KS_ARCH_ARM64, KS_MODE_LITTLE_ENDIAN),
    "x86_64": ("dc7fada82d500a9944fe96a3f1b59bf089f80c0b8f63a8d69e8e12f37a38e061", KS_ARCH_X86, KS_MODE_64),
}

def patch_native(raw, arch):
    digest, ka, mode = SPECS[arch]
    assert hashlib.sha256(raw).hexdigest() == digest, "Unexpected native SDK binary"
    elf = ELFFile(io.BytesIO(raw))
    loads = [(i,s) for i,s in enumerate(elf.iter_segments()) if s['p_type']=='PT_LOAD']
    index, rx = loads[0]
    assert rx['p_offset']==rx['p_vaddr']==0 and rx['p_flags']==5
    end = rx['p_filesz']
    limit = loads[1][1]['p_offset']
    cave = (end+15)&~15
    assert limit-cave>=512 and not any(raw[end:limit]), "Nonempty or insufficient RX segment padding"
    data = bytearray(raw)
    ks=Ks(ka,mode)
    def asm(addr, code): return bytes(ks.asm(code,addr)[0])
    def place(addr, code):
        b=asm(addr,code)
        assert addr+len(b)<=limit
        data[addr:addr+len(b)]=b
        return len(b)
    # Fixed disjoint locations in linker alignment padding.
    m,n,v=cave,cave+128,cave+256
    strings=cave+384
    ko,lower,upper,voice=strings,strings+8,strings+16,strings+24
    for addr,s in [(ko,b"ko\0"),(lower,b"ko-kr\0"),(upper,b"ko-KR\0"),(voice,b"ko_hitel\0")]:
        data[addr:addr+len(s)]=s
    if arch=="arm64-v8a":
        # Known map lookup misses only; copy the normalized ko string using
        # the exact original success constructor and original cleanup path.
        place(m,f"""
            adr x1, {ko:#x}
            add x0, sp, #0x28
            bl 0x56aa94
            tbz w0, #0, other
            mov x0, x19
            add x1, sp, #0x28
            bl 0x56b248
            b 0xace910
        other:
            adrp x0, 0x75000
            b 0xace8b8
        """)
        place(n,f"""
            adr x1, {ko:#x}
            bl 0xabd24c
            tbnz w0, #0, matched
            adr x1, {lower:#x}
            bl 0xabd24c
            tbz w0, #0, other
        matched:
            adr x1, {upper:#x}
            b 0xaceb30
        other:
            adrp x1, 0x51000
            b 0xacec54
        """)
        place(v,f"""
            add x0, sp, #0x18
            adr x1, {voice:#x}
            bl 0x56aa94
            tbz w0, #0, other
            adr x1, {ko:#x}
            b 0xacee5c
        other:
            adrp x1, 0x51000
            b 0xacee58
        """)
        for addr,target in [(0xace8b4,m),(0xacec50,n),(0xacee54,v)]:
            b=asm(addr,f"b {target:#x}"); assert len(b)==4; data[addr:addr+4]=b
    else:
        # Preserve the original unknown-error and empty-locale fallbacks.
        def lea(reg,addr):
            return f"lea {reg}, [rip + {addr:#x}]"
        # Keystone does not resolve symbolic RIP-relative external addresses
        # in inline assembly. Use absolute image-relative addresses with
        # labels converted to RIP displacement by emitting LEA separately.
        def build(addr, ops):
            out=bytearray(); labels={}; fix=[]
            for op in ops:
                at=addr+len(out)
                if isinstance(op,tuple):
                    reg,target=op
                    if reg=="label":
                        labels[target]=at;continue
                    if reg=="jz" or reg=="jnz":
                        fix.append((len(out),reg,target));out+=b"\x0f"+(b"\x84" if reg=="jz" else b"\x85")+b"\0"*4;continue
                    probe=asm(at,f"lea {reg}, [rip + 0]")
                    out+=asm(at,f"lea {reg}, [rip + {target-at-len(probe)}]")
                else: out+=asm(at,op)
            for pos,reg,label in fix:
                struct.pack_into("<i",out,pos+2,labels[label]-(addr+pos+6))
            assert len(out)<128
            data[addr:addr+len(out)]=out
        build(m,["lea rdi, [rsp+0x20]",("rsi",ko),"call 0x5b2c3e","test al, al",("jz","other"),"mov rdi, rbx","lea rsi, [rsp+0x20]","call 0x5b341a","jmp 0xc120c2",("label","other"),("rdi",0x758be),"jmp 0xc1204b"])
        build(n,[("rsi",ko),"lea rdi, [rsp+0x10]","call 0x5b2c3e","test al, al",("jnz","matched"),("rsi",lower),"lea rdi, [rsp+0x10]","call 0x5b2c3e","test al, al",("jz","other"),("label","matched"),("rsi",upper),"jmp 0xc12322",("label","other"),("rsi",0x51642),"jmp 0xc12322"])
        build(v,[("rsi",voice),"mov rdi, rsp","call 0x5b2c3e","test al, al",("jz","other"),("rsi",ko),"jmp 0xc1273e",("label","other"),("rsi",0x51642),"jmp 0xc1273e"])
        for addr,target in [(0xc12044,m),(0xc12485,n),(0xc12737,v)]:
            b=asm(addr,f"jmp {target:#x}"); assert len(b)==5; data[addr:addr+7]=b+b"\x90\x90"
    # Extend the original RX PT_LOAD into existing file padding only;
    # all original virtual addresses, section offsets and relocations stay put.
    new_end=strings+64
    assert new_end<=limit
    ph=elf.header['e_phoff']+index*elf.header['e_phentsize']
    struct.pack_into("<QQ",data,ph+32,new_end,new_end)
    print("NATIVE_REGISTRATION_PATCH",arch,"old",digest,"new",hashlib.sha256(data).hexdigest(),"rx",hex(end),hex(new_end))
    return bytes(data)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("input",type=pathlib.Path);p.add_argument("output",type=pathlib.Path)
    args=p.parse_args()
    with zipfile.ZipFile(args.input) as source,zipfile.ZipFile(args.output,"w") as dest:
        for info in source.infolist():
            raw=source.read(info)
            for arch in SPECS:
                if info.filename==f"jni/{arch}/libmediapipe_tasks_audio_jni.so":
                    raw=patch_native(raw,arch)
            dest.writestr(info,raw)
if __name__=="__main__":main()
