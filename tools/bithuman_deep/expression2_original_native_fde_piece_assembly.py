#!/usr/bin/env python3
"""Prove original Android ARM64 ELF survives REAL function-level file splitting.

This is NOT recompilation, and is NOT evidence of original code portability.
Records each .eh_frame FDE original machine-code range as an independent
address-indexed byte unit, every ELF section/header/gap as separate partitions,
and rebuilds the entire SO from the saved ZIP archive entries alone, byte zero
on creation. Does not prefill reconstructed ELF from source.
"""
import argparse,csv,hashlib,io,json,struct,zipfile
from pathlib import Path
from elftools.elf.elffile import ELFFile
from elftools.dwarf.callframe import FDE

ORIGINAL="ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c"
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--elf",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    p.add_argument("--temp",type=Path,required=True)
    a=p.parse_args()
    raw=a.elf.read_bytes()
    if sha(raw)!=ORIGINAL:raise RuntimeError("EXPECTED_OFFICIAL_ARM64_SO_HASH")
    a.out.mkdir(parents=True,exist_ok=True)
    a.temp.mkdir(parents=True,exist_ok=True)
    elf=ELFFile(io.BytesIO(raw))
    if elf.elfclass!=64 or elf.little_endian is not True or elf["e_machine"]!="EM_AARCH64":
        raise RuntimeError("NOT_OFFICIAL_AARCH64_ELF64")
    sections=list(elf.iter_sections())
    # All on-disk bytes are included: code, data, relocations, ELF metadata,
    # non-section header bytes, linker padding and file gaps.
    bounds={0,len(raw)}
    regions=[(0,int(elf["e_ehsize"]),"ELF_HEADER")]
    regions.append((int(elf["e_phoff"]),int(elf["e_phoff"])+
                    int(elf["e_phentsize"])*int(elf["e_phnum"]),"PROGRAM_HEADERS"))
    regions.append((int(elf["e_shoff"]),int(elf["e_shoff"])+
                    int(elf["e_shentsize"])*int(elf["e_shnum"]),"SECTION_HEADERS"))
    section_records=[]
    for sec in sections:
        if sec["sh_type"]=="SHT_NOBITS" or int(sec["sh_size"])==0:continue
        lo=int(sec["sh_offset"]);hi=lo+int(sec["sh_size"])
        if not 0<=lo<=hi<=len(raw):raise RuntimeError("SECTION_OUT_OF_RANGE")
        bounds.update((lo,hi));regions.append((lo,hi,"SECTION:"+sec.name))
        section_records.append((lo,hi,sec.name))
    fde=[]
    for entry in elf.get_dwarf_info().EH_CFI_entries():
        if not isinstance(entry,FDE):continue
        va=int(entry["initial_location"])
        length=int(entry["address_range"])
        if length<=0:continue
        # Address-to-file conversion constrained to executable SHF_EXECINSTR.
        matches=[s for s in sections if s["sh_type"]!="SHT_NOBITS" and
            (int(s["sh_flags"])&4)!=0 and
            int(s["sh_addr"])<=va and
            va+length<=int(s["sh_addr"])+int(s["sh_size"])]
        if len(matches)!=1:raise RuntimeError("FDE_UNMAPPABLE_0x%x"%va)
        sec=matches[0]
        lo=int(sec["sh_offset"])+va-int(sec["sh_addr"])
        hi=lo+length
        if not 0<=lo<hi<=len(raw):raise RuntimeError("FDE_BYTE_RANGE_INVALID")
        fde.append((va,length,lo,hi,sec.name))
        bounds.update((lo,hi))
    fde.sort()
    if len(fde)!=2629:raise RuntimeError("EXPECTED_2629_ORIGINAL_FDE_ENTRIES")
    if len({t[0] for t in fde})!=len(fde):raise RuntimeError("DUPLICATE_FDE_START")
    with (a.out/"original-2629-fde-function-machine-hashes.tsv").open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t")
        w.writerow(["elf_vaddr","file_offset","length","section","original_bytes_sha256"])
        for va,length,lo,hi,name in fde:
            w.writerow([hex(va),lo,length,name,sha(raw[lo:hi])])
    starts=sorted(bounds)
    archive=a.temp/"separated-original-machine-and-elf-components.zip"
    index=[]
    with zipfile.ZipFile(archive,"w",compression=zipfile.ZIP_STORED) as z:
        for i,(lo,hi) in enumerate(zip(starts,starts[1:])):
            if hi==lo:continue
            owners=[label for s,e,label in regions if s<=lo and hi<=e]
            func_owner=next((hex(va) for va,length,s,e,sec in fde if s<=lo and hi<=e),"")
            owner="FUNCTION:"+func_owner if func_owner else (
                sorted(owners,key=lambda x:0 if x.startswith("SECTION:") else 1)[0] if owners else "ELF_GAP_OR_PADDING")
            name="%05d-%08x-%08x.part"%(i,lo,hi)
            block=raw[lo:hi]
            index.append((lo,hi,name,sha(block),owner))
            z.writestr(name,block)
    rebuilt=a.temp/"reassembled-from-original-fde-machine-pieces.so"
    # New empty file; ONLY inputs are individually saved split byte parts.
    with zipfile.ZipFile(archive) as z, rebuilt.open("wb") as out:
        expected=0
        for lo,hi,name,digest,owner in index:
            if lo!=expected:raise RuntimeError("HOLE_IN_ELF_COMPONENT_COVERAGE")
            piece=z.read(name)
            if len(piece)!=hi-lo or sha(piece)!=digest:
                raise RuntimeError("SPLIT_MACHINE_PIECE_DAMAGED:"+name)
            out.write(piece)
            expected=hi
        if expected!=len(raw):raise RuntimeError("INCOMPLETE_REBUILT_ELF")
    rebytes=rebuilt.read_bytes()
    if len(rebytes)!=len(raw) or sha(rebytes)!=sha(raw) or rebytes!=raw:
        raise RuntimeError("ORIGINAL_MACHINE_CODE_REASSEMBLY_NOT_IDENTICAL")
    with (a.out/"original-elf-machine-component-index.tsv").open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t")
        w.writerow(["file_offset_start","file_offset_end","part_file","sha256","structural_owner"])
        w.writerows(index)
    results={
      "original_elf_sha256":sha(raw),"reassembled_elf_sha256":sha(rebytes),
      "original_elf_bytes":len(raw),"reassembled_elf_bytes":len(rebytes),
      "fde_function_intervals":len(fde),
      "independently_stored_file_pieces":len(index),
      "all_elf_file_bytes_accounted_for":True,
      "original_elf_file_byte_differences":0,
      "original_fde_bytes_sha256_all_preserved":True,
      "machine_code_translation_performed":False,
      "new_linker_or_relocation_executed":False,
      "caveat":"This is original ELF code+data reassembly at original addresses, not linker relocation to different addresses or proof of independent SDK semantics."
    }
    (a.out/"native-original-fde-split-reassembly.json").write_text(
        json.dumps(results,indent=2)+"\n")
    print("EXPR2_ORIGINAL_NATIVE_FDE_MACHINE_PIECE_REASSEMBLY_PASS",
        "FDE",len(fde),"ELF_PIECES",len(index),"ELF_BYTES",len(raw),
        "ALL_BYTES_DIFF",0,"SHA256",sha(raw))

if __name__=="__main__":main()
