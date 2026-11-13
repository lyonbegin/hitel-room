#!/usr/bin/env python3
"""Expression 2 original-code native indirect/ownership/boundary evidence inventory.

Reads only the immutable original JVM javap and ARM64 instruction/decompile records
captured from ai.bithuman:expression2-android:0.6.2 in run 43328017533.
No replacement streaming/renderer algorithm, vendor source or binary is generated.
A BLR/BR callsite is NOT presumed to identify its runtime target.
"""
import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict, deque
from pathlib import Path

FOCUS = [
    "Java_ai_bithuman_expression2_Native_feed",
    "Java_ai_bithuman_expression2_Native_pump",
    "Java_ai_bithuman_expression2_Native_pumpForPull",
    "Java_ai_bithuman_expression2_Native_pullToBuffer",
    "Java_ai_bithuman_expression2_Native_queuedFrames",
    "Java_ai_bithuman_expression2_Native_beginSegment",
    "Java_ai_bithuman_expression2_Native_endSegment",
    "Java_ai_bithuman_expression2_Native_reset",
    "FUN_001a7fbc", "FUN_001a80dc", "FUN_001a8500",
    "FUN_001a8404", "FUN_001a7a04", "FUN_001a84cc",
    "FUN_001aa594", "FUN_001aa40c", "FUN_001a82f0",
    "FUN_001a8230", "FUN_001a7cfc", "FUN_001a77c0",
    "FUN_001a9794",
]
TARGETS = {
    "FUN_001a7fbc": ["FUN_001a77c0", "FUN_001a7db0", "FUN_001acf1c", "FUN_001a80dc"],
    "FUN_001a80dc": ["FUN_001a8500"],
    "FUN_001a8500": ["FUN_001a9794"],
    "FUN_001a8404": ["FUN_001a7a04", "FUN_001a80dc", "FUN_001a82f0"],
    "FUN_001aa594": ["FUN_001a8404", "FUN_001a82f0"],
    "FUN_001a82f0": ["FUN_001a7a04"],
    "Java_ai_bithuman_expression2_Native_pullToBuffer": ["FUN_001aa40c"],
}
JVM_METHODS = ["feed", "enqueue", "startWorker", "runWorker", "pumpQuietly",
               "drainPending", "beginSegment", "flushTail", "resetState", "pull", "stamp"]
# All these excerpts are tagged as *Ghidra reconstructions*, not original C++.
LEXICAL = re.compile(
    r"memcpy|memmove|memset|operator_new|operator_delete|free\(|malloc|"
    r"condition_variable|mutex::|0x124800|0x1247ff|0x2af80|0x8980|"
    r"44000|0x6400|0x47e0|0xd0|0x7c|GetDirectBuffer|"
    r"FUN_001a9794|FUN_001aa40c|FUN_001a7a04|FUN_001a82f0|"
    r"FUN_001a8500|TfLiteSignatureRunnerInvoke", re.I
)

# Source-level gates: each literal must appear in the Ghidra reconstruction of
# the exact original ARM64 function whose machine bytes are also rehashed.
# These checks do NOT prove runtime equivalence or safe concurrent execution.
SEMANTIC_MARKERS = {
    "FUN_001a7fbc": [
        "FUN_001a77c0(param_1,0)", "FUN_001a7db0(uVar1,uVar2)",
        "operator_new(0x3e800)", "FUN_001acf1c(param_1 + 7",
        "param_1[10] =", "param_1[0xb] =", "FUN_001a80dc(param_1,0,param_4)",
    ],
    "FUN_001a80dc": [
        "lVar4 = 0x6400;", "lVar4 = 44000;", "0x47e0",
        "param_1[10] < lVar4", "param_2 & 1",
        "(double)param_1[10] / 800.0", "param_1[0x1a]",
        "0x2c) <= iVar3 + (int)lVar4", "FUN_001a8500(param_1",
    ],
    "FUN_001a7a04": [
        "condition_variable::wait", "lVar11 + 0x530", "lVar11 + 0x538",
        "puVar7[4] = uVar12;", "puVar13[4] = 0;", "param_1[0x1a] = lVar11;",
    ],
    "FUN_001aa40c": [
        "(param_1 + 0x7c)", "(param_1 + 0xd0) != 0",
        "puVar5[4] = 0;", "*(long *)(param_1 + 0xd0) = *(long *)(param_1 + 0xd0) + -1;",
        "memcpy(param_2,__src,0x124800)", "operator_delete(__src)",
    ],
    "FUN_001a8230": [
        "(param_1 + 0x31) = 1;", "FUN_001a80dc(param_1,1);",
        "FUN_001a82f0(param_1,param_3);",
        "(param_1 + 0x30) = 0;", "(param_1 + 0x31) = 0;",
    ],
    "FUN_001a77c0": [
        "FUN_001a7a04(param_1,1,0,&local_60);",
        "param_1[10] = 0;", "param_1[8] = param_1[7];",
        "param_1[0x1a] = 0;",
    ],
    "Java_ai_bithuman_expression2_Native_pullToBuffer": [
        "+ 0x730", "+ 0x738", "0x1247ff < (long)this",
        "FUN_001aa40c(param_3,lVar9,this",
    ],
    "Java_ai_bithuman_expression2_Native_feed": [
        "+ 0x668", "FUN_001a7fbc(param_3,*plVar8,uVar14",
    ],
}

