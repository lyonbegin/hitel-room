#!/usr/bin/env python3
"""Essence2 five-tool crosswalk of two actual original ARM64 engine DSOs.
Never equates FDE interval with complete recovered high-level C++ function.
Missing tool results explicitly FAIL; no reuse of Expression2 evidence.
"""
import argparse,csv,json
from pathlib import Path
def read(p):
    with p.open() as f:return list(csv.DictReader(f,delimiter="\t"))
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    a=p.parse_args()
    a.out.mkdir(parents=True,exist_ok=True)
    details={};full=True
    for lib in ("libe2u_jni.so","lible_jni.so"):
        # Each directory contains native analysis RESULTS generated on this run.
        files={
            "capstone":a.root/"lief-capstone"/lib/"capstone-fde-instructions.tsv",
            "lief":a.root/"lief-capstone"/lib/"lief-elf-structure.json",
            "ddisasm":a.root/"ddisasm"/lib/"ddisasm-gtirb-code-blocks.tsv",
            "dyninst":a.root/"dyninst"/lib/"dyninst-function-blocks.tsv",
            "ghidra":a.root/"ghidra"/lib/"pcode-fde-coverage.tsv",
        }
        available={k:f.is_file() and f.stat().st_size>0 for k,f in files.items()}
        full=full and all(available.values())
        rows=[];stats={}
        if available["capstone"]:
            cap=read(files["capstone"])
            gmap={int(x["start_hex"],16):x for x in read(files["ghidra"])} if available["ghidra"] else {}
            gt={int(x["rva"],16) for x in read(files["ddisasm"]) if x["rva"].startswith("0x")} if available["ddisasm"] else set()
            dyn={int(x["function_rva"],16) for x in read(files["dyninst"]) if x["function_rva"]} if available["dyninst"] else set()
            for x in cap:
                va=int(x["rva"],16)
                g=gmap.get(va,{})
                rows.append({
                    "fde_elf_va":hex(va),"size_bytes":x["source_bytes"],
                    "capstone_instructions":x["decoded_instructions"],
                    "capstone_decoded_bytes":x["decoded_bytes"],
                    "capstone_unknown_bytes":x["unknown_bytes"],
                    "ghidra_instructions":g.get("instructions",""),
                    "ghidra_decoded_bytes":g.get("decoded_instruction_bytes",""),
                    "ghidra_load":g.get("load",""),"ghidra_store":g.get("store",""),
                    "dyninst_function_start":int(va in dyn),
                    "ddisasm_code_block_start":int(va in gt),
                    "whole_fde_decoding_agree":bool(g) and int(g["decoded_instruction_bytes"])==int(x["decoded_bytes"]),
                    "all_runtime_pointer_relationships_proven":False,
                })
            stats={"original_fde_ranges":len(cap),
                   "capstone_total_instructions":sum(int(x["decoded_instructions"]) for x in cap),
                   "capstone_unknown_bytes":sum(int(x["unknown_bytes"]) for x in cap),
                   "ghidra_fde_matches":sum(bool(x["ghidra_instructions"]) for x in rows),
                   "ghidra_capstone_exact_decoding_byte_counts":sum(x["whole_fde_decoding_agree"] for x in rows),
                   "dyninst_fde_start_matches":sum(x["dyninst_function_start"] for x in rows),
                   "ddisasm_code_start_matches":sum(x["ddisasm_code_block_start"] for x in rows)}
            with (a.out/(lib+"-crosswalk.tsv")).open("w",newline="") as out:
                w=csv.DictWriter(out,fieldnames=list(rows[0]),delimiter="\t")
                w.writeheader();w.writerows(rows)
        details[lib]={"evidence_present":available,"five_tools_present":all(available.values()),
                      "statistics":stats}
    final={"target":"Original Essence 2 Android 0.10.3 BOTH machine-code engines",
           "tools":"Ghidra P-code; Capstone; DDisasm GTIRB; Dyninst ParseAPI; LIEF",
           "all_five_tools_both_engines_present":full,
           "per_original_engine":details,
           "original_binary_rewritten":False,
           "byte_exact_reassembly_already_proven_by_separate_artifact":True,
           "limitations":"Static comparison only. Caller+callee semantics, pointer ownership and verified on-device model rendering not established."}
    (a.out/"RESULT.json").write_text(json.dumps(final,indent=2)+"\n")
    print("ESSENCE2_FIVE_TOOL_CROSSCHECK","COMPLETE" if full else "INCOMPLETE")
    if not full:raise SystemExit(1)
if __name__=="__main__":main()
