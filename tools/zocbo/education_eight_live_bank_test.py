#!/usr/bin/env python3
"""Live-route smoke for original 8-app preview's native bottom tab."""
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path("education-eight-bank-test");OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=["--no-sandbox"])
 c=b.new_context(viewport={"width":390,"height":844},is_mobile=True,locale="ko-KR")
 page=c.new_page()
 errors=[]
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto("http://127.0.0.1:3000/?app=jokbo",wait_until="domcontentloaded",timeout=35000)
 btn=page.locator("#bottomnav button").filter(has_text="문제은행")
 assert btn.count()==1,"legacy bank tab missing"
 btn.click()
 page.wait_for_url("https://hitel-zocbo-native-hierarchy-production.up.railway.app/?screen=bankSearch",timeout=35000)
 page.locator(".zb-native-summary").wait_for(timeout=35000)
 count=page.locator(".zb-native-summary").inner_text()
 assert "411" in count,("real Zocbo data not loaded",count)
 assert page.locator(".zb-native-root").count()>=5
 page.screenshot(path=str(OUT/"legacy-bottom-bank-opens-real-live-bank.png"),full_page=False)
 print("EIGHT_APP_BOTTOM_BANK_LIVE_SUCCESS",page.url,count,flush=True)
 assert not errors[:5],errors[:5]
 c.close();b.close()
