#!/usr/bin/env python3
"""Download exactly the 25 public static JS URLs extracted from user-provided
Zocbo previousExam.asp header. No session cookies, credentials or private pages.
Does not publish other people's source code as a new repository commit.
"""
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
import urllib.request,urllib.error,urllib.parse,json,hashlib,zipfile,time,re
root=Path("work/zocbo_public_static_js")
root.mkdir(parents=True,exist_ok=True)
paths="""/cloudfront/js/app/vendors/jquery-3.7.1.min.js
/cloudfront/js/app/vendors/swiper-bundle.min.js
/cloudfront/js/app/ui.js
/cloudfront/js/app/ui-swiper.js
/js/conf/config.js?20261118170001
/js/common/common.js?20261118170001
/js/common/storage.js?20261118170001
/js/common/appLink.js?20261118170001
/js/common/track.js?20261118170001
/js/common/appPageHijacking.js?20261118170001
/js/common/menu.js?20261118170001
/js/common/openMonth.js?20261118170001
/js/app/include/config.js?20261118170001
/js/member/loginPop.js?20261118170001
/Common/Js/Hierarchy.js?20261118170001
/js/common/comm.js?20261118170001
/js/common/util.js?20261118170001
/js/alarm/push.js?20261118170001
/js/exam/storageBox.js?20261118170001
/Common/ExamDownload/Download_New.js?20261118170001
/js/exam/previousexam.js?20261118170001
/js/exam/examList/common.js?20261118170001
/js/exam/examList/Exam.js?20261118170001
/js/app/include/modal.js?20261118170001
/js/app/include/bottomSheetLayer.js?20261118170001""".splitlines()
assert len(paths)==25
def fetch(index,path):
 out={"path":path,"index":index,"attempts":[],"downloaded":False}
 for host in ["m.zocbo.com","www.zocbo.com"]:
  url=f"https://{host}{path}"
  req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36","Accept":"*/*","Referer":"https://m.zocbo.com/exam/school/previousExam.asp"})
  at={"host":host,"url":url}
  try:
   with urllib.request.urlopen(req,timeout=9) as r:
    b=r.read(4_000_001);at.update({"status":r.status,"bytes":len(b),"content_type":r.headers.get("Content-Type",""),"final_url":r.url})
   if len(b)>4_000_000:at["failure"]="too_large"
   elif not b or b[:50].lower().lstrip().startswith((b"<!doctype html",b"<html")):at["failure"]="html_instead_of_js"
   else:
    name=re.sub(r"[^a-zA-Z0-9._-]","_",urllib.parse.urlparse(url).path.rsplit("/",1)[-1])
    p=root/f"{index:02d}_{name}"
    p.write_bytes(b)
    at.update({"sha256":hashlib.sha256(b).hexdigest(),"file":str(p)})
    out["downloaded"]=True;out["file"]=str(p)
  except Exception as e:at["failure"]=type(e).__name__+":"+str(e)[:180]
  out["attempts"].append(at)
  if out["downloaded"]:break
 return out
print("START",len(paths),flush=True)
with ThreadPoolExecutor(max_workers=8) as pool:
 futures={pool.submit(fetch,i,p):i for i,p in enumerate(paths,1)}
 results=[f.result() for f in as_completed(futures)]
results.sort(key=lambda x:x["index"])
for r in results:
 print("JS",r["index"],r["path"],"downloaded",r["downloaded"],"attempts",json.dumps([{k:a.get(k) for k in ("host","status","bytes","failure")} for a in r["attempts"]],ensure_ascii=False),flush=True)
report={"total":len(paths),"saved":sum(bool(r["downloaded"]) for r in results),"entries":results}
(root/"manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
# Analysis based ONLY on downloaded real JS.
needles=[b"getPrevoiusViewerAuthCheck",b"hidden-exam-previous-viewer-not-auth",b"previousExamCLS",b"goPreviousViewer"]
hits={}
for x in results:
 if not x["downloaded"]:continue
 p=Path(x["file"]);b=p.read_bytes();t=b.decode("utf8","replace")
 found=[]
 for token in needles:
  key=token.decode()
  pos=t.find(key)
  if pos!=-1:found.append({"keyword":key,"offset":pos,"context":t[max(0,pos-450):pos+1050]})
 if found:hits[x["path"]]=found
(root/"function_trace.json").write_text(json.dumps(hits,ensure_ascii=False,indent=2),encoding="utf8")
with zipfile.ZipFile("work/zocbo_public_static_js_audit.zip","w",zipfile.ZIP_DEFLATED) as z:
 for p in root.rglob("*"):
  if p.is_file():z.write(p,p.relative_to(root))
print("FINAL_SAVED",report["saved"],"TOTAL",len(paths),"FUNCTION_MATCHES",list(hits),flush=True)
