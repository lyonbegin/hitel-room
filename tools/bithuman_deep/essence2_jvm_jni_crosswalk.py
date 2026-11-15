#!/usr/bin/env python3
"""Essence 2 static JNI crosswalk from original ASM native declarations and
original dynamic ELF symbol tables. Does not assert runtime JNI registration."""
import argparse,csv,json,re
from pathlib import Path

def mangle(s):
    return s.replace("_","_1").replace("$","_00024").replace("/","_").replace(";","_2").replace("[","_3")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--native-methods",type=Path,required=True)
    p.add_argument("--exports",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    a=p.parse_args()
    methods=list(csv.DictReader(a.native_methods.open(),delimiter="\t"))
    libraries=json.loads(a.exports.read_text())
    # Only real original JNI function symbol names from each actual ELF.
    exports=[]
    for lib in libraries:
        for line in lib["exports"]:
            match=re.search(r"\b(Java_[A-Za-z0-9_]+)\b",line)
            if match:exports.append((lib["path"],match.group(1)))
    a.out.mkdir(parents=True,exist_ok=True)
    results=[];counts={"MATCHED":0,"AMBIGUOUS":0,"UNRESOLVED_STATIC_OR_DYNAMIC_REGISTER":0}
    for m in methods:
        symbol="Java_"+mangle(m["class"])+"_"+mangle(m["name"])
        candidates=[(lib,exp) for lib,exp in exports if exp==symbol or exp.startswith(symbol+"__")]
        verdict="MATCHED" if len(candidates)==1 else ("AMBIGUOUS" if candidates else "UNRESOLVED_STATIC_OR_DYNAMIC_REGISTER")
        counts[verdict]+=1
        results.append({"class":m["class"],"name":m["name"],"descriptor":m["descriptor"],
            "expected_prefix":symbol,"candidates":candidates,"verdict":verdict})
    with (a.out/"essence2-jvm-native-to-elf-jni.tsv").open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t")
        w.writerow(["jvm_class","jvm_method","descriptor","expected_jni_prefix","matched_library","matched_symbol","verdict"])
        for r in results:
            w.writerow([r["class"],r["name"],r["descriptor"],r["expected_prefix"],
                        ";".join(x[0] for x in r["candidates"]),
                        ";".join(x[1] for x in r["candidates"]),r["verdict"]])
    unique={sym for _,sym in exports}
    summary={"original_jvm_native_method_declarations":len(methods),
             "original_elf_jni_export_functions":len(exports),
             "unique_jni_export_symbols":len(unique),
             "matching_counts":counts,
             "jni_libraries":{lib:len([x for l,x in exports if l==lib]) for lib in sorted(set(l for l,_ in exports))},
             "unmatched_original_jni_exports":sorted(unique-set(x for r in results for _,x in r["candidates"])),
             "unresolved_jvm_native_declarations":[r for r in results if r["verdict"]!="MATCHED"],
             "limitations":"Static ABI export name match only. Does not prove JNI_OnLoad, RegisterNatives, dynamic life cycle, or model rendering."}
    (a.out/"essence2-jvm-jni-crosswalk-summary.json").write_text(json.dumps(summary,indent=2)+"\n")
    print("ESSENCE2_ORIGINAL_JVM_JNI_CROSSWALK",
        "NATIVE_METHODS",len(methods),"ELF_EXPORTS",len(exports),
        "MATCHED",counts["MATCHED"],"UNRESOLVED",counts["UNRESOLVED_STATIC_OR_DYNAMIC_REGISTER"])
    if counts["AMBIGUOUS"] or counts["UNRESOLVED_STATIC_OR_DYNAMIC_REGISTER"] or len(exports)!=len(methods):
        raise SystemExit("ESSENCE2_JNI_STATIC_MATCH_NOT_COMPLETE_SEE_REPORT")
if __name__=="__main__":main()