INDIRECT = re.compile(r"^\s*(?:blr|br)\s+", re.I)
VIRTUAL = re.compile(r"\(\s*\*\s*\(?\s*(?:code\s*\*)?\s*\*|vtable|virtual", re.I)


def read_tsv(path):
    with path.open() as f:
        return list(csv.DictReader(f, delimiter="\t"))


def method_bodies(source, name):
    # Preserve every compiler-generated Kotlin/JVM overload and its exact signature.
    hs = list(re.finditer(r"(?m)^  (?:public|protected|private) [^\n;]+\([^;\n]*\);", source))
    candidates = []
    for i, h in enumerate(hs):
        if re.search(r"\b" + re.escape(name) + r"\(", h.group()):
            candidates.append((
                h.group().strip(),
                source[h.start():hs[i + 1].start() if i + 1 < len(hs) else len(source)]
            ))
    if not candidates:
        raise AssertionError("JVM method absent from original SDK: " + name)
    return candidates


def scan_instructions(native, row, with_sha=False):
    addr = row["address"]
    files = list((native / "native-instruction-bytes").glob("*_" + addr + ".lst"))
    if len(files) != 1:
        raise AssertionError(("Original ARM64 listing absent or ambiguous", addr, len(files)))
    instructions = []
    h = hashlib.sha256()
    for line in files[0].read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t", 2)
        if len(parts) != 3:
            raise AssertionError(("Invalid original instruction record", addr, line))
        pc, raw, asm = parts
        ins_bytes = bytes.fromhex(raw)
        h.update(ins_bytes)
        instructions.append((pc, raw, asm))
    if with_sha:
        assert h.hexdigest() == row["bytes_sha256"], ("original bytes changed", addr)
        assert len(instructions) == int(row["instruction_count"])
    sites = []
    for i, (pc, raw, asm) in enumerate(instructions):
        if INDIRECT.search(asm):
            sites.append({
                "pc": pc, "machine_instruction_bytes": raw, "instruction": asm,
                "preceding_two_original_instructions": [
                    {"pc": p, "instruction": a} for p, _, a in instructions[max(0, i-2):i]
                ],
                "target_resolution": "NOT_PROVEN_BY_REGISTER_BRANCH_ALONE",
            })
    return sites, h.hexdigest(), len(instructions)


