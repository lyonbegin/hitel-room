#!/usr/bin/env python3
"""Read-only function-group and relocation-risk inventory for original Expression2.

Consumes Ghidra's functions.tsv, call-edges.tsv, and exact assembly listings.
Does not extract or paste vendor machine-code into another ELF, or modify authentication.
"""
import argparse
import collections
import csv
import io
import json
import re
import zipfile
from pathlib import Path

GROUPS = {
    "native_constructor": ("00170ef4", "001a45a4"),
    "pcm_input_and_preprocessing": ("001724d8", "001a7fbc", "001acf1c", "001a7db0", "001a9794"),
    "scheduler_and_tail": ("001a80dc", "00172bf8", "00172d1c", "001a8230"),
    "model_inference_and_motion": ("001a8500", "001a9f6c"),
    "frame_staging_and_output": ("001a7a04", "001aa40c", "001a84cc", "00172e7c", "00173ef0"),
    "reset_and_shutdown": ("001724a0", "00172e68"),
}
LISTING = re.compile(r"native-instruction-bytes/\d+_([0-9a-f]+)\.lst$")
BRANCH = re.compile(r"^(?:b(?:\.[a-z]+)?|bl|cbz|cbnz|tbz|tbnz)$")


def inventory(root, archive):
    if archive:
        z = zipfile.ZipFile(archive)
        return z.namelist(), lambda name: z.read(name).decode("utf-8")
    root = Path(root)
    return [str(p.relative_to(root)) for p in root.rglob("*") if p.is_file()], \
        lambda name: (root/name).read_text(encoding="utf-8")


def analyze(root=None, archive=None):
    paths, load = inventory(root, archive)
    funcs = {r["address"]: r for r in csv.DictReader(io.StringIO(load("functions.tsv")), delimiter="\t")}
    edges = list(csv.DictReader(io.StringIO(load("call-edges.tsv")), delimiter="\t"))
    if len(funcs) < 1000 or len(edges) < 2000:
        raise RuntimeError("Incomplete original ARM64 Ghidra inventory")
    graph = collections.defaultdict(set)
    for row in edges:
        graph[row["caller_address"]].add(row["callee_address"])
    index = {}
    for path in paths:
        m = LISTING.search(path)
        if m: index[m.group(1)] = path
    if len(index) != len(funcs):
        raise RuntimeError("Function assembly listings missing: "+str((len(index),len(funcs))))
    groups = {}
    membership = collections.defaultdict(set)
    all_reachable = set()
    for group, roots in GROUPS.items():
        if not set(roots).issubset(funcs):
            raise RuntimeError("Unrecognized original function entry: "+group)
        seen = set(roots)
        pending = list(roots)
        while pending:
            for target in graph[pending.pop()]:
                if target not in seen:
                    seen.add(target)
                    pending.append(target)
        hazards = collections.Counter()
        for addr in seen:
            membership[addr].add(group)
            body_bytes = 0
            for line in load(index[addr]).splitlines():
                parts = line.split("\t", 2)
                if len(parts) != 3: continue
                body_bytes += len(parts[1])//2
                instruction = parts[2].strip()
                opcode = instruction.split()[0].lower()
                operand = instruction[len(opcode):].strip()
                if opcode in ("adr", "adrp"):
                    hazards["pc_relative_address"] += 1
                elif BRANCH.fullmatch(opcode):
                    hazards["pc_relative_branch"] += 1
                    if opcode == "bl": hazards["call_instruction"] += 1
                elif opcode in ("blr", "br"):
                    hazards["indirect_branch_or_dispatch"] += 1
                elif opcode.startswith("ldr") and re.search(r",\s*0x[0-9a-f]+\s*$",operand,re.I):
                    hazards["pc_relative_literal_load"] += 1
            if body_bytes != int(funcs[addr]["byte_count"]):
                raise RuntimeError("Original instruction byte mismatch: "+addr)
        groups[group] = {
            "root_function_rvas": list(roots),
            "static_reachable_functions": len(seen),
            "instruction_count": sum(int(funcs[a]["instruction_count"]) for a in seen),
            "static_direct_call_edges": sum(len(graph[a] & seen) for a in seen),
            "address_or_branch_relocation_hazards": dict(hazards),
        }
        all_reachable.update(seen)
    result = {
        "source": "Original unmodified Expression2 Android 0.6.2, Ghidra function inventory",
        "functions_in_original_inventory": len(funcs),
        "direct_call_edges_in_original_inventory": len(edges),
        "unique_reachable_functions_across_groups": len(all_reachable),
        "functions_shared_between_groups": sum(len(v)>1 for v in membership.values()),
        "groups": groups,
        "limitations": [
            "Static direct-call closure excludes indirect vtables and model-backend callbacks",
            "PC-relative branches and data, PLT/GOT and runtime state require relocations",
            "Grouping is not proof of executable transplanted vendor machine code",
            "No original model inference or live video demonstrated by this inventory",
        ],
        "original_binary_copied_into_new_so": False,
        "authentication_modified": False,
    }
    return result


def main():
    p=argparse.ArgumentParser()
    s=p.add_mutually_exclusive_group(required=True)
    s.add_argument("--audit-root",type=Path)
    s.add_argument("--audit-zip",type=Path)
    p.add_argument("--out",type=Path,required=True)
    args=p.parse_args()
    d=analyze(root=args.audit_root,archive=args.audit_zip)
    args.out.mkdir(parents=True,exist_ok=True)
    (args.out/"group-relocation-audit.json").write_text(json.dumps(d,indent=2),encoding="utf-8")
    rows=["# Expression2 original ARM64 native function-group audit","",
          "Analysis only; no copied vendor machine code or modification of authentication.","",
          f"- Original functions: {d['functions_in_original_inventory']}",
          f"- Direct call edges: {d['direct_call_edges_in_original_inventory']}",
          f"- Deduplicated reachable functions: {d['unique_reachable_functions_across_groups']}",
          f"- Functions shared by multiple groups: {d['functions_shared_between_groups']}","",
          "| Group | Reachable functions | Instructions | PC-relative addressing | Branches | Indirect branches |",
          "|---|---:|---:|---:|---:|---:|"]
    for name,group in d["groups"].items():
        h=group["address_or_branch_relocation_hazards"]
        rows.append(f"| {name} | {group['static_reachable_functions']} | {group['instruction_count']} | "+
          f"{h.get('pc_relative_address',0)+h.get('pc_relative_literal_load',0)} | "+
          f"{h.get('pc_relative_branch',0)} | {h.get('indirect_branch_or_dispatch',0)} |")
    rows+=["","The counts overlap between groups; they cannot simply be added.",
           "Original ELF contains relocatable address references, external C++/JNI runtime dependencies, indirect targets and model-backend state.",
           "Existing execution evidence is from the original library called through an instrumented JNI harness.",
           "The native inference dispatcher has been disassembled, not executed through the entire model graph.",
           "Do not interpret this report as a complete independent Expression2 SDK."]
    (args.out/"SUMMARY.md").write_text("\n".join(rows)+"\n",encoding="utf-8")
    print("EXPR2_NATIVE_GROUP_INVENTORY_PASS",
          d["functions_in_original_inventory"],
          d["direct_call_edges_in_original_inventory"],
          d["unique_reachable_functions_across_groups"],
          d["functions_shared_between_groups"])


if __name__=="__main__": main()
