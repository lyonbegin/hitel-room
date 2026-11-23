#!/usr/bin/env python3
"""Minimal APKTool/smali hooks into user-provided hash-matched original Zocbo APK.

Keep original functionality; patch no access control, authentication or trust
checks. Only logs redacted UI/navigation metadata.
"""
from pathlib import Path
import json,re,sys,os
root=Path(sys.argv[1])
smalis=sorted([x for x in root.glob("smali*") if x.is_dir()])
if not smalis:raise SystemExit("No smali directories detected")
out={"smali_dirs":len(smalis),"actions":[],"misses":[],"build_variant":"original-4.3.11(2)"}
S="Lcom/hitel/zocbodiag/Diag;"
def find(rel):
  for folder in smalis:
    f=folder/rel
    if f.exists():return f
  out["misses"].append("missing:"+rel);return None
def save(f,old,new,tag):
  if old!=new:
    f.write_text(new,encoding="utf8")
    out["actions"].append({"kind":tag,"smali":str(f.relative_to(root))})
    print("PATCHED",tag,f.relative_to(root),flush=True)
  else:out["misses"].append("patch-not-found:"+tag+":"+str(f.relative_to(root)))
def add_after_registers_in_method(src, method_name, code):
  # Restrict to a single method; do not inject across method boundary.
  pattern=r"(?ms)(^\.method[^\n]*\b"+re.escape(method_name)+r"\([^\n]*\)[^\n]*\n)(.*?)(^\.end method)"
  m=re.search(pattern,src)
  if not m:return src
  body=m.group(2)
  if code.strip() in body:return src
  hit=re.search(r"(?m)^    \.(?:locals|registers) \d+\s*$",body)
  if not hit:return src
  body=body[:hit.end()]+"\n"+code+body[hit.end():]
  return src[:m.start(2)]+body+src[m.end(2):]

def hook_activity(rel):
  f=find(rel)
  if not f:return
  s=f.read_text("utf8",errors="replace")
  m=re.search(r"(?ms)(^\.method[^\n]*\bonResume\(\)V\n)(.*?)(^\.end method)",s)
  line="    invoke-static {p0}, "+S+"->install(Landroid/app/Activity;)V\n"
  if m:
    body=m.group(2)
    if line.strip() not in body:
      call=re.search(r"(?m)^    invoke-super(?:/range)? \{[^\n]+\}, [^\n]+->onResume\(\)V\s*$",body)
      if call: body=body[:call.end()]+"\n"+line+body[call.end():]
      else:
        # Callback may omit explicit super call: insert immediately after declaration
        reg=re.search(r"(?m)^    \.(?:locals|registers) \d+\s*$",body)
        if reg:body=body[:reg.end()]+"\n"+line+body[reg.end():]
        else:out["misses"].append("onResume registers absent "+str(f))
      s2=s[:m.start(2)]+body+s[m.end(2):]
    else:s2=s
  else:
    sup=re.search(r"(?m)^\.super\s+(L[^;\s]+;)",s)
    if not sup:raise RuntimeError("No super for activity: "+str(f))
    s2=s+"\n.method protected onResume()V\n    .locals 0\n    invoke-super {p0}, "+sup.group(1)+"->onResume()V\n"+line+"    return-void\n.end method\n"
  save(f,s,s2,"activity-panel")

def hook_calls(f):
  s=f.read_text("utf8",errors="replace")
  # Insert without allocating any registers, immediately before the call.
  parts=[]
  lines=s.splitlines(keepends=True)
  count={"setCookie":0,"loadUrl":0,"addJavascriptInterface":0,"intentUrl":0,"pageStarted":0,"pageFinished":0}
  for l in lines:
    m=re.search(r"invoke-virtual\s+\{([^}]+)\},\s+Landroid/webkit/CookieManager;->setCookie\(Ljava/lang/String;Ljava/lang/String;\)V",l)
    if m:
      args=[x.strip() for x in m.group(1).split(",")]
      if len(args)>=3:
        parts.append("    invoke-static {"+args[2]+"}, "+S+"->cookie(Ljava/lang/String;)V\n")
        count["setCookie"]+=1
    m=re.search(r"invoke-virtual\s+\{([^}]+)\},\s+Landroid/webkit/WebView;->loadUrl\(Ljava/lang/String;\)V",l)
    if m:
      args=[x.strip() for x in m.group(1).split(",")]
      if len(args)>=2:
        parts.append("    invoke-static {"+args[0]+", "+args[1]+"}, "+S+"->attach(Landroid/webkit/WebView;Ljava/lang/String;)V\n")
        parts.append("    invoke-static {"+args[1]+"}, "+S+"->url(Ljava/lang/String;)V\n")
        count["loadUrl"]+=1
    m=re.search(r"invoke-virtual\s+\{([^}]+)\},\s+Landroid/webkit/WebView;->addJavascriptInterface\(Ljava/lang/Object;Ljava/lang/String;\)V",l)
    if m:
      parts.append("    invoke-static {}, "+S+"->jsInterface()V\n")
      count["addJavascriptInterface"]+=1
    l2=l
    parts.append(l2)
  s2="".join(parts)
  # Each class may have custom WebViewClient callback overriding onPageStarted/onPageFinished.
  code="    invoke-static {p1, p2}, "+S+"->page(Landroid/webkit/WebView;Ljava/lang/String;)V\n"
  s2=add_after_registers_in_method(s2,"onPageStarted",code)
  code2="    invoke-static {p1, p2}, "+S+"->pageFinished(Landroid/webkit/WebView;Ljava/lang/String;)V\n"
  s2=add_after_registers_in_method(s2,"onPageFinished",code2)
  if s2!=s:
    f.write_text(s2,encoding="utf8")
    out["actions"].append({"kind":"webview/cookie-callsite","smali":str(f.relative_to(root)),"counts":count})
    print("HOOKED",f.relative_to(root),count,flush=True)
  return count
