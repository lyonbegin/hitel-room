#!/usr/bin/env python3
"""Six mobile tabs, all public submenus, exact source counts and click functionality.
No fabricated responses; original data must have been captured by Actions.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path("zocbo-six-menu-e2e")
OUT.mkdir(exist_ok=True)
expected={
"concept":[("concept_complete",158),("concept_calculation",62)],
"unit":[("unit_level",383),("unit_master",118)],
"practice":[("practice_essay",51),("practice_frequent",68),("practice_wrong",0),("practice_top",0),("practice_performance",0),("practice_textbook",0)],
"final":[("final_main",0)],
"school":[("school_expected",0)],
"gangnam":[("gangnam_list",20)]
}
results={}
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
 for width in (390,360):
  ctx=browser.new_context(viewport={"width":width,"height":844},is_mobile=True,device_scale_factor=1,locale="ko-KR")
  page=ctx.new_page()
  page.set_default_timeout(22000)
  page.on("pageerror",lambda err:errors.append(str(err)[:250]))
  page.goto("http://127.0.0.1:3000/?screen=bankSearch",wait_until="domcontentloaded",timeout=35000)
  page.wait_for_function("()=>document.querySelector('#phone .zb-native-summary')?.innerText.includes('411')",timeout=45000)
  assert page.locator('#phone .zb-all-tabs button').count()==6
  results[f"{width}"]=dict(qa={},firstCount=page.locator(".zb-native-summary").inner_text())
  # First use UI unit grade controls to select the user's original middle-2 case.
  page.locator('[data-action="zbNativeGrade"][data-value="중2"]').first.click()
  page.wait_for_function("()=>document.querySelector('#phone .zb-native-summary')?.innerText.includes('383')",timeout=35000)
  for tab,checks in expected.items():
   page.locator(f'#phone .zb-all-tabs button[data-value="{tab}"]').click()
   for slug,count in checks:
    if page.locator(f'[data-action="zbAllSub"][data-value="{slug}"]').count():
     page.locator(f'[data-action="zbAllSub"][data-value="{slug}"]').click()
    else:
     assert slug in ('gangnam_list','school_expected','final_main'),slug
    if tab=='unit' and slug=='unit_level':
     page.wait_for_function("()=>document.querySelector('#phone .zb-native-summary')?.innerText.includes('383')",timeout=40000)
     found=page.locator(".zb-native-episode").count()
     results[f"{width}"]["qa"][slug]={"count":383,"rootChapters":page.locator(".zb-native-root").count()}
     continue
    if tab=='unit' and slug!='unit_level':
     page.wait_for_function("()=>document.querySelector('#phone .zb-all-raw')!==null",timeout=35000)
    elif tab!='unit':
     page.wait_for_function("()=>document.querySelector('#phone .zb-all-raw')!==null",timeout=35000)
    if tab in ('school','final','practice','concept','gangnam','unit'):
     page.wait_for_function("()=>!document.querySelector('#phone .zb-native-loading')",timeout=45000)
    inner=page.locator("#phone .zb-all-raw").inner_text()
    displayed=page.locator("#phone .zb-native-summary").first.inner_text() if page.locator("#phone .zb-native-summary").count() else ""
    if count:
     assert f"{count}건" in displayed,(slug,displayed,inner[:190])
    elif slug.startswith("practice_") or slug=="final_main":
     assert "공개 단원·회차 자료가 확인되지 않았습니다" in inner,(slug,inner[:120])
    if tab=="school":
     assert page.locator(".zb-all-school-controls >button").count()==7
     assert "서울" in inner and "강남구" in inner and "숙명여자중학교" in inner
    if tab=="gangnam":
     assert page.locator(".zb-native-title-item").count()==20
    results[f"{width}"]["qa"][slug]={"expected":count,"displayed":displayed,"buttons":page.locator('[data-action="zbAllRecord"]').count()}
    if slug in ('concept_complete','practice_essay','gangnam_list'):
     if tab in ('concept','practice'):
      page.locator('[data-action="zbAllRoot"]').first.click()
      page.locator('[data-action="zbAllOpenSub"]').first.click()
     button=page.locator('[data-action="zbAllRecord"]').first
     sourceId=button.get_attribute('data-value')
     button.click()
     sheet=page.get_by_role('dialog',name='원본 자료 정보')
     sheet.wait_for()
     assert sourceId in sheet.inner_text(),(slug,sourceId,sheet.inner_text())
     page.locator('[data-action="zbAllClose"]').last.click()
    if slug in ('concept_complete','unit_master','practice_essay','final_main','school_expected','gangnam_list'):
     page.screenshot(path=str(OUT/f"{slug}-{width}.png"),full_page=False)
   assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),(width,tab,'horizontal overflow')
   assert page.locator('#phone iframe').count()==0
  ctx.close()
 browser.close()
results["browserErrors"]=errors
(OUT/"results.json").write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf8")
assert not errors,errors
print("ZOCBO_ALL_SIX_MENUS_SUCCESS",json.dumps(results,ensure_ascii=False)[:5000])
