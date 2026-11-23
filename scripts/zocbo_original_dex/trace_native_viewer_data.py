#!/usr/bin/env python3
"""Trace native Android PDF loading from the verified original XAPK/JADX tree."""
from pathlib import Path
import json,re
src=Path("/tmp/zocbo_jadx/sources")
out=Path("evidence/zocbo-viewer-callgraph")
out.mkdir(parents=True,exist_ok=True)
core=[
"p229y3/Y0.java","p229y3/T0.java","p079i3/Q0.java","p079i3/z0.java",
"p079i3/P0.java","p079i3/I0.java","p203v3/P.java","p203v3/Y.java",
"A3/x0.java","com/eduzone/eduzoneviewer/repository/S.java",
"com/eduzone/eduzoneviewer/repository/T.java",
]
terms=[
"requestTicketData","getPdfPath(","pdf_path","getHasTicket(","getQstImgPath(",
"getQstViewerPath(","getQstUrl(","getQstList(","EXTRA_PDF_EX_PAPR_NO",
"pdfUtil","pdfDrawRepository","shortUrl","@GET(","@POST(","@Url",
"downloadPdf","loadPdf","pdfium","PdfiumCore","getPdfFile",
]
text=[]
for rel in core:
    p=src/rel
    if not p.is_file():
        continue
    lines=p.read_text(encoding="utf-8",errors="replace").splitlines()
    text.append("======= FULL "+rel+" ("+str(len(lines))+" lines) =======")
    for ix,line in enumerate(lines):
        text.append(f"{ix+1}: {line[:700]}")
    print("CAPTURE_FULL",rel,len(lines))
# Locate all app-relevant references for the document loader. Restrict to source classes.
discovered=[]
for p in src.rglob("*.java"):
    rel=p.relative_to(src).as_posix()
    if rel.startswith(("androidx/","android/","kotlin/","kotlinx/","com/google/","com/facebook/","com/bumptech/","com/appsflyer/","com/shockwave/")):
        continue
    lines=p.read_text(encoding="utf-8",errors="replace").splitlines()
    matches=[i for i,line in enumerate(lines) if any(k in line for k in terms)]
    if not matches:continue
    strength=sum(any(k in lines[i] for k in ["getPdfPath(","pdf_path","requestTicketData","getQstViewerPath(","@GET(","@POST("]) for i in matches)
    if not strength and len(matches)<3: continue
    discovered.append((rel,lines,matches,strength))
discovered.sort(key=lambda row:(-row[3],-len(row[2]),row[0]))
text.append("======= ALL RELEVANT SOURCE CALL-SITES =======")
index=[]
for rel,lines,matches,strength in discovered[:120]:
    if rel in core:continue
    index.append({"file":rel,"lines":len(lines),"hits":[i+1 for i in matches],"strength":strength})
    text.append("======= MATCHES "+rel+" =======")
    spans=[]
    for i in matches[:40]:
        a=max(i-14,0);b=min(i+21,len(lines))
        if spans and a<=spans[-1][1]+3:spans[-1]=(spans[-1][0],max(b,spans[-1][1]))
        else:spans.append((a,b))
    for a,b in spans[:25]:
        text.extend(f"{j+1}: {lines[j][:700]}" for j in range(a,min(b,a+160)))
        text.append("---")
trace="\n".join(text)
(out/"pdf_loader_deep_trace.txt").write_text(trace[:2500000],encoding="utf-8")
(out/"pdf_loader_index.json").write_text(json.dumps(index,ensure_ascii=False,indent=2),encoding="utf-8")
print("PDF_LOADER_TRACE_BYTES",len(trace.encode("utf-8")),"INDEX_FILES",len(index))
print("TOP_MATCHES",json.dumps(index[:18],ensure_ascii=False))
