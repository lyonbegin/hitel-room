#!/usr/bin/env python3
"""Original classfile constant pool surgery, not Java/Kotlin/C++ reimplementation.

Changes only two Utf8 error-message values in the genuine, reassembled SDK.
JVM method Code attributes, stack maps, all other classes and original ARM64
ELF are byte-for-byte identical. Does not change credential/metering checks.
"""
import argparse,hashlib,io,json,struct,subprocess,zipfile
from pathlib import Path

TARGET="ai/bithuman/expression2/SelfHostMeter$Companion.class"
NATIVE="jni/arm64-v8a/libexpr2jni.so"
OLD=b"no API secret was found, so this render cannot be attributed to an account."
NEW=b"HITEL_EXPRESSION2_JVM_TEXT_PATCH_OK_20261114: valid API secret is required."
EXPECTED_NATIVE_SHA="ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c"
def sha(b):return hashlib.sha256(b).hexdigest()

def patch_class(data):
    if data[:4]!=bytes.fromhex("cafebabe") or len(OLD)!=len(NEW):
        raise ValueError("Unexpected original JVM bytes or string length mismatch")
    out=bytearray(data)
    n=struct.unpack_from(">H",data,8)[0]
    i=10; idx=1; hits=[]
    while idx<n:
        tag=data[i];i+=1
        if tag==1:
            size=struct.unpack_from(">H",data,i)[0];i+=2
            value=data[i:i+size]
            if value in (OLD,OLD+b" \x01"):
                out[i:i+size]=NEW+value[len(OLD):]
                hits.append({"constant_pool_index":idx,
                             "payload_offset":i,"literal_bytes":size,
                             "changed_bytes":sum(a!=b for a,b in zip(OLD,NEW)),
                             "concat_recipe_suffix":value[len(OLD):].hex()})
            i+=size
        elif tag in (3,4):i+=4
        elif tag in (5,6):i+=8;idx+=1
        elif tag in (7,8,16,19,20):i+=2
        elif tag in (9,10,11,12,17,18):i+=4
        elif tag==15:i+=3
        else:raise ValueError("Unrecognized JVM constant pool tag "+str(tag))
        idx+=1
    if {r["constant_pool_index"] for r in hits}!={595,760}:
        raise ValueError("Original classfile constant locations no longer match")
    if data.count(OLD)!=2 or bytes(out).count(OLD)!=0:
        raise ValueError("Not all expected original error-message sites replaced")
    proof=bytearray(out)
    for r in hits:
        begin=r["payload_offset"]
        proof[begin:begin+len(OLD)]=OLD
    if bytes(proof)!=data or len(out)!=len(data):
        raise ValueError("Unexpected classfile changes beyond the two string bytes")
    return bytes(out),hits

def repack(source,target,replacement):
    with zipfile.ZipFile(io.BytesIO(source)) as z:
        members=z.infolist()
        if len(members)!=len(set(x.filename for x in members)):
            raise ValueError("Duplicate entries")
        output=io.BytesIO()
        with zipfile.ZipFile(output,"w") as dst:
            dst.comment=z.comment
            for info in members:
                data=z.read(info.filename)
                dst.writestr(info,replacement if info.filename==target else data)
    packed=output.getvalue()
    with zipfile.ZipFile(io.BytesIO(source)) as orig,zipfile.ZipFile(io.BytesIO(packed)) as updated:
        if orig.namelist()!=updated.namelist() or updated.testzip() is not None:
            raise ValueError("Repacked archive entries are inconsistent")
        diff=[name for name in orig.namelist() if orig.read(name)!=updated.read(name)]
        if diff!=[target]:raise ValueError("More than the intended file was changed: "+str(diff))
        return packed,len(diff),len(orig.namelist())

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source-aar",type=Path,required=True)
    ap.add_argument("--output-aar",type=Path,required=True)
    ap.add_argument("--report",type=Path,required=True)
    ap.add_argument("--temp",type=Path,required=True)
    a=ap.parse_args()
    source=a.source_aar.read_bytes()
    a.output_aar.parent.mkdir(parents=True,exist_ok=True)
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.temp.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(source)) as z:
        oldjar=z.read("classes.jar")
        oldnative=z.read(NATIVE)
        if sha(oldnative)!=EXPECTED_NATIVE_SHA:
            raise ValueError("Unexpected original ARM64 ELF SHA")
    with zipfile.ZipFile(io.BytesIO(oldjar)) as z:oldclass=z.read(TARGET)
    newclass,hits=patch_class(oldclass)
    newjar,jarchanges,jarentries=repack(oldjar,TARGET,newclass)
    newaar,aarchanges,aarentries=repack(source,"classes.jar",newjar)
    with zipfile.ZipFile(io.BytesIO(newaar)) as z:
        if z.read(NATIVE)!=oldnative or sha(z.read(NATIVE))!=EXPECTED_NATIVE_SHA:
            raise ValueError("Original ARM64 function bytes were modified")
        with zipfile.ZipFile(io.BytesIO(z.read("classes.jar"))) as j:
            if j.read(TARGET)!=newclass:raise ValueError("Missing patched class")
    # Java bytecode disassembly: identical except the deliberately changed UTF8.
    origJar=a.temp/"original.jar";origJar.write_bytes(oldjar)
    patchJar=a.temp/"patched.jar";patchJar.write_bytes(newjar)
    cmd=["javap","-p","-c","-cp"]
    qual="ai.bithuman.expression2.SelfHostMeter$Companion"
    old_listing=subprocess.run(cmd+[str(origJar),qual],text=True,
                               capture_output=True,check=True).stdout
    new_listing=subprocess.run(cmd+[str(patchJar),qual],text=True,
                               capture_output=True,check=True).stdout
    if old_listing.replace(OLD.decode(),NEW.decode())!=new_listing:
        raise ValueError("Unexpected JVM instruction changes")
    if "119: ldc_w" not in new_listing or "128: invokespecial" not in new_listing:
        raise ValueError("Auth refuse instruction sites unexpectedly changed")
    a.output_aar.write_bytes(newaar)
    result={
       "original_reassembled_aar_sha256":sha(source),
       "patched_aar_sha256":sha(newaar),
       "patched_aar_size_bytes":len(newaar),
       "original_class_sha256":sha(oldclass),"patched_class_sha256":sha(newclass),
       "target_class":TARGET,
       "methods_reimplemented":0,
       "jvm_constant_pool_string_changes":hits,
       "changed_jvm_classfiles":jarchanges,
       "jvm_jar_zip_entries":jarentries,
       "changed_aar_file_entries":aarchanges,
       "aar_zip_entries":aarentries,
       "changed_elf_bytes":0,
       "original_arm64_so_sha256":sha(oldnative),
       "native_jni_exports_unchanged":True,
       "javap_instruction_list_unchanged_except_literal":True,
       "authentication_refusal_condition_preserved":True,
       "original_message":OLD.decode(),"replacement_message":NEW.decode(),
       "device_rendering": "NOT_VERIFIED",
       "note":"Both original occurrences were changed: the direct LDC literal and the invokedynamic concat recipe, preserving the recipe 0x01 placeholder."
    }
    a.report.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    print("EXPR2_JVM_ORIGINAL_CLASSFILE_2_LITERALS_PATCH_AND_AAR_REPACK_PASS",
        "CLASSFILES_CHANGED",jarchanges,"STRING_CONSTANTS_CHANGED",len(hits),
        "ARM64_CHANGED_BYTES",0,"AAR_SHA256",sha(newaar))
if __name__=="__main__":main()
