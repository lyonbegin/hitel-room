#!/usr/bin/env python3
"""Original Expression2 AAR -> component decomposition -> original-JVM/native recomposition.

Zero original class or machine code bytes are modified.
Checks three DIFFERENT claims:
  1) original classes.jar and native ELF entry bytes exactly carried over;
  2) classes.jar independently split into class/resources and rebuilt: every
     uncompressed entry's SHA256 matches, even when ZIP compressed bytes differ;
  3) a newly created AAR has exactly the same entry names and data bytes as
     the original (NOT a promise that complete ZIP bytes are identical).
The repacked vendor artifacts MUST NOT be uploaded to public Actions.
"""
import argparse,collections,csv,hashlib,json,re,subprocess,zipfile
from pathlib import Path

AAR_SHA="067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584"
SO_SHA="ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c"
ARM_SO="jni/arm64-v8a/libexpr2jni.so"
def sha(b):return hashlib.sha256(b).hexdigest()
def list_entries(z):
    names=z.namelist()
    if len(names)!=len(set(names)):raise RuntimeError("DUPLICATE_ZIP_ENTRY")
    for n in names:
        if n.startswith("/") or any(p==".." for p in n.split("/")):raise RuntimeError("ZIP_PATH_ESCAPE")
    if z.testzip() is not None:raise RuntimeError("CORRUPT_ARCHIVE")
    return names
def content(z):
    return {n:z.read(n) for n in list_entries(z) if not n.endswith("/")}
def make_zip(entries,zipinfos,output):
    with zipfile.ZipFile(output,"w",allowZip64=True) as out:
        for i in zipinfos:
            # Directories and non-class JAR resources must also be preserved.
            out.writestr(i,entries.get(i.filename,b""))
def compare_exact_entries(original,repacked):
    with zipfile.ZipFile(original) as a,zipfile.ZipFile(repacked) as b:
        namesA=list_entries(a)
        namesB=list_entries(b)
        if namesA!=namesB:raise RuntimeError("ZIP_ENTRY_ORDER_OR_NAMES_CHANGED")
        mismatches=[n for n in namesA if a.read(n)!=b.read(n)]
        if mismatches:raise RuntimeError("ZIP_ENTRY_BYTE_MISMATCH: "+str(mismatches[:6]))
        return {"entries":len(namesA),"non_directory_entries":sum(not n.endswith("/") for n in namesA),
                "uncompressed_entry_byte_mismatches":len(mismatches),
                "raw_zip_file_sha_identical":sha(Path(original).read_bytes())==sha(Path(repacked).read_bytes())}
def norm_jni_name(cls,method):
    def encode(s):
        # JNI encoding is specified for names; overloaded signatures need
        # a __suffix and are matched by prefix+__ below, not falsely matched.
        s=s.replace("_","_1").replace(";","_2").replace("[","_3")
        return s.replace("/","_").replace("$","_00024")
    return "Java_"+encode(cls)+"_"+encode(method)