def main(native, jvm, out):
    rows = read_tsv(native / "functions.tsv")
    assert len(rows) == 1035, "Original function corpus differs"
    by_name = {r["name"]: r for r in rows}
    by_addr = {r["address"]: r for r in rows}
    assert len(by_addr) == len(rows)
    graph = defaultdict(set)
    for e in read_tsv(native / "call-edges.tsv"):
        graph[e["caller_address"]].add(e["callee_address"])
    for caller, targets in TARGETS.items():
        addr = by_name[caller]["address"]
        for target in targets:
            assert by_name[target]["address"] in graph[addr], ("Missing direct edge", caller, target)

    # Also scan all 1035 original functions, not just previously selected JNI roots.
    all_sites = {}
    all_asm_count = 0
    for row in rows:
        sites, _, count = scan_instructions(native, row, with_sha=False)
        all_asm_count += count
        if sites:
            all_sites[row["address"]] = sites
    assert all_asm_count == 65933, ("Original ARM64 corpus instruction count differs", all_asm_count)

    depth = {}
    seeds = [by_name[n]["address"] for n in FOCUS]
    queue = deque((a, 0) for a in seeds)
    while queue:
        a, d = queue.popleft()
        if a in depth and depth[a] <= d:
            continue
        depth[a] = d
        if d < 2:
            for b in graph[a]:
                if b in by_addr:
                    queue.append((b, d + 1))

    focus = []
    for name in FOCUS:
        row = by_name[name]
        addr = row["address"]
        sites, digest, count = scan_instructions(native, row, with_sha=True)
        pseudos = list((native / "decompiler-reconstruction-not-original").glob("*_" + addr + ".c"))
        assert len(pseudos) == 1, ("Ghidra pseudocode missing", name, addr)
        raw_lines = pseudos[0].read_text().splitlines()
        original_pseudocode = "\n".join(raw_lines)
        markers = SEMANTIC_MARKERS.get(name, [])
        missing = [m for m in markers if m not in original_pseudocode]
        assert not missing, ("Original semantic evidence missing", name, missing)
        hits = [
            {"line": i + 1, "reconstructed_code_excerpt": text.strip()[:260]}
            for i, text in enumerate(raw_lines) if LEXICAL.search(text)
        ]
        dispatch_hints = [
            {"line": i + 1, "reconstructed_code_excerpt": text.strip()[:220]}
            for i, text in enumerate(raw_lines) if VIRTUAL.search(text)
        ]
        focus.append({
            "function": name, "address": addr, "original_arm64_sha256": digest,
            "instruction_count": count,
            "direct_callees": [
                {"address": d, "name": by_addr[d]["name"] if d in by_addr else "EXTERNAL_OR_NOT_INDEXED"}
                for d in sorted(graph[addr])
            ],
            "indirect_register_sites": sites,
            "source_gate_verified_original_function_markers": markers,
            "ghidra_reconstruction_matches": hits[:35],
            "ghidra_possible_function_pointer_matches": dispatch_hints[:20],
            "note": "Static candidate evidence only, not runtime or source-code identity",
        })

    # Original JVM bytecode verified independently of native metadata.
    names = (jvm / "class-names.txt").read_text().splitlines()
    assert len(names) == 92
    cls = "ai.bithuman.expression2.Expression2Avatar"
    javap = (jvm / "classes" / ("%05d.javap.txt" % (names.index(cls) + 1))).read_text()
    jvm_data = []
    for name in JVM_METHODS:
        for signature, body in method_bodies(javap, name):
            jvm_data.append({
                "method": name, "original_jvm_signature": signature,
                "original_javap_body_sha256": hashlib.sha256(body.encode()).hexdigest(),
                "has_queue_operations": bool(re.search(r"ArrayBlockingQueue\.(?:put|poll|take)", body)),
                "has_native_feed": "Native.feed:" in body,
                "has_native_pump": "Native.pump:" in body,
                "has_native_pull": "Native.pullToBuffer:" in body,
                "has_conditional_wait": "Condition.await:" in body,
                "has_end_segment": "Native.endSegment:" in body,
                "has_begin_segment": "Native.beginSegment:" in body,
                "has_reset": "Native.reset:" in body,
                "has_stamp": "Method stamp:" in body,
            })

    scoped = [
        {"function": by_addr[a]["name"], "address": a, "distance_from_focus": depth[a],
         "indirect_register_sites": all_sites[a]}
        for a in sorted(all_sites) if a in depth
    ]
    output = {
        "sdk": "ai.bithuman:expression2-android:0.6.2",
        "original_evidence_run": 43328017533,
        "verified_origin": "Original ARM64 instruction byte SHA256 and original JVM javap; Ghidra is reconstruction",
        "functions_in_original_static_direct_call_corpus": len(rows),
        "original_machine_instructions": all_asm_count,
        "global_register_indirect_branch_sites": sum(len(s) for s in all_sites.values()),
        "global_functions_containing_register_indirect_branches": len(all_sites),
        "indirect_branch_sites_within_two_direct_call_hops_of_focus": sum(len(s["indirect_register_sites"]) for s in scoped),
        "relevant_register_indirect_sites": scoped,
        "focused_original_function_evidence": focus,
        "original_jvm_lifecycle_methods": jvm_data,
        "blocked_conclusions": [
            "BLR/BR alone cannot prove a callee: resolve register provenance and live dispatch",
            "Ghidra C-like reconstruction is not the original C++ source",
            "Static queue transfer does not prove absence of ownership races under reset/close",
            "No original-versus-custom end-to-end frames, latency or SDK parity measured here",
            "No Essence2 analysis",
        ]
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / "expression2-native-indirect-ownership-evidence.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n"
    )
    md = [
        "# Expression 2 native indirect-call and buffer-lifecycle original-code audit", "",
        "This is evidence extraction from the unmodified original SDK 0.6.2, not a custom implementation.", "",
        "## Exact instruction coverage", "",
        "- Original ARM64 functions inspected: " + str(len(rows)),
        "- Original machine instructions indexed: " + str(all_asm_count),
        "- Register-indirect BR/BLR instruction sites (whole existing corpus): " +
          str(output["global_register_indirect_branch_sites"]),
        "- Register-indirect sites within two direct-call edges of focus: " +
          str(output["indirect_branch_sites_within_two_direct_call_hops_of_focus"]),
        "- Focused function byte hashes reverified: " + str(len(focus)),
        "- Original JVM lifecycle bytecode methods reviewed: " + str(len(jvm_data)), "",
        "## Focused original function signatures and unresolved indirect calls", "",
        "| Function | Address | ARM64 instructions | BR/BLR sites |",
        "|---|---|---:|---:|",
    ]
    for f in focus:
        md.append("| " + f["function"] + " | " + f["address"] + " | " +
                  str(f["instruction_count"]) + " | " + str(len(f["indirect_register_sites"])) + " |")
    md += ["", "## Buffer / native queue source evidence (Ghidra reconstruction only)", "",
           "These lines are machine-code-derived candidate evidence; their original C++ types are NOT verified.", ""]
    relevant = ["FUN_001a7fbc", "FUN_001a80dc", "FUN_001a8500", "FUN_001a7a04",
                "FUN_001aa40c", "FUN_001a8230", "FUN_001a77c0",
                "Java_ai_bithuman_expression2_Native_pullToBuffer"]
    for f in focus:
        if f["function"] not in relevant:
            continue
        md.append("### " + f["function"] + " @" + f["address"])
        md += ["- [" + str(x["line"]) + "] " + x["reconstructed_code_excerpt"].replace("|","\\|")
               for x in f["ghidra_reconstruction_matches"][:14]]
        if not f["ghidra_reconstruction_matches"]:
            md.append("- No lexical signal; do not infer absence of the behavior.")
        md.append("")
    md += ["## Explicit non-conclusions", ""] + ["- " + s for s in output["blocked_conclusions"]]
    (out / "expression2-native-indirect-ownership-evidence.md").write_text("\n".join(md) + "\n")
    # One compact log summary; full original-address source references remain in artifact.
    print("EXPR2_NATIVE_INDIRECT_OWNERSHIP_EVIDENCE_PASS",
          len(focus), "ORIGINAL_ARM64_SHA_VERIFIED",
          len(jvm_data), "JVM_METHODS",
          len(SEMANTIC_MARKERS), "ORIGINAL_NATIVE_LIFECYCLE_SOURCE_GATES",
          output["global_register_indirect_branch_sites"], "REGISTER_INDIRECT_SITES",
          flush=True)
    for f in focus:
        if f["function"] in relevant:
            print("EVIDENCE", f["function"], f["address"],
                  "blr_br", len(f["indirect_register_sites"]),
                  "reconstructed_line_hits", len(f["ghidra_reconstruction_matches"]), flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--native", type=Path, required=True)
    p.add_argument("--jvm", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    main(args.native, args.jvm, args.out)
