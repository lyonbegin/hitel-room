#!/usr/bin/env python3
"""Compare actual outputs of five independent binary-analysis engines.
No function is marked verified solely from source-code patterns or original-byte
self-copy. Distinct concepts: FDE boundaries, CFG guesses, relocations,
mem-access evidence. Missing tools => explicitly INCOMPLETE.
"""
import argparse,csv,json
from pathlib import Path
from bisect import bisect_right
TOOLS={
 "Ghidra":"pcode-summary.json",
 "Capstone":"capstone-summary.json",
 "LIEF":"lief-elf-structure.json",
 "DDisasm/GTIRB":"ddisasm-gtirb-summary.json",
 "Dyninst":"dyninst-summary.json"
}
IMPORTANT={
0x1a7fbc:"PCM append",
0x1a80dc:"scheduler",
0x1a8500:"window",
0x1a9794:"preprocessor",
0x1a7db0:"canon",
0x1a7a04:"native frame staging",
0x1aa40c:"native frame dequeue"
}
def entries(p,sep="\t"):
    with p.open(newline="") as f:return list(csv.DictReader(f,delimiter=sep))
def intval(v):
    return int(v,16) if v else None
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    a=p.parse_args()
    a.out.mkdir(parents=True,exist_ok=True)
    results={}
    for tool,f in TOOLS.items():
        found=list(a.root.rglob(f))
        if found:
            try:results[tool]=json.loads(found[0].read_text())
            except Exception as err:results[tool]={"parsing_error":str(err)}
        else:results[tool]=None
    generated=list(a.root.rglob("capstone-fde-instructions.tsv"))
    cap={intval(x["rva"]):x for x in entries(generated[0])} if generated else {}
    generated=list(a.root.rglob("dyninst-function-blocks.tsv"))
    drows=entries(generated[0]) if generated else []
    dyn={int(x["function_rva"],16) for x in drows}
    generated=list(a.root.rglob("ddisasm-gtirb-code-blocks.tsv"))
    grows=entries(generated[0]) if generated else []
    gt_start=sorted([intval(x["rva"]) for x in grows if x["rva"].startswith("0x")])
    gt_blocks={intval(x["rva"]):int(x["bytes"]) for x in grows
               if x["rva"].startswith("0x")}
    gt_end=[x+gt_blocks[x] for x in gt_start]
    generated=list(a.root.rglob("pcode-fde-coverage.tsv"))
    grow=entries(generated[0]) if generated else []
    gmap={int(x["start_hex"],16)-0x100000:x for x in grow}
    rows=[]
    for addr,x in sorted(cap.items()):
        # Deliberately distinguish "block begins here" vs "block covers here".
        in_gtirb=addr in gt_start
        ix=bisect_right(gt_start,addr)-1
        contained=ix>=0 and (addr<gt_end[ix]) if gt_end else False
        g=gmap.get(addr,{})
        rows.append({"fde_rva":hex(addr),"role":IMPORTANT.get(addr,""),
         "source_bytes":x["source_bytes"],
         "capstone_decoded_bytes":x["decoded_bytes"],
         "capstone_unknown_bytes":x["unknown_bytes"],
         "capstone_direct_calls":x["direct_calls"],
         "capstone_memory_operands":x["memory_operands"],
         "ghidra_pcode_insns":g.get("instructions",""),
         "ghidra_load":g.get("load",""),"ghidra_store":g.get("store",""),
         "dyninst_function_entry":int(addr in dyn),
         "ddisasm_gtirb_code_block_start":int(in_gtirb),
         "ddisasm_gtirb_code_block_contains_entry":int(contained),
         "complete_parity_proven":False})
    if rows:
        with (a.out/"original-function-five-tool-crosswalk.tsv").open("w",newline="") as f:
            w=csv.DictWriter(f,fieldnames=list(rows[0]),delimiter="\t")
            w.writeheader();w.writerows(rows)
    present={tool:bool(v) and "parsing_error" not in v
             for tool,v in results.items()}
    summary={
        "reference":"Original Expression2 v0.6.2 ARM64 ELF only",
        "tool_evidence_present":present,"five_tools_all_executed":all(present.values()),
        "original_fde_rows_compared":len(rows),
        "dyninst_function_entries":len(dyn),"gtirb_code_blocks":len(grows),
        "ghidra_fde_coverage":len(grow),
        "comparison_table_rows":len(rows),
        "ghidra_capstone_instruction_count_conflicts":[
          {"fde_rva":x["fde_rva"],
           "ghidra_count":x["ghidra_pcode_insns"],
           "capstone_count":x["capstone_decoded_bytes"]}
          for x in rows if x["ghidra_pcode_insns"] and
            int(x["ghidra_pcode_insns"])*4!=int(x["capstone_decoded_bytes"])
        ],
        "ghidra_capstone_all_fde_instructions_identical":False,
        "critical_path_original_function_entries":list(map(hex,IMPORTANT)),
        "original_function_byte_equivalence_proven":False,
        "standalone_sdk_parity_proven":False,
        "limitations":[
            "FDE entry point, CFG inferred function, code-block start are not the same concept.",
            "Ghidra uses +0x100000 image base; other tools report ELF virtual addresses.",
            "DDisasm and Dyninst may omit/introduce distinct inferred function boundaries.",
            "No transformed or independently relinked original ELF produced.",
            "Static memory load/store are not runtime pointer alias/ownership proof."
        ]}
    (a.out/"RESULT.json").write_text(json.dumps(summary,indent=2,ensure_ascii=False)+"\n")
    lines=["# Expression2 original ARM64 — Five-tool binary-analysis cross-check","",
      "Original ELF only. No Kotlin/C++ functional rewrite, no authentication changes.",
      "",
      "| Tool | Actual structured output available | Primary audit |",
      "|---|---|---|"]
    roles={"Ghidra":"P-code LOAD/STORE/CALL and function-level coverage",
      "Capstone":"ARM64 instruction/operand/register/branch decoding",
      "LIEF":"ELF sections, segments, imports and relocations",
      "DDisasm/GTIRB":"Code/data blocks, symbolic references, CFG",
      "Dyninst":"Independent function/basic block and typed CFG edges"}
    for name in TOOLS:
        lines.append("| "+name+" | "+("YES" if present[name] else "**NO**")+
                    " | "+roles[name]+" |")
    lines+=["","Source FDE crosswalk: "+str(len(rows)),
           "All five actually analyzed: **"+("YES" if all(present.values()) else "NO")+"**.",
           "No automatic claim of semantic/byte parity with a newly linked SDK.",
           "", "## Remaining gaps",""]
    for name in TOOLS:
        if not present[name]:lines.append("- "+name+": no usable output")
    (a.out/"SUMMARY.md").write_text("\n".join(lines)+"\n")
    print("EXPR2_FIVE_TOOL_CROSSWALK",
        "PRESENT",sum(present.values()),"OF",len(present),
        "FDE_ROWS",len(rows),
        "RESULT","COMPLETE" if all(present.values()) else "INCOMPLETE")
if __name__=="__main__":main()
