#!/usr/bin/env python3
"""Read-only LIEF/Capstone audit of SHA-pinned ORIGINAL Toss ARM64 SO."""
import argparse,csv,json,hashlib,collections
from pathlib import Path
import lief,capstone
from elftools.elf.elffile import ELFFile
from elftools.dwarf.callframe import FDE

p=argparse.ArgumentParser()
p.add_argument("--elf",required=True)
p.add_argument("--out",required=True)
p.add_argument("--sha",required=True)
a=p.parse_args()
out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
data=Path(a.elf).read_bytes()
actual=hashlib.sha256(data).hexdigest()
assert actual==a.sha,(actual,a.sha)
binary=lief.ELF.parse(str(a.elf))
assert binary is not None
with open(a.elf,"rb") as fp:
    elf=ELFFile(fp)
    assert elf["e_machine"]=="EM_AARCH64",elf["e_machine"]
    sec=elf.get_section_by_name(".text")
    assert sec is not None
    code=sec.data(); base=int(sec["sh_addr"]); offset=int(sec["sh_offset"])
    fdes=[]
    dwarf=elf.get_dwarf_info()
    if dwarf.has_EH_CFI():
        for v in dwarf.EH_CFI_entries():
            if isinstance(v,FDE):fdes.append((int(v["initial_location"]),int(v["address_range"])))
    with (out/"fde.csv").open("w") as w:
        writer=csv.writer(w);writer.writerow(["va","size"])
        for x,y in sorted(fdes):writer.writerow([hex(x),y])
cs=capstone.Cs(capstone.CS_ARCH_ARM64,capstone.CS_MODE_LITTLE_ENDIAN)
cs.detail=True
counts=collections.Counter()
insts=list(cs.disasm(code,base))
with (out/"capstone_instructions.tsv").open("w") as f:
    f.write("address\tfile_offset\thex\tmnemonic\toperands\tgroups\n")
    for ins in insts:
        groups=";".join(str(z) for z in ins.groups)
        f.write(f"0x{ins.address:x}\t0x{offset+ins.address-base:x}\t{ins.bytes.hex()}\t{ins.mnemonic}\t{ins.op_str}\t{groups}\n")
        counts[ins.mnemonic]+=1
decoded=sum(z.size for z in insts)
with (out/"lief_sections.tsv").open("w") as f:
    f.write("name\tva\toffset\tsize\n")
    for z in binary.sections:f.write(f"{z.name}\t0x{z.virtual_address:x}\t0x{z.offset:x}\t{z.size}\n")
with (out/"lief_relocations.tsv").open("w") as f:
    f.write("va\ttype\n")
    for z in binary.relocations:f.write(f"0x{z.address:x}\t{z.type}\n")
summary={
 "sha256":actual,"tool_lief":"LIEF","lief_version":getattr(lief,"__version__","unknown"),
 "tool_capstone":"Capstone","capstone_version":capstone.cs_version(),
 "architecture":str(elf["e_machine"]),"sections":len(binary.sections),
 "relocations":len(binary.relocations),"dynamic_symbols":len(binary.dynamic_symbols),
 "fde_ranges":len(fdes),"text_base":hex(base),"text_file_offset":hex(offset),
 "text_bytes":len(code),"disassembled_bytes":decoded,
 "instructions":len(insts),"instruction_counts":dict(counts),
 "original_binary_modified":False}
(out/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2,default=str))
assert decoded==len(code),(decoded,len(code))
print("TOSS_LIEF_CAPSTONE_ACTUAL_PASS",json.dumps({k:summary[k] for k in ["sha256","relocations","fde_ranges","instructions"]}))
