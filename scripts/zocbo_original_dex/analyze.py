#!/usr/bin/env python3
"""Offline exact-hash Zocbo 4.3.11(2) Android APK reverse-engineering evidence.

Unpacks verified XAPK, runs jadx, writes call-site excerpts and URI resources.
Never publishes entire third-party decompiled source or auth secrets.
"""
import hashlib,json,os,re,subprocess,sys,zipfile
from pathlib import Path

ROOT=Path("evidence/zocbo-original-dex");ROOT.mkdir(parents=True,exist_ok=True)
SRC=Path("source/jokbo.xapk"); EXPECT="d45ba34990d4f4eaaad126371023bba74be0ca120b4b26e78af2c4a8fa2ba3a5"
assert SRC.exists(),"Exact original jokbo.xapk not available"
digest=hashlib.sha256(SRC.read_bytes()).hexdigest()
assert digest==EXPECT,f"SHA-256 mismatch: {digest}"
print("SOURCE_SHA256_VERIFIED",digest,flush=True)
with zipfile.ZipFile(SRC) as z:
    apks=[x for x in z.infolist() if x.filename.endswith(".apk") and 0<x.file_size<180_000_000]
    assert apks,"No APK entry in verified XAPK"
    target=sorted(apks,key=lambda x:("base" not in x.filename.lower(),-x.file_size))[0]
    APK=ROOT/"original-base.apk"
    with z.open(target) as f, APK.open("wb") as o:
        import shutil;shutil.copyfileobj(f,o)
    print("EXTRACTED_APK",target.filename,APK.stat().st_size,flush=True)
OUT=Path("/tmp/zocbo_jadx")
try:
    cmd=["jadx","--no-res","--no-debug-info","--show-bad-code","-j","4","-d",str(OUT),str(APK)]
    r=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=420)
    (ROOT/"jadx.log").write_text(r.stdout[-20000:],encoding="utf8")
    print("JADX_EXIT",r.returncode,"LOG_TAIL",r.stdout[-1000:],flush=True)
except Exception as e:
    (ROOT/"error.txt").write_text(str(e),encoding="utf8")
    raise

PATTERNS={
 "free_entry":r"FreeReading|Freetrial|previousexam|search_webview|goWebView|기출열람실|무료열람|무료 기출",
 "deep_link":r"link\.zocbo\.com|type=9|zocbo://|eduzone://|intent://",
 "webview_entry":r"loadUrl\s*\(|shouldOverrideUrlLoading|setWebViewClient|evaluateJavascript|addJavascriptInterface",
 "app_gate":r"getUserAgentString|setUserAgentString|X-Requested-With|WebView|isApp|appVersion",
}
out={"sha256":digest,"original_apk_filename":target.filename,"files_exam":[],"files_webview":[],"direct_urls":[],"possible_calls":[]}
excerpts=[]
matched_java=[]
for f in sorted(OUT.rglob("*.java")):
    # Prefer specific key matches, then relevant WebView classes; no generic library code export.
    try: s=f.read_text("utf8","replace")
    except Exception:continue
    lines=s.splitlines()
    direct=[(idx+1,line.strip()) for idx,line in enumerate(lines) if re.search(PATTERNS["free_entry"]+"|"+PATTERNS["deep_link"],line,re.I)]
    if direct:
        matched_java.append(str(f.relative_to(OUT)))
        out["files_exam"].append({"file":str(f.relative_to(OUT)),"match_count":len(direct),"lines":[n for n,_ in direct[:30]]})
        for n,line in direct[:20]:
            start=max(0,n-12);end=min(len(lines),n+13)
            excerpt="\n".join(f"{i+1}: {lines[i][:400]}" for i in range(start,end))
            excerpts.append(f"===== {f.relative_to(OUT)} : line {n} =====\n"+excerpt+"\n")
    if re.search("eduzone|zocbo",str(f),re.I):
        webhits=[(idx+1,line.strip()) for idx,line in enumerate(lines) if re.search(PATTERNS["webview_entry"],line,re.I)]
        if webhits:
            out["files_webview"].append({"file":str(f.relative_to(OUT)),"lines":[n for n,_ in webhits[:35]]})
            for n,line in webhits[:5]:
                start=max(0,n-10);end=min(len(lines),n+11)
                excerpt="\n".join(f"{i+1}: {lines[i][:400]}" for i in range(start,end))
                excerpts.append(f"===== WEBVIEW {f.relative_to(OUT)} : line {n} =====\n"+excerpt+"\n")
    if len(excerpts)>300:break
