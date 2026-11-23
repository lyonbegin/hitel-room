#!/usr/bin/env python3
"""Fix one verified false-negative preflight gate in exact original Zocbo APK.
Preserves original login, server authentication, SSO and actual network requests.
Refuses to patch any unknown source shape rather than guessing.
"""
from pathlib import Path
import json,re,sys
folder=Path(sys.argv[1])
f=folder/"smali/com/eduzone/eduzoneviewer/ui/activities/CommonWebviewActivity.smali"
s=f.read_text("utf-8")
name="Lcom/hitel/zocbodiag/Diag;->bandwidth(I)V"
gate=re.compile(
 r"(invoke-virtual \{v1\}, Ljava/lang/Integer;->intValue\(\)I"
 r"(?:(?!\.end method).){0,350}?"
 r"move-result v1"
 r"(?:(?!\.end method).){0,200}?"
 r")const/16 v2, 0x64"
 r"(?:(?!\.end method).){0,200}?"
 r"if-ge v1, v2, :cond_1b",re.S
)
ms=list(gate.finditer(s))
print("MATCH_EXACT_100KBPS_GATE",len(ms),flush=True)
if len(ms)!=1:
 raise SystemExit("ABORT_UNEXPECTED_GATE_SHAPE")
m=ms[0]
whole=m.group(0)
needle="    const/16 v2, 0x64"
if whole.count(needle)!=1:raise SystemExit("ABORT_MISSING_0x64")
replacement=whole.replace(needle,
 f"    invoke-static {{v1}}, {name}\n\n    const/16 v2, 0x0",1)
s=s[:m.start()]+replacement+s[m.end():]
assert s.count(name)==1
f.write_text(s,"utf-8")
report={"target":str(f),"originalThresholdKbps":100,"diagnosticThresholdKbps":0,"exactMatchCount":1,"networkActiveRequired":True,"serverAuthUntouched":True}
out=Path(sys.argv[2]) if len(sys.argv)>2 else Path("work/network-preflight-fix.json")
out.write_text(json.dumps(report,indent=2),"utf-8")
print("PATCH_VERIFIED",json.dumps(report),flush=True)
