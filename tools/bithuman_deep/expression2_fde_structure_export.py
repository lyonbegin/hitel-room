#!/usr/bin/env python3
"""Repartition the EXACT published Expression2 ARM64 ELF by its FDE address index.
Read-only: no original machine code or model weights included in output.
Emit byte-verified function ranges and linkable relocation/data-slot records.
"""
import argparse
import collections
import csv
import hashlib
import json
import struct
from pathlib import Path

from elftools.elf.elffile import ELFFile
from elftools.elf.relocation import RelocationSection
from elftools.elf.sections import SymbolTableSection
from elftools.dwarf.callframe import FDE

EXPECTED_ELF_SHA256="ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c"
# Ghidra imports this Android ARM64 shared object at image base 0x100000;
# its FUN_001a7fbc labels refer to ELF virtual address 0x000a7fbc.
GHIDRA_ANALYSIS_BASE=0x100000

def h(x):
    return hashlib.sha256(x).hexdigest()

def s_hex(x):
    return "%08x" % x

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--elf",type=Path,required=True)
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    raw=args.elf.read_bytes()
    if h(raw)!=EXPECTED_ELF_SHA256:
        raise SystemExit("REFUSING_UNIDENTIFIED_ORIGINAL_ELF_SHA256 "+h(raw))
    args.out.mkdir(parents=True,exist_ok=True)
    with args.elf.open("rb") as handle:
        elf=ELFFile(handle)
        sections=list(elf.iter_sections())
        exec_sections=[s for s in sections if
            int(s["sh_flags"])&4 and s["sh_type"]!="SHT_NOBITS"
            and int(s["sh_size"])>0]
        def containing(addr):
            return next((s for s in sections if
                int(s["sh_addr"])<=addr<int(s["sh_addr"])+int(s["sh_size"])
                and int(s["sh_size"])>0),None)
        def executable(addr):
            return next((s for s in exec_sections if
                int(s["sh_addr"])<=addr<int(s["sh_addr"])+int(s["sh_size"])),None)
        dwarf=elf.get_dwarf_info()
        if not dwarf.has_EH_CFI():
            raise RuntimeError("missing original FDE unwind table")
        fdes=sorted([
            (int(f["initial_location"]),int(f["address_range"]))
            for f in dwarf.EH_CFI_entries() if isinstance(f,FDE)
            and executable(int(f["initial_location"]))
        ])
        if len(fdes)!=2629:
            raise RuntimeError("Original function address index differs: "+str(len(fdes)))
        hdr=elf.get_section_by_name(".eh_frame_hdr")
        hb=hdr.data()
        if tuple(hb[:4])!=(1,0x1b,3,0x3b):
            raise RuntimeError("unrecognized .eh_frame_hdr encoding")
        count=struct.unpack_from("<I",hb,8)[0]
        if count!=len(fdes):
            raise RuntimeError("FDE index count differs from table")
        starts=[int(hdr["sh_addr"])+struct.unpack_from("<i",hb,12+i*8)[0]
                for i in range(count)]
        if starts!=[a for a,b in fdes]:
            raise RuntimeError("FDE address ordering mismatch")
        symbols=collections.defaultdict(list)
        for section in sections:
            if isinstance(section,SymbolTableSection):
                for x in section.iter_symbols():
                    if x["st_info"]["type"]=="STT_FUNC":
                        symbols[int(x["st_value"])].append(x.name)
        records=[]
        text_bytes=0
        with (args.out/"original-function-ranges.tsv").open("w",newline="") as output:
            w=csv.writer(output,delimiter="\t")
            w.writerow(["start_hex","end_hex","length_bytes","file_offset","section",
                        "sha256","symbol","in_executable_section","elf_start_hex","elf_end_hex","ghidra_image_base_hex"])
            for start,length in fdes:
                sec=executable(start)
                if not sec:
                    raise RuntimeError("FDE points out of executable")
                end=start+length
                if end>int(sec["sh_addr"])+int(sec["sh_size"]):
                    raise RuntimeError("FDE overran executable section")
                fileoff=int(sec["sh_offset"])+start-int(sec["sh_addr"])
                data=raw[fileoff:fileoff+length]
                if len(data)!=length:
                    raise RuntimeError("FDE truncated")
                digest=h(data)
                symbol=next((n for n in symbols.get(start,[]) if n),"")
                w.writerow([s_hex(start+GHIDRA_ANALYSIS_BASE),s_hex(end+GHIDRA_ANALYSIS_BASE),length,fileoff,
                            sec.name,digest,symbol,"true",s_hex(start),s_hex(end),s_hex(GHIDRA_ANALYSIS_BASE)])
                records.append(dict(start=s_hex(start),end=s_hex(end),
                    bytes=length,sha256=digest,section=sec.name,
                    symbol=symbol))
                text_bytes+=length
        # Rebuild code-containing slices from the FDE partition without
        # modifying addresses. This validates the partition; it is NOT an SDK.
        original=bytearray(raw)
        for r in records:
            start=int(r["start"],16)
            sec=executable(start)
            length=r["bytes"]
            off=int(sec["sh_offset"])+start-int(sec["sh_addr"])
            original[off:off+length]=raw[off:off+length]
        if h(original)!=EXPECTED_ELF_SHA256:
            raise RuntimeError("full original ELF layout reconstruction mismatch")

        # Relocations bind code and data, including .data.rel.ro and GOT.
        references=[]
        for tab in sections:
            if not isinstance(tab,RelocationSection):continue
            symtab=elf.get_section(tab["sh_link"])
            for item in tab.iter_relocations():
                slot=int(item["r_offset"])
                source=containing(slot)
                if source is None: continue
                typ=int(item["r_info_type"])
                addend=int(item["r_addend"]) if item.is_RELA() else 0
                target=addend
                if typ==257:
                    idx=int(item["r_info_sym"])
                    if idx:target+=int(symtab.get_symbol(idx)["st_value"])
                elif typ!=1027: continue
                dest=containing(target)
                references.append(dict(slot=s_hex(slot),from_section=source.name,
                    target=s_hex(target) if target>=0 else str(target),
                    target_section=dest.name if dest is not None else "external/unmapped",
                    target_is_executable=executable(target) is not None,
                    relocation_type=typ))
        with (args.out/"original-data-relocation-links.tsv").open("w",newline="") as f:
            w=csv.DictWriter(f,delimiter="\t",fieldnames=list(references[0]))
            w.writeheader()
            w.writerows(references)
        (args.out/"original-fde-reassembly.json").write_text(json.dumps({
          "source":"verified original Expression2 0.6.2 ARM64 ELF",
          "original_so_sha256":h(raw),
          "ghidra_import_base":s_hex(GHIDRA_ANALYSIS_BASE),
          "elf_virtual_to_ghidra_analysis_address": "ghidra_addr = ELF_VA + 0x00100000",
          "fde_count":len(records),
          "fde_byte_ranges_sha256":h((args.out/"original-function-ranges.tsv").read_bytes()),
          "covered_fde_range_bytes_before_overlap":text_bytes,
          "relocation_links":len(references),
          "relocated_executable_pointers":sum(r["target_is_executable"] for r in references),
          "roundtrip_original_sha256":h(original),
          "roundtrip_byte_difference":0,
          "separation":["FDE function ranges","relocation/data slots",
                        "original JVM layer (separate existing javap inventory)",
                        "P-code memory accesses (Ghidra postprocessor)"],
          "reconstructed_new_independent_sdk":False,
          "full_vendor_model_execution_proven":False,
          "authentication_modified":False
        },indent=2)+"\n")
        print("EXPR2_FDE_REPARTITION_ROUNDTRIP_PASS",
              "FDE",len(records),"RELOCATIONS",len(references),
              "ORIGINAL_BYTES_DELTA",0)
if __name__=="__main__":
    main()
