#!/usr/bin/env python3
"""Read-only inventory of *all types* of components in Expression2's vendor ELF.

Distinguishes machine-code functions from instruction constants, rodata, writable
state, ELF metadata, relocations, dynamic dependencies, packaged AAR resources,
and separately downloaded IMX resource/model members. It does not patch,
relocate, transplant or execute any third-party code.
"""
import argparse
import collections
import csv
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

from elftools.elf.elffile import ELFFile
from elftools.elf.relocation import RelocationSection
from elftools.elf.sections import SymbolTableSection

SHF_WRITE = 0x1
SHF_ALLOC = 0x2
SHF_EXECINSTR = 0x4
SHF_TLS = 0x400
STRING = re.compile(rb"[\x20-\x7e]{6,}")
LITERAL = re.compile(r"(?:^|[, #])(?:0x[0-9a-fA-F]+)")
SOURCE_TAG = "ai.bithuman:expression2-android:0.6.2"
EXPECTED_AAR_SHA = "067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584"
MODEL_NAMES = {"combined_litert.tflite", "canon.bin"}
MAGICS = {
    b"\x7fELF": "ELF executable/shared object",
    b"\x89PNG\r\n\x1a\n": "PNG image",
    b"\xff\xd8\xff": "JPEG image",
    b"PK\x03\x04": "ZIP/JAR",
    b"IMX\x00": "IMX model container",
    b"RIFF": "RIFF/WAV/AVI",
    b"\x1f\x8b\x08": "gzip",
    b"\x28\xb5\x2f\xfd": "zstd",
    b"glTF": "glTF model",
}
CATEGORIES = {
    "code": "Executable instructions (.text and related)",
    "readonly_constants": "Read-only constants, lookup tables, and static strings",
    "writable_state": "Writable globals, BSS and thread-local state",
    "linkage_relocations": "Dynamic relocation, GOT/PLT, init/fini and linkage",
    "unwind_metadata": "Stack unwinding, exception and debug metadata",
    "metadata": "ELF symbols, section/string tables and notes",
    "other": "Other ELF sections",
}


def categorize(name, flags, kind):
    if flags & SHF_TLS:
        return "writable_state"
    if name.startswith((".init_array", ".fini_array", ".preinit_array", ".got", ".plt")):
        return "linkage_relocations"
    if name.startswith((".rela", ".rel", ".dynamic")):
        return "linkage_relocations"
    if flags & SHF_EXECINSTR:
        return "code"
    if name.startswith((".eh_frame", ".gcc_except_table", ".ARM.exidx", ".ARM.extab")):
        return "unwind_metadata"
    if name.startswith((".rodata", ".data.rel.ro")):
        return "readonly_constants"
    if (flags & SHF_WRITE) or name.startswith((".bss", ".data", ".tbss", ".tdata")):
        return "writable_state"
    if name.startswith((".dynstr", ".dynsym", ".symtab", ".strtab", ".shstrtab", ".note", ".gnu", ".hash")):
        return "metadata"
    if (flags & SHF_ALLOC) and not (flags & SHF_WRITE):
        return "readonly_constants"
    return "other"


def package_class(name):
    if name.startswith("jni/") and name.endswith(".so"):
        return "native_shared_library"
    if name == "classes.jar":
        return "JVM_bytecode_archive"
    if name.startswith("assets/"):
        return "packaged_asset"
    if name.startswith("res/") or name in ("R.txt", "public.txt"):
        return "android_resource"
    if name in ("AndroidManifest.xml",):
        return "android_manifest"
    if name.startswith(("META-INF/", "libs/")):
        return "dependency_or_package_metadata"
    return "other_package_member"


