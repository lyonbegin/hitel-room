#!/usr/bin/env python3
"""Inventory every exact retry-error use in all DEX shards; trace each occurrence.

No error string, network response, success flag or original instruction is removed.
Each added call has zero arguments and uses no original registers.
"""
from pathlib import Path
import argparse, hashlib, json, re, subprocess

METHOD = re.compile(r"(?ms)^\.method[^\n]*\n.*?^\.end method$")
NAMES = {"ai_engine_check_fail", "network_server_error_toast_msg",
         "setting_snackbar_error_retry", "snackbar_error_retry"}
PREFIX = "com/lguplus/aicallagent/"
TRACE = "Lcom/lguplus/aicallagent/hitelqa/DiagTrace;"

def digest(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def resolve_resources(aapt, apk):
    dump = subprocess.check_output([str(aapt), "dump", "resources", str(apk)],
                                   text=True, encoding="utf-8", errors="strict")
    resources = {}
    for m in re.finditer(r"resource (0x[0-9a-fA-F]+) string/(\S+)", dump):
        if m[2] in NAMES:
            resources[m[2]] = m[1].lower()
    if set(resources) != NAMES:
        raise RuntimeError("Exact retry resource set changed: " + repr(resources))
    return resources

def matched_resource(line, resources):
    # Match actual instructions, never comments, annotations or field declarations.
    t = line.strip()
    if t.startswith("sget "):
        m = re.search(r"->([A-Za-z0-9_]+):I\s*$", t)
        if m and m[1] in resources and "/R$string;->" in t:
            return m[1]
    if re.match(r"const(?:/high16|/16)?\s", t):
        m = re.search(r",\s*(0x[0-9a-fA-F]+)\s*$", t)
        if m:
            for name, value in resources.items():
                if int(m[1], 16) == int(value, 16):
                    return name
    if t.startswith(("const-string ", "const-string/jumbo ")):
        # baksmali may emit either the UTF-8 literal or escaped Unicode.
        literal = t[t.find('"'):]
        try:
            value = json.loads(literal)
        except (ValueError, TypeError):
            value = ""
        if "요청을 처리하지 못했어요" in value and "잠시 후 다시 시도" in value:
            return "literal_exact_retry_error"
    return None

def helper_source(desc, sites):
    out = [f".class public final {desc}", ".super Ljava/lang/Object;", ""]
    for site in sites:
        message = ("RETRY_ERROR_SITE=" + site["site_id"] + " RESOURCE=" + site["resource"]
                   + " CLASS=" + site["class"] + " METHOD=" + site["method"])
        # Best-effort diagnostics cannot change an original failure into a crash.
        out += [f'.method public static {site["trace_method"]}()V', "    .registers 2",
                "    :trace_start", '    const-string v0, "IXIO_RETRY_ERROR"',
                "    const-string v1, " + json.dumps(message, ensure_ascii=False),
                f"    invoke-static {{v0, v1}}, {TRACE}->fixedTag(Ljava/lang/String;Ljava/lang/String;)V",
                "    :trace_end", "    return-void",
                "    .catch Ljava/lang/Throwable; {:trace_start .. :trace_end} :trace_failed",
                "    :trace_failed", "    move-exception v0", "    return-void", ".end method", ""]
    return "\n".join(out)

def process(root, resources, instrument=False):
    inventory, changes, helpers, total = [], [], [], 0
    folders = sorted((p for p in root.glob("smali*")
                      if p.is_dir() and re.fullmatch(r"smali\d+", p.name)),
                     key=lambda p: int(p.name[5:]))
    if not folders:
        raise RuntimeError("No DEX disassembly found")
    # Preflight the complete input before mutating any shard.
    planned = []
    for folder in folders:
        sites = []
        desc = f"L{PREFIX}hitelqa/RetryErrorTraceShard{folder.name[5:]};"
        helper = folder / (desc[1:-1] + ".smali")
        if helper.exists():
            raise RuntimeError("Retry instrumentation already present: " + str(helper))
        for path in sorted(folder.rglob("*.smali")):
            total += 1
            rel = path.relative_to(folder).as_posix()
            if not rel.startswith(PREFIX) or "/hitelqa/" in rel or "/R$" in rel:
                continue
            src = path.read_text(encoding="utf-8")
            if "hitelqa/RetryErrorTraceShard" in src:
                raise RuntimeError("Partial retry instrumentation already present: " + rel)
            replacements = []
            for m in METHOD.finditer(src):
                body = m.group()
                header = body.splitlines()[0]
                method = header.rsplit(" ", 1)[-1]
                lines = body.splitlines(keepends=True)
                updated = []
                for n, line in enumerate(lines):
                    resource = matched_resource(line, resources)
                    if resource:
                        trace_method = f"site{len(sites):05d}"
                        site = {"site_id": folder.name + "_" + trace_method,
                                "dex": "classes" + (folder.name[5:] if folder.name != "smali1" else "") + ".dex",
                                "class": rel[:-6], "method": method, "resource": resource,
                                "instruction_index": n, "trace_method": trace_method}
                        sites.append(site)
                        if instrument:
                            updated.append(f"    invoke-static {{}}, {desc}->{trace_method}()V\n")
                    updated.append(line)
                if instrument and "".join(updated) != body:
                    replacements.append((m.start(), m.end(), "".join(updated)))
            new = src
            for start, end, body in reversed(replacements):
                new = new[:start] + body + new[end:]
            if new != src:
                # Removing only inserted no-register calls must recover identical bytes.
                recovered = re.sub(r"(?m)^    invoke-static \{\}, " + re.escape(desc)
                                   + r"->site\d+\(\)V\n", "", new)
                if recovered != src:
                    raise RuntimeError("Original method changed unexpectedly: " + rel)
                planned.append((path, new))
                changes.append({"dex": folder.name, "file": rel,
                                "before": digest(src), "after": digest(new)})
        inventory.extend(sites)
        if instrument and sites:
            planned.append((helper, helper_source(desc, sites)))
            helpers.append(str(helper.relative_to(root)))
    if not inventory:
        raise RuntimeError("No exact retry-error call sites found")
    for path, content in planned:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8", newline="\n")
    return {"scanned_dex_shards": [p.name for p in folders], "scanned_smali_files": total,
            "resources": resources, "site_count": len(inventory), "sites": inventory,
            "instrumented": instrument, "changes": changes, "helper_files": helpers,
            "original_instructions_preserved": True, "errors_suppressed": False,
            "server_success_fabricated": False}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--aapt", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--instrument", action="store_true")
    args = parser.parse_args()
    report = process(args.root, resolve_resources(args.aapt, args.apk), args.instrument)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    counts = {d: sum(s["dex"] == d for s in report["sites"])
              for d in sorted({s["dex"] for s in report["sites"]})}
    print("EXACT_RETRY_ERROR_INVENTORY", json.dumps({"shards": len(report["scanned_dex_shards"]),
          "sites": report["site_count"], "by_dex": counts, "instrumented": args.instrument}), flush=True)

if __name__ == "__main__":
    main()