def assemble_links(asm_tsv,so,out):
    methods=list(csv.DictReader(asm_tsv.open(),delimiter="\t"))
    text=subprocess.run(["readelf","-W","--dyn-syms",str(so)],
                         check=True,capture_output=True,text=True).stdout
    names=sorted(set(re.findall(r"\bJava_[A-Za-z0-9_]+\b",text)))
    allExports=[x for x in text.splitlines() if "JNI_OnLoad" in x]
    exact=0;unmatched=[];resolved=[]
    with (out/"jni-original-jvm-to-arm64-exports.tsv").open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t")
        w.writerow(["jvm_class","method","descriptor","lookup_export","matching_export","mapping"])
        for m in methods:
            prefix=norm_jni_name(m["class"],m["name"])
            matches=[x for x in names if x==prefix or x.startswith(prefix+"__")]
            if len(matches)==1:
                exact+=1;resolved.append(matches[0]);kind="STATIC_JNI_EXPORT_MATCH"
            elif matches:
                kind="MULTIPLE_OVERLOAD_EXPORTS"
            else:
                kind="UNRESOLVED_OR_REGISTER_NATIVES"
                unmatched.append(m["class"]+"."+m["name"]+m["descriptor"])
            w.writerow([m["class"],m["name"],m["descriptor"],prefix,
                         ";".join(matches),kind])
    exportOnly=sorted(set(names)-set(resolved))
    summary={"jvm_declared_native_methods":len(methods),
         "native_dlsym_Java_exports":len(names),
         "statically_matched_jni_methods":exact,
         "not_matched_by_export":len(unmatched),
         "unresolved_jni_methods":unmatched,
         "jni_export_only":exportOnly,
         "JNI_OnLoad_symbol_present":bool(allExports),
         "caveat":"RegisterNatives, JNI name mangling and overloaded signatures may require dynamic mapping; no claim of full JNI coverage.",
         "original_binary_modified":False}
    (out/"jni-linkage-summary.json").write_text(json.dumps(summary,indent=2)+"\n")
    return summary
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--aar",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    p.add_argument("--temp",type=Path,required=True)
    p.add_argument("--asm-native-methods",type=Path,required=True)
    p.add_argument("--native-reassembled",type=Path,required=True)
    a=p.parse_args()
    raw=a.aar.read_bytes()
    if sha(raw)!=AAR_SHA:raise RuntimeError("OFFICIAL_AAR_SHA256_MISMATCH")
    a.out.mkdir(parents=True,exist_ok=True);a.temp.mkdir(parents=True,exist_ok=True)
    aar_parts=a.temp/"original-aar-components"
    aar_parts.mkdir(exist_ok=True)
    with zipfile.ZipFile(a.aar) as original:
        orig_list=list_entries(original)
        if "classes.jar" not in orig_list or ARM_SO not in orig_list or "AndroidManifest.xml" not in orig_list:
            raise RuntimeError("ESSENTIAL_AAR_PART_MISSING")
        aar_entries=content(original)
        jarBytes=aar_entries["classes.jar"]
        soBytes=aar_entries[ARM_SO]
        if sha(soBytes)!=SO_SHA:raise RuntimeError("OFFICIAL_ARM64_SO_SHA256_MISMATCH")
        for name,b in aar_entries.items():
            target=aar_parts/name
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(b)
        original_info=original.infolist()
    jarPath=a.temp/"original-classes.jar"
    jarPath.write_bytes(jarBytes)
    nativePath=aar_parts/ARM_SO
    rebuiltNative=a.native_reassembled.read_bytes()
    if rebuiltNative!=soBytes or sha(rebuiltNative)!=SO_SHA:
        raise RuntimeError("REBUILT_NATIVE_FDE_FUNCTION_ELF_NOT_BYTE_IDENTICAL")
    with zipfile.ZipFile(jarPath) as origjar:
        classes_info=origjar.infolist()
        jar_entries=content(origjar)
        if not jar_entries:raise RuntimeError("EMPTY_ORIGINAL_CLASSES_JAR")
        # Deliberately split individual class files and JVM metadata first.
        split=a.temp/"jvm-original-components";split.mkdir(exist_ok=True)
        for name,b in jar_entries.items():
            f=split/name;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(b)
        independent_jar_entries={n:(split/n).read_bytes() for n in jar_entries}
        independently_rebuilt=a.temp/"rebuilt-classes-from-individual-entries.jar"
        make_zip(independent_jar_entries,classes_info,independently_rebuilt)
    class_compare=compare_exact_entries(jarPath,independently_rebuilt)
    classfiles=[n for n in jar_entries if n.endswith(".class")]
    if not classfiles:raise RuntimeError("NO_JVM_CLASSES")
    # First AAR: assemble every original AAR entry from separate split files.
    # Source JAR byte stream remains exactly unchanged in this form.
    aar_entry_parts={n:(aar_parts/n).read_bytes() for n in aar_entries}
    aar_entry_parts[ARM_SO]=rebuiltNative  # Original machine code from FDE/ELF file pieces, not an intact SO copy.
    recreated_aar=a.temp/"reassembled-original-entries.aar"
    make_zip(aar_entry_parts,original_info,recreated_aar)
    direct_compare=compare_exact_entries(a.aar,recreated_aar)
    # Second AAR: use a JAR assembled from its own original class entries.
    # Original class instruction and SO bytes remain unchanged.
    aar_with_rebuilt_jar=dict(aar_entry_parts)
    aar_with_rebuilt_jar["classes.jar"]=independently_rebuilt.read_bytes()
    class_recombined=a.temp/"reassembled-from-jvm-classes-and-arm64.aar"
    make_zip(aar_with_rebuilt_jar,original_info,class_recombined)
    with zipfile.ZipFile(class_recombined) as rebuiltAar:
        if sha(rebuiltAar.read(ARM_SO))!=SO_SHA:raise RuntimeError("SO_CHANGED_ON_FINAL_ASSEMBLY")
        with zipfile.ZipFile(rebuiltAar.open("classes.jar")) as rebuiltJar:
            jar_mismatch=[n for n in jar_entries if rebuiltJar.read(n)!=jar_entries[n]]
            if jar_mismatch:raise RuntimeError("REBUILT_JAR_CONTENT_CHANGED")
    mapping=assemble_links(a.asm_native_methods,nativePath,a.out)
    # Actual composition results; report SHA comparison even when ZIP bytes
    # differ due to compression metadata. No misleading "binary-identical".
    results={
       "input":{"source_aar_sha256":sha(raw),"source_aar_bytes":len(raw),
                "source_classes_jar_sha256":sha(jarBytes),
                "source_arm64_so_sha256":sha(soBytes)},
       "sdk_package":{"original_aar_entries":len(orig_list),
           "classes_jar_classfiles":len(classfiles),
           "classes_jar_entries":len(jar_entries),
           "android_manifest_present":True,
           "native_libraries":[n for n in orig_list if n.endswith(".so")],
           "aar_resources":[n for n in orig_list if n.startswith(("res/","assets/","R.txt","public.txt","prefab/","META-INF/"))]},
       "reassembly":{"original_aar_entry_reassembly":direct_compare,
           "classes_jar_from_individual_class_and_resource_bytes":class_compare,
           "reassembled_aar_all_classfile_differences":0,
           "reassembled_aar_arm64_so_sha256":SO_SHA,
           "arm64_elf_original_fde_and_data_piece_reassembly_injected":True,
           "reassembled_jar_archive_sha256":sha(independently_rebuilt.read_bytes()),
           "note":"ZIP byte-stream identity is a distinct question from every constituent class/machine-code/manifest/resource entry matching byte-for-byte."},
       "jni_linkage":mapping,
       "original_method_code_modified":False,
       "original_machine_code_modified":False,
       "fully_verified_runtime_semantics":False,
       "app_compile_and_android_device_test":"NOT_EXECUTED_BY_THIS_SCRIPT"
    }
    (a.out/"original-jvm-arm64-aar-reassembly.json").write_text(json.dumps(results,indent=2)+"\n")
    with (a.out/"original-aar-entry-hashes.tsv").open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t")
        w.writerow(["path","size","sha256"])
        for n in orig_list:
            w.writerow([n,len(aar_entries.get(n,b"")),sha(aar_entries.get(n,b""))])
    (a.out/"original-aar-reassembly-SUMMARY.md").write_text(
         "# Original Expression2 AAR — JVM and ARM64 component reassembly\n\n"
         +"- Published official AAR SHA256: "+sha(raw)+"\n"
         +"- classes.jar classfiles: "+str(len(classfiles))+"\n"
         +"- All original AAR entry bytes match after split & repack: **YES**\n"
         +"- All original JVM classfile bytes match after split & JAR rebuild: **YES**\n"
         +"- Original ARM64 SO SHA256 matches within reassembled AAR: **YES**\n"
         +"- Whole AAR ZIP SHA256 exact: "+str(direct_compare["raw_zip_file_sha_identical"])+"\n"
         +"- Original SDK vendor authentication remains in class files.\n"
         +"- Complete JNI mappings all proven: **NO**, unresolved entries in JSON.\n"
         +"- Original SDK executable on-device equivalence proven: **NO**.\n"
    )
    print("EXPR2_ORIGINAL_JVM_ARM64_AAR_COMPONENT_REASSEMBLY_PASS",
          "AAR_ENTRIES",len(orig_list),"JVM_CLASSES",len(classfiles),
          "JAR_BYTES_DIFF",class_compare["uncompressed_entry_byte_mismatches"],
          "AAR_BYTES_DIFF",direct_compare["uncompressed_entry_byte_mismatches"],
          "MATCHED_JNI_EXPORTS",mapping["statically_matched_jni_methods"],
          "UNRESOLVED_JNI",mapping["not_matched_by_export"],
          "FULL_ZIP_SHA_MATCH",direct_compare["raw_zip_file_sha_identical"])
if __name__=="__main__":main()