# App activities; include login to retain copy access through login redirects.
for rel in [
 "com/eduzone/eduzoneviewer/ui/activities/MainActivity.smali",
 "com/eduzone/eduzoneviewer/ui/activities/CommonWebviewActivity.smali",
 "com/eduzone/eduzoneviewer/ui/activities/LoginActivity.smali",
]:
 hook_activity(rel)
# Explicit JS native call
f=find("com/eduzone/eduzoneviewer/interfaces/WebAppInterface.smali")
if f:
 s=f.read_text("utf8",errors="replace")
 s2=add_after_registers_in_method(s,"goPreviousExam","    invoke-static {}, "+S+"->bridge()V\n")
 save(f,s,s2,"goPreviousExam-bridge-entry")
 # Include every WebView navigation bridge overload, without recording its arguments.
 s=s2
 pattern=r"(?ms)(^\.method[^\n]*\bgoWebViewLink\([^\n]*\)[^\n]*\n)(.*?)(^\.end method)"
 def web_link_hook(m):
  body=m.group(2)
  code="    invoke-static {}, "+S+"->webViewLink()V"
  if code in body:return m.group(0)
  h=re.search(r"(?m)^    \.(?:locals|registers) \d+\s*$",body)
  if not h:return m.group(0)
  return m.group(1)+body[:h.end()]+"\n"+code+body[h.end():]+m.group(3)
 s3=re.sub(pattern,web_link_hook,s)
 save(f,s,s3,"goWebViewLink-bridge-overloads")
# Gate call: log exact boolean from smali 'iget-boolean'.
f=find("z3/m.smali") or find("p239z3/m.smali")
if f:
 s=f.read_text("utf8",errors="replace")
 m=re.search(r"(?ms)(^\.method[^\n]*\bq\(\)V\n)(.*?)(^\.end method)",s)
 if m:
  body=m.group(2)
  body2=re.sub(r"(?m)(^    iget-boolean (v\d+), [^\n]*->(?:e|f30298e):Z\s*$)",lambda x:x.group(1)+"\n    invoke-static {"+x.group(2)+"}, "+S+"->gate(Z)V",body,count=1)
  if body!=body2:save(f,s,s[:m.start(2)]+body2+s[m.end(2):],"goPreviousExam-gate")
  else:out["misses"].append("goPreviousExam boolean register not located")
# Original DEX classes are obfuscated: JADX 'p239z3/e' is often 'z3/e' in SMALI.
# Locate actual JavaScript/cookie/WebView invocations by their *method signature*
# rather than guessed obfuscated package prefixes.
for folder in smalis:
 for f in sorted(folder.rglob("*.smali")):
  raw=f.read_text("utf8",errors="replace")
  if ("Landroid/webkit/CookieManager;->setCookie(" in raw or
      "Landroid/webkit/WebView;->loadUrl(" in raw or
      "Landroid/webkit/WebView;->addJavascriptInterface(" in raw or
      "onPageStarted(Landroid/webkit/WebView;" in raw or
      "onPageFinished(Landroid/webkit/WebView;" in raw):
    hook_calls(f)
# Confirm patch counts / critical classes.
print("PATCH_SUMMARY",json.dumps(out,ensure_ascii=False),flush=True)
outf=Path(sys.argv[2]) if len(sys.argv)>2 else Path("diag-patch-report.json")
outf.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf8")
if not any(x["kind"]=="activity-panel" for x in out["actions"]):
 raise SystemExit("ABORT: no visible logger UI hooked")
if not any(x["kind"]=="goPreviousExam-bridge-entry" for x in out["actions"]):
 raise SystemExit("ABORT: original free-reading bridge not hooked")
if not any(x["kind"]=="webview/cookie-callsite" and x["counts"]["setCookie"]>0 for x in out["actions"]):
 raise SystemExit("ABORT: original cookie-writing call-sites not hooked")
