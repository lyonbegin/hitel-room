"""Read-only native locale/voice dispatch trace for official Android AAR.
Find real RIP-relative and AArch64 ADRP+ADD references, not just string presence.
"""
import argparse
import pathlib
import collections
from elftools.elf.elffile import ELFFile
from capstone import *
from capstone.x86 import X86_OP_MEM, X86_REG_RIP
from capstone.arm64 import ARM64_OP_REG, ARM64_OP_IMM

NEEDLES=[b"Unsupported PocketTTS language",b"pocket_tts_weights_",b"sp_tokenizer_",b"ko-KR",b"nl-NL",b"nl-nl",b"fr-FR",b"en-US",b"PocketTTS PKTV voice section",b"pocket_tts_int8.litertlm"]

def main():
    p=argparse.ArgumentParser()
    p.add_argument("elf",type=pathlib.Path);p.add_argument("out",type=pathlib.Path)
    a=p.parse_args()
    with a.elf.open("rb") as f:
        e=ELFFile(f);machine=e.header["e_machine"]
        targets=collections.defaultdict(list)
        for sec in e.iter_sections():
            if not sec["sh_flags"] & 2 or sec["sh_flags"] & 4 or sec["sh_type"]=="SHT_NOBITS": continue
            data=sec.data()
            for needle in NEEDLES:
                start=0
                while True:
                    off=data.find(needle,start)
                    if off<0: break
                    targets[sec["sh_addr"]+off].append(needle.decode())
                    start=off+1
        a.out.parent.mkdir(parents=True,exist_ok=True)
        with a.out.open("w") as out:
            print("MACHINE",machine,"TARGETS",[(hex(k),v) for k,v in sorted(targets.items())],file=out)
            arch,mode=(CS_ARCH_X86,CS_MODE_64) if machine=="EM_X86_64" else (CS_ARCH_ARM64,CS_MODE_ARM)
            md=Cs(arch,mode);md.detail=True;md.skipdata=True
            for sec in e.iter_sections():
                if not sec["sh_flags"] & 4: continue
                base=sec["sh_addr"];data=sec.data();history=collections.deque(maxlen=24);pages={};hits=[]
                for ins in md.disasm(data,base):
                    if not ins.id:
                        history.clear();pages.clear();continue
                    addresses=[]
                    if machine=="EM_X86_64":
                        for op in ins.operands:
                            if op.type==X86_OP_MEM and op.mem.base==X86_REG_RIP:
                                addresses.append(ins.address+ins.size+op.mem.disp)
                    else:
                        ops=ins.operands
                        if ins.mnemonic in ("adrp","adr") and len(ops)==2 and ops[0].type==ARM64_OP_REG and ops[1].type==ARM64_OP_IMM:
                            pages[ops[0].reg]=(ops[1].imm,ins.address)
                            if ins.mnemonic=="adr": addresses.append(ops[1].imm)
                        elif ins.mnemonic=="add" and len(ops)>=3 and ops[0].type==ARM64_OP_REG and ops[1].type==ARM64_OP_REG and ops[2].type==ARM64_OP_IMM:
                            page=pages.get(ops[1].reg)
                            if page and ins.address-page[1]<128:
                                address=page[0]+ops[2].imm
                                addresses.append(address)
                                pages[ops[0].reg]=(address,ins.address)
                    for address in addresses:
                        if address in targets: hits.append((ins.address,address,targets[address]))
                    history.append(ins.address)
                for addr,target,names in hits:
                    print("\nXREF",sec.name,hex(addr),hex(target),names,file=out)
                    lo=max(base,addr-96);hi=min(base+len(data),addr+160)
                    if machine!="EM_X86_64": lo=(lo+3)&~3
                    for i in md.disasm(data[lo-base:hi-base],lo):
                        print(f"{i.address:016x} {i.mnemonic:<8} {i.op_str}",file=out)
                print("XREF_COUNT",sec.name,len(hits),file=out)
if __name__=="__main__":
    main()