def inspect(aar: Path, elf: Path, original_functions: Path | None, model_root: Path | None, imx: Path | None):
    digest = hashlib.sha256(aar.read_bytes()).hexdigest()
    if digest != EXPECTED_AAR_SHA:
        raise ValueError("Original AAR SHA256 mismatch: " + digest)
    with zipfile.ZipFile(aar) as z:
        packaged = [{
            "name": info.filename,
            "kind": package_class(info.filename),
            "size_bytes": info.file_size,
            "crc32": "%08x" % info.CRC,
        } for info in z.infolist() if not info.is_dir()]
        original_elf = z.read("jni/arm64-v8a/libexpr2jni.so")
    if hashlib.sha256(elf.read_bytes()).digest() != hashlib.sha256(original_elf).digest():
        raise ValueError("Extracted ELF does not equal AAR's ARM64 original")
    with elf.open("rb") as source:
        binary = ELFFile(source)
        if binary.elfclass != 64 or binary.little_endian is not True:
            raise ValueError("Expected original ELF64 little endian")
        if binary["e_machine"] != "EM_AARCH64":
            raise ValueError("Expected AArch64 ELF")
        sections = []
        section_objects = list(binary.iter_sections())
        for index, section in enumerate(section_objects):
            h = section.header
            name = section.name
            flags = int(h["sh_flags"])
            kind = categorize(name, flags, h["sh_type"])
            data = section.data() if str(h["sh_type"]) != "SHT_NOBITS" else b""
            strings = []
            if kind in ("readonly_constants", "writable_state") and data:
                for m in STRING.finditer(data):
                    if len(strings) >= 20: break
                    strings.append({
                        "offset_in_section": m.start(),
                        "text_excerpt": m.group(0)[:180].decode("ascii", "replace"),
                    })
            signatures = []
            if kind in ("readonly_constants", "other") and data:
                for pattern, label in MAGICS.items():
                    n = data.find(pattern)
                    if n >= 0:
                        signatures.append({"kind": label, "offset_in_section": n})
            sections.append({
                "index": index, "name": name, "category": kind,
                "type": str(h["sh_type"]), "flags": flags,
                "vaddr": hex(int(h["sh_addr"])),
                "file_offset": int(h["sh_offset"]), "size_bytes": int(h["sh_size"]),
                "alignment": int(h["sh_addralign"]),
                "sha256": hashlib.sha256(data).hexdigest() if data else None,
                "printable_string_count": len(STRING.findall(data)) if kind in ("readonly_constants", "writable_state") else 0,
                "sample_strings": strings, "possible_embedded_signatures": signatures,
            })
        segments = []
        for idx, segment in enumerate(binary.iter_segments()):
            h = segment.header
            segments.append({
                "index": idx, "type": str(h["p_type"]),
                "flags": int(h["p_flags"]),
                "virtual_address": hex(int(h["p_vaddr"])),
                "file_size_bytes": int(h["p_filesz"]),
                "memory_size_bytes": int(h["p_memsz"]),
            })
        imported, exported = [], []
        for section in section_objects:
            if not isinstance(section, SymbolTableSection):
                continue
            if section.name != ".dynsym":
                continue
            for sym in section.iter_symbols():
                if not sym.name: continue
                item = {"name": sym.name,
                        "binding": str(sym["st_info"]["bind"]),
                        "type": str(sym["st_info"]["type"])}
                if sym["st_shndx"] == "SHN_UNDEF":
                    imported.append(item)
                else:
                    item["value"] = hex(int(sym["st_value"]))
                    exported.append(item)
        needed = []
        dynamic = binary.get_section_by_name(".dynamic")
        if dynamic:
            for tag in dynamic.iter_tags():
                if tag.entry.d_tag == "DT_NEEDED":
                    needed.append(tag.needed)
        relocations = []
        relocation_stats = collections.Counter()
        for section in section_objects:
            if not isinstance(section, RelocationSection):
                continue
            target_index = int(section["sh_info"])
            target_name = (section_objects[target_index].name
                           if 0 < target_index < len(section_objects) else None)
            symtab = binary.get_section(section["sh_link"])
            for relocation in section.iter_relocations():
                sym_id = int(relocation["r_info_sym"])
                symbol = symtab.get_symbol(sym_id).name if sym_id and isinstance(symtab, SymbolTableSection) else ""
                typ = int(relocation["r_info_type"])
                relocation_stats[(section.name, typ)] += 1
                relocations.append({
                    "reloc_section": section.name,
                    "target_section_declared": target_name,
                    "offset": hex(int(relocation["r_offset"])),
                    "type_id": typ, "symbol": symbol,
                    "addend": int(relocation["r_addend"]) if relocation.is_RELA() else None,
                })
    references = collections.Counter()
    sample_ref = collections.defaultdict(list)
    function_count = None
    if original_functions:
        with original_functions.open(encoding="utf-8") as file:
            manifest = list(csv.DictReader(file, delimiter="\t"))
        function_count = len(manifest)
        for row in manifest:
            # This is a known set of instruction ranges from original Ghidra
            # analysis, not a claim that ELF symbol table exposes every function.
            if int(row["byte_count"]) <= 0:
                raise ValueError("Invalid original function byte length")
            references[row["root"]] += 1
            if len(sample_ref[row["root"]]) < 8:
                sample_ref[row["root"]].append(row["address"])
    model_members = []
    if model_root:
        root = Path(model_root)
        for path in sorted(root.rglob("*")):
            if path.is_file():
                model_members.append({
                    "relative_path": str(path.relative_to(root)),
                    "size_bytes": path.stat().st_size,
                    "is_required_android_expression2_model": path.name in MODEL_NAMES,
                })
    imx_inventory = []
    imx_integrity = None
    if imx is not None:
        # The 197MB original IMX is a SEPARATE model container, not part of the .so.
        from imx_v2 import parse as parse_imx, verify_member_hashes
        parsed = parse_imx(imx)
        imx_inventory = parsed["members"]
        imx_integrity = verify_member_hashes(imx, parsed)
        if imx_integrity["mismatches"]:
            raise ValueError("IMX manifest hash mismatch")
    total = collections.Counter()
    count = collections.Counter()
    for s in sections:
        total[s["category"]] += s["size_bytes"]
        count[s["category"]] += 1
    return {
        "source": SOURCE_TAG, "aar_sha256": digest,
        "original_elf_sha256": hashlib.sha256(elf.read_bytes()).hexdigest(),
        "original_elf_size": elf.stat().st_size,
        "elf_sections": sections,
        "load_segments": segments,
        "categories": {
            k: {"description": CATEGORIES[k], "section_count": count[k], "size_bytes": total[k]}
            for k in CATEGORIES
        },
        "full_dynamic_imports": imported, "full_dynamic_exports": exported,
        "dynamic_dependencies": needed,
        "full_relocations": relocations,
        "relocation_type_counts": [
            {"section": sect, "type_id": typ, "count": number}
            for (sect, typ), number in sorted(relocation_stats.items())
        ],
        "original_ghidra_function_count": function_count,
        "original_ghidra_roots": {k: {"functions": v, "examples": sample_ref[k]}
                                  for k, v in references.items()},
        "full_aar_member_inventory": packaged,
        "separately_downloaded_model_files": model_members,
        "original_imx_members": imx_inventory,
        "original_imx_hash_verification": imx_integrity,
        "important_limits": [
            "Constants in ARM64 instruction immediate fields are code operands, not ELF .rodata objects.",
            "Data and code share references; section categorization is not complete function-to-data xref recovery.",
            "Symbol table alone does not identify all stripped native functions.",
            "Model files in the separate public IMX container are not assumed embedded in the AAR.",
            "Changing ELF bytes or removing vendor authentication is not performed.",
            "This classification does not prove that transplanted code can run without original runtime state.",
        ],
    }


