#!/usr/bin/env python3
"""Essence 2 ORIGINAL AAR byte-preserving structural decomposition/reassembly.

No Java/C++ SDK implementation. Original AAR ZIP members and nested JVM JAR
classfiles are split independently. Every ARM64 ELF is segmented at section,
header, FDE boundaries and padding, saved as disjoint pieces, and rebuilt from
a NEW empty output. The reassembled AAR must preserve every original member's
UNCOMPRESSED BYTES. Does not patch authentication or vendor metering.
"""
import argparse,csv,hashlib,io,json,re,struct,zipfile
from pathlib import Path
from elftools.elf.elffile import ELFFile
from elftools.dwarf.callframe import FDE

def digest(b): return hashlib.sha256(b).hexdigest()
def ensure_zip(z):
    names=z.namelist()
    if len(set(names))!=len(names):raise ValueError("DUPLICATE_ZIP_MEMBERS")
    if z.testzip() is not None:raise ValueError("BAD_ZIP_CRC")
    for n in names:
        if n.startswith("/") or ".." in n.split("/"):raise ValueError("UNSAFE_ZIP_PATH")
    return names

def recode_zip(original,replacements):
    with zipfile.ZipFile(io.BytesIO(original)) as zin:
        names=ensure_zip(zin)
        b=io.BytesIO()
        with zipfile.ZipFile(b,"w",allowZip64=True) as zout:
            zout.comment=zin.comment
            for item in zin.infolist():
                data=replacements.get(item.filename)
                if data is None:data=zin.read(item)
                zout.writestr(item,data)
    result=b.getvalue()
    with zipfile.ZipFile(io.BytesIO(result)) as znew,zipfile.ZipFile(io.BytesIO(original)) as zold:
        if znew.namelist()!=names:raise ValueError("ZIP_ORDER_CHANGED")
        for name in names:
            if name in replacements:
                if znew.read(name)!=replacements[name]:raise ValueError("REPLACED_BYTES_DIFFER")
            elif znew.read(name)!=zold.read(name):raise ValueError("ORIGINAL_MEMBER_CHANGED:"+name)
    return result

