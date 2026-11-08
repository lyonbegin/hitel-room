#!/usr/bin/env python3
"""Focused regression for both HITEL phone-shell bottom tab and eight-app preview."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get("HITEL_BASE_URL","http://127.0.0.1:3000").rstrip("/")
out=Path("zocbo-bottomnav-evidence");out.mkdir(exist_ok=True)
data={}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
 context=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,locale="ko-KR")
 page=context.new_page()
 errors=[]
 page.on("pageerror",lambda e:errors.append(str(e)[:300]))
 page.goto(BASE+"/?screen=home",wait_until="domcontentloaded",timeout=30000)
 before=page.url
 btn=page.locator('#phone .bottomnav button').filter(has_text="문제은행")
 data["ypt"]={"buttonCount":btn.count(),"target":btn.first.get_attribute("data-go") if btn.count() else None}
 assert btn.count()==1 and data["ypt"]["target"]=="bankSearch",data
 btn.click()
 page.wait_for_selector(".zb-native-summary",timeout=35000)
 data["ypt"].update({"before":before,"after":page.url,"headline":page.locator(".zb-native-summary").inner_text(),"bodyLoaded":page.locator(".zb-native-root").count(),"bottomActive":page.locator(".bottomnav button.selected").inner_text()})
 page.screenshot(path=str(out/"ypt-click.png"),full_page=False)
 assert "screen=bankSearch" in page.url
 assert "411" in data["ypt"]["headline"]
 assert data["ypt"]["bodyLoaded"]>=5
 assert "문제은행" in data["ypt"]["bottomActive"]
 # Audit separately: eight apps has its own independent bank, currently only four examples.
 page.goto(BASE+"/8-apps?app=jokbo&page=home",wait_until="domcontentloaded",timeout=30000)
 other=page.locator('#bottomnav button').filter(has_text="문제은행")
 data["eightApp"]={"buttonCount":other.count(),"beforeText":page.locator("#appcontent").inner_text()[:150]}
 if other.count():
  other.click()
  data["eightApp"].update({"afterText":page.locator("#appcontent").inner_text()[:180],"containsExampleOnly":("학년·과목별 예시" in data["eightApp"]["beforeText"]),"liveApiList":page.locator("#appcontent .zb-native-root").count(),"selectedTab":page.locator("#bottomnav button.on").inner_text()})
  page.screenshot(path=str(out/"eight-app-click.png"),full_page=False)
 context.close();browser.close()
data["errors"]=errors
(out/"report.json").write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
print("BOTTOM_NAV_SMOKE",json.dumps(data,ensure_ascii=False),flush=True)
