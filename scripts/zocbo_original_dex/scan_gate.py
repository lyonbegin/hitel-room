#!/usr/bin/env python3
"""Collect only decisive access-mode code from decompiled original APK."""
import json,re
from pathlib import Path
base=Path("/tmp/zocbo_jadx/sources")
out=Path("evidence/zocbo-original-dex/app_gate_audit.json")
patterns={
 "ua_set":r"setUserAgentString\s*\(",
 "ua_get":r"getUserAgentString\s*\(",
 "cookie":r"setCookie\s*\(|SERVICETYPECD|CID is empty|CookieManager",
 "app_bridge":r"zocbostudyaos|goPreviousExam|addJavascriptInterface",
 "app_link":r"link\.zocbo\.com|goWebView|onetime_token_key|/sso/setCookie\.asp",
 "app_markers":r"app_version|os-type|device_id|search_webview",
 "request_headers":r"loadUrl\s*\([^,\n]+,|X-Requested-With|addRequestHeader|setRequestProperty|addHeader\(",
 "exam_path":r"/exam/(?:school/)?previousExam\.asp|/Freetrial/FreeReading\.asp"
}
results={k:[] for k in patterns}
for f in sorted(base.rglob("*.java")):
 try:txt=f.read_text("utf8","replace")
 except Exception:continue
 if len(txt)>6_000_000:continue
 lines=txt.splitlines()
 for no,line in enumerate(lines,1):
  for k,p in patterns.items():
   if re.search(p,line,re.I):
    if len(results[k])<240:
     results[k].append({"file":str(f.relative_to(base)),"line":no,"text":line.strip()[:350]})
# Key class snippets for CID origins / session state, and actual page-load helper.
focus={}
for path in [
 "com/eduzone/eduzoneviewer/repository/C1010a.java",
 "com/eduzone/eduzoneviewer/repository/C1020k.java",
 "p239z3/e.java",
 "p239z3/m.java",
 "p239z3/k.java",
 "p239z3/a.java",
]:
 f=base/path
 if not f.exists():continue
 ls=f.read_text("utf8","replace").splitlines()
 if path.endswith("C1010a.java") or path.endswith("C1020k.java"):
  focus[path]=[f"{n}: {s[:400]}" for n,s in enumerate(ls[:450],1)]
 else:
  keyterms=["SERVICETYPECD","setCookie(","CID is empty","public final void h(","setUserAgentString(","addJavascriptInterface(","goPreviousExam","/exam/school/previousExam.asp"]
  points=[i for i,l in enumerate(ls) if any(k in l for k in keyterms)]
  take=set()
  for i in points:
   take.update(range(max(0,i-12),min(len(ls),i+20)))
  focus[path]=[f"{i+1}: {ls[i][:400]}" for i in sorted(take)]
obj={"hits":results,"key_classes":focus}
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding="utf8")
print("=== APP-ONLY GATE CODE SCAN ===",flush=True)
for k,v in results.items():
 print("PATTERN",k,"count_capped",len(v),flush=True)
 for row in v[:15]:print("HIT",k,str(row),flush=True)
for k,v in focus.items():
 print("FOCUS",k,"lines",len(v),flush=True)
 for row in v[:110]:
  if ("C1010a.java" in k and (" e(" in row or "return" in row or "String" in row)) or ("C1020k.java" in k and (" e(" in row or "return" in row)):
   print("FOCUS_LINE",row,flush=True)
