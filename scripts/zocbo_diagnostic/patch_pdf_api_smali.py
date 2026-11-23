#!/usr/bin/env python3
"""Instrument exact original 4.3.11(2) OkHttp callsites for PDF API and download.
Abort if expected callsites cannot be proved instead of patching a guessed class.
Does not patch API responses, authentication, cookie storage or any server URL.
"""
from pathlib import Path
import re,sys,json

root=Path(sys.argv[1]); out=Path(sys.argv[2])
paths=sorted(p for d in root.glob("smali*") if d.is_dir() for p in d.rglob("*.smali"))
assert paths,"decoded smali files are missing"
API="Lcom/hitel/zocbodiag/NetTrace;->apiClient(Ljava/lang/Object;)V"
PDF="Lcom/hitel/zocbodiag/NetTrace;->pdfClient(Ljava/lang/Object;)V"
MODEL="Lcom/hitel/zocbodiag/NetTrace;->pdfPath(Ljava/lang/String;)V"
build_re=re.compile(r"(?m)^([ \t]*)(invoke-virtual(?:/range)?)\s+\{([^}]+)\},\s+Lokhttp3/OkHttpClient\$Builder;->build\(\)Lokhttp3/OkHttpClient;")
method_re=re.compile(r"(?ms)^\.method[^\n]*\n.*?^\.end method")
results={"api_builder":[],"pdf_builder":[],"model_pdf_path":[],"patch_version":"focused-api-pdf-v1"}
def patch_builder(source,method,marker):
  def replace(m):
    group=m.group(3)
    regs=[r.strip() for r in group.split(",")]
    if len(regs)!=1:raise RuntimeError("unexpected builder invocation registers "+group)
    line="    invoke-static {"+regs[0]+"}, "+marker+"\n"
    return line+m.group(0)
  if marker in method:return method,0
  return build_re.subn(replace,method)
for f in paths:
  original=f.read_text("utf8","replace")
  # Locate only known original Hilt provider, not by obfuscated filename.
  is_provider='Lokhttp3/OkHttpClient$Builder;' in original and \
    ('Lcom/eduzone/eduzoneviewer/modules/HeaderInterceptor;' in original) and \
    ('https://m.zocbo.com/_AppApi/' in original)
  # Locate original PDF HTTP function via Request.Builder URL assignment + new OkHttpClient
  # that opens the file, not the shared Retrofit client.
  is_pdf='Lokhttp3/Request$Builder;->url(Ljava/lang/String;)' in original and \
    'Lokhttp3/OkHttpClient$Builder;->build()Lokhttp3/OkHttpClient;' in original and \
    'Lokhttp3/Call;->enqueue(' in original
  if not is_provider and not is_pdf and 'getPdfPath()Ljava/lang/String;' not in original:continue
  touched=[0,0,0]
  def rewrite_method(m):
    s=m.group(0)
    if is_provider and 'Lokhttp3/OkHttpClient$Builder;->build()Lokhttp3/OkHttpClient;' in s and 'Lcom/eduzone/eduzoneviewer/modules/HeaderInterceptor;' in s:
      s,n=patch_builder(original,s,API)
      touched[0]+=n
    if is_pdf and 'Lokhttp3/Request$Builder;->url(Ljava/lang/String;)' in s and 'Lokhttp3/OkHttpClient$Builder;->build()Lokhttp3/OkHttpClient;' in s:
      s,n=patch_builder(original,s,PDF)
      touched[1]+=n
    if '->getPdfPath()Ljava/lang/String;' in s and MODEL not in s:
      # The getter result must be copied to a register immediately after invocation.
      p=re.compile(r"(?m)(^    invoke-(?:virtual|interface)(?:/range)? \{[^\n]+\}, L[^;\n]+;->getPdfPath\(\)Ljava/lang/String;[ \t]*\n)(^    move-result-object (v\d+|p\d+)[ \t]*$)")
      def insert_hook(z):
        touched[2]+=1
        return z.group(1)+z.group(2)+"\n    invoke-static {"+z.group(3)+"}, "+MODEL
      s=p.sub(insert_hook,s)
    if re.search(r"^\.method[^\n]*\bgetPdfPath\(\)Ljava/lang/String;",s,re.M) and MODEL not in s:
      p=re.compile(r"(?m)^    return-object (v\d+|p\d+)[ \t]*$")
      def insert_return(z):
        touched[2]+=1
        return "    invoke-static {"+z.group(1)+"}, "+MODEL+"\n"+z.group(0)
      s=p.sub(insert_return,s,count=1)
    return s
  modified=method_re.sub(rewrite_method,original)
  if modified!=original:f.write_text(modified,encoding="utf8")
  for i,key in enumerate(["api_builder","pdf_builder","model_pdf_path"]):
    if touched[i]:
      results[key].append({"smali":str(f.relative_to(root)),"hook_count":touched[i]})
      print("INJECT",key,str(f.relative_to(root)),touched[i],flush=True)
  if is_provider:print("PROVIDER_CANDIDATE",str(f.relative_to(root)),flush=True)
  if is_pdf:print("PDF_CANDIDATE",str(f.relative_to(root)),flush=True)
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf8")
print("RESULT",json.dumps(results,ensure_ascii=False),flush=True)
for k in ("api_builder","pdf_builder","model_pdf_path"):
  n=sum(t["hook_count"] for t in results[k])
  if n!=1:raise SystemExit(f"ABORT_EXPECTED_EXACTLY_ONE_{k}_FOUND_{n}")
