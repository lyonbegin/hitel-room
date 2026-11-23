#!/usr/bin/env python3
"""Patch the ACTUAL original MainActivity.onResume entry, not one conditional path.

R18 smali injects Diag.install after a conditional invoke-super. On normal
startup that branch can be skipped, so the diagnostic never runs. This file
fixes precisely the original method's entry callsite without changing auth,
SSO, WebView, PDF, or other MainActivity methods.
"""
from pathlib import Path
import re,sys
root=Path(sys.argv[1])
candidates=list(root.glob("smali*/com/eduzone/eduzoneviewer/ui/activities/MainActivity.smali"))
assert len(candidates)==1,candidates
p=candidates[0]
s=p.read_text("utf-8")
match=re.search(r"(?ms)(^\.method[^\n]*\bonResume\(\)V[^\n]*\n)(.*?)(^\.end method)",s)
assert match,"Original onResume missing"
body=match.group(2)
m=re.search(r"(?m)^(\s+\.(?:locals|registers) \d+[^\n]*\n)",body)
assert m,"register directive missing"
hook="    invoke-static {p0}, Lcom/hitel/zocbodiag/Diag;->install(Landroid/app/Activity;)V\n"
# Preserve original body and old hook as-is. The second invocation is
# idempotent due to the existing Diag panel tag and QA guard.
patched_body=body[:m.end()]+hook+body[m.end():]
assert patched_body.count(hook.strip())>=2,"Existing conditional hook unexpectedly absent"
s=s[:match.start(2)]+patched_body+s[match.end(2):]
p.write_text(s,"utf-8")
block=s[s.index(match.group(1)):].split(".end method",1)[0]
assert block.index(hook)<block.index("    invoke-super"),"Entry hook must precede all conditional paths"
print("R21_MAIN_ONRESUME_FIRST_INSTRUCTION_DIAG_HOOK_VERIFIED",p,flush=True)
print("R21_ORIGINAL_LOGIN_SSO_PDF_UNCHANGED no_other_smali_modified=true",flush=True)
