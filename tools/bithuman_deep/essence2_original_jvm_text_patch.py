#!/usr/bin/env python3
"""Essence2 original JVM constant-pool text-only patch and fresh AAR assembly.
This DOES NOT modify vendor credential checks, metering or ARM64 machine code.
"""
import argparse,hashlib,io,json,struct,subprocess,zipfile
from pathlib import Path
TARGET="ai/bithuman/elevate/BithumanCodes.class"
OLD=b"no API secret was found, so this render cannot be attributed to an account"
NEW=b"HITEL_ESSENCE2_JVM_TEXT_PATCH_OK_20261115: a valid API secret is required."
EXPECTED_AAR="00657a151cb697a546447152a4213df205cd0c455044c86f88e3bbb226cf7f3e"
EXPECTED_CLASS="a4eb5cd1dd242cbabd57c118370b2ecf804d5e52915b4de6a35e9f0df5ac3abf"
def hash(b):return hashlib.sha256(b).hexdigest()

def change_constant_pool(original):
    if len(OLD)!=len(NEW) or original[:4]!=bytes.fromhex("cafebabe") or hash(original)!=EXPECTED_CLASS:
        raise ValueError("ORIGINAL_ESSENCE2_CLASS_SHA_OR_STRING_LENGTH_NOT_VERIFIED")
    n=struct.unpack_from(">H",original,8)[0]
    patched=bytearray(original)
    idx=1;pos=10;hits=[]
    while idx<n:
        tag=original[pos];pos+=1
        if tag==1:
            length=struct.unpack_from(">H",original,pos)[0];pos+=2
            chunk=original[pos:pos+length]
            if chunk==OLD:
                hits.append({"index":idx,"offset":pos,"length":length,
                             "different_payload_bytes":sum(a!=b for a,b in zip(OLD,NEW))})
                patched[pos:pos+length]=NEW
            pos+=length
        elif tag in (3,4):pos+=4
        elif tag in (5,6):pos+=8;idx+=1
        elif tag in (7,8,16,19,20):pos+=2
        elif tag in (9,10,11,12,17,18):pos+=4
        elif tag==15:pos+=3
        else:raise ValueError("UNSUPPORTED_CONSTANT_POOL_TAG_"+str(tag))
        idx+=1
    if len(hits)!=1 or hits[0]["index"]!=173 or hits[0]["offset"]!=2549:
        raise ValueError("EXPECTED_ESSENCE2_MESSAGE_ONLY_ON_CP173_OFFSET2549")
    if original.count(OLD)!=1 or bytes(patched).count(OLD):
        raise ValueError("NOT_EXACTLY_ONE_OLD_MESSAGE_REPLACED")
    verification=bytearray(patched)
    verification[2549:2549+len(OLD)]=OLD
    if bytes(verification)!=original:
        raise ValueError("OTHER_CLASS_BYTES_CHANGED")
    return bytes(patched),hits

def repack_bytes(data,replacements):
    with zipfile.ZipFile(io.BytesIO(data)) as old:
        members=old.infolist()
        if len(set(i.filename for i in members))!=len(members):raise ValueError("ZIP_DUPLICATES")
        new=io.BytesIO()
        with zipfile.ZipFile(new,"w",allowZip64=True) as out:
            out.comment=old.comment
            for i in members:
                out.writestr(i,replacements.get(i.filename,old.read(i)))
    result=new.getvalue()
    with zipfile.ZipFile(io.BytesIO(result)) as z,zipfile.ZipFile(io.BytesIO(data)) as origin:
        if z.namelist()!=origin.namelist():raise ValueError("ZIP_MEMBER_ORDER_DIFFERENCE")
        changed=[n for n in z.namelist() if z.read(n)!=origin.read(n)]
        if changed!=list(replacements):raise ValueError("UNEXPECTED_CONTENT_CHANGES:"+str(changed))
        if z.testzip() is not None:raise ValueError("ZIP_CRC_FAIL")
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--source-aar",type=Path,required=True)
    p.add_argument("--output-aar",type=Path,required=True)
    p.add_argument("--report",type=Path,required=True)
    p.add_argument("--temp",type=Path,required=True)
    a=p.parse_args()
    data=a.source_aar.read_bytes()
    if hash(data)!=EXPECTED_AAR:raise ValueError("UNEXPECTED_ESSENCE2_REASSEMBLED_AAR")
    a.output_aar.parent.mkdir(parents=True,exist_ok=True)
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.temp.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        oldjar=z.read("classes.jar")
        libs={n:z.read(n) for n in z.namelist() if n.endswith(".so")}
        expected=4
        if len(libs)!=expected:raise ValueError("ESSENCE2_EXPECTED_FOUR_NATIVE_LIBRARIES")
    with zipfile.ZipFile(io.BytesIO(oldjar)) as z:oldclass=z.read(TARGET)
    modified,hits=change_constant_pool(oldclass)
    newjar=repack_bytes(oldjar,{TARGET:modified})
    newaar=repack_bytes(data,{"classes.jar":newjar})
    with zipfile.ZipFile(io.BytesIO(newaar)) as z:
        assert all(z.read(n)==b for n,b in libs.items())
        with zipfile.ZipFile(io.BytesIO(z.read("classes.jar"))) as jar:
            assert jar.read(TARGET)==modified
    before=a.temp/"before.jar";after=a.temp/"after.jar"
    before.write_bytes(oldjar);after.write_bytes(newjar)
    args=["javap","-p","-c","-cp"]
    owner="ai.bithuman.elevate.BithumanCodes"
    old_listing=subprocess.run(args+[str(before),owner],capture_output=True,text=True,check=True).stdout
    new_listing=subprocess.run(args+[str(after),owner],capture_output=True,text=True,check=True).stdout
    if old_listing.replace(OLD.decode(),NEW.decode())!=new_listing:
        raise ValueError("METHOD_CODE_CHANGED_OUTSIDE_INTENDED_LITERAL")
    if "metering_no_credential" not in new_listing:
        raise ValueError("ORIGINAL_METERING_CODE_STRUCTURE_NOT_VISIBLE")
    a.output_aar.write_bytes(newaar)
    result={
      "target":TARGET,"original_aar_sha256":hash(data),"modified_aar_sha256":hash(newaar),
      "original_class_sha256":hash(oldclass),"modified_class_sha256":hash(modified),
      "original_message":OLD.decode(),"patched_message":NEW.decode(),
      "changed_classfiles":1,"changed_jvm_constant_pool_utf8":hits,
      "changed_jvm_bytecode_instructions":0,
      "changed_native_elf_bytes":0,
      "native_libraries_preserved":{n:hash(b) for n,b in libs.items()},
      "other_aar_members_changed":0,
      "javap_method_bytecode_equal_except_literal":True,
      "metering_credential_checks_modified":False,
      "model_rendering_verified":False}
    a.report.write_text(json.dumps(result,indent=2)+"\n")
    print("ESSENCE2_ORIGINAL_JVM_MESSAGE_PATCH_AAR_PASS",
          "CLASSFILES_CHANGED",1,"CONSTANTS_CHANGED",len(hits),"NATIVE_BYTES_CHANGED",0,
          "AAR_SHA",hash(newaar))
if __name__=="__main__":main()
