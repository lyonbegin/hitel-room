#!/usr/bin/env python3
"""Live Chromium E2E for HITEL unified eight-app Zocbo content.
Verifies menu ownership, source-backed filters, and Gangnam 3 districts.
This does not assert access to copyrighted paper/PDF content.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get("HITEL_BASE_URL","https://hitel-education-zocbo-unified-production.up.railway.app").rstrip("/")
OUT=Path("education-zocbo-unified-evidence")
OUT.mkdir(parents=True,exist_ok=True)
errors=[]
results={"base":BASE,"viewports":[],"consoleErrors":[]}

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    for width in [360,390]:
        ctx=browser.new_context(viewport={"width":width,"height":844},is_mobile=True,has_touch=True,locale="ko-KR")
        page=ctx.new_page()
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(f"{BASE}/?app=jokbo&page=bank",wait_until="domcontentloaded",timeout=60000)
        page.locator("#appcontent .zb-faithful .zb-f-main-tabs").wait_for(timeout=55000)
        assert page.locator("#bottomnav").count()==1,"Host must own one bottom nav"
        assert page.locator("#bottomnav button").count()==3,"Existing education bottom menu must be unchanged"
        assert page.locator("#bottomnav button.on").count()==1,"Selected bottom nav missing"
        assert "문제은행" in page.locator("#bottomnav button.on").inner_text()
        assert page.locator(".zb-original-footer").count()==0,"Duplicate Zocbo footer detected"
        assert page.locator("iframe").count()==0,"Iframe regression"
        assert page.locator("#appcontent .zb-f-main-tabs button").count()==6,"Source main menus missing"
        assert not page.evaluate("document.documentElement.scrollWidth>window.innerWidth+2"),"Horizontal page overflow"
        page.screenshot(path=str(OUT/f"{width}-initial-bank.png"),full_page=True)
        page.locator('#appcontent [data-action="zbFMain"][data-value="gangnam"]').click()
        page.locator("#appcontent .zb-f-districts").wait_for(timeout=60000)
        page.locator("#appcontent .zb-f-gangnam-papers button").first.wait_for(timeout=40000)
        count=page.locator("#appcontent .zb-f-gangnam-papers button").count()
        assert count==20,f"Expected 20 actual captured original public records, got {count}"
        record={"width":width,"originalPublicRecords":count,"districts":[]}
        for district in ["강남구","서초구","송파구"]:
            page.locator(f'#appcontent [data-action="zbFGangnamDistrict"][data-value="{district}"]').click()
            assert page.locator("#appcontent .zb-f-districts button.is-active").inner_text()==district
            page.wait_for_function("""(d)=>{let x=document.querySelector('#appcontent .zb-f-district-schools');
                return x && x.innerText.includes(d) && !x.innerText.includes('조회 중') }""",arg=district,timeout=40000)
            school_count=page.locator("#appcontent .zb-f-school-list button").count()
            error_text=page.locator("#appcontent .zb-f-district-schools [role=alert]").all_inner_texts()
            record["districts"].append({"name":district,"schoolButtons":school_count,"errors":error_text})
            assert school_count>0,(district,"Original school options not loaded",error_text)
            assert not page.evaluate("document.documentElement.scrollWidth>window.innerWidth+2"),f"Horizontal overflow: {district}"
            page.screenshot(path=str(OUT/f"{width}-{district}.png"),full_page=True)
        page.locator("#appcontent .zb-f-gangnam-papers button").first.click()
        assert page.locator("#appcontent .zb-f-gangnam-detail").count()==1
        assert page.locator("#appcontent .zb-f-gangnam-detail").inner_text().count("자료번호")>0
        page.locator('#appcontent [data-action="zbFGangnamClose"]').click()
        assert page.locator("#appcontent .zb-f-gangnam-detail").count()==0
        page.locator("#bottomnav button").filter(has_text="홈").click()
        assert page.locator("#appcontent .zb-faithful").count()==0
        page.locator("#bottomnav button").filter(has_text="문제은행").click()
        page.locator("#appcontent .zb-faithful .zb-f-main-tabs").wait_for(timeout=55000)
        assert page.locator("#bottomnav").count()==1
        results["viewports"].append(record)
        ctx.close()
    browser.close()
results["consoleErrors"]=errors
(OUT/"report.json").write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
assert not errors,errors
print("HITEL_UNIFIED_ZOCBO_GANGNAM_3_REAL_BROWSER_PASSED",json.dumps(results,ensure_ascii=False))
