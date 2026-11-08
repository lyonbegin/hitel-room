#!/usr/bin/env python3
"""Read-only public browser verification of original mobile Zocbo pages.
No login, account cookies, protected content, download, or request replay.
All observed responses are summarized to metadata; no bodies or secrets archived.
"""
import json
import time
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

OUT=Path("zocbo-browser-evidence")
OUT.mkdir(parents=True,exist_ok=True)
targets={
 "middle":"https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=MT",
 "high":"https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000020000200003&siteid=H&subject_cd=MT",
 "finals":"https://m.zocbo.com/event/pre-test2026d/"
}
report={}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--disable-dev-shm-usage"])
 for key,url in targets.items():
  ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,device_scale_factor=1,locale="ko-KR")
  page=ctx.new_page()
  requests=[]
  errors=[]
  def observe(r):
   u=urlparse(r.url)
   if u.hostname not in ("m.zocbo.com","www.zocbo.com") or not u.path.lower().startswith("/exam/ajax/"):
    return
   record={"method":r.request.method,"path":u.path,"status":r.status,"responseType":r.headers.get("content-type","").split(";")[0]}
   try:
    if r.ok and "json" in record["responseType"]:
     o=r.json()
     if isinstance(o,dict):
      record["json_keys"]=list(o)[:25]
      record["array_sizes"]={k:len(v) for k,v in o.items() if isinstance(v,list)}
      record["result"]=str(o.get("RESULT",""))[:40]
   except Exception as ex: record["parse_error"]=type(ex).__name__
   requests.append(record)
  page.on("response",observe)
  page.on("pageerror",lambda exc:errors.append(str(exc)[:240]))
  try:
   response=page.goto(url,wait_until="domcontentloaded",timeout=55000)
   page.wait_for_timeout(12000)
   info=page.evaluate("""() => {
     const main=document.querySelector('#examMain');
     const all=[...document.querySelectorAll('#filter button, .zbFilter button')].map(e=>e.textContent.trim()).filter(Boolean);
     return {title:document.title,url:location.href,examMainExists:!!main,examMainChildCount:main?.children.length||0,examMainTextChars:main?.innerText.length||0,examMainPreview:(main?.innerText||'').slice(0,400),filterButtonLabels:all.slice(0,25),bodyScrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,buttonCount:document.querySelectorAll('button').length,originalSampleDownloadButtons:document.querySelectorAll('[data-act="sampleDown"]').length};
   }""")
   page.screenshot(path=str(OUT/f"{key}-390.png"),full_page=False)
   report[key]={"navigationHttpStatus":response.status if response else None,"page":info,"ajax":requests,"pageErrors":errors[:15]}
  except Exception as ex:
   report[key]={"failure":str(ex)[:500],"ajax":requests,"pageErrors":errors[:15]}
  ctx.close()
 browser.close()
(OUT/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
for key,result in report.items():
 print("PAGE",key,"HTTP",result.get("navigationHttpStatus"),"EXAM",result.get("page",{}).get("examMainChildCount"),"AJAX",[(r["path"],r["status"],r.get("array_sizes")) for r in result.get("ajax",[])],"FAIL",result.get("failure"))
