#!/usr/bin/env python3
from pathlib import Path
src=Path("/tmp/zocbo_jadx/sources")
parts=[]
for rel,windows in [
 ("com/eduzone/eduzoneviewer/ui/activities/CommonWebviewActivity.java",[(4660,4920)]),
 ("p079i3/C1173q0.java",[(125,205)]),
 ("A3/C0201s.java",[(45,105)]),
 ("p127n3/g.java",[(27,160)]),
 ("com/eduzone/eduzoneviewer/modules/HeaderInterceptor.java",[(65,185)]),
 ("p239z3/k.java",[(80,190)]),
]:
 f=src/rel
 if not f.exists(): continue
 ls=f.read_text("utf8","replace").splitlines()
 for a,b in windows:
  selected=[f"{i+1}: {ls[i][:400]}" for i in range(a-1,min(b,len(ls)))]
  parts.append(f"=== {rel}:{a}-{b} ===\n"+"\n".join(selected))
p=Path("evidence/zocbo-original-dex/network_path_detail.txt")
p.parent.mkdir(exist_ok=True,parents=True)
p.write_text("\n\n".join(parts),encoding="utf8")
print("DETAILED_NETWORK_PATH_SOURCE_LINES",len(parts),flush=True)
for part in parts:
 print(part[:12000],flush=True)
