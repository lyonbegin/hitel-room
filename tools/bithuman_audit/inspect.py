#!/usr/bin/env python3
"""Read-only audit of the public bitHuman Expression 2 IMX and Android AAR."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET


def digest(path):
    sha = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()


def examine_file(path):
    if path is None or not path.is_file():
        return {"status": "NOT_DOWNLOADED"}
    head = path.open("rb").read(64)
    kind = ("ZIP" if zipfile.is_zipfile(path) else
            "ELF" if head.startswith(b"\x7fELF") else
            "HTML_RESPONSE" if b"<html" in head.lower() else
            "UNKNOWN_CONTAINER")
    return {
        "status": "DOWNLOADED",
        "filename": path.name,
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "magic_hex": head[:32].hex(),
        "format_guess": kind,
    }


def zip_inventory(path):
    with zipfile.ZipFile(path) as z:
        entries = [item for item in z.infolist() if not item.is_dir()]
        unsafe = [
            i.filename for i in entries
            if i.filename.startswith("/") or ".." in Path(i.filename).parts
        ]
        return {
            "entries": len(entries),
            "uncompressed_bytes": sum(i.file_size for i in entries),
            "types": dict(Counter(Path(i.filename).suffix.lower() for i in entries)),
            "largest_entries": [
                {"path": i.filename, "bytes": i.file_size}
                for i in sorted(entries, key=lambda x: x.file_size, reverse=True)[:40]
            ],
            "manifest_candidates": [
                i.filename for i in entries
                if "manifest" in i.filename.lower() or i.filename.endswith(".json")
            ][:100],
            "native_libraries": [
                i.filename for i in entries if i.filename.endswith(".so")
            ][:100],
            "unsafe_archive_paths": unsafe[:20],
        }


def run_command(args, timeout=20):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return p.stdout if p.returncode == 0 else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


def inspect_aar(path):
    result = {
        "java_classes": [],
        "public_api": [],
        "native_libraries": {},
        "manifest_text": None,
    }
    with zipfile.ZipFile(path) as archive, tempfile.TemporaryDirectory() as tmp:
        temporary = Path(tmp)
        names = archive.namelist()
        if "AndroidManifest.xml" in names:
            manifest = archive.read("AndroidManifest.xml")
            if manifest.lstrip().startswith(b"<"):
                result["manifest_text"] = manifest.decode("utf-8", "replace")[:12000]
        if "classes.jar" in names:
            jar = temporary / "classes.jar"
            jar.write_bytes(archive.read("classes.jar"))
            if zipfile.is_zipfile(jar):
                with zipfile.ZipFile(jar) as classes:
                    result["java_classes"] = sorted(
                        name[:-6].replace("/", ".")
                        for name in classes.namelist()
                        if name.endswith(".class") and "$" not in name
                        and name.startswith("ai/bithuman/")
                    )[:300]
            if shutil.which("javap"):
                for cls in result["java_classes"][:75]:
                    signature = run_command(["javap", "-classpath", str(jar), "-public", cls])
                    if signature:
                        result["public_api"].append({
                            "class": cls,
                            "signature": signature[:6000],
                        })
        for index, name in enumerate(n for n in names if n.endswith(".so")):
            if index >= 35:
                break
            target = temporary / ("lib_" + str(index) + ".so")
            target.write_bytes(archive.read(name))
            hdr = run_command(["readelf", "-h", str(target)])
            sym = run_command(["nm", "-D", "--defined-only", str(target)], 30)
            exports = [
                line.split()[-1] for line in sym.splitlines() if line.split()
            ]
            result["native_libraries"][name] = {
                "elf_machine": next(
                    (line.strip() for line in hdr.splitlines() if "Machine:" in line), None
                ),
                "exported_symbols": len(exports),
                "relevant_symbols": [
                    name for name in exports
                    if any(s in name.lower() for s in ("java_", "jni_", "render", "avatar", "expression"))
                ][:200],
            }
    return result


def inspect_pom(path):
    if path is None or not path.is_file():
        return {"status": "NOT_DOWNLOADED"}
    try:
        root = ET.fromstring(path.read_bytes())
        def local_text(el, field):
            return next((x.text for x in el if x.tag.split("}")[-1] == field), None)
        deps = []
        for e in root.iter():
            if e.tag.split("}")[-1] == "dependency":
                deps.append({field: local_text(e, field)
                             for field in ("groupId", "artifactId", "version", "scope")})
        return {"status": "DOWNLOADED", "dependencies": deps}
    except ET.ParseError as exc:
        return {"status": "UNREADABLE", "reason": str(exc)}


def audit(imx, aar, pom):
    data = {
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "method": "public artifact static inventory; no execution or authentication changes",
        "imx": examine_file(imx),
        "aar": examine_file(aar),
        "pom": inspect_pom(pom),
    }
    for label, path in (("imx", imx), ("aar", aar)):
        if data[label]["status"] == "DOWNLOADED" and zipfile.is_zipfile(path):
            try:
                data[label]["zip"] = zip_inventory(path)
                if label == "aar":
                    data[label]["android"] = inspect_aar(path)
            except (OSError, ValueError, zipfile.BadZipFile) as exc:
                data[label]["inspection_error"] = str(exc)
    return data


def render_markdown(data):
    lines = [
        "# bitHuman Expression 2 binary structure audit",
        "",
        "Date UTC: " + data["generated_utc"],
        "Scope: downloaded public IMX, AAR, POM; metadata only.",
        "",
    ]
    for label in ("imx", "aar", "pom"):
        item = data[label]
        lines += ["## " + label.upper(), "", "Status: " + item["status"], ""]
        for field in ("filename", "bytes", "sha256", "magic_hex", "format_guess"):
            if field in item:
                lines.append("- " + field + ": " + str(item[field]))
        if "zip" in item:
            archive = item["zip"]
            lines += [
                "- Zip entries: " + str(archive["entries"]),
                "- Uncompressed bytes: " + str(archive["uncompressed_bytes"]),
                "- Largest files:",
            ]
            for entry in archive["largest_entries"][:20]:
                lines.append("  - " + entry["path"] + ": " + str(entry["bytes"]))
            lines += ["- Native libraries:"]
            lines += ["  - " + x for x in archive["native_libraries"][:40]]
            lines += ["- Manifest candidates:"]
            lines += ["  - " + x for x in archive["manifest_candidates"][:40]]
        if "android" in item:
            detail = item["android"]
            lines.append("- Kotlin/Java public class names: " + str(len(detail["java_classes"])))
            lines += ["  - " + x for x in detail["java_classes"][:75]]
            for lib, symbols in detail["native_libraries"].items():
                lines.append("- " + lib + ": " + str(symbols["exported_symbols"]) + " exports")
        if "dependencies" in item:
            for dep in item["dependencies"]:
                lines.append("- " + str(dep))
        lines.append("")
    lines += [
        "## Interpretation",
        "",
        "- AAR APIs and IMX container files do not disclose the server-side portrait training process.",
        "- Runtime speed, billing, behavior after network loss, and identity quality require real-device tests.",
        "- No IMX/AAR binaries are stored in this report or uploaded as workflow artifacts.",
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--imx", type=Path)
    parser.add_argument("--aar", type=Path)
    parser.add_argument("--pom", type=Path)
    parser.add_argument("--output", type=Path, default=Path("reports/bithuman"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    report = audit(args.imx, args.aar, args.pom)
    (args.output / "report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (args.output / "report.md").write_text(render_markdown(report), encoding="utf-8")
    print("IMX:", report["imx"]["status"], "AAR:", report["aar"]["status"])
    print("Report:", args.output.resolve())


if __name__ == "__main__":
    main()
