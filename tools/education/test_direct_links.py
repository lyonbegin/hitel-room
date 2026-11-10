#!/usr/bin/env python3
"""Each advertised HITEL link must render its *own* UI in a fresh Chromium browser.
Direct entry (not just in-app navigation), independent browser contexts and captures.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, re

BASE=os.getenv("HITEL_BASE_URL","https://hitel-education-zocbo-unified-production.up.railway.app").rstrip("/")
OUT=Path("direct-link-mobile-evidence")
OUT.mkdir(exist_ok=True,parents=True)
CASES=[
 ("groupAITutor","문제집 책장","#phone .bs-books .bs-book",11),
 ("groupPractice","문제풀이","#phone .cs-question-list .cs-problem",6),
 ("groupCoach","학습 코치","#phone .cs-chat .cs-bubble",1),
 ("groupMistakes","오답 복습","#phone .cs-subnav [data-value='groupMistakes']",1),
 ("groupCoachDashboard","학습기록","#phone .cs-week > div",7),
 ("groupLearning","학습","#phone .wp-learning-panel",1),
 ("bankSearch","족보","#phone .appscroll",1),
 ("groupBookDetail","문제집 상세","#phone .bs-detail .bs-chapters button",1),
 ("groupBookLearn","문제집 학습","#phone .bs-reading .bs-lesson-card",1),
 ("groupAITutorPractice","AI 수학 체험","#phone .wp-ai-price",1),
]
def check(v,msg):
 if not v:raise AssertionError(msg)
all_results=[]
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 for width in (390,320):
  for route,title,selector,minimum in CASES:
   context=browser.new_context(viewport={"width":width,"height":844},is_mobile=True,has_touch=True,
     locale="ko-KR",timezone_id="Asia/Seoul")
   page=context.new_page()
   errors=[]
   page.on("pageerror",lambda e:errors.append(str(e)))
   initial=f"{BASE}/?screen={route}&group=demo-five&session=session-example"
   page.goto(initial,wait_until="domcontentloaded",timeout=65000)
   page.locator("#phone .appscroll").wait_for(timeout=35000)
   # Show what actually rendered, not merely a valid HTTP response.
   try:page.locator(selector).first.wait_for(state="attached",timeout=22000)
   except Exception:
    page.screenshot(path=str(OUT/f"FAILED-{width}-{route}.png"),full_page=True)
    raise AssertionError(f"SELECTOR_MISSING route={route} url={page.url} selector={selector} title={page.locator('#phone .appscroll').inner_text()[:380]!r}")
   actual=page.evaluate("window.HITEL_WORKPLACE_INSPECT?.().screen")
   params=dict(page.evaluate("Object.fromEntries(new URLSearchParams(location.search))"))
   shown=page.locator(selector).count()
   body=page.locator("#phone .appscroll").inner_text(timeout=15000)
   selected_tab=page.locator("#phone .bottomnav button.selected").all_inner_texts()
   check(actual==route,f"WRONG_PAGE {route} -> {actual} url={page.url}; snippet={body[:260]!r}")
   check(params.get("screen")==route,f"LINK_REWRITTEN {route} -> {params}")
   check(shown>=minimum,f"NO_EXPECTED_UI {route}: selector={selector} count={shown}")
   check(page.locator("#phone .bottomnav button").count()==5,f"NO_FIVE_TABS {route}")
   check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 2"),f"OVERFLOW {route} width={width}")
   check(len(errors)==0,f"JS_ERROR {route}: {errors}")
   page.screenshot(path=str(OUT/f"{width}-{route}.png"),full_page=False)
   result={"width":width,"route":route,"screen":actual,"url":page.url,"selectorCount":shown,
    "content":body[:165],"selectedTab":selected_tab,"errors":errors}
   all_results.append(result)
   print("DIRECT_ROUTE_PASS",json.dumps(result,ensure_ascii=False),flush=True)
   context.close()
 browser.close()
(OUT/"results.json").write_text(json.dumps({"routes":all_results,"count":len(all_results)},ensure_ascii=False,indent=2))
print("DIRECT_LINKS_VERIFIED",len(all_results),"separate fresh browser navigations",flush=True)