def classify_elf(data,filename,temp,reportdir):
    ef=ELFFile(io.BytesIO(data))
    result={"filename":filename,"bytes":len(data),"sha256":digest(data),
            "elfclass":ef.elfclass,"machine":str(ef["e_machine"]),
            "endian":"little" if ef.little_endian else "big",
            "sections":len(list(ef.iter_sections())),"program_segments":len(list(ef.iter_segments())),
            "native_symbol_exports":[],"fde_addresses":[],"function_fde_ranges":0,
            "fde_parse_error":None}
    if ef.elfclass!=64 or ef["e_machine"]!="EM_AARCH64":
        result["reassembly"]="NOT_AARCH64"
        return data,result
    result["needed"]=[]
    try:
        dynamic=ef.get_section_by_name(".dynamic")
        if dynamic:
            for tag in dynamic.iter_tags():
                if tag.entry.d_tag=="DT_NEEDED":result["needed"].append(tag.needed)
    except Exception as ex:result["needed_parse_error"]=str(ex)
    dyn=ef.get_section_by_name(".dynsym")
    if dyn:
        for sym in dyn.iter_symbols():
            n=sym.name
            if n.startswith("Java_") or n in ("JNI_OnLoad","JNI_OnUnload"):
                result["native_symbol_exports"].append(n)
    bounds={0,len(data)}
    sections=list(ef.iter_sections())
    result["section_summary"]=[{"name":s.name,"type":str(s["sh_type"]),
          "flags":int(s["sh_flags"]),"offset":int(s["sh_offset"]),"size":int(s["sh_size"])}
        for s in sections]
    def addbounds(lo,hi):
        if not (0<=lo<=hi<=len(data)):raise ValueError("FILE_BOUNDS_OUTSIDE:"+filename)
        bounds.update([lo,hi])
    addbounds(0,int(ef["e_ehsize"]))
    addbounds(int(ef["e_phoff"]),int(ef["e_phoff"])+int(ef["e_phentsize"])*int(ef["e_phnum"]))
    addbounds(int(ef["e_shoff"]),int(ef["e_shoff"])+int(ef["e_shentsize"])*int(ef["e_shnum"]))
    for s in sections:
        if s["sh_type"]=="SHT_NOBITS" or int(s["sh_size"])==0:continue
        addbounds(int(s["sh_offset"]),int(s["sh_offset"])+int(s["sh_size"]))
    fde=[]
    try:
        for ent in ef.get_dwarf_info().EH_CFI_entries():
            if not isinstance(ent,FDE) or int(ent["address_range"])<=0:continue
            va=int(ent["initial_location"]);length=int(ent["address_range"])
            match=[s for s in sections if s["sh_type"]!="SHT_NOBITS" and int(s["sh_flags"])&4
                   and int(s["sh_addr"])<=va
                   and va+length<=int(s["sh_addr"])+int(s["sh_size"])]
            if len(match)!=1:
                result.setdefault("unmapped_fde_va",[]).append(hex(va));continue
            s=match[0];offset=int(s["sh_offset"])+va-int(s["sh_addr"])
            addbounds(offset,offset+length);fde.append((va,length,offset))
        result["function_fde_ranges"]=len(fde)
    except Exception as ex:
        result["fde_parse_error"]=str(ex)
    # Preserve addresses + SHA of each original exception-unwind code range
    fde.sort()
    result["fde_addresses"]=[{"va":hex(va),"size":length,"file_offset":off,
                               "sha256":digest(data[off:off+length])}
                              for va,length,off in fde]
    edges=sorted(bounds)
    piece_manifest=[]
    store=temp/(filename.replace("/","_")+".parts.zip")
    with zipfile.ZipFile(store,"w",compression=zipfile.ZIP_STORED,allowZip64=True) as z:
        for i,(start,end) in enumerate(zip(edges,edges[1:])):
            if start==end:continue
            part=data[start:end]
            pname=f"{i:06d}_{start:016x}_{end:016x}.bin"
            piece_manifest.append({"start":start,"end":end,"part":pname,"sha256":digest(part)})
            z.writestr(pname,part)
    rebuilt_path=temp/(filename.replace("/","_")+".rebuilt.so")
    with rebuilt_path.open("wb") as out,zipfile.ZipFile(store) as z:
        cursor=0
        for rec in piece_manifest:
            if rec["start"]!=cursor:raise ValueError("PIECE_GAP_OR_OVERLAP")
            b=z.read(rec["part"])
            if digest(b)!=rec["sha256"] or len(b)!=rec["end"]-rec["start"]:
                raise ValueError("PIECE_BYTES_WRONG")
            out.write(b);cursor=rec["end"]
        if cursor!=len(data):raise ValueError("INCOMPLETE_ELF_REASSEMBLY")
    rebuilt=rebuilt_path.read_bytes()
    if rebuilt!=data or digest(rebuilt)!=digest(data):raise ValueError("NATIVE_REBUILD_NOT_BYTE_IDENTICAL")
    result["reassembly"]="PASS_EXACT_WHOLE_ELF_BYTES"
    result["separated_file_pieces"]=len(piece_manifest)
    result["rebuilt_sha256"]=digest(rebuilt)
    with (reportdir/(filename.replace("/","_")+".pieces.tsv")).open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t")
        w.writerow(["start_offset","end_offset","sha256","piece_filename"])
        for p in piece_manifest:w.writerow([p["start"],p["end"],p["sha256"],p["part"]])
    with (reportdir/(filename.replace("/","_")+".fde.tsv")).open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t");w.writerow(["elf_va","length","offset","sha256"])
        for p in result["fde_addresses"]:w.writerow([p["va"],p["size"],p["file_offset"],p["sha256"]])
    result.pop("fde_addresses") # indexed in output TSV; avoid duplicating huge report
    return rebuilt,result

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--aar",type=Path,required=True)
    ap.add_argument("--out",type=Path,required=True)
    ap.add_argument("--temp",type=Path,required=True)
    a=ap.parse_args()
    a.out.mkdir(parents=True,exist_ok=True);a.temp.mkdir(parents=True,exist_ok=True)
    original=a.aar.read_bytes()
    with zipfile.ZipFile(io.BytesIO(original)) as archive:
        names=ensure_zip(archive)
        if "classes.jar" not in names or "AndroidManifest.xml" not in names:
            raise ValueError("NOT_AN_ANDROID_AAR")
        data={n:archive.read(n) for n in names if not n.endswith("/")}
    jvm_jar=data["classes.jar"]
    with zipfile.ZipFile(io.BytesIO(jvm_jar)) as zin:
        inner=ensure_zip(zin)
        c={n:zin.read(n) for n in inner if not n.endswith("/")}
        classfiles=[n for n in c if n.endswith(".class")]
        if not classfiles:raise ValueError("NO_JVM_CLASSES")
        # Independently extract JVM classfile bytes, then build fresh JAR.
        jar_root=a.temp/"jvm-pieces"
        for n,b in c.items():
            loc=jar_root/n;loc.parent.mkdir(parents=True,exist_ok=True);loc.write_bytes(b)
        rebuilt_jvm=recode_zip(jvm_jar,{n:(jar_root/n).read_bytes() for n in c})
    with zipfile.ZipFile(io.BytesIO(rebuilt_jvm)) as j:
        assert all(j.read(k)==v for k,v in c.items())
    jvm_report={"original_jar_sha256":digest(jvm_jar),"reassembled_jar_sha256":digest(rebuilt_jvm),
       "original_jar_entries":len(inner),"classfiles":len(classfiles),
       "all_classfile_contents_identical":True,"classfile_entries_modified":0}
    original_natives=[name for name in names if name.endswith(".so")]
    if not original_natives:raise ValueError("AAR_WITHOUT_NATIVE_LIBRARIES")
    native_results=[]
    replacements={"classes.jar":rebuilt_jvm}
    for name in original_natives:
        blob,record=classify_elf(data[name],name,a.temp,a.out)
        replacements[name]=blob
        native_results.append(record)
    reconstructed=recode_zip(original,replacements)
    with zipfile.ZipFile(io.BytesIO(reconstructed)) as z:
        if z.namelist()!=names:raise ValueError("AAR_MEMBER_NAMES_OR_ORDER_CHANGED")
        changed=[n for n in names if z.read(n)!=data.get(n,b"")]
        if changed:raise ValueError("AAR_MEMBER_BYTES_CHANGED:"+str(changed))
    sdk=a.temp/"Essence2_0.10.3_original_JVM_ARM64_reassembled.aar"
    sdk.write_bytes(reconstructed)
    report={
      "source_aar_sha256":digest(original),
      "source_aar_bytes":len(original),
      "source_aar_members":len(names),
      "jni_jvm_classes_jars":jvm_report,
      "arm64_native_libraries":native_results,
      "original_aar_data_entry_differences":0,
      "reassembled_aar_sha256":digest(reconstructed),
      "source_and_output_whole_zip_sha_equal":digest(original)==digest(reconstructed),
      "original_classfile_implementation_rewritten":False,
      "original_machine_code_rewritten":False,
      "runtime_model_rendering_tested":False,
      "native_address_relocation_tested":False,
      "notes":[
       "Every vendor SO including any E2U engine and native dependencies is preserved.",
       "FDE are unwind address ranges; do not equate FDE to all high-level source functions.",
       "Per-member byte identity is distinct from ZIP container raw SHA identity.",
       "This is original-address file piece reassembly, not relocated independent linkage."
      ]
    }
    (a.out/"essence2-original-sdk-audit.json").write_text(json.dumps(report,indent=2)+"\n")
    with (a.out/"essence2-aar-members.tsv").open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t")
        w.writerow(["member","original_size","sha256"])
        for n in names:w.writerow([n,len(data.get(n,b"")),digest(data.get(n,b""))])
    with (a.out/"essence2-jvm-classfiles.tsv").open("w",newline="") as f:
        w=csv.writer(f,delimiter="\t");w.writerow(["class_or_jar_entry","bytes","sha256"])
        for name,b in c.items():w.writerow([name,len(b),digest(b)])
    (a.out/"README.md").write_text(
      "# Essence2 original 0.10.3 static decomposition / reassembly\n\n"+
      f"- Original AAR: {digest(original)}\n"+
      f"- JVM classes: {len(classfiles)}\n"+
      f"- Native SO count: {len(original_natives)}\n"+
      f"- Reassembled AAR: {digest(reconstructed)}\n"+
      "- Every original AAR member uncompressed bytes preserved: PASS\n"+
      "- No credential or metering changes, no native source rewriting.\n"+
      "- E2U/Essence2 native engine inventory is in JSON; rendering untested.\n")
    print("ESSENCE2_ORIGINAL_SDK_REASSEMBLY_PASS",
          "JVM_CLASSES",len(classfiles),"NATIVE_SOS",len(native_results),
          "FDE_RANGES",sum(x["function_fde_ranges"] for x in native_results),
          "AAR_ENTRIES",len(names),
          "AAR_SHA256",digest(reconstructed))
if __name__=="__main__":main()
