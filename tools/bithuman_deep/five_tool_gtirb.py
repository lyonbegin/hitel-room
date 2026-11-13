#!/usr/bin/env python3
"""Consume actual DDisasm-generated ARM64 GTIRB without changing any original byte.
Exports code/data classification, CFG, symbols and symbolic expression counts.
"""
import argparse,collections,csv,json
from pathlib import Path
import gtirb

def hx(a):
    return "0x%x"%a if a is not None else "unknown"
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--ir",type=Path,required=True)
    ap.add_argument("--out",type=Path,required=True)
    a=ap.parse_args()
    a.out.mkdir(parents=True,exist_ok=True)
    ir=gtirb.IR.load_protobuf(str(a.ir))
    if not ir.modules:raise RuntimeError("GTIRB_HAS_NO_MODULES")
    blocks=list(ir.code_blocks)
    datas=list(ir.data_blocks)
    edges=list(ir.cfg)
    syms=[]
    aux={}
    section_types=collections.Counter()
    for m in ir.modules:
        syms.extend(m.symbols)
        section_types.update(s.name for s in m.sections)
        aux[m.name]=sorted(m.aux_data)
    def block(b):
        return {"rva":hx(b.address),"bytes":b.size,
           "symbolic_reference_count":sum(1 for x in b.byte_interval.symbolic_expressions
              if b.offset<=x<b.offset+b.size) if b.byte_interval else 0}
    with (a.out/"ddisasm-gtirb-code-blocks.tsv").open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t")
        w.writerow(["rva","bytes"])
        for b in sorted(blocks,key=lambda b:(b.address is None,b.address or 0)):
            w.writerow([hx(b.address),b.size])
    with (a.out/"ddisasm-gtirb-data-blocks.tsv").open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t")
        w.writerow(["rva","bytes"])
        for b in sorted(datas,key=lambda b:(b.address is None,b.address or 0)):
            w.writerow([hx(b.address),b.size])
    with (a.out/"ddisasm-gtirb-cfg-edges.tsv").open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t")
        w.writerow(["from","to","edge_type","direct","conditional"])
        for e in edges:
            label=e.label
            w.writerow([hx(getattr(e.source,'address',None)),hx(getattr(e.target,'address',None)),
                str(label.type) if label else "unspecified",
                str(label.direct) if label else "?",
                str(label.conditional) if label else "?"])
    counts=collections.Counter(str(e.label.type) if e.label else "unlabeled" for e in edges)
    result={
        "tool":"DDisasm + GTIRB",
        "gtirb_modules":len(ir.modules),"code_blocks":len(blocks),
        "data_blocks":len(datas),"cfg_edges":len(edges),
        "cfg_types":dict(counts),
        "symbols":len(syms),
        "symbols_with_referents":sum(s.referent is not None for s in syms),
        "code_bytes_classified":sum(b.size for b in blocks),
        "data_bytes_classified":sum(b.size for b in datas),
        "sections":dict(section_types),
        "aux_data_keys":aux,
        "original_machine_code_modified":False,
        "independent_elf_rebuilt":False,
        "unvalidated":"DDisasm's binary rewriter has not been demonstrated byte-identical on this SDK",
    }
    (a.out/"ddisasm-gtirb-summary.json").write_text(json.dumps(result,indent=2)+"\n")
    print("EXPR2_DDISASM_GTIRB_ACTUAL_ANALYSIS_PASS",
        "CODE_BLOCKS",len(blocks),"DATA_BLOCKS",len(datas),"CFG_EDGES",len(edges),
        "SYMBOLS",len(syms))
if __name__=="__main__":main()