out["files_exam"]=out["files_exam"][:100]
out["files_webview"]=out["files_webview"][:120]
# Safe short excerpts of actual methods only, no user data or auth values.
(ROOT/"callsites.txt").write_text("\n".join(excerpts)[:350000],encoding="utf8")
(ROOT/"analysis.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf8")
print("EXAM_SOURCE_FILES",len(out["files_exam"]),"WEBVIEW_SOURCE_FILES",len(out["files_webview"]),flush=True)
for f in out["files_exam"][:35]:print("FREE_READING_CALLSITE",json.dumps(f,ensure_ascii=False),flush=True)
for f in out["files_webview"][:35]:print("WEBVIEW_CALLSITE",json.dumps(f,ensure_ascii=False),flush=True)
if not out["files_exam"]:print("WARNING: No direct free-reading URL in DEX; possible remote HTML/script or obfuscated runtime navigation",flush=True)

# Focused native navigation call chain: JS bridge -> Runnable -> Activity -> WebView
focus=[]
focus_paths=[
 "sources/com/eduzone/eduzoneviewer/interfaces/WebAppInterface.java",
 "sources/com/eduzone/eduzoneviewer/interfaces/d.java",
 "sources/p040e3/c.java",
 "sources/p040e3/d.java",
 "sources/p040e3/k.java",
 "sources/p079i3/S0.java",
 "sources/p079i3/z0.java",
 "sources/p239z3/k.java",
 "sources/p239z3/h.java",
 "sources/p239z3/a.java",
 "sources/p239z3/b.java",
 "sources/A3/L.java",
 "sources/p040e3/d.java",
 "sources/p239z3/e.java",
 "sources/p229y3/A1.java",
 "sources/com/eduzone/eduzoneviewer/ui/activities/MainActivity.java",
 "sources/com/eduzone/eduzoneviewer/ui/activities/CommonWebviewActivity.java",
 "sources/p239z3/m.java",
]
for target in focus_paths:
 f=OUT/target
 if f.exists():
  ls=f.read_text("utf8","replace").splitlines()
  focus.append("=== COMPLETE TARGET SOURCE: "+target+" ===\n"+"\n".join(f"{i+1}: {line}" for i,line in enumerate(ls[:1700]))+"\n")
for f in sorted(OUT.rglob("*.java")):
 try:s=f.read_text("utf8","replace")
 except Exception:continue
 keys=["f29300b0", "goPreviousExam", "previousExam.asp", "school/previousExam", "goWebViewLink",
       "addJavascriptInterface(", "setUserAgentString(", "getUserAgentString(", "SchoolSearchActivity.class",
       "WebAppInterface(", "main/pastexam", "zocbo://viewer", "goPreviousExam()"]
 ls=s.splitlines()
 hits=[(i,k) for i,line in enumerate(ls) for k in keys if k in line]
 if hits:
  # Include anything with interface setup or actual free-room navigation
  if ("eduzone" in str(f) or "p239z3" in str(f) or "p079i3" in str(f) or
      any(k in ("goPreviousExam","previousExam.asp","school/previousExam","addJavascriptInterface(","f29300b0") for i,k in hits)):
   selected=[]
   for i,k in hits[:24]:
    st=max(0,i-24);en=min(len(ls),i+44)
    selected.append(f"=== {f.relative_to(OUT)}:{i+1} ({k}) ===\n"+
      "\n".join(f"{p+1}: {ls[p][:350]}" for p in range(st,en)))
   focus.append("\n".join(selected))
(ROOT/"focused_navigation.txt").write_text("\n\n".join(focus)[:1200000],encoding="utf8")
print("FOCUSED_NAVIGATION_CHARS",sum(len(x) for x in focus),flush=True)

APK.unlink(missing_ok=True)
