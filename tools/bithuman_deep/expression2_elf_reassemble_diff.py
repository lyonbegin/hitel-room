#!/usr/bin/env python3
"""Recompose original Expression2 ELF, then compare Ghidra function-only coverage.

No modified license path; outputs only numeric reports, not copied vendor code.
"""
import argparse,csv,hashlib,json,re,struct
from pathlib import Path

def sha(b):return hashlib.sha256(b).hexdigest()

def run(args):
 raw=args.elf.read_bytes()
 info=json.loads(args.manifest.read_text())
 assert sha(raw)==info["original_elf_sha256"] and len(raw)==info["original_elf_size"]
 sections=info["elf_sections"]
 assert raw[:6]==b"\x7fELF\x02\x01"
 ph,sh=struct.unpack_from("<QQ",raw,32)
 eh,pe,pn,se,sn,_=struct.unpack_from("<HHHHHH",raw,52)
 assert eh==64 and sn==len(sections)
 named=[(0,eh,"ELF_HEADER",0),(ph,ph+pe*pn,"PROGRAM_HEADERS",1),
        (sh,sh+se*sn,"SECTION_HEADERS",2)]
 for s in sections:
  if s["type"]!="SHT_NOBITS" and s["size_bytes"]>0:
   named.append((s["file_offset"],s["file_offset"]+s["size_bytes"],s["name"],3))
 for lo,hi,name,_ in named:assert 0<=lo<=hi<=len(raw),(name,lo,hi)
 bounds=sorted({0,len(raw)}|{t for lo,hi,_,_ in named for t in (lo,hi)})
 args.temp.mkdir(parents=True,exist_ok=True)
 part_index=[]
 for j,(lo,hi) in enumerate(zip(bounds,bounds[1:])):
  owners=sorted((priority,name) for a,b,name,priority in named if a<=lo and hi<=b)
  label=owners[0][1] if owners else "PADDING_UNMAPPED"
  data=raw[lo:hi];f=args.temp/("%04d.bin"%j);f.write_bytes(data)
  part_index.append((lo,hi,f,sha(data),label))
 rebuilt=bytearray(len(raw));occupied=bytearray(len(raw))
 for lo,hi,file,digest,label in reversed(part_index):
  contents=file.read_bytes()
  assert len(contents)==hi-lo and sha(contents)==digest
  assert not any(occupied[lo:hi])
  rebuilt[lo:hi]=contents
  occupied[lo:hi]=b"\x01"*(hi-lo)
 assert all(occupied) and rebuilt==raw and sha(rebuilt)==sha(raw)
 (args.temp/"reconstructed-layout-original.so").write_bytes(rebuilt)

 code_sections=[s for s in sections if s["type"]!="SHT_NOBITS" and
                (int(s["flags"])&4)!=0 and s["size_bytes"]>0]
 candidate=bytearray(rebuilt)
 for s in code_sections:
  start=s["file_offset"];stop=start+s["size_bytes"]
  candidate[start:stop]=b"\x00"*(stop-start)
 covered=bytearray(len(raw))
 funcs=list(csv.DictReader((args.ghidra/"functions.tsv").open(),delimiter="\t"))
 edges=list(csv.DictReader((args.ghidra/"call-edges.tsv").open(),delimiter="\t"))
 index={f["address"].lower():f for f in funcs}
 feed=next(f for f in funcs if f["name"]=="Java_ai_bithuman_expression2_Native_feed")
 sym=next(v for v in info["full_dynamic_exports"] if v["name"]==feed["name"])
 bias=int(feed["address"],16)-int(sym["value"],16)
 assert bias%4096==0
 insns=0;bad=0;overlaps=0;unmapped=0
 listings=list((args.ghidra/"native-instruction-bytes").glob("*.lst"))
 for file in listings:
  addr=re.search(r"_([0-9a-f]+)\.lst$",file.name).group(1)
  f=index[addr]
  whole=bytearray()
  for line in file.read_text().splitlines():
   fields=line.split("\t",2)
   if len(fields)!=3:continue
   vaddr=int(fields[0],16)-bias;opcode=bytes.fromhex(fields[1])
   assert len(opcode)==4
   whole+=opcode
   matching=next((s for s in code_sections if
     int(s["vaddr"],16)<=vaddr<int(s["vaddr"],16)+s["size_bytes"]),None)
   if matching is None:unmapped+=4;continue
   off=matching["file_offset"]+vaddr-int(matching["vaddr"],16)
   bad+=int(raw[off:off+4]!=opcode)
   overlaps+=int(any(covered[off:off+4]))
   candidate[off:off+4]=opcode
   covered[off:off+4]=b"\x01"*4
   insns+=1
  assert len(whole)==int(f["byte_count"]) and sha(whole)==f["bytes_sha256"]
 assert len(funcs)==len(listings) and not (bad or overlaps or unmapped)
 code_size=sum(s["size_bytes"] for s in code_sections)
 proven=sum(sum(covered[s["file_offset"]:s["file_offset"]+s["size_bytes"]])
            for s in code_sections)
 assert proven==insns*4
 mismatches=sum(x!=y for x,y in zip(raw,candidate))
 unknown_nz=sum(raw[i]!=0 for s in code_sections for i in
                range(s["file_offset"],s["file_offset"]+s["size_bytes"]) if not covered[i])
 assert mismatches==unknown_nz
 ids=set(index)
 result={
  "original_elf_size":len(raw),"original_sha256":sha(raw),
  "full_structural_reassembly":{"parts":len(part_index),"differing_bytes":0,
      "reconstructed_sha256":sha(rebuilt),
      "meaning":"All original ELF bytes preserved; NOT independent SDK re-link"},
  "function_based_partial_reassembly":{"functions":len(funcs),
      "instructions":insns,"verified_code_bytes":proven,
      "total_executable_section_bytes":code_size,
      "unaccounted_executable_bytes":code_size-proven,
      "identified_executable_fraction":round(proven/code_size,6),
      "byte_differences_if_unknown_code_omitted":mismatches,
      "wrong_original_function_bytes":bad,"overlapping_instructions":overlaps,
      "ghidra_elf_image_bias_hex":hex(bias),
      "per_section":[{"section":s["name"],"code_bytes":s["size_bytes"],
       "verified_function_bytes":sum(covered[s["file_offset"]:s["file_offset"]+s["size_bytes"]])}
       for s in code_sections],
      "not_a_runnable_library":True},
  "linkage":{"direct_call_edges":len(edges),
      "direct_edges_outside_inventory":sum(e["callee_address"] not in ids for e in edges),
      "dynamic_relocations":len(info["full_relocations"]),
      "dynamic_imports":len(info["full_dynamic_imports"]),
      "external_needed_libraries":info["dynamic_dependencies"]},
  "vendor_auth_modified":False}
 args.report.mkdir(parents=True,exist_ok=True)
 (args.report/"differential.json").write_text(json.dumps(result,indent=2))
 summary=[
  "# Expression2 original ELF decomposition and reassembly differential","",
  "- Original ELF size: %d bytes"%len(raw),
  "- Structurally split components: %d"%len(part_index),
  "- Reassembled complete ELF byte difference: **ZERO**",
  "- Original and reassembled SHA256: %s"%sha(raw),
  "- This is original-byte reassembly, NOT independently compiled code.","",
  "## Identified-function-only reconstruction",
  "- Original functions: %d"%len(funcs),
  "- Original verified instructions: %d"%insns,
  "- ELF executable-section bytes: %d"%code_size,
  "- Original function bytes verified exactly: %d"%proven,
  "- Executable bytes not covered by function list: **%d**"%(code_size-proven),
  "- Byte differences with unknown code blank: **%d**"%mismatches,
  "- Original function byte mismatches: %d"%bad,
  "- Ghidra image bias: %s"%hex(bias),"",
  "## Relations",
  "- Static call edges: %d"%len(edges),
  "- ELF dynamic relocations: %d"%len(info["full_relocations"]),
  "- Imported symbols: %d"%len(info["full_dynamic_imports"]),"",
  "Unknown executable bytes may include unvisited code, linkage stubs and indirect targets.",
  "Function-only composition cannot be executed as an independent SDK."]
 (args.report/"SUMMARY.md").write_text("\n".join(summary)+"\n")
 print("EXPR2_ELF_FILE_REASSEMBLY_VERIFIED parts=%d original_bytes=%d diff=0 sha256=%s"%(
       len(part_index),len(raw),sha(raw)))
 print("EXPR2_FUNCTION_ONLY_DELTA functions=%d instructions=%d confirmed=%d code=%d missing=%d different=%d"%(
       len(funcs),insns,proven,code_size,code_size-proven,mismatches))

if __name__=="__main__":
 parser=argparse.ArgumentParser()
 parser.add_argument("--elf",type=Path,required=True)
 parser.add_argument("--manifest",type=Path,required=True)
 parser.add_argument("--ghidra",type=Path,required=True)
 parser.add_argument("--temp",type=Path,required=True)
 parser.add_argument("--report",type=Path,required=True)
 run(parser.parse_args())