def summary(data):
    lines = [
        "# Expression2 0.6.2 native ELF / AAR component inventory", "",
        "**Read-only verification against exact original AAR SHA256.**", "",
        "- Original ELF: " + str(data["original_elf_size"]) + " bytes",
        "- Ghidra original functions: " + str(data["original_ghidra_function_count"]),
        "- ELF sections: " + str(len(data["elf_sections"])),
        "- ELF segments: " + str(len(data["load_segments"])),
        "- Relocation entries: " + str(len(data["full_relocations"])),
        "- Dynamic imports: " + str(len(data["full_dynamic_imports"])),
        "- Dynamic exports: " + str(len(data["full_dynamic_exports"])),
        "- AAR packaged entries: " + str(len(data["full_aar_member_inventory"])),
        "- Separately downloaded model files: " + str(len(data["separately_downloaded_model_files"])),
        "- Original IMX internal members: " + str(len(data["original_imx_members"])), "",
        "## ELF section classification", "",
        "| Component | Sections | Declared bytes |",
        "|---|---:|---:|",
    ]
    for name, group in data["categories"].items():
        lines.append("| " + CATEGORIES[name] + " | " +
                     str(group["section_count"]) + " | " + str(group["size_bytes"]) + " |")
    lines += ["", "## All ELF sections", "",
              "| Section | Kind | Bytes | Memory address |",
              "|---|---|---:|---|"]
    for s in data["elf_sections"]:
        lines.append("| " + (s["name"] or "(null)") + " | " + s["category"] +
                     " | " + str(s["size_bytes"]) + " | " + s["vaddr"] + " |")
    lines += ["", "## Runtime dependencies", ""]
    for name in data["dynamic_dependencies"]:
        lines.append("- " + name)
    lines += ["", "## Android AAR packaged components", "",
              "| Kind | Files | Total bytes |",
              "|---|---:|---:|"]
    stats = collections.defaultdict(lambda: [0, 0])
    for file in data["full_aar_member_inventory"]:
        v = stats[file["kind"]]
        v[0] += 1; v[1] += file["size_bytes"]
    for key, value in sorted(stats.items()):
        lines.append("| " + key + " | " + str(value[0]) + " | " + str(value[1]) + " |")
    lines += ["", "## Model files are separate from the .so and AAR", ""]
    for m in data["separately_downloaded_model_files"]:
        lines.append("- " + m["relative_path"] + ": " + str(m["size_bytes"]) + " bytes")
    lines += ["", "## All original IMX container resources (separate from ELF)", "",
              "| Resource member | Bytes |",
              "|---|---:|"]
    for member in data["original_imx_members"]:
        lines.append("| " + member["name"].replace("|", "/") +
                     " | " + str(member["size_bytes"]) + " |")
    lines += ["", "## Important technical boundaries", ""]
    for note in data["important_limits"]:
        lines.append("- " + note)
    return "\n".join(lines) + "\n"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--aar", type=Path, required=True)
    p.add_argument("--elf", type=Path, required=True)
    p.add_argument("--functions", type=Path)
    p.add_argument("--model-root", type=Path)
    p.add_argument("--imx", type=Path)
    p.add_argument("--output-dir", type=Path, required=True)
    args = p.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    data = inspect(args.aar, args.elf, args.functions, args.model_root, args.imx)
    (args.output_dir / "elf-components.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    (args.output_dir / "SUMMARY.md").write_text(summary(data), encoding="utf-8")
    print("EXPR2_ELF_COMPONENT_CLASSIFICATION_PASS",
          "sections", len(data["elf_sections"]),
          "relocations", len(data["full_relocations"]),
          "aar_entries", len(data["full_aar_member_inventory"]),
          "native_imports", len(data["full_dynamic_imports"]),
          "native_exports", len(data["full_dynamic_exports"]),
          "imx_members", len(data["original_imx_members"]))


if __name__ == "__main__":
    main()
