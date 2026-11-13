#!/usr/bin/env python3
"""Read-only ARM64 ELF analysis: LIEF loader, Capstone instruction details,
and authoritative EH-frame FDE coverage. Never rewrites vendor instructions.
Only structural summaries, not vendor code or model bytes, are exported.
"""
import argparse,collections,csv,hashlib,json
from pathlib import Path

import lief
from capstone import Cs, CS_ARCH_ARM64, CS_MODE_LITTLE_ENDIAN, CS_GRP_CALL, CS_GRP_JUMP, CS_GRP_RET
from capstone.arm64 import ARM64_OP_MEM,ARM64_OP_IMM
from elftools.elf.elffile import ELFFile
from elftools.dwarf.callframe import FDE

SO_SHA="ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c"
KEYS={0x1a7fbc:"feed",0x1a80dc:"scheduler",0x1a8500:"assemble_window",
      0x1a9794:"preprocess",0x1a7a04:"stage_frames",0x1aa40c:"pop_frames",
      0x1a7db0:"canon",0x1a8404:"pump",0x1a8230:"tail"}
def digest(x):return hashlib.sha256(x).hexdigest()
def ok(x):return "0x%x"%x
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--elf",type=Path,required=True)
    ap.add_argument("--out",type=Path,required=True)
    a=ap.parse_args()
    src=a.elf.read_bytes()
    if digest(src)!=SO_SHA:raise RuntimeError("ORIGINAL_BINARY_HASH_MISMATCH")
    a.out.mkdir(parents=True,exist_ok=True)
    lief_obj=lief.ELF.parse(str(a.elf))
    if not lief_obj:raise RuntimeError("LIEF_CANNOT_PARSE_ARM64_ELF")
    segs=list(lief_obj.segments)
    secs=list(lief_obj.sections)
    raw_relocs=list(lief_obj.relocations)
    dl=list(lief_obj.dynamic_relocations)
    pl=list(lief_obj.pltgot_relocations)
    symbols=list(lief_obj.dynamic_symbols)
    result_lief={
      "tool":"LIEF","version":getattr(lief,"__version__","unknown"),
      "original_sha256":digest(src),
      "segments":len(segs),"sections":len(secs),
      "relocations_all":len(raw_relocs),
      "relocations_dynamic":len(dl),"relocations_plt_got":len(pl),
      "dynamic_symbols":len(symbols),
      "dynamic_needed":[str(z) for z in lief_obj.libraries],
      "sections_by_name":[{"name":s.name,"va":ok(s.virtual_address),
          "size":s.size,"offset":s.offset,"kind":str(s.type)}
          for s in secs],
      "load_segments":[{"type":str(z.type),"va":ok(z.virtual_address),
          "size":z.virtual_size,"file_size":z.physical_size,
          "permissions":str(z.flags)} for z in segs],
      "relocation_type_counts":dict(collections.Counter(str(r.type) for r in raw_relocs)),
      "relocation_sites":[{"site":ok(r.address),"type":str(r.type),
         "addend":r.addend,
         "symbol":r.symbol.name if r.has_symbol else None}
         for r in raw_relocs],
      "original_was_modified":False
    }
    (a.out/"lief-elf-structure.json").write_text(json.dumps(result_lief,indent=2)+"\n")
    with a.elf.open("rb") as fh:
        elf=ELFFile(fh)
        executable=[s for s in elf.iter_sections() if int(s["sh_flags"])&4 and
                   int(s["sh_size"]) and s["sh_type"]!="SHT_NOBITS"]
        fde=sorted([(int(e["initial_location"]),int(e["address_range"]))
             for e in elf.get_dwarf_info().EH_CFI_entries()
             if isinstance(e,FDE) and int(e["address_range"])>0])
        if len(fde)!=2629:raise RuntimeError("ORIGINAL_FDE_EXPECTED_2629 got "+str(len(fde)))
        def findsec(addr,length):
            return next((s for s in executable if int(s["sh_addr"])<=addr
                and addr+length<=int(s["sh_addr"])+int(s["sh_size"])),None)
        cs=Cs(CS_ARCH_ARM64,CS_MODE_LITTLE_ENDIAN)
        cs.detail=True
        fields=["rva","label","source_bytes","decoded_instructions","decoded_bytes",
                "unknown_bytes","direct_calls","indirect_calls","returns",
                "conditional_branches","other_branches","memory_operands",
                "reads","writes","first_undecoded_rva"]
        totals=collections.Counter()
        calls=[]
        with (a.out/"capstone-fde-instructions.tsv").open("w",newline="") as out:
            w=csv.DictWriter(out,fieldnames=fields,delimiter="\t")
            w.writeheader()
            for addr,length in fde:
                section=findsec(addr,length)
                if section is None:raise RuntimeError("FDE_OUT_OF_ELF_CODE "+ok(addr))
                file_offset=int(section["sh_offset"])+addr-int(section["sh_addr"])
                data=src[file_offset:file_offset+length]
                n=decoded=dc=ic=ret=cbr=br=mem=reads=writes=0
                first=None
                # Disassemble the full FDE region, which may include compiler
                # padding; unknown instructions are tracked, not misreported as code.
                for ins in cs.disasm(data,addr):
                    n+=1
                    decoded+=ins.size
                    op=ins.mnemonic.lower()
                    if ins.group(CS_GRP_CALL):
                        if op in ("bl","blraa","blraaz"):
                            dc+=1
                        else:
                            ic+=1
                        for v in ins.operands:
                            if v.type==ARM64_OP_IMM:
                                calls.append((ok(addr),ok(ins.address),ok(v.imm),op))
                    elif ins.group(CS_GRP_RET):ret+=1
                    elif ins.group(CS_GRP_JUMP):
                        if op.startswith(("cb","tb","b.")):cbr+=1
                        else:br+=1
                    for v in ins.operands:
                        if v.type==ARM64_OP_MEM:mem+=1
                    rr,ww=ins.regs_access()
                    reads+=len(rr);writes+=len(ww)
                if decoded!=length:first=ok(addr+decoded)
                w.writerow({"rva":ok(addr),"label":KEYS.get(addr,""),
                     "source_bytes":length,"decoded_instructions":n,
                     "decoded_bytes":decoded,"unknown_bytes":length-decoded,
                     "direct_calls":dc,"indirect_calls":ic,"returns":ret,
                     "conditional_branches":cbr,"other_branches":br,
                     "memory_operands":mem,"reads":reads,"writes":writes,
                     "first_undecoded_rva":first or ""})
                totals.update({"instructions":n,"decoded_bytes":decoded,
                    "unknown_bytes":length-decoded,"direct_calls":dc,
                    "indirect_calls":ic,"returns":ret,"conditional_branches":cbr,
                    "other_branches":br,"memory_operands":mem,
                    "register_reads":reads,"register_writes":writes})
        with (a.out/"capstone-direct-call-edges.tsv").open("w",newline="") as f:
            w=csv.writer(f,delimiter="\t")
            w.writerow(["owner_fde","insn_rva","direct_target_rva","opcode"])
            w.writerows(calls)
        (a.out/"capstone-summary.json").write_text(json.dumps({
            "tool":"Capstone","version":__import__("capstone").__version__,
            "original_sha256":digest(src),"fde_ranges":len(fde),
            "total":dict(totals),
            "direct_call_edges":len(calls),
            "unknown_bytes_nonzero":totals["unknown_bytes"]!=0,
            "original_was_modified":False,
            "note":"Statically decoded instructions; neither reference to function == valid runtime call nor live memory trace."
        },indent=2)+"\n")
        print("EXPR2_LIEF_CAPSTONE_ACTUAL_ANALYSIS_PASS",
            "FDE",len(fde),"LIEF_RELOCS",len(raw_relocs),
            "CAPSTONE_INSNS",totals["instructions"],
            "UNKNOWN_CODE_BYTES",totals["unknown_bytes"],
            "CALL_EDGES",len(calls))
if __name__=="__main__":main()
