#!/usr/bin/env python3
"""End-to-end proof: anonymous real API response -> HITEL mobile UI (no credentials)."""
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE="http://127.0.0.1:3000"
out=Path("zocbo-live-smoke-evidence")
out.mkdir(exist_ok=True)
results={}
def get(url):
 try:
  with urllib.request.urlopen(BASE+url,timeout=30) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:
  print('LIVE_API_ERROR',e.code,e.read().decode('utf-8',errors='replace')[:1200],flush=True)
  raise
status,data=get("/api/zocbo/public-catalog?site=H&grade=1&subject=MT")
results["high_api"]={"http":status,"ok":data.get("ok"),"examCount":len(data.get("exams",[])),"unitRows":len(data.get("parts",[])),"firstTitle":data.get("exams",[{}])[0].get("title")}
assert status==200 and data["ok"] and len(data.get("exams",[]))>=20,results["high_api"]
status,md=get("/api/zocbo/public-catalog?site=M&grade=2&subject=MT")
results["middle_api"]={"http":status,"ok":md.get("ok"),"examCount":len(md.get("exams",[])),"unitRows":len(md.get("parts",[])),"firstTitle":md.get("exams",[{}])[0].get("title")}
assert status==200 and md["ok"] and len(md.get("exams",[]))>=20,results["middle_api"]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
 ctx=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=1,is_mobile=True,locale="ko-KR")
 page=ctx.new_page()
 errors=[]
 page.on("pageerror",lambda e:errors.append(str(e)[:250]))
 page.goto(BASE+"/?screen=bankSearch",wait_until="domcontentloaded",timeout=40000)
 page.wait_for_selector(".zb-live-exam",timeout=40000)
 results["high_ui"]={"titlesVisible":page.locator(".zb-live-exam").count(),"units":page.locator(".zb-live-units details").count(),"iframes":page.locator("iframe").count(),"width":page.evaluate("document.documentElement.scrollWidth")}
 page.screenshot(path=str(out/"high-390.png"),full_page=False)
 assert results["high_ui"]["titlesVisible"]>=20 and results["high_ui"]["iframes"]==0
 assert results["high_ui"]["width"]<=390
 page.locator('[data-action="zbLiveGrade"][data-value="중2"]').click()
 page.wait_for_function("()=>document.querySelector('.zb-live-count')?.textContent.includes('383')",timeout=35000)
 results["middle_ui"]={"titlesVisible":page.locator(".zb-live-exam").count(),"units":page.locator(".zb-live-units details").count(),"width":page.evaluate("document.documentElement.scrollWidth")}
 page.screenshot(path=str(out/"middle-390.png"),full_page=False)
 assert results["middle_ui"]["titlesVisible"]>=20 and results["middle_ui"]["width"]<=390
 page.locator('[data-zb-live-query="1"]').fill("유리수")
 results["search"]={"visible":page.locator(".zb-live-exam").count(),"query":page.locator('[data-zb-live-query="1"]').input_value()}
 assert results["search"]["visible"]>=1
 page.goto(BASE+"/?screen=bankDownload",wait_until="domcontentloaded",timeout=30000)
 results["original_documents"]={"buttons":page.locator('[data-action="zbOriginalDownload"]').count(),"iframes":page.locator('iframe').count()}
 assert results["original_documents"]["buttons"]==35 and results["original_documents"]["iframes"]==0
 results["js_errors"]=errors
 assert not errors,errors
 browser.close()
(out/"report.json").write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
