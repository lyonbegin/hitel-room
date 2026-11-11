#!/usr/bin/env python3
"""Every updated tutoring deep link opens its own screen in a fresh mobile browser."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.getenv("HITEL_BASE_URL","https://hitel-education-zocbo-unified-production.up.railway.app").rstrip("/")
OUT=Path("tutor-direct-link-evidence");OUT.mkdir(exist_ok=True,parents=True)
CASES=[
 ("groups","스터디 찾기","#phone .tp-discover-item"),
 ("groupSearch","스터디 검색","#phone .tp-discovery-filters"),
 ("groupPreview","스터디 상세","#phone .tp-small-row"),
 ("groupAITutor","AI 과외","#phone .tp-book-item"),
 ("groupCoachProfile","AI 선생님","#phone .tp-profile"),
 ("groupBookDetail","AI 선생님","#phone .tp-profile"),
 ("groupCreate","스터디 만들기","#phone #tp-group-create-form"),
 ("groupJoin","스터디 참여","#phone #tp-join-form"),
 ("groupDetail","교재·AI","#phone .tp-hero-coach"),
 ("groupQuestions","질문하기","#phone .tp-search"),
 ("groupTeacherChat","선생님 설정","#phone .tp-app"),
 ("groupLearning","학습","#phone .tp-study-tabs"),
 ("groupTutorSettings","AI 선생님 설정","#phone .tp-app"),
 ("bankSearch","족보","#phone .zb-faithful")
]
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 for width in (320,390):
  for route,label,selector in CASES:
   ctx=browser.new_context(viewport={"width":width,"height":844},is_mobile=True,has_touch=True,locale="ko-KR",timezone_id="Asia/Seoul")
   page=ctx.new_page();errors=[]
   page.on("pageerror",lambda e:errors.append(str(e)))
   page.goto(BASE+"/?screen="+route+"&group=demo-five"+("&listing=sample-math-ssen" if route=="groupPreview" else ""),wait_until="domcontentloaded",timeout=60000)
   page.locator(selector).first.wait_for(state="attached",timeout=35000)
   shown=page.evaluate("window.HITEL_TUTOR_PLATFORM.getState().screen")
   if shown!=route:raise AssertionError("WRONG_ROUTE "+route+" opened "+shown)
   text=page.locator("#phone .appscroll").inner_text()
   if len(text.strip())<10:raise AssertionError("EMPTY_CONTENT "+route)
   if route=="bankSearch":
    page.locator("#phone .zb-f-sitebar").first.wait_for(state="attached",timeout=22000)
   if page.evaluate("document.documentElement.scrollWidth > innerWidth + 2"):
    raise AssertionError("HORIZONTAL_OVERFLOW "+route+" width "+str(width))
   if errors:raise AssertionError("SCRIPT_ERROR "+route+": "+str(errors))
   page.screenshot(path=str(OUT/f"{width}-{route}.png"),full_page=False)
   results.append({"width":width,"route":route,"actual":shown,"selector":selector,"content":text[:80]})
   print("DIRECT_SCREEN_PASS",width,route,text[:75].replace("\n"," | "),flush=True)
   ctx.close()
 browser.close()
(OUT/"report.json").write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf8")
print("TUTOR_DIRECT_LINKS_PASSED",len(results),flush=True)
