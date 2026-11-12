#!/usr/bin/env python3
"""Inspect public bitHuman IMX containers and Android AAR SDKs without credentials."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from datetime import datetime, timezone

INTERESTING = re.compile(r"(avatar|expression|essence|credential|meter|model|native|decoder|frame|backend|routing|option|render|buffer|store)", re.I)
PRINTABLE = re.compile(rb"[ -~]{6,140}")

def filehash(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def execute(command, timeout=80):
    try:
        p = subprocess.run(command, text=True, capture_output=True, timeout=timeout, check=False)
        return {"exit": p.returncode, "stdout": p.stdout[:180000], "stderr": p.stderr[-4000:]}
    except (OSError, subprocess.TimeoutExpired) as e:
        return {"exit": None, "stdout": "", "stderr": str(e)}

def file_record(path):
    if not path.exists() or not path.is_file():
        return {"state": "MISSING"}
    with path.open("rb") as f:
        first = f.read(256)
        if path.stat().st_size > 65536:
            f.seek(max(0, path.stat().st_size - 65536))
        last = f.read(65536)
    safe_ascii = [match.decode("ascii", "replace") for match in PRINTABLE.findall(first + last)]
    return {
        "state": "FOUND",
        "filename": path.name,
        "size_bytes": path.stat().st_size,
        "sha256": filehash(path),
        "magic_hex": first[:32].hex(),
        "magic_ascii": "".join(chr(x) if 32 <= x <= 126 else "." for x in first[:32]),
        "is_zip": zipfile.is_zipfile(path),
        "header_tail_ascii_preview": safe_ascii[:90],
    }

def inspect_imx(path, cli):
    record = file_record(path)
    if record["state"] != "FOUND":
        return record
    if cli is not None and cli.exists():
        result = execute([str(cli), "open", str(path), "--json"], timeout=150)
        if result["exit"] != 0:
            alt = execute([str(cli), "--json", "open", str(path)], timeout=150)
            if alt["exit"] == 0:
                result = alt
        record["official_cli_exit"] = result["exit"]
        record["official_cli_stderr"] = result["stderr"]
        if result["exit"] == 0:
            try:
                record["official_cli_json"] = json.loads(result["stdout"])
            except json.JSONDecodeError:
                record["official_cli_stdout"] = result["stdout"]
        else:
            record["official_cli_error"] = result["stdout"][-5000:]
    else:
        record["official_cli_exit"] = "CLI_MISSING"
    return record

def inspect_aar(path):
    record = file_record(path)
    if record["state"] != "FOUND":
        return record
    if not zipfile.is_zipfile(path):
        record["error"] = "AAR_NOT_ZIP"
        return record
    with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(path) as z:
        temp = Path(tmp)
        names = z.namelist()
        record["file_listing"] = [
            {"path": item.filename, "bytes": item.file_size}
            for item in z.infolist() if not item.is_dir()
        ][:300]
        record["class_signatures"] = {}
        record["native_libraries"] = {}
        if "classes.jar" in names:
            jar = temp / "classes.jar"
            jar.write_bytes(z.read("classes.jar"))
            with zipfile.ZipFile(jar) as j:
                classes = sorted(set(
                    n[:-6].replace("/", ".")
                    for n in j.namelist()
                    if n.endswith(".class") and n.startswith("ai/bithuman/")
                    and "$" not in n
                ))
            record["java_classes"] = classes
            if shutil.which("javap"):
                selected = [c for c in classes if INTERESTING.search(c.split(".")[-1])][:45]
                for cls in selected:
                    out = execute(["javap", "-classpath", str(jar), "-public", cls], timeout=15)
                    if out["exit"] == 0:
                        record["class_signatures"][cls] = out["stdout"][:9000]
        for idx, name in enumerate(x for x in names if x.endswith(".so")):
            target = temp / ("lib-" + str(idx) + ".so")
            target.write_bytes(z.read(name))
            elf = execute(["readelf", "-h", str(target)])
            needed = execute(["readelf", "-d", str(target)])
            symbols = execute(["nm", "-D", "--defined-only", str(target)], timeout=45)
            exports = [ln.split()[-1] for ln in symbols["stdout"].splitlines() if ln.split()]
            record["native_libraries"][name] = {
                "size_bytes": target.stat().st_size,
                "machine": next((ln.strip() for ln in elf["stdout"].splitlines() if "Machine:" in ln), None),
                "needed": re.findall(r"\(NEEDED\).*?\[([^\]]+)\]", needed["stdout"]),
                "exported_symbols": len(exports),
                "interesting_symbols": [x for x in exports if INTERESTING.search(x)][:70],
                "jni_exports": [x for x in exports if x.startswith("Java_")][:70],
            }
    return record

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--imx", action="append", default=[], help="label=/absolute/file.imx")
    p.add_argument("--aar", action="append", default=[], help="label=/absolute/file.aar")
    p.add_argument("--cli", type=Path)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    def entries(values):
        for v in values:
            name, path = v.split("=", 1)
            yield name, Path(path)
    result = {
        "utc": datetime.now(timezone.utc).isoformat(),
        "scope": "Read-only, public samples, zero API credentials and no avatar inference",
        "cli": execute([str(args.cli), "--version"]) if args.cli and args.cli.exists() else {"exit": "CLI_MISSING"},
        "imx": {name: inspect_imx(path, args.cli) for name, path in entries(args.imx)},
        "aar": {name: inspect_aar(path) for name, path in entries(args.aar)},
    }
    (args.out / "analysis.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = ["# bitHuman public IMX + Android AAR deep audit", "",
             "- UTC: " + result["utc"], "- No credentials used.", ""]
    for kind in ("imx", "aar"):
        for name, row in result[kind].items():
            lines += ["## " + kind.upper() + " · " + name, "",
                      "- State: " + row["state"]]
            for k in ("size_bytes", "sha256", "magic_hex", "magic_ascii", "is_zip", "official_cli_exit"):
                if k in row:
                    lines.append("- " + k + ": " + str(row[k]))
            if "official_cli_json" in row:
                lines.append("- Official CLI manifest:")
                lines.append("  ~~~json")
                lines += ["  " + ln for ln in json.dumps(row["official_cli_json"], ensure_ascii=False, indent=2).splitlines()[:150]]
                lines.append("  ~~~")
            if "official_cli_error" in row:
                lines.append("- CLI error: " + row["official_cli_error"][:600].replace("\n", " "))
            if "official_cli_stdout" in row:
                lines.append("- CLI output: " + row["official_cli_stdout"][:4000].replace("\n", " "))
            if "java_classes" in row:
                lines.append("- Java classes: " + str(len(row["java_classes"])))
                lines += ["  - " + c for c in row["java_classes"][:45]]
            for libname, lib in row.get("native_libraries", {}).items():
                lines.append("- Native library: " + libname)
                lines.append("  - Required: " + ", ".join(lib["needed"]))
                lines.append("  - Symbols: " + str(lib["exported_symbols"]))
            lines.append("")
    lines += ["## Limitations", "",
              "- Static inspection of SDK binaries and container manifest does not prove image rendering.",
              "- Android 14 Google APIs x86_64 NativeBridge tests JNI loading; CPU/NPU performance requires separate validation.",
              "- Inspecting an IMX file does not reconstruct the private portrait-to-avatar training pipeline.",
              "- No vendor IMX or AAR binaries are published as artifacts in this workflow.",
              ""]
    (args.out / "analysis.md").write_text("\n".join(lines), encoding="utf-8")
    print("SUMMARY:")
    for family in ("imx", "aar"):
        for name, record in result[family].items():
            print(name, family, record["state"], "bytes=", record.get("size_bytes"),
                  "cli_exit=", record.get("official_cli_exit"))
    print("REPORT_PATH", args.out.resolve())

if __name__ == "__main__":
    main()
