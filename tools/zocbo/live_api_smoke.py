#!/usr/bin/env python3
"""Evidence-backed, unmocked original mobile chapter/episode end-to-end check."""
import json
import os
import urllib.request
import urllib.error
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get("ZOCBO_BASE_URL","http://127.0.0.1:3000").rstrip("/")
out=Path("zocbo-live-smoke-evidence")
out.mkdir(exist_ok=True)
R={}
def query(path):
 try:
  with urllib.request.urlopen(BASE+path,timeout=35) as resp:return resp.status,json.load(resp)
 except urllib.error.HTTPError as e:
  print("API HTTP ERROR",e.code,e.read().decode("utf8",errors="replace")[:500],flush=True)
  raise
for title,path,expected,expected_parts in [
 ("high","/api/zocbo/public-catalog?site=H&grade=1&subject=MT",411,37),
 ("middle","/api/zocbo/public-catalog?site=M&grade=2&subject=MT",383,32)
]:
 code,data=query(path)
 R[title+"_api"]={
   "http":code,"count":len(data.get("exams",[])),
   "partRows":len(data.get("parts",[])),"subjects":len(data.get("subjects",[])),
   "sample":data.get("exams",[{}])[0]
 }
 assert code==200 and data.get("ok") and R[title+"_api"]["count"]==expected
 assert R[title+"_api"]["partRows"]==expected_parts
 example=R[title+"_api"]["sample"]
 assert example.get("rootName") and example.get("subName") and example.get("detailName") and example.get("episode"),example
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
 errors=[]
 for width in [390,360]:
  ctx=browser.new_context(viewport={"width":width,"height":844},device_scale_factor=1,is_mobile=True,locale="ko-KR")
  page=ctx.new_page()
  page.on("pageerror",lambda e:errors.append(str(e)[:300]))
  page.goto(BASE+"/?screen=bankSearch",wait_until="domcontentloaded",timeout=40000)
  page.wait_for_function("()=>document.querySelector('.zb-native-summary')?.innerText.includes('411')",timeout=45000)
  R[f"mobile_{width}_initial"]={
   "rootChapters":page.locator(".zb-native-root").count(),
   "initialVisibleExams":page.locator(".zb-native-episode").count(),
   "scrollWidth":page.evaluate("document.documentElement.scrollWidth"),
   "viewportWidth":page.evaluate("innerWidth"),
   "iframes":page.locator("iframe").count()
  }
  assert R[f"mobile_{width}_initial"]["rootChapters"]>=5
  assert R[f"mobile_{width}_initial"]["initialVisibleExams"]==0
  assert R[f"mobile_{width}_initial"]["scrollWidth"]<=width
  assert R[f"mobile_{width}_initial"]["iframes"]==0
  page.screenshot(path=str(out/f"chapters-closed-{width}.png"),full_page=False)
  page.locator('[data-action="zbNativeRoot"]').first.click()
  page.locator('[data-action="zbNativeSub"]').first.wait_for()
  page.locator('[data-action="zbNativeSub"]').first.click()
  page.locator('[data-action="zbNativePaper"]').first.wait_for(timeout=12000)
  R[f"mobile_{width}_chapter"]={
   "subchapters":page.locator('[data-action="zbNativeSub"]').count(),
   "visibleEpisodeButtons":page.locator('[data-action="zbNativePaper"]').count(),
   "rootName":page.locator('[data-action="zbNativeRoot"]').first.inner_text()
  }
  assert R[f"mobile_{width}_chapter"]["visibleEpisodeButtons"]>=1
  page.screenshot(path=str(out/f"chapters-open-{width}.png"),full_page=False)
  chosen=page.locator('[data-action="zbNativePaper"]').first.get_attribute("data-id")
  page.locator('[data-action="zbNativePaper"]').first.click()
  page.get_by_role("dialog",name="시험지 정보").wait_for()
  R[f"mobile_{width}_paper"]={
   "selected_id":chosen,
   "shown_in_sheet":chosen in page.get_by_role("dialog").inner_text(),
   "login_or_download_claim":page.get_by_role("dialog").locator("a").all_inner_texts()
  }
  assert R[f"mobile_{width}_paper"]["shown_in_sheet"]
  page.locator('[data-action="zbNativeClose"]').last.click()
  assert page.get_by_role("dialog").count()==0
  page.locator('[data-action="zbNativeMode"][data-value="titles"]').click()
  assert page.locator(".zb-native-title-item").count()==411
  page.locator('[data-zb-native-search]').fill("다항식")
  assert page.locator(".zb-native-title-item").count()>0
  page.locator('[data-action="zbNativeGrade"][data-value="중2"]').click()
  page.wait_for_function("()=>document.querySelector('.zb-native-summary')?.innerText.includes('383')",timeout=35000)
  R[f"mobile_{width}_middle"]={
   "middle_count":page.locator(".zb-native-summary").inner_text(),
   "root_chapters":page.locator(".zb-native-root").count(),
   "scrollWidth":page.evaluate("document.documentElement.scrollWidth")
  }
  assert R[f"mobile_{width}_middle"]["scrollWidth"]<=width
  page.locator('[data-zb-native-search]').fill("")
  page.locator('[data-action="zbNativeMode"][data-value="titles"]').click()
  assert page.locator(".zb-native-title-item").count()==383
  page.screenshot(path=str(out/f"middle-titles-{width}.png"),full_page=False)
  ctx.close()
 ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True)
 page=ctx.new_page()
 page.goto(BASE+"/?screen=bankDownload",wait_until="domcontentloaded",timeout=35000)
 R["original_event"]={"publicButtons":page.locator('[data-action="zbOriginalDownload"]').count(),"iframes":page.locator("iframe").count()}
 assert R["original_event"]=={"publicButtons":35,"iframes":0}
 ctx.close()
 browser.close()
R["js_errors"]=errors
assert not errors,errors
(out/"report.json").write_text(json.dumps(R,ensure_ascii=False,indent=2),encoding="utf8")
print("HIERARCHY_E2E_PASSED",json.dumps({k:v for k,v in R.items() if k!="high_api" and k!="middle_api"},ensure_ascii=False))
