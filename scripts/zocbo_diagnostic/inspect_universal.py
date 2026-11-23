#!/usr/bin/env python3
"""Inspect app's precise split requirements and network gate in original decoded smali."""
import pathlib,re,zipfile
base=pathlib.Path("work/decoded")
p=base/"smali/com/eduzone/eduzoneviewer/ui/activities/CommonWebviewActivity.smali"
s=p.read_text()
ls=s.splitlines()
out=[]
for i,line in enumerate(ls):
 if "getLinkDownstreamBandwidthKbps" in line:
  lo=max(0,i-24);hi=min(len(ls),i+38)
  print("GATE_AT_LINE",i+1,flush=True)
  for x in range(lo,hi):print(f"{x+1}: {ls[x]}",flush=True)
  out.extend(f"{x+1}: {ls[x]}" for x in range(lo,hi))
(pathlib.Path("work")/"network_gate_smali.txt").write_text("\n".join(out))
print("MANIFEST_EXCERPT",base.joinpath("AndroidManifest.xml").read_text(errors="replace")[:15000],flush=True)
with zipfile.ZipFile("work/source/jokbo.xapk") as z:
 for name in z.namelist():
  if name.endswith(".apk") and name!="com.eduzone.eduzoneviewer.apk":
   with zipfile.ZipFile(z.open(name)) as spl:
    print("SPLIT",name, "FILES",len(spl.namelist()))
    print("SPLIT_SAMPLE", spl.namelist()[:80],flush=True)
