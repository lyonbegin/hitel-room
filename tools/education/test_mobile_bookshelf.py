#!/usr/bin/env python3
"""Mobile-only education bookshelf QA, independent of third-party Zocbo school API."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.getenv("HITEL_BASE_URL","https://hitel-education-zocbo-unified-production.up.railway.app").rstrip("/")
OUT = Path("education-bookshelf-mobile-evidence")
OUT.mkdir(exist_ok=True,parents=True)
REPORT = {"base":BASE,"screens":[],"errors":[]}
def assert_ok(ok,label):
    if not ok: raise AssertionError(label)
def snapshot(page,width,name):
    page.screenshot(path=str(OUT/f"{width}-{name}.png"),full_page=False)
def read_state(page):
    return page.evaluate("JSON.parse(localStorage.getItem('hitel.education.bookshelf.v1'))")
def read_groups(page):
    return page.evaluate("JSON.parse(localStorage.getItem('hitel.ypt.group-workplace.v1'))")
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    for width in (320,360,390,430):
        ctx=browser.new_context(viewport={"width":width,"height":844},is_mobile=True,has_touch=True,locale="ko-KR",timezone_id="Asia/Seoul")
        page=ctx.new_page()
        errors=[]
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto(BASE+"/?screen=groupAITutor&group=demo-five&session=session-example",wait_until="domcontentloaded",timeout=60000)
        page.locator("#phone .bs-library .bs-books").wait_for(timeout=40000)
        snapshot(page,width,"book-list")
        assert_ok(page.locator(".map-pane").evaluate("(n)=>getComputedStyle(n).display")==="none","left panel visible")
        assert_ok(page.locator(".audit-pane").evaluate("(n)=>getComputedStyle(n).display")==="none","right panel visible")
        assert_ok(page.locator(".stage-top").evaluate("(n)=>getComputedStyle(n).display")==="none","debug top visible")
        assert_ok(page.locator(".stage-bottom").evaluate("(n)=>getComputedStyle(n).display")==="none","debug footer visible")
        assert_ok(page.locator("#phone").bounding_box()["width"]>=width-2,"app not mobile full width")
        assert_ok(page.locator("#phone .bottomnav button").count()==5,"five tabs")
        assert_ok(page.locator("#phone .bs-books .bs-book").count()==11,"middle school 2 semester 1 book list")
        assert_ok(page.evaluate("window.HITEL_BOOKSHELF_INSPECT().libraryCount")==33,"33 sample book entries")
        assert_ok(page.locator("#phone .bs-books").evaluate("(n)=>getComputedStyle(n).gridTemplateColumns.split(' ').length")==2,"book grid not 2 cover columns")
        assert_ok(page.evaluate("document.documentElement.scrollWidth <= innerWidth+2"),"horizontal viewport overflow on catalog")
        bookid=page.locator("#phone .bs-books .bs-book-open").first.get_attribute("data-val")
        page.locator("#phone .bs-books .bs-book-open").first.click()
        page.locator("#phone .bs-detail").wait_for()
        assert_ok("groupBookDetail" in page.url,"book detail not reached")
        page.locator("#phone [data-bs='mineToggle']").click()
        assert_ok(bookid in read_state(page)["mine"],"book not saved in personal shelf")
        page.locator("#phone [data-bs='groupToggle']").click()
        assert_ok(bookid in next(g for g in read_groups(page)["groups"] if g["id"]=="demo-five")["bookShelf"],"group shelf not saved")
        page.locator("#phone #bs-other-group").select_option("my-study")
        page.locator("#phone [data-bs='shareOther']").click()
        assert_ok(bookid in next(g for g in read_groups(page)["groups"] if g["id"]=="my-study")["bookShelf"],"cross-group share not saved")
        page.locator("#phone #bs-note-type").select_option("오답")
        page.locator("#phone #bs-note-text").fill("수학의 원리를 다시 확인하겠습니다.")
        page.locator("#phone #bs-book-note-form button[type='submit']").click()
        assert_ok(page.locator("#phone .bs-note-row").count()==1,"chapter note not saved")
        assert_ok(len(read_state(page)["bookNotes"])==1,"notes not persisted")
        page.locator("#phone [data-bs='progress'][data-val='50']").click()
        assert_ok(read_state(page)["progress"].get(bookid)==50,"progress not stored")
        page.locator("#phone [data-bs='learn']").click()
        page.locator("#phone .bs-lesson-card").wait_for()
        assert_ok(page.locator("#phone .bs-lesson-card").count()==1,"study should show only one stage at a time")
        page.locator("#phone [data-bs='lessonStep'][data-val='1']").click()
        assert_ok(page.locator("#phone .bs-lesson-count").inner_text()=="STEP 02","next step not working")
        snapshot(page,width,"one-step-learning")
        page.locator("#phone [data-bs='go'][data-val='groupBookDetail']").click()
        page.locator("#phone [data-bs='back']").click()
        page.locator("#phone [data-bs='tab'][data-val='mine']").click()
        assert_ok(page.locator("#phone .bs-activity .bs-day").count()==7,"weekly study calendar not shown")
        assert_ok("1" in page.locator("#phone .bs-shelf-stats").inner_text(),"personal bookshelf stats not counted")
        assert_ok(page.locator("#phone .bs-books .bs-book").count()==1,"personal saved books")
        snapshot(page,width,"personal-shelf")
        page.locator("#phone [data-bs='tab'][data-val='group']").click()
        assert_ok(page.locator("#phone .bs-books .bs-book").count()==1,"selected group bookshelf")
        assert_ok(page.evaluate("document.documentElement.scrollWidth <= innerWidth+2"),"horizontal viewport overflow on group shelf")
        assert_ok(not errors,"page JS errors: "+str(errors))
        REPORT["screens"].append({"width":width,"book_count":33,"selected_group_books":1,"personal_books":1,
         "notes":1,"mobile_single_pane":True,"step_by_step":True,"errors":errors})
        ctx.close()
    browser.close()
(OUT/"result.json").write_text(json.dumps(REPORT,ensure_ascii=False,indent=2),encoding="utf-8")
print("MOBILE_EDUCATION_BOOKSHELF_PASSED",json.dumps(REPORT,ensure_ascii=False),flush=True)
