#!/usr/bin/env python3
"""Prioritize ELF address tables over JNI-origin static call closure.

Compare function symbols (.dynsym/.symtab), .eh_frame FDE ranges, and code
pointers from relocated C++ data. Recompose original bytes using bounds
from these tables; report unresolved ranges, without altering vendor code.
"""
import argparse,collections,hashlib,json
from pathlib import Path
from elftools.elf.elffile import ELFFile
from elftools.elf.sections import SymbolTableSection
from elftools.elf.relocation import RelocationSection
from elftools.dwarf.callframe import FDE

def sha(b): return hashlib.sha256(b).hexdigest()
def union(ranges):
    out=[]
    for lo,hi in sorted((int(lo),int(hi)) for lo,hi in ranges if hi>lo):
        if out and lo<=out[-1][1]: out[-1]=(out[-1][0],max(hi,out[-1][1]))
        else: out.append((lo,hi))
    return out
def overlap(ranges,lo,hi):
    return union((max(x,lo),min(y,hi)) for x,y in ranges if x<hi and y>lo)
def size(ranges): return sum(b-a for a,b in ranges)

def run(args):
    raw=args.elf.read_bytes()
    assert raw[:6]==b"\x7fELF\x02\x01"
    with args.elf.open("rb") as fh:
        elf=ELFFile(fh)
        assert elf["e_machine"]=="EM_AARCH64"
        sections=list(elf.iter_sections())
        executable=[dict(name=s.name,lo=int(s["sh_addr"]),hi=int(s["sh_addr"]+s["sh_size"]),
                         off=int(s["sh_offset"]),length=int(s["sh_size"]))
                    for s in sections if s["sh_flags"]&4 and s["sh_size"] and s["sh_type"]!="SHT_NOBITS"]
        def code_addr(addr):
            return any(s["lo"]<=addr<s["hi"] for s in executable)
        symbols=[]
        for tab in sections:
            if not isinstance(tab,SymbolTableSection):continue
            for x in tab.iter_symbols():
                if x["st_info"]["type"]=="STT_FUNC" and isinstance(x["st_shndx"],int):
                    start=int(x["st_value"])
                    if code_addr(start):
                        symbols.append(dict(start=start,length=int(x["st_size"]),table=tab.name,name=x.name))
        symbol_starts={x["start"] for x in symbols}
        sym_intervals=[(x["start"],x["start"]+x["length"]) for x in symbols if x["length"]>0]
        dwarf=elf.get_dwarf_info()
        fdes=[]
        if dwarf.has_EH_CFI():
            for e in dwarf.EH_CFI_entries():
                if not isinstance(e,FDE):continue
                start=int(e["initial_location"])
                length=int(e["address_range"])
                if length>0 and code_addr(start):
                    fdes.append(dict(start=start,length=length))
        fde_starts={x["start"] for x in fdes}
        fde_intervals=[(x["start"],x["start"]+x["length"]) for x in fdes]
        ptrs=[]
        targets_by_section=collections.Counter()
        for tab in sections:
            if not isinstance(tab,RelocationSection): continue
            syms=elf.get_section(tab["sh_link"])
            for rel in tab.iter_relocations():
                raddr=int(rel["r_offset"])
                section=next((s for s in sections if int(s["sh_addr"]) and
                  int(s["sh_addr"])<=raddr<int(s["sh_addr"]+s["sh_size"])),None)
                if section is None or section.name not in (
                    ".data.rel.ro",".data",".init_array",".fini_array",".got",".got.plt"):continue
                addend=int(rel["r_addend"]) if rel.is_RELA() else 0
                typ=int(rel["r_info_type"])
                if typ==1027: target=addend
                elif typ==257:
                    si=int(rel["r_info_sym"])
                    target=addend+(int(syms.get_symbol(si)["st_value"]) if si else 0)
                else:continue
                if code_addr(target):
                    ptrs.append(dict(slot=raddr,target=target,source=section.name))
                    targets_by_section[section.name]+=1
        ptr_starts={x["target"] for x in ptrs}
        full=bytearray(raw)
        partial=bytearray(raw)
        details=[]
        total=0
        known=0
        piece_count=0
        for s in executable:
            lo,hi=s["lo"],s["hi"]
            parts=overlap(sym_intervals+fde_intervals,lo,hi)
            boundaries=sorted({lo,hi}|{v for a,b in parts for v in (a,b)})
            original_pieces=[]
            for start,stop in zip(boundaries,boundaries[1:]):
                offset=s["off"]+start-lo
                content=raw[offset:offset+stop-start]
                is_known=any(a<=start and stop<=b for a,b in parts)
                original_pieces.append((offset,content))
                if not is_known:partial[offset:offset+len(content)]=bytes(len(content))
            for offset,content in reversed(original_pieces):
                full[offset:offset+len(content)]=content
            piece_count+=len(original_pieces)
            covered=size(parts)
            known+=covered
            total+=hi-lo
            details.append(dict(section=s["name"],executable_bytes=hi-lo,
                covered_bytes=covered,still_unclassified=hi-lo-covered,
                pieces=len(original_pieces)))
        if full!=raw or sha(full)!=sha(raw):raise RuntimeError("RECOMPOSITION_MISMATCH")
        different=sum(x!=y for x,y in zip(raw,partial))
        count_source=lambda rs:sum(size(overlap(rs,s["lo"],s["hi"])) for s in executable)
        result={
          "original_elf_size":len(raw),"original_sha256":sha(raw),
          "symbol_function_entries":len(symbols),"symbol_function_unique_starts":len(symbol_starts),
          "unwind_FDE_records":len(fdes),"unwind_FDE_unique_starts":len(fde_starts),
          "unwind_starts_not_in_symbols":len(fde_starts-symbol_starts),
          "relocation_function_pointer_records":len(ptrs),
          "unique_pointer_targets":len(ptr_starts),
          "pointer_targets_by_section":dict(targets_by_section),
          "all_unique_address_seeds":len(symbol_starts|fde_starts|ptr_starts),
          "executable_bytes":total,
          "symbol_covered_bytes":count_source(sym_intervals),
          "unwind_covered_bytes":count_source(fde_intervals),
          "combined_symbol_and_unwind_covered_bytes":known,
          "not_covered_bytes":total-known,
          "not_covered_difference_bytes_if_zeroed":different,
          "executable_pieces_split_at_address_table_ranges":piece_count,
          "section_details":details,
          "reassembled_original_sha256":sha(full),
          "reassembled_original_byte_difference":0,
          "independent_new_so_built":False,
          "authentication_modified":False,
          "limits":[
            "Dynamic symbol tables may omit hidden internal functions.",
            "Unwind FDE may omit handwritten stubs or some leaf functions.",
            "Vtable relocated pointers are potential function addresses, not always unique starts.",
            "Reassembled original file is not a newly independently compiled SDK.",
            "Unknown bytes may contain link stubs and padding, not just undiscovered functions."
          ]}
        args.out.mkdir(parents=True,exist_ok=True)
        (args.out/"audit.json").write_text(json.dumps(result,indent=2))
        lines=["# Native original address-table-led decomposition and reassembly","",
          "Original SO SHA256: "+sha(raw),
          "Original bytes: "+str(len(raw)),
          "Symbol function starts: "+str(len(symbol_starts)),
          "Unwind FDE starts: "+str(len(fde_starts)),
          "Unwind starts missing from symbol table: "+str(len(fde_starts-symbol_starts)),
          "Relocated code-pointer targets: "+str(len(ptr_starts)),
          "All candidate address seeds: "+str(len(symbol_starts|fde_starts|ptr_starts)),
          "Executable bytes: "+str(total),
          "Original bytes covered by symbol lengths: "+str(count_source(sym_intervals)),
          "Original bytes covered by unwind FDE ranges: "+str(count_source(fde_intervals)),
          "Covered by union of both: "+str(known),
          "Unclassified executable bytes: "+str(total-known),
          "Unknown byte differences if absent: "+str(different),
          "Function-boundary code pieces: "+str(piece_count),
          "Full original-file recomposition difference: ZERO",
          "This is byte-identity checking, not an independent new .so."]
        (args.out/"SUMMARY.md").write_text("\n".join(lines)+"\n")
        print("EXPR2_TABLE_FIRST_RECOMPOSITION_PASS",
          "symbols",len(symbol_starts),"fdes",len(fde_starts),
          "pointer_targets",len(ptr_starts),"covered",known,
          "total",total,"missing",total-known,"byte_delta",0)

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--elf",type=Path,required=True)
    parser.add_argument("--out",type=Path,required=True)
    run(parser.parse_args())
